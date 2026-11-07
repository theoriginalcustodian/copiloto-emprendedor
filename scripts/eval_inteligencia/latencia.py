"""Desglose de latencia por activity de los turnos del eval, leído del history de Temporal (read-only).

Instrumento de SM-P21 (p50 por turno y ejecución de `call_llm_tools`), versionado en SM-P22 para que la
medición sea reproducible por un tercero.

Uso:
    python -I -X utf8 scripts/eval_inteligencia/latencia.py --cliente-id <uuid> [--n 20] [--prefijo eval-ib-]

`--cliente-id` es el tenant del usuario de prueba canónico (e2e-device@copiloto.test); también se toma de
`UC_EVAL_CLIENTE_ID`. No hay valores en este archivo: el host SSH sale de `UC_VPS_SSH` (default
`unreal-copilot`, el alias del ~/.ssh/config).
"""
from __future__ import annotations

import argparse
import base64
import datetime as dt
import json
import os
import subprocess
from collections import defaultdict

TCLI = "docker exec temporal-admin-tools temporal --address temporal-server:7233"


def sh(host: str, cmd: str) -> str:
    return subprocess.run(["ssh", host, cmd], capture_output=True, text=True, timeout=120).stdout


def ts(s: str) -> dt.datetime:
    return dt.datetime.fromisoformat(s.replace("Z", "+00:00"))


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--cliente-id", default=os.environ.get("UC_EVAL_CLIENTE_ID"))
    ap.add_argument("--n", type=int, default=12, help="cantidad de workflows (turnos) a leer")
    ap.add_argument("--prefijo", default="eval-ib-", help="prefijo de sesión que usa eval_fidelidad.py")
    ap.add_argument("--host", default=os.environ.get("UC_VPS_SSH", "unreal-copilot"))
    a = ap.parse_args()
    if not a.cliente_id:
        ap.error("falta --cliente-id (o UC_EVAL_CLIENTE_ID)")

    q = f"WorkflowId STARTS_WITH 'conv-web-{a.cliente_id}-{a.prefijo}'"
    ids = [json.loads(l)["execution"]["workflowId"]
           for l in sh(a.host, f'{TCLI} workflow list --query "{q}" --limit {a.n} -o jsonl').splitlines() if l.strip()]
    if not ids:
        raise SystemExit(f"0 workflows con {q!r}: ¿corrió el eval? ¿cliente-id correcto?")

    tot: dict[str, list[float]] = defaultdict(list)
    for wf in ids:
        ev = json.loads(sh(a.host, f"{TCLI} workflow show --workflow-id {wf} -o json")).get("events", [])
        sched, start, nombre, tool = {}, {}, {}, {}
        t0 = ts(ev[0]["eventTime"])
        filas, fin = [], t0
        for e in ev:
            t, tipo, eid = ts(e["eventTime"]), e["eventType"], str(e["eventId"])
            if tipo == "EVENT_TYPE_ACTIVITY_TASK_SCHEDULED":
                at = e["activityTaskScheduledEventAttributes"]
                sched[eid], nombre[eid] = t, at["activityType"]["name"]
                if nombre[eid] == "execute_tool":
                    try:
                        tool[eid] = json.loads(base64.b64decode(at["input"]["payloads"][0]["data"])).get("name")
                    except Exception:  # noqa: BLE001 — sin nombre de tool se mide igual la activity
                        pass
            elif tipo == "EVENT_TYPE_ACTIVITY_TASK_STARTED":
                start[e["activityTaskStartedEventAttributes"]["scheduledEventId"]] = t
            elif tipo == "EVENT_TYPE_ACTIVITY_TASK_COMPLETED":
                s = e["activityTaskCompletedEventAttributes"]["scheduledEventId"]
                n = nombre[s] + (f"[{tool[s]}]" if s in tool else "")
                cola = (start.get(s, sched[s]) - sched[s]).total_seconds()
                ejec = (t - start.get(s, sched[s])).total_seconds()
                filas.append((round((sched[s] - t0).total_seconds(), 2), n, round(cola, 2), round(ejec, 2)))
                tot[nombre[s]].append(ejec)
                fin = t
        print(f"\n{wf[-20:]}  total hasta última activity={round((fin - t0).total_seconds(), 2)}s")
        for f in filas:
            print(f"   +{f[0]:6}s  {f[1]:45} cola={f[2]}s  ejec={f[3]}s")
    print("\nPROMEDIO por activity (ejecución):")
    for k, v in sorted(tot.items(), key=lambda kv: -sum(kv[1])):
        print(f"   {k:30} n={len(v):3} prom={sum(v)/len(v):.2f}s max={max(v):.2f}s")


if __name__ == "__main__":
    main()
