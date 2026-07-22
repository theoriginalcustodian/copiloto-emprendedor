"""Smoke de la superficie HTTP de facturación AFIP — el camino EXACTO que usa la app.

Por qué existe además del E2E de `spikes/afip-e2e/`: aquel ejercita los workflows llamando a Temporal
directamente, así que pasa aunque el router HTTP no esté montado o las fábricas de `serve.py` estén mal
cableadas. Frontend no habla con Temporal: habla con estos endpoints. Este smoke prueba esa capa.

Corre EN EL VPS (necesita la DB y el front-door):
    /opt/uc-copiloto-venv/bin/python deploy/copiloto/smoke_afip_http.py

No emite ningún comprobante: crea un borrador, lo consulta y lo cancela.

El env se hereda del PROCESO vivo (`/proc/<pid>/environ`), no de un archivo de config adivinado — así el
smoke usa exactamente la configuración con la que el servicio está corriendo, y no puede pasar en verde
contra un env distinto del real.
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request

BASE = os.environ.get("COPILOTO_SMOKE_BASE", "http://127.0.0.1:8099")
UNIT = os.environ.get("COPILOTO_SMOKE_UNIT", "uc-copiloto-web.service")
CUIT = os.environ.get("COPILOTO_SMOKE_CUIT", "20269996065")


def _heredar_env_del_proceso(unit: str) -> None:
    pid = subprocess.check_output(
        ["systemctl", "show", unit, "-p", "MainPID", "--value"]).decode().strip()
    if not pid or pid == "0":
        sys.exit(f"{unit} no está corriendo (MainPID={pid!r})")
    with open(f"/proc/{pid}/environ", "rb") as fh:
        for entrada in fh.read().split(b"\x00"):
            if b"=" in entrada:
                clave, valor = entrada.decode("utf-8", "replace").split("=", 1)
                os.environ.setdefault(clave, valor)


_heredar_env_del_proceso(UNIT)

import jwt  # noqa: E402  (después de heredar el env, por coherencia con el resto)
import psycopg2  # noqa: E402


def _token_de_un_tenant_real() -> tuple[str, str]:
    """Firma un JWT para un tenant EXISTENTE. Sin tenant no hay smoke posible: `require_tenant`
    resuelve el `cliente_id` contra la tabla, no contra el claim."""
    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    conn.autocommit = True
    with conn.cursor() as cur:
        cur.execute("SELECT auth_user_id, cliente_id FROM uc_factory.tenants LIMIT 1")
        fila = cur.fetchone()
    conn.close()
    if not fila:
        sys.exit("no hay ningún tenant en uc_factory.tenants")
    auth_user_id, cliente_id = fila
    claims = {"sub": str(auth_user_id), "exp": int(time.time()) + 600,
              "aud": "authenticated", "role": "authenticated"}
    issuer = os.environ.get("COPILOTO_JWT_ISSUER")
    if issuer:
        claims["iss"] = issuer
    return jwt.encode(claims, os.environ["SUPABASE_JWT_SECRET"], algorithm="HS256"), str(cliente_id)


TOKEN, CLIENTE_ID = _token_de_un_tenant_real()


def call(metodo: str, path: str, body: dict | None = None) -> tuple[int, str]:
    req = urllib.request.Request(
        BASE + path, method=metodo,
        headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"},
        data=json.dumps(body).encode() if body is not None else None)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return resp.status, resp.read().decode()[:400]
    except urllib.error.HTTPError as err:
        return err.code, err.read().decode()[:400]


fallas: list[str] = []


def check(nombre: str, condicion: bool, detalle: str) -> None:
    print(("OK    " if condicion else "FALLA ") + nombre + ": " + detalle)
    if not condicion:
        fallas.append(nombre)


def main() -> int:
    print(f"tenant={CLIENTE_ID} base={BASE} cuit={CUIT}\n")

    # Sin Authorization NO puede pasar: el 401 tiene que venir del router, no del fallback del SPA
    # (toda ruta desconocida devuelve el index.html con 200 — por eso un 200 no prueba nada).
    sin_token = urllib.request.Request(BASE + "/afip/estado?cuit=" + CUIT)
    try:
        with urllib.request.urlopen(sin_token, timeout=15) as r:
            codigo, cuerpo = r.status, r.read().decode()[:120]
    except urllib.error.HTTPError as e:
        codigo, cuerpo = e.code, e.read().decode()[:120]
    check("sin token -> 401 (no el SPA)", codigo == 401 and "<!doctype" not in cuerpo.lower(),
          f"{codigo} {cuerpo[:80]}")

    estado_codigo, estado_body = call("GET", "/afip/estado?cuit=" + CUIT)
    check("GET /afip/estado", estado_codigo == 200 and "puede_facturar" in estado_body,
          f"{estado_codigo} {estado_body[:180]}")

    perfil_codigo, perfil_body = call("GET", "/afip/perfil?cuit=" + CUIT)
    check("GET /afip/perfil", perfil_codigo == 200, f"{perfil_codigo} {perfil_body[:120]}")

    invalido_codigo, invalido_body = call("POST", "/afip/perfil", {"cuit": "123"})
    check("POST /afip/perfil inválido -> 422", invalido_codigo == 422,
          f"{invalido_codigo} {invalido_body[:120]}")

    # El resultado correcto DEPENDE de si el tenant vinculó ARCA, así que el smoke tiene que saber
    # cuál espera. Antes daba por bueno cualquier 200 y por eso reportó "converge a borrador en <1s"
    # sobre un tenant sin certificado: estaba leyendo el estado ANTES de que el workflow cargara el
    # contexto y saliendo del bucle en la primera vuelta. Un smoke que no sabe qué esperar no verifica
    # nada — confirma.
    tiene_credencial = bool(json.loads(estado_body).get("conectado"))
    crear_codigo, crear_body = call("POST", "/afip/facturas", {"cuit": CUIT})
    creada = crear_codigo == 200 and "factura_id" in crear_body

    if tiene_credencial:
        check("POST /afip/facturas (arranca el workflow)", creada, f"{crear_codigo} {crear_body[:180]}")
    else:
        check("POST /afip/facturas sin certificado -> 409 (no abre workflow condenado)",
              crear_codigo == 409 and "sin_certificado_afip" in crear_body,
              f"{crear_codigo} {crear_body[:180]}")

    if creada:
        factura_id = json.loads(crear_body)["factura_id"]
        # El primer estado puede reportar `perfil_ausente` mientras el workflow carga el contexto:
        # es convergencia, no error. La app tiene que hacer lo mismo (ver el handoff a frontend §3.1).
        estado = None
        for _ in range(12):
            codigo, cuerpo = call("GET", f"/afip/facturas/{factura_id}")
            if codigo == 200:
                estado = json.loads(cuerpo)
                if "perfil_ausente" not in [f.get("codigo") for f in estado.get("faltantes", [])]:
                    break
            time.sleep(1)
        codigos = [f.get("codigo") for f in (estado or {}).get("faltantes", [])]
        check("GET /afip/facturas/{id} (query del workflow)", estado is not None,
              f"estado={estado.get('estado') if estado else None} faltantes={codigos}")

        cancel_codigo, cancel_body = call("POST", f"/afip/facturas/{factura_id}/cancelar")
        check("POST cancelar (limpieza)", cancel_codigo == 200, f"{cancel_codigo} {cancel_body[:80]}")

    comp_codigo, comp_body = call("GET", "/afip/comprobantes?cuit=" + CUIT)
    check("GET /afip/comprobantes", comp_codigo == 200 and "comprobantes" in comp_body,
          f"{comp_codigo} {comp_body[:180]}")

    print("\nSMOKE HTTP AFIP: " + ("VERDE" if not fallas else f"ROJO -> {fallas}"))
    return 0 if not fallas else 1


if __name__ == "__main__":
    sys.exit(main())
