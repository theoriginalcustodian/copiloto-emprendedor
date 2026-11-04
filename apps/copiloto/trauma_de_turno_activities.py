"""Costura C3 para los fallos que NACEN DENTRO del workflow (pedido_ manejo-de-errores, 2026-11-03).

`CapturaDeErroresInterceptor` sólo ve fallos de ACTIVITIES. Un `tool_call` malformado del LLM
(`tc["name"]` sin `name`) revienta en el código del workflow: el `except` de `run()` avisa al usuario
y la sesión sigue viva, pero la DLQ recibe CERO — la autosanación no se entera de un fallo que el
emprendedor sí vio. Los workflows no pueden escribir en la base (side effect), así que el `except`
agenda esta activity, que sí puede y reusa el mismo `log_error` + `depositar` del interceptor.

**Nunca lanza**: corre dentro del manejo de un error, y fallar registrando no puede costar más que el
error que se registra (regla 2 de `interceptor_errores`).
"""
from __future__ import annotations

from typing import Any

from temporalio import activity

from deposito_traumas import FabricaDeTraumas, depositar
from fingerprint import fingerprint_de_error
from log_estructurado import log_error

COSTURA = "workflow_turno"

_fabrica: FabricaDeTraumas | None = None


def set_trauma_de_turno_deps(fabrica: FabricaDeTraumas | None) -> None:
    """Cableado desde `build_worker_config`, igual que el resto de las `set_*_deps`."""
    global _fabrica
    _fabrica = fabrica


def _ya_lo_deposito_el_interceptor(payload: dict[str, Any], cliente_id: str | None) -> bool:
    """SM-N53: un `ActivityError` del turno que el interceptor YA depositó no se deposita de nuevo.

    Marca positiva, no lista de tipos a ignorar: se saltea sólo si hay una fila del interceptor para
    ese (workflow_id, activity_id). `NotFoundError` (activity no registrada) y `start_to_close` vencido
    nunca pasaron por el interceptor, no tienen fila, y se depositan. Si no se pudo mirar → se deposita.
    """
    wf, act = payload.get("workflow_id"), payload.get("activity_id")
    if not (wf and act and cliente_id and _fabrica is not None):
        return False
    try:
        store = _fabrica(cliente_id)
        return bool(store is not None
                    and store.ya_deposito_la_activity(workflow_id=wf, activity_id=act) is True)
    except Exception:  # noqa: BLE001
        return False


@activity.defn
async def registrar_trauma_de_turno(payload: dict[str, Any]) -> bool:
    """Registra en el log y deposita en la DLQ el fallo de UN turno. Devuelve si depositó."""
    try:
        cliente_id = payload.get("cliente_id") or None
        if _ya_lo_deposito_el_interceptor(payload, cliente_id):
            return False
        nodo = str(payload.get("nodo") or "turno")
        error_type = str(payload.get("error_type") or "Exception")
        mensaje = str(payload.get("error_message") or "")
        # La directiva global pide (workflow + nodo + error_type + payload_shape): el nodo y la forma
        # del payload entran en la "workflow" del fingerprint para que dos nodos distintos que fallan
        # con el mismo mensaje no se fundan en una sola fila.
        forma = str(payload.get("payload_shape") or "")
        workflow_id = f"ConversationWorkflow:{nodo}:{forma}"
        fingerprint = fingerprint_de_error(workflow=workflow_id, error_type=error_type,
                                           error_message=mensaje)
        log_error(RuntimeError(f"{error_type}: {mensaje}"), workflow=workflow_id,
                  cliente_id=cliente_id,
                  extra={"categoria": "SIN_CATEGORIA", "costura": COSTURA, "nodo": nodo,
                         "payload_shape": forma})
        return bool(depositar(
            _fabrica, fingerprint=fingerprint, workflow=workflow_id, error_type=error_type,
            cliente_id=cliente_id, costura=COSTURA,
            contexto={"categoria": "SIN_CATEGORIA", "nodo": nodo, "payload_shape": forma,
                      "workflow_id": payload.get("workflow_id")}))
    except Exception:  # noqa: BLE001
        return False
