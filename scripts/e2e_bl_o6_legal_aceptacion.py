#!/usr/bin/env python3
"""E2E de BL-O6 Parte B -- aceptación legal contra prod real (HTTP end-to-end, no unit test).

Pedido por planificación (2026-09-23, pedido_..._E2E-del-alta-con-aceptacion-cierra-BL-O6): backend
ya desplegó `POST /me/legal/aceptar` (`apps/copiloto/web.py:1058-1082`) y el bundle web ya lo llama
(`SignupScreen.tsx`, PR #678/#679, `main@5aed9442`). Este script ejercita el camino REAL por HTTP
contra `https://copilotoemprendedor.duckdns.org`, con el usuario canónico
(`e2e-device@copiloto.test`, memoria/usuario-de-prueba-canonico-uno-solo-a-fuego.md) y un tenant
adversario desechable -- mismo molde que `e2e_g6_adversarial_multitenant.py`.

Casos (los 3 que pidió el `pedido_`, más el happy-path que los ancla):
  1. Happy-path: aceptar la versión vigente -> 200 {"aceptado": true, "version", "en"}, y `GET /me`
     pasa a `legal_aceptado: true`. Sin esto los casos hostiles no prueban nada real.
  2. HOSTIL -- sin token: `POST /me/legal/aceptar` sin `Authorization` -> 401 (require_tenant).
  3. HOSTIL -- versión vencida: `POST /me/legal/aceptar {"version": "<vieja>"}` -> 409 con
     `detail.codigo == "legal_version_desactualizada"` y `detail.vigente == "2026-09-22"` (el shape
     que se arregló en `096d8d08`, `ApiError.extra`).
  4. HOSTIL -- cross-tenant: un tenant adversario, recién provisionado y SIN relación con el
     canónico, nunca ve la aceptación del canónico como propia -- su `GET /me` sigue en
     `legal_aceptado: false` después de que el canónico aceptó. `cliente_id` sale sólo de
     `require_tenant` (nunca de un valor que mande el cliente), así que no hay endpoint que permita
     "leer la aceptación de otro" -- el control es que CADA tenant ve SU PROPIO estado, nunca el ajeno.

Uso (necesita `COPILOTO_INVITE_TOKEN` en el entorno para provisionar al adversario -- en el VPS,
NUNCA hardcodeado ni impreso):
    export COPILOTO_INVITE_TOKEN="$(ssh unreal-copilot "grep '^COPILOTO_INVITE_TOKEN=' /etc/unreal-copilot/copiloto.env" | cut -d= -f2-)"
    python scripts/e2e_bl_o6_legal_aceptacion.py
"""
from __future__ import annotations

import os
import sys
import uuid
from pathlib import Path

import requests

for _flujo in (sys.stdout, sys.stderr):
    try:
        _flujo.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[union-attr]
    except (AttributeError, ValueError):
        pass

BASE = "https://copilotoemprendedor.duckdns.org"
RAIZ = Path(__file__).resolve().parent.parent
ENV_E2E = RAIZ / ".env.e2e"

LEGAL_VERSION_VIGENTE = "2026-09-22"  # apps/copiloto/tenant_legal_store.py -- convención, no import cruzado
VERSION_VENCIDA = "2020-01-01"

# Email ÚNICO por corrida (no estático): `/auth/signup` es idempotente sobre el TENANT (mismo email
# -> mismo cliente_id) pero NO resetea el password de un usuario GoTrue ya existente -- correcto y
# deseado (mismo criterio que `restaurar-contrasena-e2e.py`), pero rompe un adversario reusable con
# password nueva en cada corrida. Un sufijo uuid garantiza usuario-y-password nacen juntos siempre.
ADVERSARY_EMAIL = f"e2e-adversary-bl-o6-{uuid.uuid4().hex[:12]}@copiloto.test"
ADVERSARY_PASSWORD = "testpass-" + uuid.uuid4().hex[:24]  # descartable; nunca un secreto real


def log(msg: str) -> None:
    print(f"[e2e-bl-o6-legal] {msg}")


def _leer_env_e2e() -> dict[str, str]:
    out: dict[str, str] = {}
    for linea in ENV_E2E.read_text(encoding="utf-8").splitlines():
        linea = linea.strip()
        if not linea or linea.startswith("#") or "=" not in linea:
            continue
        k, _, v = linea.partition("=")
        out[k.strip()] = v.strip()
    return out


def login_canonico() -> str:
    env = _leer_env_e2e()
    r = requests.post(f"{BASE}/auth/login",
                       json={"email": env["E2E_DEVICE_EMAIL"], "password": env["E2E_DEVICE_PASSWORD"]},
                       timeout=15)
    r.raise_for_status()
    return r.json()["access_token"]


