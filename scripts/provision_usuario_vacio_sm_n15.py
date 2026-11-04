#!/usr/bin/env python3
"""SM-N15 — provisiona y VERIFICA el segundo usuario de prueba: no-admin y tenant VACÍO.

Nació SOLO para `SM-K1` (menos privilegios) y `SM-J3` (menos datos), y declaraba que cualquier otro
uso era MAYOR y volvía al operador. **AMPLIADO 2026-11-03 por orden del operador** (*«autorizo la
tenencia de prueba»*): este usuario es la **tenencia de prueba autorizada para TODA ficha que
necesite un segundo emprendedor** — hoy `SM-J3 J4 K3 K5 K6 N16 N29 N30`, y las que vengan con el
mismo disparador. No hace falta volver a preguntar por cada una.

Lo que la ampliación NO cambia: **el usuario CANÓNICO sigue siendo `e2e-device@copiloto.test`**.
Éste es el *segundo* tenant, el vacío y no-admin; cambiar el canónico sigue siendo MAYOR. La
distinción importa porque la orden autoriza *tener* un segundo tenant, no *mudar* el primero.

Idempotente: la primera corrida da el alta por `/auth/signup` (abierto, SM-C2) y escribe la credencial en
`.env.e2e` (gitignored; el repo es PÚBLICO: la password NUNCA va a un archivo trackeado, a la memoria ni a
la salida). Las siguientes sólo reloguean y re-verifican.

Verificación ADVERSARIAL contra el backend REAL (sale con exit 1 al primer control que falle):
  1. rol no-admin: `/me` dice es_admin=False y el intento de acción de admin (`/admin/*`) devuelve 403
     (con control: sin token es 401 — distingue «guard presente» de «ruta inexistente»).
  2. tenant vacío CON control positivo: el nuevo da 0 en clientes/comprobantes/gastos/presupuestos y el
     canónico da >0 en al menos uno — si los dos dieran 0 el instrumento miraría mal, no el tenant.
  3. cross-tenant: el nuevo pide un comprobante y una conversación del canónico y NO los obtiene.

Uso:  UC_ENV_E2E=<ruta a .env.e2e> python scripts/provision_usuario_vacio_sm_n15.py

TERCER TENANT (SM-L4 entrada 20, autorizado por el operador 2026-11-04; acotado a esa entrada):
  python scripts/provision_usuario_vacio_sm_n15.py --email e2e-onb@copiloto.test --prefijo ONB
  (1) provisiona VACÍO · (2) se siembra con deploy/copiloto/seed-midia-e2e.py --email ... --ejecutar ·
  (3) se re-corre con --sembrado: el control 2 pasa a exigir que HAYA comprobantes (por API, sin abrir la app).
Sin banderas hace EXACTAMENTE lo de siempre. El email sólo se acepta si es `@copiloto.test`: nunca una
cuenta real. La credencial va a E2E_<PREFIJO>_* en .env.e2e, jamás a la salida.
"""
from __future__ import annotations

import argparse
import os
import secrets
import sys
import uuid
from pathlib import Path

import requests

for _f in (sys.stdout, sys.stderr):
    try:
        _f.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[union-attr]
    except (AttributeError, ValueError):
        pass

BASE = os.environ.get("UC_BASE", "https://copilotoemprendedor.duckdns.org")
RAIZ = Path(__file__).resolve().parent.parent
ENV_E2E = Path(os.environ.get("UC_ENV_E2E", RAIZ / ".env.e2e"))
EMAIL_DEFECTO = "e2e-vacio@copiloto.test"   # default a fuego: sin --email nadie elige otro
DOMINIO_SINTETICO = "@copiloto.test"
EMAIL = EMAIL_DEFECTO                       # se fija en main() desde --email
PREFIJO = "VACIO"                           # claves E2E_<PREFIJO>_* en .env.e2e
LISTADOS = {"clientes": "/clientes", "comprobantes": "/afip/comprobantes", "gastos": "/gastos",
            "presupuestos": "/presupuestos"}
RUTAS_ADMIN = ("/admin/salud", "/admin/uso", "/admin/tenants")


def log(m: str) -> None:
    print(f"[sm-n15] {m}")


def fallo(m: str) -> None:
    print(f"[sm-n15] ❌ {m}")
    sys.exit(1)


