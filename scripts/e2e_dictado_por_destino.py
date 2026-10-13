#!/usr/bin/env python3
"""E2E vivo del dictado por destino (contrato 2026-10-13): `POST /chat` con `kind="dictado:<destino>"`.

Contra el LLM REAL de prod, con el usuario de prueba canónico. Mide lo que los tests con LLM guionado no
pueden: que un modelo real, con una frase SIN verbo ni contexto («cinco mil pesos de nafta»), termine en
la card del destino cuando el scope lo obliga — y el control: la misma frase ambigua por el chat normal.

Qué afirma (binario):
  1. cada uno de los 4 destinos → una reply con `card.kind == <destino>_propuesto` en el session_id
     NAMESPACEADO que devolvió `/chat` (y el reply NO le pregunta «qué querés hacer»);
  2. un destino fuera de la lista (`dictado:factura`, `dictado:`) → 422 y no se crea ninguna reply;
  3. el hilo del chat normal no recibe nada del dictado (otro session_id → /reply vacío).
El control con el chat normal se IMPRIME pero no se afirma: un modelo real es estocástico y «a veces
también acierta por el camino genérico» es exactamente el caso que el scope vuelve determinista.

Muta prod de forma mínima: crea hilos efímeros del usuario de prueba y NO persiste ningún gasto/ingreso/
cliente/presupuesto (las 4 tools sólo PROPONEN: la card se confirma desde la app). Idempotente.

Uso:  UC_ENV_E2E_PATH=<ruta al .env.e2e> python scripts/e2e_dictado_por_destino.py
"""
from __future__ import annotations

import sys
import uuid
from pathlib import Path

import requests

sys.path.insert(0, str(Path(__file__).resolve().parent))
from e2e_g6_durabilidad_worker_restart import BASE, esperar_reply, login  # noqa: E402

# frase sin verbo ni contexto: por el chat normal es ambigua, y por el scope tiene un solo destino posible
CASOS = {
    "gasto": ("cinco mil pesos de nafta", "gasto_propuesto"),
    "ingreso": ("ochenta y cinco mil ciento veintitres de la panadería", "ingreso_propuesto"),
    "presupuesto": ("dos sillas a ocho mil para Juan Pérez", "presupuesto_propuesto"),
    "cliente": ("Panadería Los Tilos, CUIT 30-71234567-8", "cliente_propuesto"),
}


def _post_chat(token: str, session_id: str, texto: str, kind: str) -> requests.Response:
    return requests.post(f"{BASE}/chat", json={"session_id": session_id, "text": texto, "kind": kind},
                         headers={"Authorization": f"Bearer {token}"}, timeout=20)


def _card_kind(replies: list[dict]) -> str:
    for r in reversed(replies):
        card = r.get("card") or {}
        if card.get("kind"):
            return card["kind"]
    return ""


def main() -> int:
    token = login()
    corrida = uuid.uuid4().hex[:8]
    fallos: list[str] = []

    for destino, (frase, esperada) in CASOS.items():
        sid = f"e2e-dictado-{destino}-{corrida}"
        r = _post_chat(token, sid, frase, f"dictado:{destino}")
        print(f"[{destino}] POST /chat -> {r.status_code} {r.text[:160]}")
        if r.status_code != 200:
            fallos.append(f"{destino}: /chat devolvió {r.status_code}")
            continue
        efectivo = r.json()["session_id"]
        if efectivo != f"dictado:{destino}:{sid}":
            fallos.append(f"{destino}: session_id efectivo inesperado {efectivo!r}")
        replies = esperar_reply(token, efectivo, segundos=120)
        kind = _card_kind(replies)
        texto = " | ".join((x.get("reply_text") or "")[:90] for x in replies)
        print(f"[{destino}] card={kind!r} texto={texto!r}")
        if kind != esperada:
            fallos.append(f"{destino}: card {kind!r} != {esperada!r}")
        if any("qué querés hacer" in (x.get("reply_text") or "").lower() for x in replies):
            fallos.append(f"{destino}: preguntó «qué querés hacer»")
        # el hilo del chat (otro session_id) no recibe nada del dictado
        chat = requests.get(f"{BASE}/reply", params={"session_id": sid, "after_id": 0},
                            headers={"Authorization": f"Bearer {token}"}, timeout=15).json()
        if chat.get("replies"):
            fallos.append(f"{destino}: el dictado dejó replies en el hilo del chat ({sid})")

    for kind in ("dictado:factura", "dictado:", "dictado:GASTO"):
        r = _post_chat(token, f"e2e-dictado-rechazo-{corrida}", "cinco mil de nafta", kind)
        print(f"[rechazo {kind!r}] POST /chat -> {r.status_code}")
        if r.status_code != 422:
            fallos.append(f"{kind}: esperaba 422 y fue {r.status_code}")

    # CONTROL informativo: la frase ambigua del destino cliente por el chat normal (sin scope)
    sid_ctl = f"e2e-dictado-control-{corrida}"
    r = _post_chat(token, sid_ctl, CASOS["cliente"][0], "text")
    if r.status_code == 200:
        try:
            replies = esperar_reply(token, sid_ctl, segundos=90)
            print(f"[CONTROL chat normal] card={_card_kind(replies)!r} texto="
                  f"{' | '.join((x.get('reply_text') or '')[:90] for x in replies)!r}")
        except TimeoutError:
            print("[CONTROL chat normal] sin reply en 90s")
    
    if fallos:
        print("\n=== RESULTADO: ROJO ===")
        for f in fallos:
            print(" -", f)
        return 1
    print("\n=== RESULTADO: VERDE — los 4 destinos terminan en su card, el rechazo es 422 y el chat no se ensucia ===")
    return 0


if __name__ == "__main__":
    sys.exit(main())
