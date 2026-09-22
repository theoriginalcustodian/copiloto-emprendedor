"""H-A3-3 · Cuenta ejecuciones vivas por `TemporalChangeVersion`, sólo lectura, idempotente.

Por qué existe: `workflow.patched(id)` se memoiza POR RUN en el SDK (temporalio 1.28.0,
`_workflow_instance.py:1355-1369`) — un run que consultó un patch en replay ANTES de que existiera
el marker se queda con ese resultado (False) hasta el continue-as-new, aunque el código YA tenga el
fix. «El fix está desplegado» no es lo mismo que «el fix corre en cada sesión viva»: el alcance se
MIDE contra el server real, no se argumenta desde el código. Ver
memoria/patched-se-memoiza-por-run-un-fix-con-patch-no-llega-a-sesiones-vivas.md.

Uso (en el VPS, mismo venv que el worker — necesita `temporalio` instalado):
    python scripts/temporal_contar_por_change_version.py --marker gate-card-sobrevive-confirm

Conexión: mismas env vars que `serve.py`/`worker_b.py` (`TEMPORAL_TARGET` default
`localhost:7233`, `TEMPORAL_NAMESPACE` default `default`) — corriendo en el VPS apunta solo al
Temporal real sin nada que configurar.
"""
from __future__ import annotations

import argparse
import asyncio
import os

from temporalio.client import Client

TEMPORAL_TARGET = os.environ.get("TEMPORAL_TARGET", "localhost:7233")
TEMPORAL_NAMESPACE = os.environ.get("TEMPORAL_NAMESPACE", "default")


async def _contar(client: Client, query: str) -> int:
    return (await client.count_workflows(query)).count


async def contar_por_marker(client: Client, *, workflow_type: str, marker: str) -> dict:
    """Sólo lectura: 2 `count_workflows` (visibility), sin listar ni tocar ninguna ejecución."""
    base = f"WorkflowType='{workflow_type}' AND ExecutionStatus='Running'"
    total = await _contar(client, base)
    con_marker = await _contar(client, f"{base} AND TemporalChangeVersion='{marker}'")
    return {
        "workflow_type": workflow_type,
        "marker": marker,
        "running_total": total,
        "running_con_marker": con_marker,
        # candidatas: vivas que todavía no upertearon el marker -- si el patch ya se desplegó, son
        # las que corren con la memoización vieja hasta que roten de run (continue-as-new).
        "running_sin_marker": total - con_marker,
    }


async def _main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--marker", required=True, help="ID del patch, ej. gate-card-sobrevive-confirm")
    ap.add_argument("--workflow-type", default="ConversationWorkflow")
    args = ap.parse_args()

    client = await Client.connect(TEMPORAL_TARGET, namespace=TEMPORAL_NAMESPACE)
    r = await contar_por_marker(client, workflow_type=args.workflow_type, marker=args.marker)
    print(f"Temporal {TEMPORAL_TARGET}/{TEMPORAL_NAMESPACE} -- {r['workflow_type']} RUNNING")
    print(f"  total:                 {r['running_total']}")
    print(f"  con marker '{r['marker']}': {r['running_con_marker']}")
    print(f"  SIN marker (candidatas a memoización vieja): {r['running_sin_marker']}")


if __name__ == "__main__":
    asyncio.run(_main())
