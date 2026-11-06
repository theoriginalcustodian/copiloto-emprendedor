"""¿Dos turnos de chat fueron atendidos por la MISMA sesión viva de Temporal? (instrumento de lectura, no escribe nada)

Pregunta que contesta: tras `force-stop` + reabrir la app, ¿el 2º turno entró al `ConversationWorkflow` que ya
tenía el 1º (el hilo SOBREVIVE), o a una sesión nueva que "adivinó" desde la memoria larga? Que la card salga
sirve para los dos casos; este instrumento los distingue.

Qué se mira (todo medido en el history real del VPS, 2026-11-05):
  * workflowId = `conv-web-<cliente_id>-<session_id>`. Si el 2º turno cae en OTRO workflowId -> sesión NUEVA.
  * Cada turno es un evento `WORKFLOW_EXECUTION_SIGNALED` con `signalName = receive_message`.
  * runId: mismo runId + más señales = mismo run. runId distinto pero `continuedExecutionRunId == runId anterior`
    y el MISMO workflowId = CONTINUE-AS-NEW: es el mecanismo funcionando (la sesión es permanente; el `carryover`
    arrastra history + state + pending_slot, ver conversation_workflow.py:193-207). NO es un fallo.

Uso (desde la PC; lee vía `ssh unreal-copilot` + `docker exec temporal-admin-tools`):
  python scripts/conv_mismo_run.py --listar <cliente_id>                 # los últimos workflows del tenant
  python scripts/conv_mismo_run.py <workflow_id>                         # snapshot (imprimí el de ANTES del force-stop)
  python scripts/conv_mismo_run.py <workflow_id> --antes <runId>,<n_señales>   # veredicto vs el snapshot previo
"""
from __future__ import annotations

import json
import shlex
import subprocess
import sys

SSH = "unreal-copilot"
TEMPORAL = "docker exec temporal-admin-tools temporal --address temporal-server:7233"


def _temporal(args: str) -> dict | list:
    cmd = ["ssh", SSH, f"{TEMPORAL} {args} --output json"]
    out = subprocess.run(cmd, capture_output=True, text=True, timeout=90)
    if out.returncode != 0:
        raise SystemExit(f"temporal falló ({out.returncode}): {out.stderr[:200]}")
    return json.loads(out.stdout)


def snapshot(workflow_id: str) -> dict:
    wid = shlex.quote(workflow_id)
    eventos = _temporal(f"workflow show --workflow-id {wid}")
    eventos = eventos.get("events") or eventos.get("history", {}).get("events") or []
    desc = _temporal(f"workflow describe --workflow-id {wid}").get("workflowExecutionInfo", {})
    inicio = next(e for e in eventos if e["eventType"] == "EVENT_TYPE_WORKFLOW_EXECUTION_STARTED")
    a = inicio["workflowExecutionStartedEventAttributes"]
    senales = [e for e in eventos if e["eventType"] == "EVENT_TYPE_WORKFLOW_EXECUTION_SIGNALED"
               and e["workflowExecutionSignaledEventAttributes"].get("signalName") == "receive_message"]
    return {"workflow_id": workflow_id, "run_id": desc.get("execution", {}).get("runId"),
            "first_run_id": a.get("firstExecutionRunId"), "continued_from": a.get("continuedExecutionRunId"),
            "status": desc.get("status"), "eventos": len(eventos), "senales": len(senales)}


def veredicto(antes_run: str, antes_senales: int, ahora: dict) -> tuple[str, str]:
    """Pura (testeable): (VEREDICTO, explicación). `antes_*` = snapshot previo al force-stop."""
    if ahora["run_id"] == antes_run:
        if ahora["senales"] > antes_senales:
            return "MISMO-RUN", f"mismo runId, +{ahora['senales'] - antes_senales} turno(s) por signal al run vivo: el hilo SOBREVIVIÓ"
        return "SIN-TURNO-NUEVO", "mismo runId pero ninguna señal nueva: el 2º turno todavía no llegó (o no entró a esta sesión)"
    if ahora["continued_from"] == antes_run:
        return "CONTINUE-AS-NEW", ("runId nuevo, pero continuedExecutionRunId == el run anterior y el mismo workflowId: la sesión "
                                   "se renovó por continue-as-new arrastrando el estado. Es la MISMA sesión, no un fallo")
    return "RUN-NO-RELACIONADO", ("runId distinto y NO continúa al anterior: no se puede afirmar que sea la misma sesión "
                                  "(revisá si hubo un reset/cierre; no lo leas como éxito)")


def main(argv: list[str]) -> int:
    if len(argv) >= 2 and argv[0] == "--listar":
        q = f'WorkflowType="ConversationWorkflow" AND WorkflowId STARTS_WITH "conv-web-{argv[1]}"'
        for w in _temporal(f"workflow list --query {shlex.quote(q)} --limit 8"):
            print(w["execution"]["workflowId"], "| run", w["execution"]["runId"][:8], "|",
                  w["status"].replace("WORKFLOW_EXECUTION_STATUS_", ""), "| inicio", str(w.get("startTime"))[:19])
        return 0
    if not argv:
        print(__doc__)
        return 2
    s = snapshot(argv[0])
    print(json.dumps(s, ensure_ascii=False))
    if "--antes" in argv:
        run_prev, _, n_prev = argv[argv.index("--antes") + 1].partition(",")
        v, porque = veredicto(run_prev, int(n_prev or 0), s)
        print(f"VEREDICTO: {v} — {porque}")
        return 0 if v in ("MISMO-RUN", "CONTINUE-AS-NEW") else 1
    print("snapshot guardado: pasalo como --antes <run_id>,<senales> después del force-stop")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
