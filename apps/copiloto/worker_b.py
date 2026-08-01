"""Composition root + worker del Agente B (capa CLIENTE).

Registra el dominio 'emprendedor' (system prompt + LlmProvider gpt-4o-mini + dispatcher) y el canal 'web'
(WebChannelAdapter con reply_sink a uc_factory) en el registry del arquetipo, y corre un Worker Temporal
propio con task_queue 'agent-emprendedor'. Proceso SEPARADO del de A (el registry es singleton de módulo).

Multitenant real (Task 8 del plan 2026-07-03): NINGÚN `cliente_id`/`composio_user_id`/seller MP sale de env
— todo per-request vía `context_factory` (ver context_factory.py). El worker sirve N tenants sin fugas; el
`context_factory` arma un `TenantCtx` NUEVO por request desde `conv["cliente_id"]`. También registra
`MpRefreshWorkflow` (refresh durable del token de 180d) y cablea `set_refresh_deps` ANTES de que el worker
empiece a pollear (si no, `refresh_credential` hace `_store_factory(None)` -> TypeError)."""
from __future__ import annotations

import asyncio
import datetime
import os
import sys
from pathlib import Path
from typing import Callable, Mapping

from _paths import ensure_paths
ensure_paths()

from temporalio.client import Client
from temporalio.worker import Worker

from backend.agent.agent_activities import (
    call_llm, call_llm_tools, dispatch_intent, execute_tool, notify_staff, recall_memory,
    remember_memory, send_channel_message, warm_memory)
from backend.agent.agent_runtime import register_channel, register_domain
from backend.agent.conversation_workflow import ConversationWorkflow
from clients.agent.channels.web import WebChannelAdapter
from clients.agent.providers.composio_gateway import ComposioGateway
from clients.agent.providers.crypto import FernetCrypto
from clients.agent.providers.llm import LlmProvider
from clients.agent.providers.mercadopago_gateway import MercadoPagoGateway
from clients.agent.providers.mp_refresh_activities import refresh_credential, set_refresh_deps
from clients.agent.providers.mp_refresh_workflow import MpRefreshWorkflow

import services
import tool_catalog
from contexto_tenant import conexion_con_tenant
from deposito_traumas import fabrica_desde
from interceptor_errores import CapturaDeErroresInterceptor
from perfil_negocio_prompt import bloque_de_contexto
from perfil_negocio_store import PerfilNegocioStore
from afip_anulacion_workflow import AnulacionWorkflow
from autosanacion_activities import ACTIVITIES_AUTOSANACION, set_autosanacion_deps
from autosanacion_workflow import AutosanacionWorkflow
from afip_comprobante_store import AfipComprobanteStore
from afip_credential_store import AfipCredentialStore, AfipPerfilStore, AfipSecretHandoff
from afip_factura_activities import (
    archivar_factura_en_drive, buscar_comprobante, cargar_contexto_factura, emitir_comprobante,
    generar_pdf_comprobante, listar_comprobantes, marcar_comprobante_anulado,
    reservar_numero_comprobante, set_drive_deps, set_factura_deps)
from afip_factura_workflow import FacturaWorkflow
from afip_gateway import AfipGateway
# Hito 9: los MISMOS builders que `serve.py` usa para "Facturar" desde presupuesto — genéricos pese al
# nombre (el `factura_id` lo pone SIEMPRE el llamador, ver `web.make_abrir_borrador_de_presupuesto`).
# Reusarlos acá evita una segunda implementación del `id_conflict_policy=FAIL` que ya está probada.
from web import (make_abrir_borrador_de_presupuesto, make_buscar_borrador_dictado_abierto,
                 make_consultar_factura, make_signal_factura)
from cliente_store import ClienteStore
from mi_dia_schedule_activities import avanzar_tablero_mi_dia, set_mi_dia_deps
from mi_dia_schedule_workflow import MiDiaDetectorWorkflow
from mi_dia_tarjeta_store import TarjetaStore
from cobro_store import CobroStore
from presupuesto_store import PresupuestoStore
from afip_onboarding_activities import (
    dar_de_alta_afip, purgar_secretos_vencidos, set_onboarding_deps, verificar_habilitacion_afip)
