#!/usr/bin/env python3
"""e2e §G6 item 2 (backend) -- durabilidad: una conversación sobrevive un restart REAL del worker
en prod. Es el moat del producto (orquestación durable con Temporal, spec §0/CLAUDE.md) -- este
script prueba la garantía en sí, no una simulación: un mensaje se manda mientras el workflow puede
estar todavía en vuelo, el worker se reinicia, y después se sigue la MISMA sesión.

⚠️ Este script NO dispara ningún restart. Versión anterior (pre 2026-08-13) llamaba
`ssh ... sudo systemctl restart uc-copiloto-worker.service` por su cuenta -- el operador de este
repo vetó explícitamente que una sesión autónoma reinicie servicios de producción fuera de un
deploy real orquestado (`deploy/copiloto/deploy.sh`). Un restart standalone acá sería exactamente
ese rodeo, aunque el motivo fuera "sólo para testear durabilidad". Por eso el script se partió en
dos mitades independientes que se apoyan en un restart que YA va a pasar por su propio mérito (un
deploy real), en vez de producirlo:

    1. `--armar`     manda el turno 1 y persiste session_id/marcador/next_id esperado a disco.
    2. (acá en el medio corre `deploy.sh` real, o cualquier restart legítimo del worker)
    3. `--verificar` lee ese estado y confirma que el turno 1 llegó pese al restart y que la MISMA
                      sesión sigue viva para un turno 2.

Cada mitad es idempotente y falla ruidosamente si se corre fuera de orden: `--verificar` sin un
`--armar` previo (o con el estado ya consumido) es un error, no un no-op silencioso.

Uso:
    python scripts/e2e_g6_durabilidad_worker_restart.py --armar
    # ... correr deploy.sh real, o esperar el próximo restart legítimo del worker ...
    python scripts/e2e_g6_durabilidad_worker_restart.py --verificar
"""
from __future__ import annotations

import argparse
import json
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
ESTADO_PATH = RAIZ / ".e2e-state" / "g6-durabilidad-worker-restart.json"


def log(msg: str) -> None:
    print(f"[e2e-g6-durabilidad] {msg}")


def _leer_env_e2e() -> dict[str, str]:
    out: dict[str, str] = {}
    for linea in ENV_E2E.read_text(encoding="utf-8").splitlines():
        linea = linea.strip()
        if not linea or linea.startswith("#") or "=" not in linea:
            continue
        k, _, v = linea.partition("=")
        out[k.strip()] = v.strip()
    return out


def login() -> str:
    env = _leer_env_e2e()
    usuario, clave = env["E2E_DEVICE_EMAIL"], env["E2E_DEVICE_PASSWORD"]
    r = requests.post(f"{BASE}/auth/login", json={"email": usuario, "password": clave}, timeout=15)
    r.raise_for_status()
    return r.json()["access_token"]


def enviar(token: str, session_id: str, texto: str) -> None:
    r = requests.post(f"{BASE}/chat", json={"session_id": session_id, "text": texto, "kind": "text"},
                       headers={"Authorization": f"Bearer {token}"}, timeout=15)
    r.raise_for_status()
    body = r.json()
    assert body["accepted"], f"el backend no aceptó el mensaje: {body}"
    log(f"   /chat accepted=true wf_id={body.get('wf_id')}")


def esperar_reply(token: str, session_id: str, after_id: int = 0, *, segundos: float = 180) -> list[dict]:
    limite = time.monotonic() + segundos
    while time.monotonic() < limite:
        r = requests.get(f"{BASE}/reply", params={"session_id": session_id, "after_id": after_id},
                          headers={"Authorization": f"Bearer {token}"}, timeout=15)
        r.raise_for_status()
        data = r.json()
        if data["replies"]:
            return data["replies"]
        time.sleep(3)
    raise TimeoutError(f"sin reply de {session_id} (after_id={after_id}) en {segundos}s")


def _guardar_estado(estado: dict) -> None:
    ESTADO_PATH.parent.mkdir(parents=True, exist_ok=True)
    ESTADO_PATH.write_text(json.dumps(estado, indent=2), encoding="utf-8")


def _leer_estado() -> dict:
    if not ESTADO_PATH.exists():
        raise RuntimeError(
            f"no hay estado armado en {ESTADO_PATH} -- corré `--armar` primero (y un restart real "
            "del worker en el medio) antes de `--verificar`."
        )
    return json.loads(ESTADO_PATH.read_text(encoding="utf-8"))


def _consumir_estado() -> None:
    ESTADO_PATH.unlink(missing_ok=True)


def armar() -> int:
    log(f"BASE={BASE}")
    log("1) login canónico (e2e-device@copiloto.test)")
    token = login()

    session_id = f"e2e-g6-durabilidad-{uuid.uuid4()}"
    marcador_1 = uuid.uuid4().hex[:8]
    log(f"2) turno 1 -- session_id={session_id} marcador={marcador_1}")
    enviar(token, session_id, f"turno 1, marcador {marcador_1}: decime OK si me escuchás")

    _guardar_estado({
        "session_id": session_id,
        "marcador_1": marcador_1,
        "after_id_turno_1": 0,
        "armado_en": time.time(),
    })
    log(f"3) estado guardado en {ESTADO_PATH}")
    print(
        "\n=== ARMADO -- turno 1 enviado, el workflow puede estar en vuelo ahora mismo ===\n"
        "Corré un restart REAL del worker (deploy.sh real, o cualquier restart legítimo que ya vaya\n"
        "a pasar por su propio mérito) y después corré:\n"
        "    python scripts/e2e_g6_durabilidad_worker_restart.py --verificar\n"
    )
    return 0


def verificar() -> int:
    estado = _leer_estado()
    session_id = estado["session_id"]
    marcador_1 = estado["marcador_1"]
    after_id_turno_1 = estado["after_id_turno_1"]
    log(f"BASE={BASE}  session_id={session_id}  marcador_1={marcador_1}")

    log("1) login canónico (e2e-device@copiloto.test)")
    token = login()

    log("2) poll de /reply del turno 1 -- tiene que haber llegado pese al restart en el medio")
    replies_1 = esperar_reply(token, session_id, after_id=after_id_turno_1, segundos=180)
    log(f"   turno 1 OK -- {len(replies_1)} fila(s) llegaron después del restart")
    next_id = replies_1[-1]["id"]

    log("3) turno 2 en la MISMA sesión -- prueba continuidad, no sólo recuperación")
    marcador_2 = uuid.uuid4().hex[:8]
    enviar(token, session_id, f"turno 2, marcador {marcador_2}: seguís ahí?")
    replies_2 = esperar_reply(token, session_id, after_id=next_id, segundos=90)
    log(f"   turno 2 OK -- {len(replies_2)} fila(s) nuevas, misma sesión sigue viva post-restart")

    _consumir_estado()
    print("\n=== RESULTADO: VERDE -- LA CONVERSACIÓN SOBREVIVIÓ AL RESTART REAL DEL WORKER ===")
    print(f"session_id={session_id}")
    print(f"turno 1 (en vuelo durante el restart) -> {len(replies_1)} reply(s)")
    print(f"turno 2 (post-restart, misma sesión)   -> {len(replies_2)} reply(s)")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    modo = parser.add_mutually_exclusive_group(required=True)
    modo.add_argument("--armar", action="store_true", help="manda el turno 1 y persiste el estado esperado")
    modo.add_argument("--verificar", action="store_true", help="lee el estado y confirma supervivencia post-restart")
    args = parser.parse_args()

    if args.armar:
        return armar()
    return verificar()


if __name__ == "__main__":
    raise SystemExit(main())
