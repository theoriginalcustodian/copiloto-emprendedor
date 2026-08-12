#!/usr/bin/env python3
"""e2e §G6 item 2 (backend) -- durabilidad: una conversación sobrevive un restart REAL del worker
en prod. Es el moat del producto (orquestación durable con Temporal, spec §0/CLAUDE.md) -- este
script prueba la garantía en sí, no una simulación: un mensaje se manda y SE RESTART EL WORKER
mientras el workflow puede estar todavía en vuelo, y después se sigue la MISMA sesión.

No usa mocks de Temporal: dispara `systemctl restart uc-copiloto-worker` de verdad contra el VPS
(mismo servicio que reinicia cada deploy real -- ya se hizo N veces esta sesión como parte del
cutover de C4) mientras hay un `POST /chat` en vuelo, y confirma que (a) ese mensaje igual llega a
buen puerto por `GET /reply` después del restart, y (b) la MISMA sesión sigue viva para un segundo
turno posterior -- no sólo "un mensaje huérfano se recuperó", sino "la conversación continuó".

Uso:
    python scripts/e2e_g6_durabilidad_worker_restart.py
"""
from __future__ import annotations

import subprocess
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
SSH_HOST = "unreal-copilot"
SERVICE = "uc-copiloto-worker.service"


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


def ssh(cmd: str) -> str:
    r = subprocess.run(["ssh", SSH_HOST, cmd], capture_output=True, text=True, timeout=60)
    if r.returncode != 0:
        raise RuntimeError(f"ssh falló ({cmd}): rc={r.returncode} stderr={r.stderr}")
    return r.stdout.strip()


def restart_worker_ya() -> None:
    log(f"RESTART REAL de {SERVICE} en {SSH_HOST} -- disparado con el mensaje potencialmente en vuelo")
    ssh(f"sudo systemctl restart {SERVICE}")


def esperar_worker_activo(*, segundos: float = 60) -> None:
    limite = time.monotonic() + segundos
    while time.monotonic() < limite:
        estado = ssh(f"systemctl is-active {SERVICE}")
        if estado == "active":
            log(f"   {SERVICE} activo de nuevo")
            return
        time.sleep(2)
    raise TimeoutError(f"{SERVICE} no volvió a 'active' en {segundos}s")


def main() -> int:
    log(f"BASE={BASE}  SSH_HOST={SSH_HOST}  SERVICE={SERVICE}")

    log("1) login canónico (e2e-device@copiloto.test)")
    token = login()

    session_id = f"e2e-g6-durabilidad-{uuid.uuid4()}"
    marcador_1 = uuid.uuid4().hex[:8]
    log(f"2) turno 1 -- session_id={session_id} marcador={marcador_1}")
    enviar(token, session_id, f"turno 1, marcador {marcador_1}: decime OK si me escuchás")

    log("3) SIN esperar el reply, restart real del worker (el workflow puede estar en vuelo)")
    restart_worker_ya()
    esperar_worker_activo(segundos=60)

    log("4) ahora sí, poll de /reply del turno 1 -- tiene que llegar IGUAL pese al restart")
    replies_1 = esperar_reply(token, session_id, after_id=0, segundos=180)
    log(f"   turno 1 OK -- {len(replies_1)} fila(s) llegaron después del restart")
    next_id = replies_1[-1]["id"]

    log("5) turno 2 en la MISMA sesión, worker ya estable -- prueba continuidad, no sólo recuperación")
    marcador_2 = uuid.uuid4().hex[:8]
    enviar(token, session_id, f"turno 2, marcador {marcador_2}: seguís ahí?")
    replies_2 = esperar_reply(token, session_id, after_id=next_id, segundos=90)
    log(f"   turno 2 OK -- {len(replies_2)} fila(s) nuevas, misma sesión sigue viva post-restart")

    print("\n=== RESULTADO: VERDE -- LA CONVERSACIÓN SOBREVIVIÓ AL RESTART REAL DEL WORKER ===")
    print(f"session_id={session_id}")
    print(f"turno 1 (en vuelo durante el restart) -> {len(replies_1)} reply(s)")
    print(f"turno 2 (post-restart, misma sesión)   -> {len(replies_2)} reply(s)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
