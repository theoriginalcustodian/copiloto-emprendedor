"""Tests de los connect endpoints per-tenant (Task 7, spec §7): `/mp/connect`, `/composio/connect`,
y la extensión de `/me` con `composio_connected`.

TestClient con deps FAKE (mismo criterio que test_web_app.py — no infra real):
- `require_tenant` fake fijo (simula un token válido de ESE tenant) o 401 (simula sin token/inválido;
  ya cubierto en detalle en test_auth.py).
- `mp_gateway`/`composio_gateway` fake que SPÍAN los args con los que se los invoca (para probar que
  `cliente_id`/`user_id` SIEMPRE sale del token, nunca de un valor fijo -- regla dura multitenant).
- `conn_factory` fake mínimo: solo la query de `MpCredentialStore.first_seller_user_id` (la que toca
  `/me`); no se prueba `mp_connected` acá (ya cubierto en test_web_app.py), solo que no explota.
- `mp_app`: un `FastAPI()` vacío alcanza -- `/mp/callback`/`/mp/webhook` no son objeto de este archivo.

Boundary bajo test: `/mp/connect` y `/composio/connect` EXIGEN `require_tenant` (spec §7, "auth").
`service` de `/composio/connect` se valida contra los toolkits DERIVADOS de la policy real
(`web._composio_valid_toolkits`) -- nunca se reenvía un slug arbitrario al gateway."""
from __future__ import annotations

import sys
from pathlib import Path
from urllib.parse import parse_qs, urlencode, urlparse


import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

import services
import web as web_module
from calendar_policy import CALENDAR_POLICY
from clients.agent.providers.crypto import FernetCrypto


# --- fakes ---------------------------------------------------------------------

def _require_tenant_fixed(cliente_id: str):
    def _dep() -> str:
        return cliente_id
    return _dep


def _require_tenant_401():
    def _dep() -> str:
        raise HTTPException(status_code=401, detail="missing or malformed Authorization header")
    return _dep


class _FakeCursor:
    """Solo soporta la query de `MpCredentialStore.first_seller_user_id` -- /me la corre siempre,
    aunque este archivo no la ejercite a fondo (eso vive en test_web_app.py)."""
    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def execute(self, sql: str, params: tuple = ()) -> None:
        pass

    def fetchone(self):
        return None

    def fetchall(self):
        return []


class _FakeConn:
    def cursor(self):
        return _FakeCursor()


def _fake_conn_factory():
    return lambda: _FakeConn()


class _FakeMpGateway:
    """Spía el `state` con el que se lo invoca -- no llama a MercadoPago real. `urlencode` (no
    f-string) porque un token Fernet puede terminar en `=` -- mismo criterio que el gateway real
    (`connect_url` de mercadopago_gateway.py usa `urlencode`)."""
    def __init__(self) -> None:
        self.connect_url_calls: list[str] = []

    def connect_url(self, state: str) -> str:
        self.connect_url_calls.append(state)
        return f"https://mp.example/auth?{urlencode({'state': state})}"


class _FakeComposioGateway:
    """Spía `authorize(user_id, toolkit)` y `revoke(connection_id)` -- no llama a Composio real.
    `connections` = {user_id: [{"id","toolkit","status"}, ...]} para poblar `/me` y `/catalog`.

    `revoke` registra el id crudo que recibió: es lo que permite afirmar que un tenant NUNCA logra
    que se invoque `revoke` con el id de otro (el caso hostil de abajo)."""
    def __init__(self, connections: dict | None = None) -> None:
        self.authorize_calls: list[tuple[str, str]] = []
        self.revoke_calls: list[str] = []
        self._connections = connections or {}

    def authorize(self, user_id: str, toolkit: str) -> str:
        self.authorize_calls.append((user_id, toolkit))
        return f"https://composio.example/connect?user={user_id}&toolkit={toolkit}"

    def list_connections(self, user_id: str) -> list:
        return self._connections.get(user_id, [])

    def revoke(self, connection_id: str) -> None:
        self.revoke_calls.append(connection_id)


@pytest.fixture(autouse=True)
def _mp_fernet_key_env(monkeypatch):
    monkeypatch.setenv("COPILOTO_FERNET_KEY", FernetCrypto.generate_key())


