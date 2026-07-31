"""S1 — ¿un Interceptor de worker ve la excepción de la activity CON el contexto que la DLQ necesita?

**El supuesto que valida.** El rediseño por costura (04-DISENO §2) apoya toda la Fase 1.5 en que se
puede capturar errores en 4 puntos fijos en vez de cablearlos feature por feature. La costura C3 es un
`Interceptor` de worker de Temporal. Si el interceptor NO ve la excepción, o la ve sin poder decir
**de qué tenant** y **de qué tool** vino, la DLQ no puede deduplicar ni aislar por cliente — y hay que
volver a cablear a mano las 80 rutas.

**Criterio binario.** El interceptor tiene que entregar las TRES cosas:
  1. la excepción real (tipo + mensaje),
  2. el nombre de la activity,
  3. el `cliente_id` que viaja en el payload.
Si falta una, S1 FALLA y el diseño de costuras se replantea.

**Condición real, no de juguete:** corre contra el Temporal del VPS (`127.0.0.1:7233`), en un task
queue propio y desechable, con el mismo shape de payload que usa `execute_tool`.

Uso (en el VPS):  /opt/uc-copiloto-venv/bin/python spike.py
"""
from __future__ import annotations

import asyncio
import sys
import traceback
from dataclasses import dataclass, field
from typing import Any

from temporalio import activity, workflow
from temporalio.client import Client
from temporalio.common import RetryPolicy
from temporalio.worker import (
    ActivityInboundInterceptor,
    ExecuteActivityInput,
    Interceptor,
    Worker,
)
from datetime import timedelta

TASK_QUEUE = "spike-s1-interceptor"


@dataclass
class Capturado:
    """Lo que el interceptor logró ver. Es el resultado del spike."""

    hubo_excepcion: bool = False
    tipo: str = ""
    mensaje: str = ""
    nombre_activity: str = ""
    cliente_id: str = ""
    payload_visible: dict = field(default_factory=dict)


CAPTURA = Capturado()


# --------------------------------------------------------------------------------------
# La costura candidata: un interceptor de worker.
# --------------------------------------------------------------------------------------
class _Inbound(ActivityInboundInterceptor):
    async def execute_activity(self, input: ExecuteActivityInput) -> Any:
        try:
            return await self.next.execute_activity(input)
        except Exception as exc:
            info = activity.info()
            # El payload de la activity: mismo shape que `execute_tool` (dict como 1er arg).
            payload = input.args[0] if input.args and isinstance(input.args[0], dict) else {}
            CAPTURA.hubo_excepcion = True
            CAPTURA.tipo = type(exc).__name__
            CAPTURA.mensaje = str(exc)
            CAPTURA.nombre_activity = info.activity_type
            CAPTURA.cliente_id = (payload.get("conv") or {}).get("cliente_id", "")
            CAPTURA.payload_visible = payload
            raise


class CapturaInterceptor(Interceptor):
    def intercept_activity(self, next: ActivityInboundInterceptor) -> ActivityInboundInterceptor:
        return _Inbound(next)


# --------------------------------------------------------------------------------------
# Sujeto de prueba: una activity que revienta, con el shape real de execute_tool.
# --------------------------------------------------------------------------------------
@activity.defn(name="execute_tool")
async def execute_tool_que_falla(payload: dict) -> dict:
    raise RuntimeError("fallo simulado del executor")


@workflow.defn(name="SpikeS1Workflow")
class SpikeS1Workflow:
    @workflow.run
    async def run(self, payload: dict) -> str:
        try:
            await workflow.execute_activity(
                "execute_tool",
                payload,
                start_to_close_timeout=timedelta(seconds=10),
                # 1 solo intento: el spike mide la captura, no el retry.
                retry_policy=RetryPolicy(maximum_attempts=1),
            )
        except Exception as exc:  # noqa: BLE001 — el workflow no es el sujeto de prueba
            return f"activity fallo como se esperaba: {type(exc).__name__}"
        return "LA ACTIVITY NO FALLO — el spike no midio nada"


async def main() -> int:
    client = await Client.connect("127.0.0.1:7233")
    payload = {
        "domain": "copiloto",
        "name": "registrar_gasto",
        "arguments": {"monto": 500},
        "conv": {"cliente_id": "11111111-1111-1111-1111-111111111111", "session_id": "spike-s1"},
        "idem_key": "spike-s1-key",
    }

    async with Worker(
        client,
        task_queue=TASK_QUEUE,
        workflows=[SpikeS1Workflow],
        activities=[execute_tool_que_falla],
        interceptors=[CapturaInterceptor()],
    ):
        resultado = await client.execute_workflow(
            SpikeS1Workflow.run,
            payload,
            id="spike-s1-run",
            task_queue=TASK_QUEUE,
        )

    print(f"[workflow] {resultado}")
    print()
    print("=== LO QUE EL INTERCEPTOR LOGRO VER ===")
    print(f"  hubo_excepcion   : {CAPTURA.hubo_excepcion}")
    print(f"  tipo             : {CAPTURA.tipo!r}")
    print(f"  mensaje          : {CAPTURA.mensaje!r}")
    print(f"  nombre_activity  : {CAPTURA.nombre_activity!r}")
    print(f"  cliente_id       : {CAPTURA.cliente_id!r}")
    print(f"  claves del payload: {sorted(CAPTURA.payload_visible)}")
    print()

    # ⚠️ El control que separa "midio" de "parecio medir": si la activity nunca falló, el
    # interceptor no tenía nada que capturar y un veredicto de FALLA sería falso.
    if not CAPTURA.hubo_excepcion:
        print("VEREDICTO INVALIDO: la activity no llego a fallar, no se midio nada.")
        return 2

    faltan = [n for n, v in (("excepcion", CAPTURA.tipo),
                             ("nombre_activity", CAPTURA.nombre_activity),
                             ("cliente_id", CAPTURA.cliente_id)) if not v]
    if faltan:
        print(f"S1 FALLA: el interceptor NO entrega {faltan}. La costura C3 no alcanza.")
        return 1
    print("S1 PASA: el interceptor entrega excepcion + activity + cliente_id.")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(asyncio.run(main()))
    except Exception:
        traceback.print_exc()
        sys.exit(3)
