""""Mi día" — el endpoint (routing, forma, barrera de tenant). Con `TestClient` y fakes: la lógica
real del pipeline (detector + reconciliación) vive en `test_mi_dia_orquestador.py`; acá sólo se
defiende que la HTTP hable bien — mismo criterio que `test_inteligencia_web.py`.
"""
from __future__ import annotations

from fastapi import Header, HTTPException
from fastapi.testclient import TestClient

from clients.agent.providers.composio_gateway import ConnectionRequired
from mi_dia_tarjeta_store import ESTADOS, HACIENDO, PARA_HOY
from mi_dia_web import create_mi_dia_app


def _tenant_fijo(cid: str = "cid-A"):
    def dep() -> str:
        return cid
    return dep


def _tenant_401():
    def dep(authorization: str | None = Header(default=None)) -> str:
        raise HTTPException(status_code=401, detail="sin token")
    return dep


class _TarjetaStoreFake:
    """En memoria — para probar routing/forma sin DB. El dict vive por INSTANCIA de fábrica (una
    por test, ver `_fabrica_de_tarjetas()`), no por clase: dos tests no pueden pisarse el estado."""

    def __init__(self, tarjetas: dict, seq: list, cliente_id: str) -> None:
        self._tarjetas, self._seq, self._cid = tarjetas, seq, cliente_id

    def crear_manual(self, texto: str, datos=None) -> dict:
        self._seq[0] += 1
        t = {"id": self._seq[0], "regla": None, "entidad_tipo": None, "entidad_id": None,
            "texto": texto, "estado": PARA_HOY, "datos": datos,
            "creada_en": "2026-07-24T00:00:00", "movida_en": "2026-07-24T00:00:00"}
        self._tarjetas[t["id"]] = t
        return t

    def mover(self, tarjeta_id: int, nuevo_estado: str) -> dict | None:
        t = self._tarjetas.get(tarjeta_id)
        if t is None:
            return None
        t["estado"] = nuevo_estado
        return t

    def borrar(self, tarjeta_id: int) -> bool:
        return self._tarjetas.pop(tarjeta_id, None) is not None


def _fabrica_de_tarjetas() -> callable:
    """Una fábrica fresca por test: mismo dict/seq para TODOS los `cliente_id` que pida el test
    (alcanza para estos tests, que sólo usan `cid-A`)."""
    tarjetas, seq = {}, [0]
    return lambda cliente_id: _TarjetaStoreFake(tarjetas, seq, cliente_id)


class _ComposioGatewayFake:
    """Mismo estilo que `_GatewaySpy` de `test_dispatcher.py`: registra cada llamada a `execute` y
    devuelve/lanza lo que el test le configure — no pega a Composio real."""

    def __init__(self, resultado=None, excepcion=None):
        self.calls: list[dict] = []
        self._resultado, self._excepcion = resultado, excepcion

    def execute(self, slug, *, user_id, arguments, confirmed):
        self.calls.append({"slug": slug, "user_id": user_id, "arguments": arguments, "confirmed": confirmed})
        if self._excepcion is not None:
            raise self._excepcion
        return self._resultado


def _app(**kw):
    return TestClient(create_mi_dia_app(require_tenant=kw.pop("require_tenant", _tenant_fijo()), **kw))


# --- el punto de encuentro: la forma final aunque no haya factories (front-door sin DB) ---

def test_sin_factories_tablero_es_200_con_la_forma_final_vacia():
    """Forma acordada con frontend en el buzón: `{solapas: [{id, titulo, tarjetas}, ...]}`, orden
    fijo §2.3 (Para hoy · Haciendo · Hechas) — NO el dict plano interno de `TarjetaStore`."""
    r = _app().get("/mi-dia/tablero")
    assert r.status_code == 200
    body = r.json()
    assert [s["id"] for s in body["solapas"]] == list(ESTADOS)
    assert all(s["tarjetas"] == [] for s in body["solapas"])
    assert [s["titulo"] for s in body["solapas"]] == ["Para hoy", "Haciendo", "Hechas"]


def test_sin_factories_crear_da_503_no_500():
    """`_store()` devuelve 503 explícito — no un 500 genérico si algún día alguien olvida cablear
    el factory en `serve.py`."""
    r = _app().post("/mi-dia/tarjetas", json={"texto": "llamar a un cliente"})
    assert r.status_code == 503


# --- routing y forma con el fake ---

def test_get_tablero_llama_avanzar_tablero_fn_con_el_cliente_id():
    llamadas = []

    def avanzar(cid):
        llamadas.append(cid)
        return {"para_hoy": [{"id": 1}], "haciendo": [], "hecha": []}

    r = _app(tarjeta_store_factory=_fabrica_de_tarjetas(), avanzar_tablero_fn=avanzar).get("/mi-dia/tablero")
    assert r.status_code == 200
    solapas = {s["id"]: s["tarjetas"] for s in r.json()["solapas"]}
    assert solapas["para_hoy"] == [{"id": 1}]
    assert llamadas == ["cid-A"]