def _build_app(*, require_tenant, mp_gateway=None, composio_gateway=None):
    app = web_module.create_web_app(
        temporal_client=None,
        adapter=None,
        conn_factory=_fake_conn_factory(),
        require_tenant=require_tenant,
        mp_app=FastAPI(),
        gotrue=None,
        mp_gateway=mp_gateway or _FakeMpGateway(),
        composio_gateway=composio_gateway or _FakeComposioGateway(),
    )
    return app


def _state_of(url: str) -> str:
    return parse_qs(urlparse(url).query)["state"][0]


# --- /mp/connect -----------------------------------------------------------------

def test_mp_connect_without_token_returns_401():
    app = _build_app(require_tenant=_require_tenant_401())
    r = TestClient(app).get("/mp/connect")
    assert r.status_code == 401


def test_mp_connect_with_token_state_decrypts_to_that_tenant(monkeypatch):
    key = FernetCrypto.generate_key()
    monkeypatch.setenv("COPILOTO_FERNET_KEY", key)
    gateway = _FakeMpGateway()
    app = _build_app(require_tenant=_require_tenant_fixed("cid-A"), mp_gateway=gateway)
    r = TestClient(app).get("/mp/connect")
    assert r.status_code == 200
    state = _state_of(r.json()["url"])
    assert FernetCrypto(key_env="COPILOTO_FERNET_KEY").decrypt(state) == "cid-A"
    assert gateway.connect_url_calls == [state]


def test_mp_connect_two_tenants_get_state_bound_to_their_own_cliente_id(monkeypatch):
    """El state NUNCA se comparte entre tenants -- ata SIEMPRE al cliente_id del token de ESE request."""
    key = FernetCrypto.generate_key()
    monkeypatch.setenv("COPILOTO_FERNET_KEY", key)
    crypto = FernetCrypto(key_env="COPILOTO_FERNET_KEY")
    app_a = _build_app(require_tenant=_require_tenant_fixed("cid-A"))
    app_b = _build_app(require_tenant=_require_tenant_fixed("cid-B"))
    state_a = _state_of(TestClient(app_a).get("/mp/connect").json()["url"])
    state_b = _state_of(TestClient(app_b).get("/mp/connect").json()["url"])
    assert crypto.decrypt(state_a) == "cid-A"
    assert crypto.decrypt(state_b) == "cid-B"


# --- /composio/connect -------------------------------------------------------------

def test_composio_connect_without_token_returns_401():
    app = _build_app(require_tenant=_require_tenant_401())
    r = TestClient(app).get("/composio/connect", params={"service": "gmail"})
    assert r.status_code == 401


def test_composio_connect_valid_service_calls_authorize_with_user_id_and_toolkit():
    gateway = _FakeComposioGateway()
    app = _build_app(require_tenant=_require_tenant_fixed("cid-A"), composio_gateway=gateway)
    r = TestClient(app).get("/composio/connect", params={"service": "gmail"})
    assert r.status_code == 200
    assert gateway.authorize_calls == [("cid-A", "gmail")]
    assert r.json()["url"] == "https://composio.example/connect?user=cid-A&toolkit=gmail"


def test_composio_connect_unknown_service_returns_400():
    gateway = _FakeComposioGateway()
    app = _build_app(require_tenant=_require_tenant_fixed("cid-A"), composio_gateway=gateway)
    r = TestClient(app).get("/composio/connect", params={"service": "un-toolkit-inexistente"})
    assert r.status_code == 400
    assert gateway.authorize_calls == []          # NUNCA se reenvía un slug arbitrario al gateway


def test_composio_connect_missing_service_returns_400():
    app = _build_app(require_tenant=_require_tenant_fixed("cid-A"))
    r = TestClient(app).get("/composio/connect")
    assert r.status_code == 400


def test_composio_connect_empty_service_returns_400():
    app = _build_app(require_tenant=_require_tenant_fixed("cid-A"))
    r = TestClient(app).get("/composio/connect", params={"service": ""})
    assert r.status_code == 400


