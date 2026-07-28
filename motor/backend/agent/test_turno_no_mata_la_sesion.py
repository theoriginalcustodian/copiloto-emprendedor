"""Un turno que revienta dejaba muerta la sesión PERMANENTE, en silencio.

`ConversationWorkflow` es la sesión permanente del emprendedor (continue-as-new). Si una excepción
salía del cuerpo del turno, salía de `run()`: el workflow quedaba `Failed` y el chat pasaba a aceptar
todo lo que la persona escribía sin contestar nunca. Sin error visible, sin card, sin nada que mirar
— el fallo sólo aparecía en el journal del worker.

Ya ocurrió: un `429 insufficient_quota` del LLM tumbó una conversación y el síntoma fue exactamente
ese (`agente-no-responde-revisar-cuota-llm`).

Un fallo de UN turno tiene que ser un fallo de ESE turno.
"""
from __future__ import annotations

import pytest
from temporalio import activity
from temporalio.exceptions import ApplicationError
from temporalio.testing import WorkflowEnvironment
from temporalio.worker import Worker

from backend.agent.conversation_workflow import ConversationWorkflow
from backend.agent.types import DispatchResult


def _cfg(**extra) -> dict:
    return {"domain": "d", "channel": "web", "channel_ref": "s1", "cliente_id": "c1", **extra}


def _activities(fallar_las_primeras: int, enviados: list, llamadas: list):
    """`call_llm` falla las N primeras veces y después funciona.

    Dos cosas que este helper aprendió a los golpes:
    · **No contar intentos, contar fallos.** `LOOP_RETRY` reintenta, así que "falla la llamada nº1"
      dejaba pasar el turno en el intento nº2 y el test medía otra cosa. Por eso `non_retryable`:
      el turno muere en el primer intento, que es el caso real (un `429 insufficient_quota` no mejora
      reintentando).
    · **No discriminar por el texto del usuario.** El payload arrastra el `history`, así que el turno
      2 también contiene el mensaje del turno 1 y fallaban los dos.
    """
    restantes = {"n": fallar_las_primeras}

    @activity.defn(name="call_llm")
    async def call_llm(p):
        llamadas.append(p)
        if restantes["n"] > 0:
            restantes["n"] -= 1
            raise ApplicationError("429 insufficient_quota", non_retryable=True)
        return {"parsed": {"action": "clarify", "reply_es": "ok"}, "raw": ""}

    @activity.defn(name="call_llm_tools")
    async def call_llm_tools(p):
        return {"tool_calls": [], "content": "x"}

    @activity.defn(name="dispatch_intent")
    async def dispatch_intent(p):
        return DispatchResult(reply_text="respuesta real", done=False).to_dict()

    @activity.defn(name="send_channel_message")
    async def send_channel_message(p):
        enviados.append(p["text"])
        return {"sent": True}

    return [call_llm, call_llm_tools, dispatch_intent, send_channel_message]


@pytest.mark.asyncio
async def test_un_turno_que_revienta_no_mata_la_sesion_y_el_usuario_se_entera():
    """EL TEST QUE IMPORTA. Mide el daño real: ¿la sesión sigue viva y la persona sabe que ese
    mensaje no salió? El segundo turno tiene que contestar normal."""
    enviados: list = []
    llamadas: list = []

    async with await WorkflowEnvironment.start_time_skipping() as env:
        async with Worker(env.client, task_queue="q-roto", workflows=[ConversationWorkflow],
                          activities=_activities(1, enviados, llamadas)):
            h = await env.client.start_workflow(ConversationWorkflow.run, _cfg(),
                                                id="wf-roto", task_queue="q-roto")
            await h.signal(ConversationWorkflow.receive_message, {"text": "hola", "kind": "text"})
            await h.signal(ConversationWorkflow.receive_message, {"text": "segunda", "kind": "text"})
            await h.signal(ConversationWorkflow.close)
            resultado = await h.result()          # si el workflow muriera, esto levantaría

    assert len(enviados) == 2, f"la sesión murió en el primer turno: {enviados}"
    assert "trabó" in enviados[0], "el turno fallido no le avisó nada a la persona"
    assert enviados[1] == "respuesta real", "el turno siguiente tenía que contestar normal"
    assert resultado["turns"] == 2


