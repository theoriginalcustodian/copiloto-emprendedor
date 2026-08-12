#!/usr/bin/env python3
"""e2e §G6 item 1 (backend) -- aislamiento multi-tenant ADVERSARIAL EN VIVO contra prod real.

No es el test unitario `apps/copiloto/tests/test_adversarial_multitenant.py` (ese corre contra
Postgres real pero vía TestClient/DB directa, con tenants sintéticos uuid4 efímeros). Este script
ejercita el camino HOSTIL de punta a punta por HTTP contra el backend REAL desplegado
(`https://copilotoemprendedor.duckdns.org`), el mismo dominio que sirve al usuario real -- prueba
que el pool de conexiones reusadas de C4 (`conn_pool.py`, PR #415) no reintrodujo el incidente de
prod del 2026-07-31 (query sin contexto de tenant devolvió filas de 3 tenants).

Ataque: un segundo tenant (recién provisionado, sin relación con el canónico) intenta leer, vía
`GET /reply?session_id=<ID_DEL_CANONICO>`, la conversación real del usuario de prueba canónico
(`e2e-device@copiloto.test`, memoria/usuario-de-prueba-canonico-uno-solo-a-fuego.md) -- adivinando/
conociendo su session_id exacto. `session_id` es un string libre del cliente (`web.py::reply`, sin
validación de pertenencia a nivel de ruta); la barrera REAL depende enteramente de que
`read_replies_fn(cliente_id, session_id, after_id)` filtre por el `cliente_id` que sale del token
del atacante, no del `session_id` que aporta. Se assert DENEGACIÓN (`replies: []`), nunca solo el
happy-path de "cada quien ve lo suyo".

Uso:
    python scripts/e2e_g6_adversarial_multitenant.py
"""
from __future__ import annotations

import os
import sys
import time
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

# Tenant B: adversario desechable, provisionado por el propio /auth/signup (idempotente por email
# -- correr el script 2 veces no duplica ni rompe). Nombrado a-fuego para que se vea que es un
# artefacto de test, igual que los demás tenants e2e-* existentes.
ADVERSARY_EMAIL = "e2e-adversary-g6@copiloto.test"
ADVERSARY_PASSWORD = "AdversaryG6-" + uuid.uuid4().hex[:16]


def log(msg: str) -> None:
    print(f"[e2e-g6-adversarial] {msg}")


def _leer_env_e2e() -> dict[str, str]:
    out: dict[str, str] = {}
    for linea in ENV_E2E.read_text(encoding="utf-8").splitlines():
        linea = linea.strip()
        if not linea or linea.startswith("#") or "=" not in linea:
            continue
        k, _, v = linea.partition("=")
        out[k.strip()] = v.strip()
    return out


def login_canonico() -> tuple[str, str]:
    env = _leer_env_e2e()
    usuario, clave = env["E2E_DEVICE_EMAIL"], env["E2E_DEVICE_PASSWORD"]
    r = requests.post(f"{BASE}/auth/login", json={"email": usuario, "password": clave}, timeout=15)
    r.raise_for_status()
    return r.json()["access_token"], env["E2E_DEVICE_CLIENTE_ID"]


def provisionar_y_loguear_adversario() -> tuple[str, str]:
    # C4.1 (PR merged post-lote-B): /auth/signup exige invite_token (FAIL-CLOSED, COPILOTO_INVITE_TOKEN
    # en el VPS). Se pasa por env var -- nunca hardcodeado ni impreso.
    invite_token = os.environ.get("COPILOTO_INVITE_TOKEN", "")
    if not invite_token:
        raise RuntimeError("falta COPILOTO_INVITE_TOKEN en el entorno del script")
    r = requests.post(f"{BASE}/auth/signup",
                       json={"email": ADVERSARY_EMAIL, "password": ADVERSARY_PASSWORD,
                             "invite_token": invite_token}, timeout=20)
    if r.status_code == 200:
        log(f"tenant adversario provisionado: cliente_id={r.json()['cliente_id']}")
    else:
        log(f"signup devolvió {r.status_code} (tenant ya existía de una corrida previa, se sigue con login) "
            f"body={r.text[:200]}")
    r = requests.post(f"{BASE}/auth/login", json={"email": ADVERSARY_EMAIL, "password": ADVERSARY_PASSWORD},
                       timeout=15)
    r.raise_for_status()
    token = r.json()["access_token"]
    me = requests.get(f"{BASE}/me", headers={"Authorization": f"Bearer {token}"}, timeout=15)
    me.raise_for_status()
    return token, me.json()["cliente_id"]