def test_composio_connect_two_tenants_use_their_own_user_id():
    gateway = _FakeComposioGateway()
    app_a = _build_app(require_tenant=_require_tenant_fixed("cid-A"), composio_gateway=gateway)
    app_b = _build_app(require_tenant=_require_tenant_fixed("cid-B"), composio_gateway=gateway)
    TestClient(app_a).get("/composio/connect", params={"service": "gmail"})
    TestClient(app_b).get("/composio/connect", params={"service": "gmail"})
    assert gateway.authorize_calls == [("cid-A", "gmail"), ("cid-B", "gmail")]


def test_composio_valid_toolkits_derived_matches_policy_union():
    """`_composio_valid_toolkits` no es una lista literal aparte -- es EXACTAMENTE la unión de
    CALENDAR_POLICY + services.merged_policy() (la misma que arma worker_b.py para el ComposioGateway
    real). Si un test de este archivo divergiera de la policy real, este assert lo cazaría."""
    expected = frozenset(CALENDAR_POLICY) | frozenset(services.merged_policy())
    assert web_module._composio_valid_toolkits() == expected
    # Poda del hito 2: hubspot e instagram se fueron enteros. Quedan 5.
    # googledrive SIGUE: no lo usa el agente sino `archivar_factura_en_drive` (el PDF de cada factura),
    # que reusa la policy de este módulo. Ver el pedido a planificación del 2026-07-22.
    assert len(expected) == 5   # gmail, googlecalendar, googledrive, googledocs, googlesheets


@pytest.mark.parametrize("toolkit", sorted(
    frozenset(CALENDAR_POLICY) | frozenset(services.merged_policy())))
def test_composio_connect_accepts_every_derived_toolkit(toolkit):
    """Los 7 toolkits soportados hoy responden 200 -- ninguno queda rechazado por una lista
    desactualizada a mano."""
    gateway = _FakeComposioGateway()
    app = _build_app(require_tenant=_require_tenant_fixed("cid-A"), composio_gateway=gateway)
    r = TestClient(app).get("/composio/connect", params={"service": toolkit})
    assert r.status_code == 200
    assert gateway.authorize_calls == [("cid-A", toolkit)]


# --- DELETE /composio/connection ---------------------------------------------------

def _gateway_dos_tenants() -> _FakeComposioGateway:
    """cid-A y cid-B tienen cada uno gmail conectado, con ids DISTINTOS. Es el escenario mínimo
    donde un fallo de aislamiento se puede observar: si A lograra revocar lo de B, el id de B
    aparecería en `revoke_calls`."""
    return _FakeComposioGateway(connections={
        "cid-A": [{"id": "conn-de-A", "toolkit": "gmail", "status": "ACTIVE"}],
        "cid-B": [{"id": "conn-de-B", "toolkit": "gmail", "status": "ACTIVE"}],
    })


def test_composio_disconnect_without_token_returns_401():
    app = _build_app(require_tenant=_require_tenant_401())
    r = TestClient(app).delete("/composio/connection", params={"service": "gmail"})
    assert r.status_code == 401


def test_composio_disconnect_revokes_only_the_connection_of_that_tenant():
    gateway = _gateway_dos_tenants()
    app = _build_app(require_tenant=_require_tenant_fixed("cid-A"), composio_gateway=gateway)
    r = TestClient(app).delete("/composio/connection", params={"service": "gmail"})
    assert r.status_code == 200
    assert r.json() == {"desconectado": True, "revocadas": 1}
    assert gateway.revoke_calls == ["conn-de-A"]


