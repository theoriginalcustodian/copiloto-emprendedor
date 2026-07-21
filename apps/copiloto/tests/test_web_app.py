"""Tests de apps/copiloto/web.py — front-door único (Task 6, spec §3/§7).

TestClient con deps FAKE (constraint del brief: no necesita infra real):
- `require_tenant` fake inyectado directo (cliente_id fijo, o levanta 401) — el JWT real ya se
  cubre en test_auth.py; acá solo importa que /chat,/reply,/me DEPENDEN de él y /mp/*,/auth/signup,
  /healthz NO.
- `route_inbound` se monkeypatchea (igual patrón que test_app.py) para spiar el cliente_id con el
  que se rutea.
- `conn_factory` fake: in-memory de `uc_factory.tenants` (consumido por `signup_and_provision`,
  Task 3) + `uc_factory.mp_credentials` (consumido por `MpCredentialStore.first_seller_user_id`,
  Task 4, para /me) — parsea el SQL por prefijo, mismo patrón que test_reply_store.py.
- `mp_app` es un `create_mp_app` real (Task previa) con gateway/stores fake — prueba que sus rutas
  quedan expuestas SIN el dependency de auth al montarse en el front-door.

Boundary bajo test (regla dura, spec §5.3): /chat,/reply,/me EXIGEN require_tenant;
/mp/callback,/mp/webhook,/auth/signup,/healthz NO."""
from __future__ import annotations

import inspect
import sys
from pathlib import Path


import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

import web as web_module
from clients.agent.channels.web import WebChannelAdapter
from clients.agent.providers.crypto import FernetCrypto
from mp_web import create_mp_app


# --- fakes compartidos --------------------------------------------------------

class _FakeTemporal:
    """Standin: `route_inbound` se monkeypatchea; este objeto solo viaja como 1er posicional."""


async def _fake_route_inbound(client, *, adapter, cliente_id, domain, task_queue, raw_update, extra_config=None):
    # extra_config: la app pasa {"memory": True} (opt-in de memoria). El fake lo acepta para no romper el
    # contrato de route_inbound; el ruteo del wf_id no depende de él.
    msg = adapter.normalize_inbound(raw_update)
    if msg is None:
        return None
    return f"conv-web-{cliente_id}-{msg.channel_ref}"


def _require_tenant_fixed(cliente_id: str):
    """Dependencia FastAPI fake: siempre resuelve al MISMO cliente_id (simula un token válido de ESE
    tenant, sin decodificar JWT real — ya cubierto en test_auth.py)."""
    def _dep() -> str:
        return cliente_id
    return _dep


def _require_tenant_401():
    """Dependencia FastAPI fake: simula "sin token / token inválido" (401), como haría el
    `make_require_tenant` real (Task 2) ante un Authorization header ausente/malo."""
    def _dep() -> str:
        raise HTTPException(status_code=401, detail="missing or malformed Authorization header")
    return _dep


def _require_claims_fixed(claims: dict):
    """Dependencia FastAPI fake para `/auth/oauth/ensure-tenant`: devuelve claims fijos (simula un
    token válido ya decodificado — el decode+iss real se cubre en test_auth.py)."""
    def _dep() -> dict:
        return claims
    return _dep


class _FakeTenantsDB:
    """In-memory de `uc_factory.tenants` + `uc_factory.mp_credentials` + `uc_factory.copiloto_web_replies`
    — sin DB real."""
    def __init__(self) -> None:
        self.tenants: dict[str, dict] = {}     # auth_user_id -> {cliente_id, email, composio_user_id}
        self.mp_sellers: dict[str, str] = {}   # cliente_id -> seller_user_id (más reciente)
        self.replies: list[dict] = []          # [{id, cliente_id, session_id, reply_text, choices}]


