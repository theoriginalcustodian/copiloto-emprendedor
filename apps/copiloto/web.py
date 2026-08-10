"""apps/copiloto/web.py — front-door único del Copiloto (Task 6, spec §3/§7).

Ensambla en UN solo ASGI app: el BFF (`/chat`,`/reply`) tras auth per-request (`require_tenant`
inyectado, Task 2), el onboarding admin-mediado (`/auth/signup`, sin auth, Task 3), el estado del
tenant (`/me`, con auth), liveness (`/healthz`, sin auth) y el router de MercadoPago (`/mp/*`, Task
previa) EXENTO de auth — su barrera es propia (state cifrado / x-signature, spec §5.3).

Reemplaza a `apps/copiloto/app.py::create_app` (single-tenant, `cliente_id` horneado en el closure):
mantener las dos puertas de entrada sería deuda no-gestionada (regla dura del proyecto — "cero
fricción para escalar", CLAUDE.md §4.9). `app.py` re-exporta `create_web_app` para no romper imports
históricos (ver docstring de `app.py`).

Multitenant real (regla dura, spec §5): `cliente_id` en `/chat`,`/reply`,`/me` sale SIEMPRE del
`require_tenant` per-request (`Depends`), nunca de un valor horneado — el mismo front-door sirve N
tenants sin fugas. Todas las deps (`require_tenant`, `conn_factory`, `gotrue`, `mp_app`, `adapter`,
`temporal_client`) se inyectan desde el composition root -> testeable sin Temporal/DB/GoTrue reales."""
from __future__ import annotations

import asyncio
import logging
import os
import re
import sys
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Callable

from _paths import ensure_paths
ensure_paths()

from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from temporalio.common import WorkflowIDConflictPolicy
from temporalio.exceptions import WorkflowAlreadyStartedError

from backend.agent.inbound_router import route_inbound
from auth import es_admin
from catalog import build_catalog
from rate_limit import RateLimitMiddleware
# `tool_catalog` dispara la discovery de servicios al importarse (ver su docstring), y ya la dispara
# el worker. Acá se importa por `capacidades_vivas`: es la MISMA fuente que decide qué tools existen,
# que es todo el punto — una segunda lista volvería a ser el catálogo estático que esto viene a matar.
import tool_catalog
from clients.agent.providers.crypto import FernetCrypto
from clients.agent.providers.mp_refresh_workflow import MpRefreshWorkflow
from canario_autosanacion import RUTA as RUTA_CANARIO
from canario_autosanacion import disparar as disparar_canario
from deposito_traumas import fabrica_desde
from handler_errores_web import registrar_captura_global
from clients.agent.providers.stt import _API_ERRORS as _STT_API_ERRORS
from clients.agent.providers.stt import GroqSTT
from clients.agent.providers.vision import _API_ERRORS as _VISION_API_ERRORS
from clients.agent.providers.vision import OpenAIVisionOCR
from feedback_store import FeedbackStore
from gasto_desde_foto import construir_gasto_desde_foto
from gasto_store import CATEGORIAS as _CATEGORIAS_GASTO
from mp_credential_store import MpCredentialStore
from onboarding import InvalidCredentials, provision_oauth_tenant, signup_and_provision
from reply_store import read_replies as _read_replies
from soporte_store import CANALES_VALIDOS as SOPORTE_FUNCIONES_VALIDAS

import services
from calendar_policy import CALENDAR_POLICY

AGENT_B_TASK_QUEUE = os.environ.get("AGENT_B_TASK_QUEUE", "agent-emprendedor")
DOMAIN = "emprendedor"
# SOP4/C1 — chat de soporte, worker + task_queue PROPIOS (mismo nombre de env que `worker_soporte.py`,
# nunca hardcodeado dos veces). `route_inbound` es agnóstico del dominio (`inbound_router.py`): un
# `task_queue`/`domain` distintos alcanzan, no hace falta un router nuevo.
SOPORTE_TASK_QUEUE = os.environ.get("SOPORTE_TASK_QUEUE", "agent-soporte")
# SOP4/C7: texto FIJO, literal del DoD -- feedback no conversa (one-shot, sin hilo). No es un mensaje
# del agente (no pasa por el motor conversacional): backend lo devuelve directo en la respuesta HTTP.
MENSAJE_FEEDBACK_FIJO = ("Tu mensaje quedó anotado. Estas ideas son las que ayudan a mejorar… "
                        "¡Gracias por tu aporte!")

_log = logging.getLogger("copiloto.web")

# MercadoPago refresh (Task 9): el token OAuth del vendedor dura 180 días REALES (contrato MP, no un valor
# desacoplado -- M1 dejó `expires_at` absoluto a partir de ese vencimiento). El intervalo de refresh se ancla
# a ese vencimiento CON COLCHÓN (150d < 180d) para que el token nunca llegue a expirar entre ciclos, incluso si
# un ciclo se demora. MAX_REFRESH_CYCLES acota el history del workflow antes del `continue_as_new` (loop
# indefinido sin inflar el history, ver `mp_refresh_workflow.py`).
REFRESH_INTERVAL_SECONDS = float(os.environ.get("MP_REFRESH_INTERVAL_SECONDS", 150 * 24 * 3600))
MAX_REFRESH_CYCLES = int(os.environ.get("MP_REFRESH_MAX_CYCLES", 20))

# Cap de tamaño del audio de /chat/audio (review HIGH-1): el front-door es COMPARTIDO por TODAS las
# tenants (CX33 8GB); un upload gigante de una tenant autenticada = OOM para todas. 25 MB = límite
# real de Groq Whisper (un archivo mayor lo rechazaría igual). Parametrizable.
MAX_AUDIO_BYTES = int(os.environ.get("MAX_AUDIO_BYTES", 25 * 1024 * 1024))

# Mismo criterio que MAX_AUDIO_BYTES: cap ANTES de cargar en RAM en el front-door compartido.
# 10 MB alcanza de sobra para una foto de celular de un ticket (contrato POST /chat/foto §1).
MAX_IMAGEN_BYTES = int(os.environ.get("MAX_IMAGEN_BYTES", 10 * 1024 * 1024))

# Contrato BETA1a-feedback-endpoint §1: 2000 caracteres alcanza de sobra para feedback in-app
# (no es un campo de texto libre extenso como una nota de voz larga transcripta).
MAX_FEEDBACK_TEXTO = 2000

# Un copiloto es UNA conversación siempre viva, no una charla que se cierra a cada rato: la sesión es
# efectivamente PERMANENTE. El history de Temporal lo acota el continue-as-new del ConversationWorkflow (se
# renueva sin resetear el buffer), NO el idle-timeout. Éste queda LARGO (7 días) solo como reap de sesiones
# ABANDONADAS — invisible al uso activo. Parametrizable (cero hardcoding). El workflow usa su default (30 min)
# si esta key no viaja, así que apps tipo bot-de-turnos no se ven afectadas.
COPILOTO_IDLE_TIMEOUT_S = int(os.environ.get("COPILOTO_IDLE_TIMEOUT_SECONDS", 7 * 24 * 3600))

# Motor del agente: 'dispatch' (intent→1 acción, legacy byte-identical) | 'react' (loop tool-calling,
# tareas concatenadas). Flag de ROLLOUT por env — default 'dispatch' (comportamiento actual): el código react
# se despliega SIN activarse; se prende seteando COPILOTO_ENGINE_MODE=react en el env del worker/web y se apaga
# al instante volviendo a 'dispatch' (rollback sin re-deploy). Afecta sesiones NUEVAS; las permanentes vivas
# migran al renovarse (continue-as-new arrastra el engine_mode con que arrancaron).
COPILOTO_ENGINE_MODE = os.environ.get("COPILOTO_ENGINE_MODE", "dispatch")


def make_start_refresh(temporal_client, *, task_queue: str = AGENT_B_TASK_QUEUE,
                       refresh_interval_seconds: float = REFRESH_INTERVAL_SECONDS,
                       max_cycles: int = MAX_REFRESH_CYCLES) -> Callable:
    """Fábrica de `start_refresh` (hook de `create_mp_app`, Task 9): arranca el `MpRefreshWorkflow` durable
    para UN (cliente_id, seller_user_id) al conectar MercadoPago. `id` determinístico por ese par +
    `id_conflict_policy=USE_EXISTING` -> IDEMPOTENTE (reconectar/re-callback del MISMO seller reusa el loop ya
    corriendo, nunca arranca uno duplicado; spec §Task 9, patrón start-or-signal de `inbound_router.py`).
    `temporal_client` inyectado desde el composition root (Task 11) -- cero hardcoding, testeable con un fake."""

    async def start_refresh(cliente_id: str, seller_user_id: str) -> None:
        await temporal_client.start_workflow(
            MpRefreshWorkflow.run,
            args=[cliente_id, seller_user_id, refresh_interval_seconds, max_cycles],
            id=f"mp-refresh-{cliente_id}-{seller_user_id}",
            task_queue=task_queue,
            id_conflict_policy=WorkflowIDConflictPolicy.USE_EXISTING,
        )

    return start_refresh