def test_composio_disconnect_es_adversarial_el_id_ajeno_nunca_entra():
    """ADVERSARIAL (regla dura del repo: un control sin caso hostil ejercitado queda [UNVERIFIED]).

    cid-A intenta alcanzar la conexión de cid-B por todas las vías que tiene un cliente HTTP:
    mandando el id ajeno como `connection_id`, como `id`, y como valor de `service`. Ninguna debe
    terminar en un `revoke("conn-de-B")`.

    El assert que importa NO es el status code -- es que `conn-de-B` jamás aparezca en
    `revoke_calls`. Un 200 podría ser un rechazo mal codificado; el spy prueba lo que de verdad
    pasó del otro lado del boundary."""
    gateway = _gateway_dos_tenants()
    app = _build_app(require_tenant=_require_tenant_fixed("cid-A"), composio_gateway=gateway)
    cli = TestClient(app)

    cli.delete("/composio/connection", params={"service": "gmail", "connection_id": "conn-de-B"})
    cli.delete("/composio/connection", params={"service": "gmail", "id": "conn-de-B"})
    cli.delete("/composio/connection", params={"service": "conn-de-B"})

    assert "conn-de-B" not in gateway.revoke_calls, "BOLA: un tenant revocó la conexión de otro"
    assert gateway.revoke_calls == ["conn-de-A", "conn-de-A"]   # sólo lo suyo, y sólo por el slug


def test_composio_disconnect_control_el_test_adversarial_puede_fallar():
    """CONTROL del test de arriba: si el endpoint SÍ aceptara un id del request, ¿lo cazaríamos?

    Se simula el endpoint vulnerable (pasar directo al gateway el id que mandó el cliente) y se
    verifica que el spy lo delata. Sin esto, el test adversarial podría estar pasando porque no
    ejercita nada -- que es exactamente el modo en que un control se vuelve decorativo."""
    gateway = _gateway_dos_tenants()
    gateway.revoke("conn-de-B")          # lo que haría un endpoint que confía en el id del cliente
    assert "conn-de-B" in gateway.revoke_calls


def test_composio_disconnect_revokes_ALL_connections_of_that_toolkit():
    """Un tenant puede tener VARIAS conexiones del mismo toolkit (observado en el inventario real
    del 2026-07-21: dos `googledrive` a la vez tras un reintento de vinculación). Revocar sólo la
    primera dejaría la otra viva y `/catalog` seguiría diciendo "conectado"."""
    gateway = _FakeComposioGateway(connections={"cid-A": [
        {"id": "drive-vieja", "toolkit": "googledrive", "status": "EXPIRED"},
        {"id": "drive-nueva", "toolkit": "googledrive", "status": "ACTIVE"},
        {"id": "gmail-1", "toolkit": "gmail", "status": "ACTIVE"},
    ]})
    app = _build_app(require_tenant=_require_tenant_fixed("cid-A"), composio_gateway=gateway)
    r = TestClient(app).delete("/composio/connection", params={"service": "googledrive"})
    assert r.json() == {"desconectado": True, "revocadas": 2}
    assert sorted(gateway.revoke_calls) == ["drive-nueva", "drive-vieja"]
    assert "gmail-1" not in gateway.revoke_calls          # no arrastra otros toolkits


def test_composio_disconnect_toolkit_no_conectado_returns_404_y_no_revoca():
    """404, no `desconectado: true`: sin esto el endpoint afirmaría haber desconectado algo que
    nunca estuvo conectado -- un no-op silencioso pintado como éxito."""
    gateway = _FakeComposioGateway(connections={"cid-A": [
        {"id": "gmail-1", "toolkit": "gmail", "status": "ACTIVE"}]})
    app = _build_app(require_tenant=_require_tenant_fixed("cid-A"), composio_gateway=gateway)
    r = TestClient(app).delete("/composio/connection", params={"service": "googledrive"})
    assert r.status_code == 404
    assert gateway.revoke_calls == []


def test_composio_disconnect_unknown_service_returns_400_y_no_revoca():
    gateway = _gateway_dos_tenants()
    app = _build_app(require_tenant=_require_tenant_fixed("cid-A"), composio_gateway=gateway)
    r = TestClient(app).delete("/composio/connection", params={"service": "un-toolkit-inexistente"})
    assert r.status_code == 400
    assert gateway.revoke_calls == []


def test_composio_disconnect_tenant_sin_ninguna_conexion_returns_404():
    gateway = _FakeComposioGateway()
    app = _build_app(require_tenant=_require_tenant_fixed("cid-solo"), composio_gateway=gateway)
    assert TestClient(app).delete("/composio/connection",
                                  params={"service": "gmail"}).status_code == 404


# --- DELETE /mp/connection ---------------------------------------------------------