class _FakeCursor:
    def __init__(self, db: _FakeTenantsDB) -> None:
        self._db = db
        self._result = None
        self._rows: list[tuple] = []

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def execute(self, sql: str, params: tuple = ()) -> None:
        s = " ".join(sql.split()).upper()
        if s.startswith("INSERT INTO UC_FACTORY.TENANTS"):
            auth_user_id, cliente_id, email, composio_user_id = params
            if auth_user_id in self._db.tenants:
                self._result = None   # ON CONFLICT DO NOTHING -> sin fila RETURNING
            else:
                self._db.tenants[auth_user_id] = {
                    "cliente_id": cliente_id, "email": email, "composio_user_id": composio_user_id}
                self._result = (cliente_id,)
        elif s.startswith("SELECT CLIENTE_ID::TEXT FROM UC_FACTORY.TENANTS"):
            (auth_user_id,) = params
            row = self._db.tenants.get(auth_user_id)
            self._result = (row["cliente_id"],) if row else None
        elif s.startswith("SELECT SELLER_USER_ID FROM UC_FACTORY.MP_CREDENTIALS"):
            (cliente_id,) = params
            seller = self._db.mp_sellers.get(cliente_id)
            self._result = (seller,) if seller else None
        elif s.startswith("INSERT INTO UC_FACTORY.COPILOTO_WEB_REPLIES"):
            cliente_id, session_id, reply_text, choices, card = params
            row = {"id": len(self._db.replies) + 1, "cliente_id": cliente_id, "session_id": session_id,
                   "reply_text": reply_text, "choices": choices, "card": card, "created_at": "t"}
            self._db.replies.append(row)
        elif s.startswith("SELECT ID, REPLY_TEXT, CHOICES, CARD, CREATED_AT FROM UC_FACTORY.COPILOTO_WEB_REPLIES"):
            cliente_id, session_id, after_id = params
            self._rows = [(r["id"], r["reply_text"], r["choices"], r.get("card"), r["created_at"])
                         for r in self._db.replies
                         if r["cliente_id"] == cliente_id and r["session_id"] == session_id and r["id"] > after_id]
        else:
            raise NotImplementedError(f"SQL no soportado por el fake: {sql}")

    def fetchone(self):
        return self._result

    def fetchall(self):
        return self._rows


class _FakeConn:
    def __init__(self, db: _FakeTenantsDB) -> None:
        self._db = db

    def cursor(self):
        return _FakeCursor(self._db)


def _fake_conn_factory(db: _FakeTenantsDB):
    return lambda: _FakeConn(db)


class _FakeGoTrue:
    def __init__(self, email_to_auth_user_id: dict) -> None:
        self._registry = email_to_auth_user_id
        self.claims: dict[str, str] = {}

    def admin_create_user(self, email: str, password: str) -> dict:
        return {"id": self._registry[email], "email": email}

    def admin_set_claim(self, user_id: str, cliente_id: str) -> None:
        self.claims[user_id] = cliente_id


class _FakeMpGateway:
    def exchange_code(self, code):
        return {"access_token": "AT", "refresh_token": "RT", "expires_in": 999, "user_id": 146}

    def verify_webhook(self, x_sig, x_rid, data_id):
        return True

    def get_payment(self, at, pid):
        return {"id": pid, "status": "approved", "transaction_amount": 1.0,
                "external_reference": "e", "payer": {"email": "a@b.com"}}

    def connect_url(self, state):
        return f"https://mp.example/auth?state={state}"


class _FakeComposioGateway:
    """Fake mínimo (Task 7 vive en test_connect_endpoints.py) — acá solo alcanza para no romper
    /me, que ahora siempre lista las conexiones del tenant."""
    def list_connections(self, user_id):
        return []

    def authorize(self, user_id, toolkit):
        return f"https://composio.example/connect?user={user_id}&toolkit={toolkit}"


class _NoopCredStore:
    def get(self, seller):
        return None

    def save(self, seller_user_id, **kwargs):
        pass


class _NoopPayStore:
    def upsert_from_payment(self, p, *, seller_user_id):
        pass


def _build_mp_app():
    return create_mp_app(gateway=_FakeMpGateway(), crypto=FernetCrypto(),
                         cred_store_factory=lambda cid: _NoopCredStore(),
                         payment_store_factory=lambda cid: _NoopPayStore())