from afip_onboarding_workflow import AfipOnboardingWorkflow
from calendar_policy import CALENDAR_POLICY
from context_factory import make_context_factory
from dispatcher_emprendedor import make_dispatcher
from mp_credential_store import MpCredentialStore
from mp_dedup_store import MpLinkDedupStore
from memory_provider import build_memory_provider
from reply_store import make_pg_reply_sink
from system_prompt import SYSTEM_PROMPT_REACT

AGENT_B_TASK_QUEUE = os.environ.get("AGENT_B_TASK_QUEUE", "agent-emprendedor")
OPENAI_API_KEY_ENV = "OPENAI_API_KEY"
# warm_memory/remember_memory SIEMPRE registradas (aunque memory_provider sea None → no-op): si el workflow
# emitiera la command y el worker no sirviera la activity, el turno colgaría hasta el timeout (no falla rápido).
# call_llm_tools/execute_tool/recall_memory: las 3 activities del motor ReAct (engine_mode="react", Task 14).
_ACTIVITIES = [call_llm, dispatch_intent, send_channel_message, notify_staff, warm_memory, remember_memory,
              call_llm_tools, execute_tool, recall_memory]


def _now_iso() -> str:
    return datetime.datetime.now(datetime.timezone.utc).astimezone().isoformat()


def build_llm() -> LlmProvider:
    return LlmProvider(primary_model="gpt-4o-mini", failover_model="gpt-4o-mini",
                       api_key_env=OPENAI_API_KEY_ENV, url="https://api.openai.com/v1/chat/completions",
                       quantizations=())


def _perfil_provider(conn_factory: Callable) -> Callable:
    """`(cliente_id) -> str` con el bloque de contexto del negocio, para el boundary `perfil_provider`.

    Corre DENTRO de una activity (nunca en el workflow): toca la base, que es I/O no determinístico.
    Devuelve `""` ante cualquier fallo — el perfil es contexto, no correctitud, y un problema de DB no
    puede dejar al emprendedor sin poder chatear."""
    def proveer(cliente_id: str) -> str:
        try:
            return bloque_de_contexto(PerfilNegocioStore(conn_factory, cliente_id).get())
        except Exception:  # noqa: BLE001
            return ""

    return proveer


def _conn_dlq_factory(env: Mapping[str, str]) -> Callable | None:
    """La fábrica de conexiones del ciclo de auto-reparación, o `None` si no está provisionada.

    **Cruda a propósito**: no se envuelve con `conexion_con_tenant` porque el ciclo es cross-tenant
    por diseño, y ese envoltorio cierra la conexión y propaga si no hay tenant que declarar.

    Se construye acá y no en el módulo de activities para que el composition root siga siendo el
    único lugar del worker que sabe de DSNs — el mismo criterio que `main()` con `DATABASE_URL`.
    """
    dsn = env.get("COPILOTO_AUTOSANACION_DSN")
    if not dsn:
        return None

    def factory():  # noqa: ANN202
        import psycopg2
        conn = psycopg2.connect(dsn)
        conn.autocommit = True
        return conn

    return factory


