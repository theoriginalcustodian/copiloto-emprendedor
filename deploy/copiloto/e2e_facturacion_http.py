"""E2E de facturación por HTTP: el camino EXACTO de la app, de punta a punta, en homologación.

Emitir → PDF → consultar → anular con nota de crédito. Sin tocar Temporal directamente: sólo los
endpoints que consume el frontend. Un E2E que hable con Temporal pasaría aunque el router HTTP
estuviera roto — y eso ya pasó una vez.

Corre EN EL VPS, contra el tenant que deja `setup_tenant_pruebas.py`:
    /opt/uc-copiloto-venv/bin/python deploy/copiloto/e2e_facturacion_http.py

**Homologación**: los comprobantes tienen CAE real pero NO tienen efecto fiscal.
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request
from datetime import date

BASE = os.environ.get("COPILOTO_SMOKE_BASE", "http://127.0.0.1:8099")
UNIT = "uc-copiloto-web.service"
EMAIL = os.environ.get("COPILOTO_TENANT_PRUEBAS_EMAIL", "pruebas-facturacion@copiloto.test")
IMPORTE = os.environ.get("E2E_IMPORTE", "1500.00")


def _heredar_env_del_proceso(unit: str) -> None:
    pid = subprocess.check_output(
        ["systemctl", "show", unit, "-p", "MainPID", "--value"]).decode().strip()
    with open(f"/proc/{pid}/environ", "rb") as fh:
        for entrada in fh.read().split(b"\x00"):
            if b"=" in entrada:
                clave, valor = entrada.decode("utf-8", "replace").split("=", 1)
                os.environ.setdefault(clave, valor)


_heredar_env_del_proceso(UNIT)

import jwt  # noqa: E402
import psycopg2  # noqa: E402

fallas: list[str] = []


def check(nombre: str, cond: bool, detalle: str = "") -> bool:
    print(("OK    " if cond else "FALLA ") + nombre + (f": {detalle}" if detalle else ""))
    if not cond:
        fallas.append(nombre)
    return cond


def _token_y_cuit() -> tuple[str, str]:
    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    conn.autocommit = True
    with conn.cursor() as cur:
        cur.execute("SELECT auth_user_id, cliente_id FROM uc_factory.tenants WHERE email=%s", (EMAIL,))
        fila = cur.fetchone()
        if not fila:
            sys.exit(f"no existe el tenant {EMAIL}: corré primero setup_tenant_pruebas.py")
        auth_user_id, cliente_id = fila
        # `afip_credentials` tiene FORCE ROW LEVEL SECURITY: sin declarar el tenant, esta consulta
        # devuelve 0 filas y el script aborta con "no tiene certificado activo" — un diagnóstico
        # falso que manda a revisar el onboarding en vez de la conexión. `tenants` (arriba) no lo
        # necesita: es la tabla que resuelve el tenant y por eso está exenta.
        cur.execute("SELECT set_config('request.jwt.claims', %s, false)",
                    (json.dumps({"cliente_id": str(cliente_id)}),))
        cur.execute("SELECT cuit FROM uc_factory.afip_credentials WHERE cliente_id=%s AND activo",
                    (cliente_id,))
        cred = cur.fetchone()
        if not cred:
            sys.exit(f"el tenant {EMAIL} no tiene certificado activo")
    conn.close()
    claims = {"sub": str(auth_user_id), "exp": int(time.time()) + 1800,
              "aud": "authenticated", "role": "authenticated"}
    issuer = os.environ.get("COPILOTO_JWT_ISSUER")
    if issuer:
        claims["iss"] = issuer
    return jwt.encode(claims, os.environ["SUPABASE_JWT_SECRET"], algorithm="HS256"), cred[0]


TOKEN, CUIT = _token_y_cuit()


def call(metodo: str, path: str, body: dict | None = None) -> tuple[int, dict | str]:
    req = urllib.request.Request(
        BASE + path, method=metodo,
        headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"},
        data=json.dumps(body).encode() if body is not None else None)
    try:
        with urllib.request.urlopen(req, timeout=90) as r:
            crudo = r.read().decode()
            return r.status, (json.loads(crudo) if crudo.startswith(("{", "[")) else crudo)
    except urllib.error.HTTPError as e:
        crudo = e.read().decode()
        return e.code, (json.loads(crudo) if crudo.startswith(("{", "[")) else crudo)


def esperar(factura_id: str, cond, limite: int = 60) -> dict:
    """Poleá hasta que se cumpla la condición. Devuelve el último estado leído."""
    estado: dict = {}
    for _ in range(limite):
        codigo, estado = call("GET", f"/afip/facturas/{factura_id}")
        if codigo == 200 and cond(estado):
            return estado
        time.sleep(2)
    return estado


def main() -> int:
    print(f"tenant={EMAIL}  cuit={CUIT}  base={BASE}  HOMOLOGACIÓN (sin efecto fiscal)\n")

    codigo, estado_inicial = call("GET", "/afip/estado")
    if not check("puede facturar", codigo == 200 and estado_inicial.get("puede_facturar") is True,
                 f"ambiente={estado_inicial.get('ambiente')}"):
        return 1

    # -- emisión ------------------------------------------------------------
    codigo, cuerpo = call("POST", "/afip/facturas", {"cuit": CUIT})
    if not check("POST /afip/facturas", codigo == 200 and "factura_id" in cuerpo, str(cuerpo)[:120]):
        return 1
    fid = cuerpo["factura_id"]

    call("POST", f"/afip/facturas/{fid}/datos-venta",
         {"fecha": date.today().isoformat(), "concepto": 1, "condicion_venta": "Contado"})
    call("POST", f"/afip/facturas/{fid}/items",
         {"descripcion": "Servicio de prueba E2E", "cantidad": "1", "precio_unitario": IMPORTE})
    call("POST", f"/afip/facturas/{fid}/cliente", {"condicion_iva": 5, "tipo_doc": 99})

    estado = esperar(fid, lambda e: e.get("estado") == "esperando_confirmacion")
    if not check("la máquina de estados llega a esperando_confirmacion",
                 estado.get("estado") == "esperando_confirmacion",
                 f"estado={estado.get('estado')} faltantes={[f.get('codigo') for f in estado.get('faltantes', [])]}"):
        return 1
    check("el total se calculó", estado.get("total") == IMPORTE, f"total={estado.get('total')}")

    token_conf = estado.get("token_confirmacion")
    if not check("hay token de confirmación", bool(token_conf), str(token_conf)):
        return 1

    # Un token viejo NO puede emitir: es la defensa contra confirmar algo distinto de lo que se vio.
    codigo, _ = call("POST", f"/afip/facturas/{fid}/confirmar", {"token": "token-inventado"})
    estado_tras_token_falso = esperar(fid, lambda e: e.get("motivo_codigo") == "token_desactualizado", 5)
    check("un token inválido NO emite",
          estado_tras_token_falso.get("estado") != "emitida",
          f"motivo_codigo={estado_tras_token_falso.get('motivo_codigo')}")

    codigo, cuerpo = call("POST", f"/afip/facturas/{fid}/confirmar", {"token": token_conf})
    check("POST confirmar", codigo == 200, str(cuerpo)[:100])

    # Esperar `terminado`, NO `resultado`: el CAE aparece antes que el PDF, así que salir con el
    # primer `resultado` mide la emisión y reporta el PDF como ausente aunque esté por llegar. Es el
    # mismo error que ya cometí en el smoke — una condición de espera laxa no falla: miente.
    estado = esperar(fid, lambda e: e.get("terminado"), 90)
    resultado = estado.get("resultado") or {}
    if not check("AFIP devolvió CAE", bool(resultado.get("cae")),
                 f"estado={estado.get('estado')} motivo={estado.get('motivo')}"):
        return 1
    nro, cae = resultado.get("nro"), resultado.get("cae")
    print(f"      → Factura C {resultado.get('punto_venta'):04d}-{nro:08d}  CAE {cae}")

    pdf = estado.get("pdf") or {}
    check("se generó el PDF", bool(pdf.get("url")), str(pdf)[:120])

    # -- consulta -----------------------------------------------------------
    codigo, cuerpo = call("GET", f"/afip/comprobantes?cuit={CUIT}")
    emitidos = cuerpo.get("comprobantes", []) if isinstance(cuerpo, dict) else []
    check("el comprobante aparece en el listado",
          any(c.get("nro") == nro for c in emitidos), f"{len(emitidos)} comprobantes")

    # -- anulación por nota de crédito -------------------------------------
    codigo, cuerpo = call("POST", "/afip/comprobantes/anular",
                          {"cuit": CUIT, "tipo_cbte": resultado.get("tipo_cbte", 11),
                           "punto_venta": resultado.get("punto_venta"), "nro": nro})
    if not check("POST anular", codigo == 200 and "anulacion_id" in cuerpo, str(cuerpo)[:120]):
        return 1
    aid = cuerpo["anulacion_id"]

    anulacion: dict = {}
    for _ in range(30):
        codigo, anulacion = call("GET", f"/afip/anulaciones/{aid}")
        if codigo == 200 and anulacion.get("paso") in ("esperando_confirmacion", "confirmada",
                                                       "emitida", "fallida"):
            break
        time.sleep(2)
    check("la anulación encontró el original",
          bool(anulacion.get("original")), f"paso={anulacion.get('paso')}")

    call("POST", f"/afip/anulaciones/{aid}/confirmar")
    for _ in range(45):
        codigo, anulacion = call("GET", f"/afip/anulaciones/{aid}")
        if codigo == 200 and (anulacion.get("resultado") or anulacion.get("errores")):
            break
        time.sleep(2)
    nc = anulacion.get("resultado") or {}
    if check("la nota de crédito tiene CAE", bool(nc.get("cae")),
             f"paso={anulacion.get('paso')} errores={anulacion.get('errores')}"):
        print(f"      → Nota de crédito N° {nc.get('nro')}  CAE {nc.get('cae')}")

    # El marcado del original es una activity que corre DESPUÉS de que la NC tiene CAE: leer el
    # listado apenas aparece el CAE mide el instante equivocado. Cuarta vez que una espera laxa me
    # reporta un fallo inexistente en esta sesión — una condición de espera que sale antes de tiempo
    # no falla ruidosamente, miente en silencio.
    original = None
    for _ in range(20):
        codigo, cuerpo = call("GET", f"/afip/comprobantes?cuit={CUIT}")
        emitidos = cuerpo.get("comprobantes", []) if isinstance(cuerpo, dict) else []
        original = next((c for c in emitidos if c.get("nro") == nro and c.get("tipo_cbte") == 11), None)
        if original and original.get("estado") == "anulada":
            break
        time.sleep(2)
    check("el original quedó marcado como anulado",
          bool(original) and original.get("estado") == "anulada",
          f"estado={(original or {}).get('estado')} asoc={(original or {}).get('cbte_asoc_nro')}")

    print("\nE2E FACTURACIÓN HTTP: " + ("VERDE" if not fallas else f"ROJO -> {fallas}"))
    return 0 if not fallas else 1


if __name__ == "__main__":
    sys.exit(main())