@pytest.fixture(autouse=True)
def _mp_fernet_key_env(monkeypatch):
    """`create_web_app` construye un `FernetCrypto()` propio para /me (Task 6) y `_build_mp_app`
    también lo necesita — ambos leen `MP_FERNET_KEY` del env."""
    monkeypatch.setenv("MP_FERNET_KEY", FernetCrypto.generate_key())


def _build_app(*, require_tenant, db: _FakeTenantsDB | None = None, gotrue=None, read_replies_fn=None,
              mp_gateway=None, composio_gateway=None, warm_fn=None, require_claims=None):
    db = db or _FakeTenantsDB()
    app = web_module.create_web_app(
        temporal_client=_FakeTemporal(),
        adapter=WebChannelAdapter(reply_sink=lambda *a: None),
        conn_factory=_fake_conn_factory(db),
        require_tenant=require_tenant,
        require_claims=require_claims,
        mp_app=_build_mp_app(),
        gotrue=gotrue or _FakeGoTrue({}),
        mp_gateway=mp_gateway or _FakeMpGateway(),
        composio_gateway=composio_gateway or _FakeComposioGateway(),
        read_replies_fn=read_replies_fn,
        warm_fn=warm_fn,
    )
    return app, db


# --- /chat ---------------------------------------------------------------------

def test_chat_without_token_returns_401(monkeypatch):
    monkeypatch.setattr(web_module, "route_inbound", _fake_route_inbound)
    app, _ = _build_app(require_tenant=_require_tenant_401())
    r = TestClient(app).post("/chat", json={"session_id": "s1", "text": "hola"})
    assert r.status_code == 401


def test_chat_with_token_routes_with_cliente_id_from_token(monkeypatch):
    monkeypatch.setattr(web_module, "route_inbound", _fake_route_inbound)
    app, _ = _build_app(require_tenant=_require_tenant_fixed("cid-A"))
    r = TestClient(app).post("/chat", json={"session_id": "s1", "text": "hola"})
    assert r.status_code == 200
    body = r.json()
    assert body["accepted"] is True
    assert body["wf_id"] == "conv-web-cid-A-s1"      # cliente_id vino del token, NUNCA hardcoded


def test_chat_with_different_token_routes_with_that_tenant(monkeypatch):
    """Multitenant real: el MISMO front-door, otro token -> otro cliente_id -> otro wf_id."""
    monkeypatch.setattr(web_module, "route_inbound", _fake_route_inbound)
    app, _ = _build_app(require_tenant=_require_tenant_fixed("cid-B"))
    r = TestClient(app).post("/chat", json={"session_id": "s1", "text": "hola"})
    assert r.json()["wf_id"] == "conv-web-cid-B-s1"


# --- /warm (perceived latency; best-effort) ------------------------------------

def test_warm_without_token_returns_401():
    app, _ = _build_app(require_tenant=_require_tenant_401(), warm_fn=lambda cid: True)
    r = TestClient(app).post("/warm")
    assert r.status_code == 401


def test_warm_with_token_calls_warm_fn_with_cliente_id_from_token():
    calls = []

    def _warm_fn(cliente_id):
        calls.append(cliente_id)
        return True

    app, _ = _build_app(require_tenant=_require_tenant_fixed("cid-A"), warm_fn=_warm_fn)
    r = TestClient(app).post("/warm")
    assert r.status_code == 200
    assert r.json() == {"warmed": True}
    assert calls == ["cid-A"]                        # cliente_id del token, NUNCA hardcoded (multitenant)


def test_warm_without_warm_fn_is_noop():
    """Sin memoria configurada (`warm_fn=None`, default) -> `/warm` responde warmed:false, no 500."""
    app, _ = _build_app(require_tenant=_require_tenant_fixed("cid-A"))
    r = TestClient(app).post("/warm")
    assert r.status_code == 200
    assert r.json() == {"warmed": False}


def test_warm_swallows_backend_failure_never_500():
    """Graphity caído/lento -> `warm_fn` levanta -> `/warm` degrada a warmed:false (best-effort), NUNCA 500:
    el warm es latencia, no correctitud (mismo invariante que recall/remember)."""
    def _warm_fn(cliente_id):
        raise RuntimeError("graphity down")

    app, _ = _build_app(require_tenant=_require_tenant_fixed("cid-A"), warm_fn=_warm_fn)
    r = TestClient(app).post("/warm")
    assert r.status_code == 200
    assert r.json() == {"warmed": False}