class _CursorDelete:
    """Cursor que registra el SQL + params y reporta un `rowcount` fijado por el test -- así se
    puede afirmar DOS cosas distintas: que el DELETE filtra por `cliente_id` (params), y que el
    endpoint traduce rowcount 0 a 404 en vez de a un "desconectado" vacío."""
    def __init__(self, registro: list, rowcount: int) -> None:
        self._registro, self.rowcount = registro, rowcount

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def execute(self, sql: str, params: tuple = ()) -> None:
        self._registro.append((" ".join(sql.split()), params))

    def fetchone(self):
        return None


def _conn_factory_delete(registro: list, rowcount: int):
    class _Conn:
        def cursor(self):
            return _CursorDelete(registro, rowcount)
    return lambda: _Conn()


def _build_app_con_conn(conn_factory, cliente_id: str):
    return web_module.create_web_app(
        temporal_client=None, adapter=None, conn_factory=conn_factory,
        require_tenant=_require_tenant_fixed(cliente_id), mp_app=FastAPI(), gotrue=None,
        mp_gateway=_FakeMpGateway(), composio_gateway=_FakeComposioGateway())


def test_mp_disconnect_without_token_returns_401():
    app = _build_app(require_tenant=_require_tenant_401())
    assert TestClient(app).delete("/mp/connection").status_code == 401


def test_mp_disconnect_borra_filtrando_por_el_cliente_id_del_token():
    """ADVERSARIAL en su forma útil acá: el endpoint no recibe NINGÚN identificador del cliente, así
    que lo que hay que probar es que el `cliente_id` del DELETE sale del token. Si alguien cambiara
    el store para aceptar un id del request, este assert sobre los params lo delata."""
    registro: list = []
    app = _build_app_con_conn(_conn_factory_delete(registro, rowcount=1), "cid-A")
    r = TestClient(app).delete("/mp/connection")
    assert r.status_code == 200
    assert r.json() == {"desconectado": True, "revocadas": 1}
    borrados = [(sql, p) for sql, p in registro if sql.upper().startswith("DELETE")]
    assert len(borrados) == 1
    assert borrados[0][1] == ("cid-A",)
    assert "WHERE cliente_id=%s" in borrados[0][0]


def test_mp_disconnect_sin_credenciales_returns_404():
    """rowcount 0 = no había nada. Un DELETE sobre 0 filas es un no-op SILENCIOSO: sin este 404 el
    endpoint respondería "desconectado" a un tenant que nunca conectó MercadoPago."""
    registro: list = []
    app = _build_app_con_conn(_conn_factory_delete(registro, rowcount=0), "cid-A")
    assert TestClient(app).delete("/mp/connection").status_code == 404


# --- /me: composio_connected -------------------------------------------------------

def test_me_includes_composio_connected_only_active_toolkits():
    gateway = _FakeComposioGateway(connections={
        "cid-A": [
            {"id": "1", "toolkit": "gmail", "status": "ACTIVE"},
            {"id": "2", "toolkit": "hubspot", "status": "INITIATED"},
        ]
    })
    app = _build_app(require_tenant=_require_tenant_fixed("cid-A"), composio_gateway=gateway)
    r = TestClient(app).get("/me")
    assert r.status_code == 200
    assert r.json()["composio_connected"] == ["gmail"]


def test_me_without_composio_connections_reports_empty_list():
    app = _build_app(require_tenant=_require_tenant_fixed("cid-A"))
    r = TestClient(app).get("/me")
    assert r.json()["composio_connected"] == []


def test_me_two_tenants_do_not_leak_composio_state():
    gateway = _FakeComposioGateway(connections={
        "cid-A": [{"id": "1", "toolkit": "gmail", "status": "ACTIVE"}],
        "cid-B": [{"id": "2", "toolkit": "googlecalendar", "status": "ACTIVE"}],
    })
    app_a = _build_app(require_tenant=_require_tenant_fixed("cid-A"), composio_gateway=gateway)
    app_b = _build_app(require_tenant=_require_tenant_fixed("cid-B"), composio_gateway=gateway)
    assert TestClient(app_a).get("/me").json()["composio_connected"] == ["gmail"]
    assert TestClient(app_b).get("/me").json()["composio_connected"] == ["googlecalendar"]
