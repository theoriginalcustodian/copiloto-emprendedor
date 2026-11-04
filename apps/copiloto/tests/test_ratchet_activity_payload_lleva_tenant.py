"""RATCH-TENANT-ACTIVITY — toda activity que el workflow agenda debe llevar el tenant en su payload.

Origen: contrato `manejo-de-errores` 2026-11-03. El interceptor de errores (`interceptor_errores.py`)
saca el `cliente_id` del PAYLOAD de la activity; sin él, `depositar` devuelve `False` en silencio
(`deposito_traumas.py:63`) y el error queda logueado pero SIN fila en la DLQ ni tenant para el RLS.
Es un fallo hacia el «no» sin síntoma: ningún test de la DLQ se pone rojo porque la activity nueva
simplemente no deposita.

Qué hace: recorre por AST cada `workflow.execute_activity(<nombre>, <payload literal>)` de
`conversation_workflow.py` y exige que el payload tenga `cliente_id`, o `conv`/`ctx` (las rutas que
`_RUTAS_CLIENTE_ID` sabe leer). Las excepciones son EXPLÍCITAS y con motivo; una excepción que ya no
corresponde (la activity ahora sí lleva tenant, o dejó de existir) también rompe: la lista no se pudre.

Corre en la PC: no importa `temporalio`, sólo `ast`.
"""
from __future__ import annotations

import ast
from pathlib import Path

import pytest

_WORKFLOW = Path(__file__).resolve().parents[3] / "motor" / "backend" / "agent" / "conversation_workflow.py"

#: Claves del payload que `interceptor_errores._RUTAS_CLIENTE_ID` sabe resolver a un tenant.
_CLAVES_TENANT = {"cliente_id", "conv", "ctx"}

#: activity -> motivo. Hoy: `transcribe_voice` sólo se agenda para `kind="needs_stt"`, que produce
#: únicamente el canal Telegram (`motor/clients/agent/channels/telegram.py`); la web usa `/chat/audio`
#: con errores HTTP visibles. Si el copiloto empieza a rutear voz por el workflow, esto deja de valer.
_SIN_TENANT_CON_MOTIVO = {
    "transcribe_voice": "sólo kind=needs_stt (canal Telegram); la web transcribe en /chat/audio",
}


def _llamadas(fuente: str) -> list[tuple[str, int, bool]]:
    """[(nombre_activity, linea, tiene_tenant)] para cada `execute_activity(<str literal>, <dict literal>)`.

    Un payload que NO es un dict literal se reporta como sin tenant: no se puede AFIRMAR que lo tenga,
    y afirmar lo que no se midió es la falla que este ratchet existe para evitar."""
    salida = []
    for nodo in ast.walk(ast.parse(fuente)):
        if not (isinstance(nodo, ast.Call) and ast.unparse(nodo.func).endswith("execute_activity")):
            continue
        if not nodo.args or not isinstance(nodo.args[0], ast.Constant):
            salida.append((ast.unparse(nodo.args[0]) if nodo.args else "?", nodo.lineno, False))
            continue
        payload = nodo.args[1] if len(nodo.args) > 1 else None
        claves = set()
        if isinstance(payload, ast.Dict):
            claves = {k.value for k in payload.keys if isinstance(k, ast.Constant)}
        salida.append((nodo.args[0].value, nodo.lineno, bool(claves & _CLAVES_TENANT)))
    return salida


def _sin_tenant(fuente: str) -> set[str]:
    return {nombre for nombre, _, ok in _llamadas(fuente) if not ok}


def test_toda_activity_del_workflow_lleva_tenant_salvo_las_declaradas_con_motivo():
    nuevas = _sin_tenant(_WORKFLOW.read_text(encoding="utf-8")) - set(_SIN_TENANT_CON_MOTIVO)
    assert not nuevas, (
        f"activities agendadas SIN tenant en el payload: {sorted(nuevas)}. Sin `cliente_id`/`conv`/`ctx` "
        f"el interceptor no puede depositar en la DLQ (deposito_traumas.py:63 devuelve False en silencio). "
        f"Agregá el tenant al payload, o declará la excepción con motivo en _SIN_TENANT_CON_MOTIVO."
    )


def test_ninguna_excepcion_declarada_esta_podrida():
    reales = _sin_tenant(_WORKFLOW.read_text(encoding="utf-8"))
    podridas = set(_SIN_TENANT_CON_MOTIVO) - reales
    assert not podridas, (
        f"excepciones declaradas que ya no corresponden (la activity ahora lleva tenant o no se agenda): "
        f"{sorted(podridas)} — borralas de _SIN_TENANT_CON_MOTIVO."
    )


def test_el_ratchet_mide_algo_no_pasa_en_vacio():
    # Control de ceguera: si el AST no encuentra llamadas, los dos tests de arriba pasan solos.
    assert len(_llamadas(_WORKFLOW.read_text(encoding="utf-8"))) >= 10


@pytest.mark.parametrize("payload, esperado_sin_tenant", [
    ('{"domain": "d"}', True),                         # CONTROL POSITIVO: debe ser rechazado
    ('{"domain": "d", "cliente_id": cid}', False),
    ('{"domain": "d", "conv": conv}', False),
    ("payload_armado_afuera", True),                   # no literal: no se puede afirmar -> sin tenant
])
def test_control_positivo_el_detector_rechaza_el_payload_sin_tenant(payload, esperado_sin_tenant):
    fuente = f"async def f():\n    await workflow.execute_activity('x', {payload})\n"
    assert (_sin_tenant(fuente) == {"x"}) is esperado_sin_tenant
