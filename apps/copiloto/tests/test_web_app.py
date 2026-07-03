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

APP = Path(__file__).resolve().parents[1]
ARCH = APP.parents[1] / "deploy/skeleton_kit/archetypes/conversational_agent/reference"
sys.path.insert(0, str(ARCH))
sys.path.insert(0, str(APP))

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


async def _fake_route_inbound(client, *, adapter, cliente_id, domain, task_queue, raw_update):
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
            cliente_id, session_id, reply_text, choices = params
            row = {"id": len(self._db.replies) + 1, "cliente_id": cliente_id, "session_id": session_id,
                   "reply_text": reply_text, "choices": choices, "created_at": "t"}
            self._db.replies.append(row)
        elif s.startswith("SELECT ID, REPLY_TEXT, CHOICES, CREATED_AT FROM UC_FACTORY.COPILOTO_WEB_REPLIES"):
            cliente_id, session_id, after_id = params
            self._rows = [(r["id"], r["reply_text"], r["choices"], r["created_at"])
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
              mp_gateway=None, composio_gateway=None):
    db = db or _FakeTenantsDB()
    app = web_module.create_web_app(
        temporal_client=_FakeTemporal(),
        adapter=WebChannelAdapter(reply_sink=lambda *a: None),
        conn_factory=_fake_conn_factory(db),
        require_tenant=require_tenant,
        mp_app=_build_mp_app(),
        gotrue=gotrue or _FakeGoTrue({}),
        mp_gateway=mp_gateway or _FakeMpGateway(),
        composio_gateway=composio_gateway or _FakeComposioGateway(),
        read_replies_fn=read_replies_fn,
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
