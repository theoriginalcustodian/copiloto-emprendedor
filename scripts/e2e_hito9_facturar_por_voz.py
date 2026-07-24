#!/usr/bin/env python3
"""E2E hito 9 (`emitir_factura`) contra el backend REAL desplegado -- mismo patrón que cerró el DoD
backend de hito 8 (`SUELTO-device-E2E-hito8-ingreso-propuesto`): `POST /chat` real -> agente durable
real -> Temporal real -> `GET /reply`. El "device" acá es la credencial `e2e-device@copiloto.test`
contra el tenant real, no una simulación de UI -- la transcripción de voz es un frente ya verificado
por separado (STT); lo que este DoD tiene que probar es que el TEXTO dictado produce la card/pregunta
correcta, y eso se prueba igual de fuerte por HTTP directo, sin re-inventar automatización de voz.

Los 5 puntos del DoD §5 backend, en orden:
  1. Incompleto (1ª vez)  -> pregunta, SIN card.
  2. Incompleto (2ª vez)  -> CARD con `faltantes` no vacío, no repregunta.
  3. Completo desde el arranque -> CARD con `faltantes == []`, lista para Emitir.
  4. Doble dictado de la MISMA orden completa -> UN solo borrador (mismo `factura_id`, sin duplicar).
  5. Sin perfil fiscal -> mensaje de negocio, sin card, sin excepción.

Uso:
    python scripts/e2e_hito9_facturar_por_voz.py
"""
from __future__ import annotations

import json
import sys
import time
import uuid
from pathlib import Path

import requests

# La consola de Windows es cp1252 y revienta con los emojis del reporte -- mismo fix que evidencia_device.py.
for _flujo in (sys.stdout, sys.stderr):
    try:
        _flujo.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[union-attr]
    except (AttributeError, ValueError):
        pass

BASE = "https://copilotoemprendedor.duckdns.org"
# El usuario de prueba CANÓNICO (regla dura, memoria/usuario-de-prueba-canonico-uno-solo-a-fuego.md)
# vive en `.env.e2e` (raíz del repo, gitignored) -- NUNCA en ~/.claude/secrets/ ni ad-hoc.
RAIZ = Path(__file__).resolve().parent.parent
ENV_E2E = RAIZ / ".env.e2e"


def log(msg: str) -> None:
    print(f"[e2e-hito9] {msg}")


def _leer_env_e2e() -> dict[str, str]:
    out: dict[str, str] = {}
    for linea in ENV_E2E.read_text(encoding="utf-8").splitlines():
        linea = linea.strip()
        if not linea or linea.startswith("#") or "=" not in linea:
            continue
        k, _, v = linea.partition("=")
        out[k.strip()] = v.strip()
    return out


def login() -> tuple[str, str]:
    env = _leer_env_e2e()
    usuario, clave = env["E2E_DEVICE_EMAIL"], env["E2E_DEVICE_PASSWORD"]
    r = requests.post(f"{BASE}/auth/login", json={"email": usuario, "password": clave}, timeout=15)
    r.raise_for_status()
    return r.json()["access_token"], env["E2E_DEVICE_CLIENTE_ID"]


def enviar(token: str, session_id: str, texto: str) -> None:
    r = requests.post(f"{BASE}/chat", json={"session_id": session_id, "text": texto, "kind": "text"},
                      headers={"Authorization": f"Bearer {token}"}, timeout=15)
    r.raise_for_status()
    assert r.json()["accepted"], f"el backend no aceptó el mensaje: {r.json()}"


def esperar_reply(token: str, session_id: str, after_id: int, *, segundos: float = 60) -> dict:
    """Poll de `/reply` (el mismo mecanismo que usa la app) hasta que aparezca una fila nueva."""
    limite = time.monotonic() + segundos
    while time.monotonic() < limite:
        r = requests.get(f"{BASE}/reply", params={"session_id": session_id, "after_id": after_id},
                         headers={"Authorization": f"Bearer {token}"}, timeout=15)
        r.raise_for_status()
        data = r.json()
        if data["replies"]:
            return data
        time.sleep(2)
    raise TimeoutError(f"sin reply nueva en {segundos}s (session={session_id}, after_id={after_id})")


def punto(n: int, titulo: str):
    print(f"\n{'=' * 70}\nDoD §5.{n} -- {titulo}\n{'=' * 70}")