def test_crear_tarjeta_manual_devuelve_201_y_la_tarjeta_en_para_hoy():
    r = _app(tarjeta_store_factory=_fabrica_de_tarjetas()).post("/mi-dia/tarjetas",
                                                            json={"texto": "llamar a un cliente"})
    assert r.status_code == 201
    tarjeta = r.json()["tarjeta"]
    assert tarjeta["texto"] == "llamar a un cliente"
    assert tarjeta["estado"] == PARA_HOY
    assert tarjeta["regla"] is None


def test_crear_tarjeta_con_texto_vacio_da_400():
    r = _app(tarjeta_store_factory=_fabrica_de_tarjetas()).post("/mi-dia/tarjetas", json={"texto": "   "})
    assert r.status_code == 400


def test_mover_tarjeta_inexistente_da_404():
    r = _app(tarjeta_store_factory=_fabrica_de_tarjetas()).patch("/mi-dia/tarjetas/999/estado",
                                                             json={"estado": HACIENDO})
    assert r.status_code == 404


def test_mover_a_estado_invalido_da_400_no_422():
    """Mismo criterio que `presupuestos_web.EstadoBody`: 400 con el motivo, no el 422 genérico."""
    r = _app(tarjeta_store_factory=_fabrica_de_tarjetas()).patch("/mi-dia/tarjetas/1/estado",
                                                             json={"estado": "archivada_a_mano"})
    assert r.status_code == 400
    assert "estado" in r.json()["detail"]


def test_crear_mover_y_borrar_de_punta_a_punta():
    client = _app(tarjeta_store_factory=_fabrica_de_tarjetas())
    creada = client.post("/mi-dia/tarjetas", json={"texto": "revisar stock"}).json()["tarjeta"]
    movida = client.patch(f"/mi-dia/tarjetas/{creada['id']}/estado",
                          json={"estado": HACIENDO}).json()["tarjeta"]
    assert movida["estado"] == HACIENDO
    r = client.delete(f"/mi-dia/tarjetas/{creada['id']}")
    assert r.status_code == 200
    assert client.delete(f"/mi-dia/tarjetas/{creada['id']}").status_code == 404


# --- la barrera de tenant, igual que el resto de los *_web.py ---

def test_sin_token_da_401_antes_de_tocar_ningun_store():
    r = _app(require_tenant=_tenant_401()).get("/mi-dia/tablero")
    assert r.status_code == 401


# --- GET /mi-dia/calendario (CAL1) — sólo lectura, degradación con gracia si no está conectado ---

def test_sin_composio_gateway_calendario_da_conectado_false_sin_pegarle_a_nada():
    r = _app().get("/mi-dia/calendario")
    assert r.status_code == 200
    body = r.json()
    assert body["conectado"] is False and body["eventos"] == []
    assert [g["id"] for g in body["grupos"]] == ["hoy", "manana", "semana", "sin_hora"]   # siempre los 4


def test_calendario_no_conectado_da_conectado_false_no_500():
    """ConnectionRequired (googlecalendar sin conectar para este user) -- degradación con gracia,
    el mismo camino 100% real que confirmó `spikes/calendar-find-event/RESULT.md` contra Composio."""
    gw = _ComposioGatewayFake(excepcion=ConnectionRequired("googlecalendar"))
    r = _app(composio_gateway=gw).get("/mi-dia/calendario")
    assert r.status_code == 200
    assert r.json()["conectado"] is False and r.json()["eventos"] == []


def test_calendario_conectado_devuelve_eventos_parseados():
    """[ASSUMED_PENDING_VERIFY] shape de ejemplo -- sólo `id`/`summary`/`start`, los únicos campos
    que `test_e2e.py::_events()` ya ejercitó contra Composio real (ver docstring de `_eventos_de`)."""
    resultado = {"data": {"items": [
        {"id": "evt1", "summary": "Reunión con cliente", "start": {"dateTime": "2026-08-11T15:00:00-03:00"}},
    ]}}
    gw = _ComposioGatewayFake(resultado=resultado)
    r = _app(composio_gateway=gw).get("/mi-dia/calendario")
    assert r.status_code == 200
    body = r.json()
    assert body["conectado"] is True
    assert body["eventos"] == [{"id": "evt1", "titulo": "Reunión con cliente",
                               "inicio": {"dateTime": "2026-08-11T15:00:00-03:00"},
                               "fin": None, "dia_completo": False}]


def test_calendario_le_pasa_el_cliente_id_como_user_id_a_composio():
    """Barrera de tenant a nivel de wiring: el `user_id` que llega a Composio es SIEMPRE el
    `cliente_id` resuelto por `require_tenant`, nunca otro -- mismo criterio que el resto del
    catálogo de tools (ver `test_adversarial_multitenant.py` para el caso cross-tenant con DB real)."""
    gw = _ComposioGatewayFake(resultado={"data": {"items": []}})
    r = _app(require_tenant=_tenant_fijo("cid-B"), composio_gateway=gw).get("/mi-dia/calendario")
    assert r.status_code == 200
    assert len(gw.calls) == 1
    assert gw.calls[0]["user_id"] == "cid-B"
    assert gw.calls[0]["confirmed"] is False


