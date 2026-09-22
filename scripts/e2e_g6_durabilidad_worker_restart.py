#!/usr/bin/env python3
"""e2e §G6 item 2 (backend) -- durabilidad: una conversación Y un HITL sobreviven un restart REAL
del worker en prod (plan §8.1 fila BL-B1). Es el moat del producto (orquestación durable con
Temporal, spec §0/CLAUDE.md) -- este script prueba la garantía en sí, no una simulación: el estado
se persiste ANTES del restart (turno 1 respondido, gate HITL parqueado) y se verifica DESPUÉS.

⚠️ H-A3-8 (auditoría A3, 2026-09-22): lo que esto prueba es CONTINUIDAD de sesión + persistencia de
un gate parqueado a través de un restart -- NO recuperación de una activity que estaba activamente
EJECUTÁNDOSE en el momento exacto del restart. Entre `--armar` y el restart real hay un gap externo
sin cota (deploy.sh real, o cualquier restart legítimo, corre cuando corre); no hay forma de
garantizar que algo esté "en vuelo" en ese instante, y una corrida real de A3 midió lo contrario
para el turno 1 (su reply salió del worker VIEJO, antes del restart). El nombre y los mensajes de
este script NO afirman "en vuelo" en ningún lado -- si en el futuro hace falta probar recuperación
de una activity genuinamente en ejecución durante el restart, eso es un script DISTINTO (necesita
disparar el restart en el medio de una activity corriendo, lo que hoy el operador vetó que este
script haga por su cuenta).

La mitad HITL ejercita el gate cross-turn del react loop (`conversation_workflow.py::_run_react_turn`,
`self._state['react']` parqueado): se dispara `calendar_book` SIN confirmar (arma el gate, guarda
`self._state['react']['pending']` en el event history), el worker se reinicia (el estado parqueado
tiene que reconstruirse por REPLAY, no por memoria viva), y recién DESPUÉS se manda el callback
`confirm:<turn_ix>:<step>` (el token que expone `/reply` en `choices[].value`, ver
`_confirm_choices()`). Si el replay no reconstruyó `self._state['react']` bien, el callback cae en
la rama "callback SIN gate parqueado" (`_run_react_turn` línea ~406) y responde "Listo 👍" sin
ejecutar nada -- silencioso, no una excepción. `_reply_resolvio_el_gate` discrimina por DOS
señales, no una: que no vuelva a pedir el mismo confirm, Y que la reply no calce con la firma
exacta de esa rama de fallo -- lo segundo lo agregó H-A3-8 (auditoría A3, 2026-09-22): la rama de
fallo TAMBIÉN carece de choice 'confirm:', así que mirar sólo lo primero confirmaba un callback
perdido como resuelto. `--control-negativo` reproduce ese caso y tiene que dar ROJO.

⚠️ Este script NO dispara ningún restart. Versión anterior (pre 2026-08-13) llamaba
`ssh ... sudo systemctl restart uc-copiloto-worker.service` por su cuenta -- el operador de este
repo vetó explícitamente que una sesión autónoma reinicie servicios de producción fuera de un
deploy real orquestado (`deploy/copiloto/deploy.sh`). Un restart standalone acá sería exactamente
ese rodeo, aunque el motivo fuera "sólo para testear durabilidad". Por eso el script se partió en
dos mitades independientes que se apoyan en un restart que YA va a pasar por su propio mérito (un
deploy real), en vez de producirlo:

    1. `--armar`     manda el turno 1 (conversación simple) Y el turno HITL (calendar_book sin
                      confirmar); persiste session_id/marcador/token de confirmación a disco.
    2. (acá en el medio corre `deploy.sh` real, o cualquier restart legítimo del worker)
    3. `--verificar` lee ese estado y confirma: (a) el turno 1 llegó pese al restart y la MISMA
                      sesión sigue viva para un turno 2; (b) el callback de confirmación del gate
                      HITL, mandado DESPUÉS del restart, resuelve el gate que quedó parqueado ANTES.

Cada mitad es idempotente y falla ruidosamente si se corre fuera de orden: `--verificar` sin un
`--armar` previo (o con el estado ya consumido) es un error, no un no-op silencioso.

Uso:
    python scripts/e2e_g6_durabilidad_worker_restart.py --armar
    # ... correr deploy.sh real, o esperar el próximo restart legítimo del worker ...
    python scripts/e2e_g6_durabilidad_worker_restart.py --verificar

    # H-A3-8: control negativo -- no depende de ningún restart, corre solo, tiene que dar ROJO.
    python scripts/e2e_g6_durabilidad_worker_restart.py --control-negativo
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


def enviar_callback(token: str, session_id: str, value: str) -> None:
    """Reingresa al gate cross-turn con el token de `choices[].value` (ej 'confirm:3:0'). Mismo
    endpoint /chat, `kind='callback'` en vez de 'text' -- así lo manda el front real al tocar
    Confirmar (ver `conversation_workflow.py::_run_react_turn`, rama `kind == 'callback'`)."""
    r = requests.post(f"{BASE}/chat", json={"session_id": session_id, "text": value, "kind": "callback"},
                       headers={"Authorization": f"Bearer {token}"}, timeout=15)
    r.raise_for_status()
    body = r.json()
    assert body["accepted"], f"el backend no aceptó el callback: {body}"
    log(f"   /chat (callback) accepted=true wf_id={body.get('wf_id')}")


def _token_de_confirmacion(replies: list[dict]) -> str:
    """Busca en `replies` la card HITL y devuelve su `choices[].value` que arranca con 'confirm:'
    (el token `turn_ix:step` del gate, ver `_confirm_choices()`). Explota si no está: sin token no
    hay nada que confirmar -- el turno 1 HITL no disparó el gate esperado."""
    for r in replies:
        for c in (r.get("choices") or []):
            valor = c.get("value", "")
            if valor.startswith("confirm:"):
                return valor
    raise AssertionError(f"ninguna reply trae un choice 'confirm:...' -- ¿calendar_book no abrió el gate? {replies}")


# H-A3-8: firma EXACTA de `conversation_workflow.py::_run_react_turn`, rama "callback STALE sin
# gate parqueado" (`kind == "callback" and not parked` -> responde esto y corta, SIN LLM, SIN
# ejecutar nada). Si esa línea cambia el texto, esta constante hay que actualizarla junto -- no hay
# forma de leerla en vivo desde acá (el script sólo habla HTTP con prod, no importa el motor).
_TEXTO_CALLBACK_SIN_GATE = "Listo 👍"  # conversation_workflow.py:407


def _reply_resolvio_el_gate(replies: list[dict]) -> bool:
    """True sólo si el gate se resolvió DE VERDAD. Dos chequeos, no uno:

    1. Ninguna reply post-callback vuelve a traer un choice 'confirm:' -- si lo trajera, el
       callback NO reingresó al gate parqueado.
    2. Ninguna reply calza con la firma EXACTA de la rama de fallo ('Listo 👍', ver
       `_TEXTO_CALLBACK_SIN_GATE`).

    H-A3-8 (auditoría A3): la versión anterior sólo miraba (1). La rama de fallo (`kind ==
    'callback' and not parked`) TAMBIÉN carece de choice 'confirm:' en su respuesta -- responde
    'Listo 👍' con `choices=None` -- así que un callback que se perdió (el replay no reconstruyó
    `self._state['react']`) pasaba como resuelto: el instrumento confirmaba en vez de verificar.
    Control negativo que reproduce exactamente este caso: `--control-negativo` (más abajo)."""
    repite_confirm = any(c.get("value", "").startswith("confirm:")
                          for r in replies for c in (r.get("choices") or []))
    cayo_en_rama_sin_gate = any((r.get("reply_text") or "") == _TEXTO_CALLBACK_SIN_GATE for r in replies)
    return not repite_confirm and not cayo_en_rama_sin_gate


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
    log(f"2) turno 1 (conversación simple) -- session_id={session_id} marcador={marcador_1}")
    enviar(token, session_id, f"turno 1, marcador {marcador_1}: decime OK si me escuchás")

    session_id_hitl = f"e2e-g6-durabilidad-hitl-{uuid.uuid4()}"
    log(f"3) turno HITL (calendar_book sin confirmar) -- session_id={session_id_hitl}")
    enviar(token, session_id_hitl, "agendame una reunión con un cliente mañana a las 10 de la mañana")
    log("   esperando la card de confirmación (ANTES del restart -- el gate tiene que quedar")
    log("   parqueado en el event history, no sólo en memoria viva del worker actual)")
    replies_hitl = esperar_reply(token, session_id_hitl, after_id=0, segundos=180)
    token_confirm = _token_de_confirmacion(replies_hitl)
    log(f"   gate abierto -- token={token_confirm}")

    _guardar_estado({
        "session_id": session_id,
        "marcador_1": marcador_1,
        "after_id_turno_1": 0,
        "session_id_hitl": session_id_hitl,
        "after_id_hitl": replies_hitl[-1]["id"],
        "token_confirm": token_confirm,
        "armado_en": time.time(),
    })
    log(f"4) estado guardado en {ESTADO_PATH}")
    print(
        "\n=== ARMADO -- turno 1 y el gate HITL están en vuelo ahora mismo ===\n"
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
    session_id_hitl = estado["session_id_hitl"]
    after_id_hitl = estado["after_id_hitl"]
    token_confirm = estado["token_confirm"]
    log(f"BASE={BASE}  session_id={session_id}  marcador_1={marcador_1}  session_id_hitl={session_id_hitl}")

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

    log("4) HITL: reingreso al gate parqueado ANTES del restart (callback POST-restart)")
    enviar_callback(token, session_id_hitl, token_confirm)
    replies_hitl_post = esperar_reply(token, session_id_hitl, after_id=after_id_hitl, segundos=90)
    resolvio = _reply_resolvio_el_gate(replies_hitl_post)
    if not resolvio:
        raise AssertionError(
            "el callback post-restart volvió a traer un choice 'confirm:...' -- el gate cross-turn "
            "NO sobrevivió el restart (self._state['react'] no se reconstruyó por replay; cayó en "
            f"la rama 'callback sin gate parqueado'). replies={replies_hitl_post}"
        )
    log(f"   HITL OK -- {len(replies_hitl_post)} fila(s) nuevas, el gate se resolvió (no repreguntó)")

    _consumir_estado()
    print("\n=== RESULTADO: VERDE -- CONVERSACIÓN Y HITL SOBREVIVIERON AL RESTART REAL DEL WORKER ===")
    print(f"session_id={session_id}")
    # H-A3-8: "en vuelo durante el restart" es una afirmación que este script NO puede probar --
    # entre `--armar` y el restart real hay un gap externo sin cota (deploy.sh real, o cualquier
    # restart legítimo, corre cuando corre); medido en A3: la reply del turno 1 salió del worker
    # VIEJO, antes del restart. Lo que SÍ se prueba acá es continuidad: la MISMA sesión sigue viva
    # y responde un turno 2 después del restart. La mitad que sí prueba supervivencia de estado
    # parqueado A TRAVÉS del restart es el gate HITL (abajo).
    print(f"turno 1 (mandado antes del restart; prueba CONTINUIDAD, no recuperación en vuelo) -> {len(replies_1)} reply(s)")
    print(f"turno 2 (post-restart, misma sesión)   -> {len(replies_2)} reply(s)")
    print(f"session_id_hitl={session_id_hitl}")
    print(f"gate HITL (parqueado ANTES del restart, resuelto DESPUÉS -- sobrevive por replay) -> {len(replies_hitl_post)} reply(s)")
    return 0


def control_negativo() -> int:
    """H-A3-8 DoD: control negativo que debe dar ROJO. Manda un callback a una sesión que NUNCA
    abrió un gate HITL (session_id nuevo, primer mensaje es directamente `kind='callback'`) --
    ejercita el backend REAL, no una simulación in-process. `conversation_workflow.py` cae en la
    rama "callback sin gate parqueado" (`kind == 'callback' and not parked`) y responde
    'Listo 👍' sin ejecutar nada. `_reply_resolvio_el_gate` tiene que detectar esto como NO
    resuelto -- si el instrumento volviera a dar verde acá, sería la MISMA regresión que H-A3-8
    encontró (confirma en vez de verificar)."""
    log(f"BASE={BASE}")
    log("1) login canónico (e2e-device@copiloto.test)")
    token = login()

    session_id = f"e2e-g6-control-negativo-{uuid.uuid4()}"
    log(f"2) callback a session_id NUEVO, SIN gate HITL abierto -- session_id={session_id}")
    enviar_callback(token, session_id, "confirm:0:0")
    replies = esperar_reply(token, session_id, after_id=0, segundos=60)
    log(f"   replies={replies}")

    resolvio = _reply_resolvio_el_gate(replies)
    if resolvio:
        print(
            "\n=== CONTROL NEGATIVO FALLÓ: el instrumento dio VERDE (resolvió=True) donde debía "
            "dar ROJO -- H-A3-8 sigue vigente ==="
        )
        return 1
    print(
        "\n=== CONTROL NEGATIVO OK: el instrumento detectó el gate NO resuelto (ROJO esperado) ==="
    )
    print(f"session_id={session_id}")
    print(f"reply(s) recibida(s): {replies}")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    modo = parser.add_mutually_exclusive_group(required=True)
    modo.add_argument("--armar", action="store_true", help="manda el turno 1 y persiste el estado esperado")
    modo.add_argument("--verificar", action="store_true", help="lee el estado y confirma supervivencia post-restart")
    modo.add_argument("--control-negativo", action="store_true",
                       help="H-A3-8: callback sin gate pendiente -- tiene que dar ROJO")
    args = parser.parse_args()

    if args.armar:
        return armar()
    if args.control_negativo:
        return control_negativo()
    return verificar()


if __name__ == "__main__":
    raise SystemExit(main())