def make_start_onboarding(temporal_client, *, task_queue: str = AGENT_B_TASK_QUEUE) -> Callable:
    """Fábrica de `start_onboarding` (hook de `create_afip_app`): arranca el alta ARCA durable.

    `id` determinístico por (cliente_id, cuit, ambiente) + `USE_EXISTING` → idempotente: si el usuario
    toca dos veces "Conectar" mientras el RPA todavía corre, se engancha al alta en curso en vez de
    lanzar una segunda. Mismo patrón que `make_start_refresh`.

    El AMBIENTE forma parte del id a propósito: son altas distintas (certificados distintos). Sin él,
    vincular producción mientras un alta de homologación sigue viva se engancharía a esa —y el usuario
    vería "conectado" sin tener credencial de producción.
    """

    async def start_onboarding(cliente_id: str, cuit: str, handle: str,
                               ambiente: str = "dev") -> str:
        wf_id = _wf_id_onboarding(cliente_id, cuit, ambiente)
        await temporal_client.start_workflow(
            "AfipOnboardingWorkflow",
            args=[cliente_id, cuit, handle, ambiente],
            id=wf_id,
            task_queue=task_queue,
            id_conflict_policy=WorkflowIDConflictPolicy.USE_EXISTING,
        )
        return wf_id

    return start_onboarding


# Cuando el workflow murió sin dejar dicho por qué (timeout, terminate, o una excepción anterior al
# try/except). Nombrar la interrupción es mejor que dejar al usuario esperando: puede reintentar.
_MOTIVO_ALTA_INTERRUMPIDA = ("La vinculación con ARCA se interrumpió. Podés volver a intentarla.")


def _wf_id_onboarding(cliente_id: str, cuit: str, ambiente: str = "dev") -> str:
    """Un alta por (tenant, CUIT, ambiente). `dev` conserva el id histórico —sin sufijo— para no
    perder de vista las altas que ya corrieron antes de que el ambiente existiera."""
    base = f"afip-onboarding-{cliente_id}-{cuit}"
    return base if ambiente == "dev" else f"{base}-{ambiente}"


def make_consultar_onboarding(temporal_client) -> Callable:
    """Fábrica de `consultar_onboarding`: lee el progreso REAL del alta por query del workflow.

    Es lo que le permite a Ajustes mostrar en qué paso está en vez de un "aguardá un momento" fijo —
    la diferencia concreta contra el competidor, que ante la pregunta del usuario repite el mismo
    mensaje (benchmark Facturitas §7).
    """

    async def consultar_onboarding(cliente_id: str, cuit: str,
                                   ambiente: str = "dev") -> dict | None:
        handle = temporal_client.get_workflow_handle(
            _wf_id_onboarding(cliente_id, cuit, ambiente))

        # El STATUS primero, la query después. Es el orden que importa: el status es un hecho del
        # servidor, mientras que la query ejecuta código —replaya el history— y puede fallar
        # justamente en las ejecuciones rotas, que son las que hay que reportar. Preguntando al revés,
        # un alta muerta se veía como "sin información" en vez de como un fallo.
        try:
            descripcion = await handle.describe()
            vivo = descripcion.status is None or descripcion.status.name == "RUNNING"
        except Exception:  # noqa: BLE001 — nunca hubo alta, o expiró la retención: no es un error
            return None

        try:
            progreso = await handle.query("progreso")
        except Exception:  # noqa: BLE001
            # La query puede fallar por un replay que el código actual ya no reproduce (cambió desde
            # que esa ejecución corrió). Que no se pueda leer el detalle NO es razón para callar que
            # el alta terminó: se reporta con lo que sí se sabe.
            progreso = None

        if progreso is None:
            return ({"paso": "dando_de_alta", "terminado": False, "ok": False, "motivo": None,
                     "ws_autorizados": []} if vivo else
                    {"paso": "fallido", "terminado": True, "ok": False,
                     "motivo": _MOTIVO_ALTA_INTERRUMPIDA, "ws_autorizados": []})

        # Una ejecución MUERTA sigue respondiendo queries: devuelve el último estado del replay. Si el
        # workflow murió por una excepción antes de marcarse como terminado, ese estado dice "en
        # curso" para siempre y la app polea indefinidamente — le pasó al operador el 2026-07-21,
        # cinco minutos frente a un alta muerta en cinco segundos.
        #
        # Por eso el estado NO se cree lo que el workflow dice de sí mismo cuando el status lo
        # contradice. Cubre además timeout, terminate y cancel, que el try/except del workflow no
        # puede atrapar: honesto por construcción, no por que cada camino de error se acuerde.
        if not vivo and not progreso.get("terminado"):
            progreso = {**progreso, "paso": "fallido", "terminado": True, "ok": False,
                        "motivo": progreso.get("motivo") or _MOTIVO_ALTA_INTERRUMPIDA}
        return progreso

    return consultar_onboarding


def _wf_id_factura(cliente_id: str, factura_id: str) -> str:
    """El id que ve el front NO es el workflow_id: se reconstruye con el `cliente_id` autenticado.

    Si el front pasara el workflow_id completo, un tenant podría operar la factura de otro con sólo
    adivinar o filtrar el id. Acá el prefijo sale SIEMPRE del token, nunca del request.
    """
    return f"factura-{cliente_id}-{factura_id}"


def _wf_id_anulacion(cliente_id: str, anulacion_id: str) -> str:
    return f"anulacion-{cliente_id}-{anulacion_id}"


def make_iniciar_factura(temporal_client, *, task_queue: str = AGENT_B_TASK_QUEUE) -> Callable:
    """Abre un borrador durable y devuelve su id público."""

    async def iniciar_factura(cliente_id: str, cuit: str) -> str:
        factura_id = uuid.uuid4().hex
        await temporal_client.start_workflow(
            "FacturaWorkflow",
            args=[cliente_id, cuit, factura_id],
            id=_wf_id_factura(cliente_id, factura_id),
            task_queue=task_queue,
            id_conflict_policy=WorkflowIDConflictPolicy.USE_EXISTING,
        )
        return factura_id

    return iniciar_factura


def make_abrir_borrador_de_presupuesto(temporal_client, *,
                                       task_queue: str = AGENT_B_TASK_QUEUE) -> Callable:
    """Abre el borrador de un presupuesto con `factura_id` DETERMINÍSTICO. `True` si lo abrió esta
    llamada; `False` si ya había uno corriendo y hay que reusarlo.

    Difiere de `make_iniciar_factura` en las dos cosas que importan acá: el id lo pone el llamador
    (deriva del presupuesto) y la política de conflicto es **FAIL**, no USE_EXISTING. USE_EXISTING
    devolvería un handle indistinguible de uno recién creado, y el endpoint volvería a mandarle los
    signals de carga: el borrador terminaría con los ítems DUPLICADOS — un modo de fallo peor que el
    que se está arreglando, porque una factura con el doble de todo parece normal.

    El `WorkflowAlreadyStartedError` es la única señal atómica de "ya existía": la da el servidor al
    rechazar el arranque, sin ventana entre consultar y crear.
    """

    async def abrir_borrador(cliente_id: str, cuit: str, factura_id: str) -> bool:
        try:
            await temporal_client.start_workflow(
                "FacturaWorkflow",
                args=[cliente_id, cuit, factura_id],
                id=_wf_id_factura(cliente_id, factura_id),
                task_queue=task_queue,
                id_conflict_policy=WorkflowIDConflictPolicy.FAIL,
            )
            return True
        except WorkflowAlreadyStartedError:
            return False

    return abrir_borrador


