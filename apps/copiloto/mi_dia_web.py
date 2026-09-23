""""Mi día" — endpoints (capa CLIENTE, multi-tenant). Contrato: `mi-dia-y-el-detector-proactivo`.

`GET /mi-dia/tablero` (§2): corre el pipeline completo (`mi_dia_orquestador.avanzar_tablero`) y
devuelve el Kanban actualizado — `{para_hoy: [...], haciendo: [...], hecha: [...]}`. Interino: hoy
el pipeline corre EN el GET (sin Temporal Schedule todavía, deuda visible — ver TODO en
`mi_dia_orquestador.py`); cuando el Schedule exista, este endpoint sólo lee (`TarjetaStore.listar_tablero`)
y el disparo diario lo hace el workflow. La FORMA del endpoint no cambia entre las dos versiones.

`POST /mi-dia/tarjetas`, `PATCH /mi-dia/tarjetas/{id}/estado`, `DELETE /mi-dia/tarjetas/{id}` (§2.4):
manual, y el mismo camino que usan las tools de voz del copiloto.

`GET /mi-dia/calendario` (contrato CAL1, sólo lectura — NO es una solapa del Kanban, decisión de
arquitectura ya cerrada: "SOLO LECTURA para mostrar/BI. NO importar eventos como turnos"): eventos
de Google Calendar (por defecto HOY; `desde`/`hasta` hasta 14 días + `grupos`, ADR-004) del tenant, sin gate HITL (mismo trato que `consultar_actividad`). Con
gracia si el toolkit no está conectado (`ConnectionRequired` -> `conectado=False`, nunca 500) — ver
`spikes/calendar-find-event/RESULT.md`, que dejó ese camino verificado contra Composio real. El
parseo de la RESPUESTA (`_eventos_de`) sigue `[ASSUMED_PENDING_VERIFY]`: el tenant canónico no tiene
Calendar conectado todavía, así que el shape exacto de `GOOGLECALENDAR_FIND_EVENT` (más allá de
`id`/`summary`/`start`, lo único que `test_e2e.py::_events()` ya ejercitó) no se confirmó contra
datos reales — se corrige apenas el spike se re-corra con la conexión en `ACTIVE`.

Mismo patrón que el resto de los `*_web.py`: deps inyectadas, se testea entero sin DB; el
`cliente_id` sale SIEMPRE de `Depends(require_tenant)`.
"""
from __future__ import annotations

import asyncio
from datetime import date, datetime, time, timedelta
from typing import Callable
from zoneinfo import ZoneInfo

from fastapi import Depends, FastAPI, HTTPException
from pydantic import BaseModel

from _paths import ensure_paths
ensure_paths()

from calendar_policy import FIND_EVENT_SLUG  # noqa: E402
from clients.agent.datetime_resolver import DEFAULT_TZ  # noqa: E402
from clients.agent.providers.composio_gateway import ConnectionRequired  # noqa: E402
from mi_dia_tarjeta_store import ESTADOS, SOLAPAS_TITULOS, EstadoInvalido  # noqa: E402


MAX_DIAS_AGENDA = 14   # ADR-004: tope de la ventana de lectura (400 si se excede)

GRUPOS_AGENDA = (("hoy", "Hoy"), ("manana", "Mañana"), ("semana", "Esta semana"), ("sin_hora", "Sin hora"))


def _rango(desde: date | None = None, hasta: date | None = None, tz: str = DEFAULT_TZ
           ) -> tuple[str, str, date, date]:
    """[00:00 de `desde`, 23:59:59 de `hasta`] en `tz`, con el offset embebido en el string (el formato
    que `GOOGLECALENDAR_FIND_EVENT` ya demostró aceptar — ver `test_e2e.py`/el spike de CAL1). Sin
    argumentos = HOY (retrocompatible con CAL1). El offset sale de `ZoneInfo`, no hardcodeado.
    Levanta `ValueError` con el motivo si la ventana es inválida (el endpoint lo vuelve 400)."""
    zona = ZoneInfo(tz)
    hoy = datetime.now(zona).date()
    desde = desde or hoy
    hasta = hasta or desde
    if hasta < desde:
        raise ValueError("hasta no puede ser anterior a desde")
    if (hasta - desde).days + 1 > MAX_DIAS_AGENDA:
        raise ValueError(f"la ventana no puede pasar de {MAX_DIAS_AGENDA} días")
    inicio = datetime.combine(desde, time.min, tzinfo=zona)
    fin = datetime.combine(hasta, time.min, tzinfo=zona) + timedelta(days=1) - timedelta(seconds=1)
    return inicio.isoformat(), fin.isoformat(), desde, hasta