def leer_env() -> dict[str, str]:
    out: dict[str, str] = {}
    for linea in ENV_E2E.read_text(encoding="utf-8").splitlines():
        linea = linea.strip()
        if linea and not linea.startswith("#") and "=" in linea:
            k, _, v = linea.partition("=")
            out[k.strip()] = v.strip()
    return out


def login(email: str, password: str) -> str:
    r = requests.post(f"{BASE}/auth/login", json={"email": email, "password": password}, timeout=20)
    r.raise_for_status()
    return r.json()["access_token"]


def get(token: str, ruta: str, **params) -> requests.Response:
    return requests.get(f"{BASE}{ruta}", params=params or None, timeout=20,
                        headers={"Authorization": f"Bearer {token}"} if token else {})


def cantidad(token: str, ruta: str, **params) -> int:
    r = get(token, ruta, **params)
    if r.status_code != 200:
        fallo(f"{ruta} devolvió {r.status_code} — no se puede contar (el control no corrió)")
    j = r.json()
    for v in (j if isinstance(j, list) else j.values()):
        if isinstance(v, list):
            return len(v)
    return len(j) if isinstance(j, list) else 0


def asegurar_credencial() -> tuple[str, str]:
    """(password, cliente_id). Alta sólo si .env.e2e no la tiene; la password nunca se imprime."""
    env = leer_env()
    if env.get(f"E2E_{PREFIJO}_PASSWORD"):
        return env[f"E2E_{PREFIJO}_PASSWORD"], env.get(f"E2E_{PREFIJO}_CLIENTE_ID", "")
    password = "Vacio-" + secrets.token_hex(12)
    r = requests.post(f"{BASE}/auth/signup", json={"email": EMAIL, "password": password}, timeout=25)
    if r.status_code != 200:
        fallo(f"signup devolvió {r.status_code}: {r.text[:160]} (si el email ya existe sin credencial en "
              f".env.e2e, hay que resolverlo a mano: NO se pisa una cuenta ajena)")
    cliente_id = r.json()["cliente_id"]
    with ENV_E2E.open("a", encoding="utf-8") as f:
        f.write(f"\n# SM-N15 — usuario de prueba sintético {EMAIL} (no-admin; tenant vacío al provisionar)\n"
                f"E2E_{PREFIJO}_EMAIL={EMAIL}\nE2E_{PREFIJO}_PASSWORD={password}\nE2E_{PREFIJO}_CLIENTE_ID={cliente_id}\n")
    log(f"alta hecha: cliente_id={cliente_id} — credencial escrita en {ENV_E2E.name} (no se imprime)")
    return password, cliente_id


