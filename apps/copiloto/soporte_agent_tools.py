"""Toolset del agente de soporte técnico (SOP4, C1+C9+C10) -- domain 'soporte', engine_mode='react'.

Reusa TAL CUAL lo que ya existe (nada se re-implementa): `TicketStore` (SOP3), `TraumaStore` (BETA-4a),
`SoporteClasificador` (grafo de código, BETA-4a) y `OrquestadorRagClient` (SOP4). Este módulo sólo
envuelve esas piezas en el contrato `tool_schemas` + `tool_executor` que `register_domain` espera
(mismo patrón que `tool_catalog.py` del dominio 'emprendedor' -- no se inventa uno nuevo).

## C9+C10, el salto que las hace funcionar juntas (MAESTRO §10.2)

`buscar_mis_errores` NO le pasa la queja del usuario al grafo -- el spike del 2026-08-04 midió que la
búsqueda semántica sobre prosa de usuario devuelve resultados no relacionados. Primero busca el TRAUMA
del tenant (`workflow`/`error_type`/`costura`, vocabulario técnico), y sólo si hay uno reciente, usa
ESE vocabulario para citar archivo:línea. Sin trauma reciente, no hay grafo que consultar -- se
devuelve honesto, nunca una cita falsa con aire de certeza (control negativo obligatorio del DoD).
"""
from __future__ import annotations

from typing import Callable

from backend.agent.types import ToolResult

from soporte_feedback_activities import clasificar_y_depositar
from soporte_store import CANALES_VALIDOS, SOPORTE_TECNICO, TicketStore
from trauma_store import TraumaStore
from soporte_clasificador import SoporteClasificador

#: Ventana de "reciente" para C10 -- un trauma de hace semanas no es "esto está roto ahora".
_TRAUMAS_LIMITE = 5

CONSULTAR_KB_SCHEMA = {"type": "function", "function": {
    "name": "consultar_base_de_conocimiento",
    "description": "Busca la respuesta a una pregunta sobre CÓMO USAR LA APP o sobre un problema técnico "
                   "en la base de conocimiento del producto. SIEMPRE se usa antes de responder cualquier "
                   "pregunta del usuario -- nunca improvises con lo que ya sabés del modelo.",
    "parameters": {"type": "object", "properties": {
        "pregunta": {"type": "string", "description": "la pregunta del usuario, reformulada de forma clara y autocontenida"}},
        "required": ["pregunta"]}}}

BUSCAR_MIS_ERRORES_SCHEMA = {"type": "function", "function": {
    "name": "buscar_mis_errores",
    "description": "Busca si hay un ERROR TÉCNICO ya registrado en la cuenta del usuario (traumas del "
                   "tenant) y, si lo hay, dónde está en el código para poder citarlo al escalar. Usala "
                   "cuando el usuario describe un problema, algo que no funciona, o un error. NO le "
                   "pases tu propia interpretación del problema -- la tool ya busca con el vocabulario "
                   "técnico correcto.",
    "parameters": {"type": "object", "properties": {}, "required": []}}}

CREAR_TICKET_SCHEMA = {"type": "function", "function": {
    "name": "crear_ticket_de_soporte",
    "description": "Crea un ticket de soporte con código SOP-XXXX y escala a un humano. Usala SÓLO "
                   "cuando no podés sostener una respuesta con la base de conocimiento ni con los "
                   "errores de la cuenta -- nunca como primera opción.",
    "parameters": {"type": "object", "properties": {
        "canal": {"type": "string", "enum": list(CANALES_VALIDOS),
                  "description": "la función que el usuario eligió al abrir el chat"},
        "asunto": {"type": "string", "description": "resumen corto del problema, para listar el ticket"},
        "resumen_para_el_operador": {"type": "string",
                                     "description": "lo que el usuario contó, en sus palabras, con el "
                                                    "archivo/función citados si `buscar_mis_errores` los encontró"}},
        "required": ["canal", "asunto", "resumen_para_el_operador"]}}}

TOOL_SCHEMAS_SOPORTE = [CONSULTAR_KB_SCHEMA, BUSCAR_MIS_ERRORES_SCHEMA, CREAR_TICKET_SCHEMA]


def _run_consultar_kb(arguments: dict, idem_key: str, rag_client_factory: Callable) -> ToolResult:
    cliente = rag_client_factory()
    if cliente is None:
        # Apagado explícito (falta config de vault) -- mismo trato que UNAVAILABLE del contrato: el
        # agente lo dice y escala, nunca inventa un fallback (N1).
        return ToolResult(tool_call_id=idem_key, is_write=False, status="ok",
                          observation={"outcome": "unavailable",
                                       "reason": "orquestador_no_configurado"})
    pregunta = (arguments.get("pregunta") or "").strip()
    if not pregunta:
        return ToolResult(tool_call_id=idem_key, is_write=False, status="error",
                          observation={"error": "falta la pregunta"})
    r = cliente.answer(pregunta)
    obs = {"outcome": r.outcome}
    if r.outcome == "answered":
        obs["answer"] = r.answer
    elif r.outcome == "refused":
        obs["refusal_reason"] = r.refusal_reason
    else:
        obs["reason"] = r.reason
    return ToolResult(tool_call_id=idem_key, is_write=False, status="ok", observation=obs)


