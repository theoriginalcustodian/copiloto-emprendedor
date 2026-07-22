"""Deja un tenant listo para probar facturación desde la app: usuario + certificado de HOMOLOGACIÓN.

Existe porque para probar la emisión desde el teléfono hace falta un tenant con certificado AFIP, y el
alta necesita la clave fiscal. Este script la usa UNA vez, del lado del VPS, y no la deja en ningún
lado: ni en la base, ni en el event history, ni en su salida.

**Sólo homologación.** El certificado que genera no tiene efecto fiscal: se puede facturar todo lo que
haga falta sin emitir un comprobante real. `--ambiente prod` está deliberadamente ausente.

Corre EN EL VPS:
    /opt/uc-copiloto-venv/bin/python deploy/copiloto/setup_tenant_pruebas.py

IDEMPOTENTE: si el usuario ya existe lo reusa, y si ya tiene certificado no vuelve a pedir el alta.
La password se genera una sola vez y queda en `/root/.secrets/` con permisos 600 — nunca en el repo,
nunca impresa entera.
"""
from __future__ import annotations

import json
import os
import secrets
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

BASE = os.environ.get("COPILOTO_SMOKE_BASE", "http://127.0.0.1:8099")
UNIT = "uc-copiloto-web.service"
EMAIL = os.environ.get("COPILOTO_TENANT_PRUEBAS_EMAIL", "pruebas-facturacion@copiloto.test")
ARCHIVO_CLAVE_FISCAL = Path(os.environ.get("AFIP_CLAVE_FILE", "/root/.secrets/afip-david.txt"))
ARCHIVO_PASSWORD = Path("/root/.secrets/tenant-pruebas-facturacion.txt")
AMBIENTE = "dev"   # homologación. No parametrizable a propósito.

# Perfil fiscal real del operador (monotributo cat. A, punto de venta 6). No es secreto: figura en
# cualquier factura que emita. La clave fiscal, que sí lo es, no vive acá.
PERFIL = {
    "razon_social": "HUCK DAVID",
    "domicilio_comercial": "Leandro N. Alem 1101 P5 D B - Rosario, Santa Fe",
    "condicion_iva": "monotributo",
    "ingresos_brutos": "Régimen Simplificado",
    "inicio_actividades": "2020-06-01",
    "punto_venta": 6,
}


def _heredar_env_del_proceso(unit: str) -> None:
    pid = subprocess.check_output(
        ["systemctl", "show", unit, "-p", "MainPID", "--value"]).decode().strip()
    if not pid or pid == "0":
        sys.exit(f"{unit} no está corriendo")
    with open(f"/proc/{pid}/environ", "rb") as fh:
        for entrada in fh.read().split(b"\x00"):
            if b"=" in entrada:
                clave, valor = entrada.decode("utf-8", "replace").split("=", 1)
                os.environ.setdefault(clave, valor)


_heredar_env_del_proceso(UNIT)

import jwt  # noqa: E402
import psycopg2  # noqa: E402

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "apps" / "copiloto"))
from onboarding import GoTrueAdmin, signup_and_provision  # noqa: E402


def _leer_credenciales_afip() -> tuple[str, str]:
    """`Usuario:` y `Clave:` del archivo del VPS. Se devuelven para usarlas UNA vez."""
    if not ARCHIVO_CLAVE_FISCAL.exists():
        sys.exit(f"falta {ARCHIVO_CLAVE_FISCAL}")
    datos = {}
    for linea in ARCHIVO_CLAVE_FISCAL.read_text(encoding="utf-8", errors="replace").splitlines():
        if ":" in linea:
            k, v = linea.split(":", 1)
            datos[k.strip().lower()] = v.strip()
    usuario, clave = datos.get("usuario"), datos.get("clave")
    if not (usuario and clave):
        sys.exit("el archivo no tiene 'Usuario:' y 'Clave:'")
    return usuario, clave


def _password_estable() -> str:
    """Una sola vez. Si ya existe se reusa — así el tenant no cambia de password en cada corrida."""
    if ARCHIVO_PASSWORD.exists():
        return ARCHIVO_PASSWORD.read_text(encoding="utf-8").strip()
    pwd = secrets.token_urlsafe(18)
    ARCHIVO_PASSWORD.write_text(pwd + "\n", encoding="utf-8")
    ARCHIVO_PASSWORD.chmod(0o600)
    return pwd