def _no_existe(exc: BaseException) -> bool:
    """¿El workflow no existe, o es que no pudimos preguntar?

    **La distinción no es cosmética.** Un `except Exception: return None` convierte los dos casos en
    un 404 "no encontrada", y 404 es una respuesta *definitiva*: el cliente deja de reintentar y le
    dice al usuario que su factura no existe. Si lo que pasó fue que Temporal estaba caído un
    instante, esa factura existe, se está emitiendo, y acabamos de mentir de la peor forma posible —
    con una respuesta que nadie va a volver a consultar.

    Sólo `NOT_FOUND` significa "no existe". Todo lo demás —red, deadline, cluster caído, un fallo de
    replay que rompe la query— es "no pude preguntar", y eso es un 503 que invita a reintentar. Ante
    la duda se elige el 503: equivocarse hacia "volvé a intentar" es recuperable; hacia "no existe",
    no.
    """
    from temporalio.service import RPCError, RPCStatusCode
    return isinstance(exc, RPCError) and exc.status == RPCStatusCode.NOT_FOUND


async def _estado_de_workflow(handle, que: str) -> dict | None:
    """Query de estado con el 404 y el 503 separados. `que` es sólo para el mensaje y el log."""
    try:
        return await handle.query("estado")
    except Exception as exc:  # noqa: BLE001
        if _no_existe(exc):
            return None
        _log.error("no se pudo leer el estado de %s (%s): %s", que, type(exc).__name__, exc)
        raise HTTPException(503, detail=f"estado de {que} no disponible: reintentá en unos segundos")


def make_consultar_factura(temporal_client) -> Callable:
    async def consultar_factura(cliente_id: str, factura_id: str) -> dict | None:
        handle = temporal_client.get_workflow_handle(_wf_id_factura(cliente_id, factura_id))
        return await _estado_de_workflow(handle, "la factura")

    return consultar_factura


async def _confirmar_por_update(handle, args: list, que: str) -> dict:
    """Confirma vía Workflow Update y devuelve el resultado REAL, no un acuse de recibo.

    Un signal es fire-and-forget: el endpoint contestaba `{"ok": true}` con el token vencido igual que
    con el válido. Un update devuelve lo que el handler decidió. Verificado contra el cluster del VPS
    (Temporal 1.29.7) antes de escribir esto: el update viaja, el rechazo vuelve, y un signal y un
    update pueden compartir nombre de wire — por eso el signal sigue existiendo para los clientes
    viejos y las ejecuciones en vuelo.
    """
    try:
        return await handle.execute_update("confirmar", *args)
    except Exception as exc:  # noqa: BLE001
        if _no_existe(exc):
            raise HTTPException(404, detail=f"{que} no encontrada") from exc
        _log.error("no se pudo confirmar %s (%s): %s", que, type(exc).__name__, exc)
        raise HTTPException(503, detail=f"no se pudo confirmar {que}: reintentá en unos segundos")


def make_confirmar_factura(temporal_client) -> Callable:
    async def confirmar_factura(cliente_id: str, factura_id: str, token: str) -> dict:
        handle = temporal_client.get_workflow_handle(_wf_id_factura(cliente_id, factura_id))
        return await _confirmar_por_update(handle, [token], "la factura")

    return confirmar_factura


def make_confirmar_anulacion(temporal_client) -> Callable:
    async def confirmar_anulacion(cliente_id: str, anulacion_id: str) -> dict:
        handle = temporal_client.get_workflow_handle(_wf_id_anulacion(cliente_id, anulacion_id))
        return await _confirmar_por_update(handle, [], "la anulación")

    return confirmar_anulacion


def make_signal_factura(temporal_client) -> Callable:
    async def signal_factura(cliente_id: str, factura_id: str, nombre: str, payload) -> None:
        handle = temporal_client.get_workflow_handle(_wf_id_factura(cliente_id, factura_id))
        await handle.signal(nombre, payload) if payload is not None else await handle.signal(nombre)

    return signal_factura


# Hito 9 — turno 2 de un dictado incompleto tiene que encontrar el borrador del turno 1 SIN que el
# LLM cargue el id (`hallazgo_..._SS0` pieza 2). Constante con nombre, no literal en la query (pedido
# explícito de planificación al contestar el fork del turno-2).
VENTANA_DICTADO_ABIERTO = timedelta(minutes=15)
_CLIENTE_ID_OK = re.compile(r"^[A-Za-z0-9_-]{1,64}$")


def make_buscar_borrador_dictado_abierto(temporal_client) -> Callable:
    """Encuentra el `FacturaWorkflow` de origen VOZ que sigue abierto para este `cliente_id`, si hay
    uno — Visibility de Temporal, no una tabla nueva: *"no puede desincronizarse de Temporal porque
    ES Temporal"* (respuesta de planificación, `respuesta_planificacion-a-backend_arranca-por-
    visibility-acotada-por-StartTime`). Sin match, `emitir_factura` abre un borrador nuevo (su propio
    fallback) — nunca produce un CAE de más, como mucho un borrador huérfano.

    Acotado por `StartTime`: un `FacturaWorkflow` NO caduca solo por sí mismo
    (`await workflow.wait_condition(lambda: self._confirmado or self._cancelado)`, sin timeout,
    `afip_factura_workflow.py:208`). Sin ventana, un dictado abandonado de hace días podría
    "continuarse" con los datos de hoy — no se ve como error, se ve como una factura con datos
    mezclados. TODO(hito9-dictado-sin-ventana-de-vida, backend, antes de habilitar producción): el
    workflow en sí no expira; ponerle un timeout real es un cambio de historia (versionado/`patched`,
    no es el momento en medio del hito) — anotado también en `memoria/`.
    """
    async def buscar(cliente_id: str) -> str | None:
        # `cliente_id` hoy es un UUID server-side (`resolve_cliente_id`), pero la query de Visibility
        # no toma parámetros -- construye el string directo. Validar acá corta la dependencia con ESE
        # hecho remoto: si `cliente_id` mañana pasa a ser un slug legible, esta línea no se vuelve
        # cross-tenant en silencio (hallazgo de planificación, `la-query-de-visibility-se-blinda`).
        if not _CLIENTE_ID_OK.fullmatch(cliente_id):
            raise HTTPException(status_code=400, detail="cliente_id inválido")
        desde = (datetime.now(timezone.utc) - VENTANA_DICTADO_ABIERTO).strftime("%Y-%m-%dT%H:%M:%SZ")
        prefijo = _wf_id_factura(cliente_id, "dictado-")
        query = (f"WorkflowType='FacturaWorkflow' AND WorkflowId STARTS_WITH '{prefijo}' "
                f"AND ExecutionStatus='Running' AND StartTime > '{desde}'")
        # `list_workflows` NO es coroutine (a diferencia de start_workflow/signal/query) — devuelve el
        # iterador directo. Verificado contra el Temporal real del VPS (v1.29.7): un `await` acá
        # tira `TypeError: object WorkflowExecutionAsyncIterator can't be used in 'await' expression`.
        async for ejecucion in temporal_client.list_workflows(query):
            return ejecucion.id[len(f"factura-{cliente_id}-"):]
        return None

    return buscar


def make_iniciar_anulacion(temporal_client, *, task_queue: str = AGENT_B_TASK_QUEUE) -> Callable:
    async def iniciar_anulacion(cliente_id: str, cuit: str, tipo_cbte: int, punto_venta: int,
                                nro: int) -> str:
        # id determinístico por comprobante: dos toques de "anular" sobre la misma factura se enganchan
        # a la misma anulación en curso, no emiten dos notas de crédito.
        anulacion_id = f"{cuit}-{tipo_cbte}-{punto_venta}-{nro}"
        await temporal_client.start_workflow(
            "AnulacionWorkflow",
            args=[cliente_id, cuit, tipo_cbte, punto_venta, nro, f"nc-{anulacion_id}"],
            id=_wf_id_anulacion(cliente_id, anulacion_id),
            task_queue=task_queue,
            id_conflict_policy=WorkflowIDConflictPolicy.USE_EXISTING,
        )
        return anulacion_id

    return iniciar_anulacion


def make_consultar_anulacion(temporal_client) -> Callable:
    async def consultar_anulacion(cliente_id: str, anulacion_id: str) -> dict | None:
        handle = temporal_client.get_workflow_handle(_wf_id_anulacion(cliente_id, anulacion_id))
        return await _estado_de_workflow(handle, "la anulación")

    return consultar_anulacion


def make_signal_anulacion(temporal_client) -> Callable:
    async def signal_anulacion(cliente_id: str, anulacion_id: str, nombre: str, payload) -> None:
        handle = temporal_client.get_workflow_handle(_wf_id_anulacion(cliente_id, anulacion_id))
        await handle.signal(nombre)

    return signal_anulacion