def _run_buscar_mis_errores(ctx, idem_key: str, trauma_store_factory: Callable,
                            graphity_code_client: SoporteClasificador | None) -> ToolResult:
    traumas = trauma_store_factory(ctx.cliente_id).listar(limite=_TRAUMAS_LIMITE)
    if not traumas:
        return ToolResult(tool_call_id=idem_key, is_write=False, status="ok",
                          observation={"traumas": [], "cita": None})

    cita = None
    if graphity_code_client is not None:
        # El MÁS RECIENTE primero (`listar` ya ordena así) -- el trauma que más probablemente
        # corresponde a "esto está roto ahora mismo" que menciona el usuario.
        for t in traumas:
            vocabulario = " ".join(filter(None, [t.get("workflow"), t.get("error_type"), t.get("costura")]))
            if not vocabulario.strip():
                continue
            origen = graphity_code_client.resolver_origen(vocabulario)
            if origen is not None:
                cita = {**origen, "trauma_id": t.get("id")}
                break
            # Sin match confiable en el grafo para ESTE trauma -- no se adivina (control negativo del
            # DoD C9): se sigue probando el siguiente trauma en vez de forzar una cita falsa.

    return ToolResult(
        tool_call_id=idem_key, is_write=False, status="ok",
        observation={
            "traumas": [{"workflow": t.get("workflow"), "error_type": t.get("error_type"),
                        "estado": t.get("estado"), "created_at": str(t.get("created_at"))}
                       for t in traumas],
            "cita": cita})


def _run_crear_ticket(arguments: dict, ctx, idem_key: str, ticket_store_factory: Callable) -> ToolResult:
    canal = arguments.get("canal")
    asunto = (arguments.get("asunto") or "").strip()
    resumen = (arguments.get("resumen_para_el_operador") or "").strip()
    if not asunto or not resumen:
        return ToolResult(tool_call_id=idem_key, is_write=True, status="error",
                          observation={"error": "faltan asunto o resumen_para_el_operador"})
    try:
        ticket = ticket_store_factory(ctx.cliente_id).crear_ticket(
            canal=canal, asunto=asunto, primer_mensaje=resumen, autor="agente")
    except ValueError as exc:
        return ToolResult(tool_call_id=idem_key, is_write=True, status="error",
                          observation={"error": str(exc)})

    obs = {"codigo": ticket["codigo"], "estado": ticket["estado"]}
    # D1: sólo falla TÉCNICA entra a la cola de autosanación -- "¿cómo cargo un gasto?" (como_uso_la_app)
    # no es un bug, y encolarlo gastaría presupuesto del forjador buscando uno que no existe (MAESTRO
    # §10.3.1). El usuario NO espera este paso (§10.3.2): ya tiene su código en `obs` diga lo que diga
    # `autosanacion` -- esto sólo AGREGA si ya hay reparación en curso, nunca bloquea la respuesta.
    if canal == SOPORTE_TECNICO:
        autosanacion = clasificar_y_depositar(
            texto=resumen, cliente_id=ctx.cliente_id, fingerprint=f"soporte_ticket:{ticket['id']}",
            workflow="soporte_agente", error_type="TicketDeSoporte", costura="chat_soporte_tecnico",
            contexto_extra={"categoria": "business_error", "ticket_codigo": ticket["codigo"],
                            "ticket_id": ticket["id"]})
        obs["autosanacion"] = autosanacion["resultado"]
    return ToolResult(tool_call_id=idem_key, is_write=True, status="ok", observation=obs)


def make_soporte_tool_executor(*, rag_client_factory: Callable, trauma_store_factory: Callable,
                               ticket_store_factory: Callable,
                               graphity_code_client: SoporteClasificador | None) -> Callable:
    """`(name, arguments, ctx, *, confirmed, idem_key) -> ToolResult` -- mismo contrato que
    `tool_catalog.make_tool_executor`. `confirmed` se ignora: ninguna tool de este domain abre el gate
    de confirmación (todas son lectura, o un write interno del flujo que el usuario nunca aprueba a
    mano -- crear un ticket no es cobrar plata)."""

    def tool_executor(name, arguments, ctx, *, confirmed, idem_key):  # noqa: ARG001 -- confirmed sin uso, ver docstring
        if ctx is None:
            raise ValueError("tool_executor de soporte requiere ctx (context_factory)")
        if name == "consultar_base_de_conocimiento":
            return _run_consultar_kb(arguments, idem_key, rag_client_factory)
        if name == "buscar_mis_errores":
            return _run_buscar_mis_errores(ctx, idem_key, trauma_store_factory, graphity_code_client)
        if name == "crear_ticket_de_soporte":
            return _run_crear_ticket(arguments, ctx, idem_key, ticket_store_factory)
        return ToolResult(tool_call_id=idem_key, status="error",
                          observation={"error": f"tool desconocida: {name}"})

    return tool_executor