def _rango_hoy(tz: str = DEFAULT_TZ) -> tuple[str, str]:
    """Compat CAL1: [00:00, 23:59:59] de HOY."""
    a, b, _, _ = _rango(None, None, tz)
    return a, b


def _dia_de(inicio, tz: str = DEFAULT_TZ) -> date | None:
    """Día local de un `start` de Google Calendar: `{"dateTime": ...}` con hora, `{"date": ...}` de día
    completo (devuelve None: sin hora), o un string ISO. None también si no se puede leer."""
    if isinstance(inicio, dict):
        inicio = inicio.get("dateTime")
    if not isinstance(inicio, str):
        return None
    try:
        return datetime.fromisoformat(inicio.replace("Z", "+00:00")).astimezone(ZoneInfo(tz)).date()
    except ValueError:
        # degradar es lo correcto: un start ilegible no puede tirar la agenda entera; el evento cae en
        # «sin hora» (ADR-004 §2) y se sigue mostrando.
        return None


def _agrupar(eventos: list[dict], hoy: date, tz: str = DEFAULT_TZ) -> list[dict]:
    """ADR-004 §2: grupos en orden fijo (hoy · mañana · semana · sin_hora), siempre los 4 (la UI no
    decide qué mostrar). «Sin hora» = día completo o start ilegible; «semana» = el resto de la ventana
    con hora. El orden cronológico ya viene de `order_by=startTime`."""
    cubetas: dict[str, list[dict]] = {k: [] for k, _ in GRUPOS_AGENDA}
    for ev in eventos:
        dia = _dia_de(ev.get("inicio"), tz)
        if dia is None:
            cubetas["sin_hora"].append(ev)
        elif dia == hoy:
            cubetas["hoy"].append(ev)
        elif dia == hoy + timedelta(days=1):
            cubetas["manana"].append(ev)
        else:
            cubetas["semana"].append(ev)
    return [{"id": k, "titulo": t, "eventos": cubetas[k]} for k, t in GRUPOS_AGENDA]


def _eventos_de(res: dict) -> list[dict]:
    """Adapta el shape crudo de `GOOGLECALENDAR_FIND_EVENT` a lo que consume el frontend.

    [ASSUMED_PENDING_VERIFY] — ver docstring del módulo y `spikes/calendar-find-event/RESULT.md`.
    Recorta a `id`/`titulo`/`inicio` (equivalente a `id`/`summary`/`start`, los ÚNICOS campos que
    `test_e2e.py::_events()` ya ejercitó contra Composio real) porque es la única porción del shape
    con evidencia — no se inventan campos (fin/ubicación/invitados) sin haberlos visto. Recorre el
    árbol sin asumir el nivel de anidamiento exacto, igual que el original."""
    acc: list[dict] = []

    def _walk(o):
        if isinstance(o, dict):
            if o.get("id") and o.get("summary") is not None:
                ini = o.get("start")
                acc.append({"id": o["id"], "titulo": o["summary"], "inicio": ini, "fin": o.get("end"),
                            # Google: día completo = `start.date` sin `dateTime` (ADR-004 §2)
                            "dia_completo": isinstance(ini, dict) and "date" in ini and "dateTime" not in ini})
            for v in o.values():
                _walk(v)
        elif isinstance(o, list):
            for v in o:
                _walk(v)
    _walk(res)
    return acc


class TarjetaBody(BaseModel):
    texto: str


class EstadoBody(BaseModel):
    """Se valida a mano contra `ESTADOS` para devolver 400 con el motivo, no el 422 genérico de
    pydantic — mismo criterio que `presupuestos_web.EstadoBody`."""
    estado: str