# --- /reply ----------------------------------------------------------------------

def test_reply_without_token_returns_401():
    app, _ = _build_app(require_tenant=_require_tenant_401())
    r = TestClient(app).get("/reply", params={"session_id": "s1"})
    assert r.status_code == 401


def test_reply_with_token_reads_via_read_replies_fn_scoped_to_cliente_id():
    calls = []

    def _read_replies_fn(cliente_id, session_id, after_id):
        calls.append((cliente_id, session_id, after_id))
        return [{"id": 1, "reply_text": "hola", "choices": None, "created_at": "t"}]

    app, _ = _build_app(require_tenant=_require_tenant_fixed("cid-A"), read_replies_fn=_read_replies_fn)
    r = TestClient(app).get("/reply", params={"session_id": "s1", "after_id": 0})
    assert r.status_code == 200
    assert calls == [("cid-A", "s1", 0)]              # cliente_id del token, no del querystring
    assert r.json()["next_id"] == 1


def test_reply_default_read_replies_fn_uses_conn_factory_and_isolates_tenant():
    """Sin `read_replies_fn` inyectado, usa el default (reply_store.read_replies atado al
    conn_factory) — y aísla por cliente_id (no ve replies de otro tenant)."""
    import reply_store
    db = _FakeTenantsDB()
    app, _ = _build_app(require_tenant=_require_tenant_fixed("cid-A"), db=db)
    conn_factory = _fake_conn_factory(db)
    sink = reply_store.make_pg_reply_sink(conn_factory)
    sink("cid-A", "s1", "reply de A", None)
    sink("cid-B", "s1", "reply de B", None)
    r = TestClient(app).get("/reply", params={"session_id": "s1", "after_id": 0})
    assert [x["reply_text"] for x in r.json()["replies"]] == ["reply de A"]


# --- /mp/* exento de auth ----------------------------------------------------------

def test_mp_webhook_accessible_without_token():
    app, _ = _build_app(require_tenant=_require_tenant_401())
    r = TestClient(app).post("/mp/webhook?cid=cid-A&seller=146&data.id=P1",
                             headers={"x-signature": "ts=1,v1=x", "x-request-id": "r"})
    assert r.status_code == 200          # NO 401: /mp/* no depende de require_tenant


def test_mp_callback_accessible_without_token():
    app, _ = _build_app(require_tenant=_require_tenant_401())
    crypto = FernetCrypto()
    state = crypto.encrypt("cid-A")
    r = TestClient(app).get(f"/mp/callback?code=abc&state={state}")
    assert r.status_code == 200


# --- /healthz --------------------------------------------------------------------

def test_healthz_without_token_returns_ok():
    app, _ = _build_app(require_tenant=_require_tenant_401())
    r = TestClient(app).get("/healthz")
    assert r.status_code == 200 and r.json() == {"status": "ok"}


# --- /auth/signup ------------------------------------------------------------------

def test_signup_without_token_creates_tenant_and_returns_cliente_id():
    gotrue = _FakeGoTrue({"a@test.com": "auth-user-A"})
    app, db = _build_app(require_tenant=_require_tenant_401(), gotrue=gotrue)
    r = TestClient(app).post("/auth/signup", json={"email": "a@test.com", "password": "pw"})
    assert r.status_code == 200
    body = r.json()
    assert body["auth_user_id"] == "auth-user-A"
    assert body["cliente_id"]
    assert db.tenants["auth-user-A"]["composio_user_id"] == body["cliente_id"]


def test_signup_idempotent_same_email_returns_same_cliente_id():
    gotrue = _FakeGoTrue({"b@test.com": "auth-user-B"})
    app, db = _build_app(require_tenant=_require_tenant_401(), gotrue=gotrue)
    client = TestClient(app)
    r1 = client.post("/auth/signup", json={"email": "b@test.com", "password": "pw"})
    r2 = client.post("/auth/signup", json={"email": "b@test.com", "password": "pw"})
    assert r1.json()["cliente_id"] == r2.json()["cliente_id"]