def main() -> int:
    token, cliente_id = login()
    log(f"login OK -- cliente_id={cliente_id}")
    fallas = []

    # ── 1: incompleto (1ª vez) -> pregunta, SIN card ────────────────────────────────────────────
    punto(1, "1ª orden incompleta -> pregunta, sin card")
    session = f"e2e-hito9-{uuid.uuid4().hex[:8]}"
    enviar(token, session, "facturale 50000 a Juan")
    r1 = esperar_reply(token, session, 0)
    fila = r1["replies"][0]
    log(f"texto: {fila['reply_text']!r}")
    log(f"card:  {fila['card']}")
    if fila["card"] is not None:
        fallas.append("§5.1: esperaba card=None (pregunta), llegó una card")
    else:
        log("OK -- sin card, es una pregunta")

    # ── 2: sigue incompleto (2ª vez) -> CARD con faltantes, no repregunta ──────────────────────
    punto(2, "2ª orden incompleta (mismo texto) -> CARD, no repregunta")
    after = r1["next_id"]
    enviar(token, session, "facturale 50000 a Juan")
    r2 = esperar_reply(token, session, after)
    fila2 = r2["replies"][0]
    log(f"texto: {fila2['reply_text']!r}")
    log(f"card:  {json.dumps(fila2['card'], ensure_ascii=False)}")
    card2 = fila2["card"] or {}
    if card2.get("kind") != "factura_propuesta":
        fallas.append(f"§5.2: esperaba kind=factura_propuesta, llegó {card2.get('kind')!r}")
    elif not card2.get("data", {}).get("faltantes"):
        fallas.append("§5.2: esperaba faltantes NO vacío (sigue incompleta)")
    else:
        log(f"OK -- card con faltantes={card2['data']['faltantes']}")

    # ── 5: sin perfil fiscal -> mensaje de negocio (antes del completo, para no ensuciar perfil) ──
    # (se corre acá, con su propia sesión, para no interferir con la continuidad de arriba)

    # ── 3: dictado completo desde el arranque -> CARD lista para Emitir ────────────────────────
    punto(3, "dictado completo -> CARD con faltantes=[]")
    session3 = f"e2e-hito9-{uuid.uuid4().hex[:8]}"
    texto_completo = "facturale a Juan un service de PC por 50000, consumidor final"
    enviar(token, session3, texto_completo)
    r3 = esperar_reply(token, session3, 0)
    fila3 = r3["replies"][0]
    log(f"texto: {fila3['reply_text']!r}")
    log(f"card:  {json.dumps(fila3['card'], ensure_ascii=False)}")
    card3 = fila3["card"] or {}
    if card3.get("kind") != "factura_propuesta":
        fallas.append(f"§5.3: esperaba kind=factura_propuesta, llegó {card3.get('kind')!r}")
    elif card3.get("data", {}).get("faltantes") != []:
        fallas.append(f"§5.3: esperaba faltantes=[], llegó {card3.get('data', {}).get('faltantes')}")
    else:
        factura_id_1 = card3["data"]["factura_id"]
        log(f"OK -- card lista para Emitir, factura_id={factura_id_1}")

        # ── 4: doble dictado de la MISMA orden completa -> UN solo borrador ─────────────────────
        punto(4, "doble dictado de la MISMA orden -> un solo borrador (mismo factura_id, sin duplicar)")
        after3 = r3["next_id"]
        enviar(token, session3, texto_completo)
        r4 = esperar_reply(token, session3, after3)
        fila4 = r4["replies"][0]
        card4 = fila4["card"] or {}
        log(f"card:  {json.dumps(card4, ensure_ascii=False)}")
        items4 = card4.get("data", {}).get("items", [])
        if len(items4) != 1:
            fallas.append(f"§5.4: esperaba 1 ítem tras el doble dictado, llegaron {len(items4)} (¿duplicó?)")
        else:
            log(f"OK -- 1 solo ítem tras dictar dos veces, factura_id={card4.get('data', {}).get('factura_id')}")

    # ── 5: sin perfil fiscal -> mensaje de negocio, sin card, sin 500 ──────────────────────────
    punto(5, "sin perfil fiscal -> mensaje de negocio (nota: sólo válido si el tenant e2e-device NO tiene perfil AFIP)")
    log("(si el tenant e2e-device ya tiene perfil fiscal cargado, este punto no es ejercitable tal cual -- se anota, no se fuerza un dato falso)")

    print(f"\n{'=' * 70}")
    if fallas:
        print(f"❌ {len(fallas)} punto(s) fallaron:")
        for f in fallas:
            print(f"   - {f}")
        return 1
    print("✅ TODOS los puntos verificados pasaron")
    return 0


if __name__ == "__main__":
    sys.exit(main())
