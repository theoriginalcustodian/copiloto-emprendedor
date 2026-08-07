"""Activities de BETA-4a — clasifica feedback (`copiloto_feedback`, BETA-1a) y engancha al ciclo de
auto-reparación existente (Fase 3) cuando `origen` resuelve con confianza.

**No duplica nada del ciclo de reparación** (regla REUTILIZAR): esto sólo decide `origen | None` vía
`soporte_clasificador.SoporteClasificador` y, si hay `origen`, deposita un trauma con
`TraumaStore.depositar` — el MISMO mecanismo que usa `interceptor_errores.py`/`deposito_traumas.py`.
De ahí en más el trauma sigue el camino de siempre: `AutosanacionWorkflow` (Schedule
`autosanacion-global`) lo toma, lo audita, lo prueba y propone el PR. Si no hay `origen`, el ticket
queda visible para revisión humana (Decisión 2 del contrato) — nunca toca el forjador.

## Por qué NO hay tabla de estado nueva (decisión deliberada, no descuido)

`copiloto_feedback` no tiene columna de "procesado" y esto NO le agrega una (es la tabla de backend,
`FeedbackStore` — fuera de mi scope tocar su schema). `depositar()` es idempotente en
`(cliente_id, fingerprint)`, así que reprocesar un ticket YA encolado es gratis (sólo suma
`dedupe_count`). Reprocesar un ticket `necesita_humano` repite la consulta a graphity-code — al
volumen de BETA (10-15 testers) es ruido, no un problema real. **TODO (visible, no impago):** si el
volumen crece, la marca de "ya visto" vive mejor en una columna de `copiloto_feedback` — decisión de
backend, dueño de la tabla — o en un índice propio acá. No se construye hasta que el volumen lo pida
(cero sobreingeniería).
"""
from __future__ import annotations

from typing import Any, Callable

from temporalio import activity

from contexto_tenant import conexion_con_tenant, tenant
from soporte_clasificador import SoporteClasificador, respuesta_para_necesita_humano
from trauma_store import TraumaStore

#: `conn_factory` COMPARTIDO (bare, `() -> conn`) — el MISMO que usa el resto del ciclo (regla 7:
#: nunca una conexión nueva por feature). El tenant se declara por-llamada con `contexto_tenant.tenant`
#: + `conexion_con_tenant`, calcando `grafo_sync_activities.sincronizar_tenant` (no hay costura que lo
#: haga sola para activities — a diferencia de HTTP, donde `auth.py::require_tenant` lo hace en el
#: borde). Se setea en el composition root del worker.
_conn_factory: Callable | None = None
_clasificador: SoporteClasificador | None = None

#: Cuántas filas recientes de feedback mira cada corrida — ver el docstring del módulo (sin tabla de
#: estado, se re-mira una ventana chica en vez de "todo lo no marcado").
VENTANA_FEEDBACK = 20


def set_soporte_feedback_deps(conn_factory: Callable,
                              clasificador: SoporteClasificador | None = None) -> None:
    global _conn_factory, _clasificador
    _conn_factory = conn_factory
    _clasificador = clasificador  # None por default: se construye lazy desde env (from_env) al usarse


def _clasificador_activo() -> SoporteClasificador | None:
    global _clasificador
    if _clasificador is not None:
        return _clasificador
    try:
        _clasificador = SoporteClasificador.from_env()
    except RuntimeError:
        return None  # sin credenciales del grafo de código: el ciclo degrada a necesita_humano siempre
    return _clasificador