# --- /actividad --------------------------------------------------------------------
# Ver el docstring del handler en web.py para el POR QUÉ de 501: `ActividadItem` (packages/core/src/
# api/actividad.ts) pide un modelo de "entradas firmadas por cliente-de-negocio" que NO existe en este
# backend (verificado: grep del repo + único consumidor real de "actividad" es `consultar_actividad`,
# que resume episodios de Graphity en lenguaje natural, sin cliente_nombre/tipo_operacion/entrada_id).
# El cliente YA normaliza 501 a `{status:'no_disponible'}` — es el contrato, no un placeholder olvidado.

def test_actividad_without_token_returns_401():
    app, _ = _build_app(require_tenant=_require_tenant_401())
    r = TestClient(app).get("/actividad")
    assert r.status_code == 401


def test_actividad_with_token_returns_501_stub_not_fabricated_data():
    """Con token válido: 501 explícito (stub deliberado), NUNCA 200 con datos inventados. El cliente
    (`listarActividad`) trata 404 Y 501 igual (`no_disponible`) -- 501 es más preciso: la ruta SÍ
    existe y está registrada, la implementación real es la que falta."""
    app, _ = _build_app(require_tenant=_require_tenant_fixed("cid-A"))
    r = TestClient(app).get("/actividad", params={"q": "ana", "cursor": "cur-1", "limit": 5})
    assert r.status_code == 501
    # El detail no debe filtrar cliente_id ni ningún dato de negocio -- es un mensaje genérico de estado.
    assert "cid-A" not in r.text


def test_actividad_accepts_default_query_params_without_error():
    """Sin q/cursor/limit (llamada mínima que hace `listarActividad()` sin args) -- misma respuesta 501,
    no un 422 de validación por parámetros ausentes."""
    app, _ = _build_app(require_tenant=_require_tenant_fixed("cid-A"))
    r = TestClient(app).get("/actividad")
    assert r.status_code == 501


def test_actividad_two_tenants_get_identical_stub_no_cross_tenant_leak():
    """Adversarial (regla dura del proyecto -- control de aislamiento sin test hostil = no verificado):
    tenant A y tenant B piden /actividad: NINGUNO ve NADA del otro. Hoy, sin fuente de datos real, la
    única superficie de fuga posible es el cuerpo de la respuesta (el stub no lee del store) -- se
    verifica que la respuesta es IDÉNTICA para ambos tenants (mismo status, mismo detail genérico) y
    que ninguna contiene el cliente_id del otro. El día que la fuente real exista, este test se
    reemplaza por uno con datos reales de A/B (ver TODO en el docstring del handler), pero el gate de
    "cliente_id sale EXCLUSIVAMENTE de Depends(require_tenant)" ya lo cubre `test_actividad_route_binds_cliente_id_only_via_require_tenant_dependency`."""
    app_a, _ = _build_app(require_tenant=_require_tenant_fixed("cid-A"))
    app_b, _ = _build_app(require_tenant=_require_tenant_fixed("cid-B"))
    r_a = TestClient(app_a).get("/actividad")
    r_b = TestClient(app_b).get("/actividad")
    assert r_a.status_code == r_b.status_code == 501
    assert r_a.json() == r_b.json()          # ningún tenant recibe un cuerpo distinto/con datos del otro
    assert "cid-A" not in r_a.text and "cid-B" not in r_a.text
    assert "cid-A" not in r_b.text and "cid-B" not in r_b.text


