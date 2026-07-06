"""Workflow durable de refresh del token de 180 días (capa PLANTILLA, molde `recurring_charge`). SOLO el
workflow — la activity vive en mp_refresh_activities.py (regla temporal-developer: no mezclar workflow/activity).
Loop acotado por max_cycles + continue_as_new para operación indefinida sin inflar el history. NO usa Temporal
Schedules (no hay en el repo): es un loop durable con workflow.sleep."""
from __future__ import annotations

from datetime import timedelta

from temporalio import workflow

with workflow.unsafe.imports_passed_through():   # el ÚNICO lugar correcto: archivo del workflow, no la activity
    from clients.agent.providers.mp_refresh_activities import refresh_credential


@workflow.defn
class MpRefreshWorkflow:
    """Renueva proactivamente el token del vendedor. Un workflow por (cliente_id, seller_user_id).
    `loop_forever=False` (solo test) corta tras max_cycles sin continue_as_new."""

    @workflow.run
    async def run(self, cliente_id: str, seller_user_id: str, refresh_interval_seconds: float,
                  max_cycles: int, loop_forever: bool = True) -> dict:
        cycles = 0
        for _ in range(max_cycles):
            await workflow.sleep(timedelta(seconds=refresh_interval_seconds))
            res = await workflow.execute_activity(
                refresh_credential, args=[cliente_id, seller_user_id],
                start_to_close_timeout=timedelta(seconds=60))
            cycles += 1
            if not res.get("ok"):
                return {"outcome": "stopped", "reason": res.get("reason"), "cycles": cycles}
        if loop_forever:
            # continue_as_new RAISEA (control-flow): el return de abajo solo corre con loop_forever=False.
            workflow.continue_as_new(
                args=[cliente_id, seller_user_id, refresh_interval_seconds, max_cycles, loop_forever])
        return {"outcome": "active", "cycles": cycles}