def provisionar_y_loguear_adversario() -> str:
    invite_token = os.environ.get("COPILOTO_INVITE_TOKEN", "")
    if not invite_token:
        raise RuntimeError("falta COPILOTO_INVITE_TOKEN en el entorno del script")
    r = requests.post(f"{BASE}/auth/signup",
                       json={"email": ADVERSARY_EMAIL, "password": ADVERSARY_PASSWORD,
                             "invite_token": invite_token}, timeout=20)
    if r.status_code == 200:
        log(f"tenant adversario provisionado: cliente_id={r.json()['cliente_id']}")
    else:
        log(f"signup devolvió {r.status_code} (tenant ya existía de una corrida previa, se sigue con login)")
    r = requests.post(f"{BASE}/auth/login", json={"email": ADVERSARY_EMAIL, "password": ADVERSARY_PASSWORD},
                       timeout=15)
    r.raise_for_status()
    return r.json()["access_token"]


def get_me(token: str) -> dict:
    r = requests.get(f"{BASE}/me", headers={"Authorization": f"Bearer {token}"}, timeout=15)
    r.raise_for_status()
    return r.json()


def post_aceptar(token: str | None, version: str) -> requests.Response:
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    return requests.post(f"{BASE}/me/legal/aceptar", json={"version": version}, headers=headers, timeout=15)


def main() -> int:
    log(f"BASE={BASE}  LEGAL_VERSION_VIGENTE={LEGAL_VERSION_VIGENTE}")
    fallas: list[str] = []

    log("1) login canónico (e2e-device@copiloto.test)")
    token = login_canonico()

    log("2) HOSTIL -- POST /me/legal/aceptar SIN token")
    r_sin_token = post_aceptar(None, LEGAL_VERSION_VIGENTE)
    log(f"   status={r_sin_token.status_code}")
    if r_sin_token.status_code != 401:
        fallas.append(f"sin-token: esperaba 401, dio {r_sin_token.status_code}")

    log("3) HOSTIL -- POST /me/legal/aceptar con versión VENCIDA")
    r_vencida = post_aceptar(token, VERSION_VENCIDA)
    log(f"   status={r_vencida.status_code} body={r_vencida.text[:300]}")
    if r_vencida.status_code != 409:
        fallas.append(f"version-vencida: esperaba 409, dio {r_vencida.status_code}")
    else:
        detail = r_vencida.json().get("detail", {})
        if not isinstance(detail, dict) or detail.get("codigo") != "version_desactualizada":
            fallas.append(f"version-vencida: detail.codigo inesperado: {detail}")
        if detail.get("vigente") != LEGAL_VERSION_VIGENTE:
            fallas.append(f"version-vencida: detail.vigente inesperado: {detail}")

    log("4) HAPPY-PATH -- POST /me/legal/aceptar con la versión VIGENTE (canónico)")
    r_ok = post_aceptar(token, LEGAL_VERSION_VIGENTE)
    log(f"   status={r_ok.status_code} body={r_ok.text[:300]}")
    if r_ok.status_code != 200 or not r_ok.json().get("aceptado"):
        fallas.append(f"happy-path: esperaba 200 aceptado=true, dio {r_ok.status_code} {r_ok.text[:200]}")

    log("5) confirmo con GET /me (canónico) -> legal_aceptado debe ser true")
    me_canonico = get_me(token)
    log(f"   legal_aceptado={me_canonico.get('legal_aceptado')}")
    if me_canonico.get("legal_aceptado") is not True:
        fallas.append(f"GET /me canónico: legal_aceptado esperaba true, dio {me_canonico.get('legal_aceptado')}")

    log("6) HOSTIL -- provisiono/logueo tenant B (adversario), SIN relación con el canónico")
    token_b = provisionar_y_loguear_adversario()
    me_adversario = get_me(token_b)
    log(f"   B: legal_aceptado={me_adversario.get('legal_aceptado')} (debe ser false: aceptación de A no es de B)")
    if me_adversario.get("legal_aceptado") is not False:
        fallas.append(f"cross-tenant: B debería ver legal_aceptado=false, dio {me_adversario.get('legal_aceptado')}")

    if fallas:
        print("\n=== RESULTADO: ROJO ===")
        for f in fallas:
            print(f" - {f}")
        return 1

    print("\n=== RESULTADO: VERDE -- BL-O6 E2E completo contra prod ===")
    print(f"sin-token -> {r_sin_token.status_code} | version-vencida -> {r_vencida.status_code} "
          f"detail={r_vencida.json().get('detail')} | happy-path -> {r_ok.status_code} {r_ok.json()} | "
          f"GET /me canónico -> legal_aceptado={me_canonico.get('legal_aceptado')} | "
          f"GET /me adversario -> legal_aceptado={me_adversario.get('legal_aceptado')}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