def test_actividad_route_binds_cliente_id_only_via_require_tenant_dependency():
    """Estructural (blindaje a futuro, regla 7): `cliente_id` del handler DEBE resolverse vía
    `Depends(require_tenant)` -- nunca aceptar un `cliente_id`/`cid` por querystring que permitiría
    pedir la actividad de OTRO tenant. Verifica la firma real del endpoint registrado, no una copia."""
    app, _ = _build_app(require_tenant=_require_tenant_fixed("cid-A"))
    ep = _route_endpoint(app, "/actividad", "GET")
    sig = inspect.signature(ep)
    assert "cliente_id" in sig.parameters
    default = sig.parameters["cliente_id"].default
    assert getattr(default, "dependency", None) is not None, (
        "cliente_id debe venir de Depends(require_tenant), no de un default plano")
    # Ningún parámetro alternativo (`cid`, `tenant_id`, etc.) que permita colarse por query.
    assert not ({"cid", "tenant_id"} & set(sig.parameters))


# --- /me ---------------------------------------------------------------------------

def test_me_without_token_returns_401():
    app, _ = _build_app(require_tenant=_require_tenant_401())
    r = TestClient(app).get("/me")
    assert r.status_code == 401


def test_me_with_token_reports_mp_connected_true():
    db = _FakeTenantsDB()
    db.mp_sellers["cid-A"] = "seller-146"
    app, _ = _build_app(require_tenant=_require_tenant_fixed("cid-A"), db=db)
    r = TestClient(app).get("/me")
    assert r.status_code == 200
    assert r.json() == {"cliente_id": "cid-A", "mp_connected": True, "composio_connected": []}


def test_me_without_mp_connection_reports_false():
    app, _ = _build_app(require_tenant=_require_tenant_fixed("cid-B"))
    r = TestClient(app).get("/me")
    assert r.json() == {"cliente_id": "cid-B", "mp_connected": False, "composio_connected": []}


def test_me_two_tenants_do_not_leak_mp_state():
    """Adversarial mínimo: el estado de A no se filtra a B por compartir el mismo front-door/DB fake."""
    db = _FakeTenantsDB()
    db.mp_sellers["cid-A"] = "seller-146"
    app_a, _ = _build_app(require_tenant=_require_tenant_fixed("cid-A"), db=db)
    app_b, _ = _build_app(require_tenant=_require_tenant_fixed("cid-B"), db=db)
    assert TestClient(app_a).get("/me").json()["mp_connected"] is True
    assert TestClient(app_b).get("/me").json()["mp_connected"] is False


# --- Escala: las rutas de I/O BLOQUEANTE son `def` (threadpool), no `async def` --------
# Fix de escala (regla de oro "cero fricción para escalar"): psycopg2/httpx sync en una ruta
# `async def` bloquean el event loop y SERIALIZAN los requests multitenant. FastAPI corre las rutas
# `def` en su threadpool anyio -> no bloquean. Test estructural (guard de regresión) + funcional.

def _route_endpoint(app, path: str, method: str):
    """El callable original registrado para (path, method) en la app FastAPI."""
    method = method.upper()
    for route in app.routes:
        if getattr(route, "path", None) == path and method in getattr(route, "methods", set()):
            return route.endpoint
    raise AssertionError(f"ruta no encontrada: {method} {path}")


def test_blocking_io_routes_are_sync_def_not_coroutine():
    """/reply, /me, /auth/signup NO deben ser coroutines (correrían en el loop y lo bloquearían con
    su I/O sync). /chat SÍ es coroutine (await route_inbound, genuinamente async)."""
    app, _ = _build_app(require_tenant=_require_tenant_fixed("cid-A"))
    for path, method in (("/reply", "GET"), ("/me", "GET"), ("/auth/signup", "POST")):
        ep = _route_endpoint(app, path, method)
        assert not inspect.iscoroutinefunction(ep), f"{method} {path} debe ser `def` (threadpool), no `async def`"
    assert inspect.iscoroutinefunction(_route_endpoint(app, "/chat", "POST")), "/chat debe seguir siendo async"