def _composio_valid_toolkits() -> frozenset[str]:
    """Toolkits Composio soportados por ESTE Copiloto, DERIVADOS de la policy real (misma unión que
    `worker_b.py` arma para el `ComposioGateway`: `{**CALENDAR_POLICY, **services.merged_policy()}`)
    — no una lista literal aparte que pueda driftear. Sumar un servicio nuevo en `services/*.py`
    (discovery por archivo, ver `services/__init__.py`) lo agrega acá sin tocar este módulo."""
    return frozenset(CALENDAR_POLICY) | frozenset(services.merged_policy())


def _spa_static_dir() -> Path:
    """Dir del build del cliente PWA (Vite `dist`), servido mismo-origen por el front-door (sin CORS).
    Parametrizable (`COPILOTO_WEB_STATIC_DIR`, cero hardcoding); default relativo al repo
    (`apps/copiloto-web/dist`, que produce `deploy/copiloto/sync-web.sh` en el VPS)."""
    env = os.environ.get("COPILOTO_WEB_STATIC_DIR")
    return Path(env) if env else Path(__file__).resolve().parents[2] / "apps/copiloto-web/dist"


def _mount_spa(app: FastAPI, static_dir: Path | None = None) -> bool:
    """Monta la PWA build mismo-origen SOLO si ya existe (`index.html`). Import-safe: sin build, el
    front-door queda API-only (no rompe -- el spike de serving lo activa cuando el build llega).

    Se llama DESPUÉS de todas las rutas de API + el router de MP: las rutas explícitas se registran
    primero -> Starlette las matchea primero; el catch-all GET solo atrapa lo NO matcheado (las rutas
    de cliente de la SPA, ej. /login, /conexiones) y devuelve `index.html` (routing client-side).
    Los assets reales (js/css bajo /assets, más manifest/iconos/sw en la raíz) se sirven tal cual."""
    d = static_dir or _spa_static_dir()
    index = d / "index.html"
    if not index.is_file():
        return False
    assets = d / "assets"
    if assets.is_dir():
        app.mount("/assets", StaticFiles(directory=str(assets)), name="assets")

    # El "app shell" + los archivos del service worker se sirven SIEMPRE con no-cache: así el navegador
    # revalida el SW y el index en cada carga y un redeploy llega sin caché stale. Los assets con hash
    # de contenido (/assets/*, servidos por StaticFiles arriba) no necesitan esto -- su nombre cambia
    # con el contenido, el navegador puede cachearlos fuerte sin riesgo de servir algo viejo.
    no_cache = {"Cache-Control": "no-cache, no-store, must-revalidate"}
    shell_files = {"index.html", "sw.js", "registerSW.js", "manifest.webmanifest"}

    @app.get("/{full_path:path}", include_in_schema=False)
    def spa(full_path: str) -> FileResponse:
        candidate = d / full_path
        if full_path and candidate.is_file() and candidate.resolve().is_relative_to(d.resolve()):
            is_shell = candidate.name in shell_files or candidate.name.startswith("workbox-")
            return FileResponse(str(candidate), headers=no_cache if is_shell else None)
        return FileResponse(str(index), headers=no_cache)  # fallback SPA (client-side routing)

    return True


class ChatIn(BaseModel):
    session_id: str
    text: str
    kind: str = "text"


class ChatSoporteIn(BaseModel):
    session_id: str
    text: str
    funcion: str   # 'soporte_tecnico' | 'como_uso_la_app' -- ver soporte_store.CANALES_VALIDOS
    kind: str = "text"


class FeedbackIn(BaseModel):
    texto: str
    contexto: str | None = None


def _filename_for_content_type(content_type: str) -> str:
    """Deriva el filename (`audio.<ext>`) del Content-Type MIME real que sube el browser
    (`audio/webm`, `audio/ogg`, `audio/mp4`, ...) -- Groq valida el formato por la EXTENSIÓN del
    filename del multipart, no por el Content-Type (ver docstring de `GroqSTT`, spike S4/Motor C)."""
    subtype = (content_type or "audio/ogg").split(";")[0].split("/")[-1] or "ogg"
    return f"audio.{subtype}"


def _default_transcribe(audio_bytes: bytes, content_type: str) -> str:
    """Transcriber por default de `/chat/audio` (voz-backend): `GroqSTT` real. Se construye ACÁ
    DENTRO -- recién se instancia/usa cuando `/chat/audio` recibe un request real, nunca al armar
    la app (import-safety, mismo criterio que `serve.py`). Si falta `GROQ_API_KEY` en el env,
    `GroqSTT.transcribe` levanta `RuntimeError` explícito (ver stt.py); la ruta lo traduce a 503
    sin romper el resto del front-door (texto por `/chat` sigue andando igual)."""
    return GroqSTT().transcribe(audio_bytes, filename=_filename_for_content_type(content_type),
                                content_type=content_type or "audio/ogg")


def _default_extraer_ticket(imagen_bytes: bytes, content_type: str) -> dict:
    """Extractor por default de `/chat/foto` (Gastos Fase 2 — OCR): `OpenAIVisionOCR` real, `gpt-4o`
    (spike `spikes/ocr-tickets/RESULT.md`: 4/4 vs 2/4 de `gpt-4o-mini` al mismo costo). Construido ACÁ
    DENTRO, mismo criterio import-safety que `_default_transcribe`: si falta `OPENAI_API_KEY`,
    `OpenAIVisionOCR.leer_ticket` levanta `RuntimeError` explícito recién al primer request real."""
    return OpenAIVisionOCR(categorias=_CATEGORIAS_GASTO).leer_ticket(
        imagen_bytes, content_type=content_type or "image/jpeg")


class SignupIn(BaseModel):
    email: str
    password: str


class LoginIn(BaseModel):
    email: str
    password: str


class RefreshIn(BaseModel):
    refresh_token: str


class GoogleIdTokenIn(BaseModel):
    id_token: str


