"""Gate genérico de replay-safety para TODO workflow de Temporal del repo (D4, deuda 2026-08-12).

Por qué esto además de los tests ad-hoc por-patch (`test_afip_factura_replay.py`,
`../../motor/backend/agent/test_narra_guardrail_retiro_replay.py`): esos protegen la ejecución en
vuelo que el AUTOR DEL PATCH tuvo en mente al escribirlos -- exigen que alguien ya supiera que hacía
falta un `workflow.patched(...)` y se acordara de agregar el test. Este archivo protege lo contrario:
un cambio de Command sequence en un workflow SIN `patched()`, hecho por alguien que no sabía que había
ejecuciones reales en vuelo. La cobertura acá NO es opcional ni se puede saltear en silencio --
`test_todo_workflow_de_produccion_tiene_fixture_o_esta_en_la_allowlist_con_motivo` escanea el repo por
`@workflow.defn` y falla si aparece un workflow nuevo que nadie clasificó todavía. Es la misma
protección que le faltó al CI hasta el 2026-08-06 (ADR-001 §2: una lista de archivos hardcodeada que
se desactualizó en silencio) aplicada acá para no repetir el mismo agujero con workflows.

Cobertura real hoy: 2 de 9 tipos de workflow de producción tienen fixture (`ConversationWorkflow`,
`FacturaWorkflow` -- los dos de mayor riesgo: el ReAct loop de cada turno de chat y el HITL de AFIP).
Los otros 7 están en `SIN_FIXTURE_TODAVIA` con motivo explícito -- decisión visible, no olvido. Ver
`docs/copiloto-emprendedor/adr/2026-08-13_ADR-003_gate-de-replay-para-workflows-sin-patch.md`.

Limitación honesta (documentada también en el ADR): un replay sólo detecta divergencia en el TRAMO
de historia que el fixture ejercitó. Un cambio en una rama que ningún fixture guardado atraviesa
(un tool nuevo, un branch de error que las 2 conversaciones capturadas no tomaron) no se detecta acá.
Esto reduce falsos positivos de un patch bien hecho, pero también implica falsos negativos reales --
no es cobertura exhaustiva, es una red con agujeros conocidos y documentados.
"""
from __future__ import annotations

import json
import re
import uuid
from importlib import import_module
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[3]

# --- manifest: fixture (relativo a REPO_ROOT) -> (módulo de import, nombre de la clase) -----------
# El import es lazy (adentro del test), pero el mapeo vive acá porque ES el contrato: qué fixture
# verifica qué workflow.
FIXTURES: dict[str, tuple[str, str]] = {
    "apps/copiloto/tests/fixtures/history_factura_en_vuelo.json": (
        "afip_factura_workflow", "FacturaWorkflow"),
    "motor/backend/agent/fixtures/history_conv_en_vuelo_con_narra_guardrail.json": (
        "backend.agent.conversation_workflow", "ConversationWorkflow"),
}

# Workflows de producción sin fixture todavía. Decisión visible (D4, 2026-08-13), no un olvido.
# Sacar una entrada de acá exige agregar su fixture a FIXTURES en el MISMO cambio -- si no, el test
# de abajo la vuelve a marcar como sin clasificar.
SIN_FIXTURE_TODAVIA: dict[str, str] = {
    "AnulacionWorkflow": "un solo tramo (cargar+anular), sin HITL de espera larga -- menor superficie "
        "de Command sequence que Factura/Conversation",
    "AfipOnboardingWorkflow": "de una sola vez por tenant, volumen bajo, se corre a demanda",
    "AutosanacionWorkflow": "global, sin HITL ni ramas por tool-call -- superficie chica",
    "GrafoSyncWorkflow": "idempotente por diseño (BETA-G0); un patch roto se autocorrige en el "
        "próximo tick de 15 min, no queda una ejecución colgada esperando",
    "MiDiaDetectorWorkflow": "schedule read-only, sin mutación ni HITL",
    "SoporteFeedbackWorkflow": "volumen bajo, sin HITL",
    "MpRefreshWorkflow": "corto, sin HITL",
}

_WORKFLOW_DIRS = ("apps/copiloto", "motor")
_DEFN_RE = re.compile(r"@workflow\.defn(?:\([^)]*\))?\s*\nclass\s+(\w+)")


def _workflows_declarados_en_el_repo() -> dict[str, Path]:
    """class_name -> archivo, para todo `@workflow.defn` bajo apps/copiloto/ y motor/ (producción;
    excluye tests/fixtures/__pycache__)."""
    hallados: dict[str, Path] = {}
    for base in _WORKFLOW_DIRS:
        raiz = REPO_ROOT / base
        for py in raiz.rglob("*.py"):
            partes = py.relative_to(raiz).parts
            if py.name.startswith("test_"):
                continue
            if any(p in ("tests", "fixtures", "__pycache__") for p in partes):
                continue
            texto = py.read_text(encoding="utf-8")
            for m in _DEFN_RE.finditer(texto):
                hallados[m.group(1)] = py
    return hallados


def test_todo_workflow_de_produccion_tiene_fixture_o_esta_en_la_allowlist_con_motivo():
    cubiertos = {clase for _, clase in FIXTURES.values()}
    declarados = _workflows_declarados_en_el_repo()

    sin_clasificar = [
        f"{clase} ({archivo.relative_to(REPO_ROOT)})"
        for clase, archivo in declarados.items()
        if clase not in cubiertos and clase not in SIN_FIXTURE_TODAVIA
    ]
    assert not sin_clasificar, (
        "Workflow(s) de producción sin decisión de replay-gate: " + ", ".join(sin_clasificar) + ". "
        "Agregalo a FIXTURES (con un fixture real: `temporal workflow show --output json`) o a "
        "SIN_FIXTURE_TODAVIA con el motivo -- no lo dejes sin clasificar."
    )


def test_la_allowlist_no_tiene_entradas_huerfanas():
    """Si una clase de SIN_FIXTURE_TODAVIA ya no existe (se renombró o se borró), la entrada vieja
    queda tapando el hueco -- el test de arriba ya no la ve como "sin clasificar" pero la clase nueva
    (con otro nombre) sí lo está, y este test es el único que lo detecta."""
    declarados = set(_workflows_declarados_en_el_repo())
    huerfanas = sorted(c for c in SIN_FIXTURE_TODAVIA if c not in declarados)
    assert not huerfanas, (
        f"SIN_FIXTURE_TODAVIA tiene clases que ya no existen en el repo: {huerfanas} -- si se "
        "renombraron, borrá la entrada vieja (la clase nueva, si corresponde, la va a pedir el otro test)."
    )


@pytest.mark.asyncio
@pytest.mark.parametrize("fixture_rel,destino", sorted(FIXTURES.items()))
async def test_el_replay_no_diverge_del_codigo_actual(fixture_rel, destino):
    from temporalio.client import WorkflowHistory
    from temporalio.worker import Replayer

    modulo, clase = destino
    historia = json.loads((REPO_ROOT / fixture_rel).read_text(encoding="utf-8"))
    workflow_cls = getattr(import_module(modulo), clase)

    replayer = Replayer(workflows=[workflow_cls])
    # Si el replay divergiera del history, esto levanta y el test falla -- no hay assert que agregar,
    # la ausencia de excepción ES la verificación (mismo patrón que los tests ad-hoc por-patch).
    await replayer.replay_workflow(WorkflowHistory.from_json(str(uuid.uuid4()), historia))