# --- ADR-004 (K-13): rango, grupos y día completo --------------------------------------------------

from datetime import date, datetime, timedelta  # noqa: E402
from zoneinfo import ZoneInfo  # noqa: E402

from clients.agent.datetime_resolver import DEFAULT_TZ  # noqa: E402


def _hoy():
    return datetime.now(ZoneInfo(DEFAULT_TZ)).date()


def _ev(id_, dias, hora="10:00:00", **extra):
    d = _hoy() + timedelta(days=dias)
    return {"id": id_, "summary": id_, "start": {"dateTime": f"{d.isoformat()}T{hora}-03:00"}, **extra}


def test_sin_parametros_pide_solo_hoy_retrocompatible():
    gw = _ComposioGatewayFake(resultado={"data": {"items": []}})
    assert _app(composio_gateway=gw).get("/mi-dia/calendario").status_code == 200
    a = gw.calls[0]["arguments"]
    assert a["time_min"].startswith(_hoy().isoformat() + "T00:00:00")
    assert a["time_max"].startswith(_hoy().isoformat() + "T23:59:59")


def test_desde_hasta_ensanchan_la_ventana():
    gw = _ComposioGatewayFake(resultado={"data": {"items": []}})
    d, h = _hoy(), _hoy() + timedelta(days=6)
    r = _app(composio_gateway=gw).get(f"/mi-dia/calendario?desde={d}&hasta={h}")
    assert r.status_code == 200
    a = gw.calls[0]["arguments"]
    assert a["time_min"].startswith(f"{d}T00:00:00") and a["time_max"].startswith(f"{h}T23:59:59")


def test_ventana_invalida_da_400_y_no_le_pega_a_composio():
    gw = _ComposioGatewayFake(resultado={"data": {"items": []}})
    c = _app(composio_gateway=gw)
    d = _hoy()
    for q in (f"desde={d}&hasta={d - timedelta(days=1)}",          # hasta < desde
              f"desde={d}&hasta={d + timedelta(days=14)}",         # 15 días > tope de 14
              "desde=mañana"):                                     # no es fecha
        assert c.get(f"/mi-dia/calendario?{q}").status_code == 400, q
    assert gw.calls == []
    # control positivo: 14 días exactos SÍ pasa (el tope no es un 400 para todo)
    assert c.get(f"/mi-dia/calendario?desde={d}&hasta={d + timedelta(days=13)}").status_code == 200


def test_grupos_hoy_manana_semana_y_sin_hora():
    items = [_ev("de-hoy", 0), _ev("de-manana", 1), _ev("de-la-semana", 4),
             {"id": "todo-el-dia", "summary": "todo-el-dia", "start": {"date": _hoy().isoformat()}}]
    gw = _ComposioGatewayFake(resultado={"data": {"items": items}})
    body = _app(composio_gateway=gw).get(f"/mi-dia/calendario?hasta={_hoy() + timedelta(days=6)}").json()
    grupos = {g["id"]: [e["id"] for e in g["eventos"]] for g in body["grupos"]}
    assert grupos == {"hoy": ["de-hoy"], "manana": ["de-manana"], "semana": ["de-la-semana"],
                      "sin_hora": ["todo-el-dia"]}
    assert [g["id"] for g in body["grupos"]] == ["hoy", "manana", "semana", "sin_hora"]
    dc = {e["id"]: e["dia_completo"] for e in body["eventos"]}
    assert dc["todo-el-dia"] is True and dc["de-hoy"] is False
    assert len(body["eventos"]) == 4          # plano CAL1 intacto


def test_evento_con_start_ilegible_cae_en_sin_hora_no_rompe():
    gw = _ComposioGatewayFake(resultado={"data": {"items": [{"id": "x", "summary": "x", "start": "???"}]}})
    body = _app(composio_gateway=gw).get("/mi-dia/calendario").json()
    assert [e["id"] for g in body["grupos"] if g["id"] == "sin_hora" for e in g["eventos"]] == ["x"]


def test_ADVERSARIAL_ningun_parametro_del_request_cambia_el_user_id_de_composio():
    gw = _ComposioGatewayFake(resultado={"data": {"items": []}})
    c = _app(require_tenant=_tenant_fijo("cid-A"), composio_gateway=gw)
    c.get("/mi-dia/calendario?user_id=cid-B&cliente_id=cid-B&desde=" + _hoy().isoformat())
    assert [x["user_id"] for x in gw.calls] == ["cid-A"]
    assert "user_id" not in gw.calls[0]["arguments"] and "cliente_id" not in gw.calls[0]["arguments"]
    # y sin sesión no llega a Composio
    gw2 = _ComposioGatewayFake(resultado={"data": {"items": []}})
    assert _app(require_tenant=_tenant_401(), composio_gateway=gw2).get("/mi-dia/calendario").status_code == 401
    assert gw2.calls == []


def test_calendar_book_sigue_pasando_por_el_gate_HITL():
    """ADR-004 §3: la escritura de eventos NO tiene endpoint directo; sólo el confirm-gate."""
    from tool_catalog import WRITE_TOOLS
    assert "calendar_book" in WRITE_TOOLS