def create_mi_dia_app(*, require_tenant: Callable,
                      tarjeta_store_factory: Callable | None = None,
                      avanzar_tablero_fn: Callable | None = None,
                      composio_gateway=None) -> FastAPI:
    """`tarjeta_store_factory(cliente_id) -> TarjetaStore`. `avanzar_tablero_fn(conn_factory,
    cliente_id)` es `mi_dia_orquestador.avanzar_tablero` — inyectado (no importado directo) para que
    los tests del front-door puedan correr sin DB, igual que el resto de los `*_web.py`.

    Los tres opcionales a propósito: sin `tarjeta_store_factory`/`avanzar_tablero_fn` el tablero
    devuelve la forma final vacía (mismo criterio que `inteligencia_web.portada`); sin
    `composio_gateway`, `/mi-dia/calendario` responde `conectado=False` directo, sin pegarle a
    Composio — mismo trato que un toolkit no conectado."""
    app = FastAPI(title="Copiloto Mi Día")

    def _store(cliente_id: str):
        if tarjeta_store_factory is None:
            raise HTTPException(status_code=503, detail="Mi día no está disponible")
        return tarjeta_store_factory(cliente_id)

    def _solapas(por_estado: dict) -> dict:
        """`{para_hoy: [...], ...}` (forma interna de `TarjetaStore.listar_tablero`) →
        `{solapas: [{id, titulo, tarjetas}, ...]}` — la forma que consume la app (acordada con
        frontend en el buzón; `id` de solapa = el `estado` interno, orden fijo §2.3)."""
        return {"solapas": [{"id": e, "titulo": SOLAPAS_TITULOS[e], "tarjetas": por_estado.get(e, [])}
                            for e in ESTADOS]}

    @app.get("/mi-dia/tablero")
    async def tablero(cliente_id: str = Depends(require_tenant)) -> dict:
        if tarjeta_store_factory is None or avanzar_tablero_fn is None:
            return _solapas({})
        return _solapas(await asyncio.to_thread(avanzar_tablero_fn, cliente_id))

    @app.get("/mi-dia/calendario")
    async def calendario(desde: str | None = None, hasta: str | None = None,
                         cliente_id: str = Depends(require_tenant)) -> dict:
        """ADR-004: `desde`/`hasta` (YYYY-MM-DD, en DEFAULT_TZ) opcionales; sin ellos = hoy (CAL1). Suma
        `grupos` (hoy/mañana/semana/sin_hora); `eventos` sigue plano para no romper a los clientes CAL1."""
        try:
            d = date.fromisoformat(desde) if desde else None
            h = date.fromisoformat(hasta) if hasta else None
            time_min, time_max, d, h = _rango(d, h)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from None
        if composio_gateway is None:
            return {"conectado": False, "eventos": [], "grupos": _agrupar([], datetime.now(ZoneInfo(DEFAULT_TZ)).date())}
        try:
            res = await asyncio.to_thread(
                composio_gateway.execute, FIND_EVENT_SLUG, user_id=cliente_id,
                arguments={"time_min": time_min, "time_max": time_max, "single_events": True,
                          "order_by": "startTime", "max_results": 50},
                confirmed=False)
        except ConnectionRequired:
            # sin conectar no es un error: degrada a "conectado: false", mismo trato que el
            # resto del catálogo Composio (ver dispatcher_emprendedor.dispatch)
            return {"conectado": False, "eventos": [], "grupos": _agrupar([], datetime.now(ZoneInfo(DEFAULT_TZ)).date())}
        eventos = _eventos_de(res)
        return {"conectado": True, "eventos": eventos,
                "grupos": _agrupar(eventos, datetime.now(ZoneInfo(DEFAULT_TZ)).date())}

    @app.post("/mi-dia/tarjetas", status_code=201)
    async def crear_tarjeta(body: TarjetaBody, cliente_id: str = Depends(require_tenant)) -> dict:
        if not body.texto.strip():
            raise HTTPException(status_code=400, detail="texto vacío")
        tarjeta = await asyncio.to_thread(_store(cliente_id).crear_manual, body.texto)
        return {"tarjeta": tarjeta}

    @app.patch("/mi-dia/tarjetas/{tarjeta_id}/estado")
    async def mover_tarjeta(tarjeta_id: int, body: EstadoBody,
                            cliente_id: str = Depends(require_tenant)) -> dict:
        if body.estado not in ESTADOS:
            raise HTTPException(status_code=400,
                                detail=f"estado tiene que ser uno de: {', '.join(ESTADOS)}")
        try:
            tarjeta = await asyncio.to_thread(_store(cliente_id).mover, tarjeta_id, body.estado)
        except EstadoInvalido as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from None
        if tarjeta is None:
            raise HTTPException(status_code=404, detail="tarjeta no encontrada")
        return {"tarjeta": tarjeta}

    @app.delete("/mi-dia/tarjetas/{tarjeta_id}")
    async def borrar_tarjeta(tarjeta_id: int, cliente_id: str = Depends(require_tenant)) -> dict:
        ok = await asyncio.to_thread(_store(cliente_id).borrar, tarjeta_id)
        if not ok:
            raise HTTPException(status_code=404, detail="tarjeta no encontrada")
        return {"ok": True}

    return app