def clasificar_y_depositar(*, texto: str, cliente_id: str | None, fingerprint: str, workflow: str,
                           error_type: str, costura: str, contexto_extra: dict) -> dict[str, Any]:
    """Núcleo SÍNCRONO reusado por `clasificar_y_encolar_feedback` (activity async, BETA-4a) y por
    `soporte_agent_tools._run_crear_ticket` (SOP4, D1) -- éste corre dentro de un `tool_executor`
    síncrono (invocado vía `asyncio.to_thread` por `execute_tool`, no puede `await` una activity).
    `fingerprint` distingue el ORIGEN (feedback vs ticket de soporte) para no colisionar dedupe entre
    los dos sistemas -- son dos entradas al mismo `TraumaStore`, nunca el mismo trauma."""
    texto = (texto or "").strip()
    clasificador = _clasificador_activo()
    origen = clasificador.resolver_origen(texto) if (clasificador and texto) else None

    if origen is None:
        return {"resultado": "necesita_humano", "respuesta": respuesta_para_necesita_humano(texto)}

    if _conn_factory is None:
        # Sin conexión configurada no se puede depositar — degrada a necesita_humano en vez de
        # perder el ticket en silencio (mismo fail-safe que un origen no resuelto).
        return {"resultado": "necesita_humano", "respuesta": respuesta_para_necesita_humano(texto),
                "motivo": "sin conexión de tenant configurada"}

    # `tenant(cid)` + `conexion_con_tenant` por-llamada — mismo patrón que
    # `grafo_sync_activities.sincronizar_tenant`, no una costura automática (no existe para activities).
    with tenant(cliente_id):
        conn_tenant = conexion_con_tenant(_conn_factory)
        resultado_deposito = TraumaStore(conn_tenant, cliente_id).depositar(
            fingerprint=fingerprint, workflow=workflow, error_type=error_type, costura=costura,
            contexto={**contexto_extra, "origen": origen})
    if resultado_deposito is None:
        return {"resultado": "necesita_humano", "respuesta": respuesta_para_necesita_humano(texto),
                "motivo": "no se pudo depositar el trauma"}

    return {"resultado": "encolado_para_reparacion", "origen": origen,
            "dedupe_count": resultado_deposito["dedupe_count"]}


@activity.defn
async def clasificar_y_encolar_feedback(feedback: dict[str, Any]) -> dict[str, Any]:
    """Un ticket → `{"resultado": "encolado_para_reparacion", "origen": {...}}` o
    `{"resultado": "necesita_humano", "respuesta": "..."}`. Nunca lanza por un ticket individual —
    fail-closed hacia `necesita_humano` (mismo criterio que un match ambiguo, ver
    `SoporteClasificador.resolver_origen`)."""
    texto = (feedback.get("texto") or "").strip()
    cid = feedback.get("cliente_id")
    fid = feedback.get("id")
    r = clasificar_y_depositar(
        texto=texto, cliente_id=cid, fingerprint=f"feedback:{fid}", workflow="soporte_feedback",
        error_type="TicketDeSoporte", costura="feedback_intake",
        contexto_extra={"categoria": "business_error", "sintoma_no_tecnico": texto, "feedback_id": fid})
    return {**r, "feedback_id": fid}


@activity.defn
async def procesar_feedback_pendiente_de_tenant(cliente_id: str) -> dict[str, Any]:
    """Lee la ventana reciente de `copiloto_feedback` de UN tenant (conexión con RLS normal — sin
    BYPASSRLS: a diferencia de la DLQ, no hace falta ver todos los tenants a la vez para clasificar
    cada ticket, así que no se pide el privilegio de más) y clasifica cada fila.

    Un Schedule POR TENANT (como `mi-dia-{cliente_id}`), no uno global: la clasificación es
    independiente por ticket, no hay "el peor ticket de todos" que justifique una cola cross-tenant
    como en autosanación."""
    if _conn_factory is None:
        return {"procesados": 0, "motivo": "sin conexión de tenant configurada"}

    with tenant(cliente_id):
        conn = conexion_con_tenant(_conn_factory)()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, cliente_id::text, tipo, texto, contexto FROM uc_factory.copiloto_feedback "
                "WHERE cliente_id = %s ORDER BY created_at DESC LIMIT %s",
                (cliente_id, VENTANA_FEEDBACK))
            cols = [d[0] for d in cur.description]
            filas = [dict(zip(cols, fila)) for fila in cur.fetchall()]
    finally:
        conn.close()

    resultados = [await clasificar_y_encolar_feedback(fila) for fila in filas]
    encolados = sum(1 for r in resultados if r["resultado"] == "encolado_para_reparacion")
    return {"procesados": len(resultados), "encolados_para_reparacion": encolados,
            "necesita_humano": len(resultados) - encolados}