def build_worker_config(env: Mapping[str, str], conn_factory: Callable, client=None) -> dict:
    """Composition root PURO y multitenant real (Task 8): construye los recursos COMPARTIDOS una sola vez
    (crypto, mp_gateway, composio gateway) y arma el `context_factory` que resuelve TODO lo per-tenant
    (`cliente_id`, `composio_user_id`, seller MP) desde el `conv` de cada request — cero
    cliente_id/composio_user_id/seller de env (elimina `COPILOTO_CLIENTE_ID`/`COPILOTO_COMPOSIO_USER_ID`/
    `MP_SELLER_USER_ID`; `MP_WEBHOOK_BASE` sí sale de `env` por ser infra, no identidad de tenant).

    Registra el dominio 'emprendedor' con `context_factory` no-None (ctx SIEMPRE presente en prod;
    `dispatcher_emprendedor.make_dispatcher` es multitenant-only, sin fallback) y el canal 'web'. Cablea
    `set_refresh_deps` ANTES de devolver, para que `MpRefreshWorkflow`/`refresh_credential` puedan correr en
    cuanto el `Worker` arranque a pollear.

    No abre I/O real al construirse (`conn_factory` solo se guarda; recién se invoca cuando una query lo
    necesita) → testeable sin Temporal ni Postgres vivos. Devuelve {workflows, activities, context_factory}
    listos para `Worker(...)`.

    `client` (opcional, hito 9): el `temporal_client` para que `emitir_factura` pueda abrir/señalizar el
    `FacturaWorkflow` del dictado — mismos builders que `serve.py` usa para el camino de presupuesto
    (`make_abrir_borrador_de_presupuesto`/`make_consultar_factura`/`make_signal_factura`, genéricos pese
    al nombre: el `factura_id` lo pone el llamador). Sin `client` (tests, wiring puro) `emitir_factura`
    degrada con error de negocio — mismo criterio que `cobro_store_factory is None` en las demás tools de
    plata. `main()` conecta el client ANTES de llamar acá (antes se conectaba DESPUÉS, cuando ya era
    tarde para pasárselo al tool_executor)."""
    crypto = FernetCrypto()
    mp_gateway = MercadoPagoGateway()
    # policy = Calendar (verbo 'book') + policies mínimas de los módulos de servicio (discovery)
    gateway = ComposioGateway({**CALENDAR_POLICY, **services.merged_policy()})

    # Memoria de largo plazo (Graphity): se construye desde el `env` PARAM (no os.environ) → testeable con
    # env={} (queda None = sin memoria, el wiring test no necesita Graphity). En prod, copiloto.env aporta
    # GRAPHITY_BASE_URL/API_KEY. Si faltan → OFF EXPLÍCITO (se loguea; no un cliente mudo silencioso).
    memory_provider = build_memory_provider(env)   # fuente única de construcción (compartida con serve.py/`/warm`)
    print("AGENT_B memoria: ON (Graphity)" if memory_provider is not None
          else "AGENT_B memoria: OFF (faltan GRAPHITY_BASE_URL/API_KEY en el env)", flush=True)

    ctx_factory = make_context_factory(conn_factory=conn_factory, crypto=crypto, mp_gateway=mp_gateway,
                                       mp_webhook_base=env.get("MP_WEBHOOK_BASE"),
                                       memory_provider=memory_provider)
    reply_sink = make_pg_reply_sink(conn_factory)

    # Motor ReAct (Task 14): tool_executor real (Composio + MP + calendar) con dedup app-side de links de
    # cobro (spike C) atado al `cliente_id` per-request (nunca de env). El `dispatcher=` se sigue registrando
    # como fallback dispatch/tests legacy; en engine_mode="react" el workflow usa el tool_executor.
    # `llm` COMPARTIDO: clasificador del turno (register_domain), summarizer de 'consultar_actividad' en el
    # dispatcher (recall temporal #125) Y de la MISMA tool en el motor react (tool_executor, PR #137) — mismo
    # modelo/credencial, stateless, sin duplicar construcción. En engine_mode=react 'consultar_actividad' es una
    # tool de 1ra clase READ del tool_catalog (sin gate); en dispatch es una acción del dispatcher. El recall
    # semántico (MemoryProvider) opera en ambos modos por separado (parte del loop, no una tool).
    def _mp_dedup_factory(cliente_id: str):
        return MpLinkDedupStore(conn_factory, cliente_id)

    # `consultar_cliente` (hito 5) lee la cartera del tenant. La factory se INYECTA con el
    # `cliente_id` per-request —igual que las de MP y AFIP— y nunca sale de env: el `ClienteStore`
    # fija el tenant en el constructor y filtra con él en cada query, que es la barrera efectiva de
    # aislamiento de este repo (regla 7). Un store construido una vez y compartido entre turnos
    # respondería «cuánto me compró» con la cartera de otro emprendedor.
    def _cliente_store_factory(cliente_id: str):
        return ClienteStore(conn_factory, cliente_id)

    # Hito 3: las tools que anotan la plata que entra y mueven el estado de la cadena. Mismo criterio
    # de aislamiento que la de clientes — el tenant se fija en el constructor, per-request, y jamás
    # sale de env. Un store compartido entre turnos anotaría el ingreso de un emprendedor en la caja
    # de otro, que es el peor fallo posible de este repo (regla 7).
    def _cobro_store_factory(cliente_id: str):
        return CobroStore(conn_factory, cliente_id)

    def _presupuesto_store_factory(cliente_id: str):
        return PresupuestoStore(conn_factory, cliente_id)

    # Hito 7: el Kanban "Mi día" por voz — mismo criterio de aislamiento (regla 7).
    def _tarjeta_store_factory(cliente_id: str):
        return TarjetaStore(conn_factory, cliente_id)

    # Hito 9: facturar por voz. `afip_cred_store_factory`/`afip_perfil_store_factory` no necesitan
    # `client` (van directo a Postgres, mismo criterio de aislamiento); las tres de Temporal SÍ, y
    # quedan en None sin `client` — `emitir_factura` degrada con error de negocio, no explota.
    def _afip_cred_store_factory(cliente_id: str):
        return AfipCredentialStore(conn_factory, cliente_id, crypto)

    def _afip_perfil_store_factory(cliente_id: str):
        return AfipPerfilStore(conn_factory, cliente_id)

    abrir_borrador_dictado = make_abrir_borrador_de_presupuesto(client) if client is not None else None
    consultar_factura_dictado = make_consultar_factura(client) if client is not None else None
    signal_factura_dictado = make_signal_factura(client) if client is not None else None
    buscar_borrador_dictado = make_buscar_borrador_dictado_abierto(client) if client is not None else None

    # En react el prompt NO concatena los PROMPT_FRAGMENT de los servicios: esos están escritos en formato
    # dispatch (`action="tool_action", entities={...}`) y en tool-calling nativo son RUIDO — los TOOL_SCHEMAS
    # (name + description + parameters) ya describen cada tool (auditoría 2026-07-05: 0 matiz de negocio único
    # fuera del schema). Los fragments siguen siendo la fuente del formato action/entities del modo DISPATCH.
    # ⚠️ Deuda gestionada (pre-existente desde el motor react #134, NO la introduce este cambio): el domain
    # registra UN solo system_prompt (el react); `call_llm` (dispatch) y `call_llm_tools` (react) leen el MISMO
    # `dom["system_prompt"]`. Por eso un rollback a engine_mode=dispatch correría el dispatcher con el prompt
    # react → dispatch fallback DEGRADADO (ya lo estaba). Pago (si se necesita rollback funcional): que este
    # composition root arme prompt+engine_mode por `COPILOTO_ENGINE_MODE`. Owner: operador. Ver frentes-abiertos.
    system_prompt_react = SYSTEM_PROMPT_REACT
    llm = build_llm()
    tool_executor = tool_catalog.make_tool_executor(
        gateway, now_iso_provider=_now_iso, mp_dedup_factory=_mp_dedup_factory, llm=llm,
        cliente_store_factory=_cliente_store_factory, cobro_store_factory=_cobro_store_factory,
        presupuesto_store_factory=_presupuesto_store_factory,
        tarjeta_store_factory=_tarjeta_store_factory,
        afip_cred_store_factory=_afip_cred_store_factory,
        afip_perfil_store_factory=_afip_perfil_store_factory,
        abrir_borrador_dictado=abrir_borrador_dictado,
        consultar_factura_dictado=consultar_factura_dictado,
        signal_factura_dictado=signal_factura_dictado,
        buscar_borrador_dictado=buscar_borrador_dictado)
    register_domain("emprendedor", system_prompt=system_prompt_react, llm_provider=llm,
                    dispatcher=make_dispatcher(gateway, now_iso_provider=_now_iso, llm=llm),
                    context_factory=ctx_factory, memory_provider=memory_provider,
                    engine_mode="react", tool_schemas=tool_catalog.build_tool_catalog(),
                    tool_executor=tool_executor,
                    # Perfil del negocio + soul: el bloque ESTABLE que se antepone al system prompt en
                    # cada llamada al LLM. Se lee por llamada y NO se cachea, a propósito: la sesión es
                    # permanente vía continue-as-new, así que cualquier cosa cacheada del lado del
                    # workflow quedaría congelada para siempre y los cambios de Ajustes no tendrían
                    # efecto nunca. Un tenant sin perfil devuelve "" → el prompt queda byte a byte
                    # igual que antes de que este frente existiera.
                    perfil_provider=_perfil_provider(conn_factory))
    register_channel("web", WebChannelAdapter(reply_sink=reply_sink))

    set_refresh_deps(mp_gateway, lambda cliente_id: MpCredentialStore(conn_factory, cliente_id, crypto))

    # AFIP: mismas fábricas per-tenant, cableadas ANTES de que el worker empiece a pollear (igual que
    # set_refresh_deps). El gateway de onboarding se construye SIN cert: todavía no existe — el alta es
    # justamente lo que lo genera.
    # El mismo `crypto` cifra el certificado AFIP y los tokens de MercadoPago. La llave se llama
    # `COPILOTO_FERNET_KEY` —no `MP_FERNET_KEY`— justamente para que su nombre no mienta sobre eso:
    # deuda saldada el 2026-07-21 (ver `crypto.py`). Rotarla es no-destructivo vía COPILOTO_FERNET_KEYS.
    set_onboarding_deps(
        lambda cuit, ambiente="dev": AfipGateway(cuit=cuit, production=(ambiente == "prod")),
        lambda cliente_id: AfipCredentialStore(conn_factory, cliente_id, crypto),
        lambda cliente_id: AfipSecretHandoff(conn_factory, cliente_id, crypto),
    )

    # Emisión/anulación: el gateway acá SÍ se construye con el certificado del tenant (a diferencia
    # del de onboarding, que todavía no tiene ninguno) y en el AMBIENTE de esa credencial — un
    # certificado de producción contra el endpoint de homologación no autentica.
    set_factura_deps(
        lambda cuit, cert, key, ambiente="dev": AfipGateway(
            cuit=cuit, cert=cert, key=key, production=(ambiente == "prod")),
        lambda cliente_id: AfipCredentialStore(conn_factory, cliente_id, crypto),
        lambda cliente_id: AfipPerfilStore(conn_factory, cliente_id),
        lambda cliente_id: AfipComprobanteStore(conn_factory, cliente_id),
    )

    # Archivado del PDF en el Drive del emprendedor: el MISMO gateway Composio que usa el agente, con
    # los slugs de archivado declarados en la policy de `services/drive.py`. Reusarlo trae gratis el
    # manejo de "el toolkit no está conectado" y la versión de policy; construir uno aparte duplicaría
    # esa lógica y se desincronizaría.
    set_drive_deps(gateway)

    # Hito 7 — Schedule diario de "Mi día". `conn_factory` compartido, el MISMO que usa el resto de
    # los stores (regla 7: nunca uno nuevo por tenant, ver docstring de `set_mi_dia_deps`).
    set_mi_dia_deps(conn_factory)

    # Fase 3 — el ciclo de auto-reparación. El cliente es un `OpenAI()` crudo y NO el `LlmProvider`
    # del agente: `auditor_parches` y el forjador usan `client.chat.completions.create`, que es el
    # contrato que el banco C0 midió, y `LlmProvider` expone otro (`complete`/`complete_tools`).
    # Pasarle el provider haría que el ciclo reventara recién al forjar el primer parche.
    #
    # Sin `OPENAI_API_KEY` queda en None **a propósito**: el worker arranca igual y el ciclo se apaga
    # solo con un motivo legible. Un worker que no levanta porque falta la key de una feature
    # opcional se lleva puestas las que sí funcionan.
    _autosanacion_llm = None
    if env.get("OPENAI_API_KEY"):
        try:
            from openai import OpenAI
            _autosanacion_llm = OpenAI()
        except Exception as exc:  # noqa: BLE001
            print(f"AGENT_B autosanacion: OFF (no se pudo construir el cliente: {exc})", flush=True)
    print("AGENT_B autosanacion: ON" if _autosanacion_llm is not None
          else "AGENT_B autosanacion: OFF (sin OPENAI_API_KEY — el ciclo no forja parches)",
          flush=True)
    # La conexión del ciclo NO es `conn_factory`. Desde 2026-08-01 la auto-reparación es una sola
    # para toda la app y necesita ver la DLQ entera; `conn_factory` declara un tenant y con RLS
    # forzado mostraría sólo el suyo. El rol dedicado (`copiloto_autosanacion`, `BYPASSRLS`, con
    # permisos sobre UNA tabla) lo provisiona `deploy/copiloto/provision-rol-autosanacion.sh`.
    #
    # Sin el DSN el ciclo queda OFF y lo dice: la alternativa —caer de vuelta a `conn_factory`—
    # arrancaría verde y mediría mal para siempre (vería un tenant, agruparía por bug sobre un solo
    # dueño, y no habría un solo síntoma). Un apagado ruidoso es preferible a un encendido mentiroso.
    _conn_dlq = _conn_dlq_factory(env)
    if _conn_dlq is None:
        print("AGENT_B autosanacion: OFF (sin COPILOTO_AUTOSANACION_DSN — el ciclo no ve la DLQ "
              "cross-tenant; correr deploy/copiloto/provision-rol-autosanacion.sh)", flush=True)
    set_autosanacion_deps(_conn_dlq, llm_client=_autosanacion_llm)

    return {"workflows": [ConversationWorkflow, MpRefreshWorkflow, AfipOnboardingWorkflow,
                          FacturaWorkflow, AnulacionWorkflow, MiDiaDetectorWorkflow,
                          AutosanacionWorkflow],
            "activities": _ACTIVITIES + [refresh_credential, dar_de_alta_afip,
                                         verificar_habilitacion_afip, purgar_secretos_vencidos,
                                         cargar_contexto_factura, reservar_numero_comprobante,
                                         emitir_comprobante,
                                         generar_pdf_comprobante, buscar_comprobante,
                                         listar_comprobantes, marcar_comprobante_anulado,
                                         archivar_factura_en_drive, avanzar_tablero_mi_dia]
                          + ACTIVITIES_AUTOSANACION,
            "context_factory": ctx_factory}