def main() -> int:
    global EMAIL, PREFIJO
    ap = argparse.ArgumentParser()
    ap.add_argument("--email", default=EMAIL_DEFECTO)
    ap.add_argument("--prefijo", default="VACIO")
    ap.add_argument("--sembrado", action="store_true",
                    help="el tenant YA fue sembrado: el control 2 exige comprobantes en vez de cero")
    a = ap.parse_args()
    if not a.email.endswith(DOMINIO_SINTETICO):
        fallo(f"--email debe terminar en {DOMINIO_SINTETICO}: esto jamás se corre contra una cuenta real")
    if a.email != EMAIL_DEFECTO and a.prefijo == "VACIO":
        fallo("con un --email distinto del default hay que dar --prefijo propio: no se pisa la credencial del vacío")
    if a.sembrado and a.email == EMAIL_DEFECTO:
        fallo("--sembrado sólo aplica a un tenant sintético NUEVO; el vacío por defecto debe seguir vacío")
    EMAIL, PREFIJO = a.email, a.prefijo.upper()
    env = leer_env()
    tok_canon = login(env["E2E_DEVICE_EMAIL"], env["E2E_DEVICE_PASSWORD"])
    password, _ = asegurar_credencial()
    tok = login(EMAIL, password)
    me = get(tok, "/me").json()
    canon_me = get(tok_canon, "/me").json()
    log(f"nuevo cliente_id={me['cliente_id']} · canónico={canon_me['cliente_id']}")
    if me["cliente_id"] == canon_me["cliente_id"]:
        fallo("el usuario nuevo resolvió el MISMO tenant que el canónico")

    log("1) rol no-admin (adversarial)")
    if me.get("es_admin") is not False:
        fallo(f"/me.es_admin = {me.get('es_admin')!r}, esperado False")
    for ruta in RUTAS_ADMIN:
        sin = get("", ruta).status_code
        con = get(tok, ruta).status_code
        if sin != 401:
            fallo(f"CONTROL: {ruta} sin token dio {sin}, esperado 401 (¿la ruta existe y está guardada?)")
        if con != 403:
            fallo(f"{ruta} con token NO-admin dio {con}, esperado 403 — el control de admin NO deniega")
        log(f"   {ruta}: sin token {sin} · no-admin {con} ✔")

    log("2) tenant " + ("SEMBRADO (hay comprobantes)" if a.sembrado else "vacío") + " + control positivo del canónico")
    perfil = get(tok_canon, "/afip/estado")
    cuit = (perfil.json() or {}).get("cuit") if perfil.status_code == 200 else None  # sin param: resuelve el vinculado
    if not cuit:
        fallo(f"CONTROL: no pude leer el CUIT del canónico ({perfil.status_code}) — sin él no se cuentan comprobantes")
    # El nuevo pregunta por el CUIT DEL CANÓNICO: que dé 0 es además un ataque cross-tenant por parámetro.
    nuevo = {k: cantidad(tok, r, **({"cuit": cuit} if k == "comprobantes" else {})) for k, r in LISTADOS.items()}
    canon = {k: cantidad(tok_canon, r, **({"cuit": cuit} if k == "comprobantes" else {}))
             for k, r in LISTADOS.items()}
    log(f"   nuevo    = {nuevo}")
    log(f"   canónico = {canon}")
    if a.sembrado:
        # Los comprobantes del nuevo se cuentan con SU cuit (el vinculado), no con el del canónico.
        propio = get(tok, "/afip/estado")
        cuit_n = (propio.json() or {}).get("cuit") if propio.status_code == 200 else None
        if not cuit_n:
            fallo(f"el tenant sembrado no tiene CUIT vinculado ({propio.status_code}): la siembra no corrió")
        n = cantidad(tok, "/afip/comprobantes", cuit=cuit_n)
        log(f"   comprobantes del tenant nuevo (por API) = {n}")
        if n <= 0:
            fallo("el tenant sembrado no tiene comprobantes por API")
    elif any(nuevo.values()):
        fallo(f"el tenant nuevo NO está vacío: {nuevo}")
    if not any(canon.values()):
        fallo("CONTROL: el canónico también da todo en cero — el instrumento mira mal, no el tenant")

    log("3) aislamiento cross-tenant (el nuevo pide recursos del canónico)")
    comp = get(tok_canon, "/afip/comprobantes", cuit=cuit).json()
    comp = comp if isinstance(comp, list) else next((v for v in comp.values() if isinstance(v, list)), [])
    ids = [c["id"] for c in comp if isinstance(c, dict) and c.get("id") is not None]
    if not ids:
        fallo("CONTROL: el canónico no tiene comprobantes con id para atacar")
    propio = get(tok_canon, f"/afip/comprobantes/{ids[0]}").status_code
    ajeno = get(tok, f"/afip/comprobantes/{ids[0]}").status_code
    if propio != 200:
        fallo(f"CONTROL: el canónico no puede leer su propio comprobante ({propio})")
    if ajeno != 404:
        fallo(f"el nuevo leyó/rozó el comprobante {ids[0]} del canónico: {ajeno} (esperado 404)")
    log(f"   comprobante {ids[0]}: canónico {propio} · nuevo {ajeno} ✔")
    sid = f"sm-n15-{uuid.uuid4()}"
    r = get(tok, "/reply", session_id=sid, after_id=0)
    if r.status_code != 200 or r.json().get("replies"):
        fallo(f"/reply de una sesión ajena no vino vacío: {r.status_code} {r.text[:120]}")
    log("   /reply con session_id ajeno: vacío ✔")

    estado = "tenant sembrado (comprobantes >0)" if a.sembrado else "tenant vacío (0 vs canónico >0)"
    log(f"✅ SM-N15 verificado: no-admin (403), {estado}, cross-tenant denegado")
    return 0


if __name__ == "__main__":
    sys.exit(main())