def _conn():
    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    conn.autocommit = True
    return conn


def _token(auth_user_id: str) -> str:
    claims = {"sub": str(auth_user_id), "exp": int(time.time()) + 1800,
              "aud": "authenticated", "role": "authenticated"}
    issuer = os.environ.get("COPILOTO_JWT_ISSUER")
    if issuer:
        claims["iss"] = issuer
    return jwt.encode(claims, os.environ["SUPABASE_JWT_SECRET"], algorithm="HS256")


def call(token: str, metodo: str, path: str, body: dict | None = None) -> tuple[int, str]:
    req = urllib.request.Request(
        BASE + path, method=metodo,
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        data=json.dumps(body).encode() if body is not None else None)
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return r.status, r.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()


def main() -> int:
    cuit, clave_fiscal = _leer_credenciales_afip()
    password = _password_estable()

    print(f"1) tenant '{EMAIL}' en GoTrue…")
    gotrue = GoTrueAdmin.from_env()
    tenant = signup_and_provision(email=EMAIL, password=password, gotrue=gotrue,
                                  conn_factory=_conn)
    print(f"   cliente_id={tenant['cliente_id']}  auth_user_id={tenant['auth_user_id']}")
    token = _token(tenant["auth_user_id"])

    print(f"2) perfil fiscal (CUIT {cuit}, punto de venta {PERFIL['punto_venta']})…")
    codigo, cuerpo = call(token, "POST", "/afip/perfil", {"cuit": cuit, **PERFIL})
    if codigo != 200:
        print(f"   FALLA {codigo}: {cuerpo[:300]}")
        return 1
    print("   OK")

    codigo, cuerpo = call(token, "GET", f"/afip/estado?cuit={cuit}")
    estado = json.loads(cuerpo)
    if AMBIENTE in (estado.get("ambientes_vinculados") or []):
        print(f"3) ya tiene certificado de {AMBIENTE} — no se repite el alta (idempotente)")
    else:
        print(f"3) alta ante ARCA en homologación (el RPA de AfipSDK tarda minutos)…")
        # La clave fiscal viaja por el MISMO endpoint que usará la app: se ejercita el camino real,
        # incluido el claim-check. No se guarda en ningún lado.
        codigo, cuerpo = call(token, "POST", "/afip/conectar",
                              {"cuit": cuit, "usuario": cuit, "clave_fiscal": clave_fiscal,
                               "ambiente": AMBIENTE})
        del clave_fiscal
        if codigo != 200:
            print(f"   FALLA {codigo}: {cuerpo[:300]}")
            return 1
        print(f"   alta arrancada: {json.loads(cuerpo).get('workflow_id')}")

        for intento in range(60):   # hasta ~10 min
            time.sleep(10)
            codigo, cuerpo = call(token, "GET", f"/afip/estado?cuit={cuit}")
            estado = json.loads(cuerpo)
            onb = estado.get("onboarding") or {}
            print(f"   [{intento * 10:>3}s] paso={onb.get('paso')} conectado={estado.get('conectado')}")
            if onb.get("terminado"):
                if not onb.get("ok"):
                    print(f"   ALTA FALLIDA: {onb.get('motivo')}")
                    return 1
                break
        else:
            print("   TIMEOUT esperando el alta")
            return 1

    codigo, cuerpo = call(token, "GET", f"/afip/estado?cuit={cuit}")
    estado = json.loads(cuerpo)
    print("\n=== estado final ===")
    print(f"  cuit={estado.get('cuit')}  ambiente={estado.get('ambiente')}  "
          f"vinculados={estado.get('ambientes_vinculados')}")
    print(f"  puede_facturar={estado.get('puede_facturar')}")

    if not estado.get("puede_facturar"):
        print("\nROJO: el tenant NO puede facturar todavía.")
        return 1

    print(f"""
=== LISTO — credenciales para probar desde la app ===
  email:    {EMAIL}
  password: (en {ARCHIVO_PASSWORD}, permisos 600 — NO va al repo)
  CUIT:     {cuit}
  ambiente: homologación (sin efecto fiscal)
""")
    return 0


if __name__ == "__main__":
    sys.exit(main())
