"""E2E del archivado en Drive, por el camino HTTP EXACTO que usa la app.

Qué verifica, en orden:
  1. Con el ajuste APAGADO (default): la factura sale y el archivado reporta "desactivado".
  2. `POST /afip/ajustes` sin perfil -> 409, y con perfil -> guarda de verdad (se relee).
  3. Con el ajuste PRENDIDO y Drive NO conectado: la factura IGUAL sale con CAE. Este es el caso que
     más importa: un problema de Drive no puede convertir una emisión exitosa en un fallo.
  4. Contra el Drive REAL de un tenant que sí lo tiene conectado, con el PDF REAL recién emitido:
     el archivo aparece, es el PDF, y queda accesible por link.

El paso 4 usa un tenant distinto del que emite porque HOY ningún tenant tiene las dos cosas (el de
pruebas tiene certificado AFIP y no Drive; el del operador al revés). Conectar Drive exige un OAuth
en navegador que ningún script puede hacer. Se prueba igual el camino completo de archivado con un
PDF de AFIP auténtico — lo único que queda sin ejercitar encadenado es "el mismo tenant hace las dos".

Corre EN EL VPS:  /opt/uc-copiloto-venv/bin/python deploy/copiloto/e2e_archivado_drive.py
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request

BASE = os.environ.get("COPILOTO_E2E_BASE", "http://127.0.0.1:8099")
UNIT = "uc-copiloto-web.service"
EMAIL = os.environ.get("COPILOTO_E2E_EMAIL", "pruebas-facturacion@copiloto.test")


def _heredar_env_del_proceso(unit: str) -> None:
    pid = subprocess.run(["systemctl", "show", "-p", "MainPID", "--value", unit],
                         capture_output=True, text=True).stdout.strip()
    if not pid or pid == "0":
        sys.exit(f"[FATAL] {unit} no está corriendo")
    with open(f"/proc/{pid}/environ", "rb") as fh:
        for par in fh.read().split(b"\0"):
            if b"=" in par:
                k, _, v = par.partition(b"=")
                os.environ.setdefault(k.decode(), v.decode())


_heredar_env_del_proceso(UNIT)

import jwt  # noqa: E402
import psycopg2  # noqa: E402

FALLOS: list[str] = []


def check(nombre: str, cond: bool, detalle: str = "") -> bool:
    print(f"  {'OK  ' if cond else 'FALLA'} {nombre}{(' — ' + detalle) if detalle else ''}")
    if not cond:
        FALLOS.append(nombre)
    return cond


def _conn():
    c = psycopg2.connect(os.environ["DATABASE_URL"])
    c.autocommit = True
    return c


def _token_y_cuit() -> tuple[str, str, str]:
    with _conn() as conn, conn.cursor() as cur:
        cur.execute("SELECT auth_user_id, cliente_id FROM uc_factory.tenants WHERE email=%s", (EMAIL,))
        fila = cur.fetchone()
        if not fila:
            sys.exit(f"no existe el tenant {EMAIL}: corré setup_tenant_pruebas.py")
        auth_user_id, cliente_id = fila
        # Ver la nota equivalente en `e2e_facturacion_http.py`: `afip_credentials` tiene FORCE RLS y
        # sin declarar el tenant esta consulta da 0 filas → aborta con un diagnóstico falso.
        cur.execute("SELECT set_config('request.jwt.claims', %s, false)",
                    (json.dumps({"cliente_id": str(cliente_id)}),))
        cur.execute("SELECT cuit FROM uc_factory.afip_credentials WHERE cliente_id=%s AND activo",
                    (cliente_id,))
        cred = cur.fetchone()
        if not cred:
            sys.exit(f"{EMAIL} no tiene certificado activo")
    claims = {"sub": str(auth_user_id), "exp": int(time.time()) + 1800,
              "aud": "authenticated", "role": "authenticated"}
    issuer = os.environ.get("COPILOTO_JWT_ISSUER")
    if issuer:
        claims["iss"] = issuer
    return (jwt.encode(claims, os.environ["SUPABASE_JWT_SECRET"], algorithm="HS256"),
            cred[0], str(cliente_id))


TOKEN, CUIT, CLIENTE_ID = _token_y_cuit()


def call(metodo: str, path: str, body: dict | None = None):
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


def emitir_una(etiqueta: str) -> dict:
    """Emite una factura de consumidor final y devuelve el estado final del workflow."""
    codigo, r = call("POST", "/afip/facturas", {"cuit": CUIT})
    if codigo != 200:
        sys.exit(f"[FATAL] no pude abrir el borrador ({etiqueta}): {codigo} {r}")
    fid = r["factura_id"]

    hoy = time.strftime("%Y-%m-%d")
    call("POST", f"/afip/facturas/{fid}/datos-venta",
         {"fecha": hoy, "concepto": 1, "condicion_venta": "contado"})
    call("POST", f"/afip/facturas/{fid}/items",
         {"descripcion": f"Servicio {etiqueta}", "cantidad": "1", "precio_unitario": "100.00"})
    call("POST", f"/afip/facturas/{fid}/cliente",
         {"condicion_iva": 5, "tipo_doc": 99, "nro_doc": "0"})

    estado = {}
    for _ in range(30):
        _c, estado = call("GET", f"/afip/facturas/{fid}")
        if estado.get("token_confirmacion"):
            break
        time.sleep(1)
    token = estado.get("token_confirmacion")
    if not token:
        sys.exit(f"[FATAL] el borrador nunca quedó confirmable ({etiqueta}): {estado}")

    call("POST", f"/afip/facturas/{fid}/confirmar", {"token": token})

    # Se corta por `terminado` A SECAS. Ese campo ahora significa "el workflow no va a escribir nada
    # más", no "el estado suena final": incluye el archivado en Drive, que ocurre DESPUÉS de que la
    # factura se marca ENTREGADA. La primera versión de este script cortaba en cuanto veía la factura
    # entregada y leía `drive: {}` sobre una factura que segundos después sí tenía su dato — el mismo
    # error que la sesión frontend cometió con `estado === 'emitida'`. Cortar acá es, además, la
    # verificación de que `terminado` cumple ese contrato.
    for _ in range(60):
        _c, estado = call("GET", f"/afip/facturas/{fid}")
        if estado.get("terminado"):
            break
        time.sleep(2)
    return estado


def main() -> int:
    print(f"=== E2E archivado en Drive · tenant {EMAIL} · CUIT {CUIT} ===\n")

    # Precondición ESTABLECIDA, no asumida: la corrida anterior dejó el ajuste prendido (lo prende el
    # paso 2 y nadie lo apagaba), así que el paso 1 medía un estado que él mismo no había fijado y
    # fallaba en la segunda corrida. Un E2E que sólo pasa la primera vez no es un E2E.
    codigo, _ = call("POST", "/afip/ajustes", {"cuit": CUIT, "guardar_en_drive": False})
    print(f"[0] precondición: ajuste apagado (HTTP {codigo})\n")

    print("[1] ajuste APAGADO (default) — la factura sale y el archivado se abstiene")
    est = emitir_una("flag-off")
    cae1 = (est.get("resultado") or {}).get("cae")
    check("la factura se emitió con CAE", bool(cae1), f"CAE={cae1}")
    drive = est.get("drive") or {}
    check("el archivado reporta 'desactivado'", drive.get("motivo") == "desactivado", json.dumps(drive))
    check("no dice haber guardado nada", drive.get("guardado") is False)

    print("\n[2] endpoint de ajustes")
    codigo, r = call("POST", "/afip/ajustes", {"cuit": "99999999999", "guardar_en_drive": True})
    check("CUIT sin perfil -> 409 (no un ok mentiroso)", codigo == 409, f"{codigo} {r}")

    codigo, r = call("POST", "/afip/ajustes", {"cuit": CUIT, "guardar_en_drive": True})
    check("CUIT con perfil -> 200", codigo == 200, json.dumps(r))
    codigo, r = call("GET", f"/afip/perfil?cuit={CUIT}")
    check("y al releer el perfil el flag QUEDÓ guardado",
          bool((r.get("perfil") or {}).get("guardar_en_drive")),
          f"guardar_en_drive={(r.get('perfil') or {}).get('guardar_en_drive')}")

    print("\n[3] ajuste PRENDIDO con Drive NO conectado — la emisión no puede romperse")
    est = emitir_una("flag-on")
    cae2 = (est.get("resultado") or {}).get("cae")
    pdf_url = (est.get("pdf") or {}).get("url")
    check("la factura se emitió igual, con CAE", bool(cae2), f"CAE={cae2}")
    check("el estado NO es rechazada", est.get("estado") != "rechazada", f"estado={est.get('estado')}")
    drive = est.get("drive") or {}
    check("el archivado reporta que no pudo, sin tumbar nada",
          drive.get("guardado") is False and bool(drive.get("motivo")), json.dumps(drive))

    print("\n[4] archivado REAL contra el Drive del tenant que sí lo tiene conectado")
    if not pdf_url:
        check("hay un PDF fresco para archivar", False, "la factura salió sin PDF")
        return 1 if FALLOS else 0

    with _conn() as conn, conn.cursor() as cur:
        cur.execute("""SELECT t.cliente_id FROM uc_factory.tenants t
                       WHERE t.cliente_id::text = %s""",
                    ("48a9d75f-124b-4f9d-af8d-a73e2311bbbd",))
        con_drive = cur.fetchone()
    if not con_drive:
        check("hay un tenant con Drive conectado", False, "ninguno")
        return 1

    sys.path.insert(0, "/opt/uc-repos/copiloto/apps/copiloto")
    os.chdir("/opt/uc-repos/copiloto/apps/copiloto")
    from _paths import ensure_paths

    ensure_paths()
    from afip_drive import archivar_pdf
    from clients.agent.providers.composio_gateway import ComposioGateway
    import services

    gw = ComposioGateway(services.merged_policy())
    nombre = f"_e2e-archivado-{int(time.time())}.pdf"
    res = archivar_pdf(gw, user_id=str(con_drive[0]), nombre=nombre, pdf_url=pdf_url)

    check("el PDF real de AFIP se subió a Drive", res.guardado, f"file_id={res.file_id}")
    check("quedó compartido por link", res.compartido, res.motivo or "")
    check("el link es de descarga, no del visor", bool(res.link and "export=download" in res.link),
          str(res.link))

    if res.link:
        try:
            req = urllib.request.Request(res.link, headers={"User-Agent": "curl/8"})
            with urllib.request.urlopen(req, timeout=30) as r:
                cuerpo = r.read(5)
                check("un extraño puede DESCARGARLO y es un PDF de verdad",
                      cuerpo[:4] == b"%PDF", f"HTTP {r.status} primeros bytes={cuerpo!r}")
        except Exception as exc:  # noqa: BLE001
            check("un extraño puede descargarlo", False, str(exc))

    print(f"\n   (queda en el Drive como «{nombre}» — evidencia, borrable a mano)")

    print("\n" + "=" * 70)
    if FALLOS:
        print(f"E2E ARCHIVADO: {len(FALLOS)} FALLAS -> {FALLOS}")
        return 1
    print("E2E ARCHIVADO: TODO VERDE")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