def enviar(token: str, session_id: str, texto: str) -> None:
    r = requests.post(f"{BASE}/chat", json={"session_id": session_id, "text": texto, "kind": "text"},
                       headers={"Authorization": f"Bearer {token}"}, timeout=15)
    r.raise_for_status()
    assert r.json()["accepted"], f"el backend no aceptó el mensaje: {r.json()}"


def esperar_reply(token: str, session_id: str, after_id: int = 0, *, segundos: float = 60) -> list[dict]:
    limite = time.monotonic() + segundos
    while time.monotonic() < limite:
        r = requests.get(f"{BASE}/reply", params={"session_id": session_id, "after_id": after_id},
                          headers={"Authorization": f"Bearer {token}"}, timeout=15)
        r.raise_for_status()
        data = r.json()
        if data["replies"]:
            return data["replies"]
        time.sleep(2)
    raise TimeoutError(f"sin reply de {session_id} en {segundos}s")


def main() -> int:
    log(f"BASE={BASE}")

    log("1) login canónico (e2e-device@copiloto.test)")
    token_a, cliente_id_a = login_canonico()
    log(f"   cliente_id_A={cliente_id_a}")

    session_id_a = f"e2e-g6-adversarial-{uuid.uuid4()}"
    texto_secreto = f"SECRETO-DEL-CANONICO-{uuid.uuid4().hex[:8]}"
    log(f"2) A envía un mensaje real (session_id_a={session_id_a}) con marcador único para detectar fuga")
    enviar(token_a, session_id_a, texto_secreto)
    replies_a = esperar_reply(token_a, session_id_a, segundos=90)
    log(f"   A recibió su propia reply OK ({len(replies_a)} fila(s)) -- control positivo: el flujo real funciona")

    log("3) provisiono/logueo tenant B (adversario), vía /auth/signup real -- SIN relación con A")
    token_b, cliente_id_b = provisionar_y_loguear_adversario()
    log(f"   cliente_id_B={cliente_id_b}")
    assert cliente_id_b != cliente_id_a, "BUG DE PROVISIONING: el adversario resolvió el mismo cliente_id que A"

    log("4) ATAQUE: B pide GET /reply con el session_id EXACTO de A, usando SU PROPIO token")
    r_attack = requests.get(f"{BASE}/reply", params={"session_id": session_id_a, "after_id": 0},
                             headers={"Authorization": f"Bearer {token_b}"}, timeout=15)
    r_attack.raise_for_status()
    attack_body = r_attack.json()
    log(f"   status={r_attack.status_code} body={attack_body}")

    fuga = any(texto_secreto in str(row) for row in attack_body.get("replies", []))
    if attack_body.get("replies"):
        print("\n=== RESULTADO: ROJO -- FUGA CROSS-TENANT CONFIRMADA ===")
        print(f"B vio {len(attack_body['replies'])} fila(s) de la conversación de A. Marcador presente: {fuga}")
        return 1
    log("   OK -- B recibió `replies: []`: no ve nada de la conversación de A")

    log("5) control: B en SU PROPIA sesión nueva, para confirmar que B sigue operativo (no es un 403 global)")
    session_id_b = f"e2e-g6-adversarial-B-propia-{uuid.uuid4()}"
    enviar(token_b, session_id_b, "hola, esto es B en su propia sesión")
    replies_b = esperar_reply(token_b, session_id_b, segundos=90)
    log(f"   B recibió su propia reply OK ({len(replies_b)} fila(s)) -- B no está roto, sólo aislado")

    print("\n=== RESULTADO: VERDE -- AISLAMIENTO CONFIRMADO EN VIVO CONTRA PROD ===")
    print(f"cliente_id_A={cliente_id_a}  cliente_id_B={cliente_id_b}")
    print(f"session_id_a (atacado)={session_id_a}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