@pytest.mark.asyncio
async def test_control_sin_fallos_no_aparece_ningun_aviso():
    """Control diferencial: si el aviso saliera siempre, el test de arriba pasaría igual con el bug
    puesto — y el emprendedor vería una disculpa en cada turno que funcionó perfecto."""
    enviados: list = []
    llamadas: list = []

    async with await WorkflowEnvironment.start_time_skipping() as env:
        async with Worker(env.client, task_queue="q-ok", workflows=[ConversationWorkflow],
                          activities=_activities(0, enviados, llamadas)):
            h = await env.client.start_workflow(ConversationWorkflow.run, _cfg(),
                                                id="wf-ok", task_queue="q-ok")
            await h.signal(ConversationWorkflow.receive_message, {"text": "hola", "kind": "text"})
            await h.signal(ConversationWorkflow.close)
            await h.result()

    assert enviados == ["respuesta real"]


@pytest.mark.asyncio
async def test_si_tampoco_se_puede_avisar_la_sesion_igual_sobrevive():
    """El aviso es best-effort. Quedarse sin canal no puede ser motivo para matar la sesión — que es
    exactamente lo que este bloque vino a evitar."""
    llamadas: list = []

    @activity.defn(name="call_llm")
    async def call_llm(p):
        llamadas.append(1)
        raise ApplicationError("429 insufficient_quota", non_retryable=True)

    @activity.defn(name="dispatch_intent")
    async def dispatch_intent(p):
        return DispatchResult(reply_text="x", done=False).to_dict()

    @activity.defn(name="send_channel_message")
    async def send_channel_message(p):
        raise ApplicationError("el canal tampoco responde", non_retryable=True)

    async with await WorkflowEnvironment.start_time_skipping() as env:
        async with Worker(env.client, task_queue="q-mudo", workflows=[ConversationWorkflow],
                          activities=[call_llm, dispatch_intent, send_channel_message]):
            h = await env.client.start_workflow(ConversationWorkflow.run, _cfg(),
                                                id="wf-mudo", task_queue="q-mudo")
            await h.signal(ConversationWorkflow.receive_message, {"text": "hola", "kind": "text"})
            await h.signal(ConversationWorkflow.close)
            resultado = await h.result()

    assert resultado["turns"] == 1, "la sesión murió cuando falló el aviso"


@pytest.mark.asyncio
async def test_el_modo_react_tambien_queda_cubierto():
    """El `try` envuelve al despachador, no a un motor: los dos modos (dispatch y react) pasan por el
    mismo camino. Si alguien lo duplicara por motor, esto se pondría rojo."""
    enviados: list = []

    @activity.defn(name="call_llm_tools")
    async def call_llm_tools(p):
        raise ApplicationError("el LLM de tools se cayó", non_retryable=True)

    @activity.defn(name="send_channel_message")
    async def send_channel_message(p):
        enviados.append(p["text"])
        return {"sent": True}

    async with await WorkflowEnvironment.start_time_skipping() as env:
        async with Worker(env.client, task_queue="q-react", workflows=[ConversationWorkflow],
                          activities=[call_llm_tools, send_channel_message]):
            h = await env.client.start_workflow(ConversationWorkflow.run, _cfg(engine_mode="react"),
                                                id="wf-react", task_queue="q-react")
            await h.signal(ConversationWorkflow.receive_message, {"text": "hola", "kind": "text"})
            await h.signal(ConversationWorkflow.close)
            resultado = await h.result()

    assert resultado["turns"] == 1
    assert enviados and "trabó" in enviados[0]