def create_web_app(*, temporal_client, adapter, conn_factory: Callable, require_tenant: Callable,
                   mp_app: FastAPI, gotrue, mp_gateway, composio_gateway,
                   afip_app: FastAPI | None = None,
                   presupuestos_app: FastAPI | None = None,
                   gastos_app: FastAPI | None = None,
                   clientes_app: FastAPI | None = None,
                   contabilidad_app: FastAPI | None = None,
                   actividad_app: FastAPI | None = None,
                   inteligencia_app: FastAPI | None = None,
                   mi_dia_app: FastAPI | None = None,
                   admin_app: FastAPI | None = None,
                   require_claims: Callable | None = None,
                   read_replies_fn: Callable[[str, str, int], list] | None = None,
                   transcribe: Callable[[bytes, str], str] | None = None,
                   extraer_ticket: Callable[[bytes, str], dict] | None = None,
                   warm_fn: Callable[[str], bool] | None = None) -> FastAPI:
    """Composition root del front-door (spec §3). `read_replies_fn(cliente_id, session_id, after_id)
    -> list`; si no se inyecta, usa el default de producción (`reply_store.read_replies` atado al
    `conn_factory`). El `crypto` de `/me`/`/mp/connect` se construye acá (lee `COPILOTO_FERNET_KEY` del
    env, mismo patrón que `mp_web.py`/`context_factory.py`).

    `mp_gateway` (`MercadoPagoGateway`, Task 7 spec §7): arma la URL de conexión OAuth per-tenant en
    `/mp/connect` (mismo patrón que `mp_connect.py` CLI, `state = crypto.encrypt(cliente_id)`).
    `composio_gateway` (`ComposioGateway`): habilita `/composio/connect?service=<toolkit>` (onboarding
    per-tenant, `user_id=cliente_id`) y alimenta `composio_connected` en `/me`. Ambos inyectados desde
    el composition root (Task 11) — cero hardcoding, testeables con fakes.

    `transcribe(audio_bytes, content_type) -> str` (voz-backend): STT de `/chat/audio`. Si no se
    inyecta, usa `_default_transcribe` (GroqSTT real, construido LAZY -- import-safe aunque
    `GROQ_API_KEY` no esté seteado; solo revienta si `/chat/audio` recibe un request real sin key,
    y ahí la ruta lo traduce a 503). Los tests inyectan un fake.

    `warm_fn(cliente_id) -> bool` (opt-in, perceived latency): precalienta la memoria de largo plazo del
    tenant en `POST /warm` (el front lo dispara al abrir la app / volver a la pestaña de chat, ANTES del 1er
    mensaje → el grafo llega caliente y el 1er turno no paga el cache-miss). `None` (default) → `/warm` es
    no-op (`{"warmed": false}`): apps sin memoria no cambian. En prod lo inyecta `serve.py` desde los MISMOS
    `GRAPHITY_*` que el worker (via `build_memory_provider`). Best-effort: nunca 500."""
    read_replies_fn = read_replies_fn or (
        lambda cliente_id, session_id, after_id: _read_replies(conn_factory, cliente_id, session_id, after_id))
    transcribe = transcribe or _default_transcribe
    extraer_ticket = extraer_ticket or _default_extraer_ticket
    crypto = FernetCrypto()

    app = FastAPI(title="Copiloto — front-door")

    # BETA-2.d: rate-limit del front-door completo (protege costo LLM + abuso). Middleware ASGI puro
    # -> envuelve TODO el stack, incluye los sub-apps montados (/mp, /afip, etc.) sin tocarlos. Ver
    # docstring de `rate_limit.py` (asume proceso único, confirmado contra el systemd unit real).
    app.add_middleware(RateLimitMiddleware)

    # Costura C2: la captura de errores de las 80 rutas entra acá y en ningún otro lado. Va ANTES de
    # registrar rutas y de los `include_router` para que ninguna quede afuera. NO toca los
    # `HTTPException` (404/409/400 son respuestas de negocio, no fallos) — ver `handler_errores_web`.
    # La DLQ (Fase 2) se alimenta de esta costura: `conn_factory` ya viene envuelta con
    # `conexion_con_tenant` desde `serve.py`, así que el trauma se escribe con el tenant que el borde
    # declaró — nunca con uno que el llamador elija.
    registrar_captura_global(app, traumas=fabrica_desde(conn_factory))

    # --- BFF: EXIGE tenant (auth per-request, spec §5.2) ------------------------

    @app.post("/chat")
    async def chat(msg: ChatIn, cliente_id: str = Depends(require_tenant)) -> dict:
        wf_id = await route_inbound(
            temporal_client, adapter=adapter, cliente_id=cliente_id, domain=DOMAIN,
            task_queue=AGENT_B_TASK_QUEUE,
            extra_config={"memory": False,  # hito 5 §2: apagada — el copiloto recibe órdenes y las ejecuta,
                          #   no accede al grafo ni acumula contexto. Vuelve con Inteligencia de Negocio.
                          "idle_timeout_seconds": COPILOTO_IDLE_TIMEOUT_S,
                          "engine_mode": COPILOTO_ENGINE_MODE},
            raw_update={"session_id": msg.session_id, "text": msg.text, "kind": msg.kind})
        return {"wf_id": wf_id, "accepted": wf_id is not None}

    @app.post("/chat/audio")
    async def chat_audio(session_id: str = Form(...), audio: UploadFile = File(...),
                         cliente_id: str = Depends(require_tenant)) -> dict:
        """Front-door de voz (voz-backend): transcribe la nota de voz y la mete al MISMO flujo que
        `/chat` -- la voz es solo OTRA fuente de texto para el agente, nunca un dispatch aparte.
        `async def` (igual que `/chat`: `await route_inbound`), pero la transcripción es I/O
        BLOQUEANTE (GroqSTT usa `urllib` síncrono) -> `asyncio.to_thread` la corre en threadpool
        para no bloquear el event loop del resto de tenants (mismo criterio de escala que las
        rutas `def`)."""
        # Cap ANTES de cargar en RAM (review HIGH-1): rechazá por el Content-Length del multipart
        # (lo setea el browser) para no OOM-ear el front-door compartido; backstop tras leer por si
        # el `size` no viene en la parte.
        if audio.size is not None and audio.size > MAX_AUDIO_BYTES:
            raise HTTPException(status_code=413, detail="audio demasiado grande (máx 25 MB)")
        audio_bytes = await audio.read()
        if len(audio_bytes) > MAX_AUDIO_BYTES:
            raise HTTPException(status_code=413, detail="audio demasiado grande (máx 25 MB)")
        content_type = audio.content_type or "audio/ogg"
        try:
            transcript = await asyncio.to_thread(transcribe, audio_bytes, content_type)
        except RuntimeError as e:
            # GroqSTT levanta RuntimeError explícito si falta GROQ_API_KEY (ver stt.py) -- 503 (no
            # configurado), NO 500: el resto del front-door (texto por /chat) sigue andando igual.
            raise HTTPException(status_code=503, detail="voz no configurada") from e
        except _STT_API_ERRORS as e:
            raise HTTPException(status_code=502, detail="error del servicio de transcripción") from e
        transcript = (transcript or "").strip()
        if not transcript:
            # Vacío O solo-espacios (el STT no captó nada útil) -> 422; nunca despachamos un
            # mensaje en blanco al agente.
            raise HTTPException(status_code=422, detail="no se entendió el audio")
        wf_id = await route_inbound(
            temporal_client, adapter=adapter, cliente_id=cliente_id, domain=DOMAIN,
            task_queue=AGENT_B_TASK_QUEUE,
            extra_config={"memory": False,  # hito 5 §2: apagada — el copiloto recibe órdenes y las ejecuta,
                          #   no accede al grafo ni acumula contexto. Vuelve con Inteligencia de Negocio.
                          "idle_timeout_seconds": COPILOTO_IDLE_TIMEOUT_S,
                          "engine_mode": COPILOTO_ENGINE_MODE},
            raw_update={"session_id": session_id, "text": transcript, "kind": "text"})
        return {"wf_id": wf_id, "accepted": wf_id is not None, "transcript": transcript}

    @app.post("/soporte/chat")
    async def soporte_chat(msg: ChatSoporteIn, cliente_id: str = Depends(require_tenant)) -> dict:
        """Front-door del chat de soporte (SOP4/SOP5, C1+C4). Worker + task_queue PROPIOS
        (`SOPORTE_TASK_QUEUE`, proceso separado de `worker_b`) -- `route_inbound` es agnóstico del
        dominio, no hace falta un router nuevo. `funcion` la elige el usuario en la app, NUNCA un
        clasificador (C4: "determinista, sin modelo") -- acá se valida contra la lista cerrada, 400
        si no matchea ninguna.

        DECIDIDO, no discutible (`respuesta_planificacion-a-backend...va-la-B`, 2026-08-10): el body
        SÍ lleva `funcion` porque reusa `soporte_store.CANALES_VALIDOS` (SOP3) -- un enum CERRADO de
        2 valores validados server-side que siempre cae en el MISMO `task_queue`, no el string libre
        que el punto 1 original de SOP5 objeta (ese sí redirigiría a cualquier cola). Colapsar a un
        solo domain se implementó y se revirtió el mismo día -- no reintentarlo sin decisión nueva.

        `channel_ref` NAMESPACED por función (`soporte:{funcion}:{session_id}`, no el `session_id`
        crudo): el `workflow_id` sale de `(channel, cliente_id, channel_ref)` únicamente
        (`inbound_router.workflow_id_for`) -- sin este prefijo, abrir soporte con el MISMO `session_id`
        que ya usa `/chat` reusaría (`USE_EXISTING`) el workflow del dominio 'emprendedor' en vez de
        arrancar uno nuevo. El `session_id` efectivo vuelve en la respuesta: el frontend lo re-usa
        para los mensajes siguientes de ESTE hilo y para pollear `/reply` (genérico por `session_id`,
        no distingue dominio -- no hace falta tocarlo)."""
        if msg.funcion not in SOPORTE_FUNCIONES_VALIDAS:
            raise HTTPException(status_code=400,
                                detail=f"función inválida: {msg.funcion!r} (válidas: {SOPORTE_FUNCIONES_VALIDAS})")
        channel_ref = f"soporte:{msg.funcion}:{msg.session_id}"
        wf_id = await route_inbound(
            temporal_client, adapter=adapter, cliente_id=cliente_id, domain=msg.funcion,
            task_queue=SOPORTE_TASK_QUEUE,
            extra_config={"engine_mode": "react"},   # el domain de soporte SIEMPRE es react (worker_soporte.py)
            raw_update={"session_id": channel_ref, "text": msg.text, "kind": msg.kind})
        return {"wf_id": wf_id, "accepted": wf_id is not None, "session_id": channel_ref}

    @app.post("/feedback")
    def feedback(body: FeedbackIn, cliente_id: str = Depends(require_tenant)) -> dict:
        """Feedback in-app del emprendedor por texto (BETA-1a, contrato
        `BETA1a-feedback-endpoint.md` §1). `def` (no `async def`, mismo criterio que las rutas
        `def` de más abajo): la única I/O es psycopg2 bloqueante, FastAPI la corre en threadpool."""
        texto = (body.texto or "").strip()
        if not texto:
            raise HTTPException(status_code=422, detail="feedback vacío")
        if len(texto) > MAX_FEEDBACK_TEXTO:
            raise HTTPException(status_code=422, detail="feedback demasiado largo (máx 2000 caracteres)")
        feedback_id = FeedbackStore(conn_factory, cliente_id).crear(
            tipo="texto", texto=texto, contexto=body.contexto)
        return {"id": feedback_id, "ok": True, "mensaje": MENSAJE_FEEDBACK_FIJO}

    @app.post("/feedback/audio")
    async def feedback_audio(audio: UploadFile = File(...), contexto: str | None = Form(None),
                             cliente_id: str = Depends(require_tenant)) -> dict:
        """Feedback in-app por voz -- MISMO patrón de error que `/chat/audio` (contrato §1: "copiar
        la ruta, no reinventar manejo de errores"). NO persiste el audio, sólo el texto transcripto
        (cero infraestructura nueva de storage, igual que `/chat/audio`)."""
        if audio.size is not None and audio.size > MAX_AUDIO_BYTES:
            raise HTTPException(status_code=413, detail="audio demasiado grande (máx 25 MB)")
        audio_bytes = await audio.read()
        if len(audio_bytes) > MAX_AUDIO_BYTES:
            raise HTTPException(status_code=413, detail="audio demasiado grande (máx 25 MB)")
        content_type = audio.content_type or "audio/ogg"
        try:
            transcript = await asyncio.to_thread(transcribe, audio_bytes, content_type)
        except RuntimeError as e:
            raise HTTPException(status_code=503, detail="voz no configurada") from e
        except _STT_API_ERRORS as e:
            raise HTTPException(status_code=502, detail="error del servicio de transcripción") from e
        transcript = (transcript or "").strip()
        if not transcript:
            raise HTTPException(status_code=422, detail="no se entendió el audio")
        feedback_id = FeedbackStore(conn_factory, cliente_id).crear(
            tipo="voz", texto=transcript, contexto=contexto)
        return {"id": feedback_id, "ok": True, "transcripcion": transcript, "mensaje": MENSAJE_FEEDBACK_FIJO}

    @app.post("/chat/foto")
    async def chat_foto(session_id: str = Form(...), imagen: UploadFile = File(...),
                        cliente_id: str = Depends(require_tenant)) -> dict:
        """Front-door de OCR de tickets (Gastos Fase 2). A diferencia de `/chat`/`/chat/audio`, NO
        pasa por `route_inbound`/el loop ReAct: la vision call YA decide los campos del gasto, y
        bajarlos a texto libre para que el LLM los reinterprete perdería la distinción `monto` vacío /
        `monto_sugerido` que es el punto central del addendum de la foto (spike
        `spikes/ocr-tickets/RESULT.md` §3 — "legible" nunca es señal de confianza, no se usa acá para
        nada). El reply se escribe por el MISMO `adapter.send(...)` que usa la activity
        `send_channel_message` (mismo `reply_store`, mismo `/reply`): la app ve la card idéntica a como
        la vería si hubiera llegado por voz. `wf_id` en la respuesta es SINTÉTICO (no hay workflow de
        Temporal en este camino) -- ningún consumidor de `/chat`/`/chat/audio` lo lee hoy (grep vacío en
        `apps/mobile`); se mantiene solo por paridad de shape con esos dos endpoints."""
        if imagen.size is not None and imagen.size > MAX_IMAGEN_BYTES:
            raise HTTPException(status_code=413, detail="imagen demasiado grande (máx 10 MB)")
        imagen_bytes = await imagen.read()
        if len(imagen_bytes) > MAX_IMAGEN_BYTES:
            raise HTTPException(status_code=413, detail="imagen demasiado grande (máx 10 MB)")
        content_type = imagen.content_type or ""
        if content_type not in ("image/jpeg", "image/png"):
            raise HTTPException(status_code=415, detail="formato de imagen no soportado (jpg/png)")
        try:
            extraido = await asyncio.to_thread(extraer_ticket, imagen_bytes, content_type)
        except RuntimeError as e:
            # OpenAIVisionOCR levanta RuntimeError explícito si falta OPENAI_API_KEY -- 503, NO 500:
            # el resto del front-door sigue andando igual.
            raise HTTPException(status_code=503, detail="OCR no configurado") from e
        except _VISION_API_ERRORS as e:
            raise HTTPException(status_code=502, detail="error del servicio de OCR") from e
        # 🔴 El gate NO usa `legible` (el spike lo prohíbe explícitamente -- ver docstring de arriba):
        # si el modelo no extrajo NINGÚN campo, no hay ticket reconocible; si extrajo aunque sea uno,
        # se muestra la card (con `monto` siempre vacío, nunca pre-cargado).
        if not extraido or not any(extraido.get(k) is not None
                                   for k in ("monto", "fecha", "proveedor", "categoria")):
            raise HTTPException(status_code=422, detail="no se reconoció un ticket en la imagen")
        gasto = construir_gasto_desde_foto(extraido)
        idem_key = f"foto:{uuid.uuid4().hex}"
        sugerido = f" (leí ${gasto['monto_sugerido']})" if gasto["monto_sugerido"] else ""
        # Mismo guardrail verbal que `_run_registrar_gasto` (ver `tool_catalog.py`):
        # [[copiloto-narra-la-accion-sin-ejecutarla]] -- nunca "guardado"/"anoté"/"listo".
        texto = (f"Te armé un borrador de gasto desde la foto{sugerido}. TODAVÍA NO está guardado "
                f"-- revisalo y confirmalo cuando quieras.")
        adapter.send(session_id, texto, None, cliente_id=cliente_id,
                    card={"kind": "gasto_propuesto", "data": gasto}, idem_key=idem_key)
        return {"wf_id": idem_key, "accepted": True}

    # `def` (NO `async def`): estas rutas hacen I/O BLOQUEANTE síncrono (psycopg2 en
    # read_replies/MpCredentialStore, httpx sync en signup_and_provision). FastAPI corre las rutas
    # `def` en su threadpool anyio -> el I/O no bloquea el event loop, así N requests multitenant no
    # se serializan (regla de oro "cero fricción para escalar"). `/chat` SÍ es `async def` porque
    # genuinamente hace `await route_inbound(...)` (I/O async del cliente Temporal).

    @app.get("/reply")
    def reply(session_id: str, after_id: int = 0, cliente_id: str = Depends(require_tenant)) -> dict:
        rows = read_replies_fn(cliente_id, session_id, after_id)
        next_id = rows[-1]["id"] if rows else after_id
        return {"replies": rows, "next_id": next_id}

    if require_claims is not None:
        @app.get("/me")
        def me(cliente_id: str = Depends(require_tenant),
              claims: dict = Depends(require_claims)) -> dict:
            # `email` sale del claim del MISMO token ya validado por require_tenant -- no una
            # segunda fuente que pueda divergir. `None` si el token no lo trae (login por
            # teléfono/anónimo, o un proveedor que no lo expone): ausente, no inventado.
            seller = MpCredentialStore(conn_factory, cliente_id, crypto).first_seller_user_id()
            composio_connected = [c["toolkit"] for c in composio_gateway.list_connections(cliente_id)
                                  if (c["status"] or "").upper() == "ACTIVE"]
            return {"cliente_id": cliente_id, "email": claims.get("email"),
                    "mp_connected": seller is not None, "composio_connected": composio_connected,
                    "es_admin": es_admin(claims)}
    else:
        @app.get("/me")
        def me(cliente_id: str = Depends(require_tenant)) -> dict:
            seller = MpCredentialStore(conn_factory, cliente_id, crypto).first_seller_user_id()
            composio_connected = [c["toolkit"] for c in composio_gateway.list_connections(cliente_id)
                                  if (c["status"] or "").upper() == "ACTIVE"]
            # Sin `require_claims` no hay token que leer: `es_admin=False` es fail-closed y
            # deliberado, no un bug -- sin claims no se puede AFIRMAR que sea admin, y esconder la
            # puerta de la consola nunca es un agujero de seguridad (el guard real es
            # `require_admin` en `/admin/*`, que este composition root ni siquiera monta acá).
            return {"cliente_id": cliente_id, "mp_connected": seller is not None,
                    "composio_connected": composio_connected, "es_admin": False}

    @app.post("/warm")
    def warm(cliente_id: str = Depends(require_tenant)) -> dict:
        """Precalienta la memoria de largo plazo (grafo del emprendedor: page-cache Neo4j + índices HNSW)
        al ABRIR la app / volver a la pestaña de chat -- el front lo dispara ANTES de que el usuario tipee,
        así el 1er mensaje no paga el cache-miss del grafo (perceived latency; el enfriamiento es LRU del
        page-cache, no un timer). Best-effort: sin memoria configurada (`warm_fn=None`) o ante CUALQUIER
        fallo/timeout de Graphity devuelve `{"warmed": false}`, NUNCA 500 (es latencia, no correctitud —
        mismo invariante que recall/remember). `def` (no `async`): el warm es I/O bloqueante sync (httpx del
        cliente Graphity) → threadpool anyio, mismo criterio que /reply,/me. `cliente_id` del token, jamás
        de un valor horneado (multitenant real)."""
        if warm_fn is None:
            return {"warmed": False}
        try:
            return {"warmed": bool(warm_fn(cliente_id))}
        except Exception as e:  # noqa: BLE001 -- warm best-effort: jamás romper el front-door por la memoria
            _log.warning("warm degradado (grafo no precalentado): cliente=%s err=%s", cliente_id, e)
            return {"warmed": False}

    @app.get("/catalog")
    def catalog(cliente_id: str = Depends(require_tenant)) -> dict:
        """Catálogo de servicios de ESTE tenant (Task 6, handoff §7.7): mismo cálculo mp_connected/
        composio_connected que `/me`, pero con la metadata de presentación (`catalog.build_catalog`,
        capa PURA sin imports de temporal/fastapi -- testeable aislado). `valid_toolkits` sale
        SIEMPRE de `_composio_valid_toolkits()` (derivado de la policy real), nunca de una lista
        literal que pueda driftear de `/composio/connect`."""
        seller = MpCredentialStore(conn_factory, cliente_id, crypto).first_seller_user_id()
        composio_connected = [c["toolkit"] for c in composio_gateway.list_connections(cliente_id)
                              if (c["status"] or "").upper() == "ACTIVE"]
        return {"services": build_catalog(valid_toolkits=_composio_valid_toolkits(),
                                          mp_connected=seller is not None,
                                          composio_connected=composio_connected)}

    @app.get("/capacidades")
    def capacidades(cliente_id: str = Depends(require_tenant)) -> dict:
        """Lo que el copiloto sabe hacer HOY + las expresiones de fecha que entiende.

        🔴 **Existe para que la pantalla de ayuda sea una PROYECCIÓN y no una lista escrita a mano.**
        Frontend lo pidió con el caso exacto y tenía razón: una guía con las frases adentro es el mismo
        objeto que el catálogo estático de Apps —lo vivo cambia por su cuenta, cada lado verifica su
        mitad y la junta no es de nadie—. Y ya había nacido con el bug: prometía *«facturale 80 mil a
        la panadería»* cuando `emitir_factura` **no existe**.

        Acá una capacidad se publica **sólo si su tool está viva**, así que la poda del hito 2 y el
        alta de la tool de facturar actualizan la guía solas.

        Requiere Bearer aunque hoy no dependa del tenant: es la superficie que le dice al usuario qué
        puede pedirle a SU copiloto, y el día que las tools varíen por tenant (poda por plan, servicios
        conectados) la firma ya está puesta. Abrirla ahora y cerrarla después es un cambio de contrato;
        dejarla cerrada no cuesta nada.
        """
        return tool_catalog.capacidades_vivas()

    # --- Connect flows per-tenant (Task 7, spec §7) -----------------------------
    # `def` (no `async def`): ambas rutas hacen I/O bloqueante sync (crypto + HTTP del gateway real)
    # -> threadpool, mismo criterio que /reply,/me,/auth/signup.

    @app.get("/mp/connect")
    def mp_connect(cliente_id: str = Depends(require_tenant)) -> dict:
        """URL de conexión OAuth de MercadoPago para ESTE tenant (mismo patrón que `mp_connect.py`
        CLI): el `state` cifra el `cliente_id` del token -> `/mp/callback` lo descifra y ata las
        credenciales a ESE tenant, nunca a otro (spec §7)."""
        return {"url": mp_gateway.connect_url(crypto.encrypt(cliente_id))}

    @app.get("/composio/connect")
    def composio_connect(service: str = "", cliente_id: str = Depends(require_tenant)) -> dict:
        """URL de conexión de un toolkit Composio para ESTE tenant (`user_id=cliente_id`, spec §7).
        `service` se valida contra los toolkits DERIVADOS de la policy real (`_composio_valid_toolkits`)
        -- nunca se reenvía un toolkit arbitrario al gateway (fail-closed ante slugs inventados)."""
        if service not in _composio_valid_toolkits():
            raise HTTPException(status_code=400, detail=f"service inválido o desconocido: {service!r}")
        return {"url": composio_gateway.authorize(user_id=cliente_id, toolkit=service)}

    @app.delete("/composio/connection")
    def composio_disconnect(service: str = "", cliente_id: str = Depends(require_tenant)) -> dict:
        """Desconecta un toolkit Composio de ESTE tenant (pedido del operador: "poder desconectar las
        apps conectadas").

        El `connection_id` NO viaja desde el cliente, ni siquiera como parámetro opcional: se
        RESUELVE server-side desde el `cliente_id` del token. Aceptar un id del request sería un BOLA
        de manual (OWASP API1:2023) -- cualquier tenant revocaría la conexión de otro probando ids.
        El parámetro es el SLUG, que no identifica nada ajeno: dos tenants que mandan
        `service=gmail` tocan cada uno lo suyo. La barrera no es una validación que se pueda olvidar,
        es que el id ajeno nunca entra al proceso (test adversarial en test_connect_endpoints.py --
        por la regla dura del repo, un control sin caso hostil ejercitado queda [UNVERIFIED]).

        Revoca TODAS las conexiones de ese toolkit, no la primera. No es defensivo: el inventario
        real del 2026-07-21 mostró un tenant con DOS conexiones `googledrive` a la vez (un reintento
        de vinculación deja la anterior colgada). Revocar una sola dejaría la otra viva y
        `/catalog` seguiría diciendo "conectado" después de que el usuario desconectó -- la acción
        mentiría. Se revocan también las no-ACTIVE (EXPIRED/INITIATED): son justamente el residuo que
        el usuario quiere sacarse de encima.

        404 cuando el tenant no tiene ese toolkit: sin eso, "desconectar" algo que nunca estuvo
        conectado respondería `desconectado: true` sobre un no-op silencioso."""
        if service not in _composio_valid_toolkits():
            raise HTTPException(status_code=400, detail=f"service inválido o desconocido: {service!r}")
        mias = [c for c in composio_gateway.list_connections(cliente_id)
                if (c["toolkit"] or "").lower() == service.lower()]
        if not mias:
            raise HTTPException(status_code=404, detail=f"el tenant no tiene {service!r} conectado")
        for c in mias:
            composio_gateway.revoke(c["id"])
        return {"desconectado": True, "revocadas": len(mias)}

    @app.delete("/mp/connection")
    def mp_disconnect(cliente_id: str = Depends(require_tenant)) -> dict:
        """Desconecta MercadoPago de ESTE tenant borrando sus credenciales cifradas.

        Mismo criterio que `composio_disconnect`: no recibe identificador alguno del cliente, el
        `cliente_id` sale del token y el store filtra por él. 404 si no había nada (rowcount 0), para
        no responder "desconectado" sobre un no-op.

        Alcance HONESTO, ver `MpCredentialStore.delete_all`: el copiloto pierde el acceso, pero el
        token NO se revoca del lado de MercadoPago -- sigue vivo upstream hasta expirar."""
        borradas = MpCredentialStore(conn_factory, cliente_id, crypto).delete_all()
        if not borradas:
            raise HTTPException(status_code=404, detail="el tenant no tiene MercadoPago conectado")
        return {"desconectado": True, "revocadas": borradas}

    # --- SIN auth (spec §5.3) ---------------------------------------------------

    @app.post("/auth/signup")
    def signup(body: SignupIn) -> dict:
        # Admin-mediado (disable_signup:true en fusion): crea el user + la fila `tenants` + el
        # claim (Task 3). Sin `require_tenant` -- todavía no hay tenant al momento del signup.
        # `def` (no async): httpx sync + psycopg2 -> threadpool, no bloquea el loop.
        return signup_and_provision(email=body.email, password=body.password, gotrue=gotrue,
                                    conn_factory=conn_factory)

    @app.post("/auth/login")
    def login(body: LoginIn) -> dict:
        """Proxy de login mismo-origen (Task 6): el frontend NUNCA habla directo con GoTrue (sin
        CORS, sin anon key en el browser) -- manda email/password acá y este endpoint hace el
        password-grant server-side (`GoTrueAdmin.password_grant`) y reenvía el token tal cual.
        `def` (no async): password_grant es I/O bloqueante sync (httpx.Client) -> threadpool, mismo
        criterio que /auth/signup. Nunca loguea password ni token (regla dura de secretos)."""
        try:
            return gotrue.password_grant(body.email, body.password)
        except InvalidCredentials:
            raise HTTPException(status_code=401, detail="credenciales inválidas")

    @app.post("/auth/refresh")
    def refresh(body: RefreshIn) -> dict:
        """Renueva el token sin re-login (sesión persistente hasta que el usuario cierre sesión). SIN
        auth: el refresh_token ES la credencial. `def` (httpx sync -> threadpool, mismo criterio que
        /auth/login). Nunca loguea el token."""
        try:
            return gotrue.refresh_grant(body.refresh_token)
        except InvalidCredentials:
            raise HTTPException(status_code=401, detail="sesión expirada")

    @app.post("/auth/google/id-token")
    def google_id_token(body: GoogleIdTokenIn) -> dict:
        """Sign-in nativo de Google (Credential Manager en Android, sin browser): la app manda el
        `id_token` que ya emitió Google nativamente y este endpoint hace el id_token-grant
        server-side contra GoTrue (mismo motivo que `/auth/login`: el cliente nunca habla directo con
        GoTrue -- sin apikey en el device). SIN auth: el id_token de Google ES la credencial, igual
        que el refresh_token en `/auth/refresh`. `def` (httpx sync -> threadpool, mismo criterio que
        el resto de `/auth/*`).

        Same contrato de respuesta que `/auth/login` (access_token/refresh_token de GoTrue, no de
        Google) -- el cliente sigue el mismo camino post-login (incl. `POST /auth/oauth/ensure-tenant`
        si el `/me` subsiguiente da 403 por ser first-login)."""
        try:
            return gotrue.id_token_grant(body.id_token)
        except InvalidCredentials:
            raise HTTPException(status_code=401, detail="id_token de Google inválido")

    # --- first-login OAuth externo (Google): self-provisioning del tenant (Fase 5) --------------
    # Requiere token VÁLIDO (mismo gate + iss propio que require_tenant) pero NO fila de tenant: el
    # user ya existe en GoTrue (alta self-service del proveedor) y este endpoint da de alta su tenant.
    # Se registra SOLO si el composition root inyecta `require_claims` (serve.py siempre lo hace).
    if require_claims is not None:
        @app.post("/auth/oauth/ensure-tenant")
        def oauth_ensure_tenant(claims: dict = Depends(require_claims)) -> dict:
            """El frontend lo llama UNA vez tras el redirect de Google (antes de usar el resto de la
            API). Provisiona el tenant (idempotente) SOLO si el login es de un proveedor OAuth EXTERNO
            — nunca 'email'/'phone', cuyo alta es admin-mediada (evita self-signup por la puerta de
            atrás). Devuelve {cliente_id}. 403 si el provider no es OAuth externo; 400 si falta email."""
            app_md = claims.get("app_metadata") or {}
            provider = app_md.get("provider", "")
            providers = app_md.get("providers") or []
            is_oauth = provider not in ("", "email", "phone") or any(
                p not in ("email", "phone") for p in providers)
            if not is_oauth:
                raise HTTPException(status_code=403,
                                    detail="self-provisioning solo para login con proveedor OAuth externo")
            email = claims.get("email")
            if not email:
                raise HTTPException(status_code=400, detail="el token no trae email")
            result = provision_oauth_tenant(auth_user_id=claims["sub"], email=email,
                                            gotrue=gotrue, conn_factory=conn_factory)
            return {"cliente_id": result["cliente_id"]}

    @app.get("/healthz")
    def healthz() -> dict:
        return {"status": "ok"}

    @app.post(RUTA_CANARIO)
    def canario(cliente_id: str = Depends(require_tenant)) -> dict:
        """Prueba de vida del manejo de errores: lanza un error DELIBERADO por el camino real.

        Va **autenticada** y no en `/healthz` por dos motivos, y los dos son el punto del canario:
        sin `require_tenant` no hay tenant declarado, y sin tenant la costura no deposita — con lo
        cual el canario mediría un camino distinto al que quiere vigilar. Y el trauma tiene que
        quedar en un tenant real para atravesar el `WITH CHECK` de la policy de RLS.

        No devuelve nada: `disparar()` lanza, la costura lo convierte en el 500 con `codigo` de
        siempre y lo deposita. El `return` sólo se alcanza con el canario apagado.
        """
        disparar_canario(cliente_id)
        return {"status": "canario apagado", "cliente_id": cliente_id}

    # `/mp/callback` y `/mp/webhook` ya construidos en `mp_app` (create_mp_app) con su propia
    # barrera (state cifrado / x-signature). `include_router` copia sus rutas absolutas al front-door
    # SIN heredar `require_tenant` -- MercadoPago no manda JWT del tenant en sus llamadas.
    app.include_router(mp_app.router)
    # `/afip/*` (perfil fiscal + alta ARCA, pantalla de Ajustes). Opcional para no romper los tests que
    # construyen el front-door sin AFIP; en producción `serve.py` siempre lo inyecta. Sus rutas ya traen
    # su propia barrera `Depends(require_tenant)`.
    if afip_app is not None:
        app.include_router(afip_app.router)
    # `/presupuestos/*` y `/perfil-negocio` (presupuestos + perfil del negocio y soul del copiloto).
    # Mismo criterio que `afip_app`: opcional para no romper los tests que arman el front-door sin
    # esto, y sus rutas ya traen su propia barrera `Depends(require_tenant)`.
    if presupuestos_app is not None:
        app.include_router(presupuestos_app.router)
    if gastos_app is not None:
        app.include_router(gastos_app.router)
    if clientes_app is not None:
        app.include_router(clientes_app.router)
    # `/contabilidad/resumen` (agregación de caja/gastos/facturado/clientes, hito-C). Mismo criterio
    # opcional; sus rutas traen su propia barrera `Depends(require_tenant)`.
    if contabilidad_app is not None:
        app.include_router(contabilidad_app.router)
    # `/actividad` (feed unificado: "Recientes" + búsqueda por `funcion`/`q`, `actividad_web.py`
    # sobre la unión de `actividad_store`). Sus rutas traen su propia barrera `Depends(require_tenant)`.
    # ⚠️ HISTORIA (no re-introducir): hasta 2026-07-22 vivía acá arriba un stub `@app.get("/actividad")`
    # directo sobre `app` que devolvía 501 (modelo viejo "entradas firmadas", clínico). Las rutas
    # directas se registran ANTES que los `include_router`, así que ese stub GANABA y ensombrecía
    # este router real EN SILENCIO — sin conflicto de git, sin error: código verde, front-door tapado.
    # Se borró (rama `fix/actividad-stub-shadow`) y el test `test_actividad_no_es_stub_501_*` es el
    # guard de esa regresión exacta. Nunca vuelvas a definir `/actividad` directo sobre `app`.
    if actividad_app is not None:
        app.include_router(actividad_app.router)
    # `/admin/*` — Consola de Operador (CONS0b). El módulo entero es opcional (None si el
    # composition root no arma `require_admin`): "el módulo no se monta si el claim no está"
    # (specs §7) empieza acá — sin `admin_app`, `/admin/*` ni siquiera existe como ruta.
    if admin_app is not None:
        app.include_router(admin_app.router)
    # `/inteligencia/*` (portada de negocio; gráficos y chat vienen después sobre la misma capa de
    # queries). Sus rutas traen su propia barrera `Depends(require_tenant)`. Mismo criterio opcional.
    if inteligencia_app is not None:
        app.include_router(inteligencia_app.router)
    # `/mi-dia/*` (hito 7 — Kanban + detector proactivo). Mismo criterio opcional que el resto.
    if mi_dia_app is not None:
        app.include_router(mi_dia_app.router)

    # SPA mismo-origen (Task 8): se monta al final -> no ensombrece ninguna ruta de API/MP de arriba.
    # No-op si todavía no hay build (front-door API-only hasta que `sync-web.sh` produzca el `dist`).
    _mount_spa(app)

    return app