async def main() -> None:
    import psycopg2

    db_url = os.environ["DATABASE_URL"]

    def _conn_crudo():
        c = psycopg2.connect(db_url); c.autocommit = True; return c

    # Igual que en el front-door: la conexión declara el tenant del contexto. En el worker ese tenant
    # lo pone la costura C3 (`interceptor_errores`) a partir del payload de la activity.
    conn_factory = conexion_con_tenant(_conn_crudo)

    # Conectar ANTES de armar el config (hito 9): `build_worker_config` necesita el `client` para wirear
    # `emitir_factura` (abre/señaliza el `FacturaWorkflow` del dictado). Antes se conectaba DESPUÉS —
    # inofensivo mientras nada del tool_executor necesitó Temporal, dejó de serlo acá.
    target = os.environ.get("TEMPORAL_TARGET", "localhost:7233")
    client = await Client.connect(target, namespace=os.environ.get("TEMPORAL_NAMESPACE", "default"))
    cfg = build_worker_config(os.environ, conn_factory, client)

    # Costura C3: la captura de errores de TODAS las activities entra acá y en ningún otro lado.
    # Antes se cableaba `log_error` a mano feature por feature (2 de 80 rutas) — ver
    # `interceptor_errores.py`. No altera el comportamiento: registra y re-lanza intacto.
    async with Worker(client, task_queue=AGENT_B_TASK_QUEUE,
                      workflows=cfg["workflows"], activities=cfg["activities"],
                      interceptors=[CapturaDeErroresInterceptor(fabrica_desde(conn_factory))]):
        print(f"AGENT_B worker up on {AGENT_B_TASK_QUEUE}", flush=True)
        await asyncio.Event().wait()


if __name__ == "__main__":
    asyncio.run(main())