def test_sync_routes_still_respond_correctly(monkeypatch):
    """Las 3 rutas convertidas a `def` responden IGUAL vía TestClient (paridad funcional tras el fix)."""
    monkeypatch.setattr(web_module, "route_inbound", _fake_route_inbound)
    db = _FakeTenantsDB()
    db.mp_sellers["cid-A"] = "seller-146"
    gotrue = _FakeGoTrue({"x@test.com": "auth-user-X"})
    app, _ = _build_app(require_tenant=_require_tenant_fixed("cid-A"), db=db, gotrue=gotrue,
                        read_replies_fn=lambda cid, sess, after: [{"id": 7, "reply_text": "ok",
                                                                   "choices": None, "created_at": "t"}])
    client = TestClient(app)
    assert client.get("/reply", params={"session_id": "s1"}).json()["next_id"] == 7
    assert client.get("/me").json() == {"cliente_id": "cid-A", "mp_connected": True, "composio_connected": []}
    assert client.post("/auth/signup", json={"email": "x@test.com", "password": "pw"}).json()["auth_user_id"] == "auth-user-X"


# --- /auth/oauth/ensure-tenant (Fase 5: first-login Google, self-provisioning del tenant) ------

def _google_claims(sub: str = "g-sub-1", email: str = "new@gmail.com") -> dict:
    return {"sub": sub, "email": email, "aud": "authenticated",
            "app_metadata": {"provider": "google", "providers": ["google"]}}


def test_oauth_ensure_tenant_google_provisions_and_returns_cliente_id():
    """Token de Google (provider != email) sin tenant → provisiona la fila y devuelve cliente_id."""
    db = _FakeTenantsDB()
    gotrue = _FakeGoTrue({})
    claims = _google_claims(sub="g-sub-1", email="new@gmail.com")
    app, _ = _build_app(require_tenant=_require_tenant_401(), db=db, gotrue=gotrue,
                        require_claims=_require_claims_fixed(claims))
    resp = TestClient(app).post("/auth/oauth/ensure-tenant")
    assert resp.status_code == 200
    cid = resp.json()["cliente_id"]
    assert db.tenants["g-sub-1"]["cliente_id"] == cid          # fila creada
    assert db.tenants["g-sub-1"]["email"] == "new@gmail.com"
    assert gotrue.claims["g-sub-1"] == cid                     # claim de paridad seteado


def test_oauth_ensure_tenant_idempotent():
    """2ª llamada con el mismo sub → mismo cliente_id, sin duplicar la fila."""
    db = _FakeTenantsDB()
    claims = _google_claims(sub="g-sub-2", email="dup@gmail.com")
    app, _ = _build_app(require_tenant=_require_tenant_401(), db=db, gotrue=_FakeGoTrue({}),
                        require_claims=_require_claims_fixed(claims))
    client = TestClient(app)
    cid1 = client.post("/auth/oauth/ensure-tenant").json()["cliente_id"]
    cid2 = client.post("/auth/oauth/ensure-tenant").json()["cliente_id"]
    assert cid1 == cid2
    assert len(db.tenants) == 1


def test_oauth_ensure_tenant_email_provider_forbidden():
    """Token de provider 'email' (alta admin-mediada) → 403 (no self-signup por la puerta de atrás)."""
    claims = {"sub": "e-sub", "email": "e@x.com", "aud": "authenticated",
              "app_metadata": {"provider": "email", "providers": ["email"]}}
    app, _ = _build_app(require_tenant=_require_tenant_401(),
                        require_claims=_require_claims_fixed(claims))
    assert TestClient(app).post("/auth/oauth/ensure-tenant").status_code == 403


def test_oauth_ensure_tenant_missing_email_400():
    """Token OAuth sin email → 400."""
    claims = {"sub": "g-sub-3", "aud": "authenticated",
              "app_metadata": {"provider": "google", "providers": ["google"]}}
    app, _ = _build_app(require_tenant=_require_tenant_401(),
                        require_claims=_require_claims_fixed(claims))
    assert TestClient(app).post("/auth/oauth/ensure-tenant").status_code == 400


def test_oauth_ensure_tenant_endpoint_absent_without_require_claims():
    """Sin require_claims inyectado, el endpoint POST NO se registra → no hay provisioning sin gate.
    (405, no 404: el catch-all GET del SPA mount matchea el path pero no el método POST.)"""
    app, _ = _build_app(require_tenant=_require_tenant_401())  # require_claims=None por default
    assert TestClient(app).post("/auth/oauth/ensure-tenant").status_code in (404, 405)
