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
    # extra_config: la app pasa {"memory": False} (apagada en el hito 5 §2). El fake lo acepta para no romper el
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
        self.tickets: dict[tuple[str, int], dict] = {}   # (cliente_id, id) -> fila de copiloto_tickets
        self.mensajes: list[dict] = []                   # [{cliente_id, ticket_id, id, autor, texto, created_at}]


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
            cliente_id, session_id, reply_text, choices, card, idem_key = params
            # Emula el índice único PARCIAL `(cliente_id, idem_key) WHERE idem_key IS NOT NULL`, igual
            # que el fake de `test_reply_store.py`. La semántica real se ejercita contra Postgres en
            # `test_reply_store.py::test_el_indice_parcial_deduplica_de_verdad`.
            if idem_key is not None and any(r["cliente_id"] == cliente_id and r.get("idem_key") == idem_key
                                            for r in self._db.replies):
                return
            row = {"id": len(self._db.replies) + 1, "cliente_id": cliente_id, "session_id": session_id,
                   "reply_text": reply_text, "choices": choices, "card": card, "idem_key": idem_key,
                   "created_at": "t"}
            self._db.replies.append(row)
        elif s.startswith("SELECT ID, REPLY_TEXT, CHOICES, CARD, CREATED_AT FROM UC_FACTORY.COPILOTO_WEB_REPLIES"):
            cliente_id, session_id, after_id = params
            self._rows = [(r["id"], r["reply_text"], r["choices"], r.get("card"), r["created_at"])
                         for r in self._db.replies
                         if r["cliente_id"] == cliente_id and r["session_id"] == session_id and r["id"] > after_id]
        elif s.startswith("SELECT ID, CODIGO, CANAL, ESTADO, ASUNTO, CREATED_AT, UPDATED_AT "
                          "FROM UC_FACTORY.COPILOTO_TICKETS"):
            cliente_id, ticket_id = params
            fila = self._db.tickets.get((cliente_id, ticket_id))
            self._result = ((fila["id"], fila["codigo"], fila["canal"], fila["estado"], fila["asunto"],
                             fila["created_at"], fila["updated_at"]) if fila else None)
        elif s.startswith("SELECT ID, AUTOR, TEXTO, CREATED_AT FROM UC_FACTORY.COPILOTO_MENSAJES"):
            cliente_id, ticket_id = params
            self._rows = [(m["id"], m["autor"], m["texto"], m["created_at"]) for m in self._db.mensajes
                         if m["cliente_id"] == cliente_id and m["ticket_id"] == ticket_id]
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

    def commit(self) -> None:
        pass

    def close(self) -> None:
        # `TicketStore` (a diferencia del resto de los stores de este archivo) abre/cierra la
        # conexión a mano en vez de context manager -- sin este no-op, `obtener_ticket`/
        # `listar_mensajes` revientan con AttributeError en vez de ejercitar el fake.
        pass


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
    también lo necesita — ambos leen `COPILOTO_FERNET_KEY` del env."""
    monkeypatch.setenv("COPILOTO_FERNET_KEY", FernetCrypto.generate_key())


def _build_app(*, require_tenant, db: _FakeTenantsDB | None = None, gotrue=None, read_replies_fn=None,
              mp_gateway=None, composio_gateway=None, warm_fn=None, require_claims=None,
              actividad_app=None):
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
        actividad_app=actividad_app,
        read_replies_fn=read_replies_fn,
        warm_fn=warm_fn,
    )
    return app, db


# --- /actividad: guard anti-stub-shadow (regresión 2026-07-22) ------------------
# Hasta 2026-07-22 un stub `@app.get("/actividad")` directo sobre `app` devolvía 501 y se registraba
# ANTES del `include_router(actividad_app)`, así que ensombrecía el router real EN SILENCIO: código
# verde en los unit del handler, front-door tapado en prod. Estos tests son el guard por el FRONT-DOOR
# (no por el handler suelto): construyen el mismo `create_web_app` que arma producción y verifican que
# `/actividad` lo sirve el router real. Si alguien re-introduce el stub, estos tests se ponen rojos.

def _actividad_app_real(require_tenant):
    """El router real de `/actividad` (hito-1, sin store → forma final vacía), montado en el front-door
    igual que en producción: recibe la MISMA dependencia `require_tenant` que el front-door real."""
    from actividad_web import create_actividad_app
    return create_actividad_app(require_tenant=require_tenant)


def test_actividad_no_es_stub_501_lo_sirve_el_router_real():
    dep = _require_tenant_fixed("emp-1")
    app, _ = _build_app(require_tenant=dep, actividad_app=_actividad_app_real(dep))
    r = TestClient(app).get("/actividad")
    assert r.status_code != 501, "el stub 501 volvió a ensombrecer el router real"
    assert r.status_code == 200
    assert r.json() == {"items": [], "cursor": None}   # forma del router real, no el detalle del stub


def test_actividad_funcion_invalida_es_400_no_501():
    # Prueba que la request LLEGA a la validación del router real (el stub ganaba ANTES de validar `q`/
    # `funcion`, devolviendo 501 en vez de 400 — la costura que rompía el contrato del front).
    dep = _require_tenant_fixed("emp-1")
    app, _ = _build_app(require_tenant=dep, actividad_app=_actividad_app_real(dep))
    r = TestClient(app).get("/actividad", params={"funcion": "facturas"})   # typo → 400
    assert r.status_code == 400


def test_actividad_exige_require_tenant():
    dep = _require_tenant_401()
    app, _ = _build_app(require_tenant=dep, actividad_app=_actividad_app_real(dep))
    r = TestClient(app).get("/actividad")
    assert r.status_code == 401


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


# --- /actividad: aislamiento estructural -------------------------------------------
# El comportamiento del front-door (no-501, 200 vacío, 400 funcion inválida, 401 sin token) lo cubre
# la sección "guard anti-stub-shadow" de más arriba, construida CON el router real montado. Acá queda
# sólo el blindaje ESTRUCTURAL de regla 7 sobre la firma del endpoint registrado.
# HISTORIA: hasta 2026-07-22 estos tests afirmaban un stub 501 (`ActividadItem`/"entradas firmadas",
# modelo clínico heredado que NO existe en este backend). Ese stub ensombrecía el router real en
# silencio; se borró (`fix/actividad-stub-shadow`) y `/actividad` sirve el feed unificado de verdad.

def test_actividad_route_binds_cliente_id_only_via_require_tenant_dependency():
    """Estructural (blindaje a futuro, regla 7): `cliente_id` del handler DEBE resolverse vía
    `Depends(require_tenant)` -- nunca aceptar un `cliente_id`/`cid` por querystring que permitiría
    pedir la actividad de OTRO tenant. Inspecciona el endpoint del router de actividad — el MISMO objeto
    que el front-door monta (`create_web_app` lo incluye vía `_IncludedRouter`, no lo copia), así que en
    `app.routes` no aparece por path: se inspecciona en su sub-app, que es donde vive el callable real.
    Que ESE router es el que sirve el front-door lo prueban los guards HTTP de la sección de arriba."""
    dep = _require_tenant_fixed("cid-A")
    actividad_app = _actividad_app_real(dep)
    ep = _route_endpoint(actividad_app, "/actividad", "GET")
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
    assert r.json() == {"cliente_id": "cid-A", "mp_connected": True, "composio_connected": [],
                        "es_admin": False}


def test_me_without_mp_connection_reports_false():
    app, _ = _build_app(require_tenant=_require_tenant_fixed("cid-B"))
    r = TestClient(app).get("/me")
    assert r.json() == {"cliente_id": "cid-B", "mp_connected": False, "composio_connected": [],
                        "es_admin": False}


def test_me_two_tenants_do_not_leak_mp_state():
    """Adversarial mínimo: el estado de A no se filtra a B por compartir el mismo front-door/DB fake."""
    db = _FakeTenantsDB()
    db.mp_sellers["cid-A"] = "seller-146"
    app_a, _ = _build_app(require_tenant=_require_tenant_fixed("cid-A"), db=db)
    app_b, _ = _build_app(require_tenant=_require_tenant_fixed("cid-B"), db=db)
    assert TestClient(app_a).get("/me").json()["mp_connected"] is True
    assert TestClient(app_b).get("/me").json()["mp_connected"] is False


def test_me_sin_require_claims_no_trae_email():
    """Composición sin `require_claims` (legacy/tests) -- la forma vieja se preserva tal cual."""
    app, _ = _build_app(require_tenant=_require_tenant_fixed("cid-C"))
    r = TestClient(app).get("/me")
    assert "email" not in r.json()


def test_me_sin_require_claims_es_admin_False_fail_closed():
    """Sin token que leer, `es_admin` no puede afirmarse -- fail-closed, no ausente ni error.
    Contrato `es_admin en /me`: rama sin `require_claims` (web.py sin claims inyectado)."""
    app, _ = _build_app(require_tenant=_require_tenant_fixed("cid-C"))
    r = TestClient(app).get("/me")
    assert r.json()["es_admin"] is False


def test_me_con_claim_de_admin_es_admin_True():
    """Contrato `es_admin en /me`: el MISMO predicado que usa `require_admin` (CONS0b)."""
    app, _ = _build_app(
        require_tenant=_require_tenant_fixed("cid-F"),
        require_claims=_require_claims_fixed(
            {"sub": "auth-f", "app_metadata": {"copiloto_admin": True}}))
    r = TestClient(app).get("/me")
    assert r.json()["es_admin"] is True


def test_me_con_claims_pero_sin_el_claim_de_admin_es_admin_False():
    app, _ = _build_app(
        require_tenant=_require_tenant_fixed("cid-G"),
        require_claims=_require_claims_fixed({"sub": "auth-g", "email": "g@x.test"}))
    r = TestClient(app).get("/me")
    assert r.json()["es_admin"] is False


def test_me_con_el_claim_en_user_metadata_NO_otorga_es_admin_True():
    """ADVERSARIAL -- `user_metadata` es auto-editable por el propio usuario (verificado en CONS0b);
    un claim ahí NO puede otorgar `es_admin`. Mismo criterio que `require_admin`."""
    app, _ = _build_app(
        require_tenant=_require_tenant_fixed("cid-H"),
        require_claims=_require_claims_fixed(
            {"sub": "auth-h", "user_metadata": {"copiloto_admin": True}}))
    r = TestClient(app).get("/me")
    assert r.json()["es_admin"] is False


def test_me_con_require_claims_trae_el_email_del_MISMO_token():
    """`email` sale del claim, no de una segunda fuente que pueda divergir del `cliente_id`
    resuelto por `require_tenant`."""
    app, _ = _build_app(require_tenant=_require_tenant_fixed("cid-D"),
                        require_claims=_require_claims_fixed({"sub": "auth-d", "email": "d@x.test"}))
    r = TestClient(app).get("/me")
    assert r.json()["email"] == "d@x.test"
    assert r.json()["cliente_id"] == "cid-D"


def test_me_con_require_claims_sin_email_en_el_token_da_null_no_ausente():
    """Login por teléfono/anónimo: el claim no trae `email` -- `None`, no inventado ni omitido."""
    app, _ = _build_app(require_tenant=_require_tenant_fixed("cid-E"),
                        require_claims=_require_claims_fixed({"sub": "auth-e"}))
    r = TestClient(app).get("/me")
    assert r.json()["email"] is None


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
    assert client.get("/me").json() == {"cliente_id": "cid-A", "mp_connected": True,
                                        "composio_connected": [], "es_admin": False}
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


def test_rate_limit_middleware_esta_cableado_en_el_front_door():
    """BETA-2.d: el front-door completo (no sólo /chat) queda envuelto por RateLimitMiddleware —
    la unidad del comportamiento (sliding-window, 429, IPs independientes) se prueba en
    test_rate_limit.py; acá sólo importa que `create_web_app` lo instale de verdad."""
    from rate_limit import RateLimitMiddleware

    app, _ = _build_app(require_tenant=_require_tenant_401())
    assert any(getattr(m, "cls", None) is RateLimitMiddleware for m in app.user_middleware)


# --- /soporte/chat (SOP4/C1+C4) -------------------------------------------------

def test_soporte_chat_without_token_returns_401(monkeypatch):
    monkeypatch.setattr(web_module, "route_inbound", _fake_route_inbound)
    app, _ = _build_app(require_tenant=_require_tenant_401())
    r = TestClient(app).post("/soporte/chat",
                             json={"session_id": "s1", "text": "hola", "funcion": "soporte_tecnico"})
    assert r.status_code == 401


def test_soporte_chat_funcion_invalida_es_400_C4_no_hay_clasificador_que_se_equivoque(monkeypatch):
    """C4: las tres funciones se enrutan por elección EXPLÍCITA -- un valor que no matchea la lista
    cerrada es 400, no un intento de adivinar a qué función se refería."""
    monkeypatch.setattr(web_module, "route_inbound", _fake_route_inbound)
    app, _ = _build_app(require_tenant=_require_tenant_fixed("cid-A"))
    r = TestClient(app).post("/soporte/chat",
                             json={"session_id": "s1", "text": "hola", "funcion": "atencion_al_cliente"})
    assert r.status_code == 400


def test_soporte_chat_devuelve_el_session_id_NAMESPACED_por_funcion(monkeypatch):
    """El workflow_id sale de (channel, cliente_id, channel_ref) sin domain -- sin namespacing, abrir
    soporte con el mismo session_id que ya usa /chat reusaría el workflow de 'emprendedor'."""
    monkeypatch.setattr(web_module, "route_inbound", _fake_route_inbound)
    app, _ = _build_app(require_tenant=_require_tenant_fixed("cid-A"))
    r = TestClient(app).post("/soporte/chat",
                             json={"session_id": "s1", "text": "hola", "funcion": "soporte_tecnico"})
    assert r.status_code == 200
    body = r.json()
    assert body["accepted"] is True
    assert body["session_id"] == "soporte:soporte_tecnico:s1"
    assert body["wf_id"] == "conv-web-cid-A-soporte:soporte_tecnico:s1"


def test_soporte_chat_session_id_ya_namespaced_NO_se_duplica(monkeypatch):
    """Regresión (hallazgo backend 2026-08-11, device real, conversación de 15+ turnos): el
    frontend re-envía como `session_id` el valor NAMESPACED que esta misma ruta le devolvió en el
    turno anterior (así está diseñado -- ver docstring de la ruta). Sin idempotencia, cada turno
    sumaba OTRO prefijo hasta que el workflow_id excedía el límite de Temporal
    (`RPCError: WorkflowId length exceeds limit`) y el hilo quedaba roto para siempre."""
    monkeypatch.setattr(web_module, "route_inbound", _fake_route_inbound)
    app, _ = _build_app(require_tenant=_require_tenant_fixed("cid-A"))
    client = TestClient(app)
    r1 = client.post("/soporte/chat",
                     json={"session_id": "s1", "text": "turno 1", "funcion": "soporte_tecnico"})
    session_id_devuelto = r1.json()["session_id"]
    assert session_id_devuelto == "soporte:soporte_tecnico:s1"

    r2 = client.post("/soporte/chat",
                     json={"session_id": session_id_devuelto, "text": "turno 2",
                           "funcion": "soporte_tecnico"})
    assert r2.json()["session_id"] == "soporte:soporte_tecnico:s1"

    r3 = client.post("/soporte/chat",
                     json={"session_id": r2.json()["session_id"], "text": "turno 3",
                           "funcion": "soporte_tecnico"})
    assert r3.json()["session_id"] == "soporte:soporte_tecnico:s1"


def test_soporte_chat_las_DOS_funciones_del_MISMO_session_id_NO_colisionan(monkeypatch):
    monkeypatch.setattr(web_module, "route_inbound", _fake_route_inbound)
    app, _ = _build_app(require_tenant=_require_tenant_fixed("cid-A"))
    client = TestClient(app)
    r1 = client.post("/soporte/chat",
                     json={"session_id": "s1", "text": "hola", "funcion": "soporte_tecnico"})
    r2 = client.post("/soporte/chat",
                     json={"session_id": "s1", "text": "hola", "funcion": "como_uso_la_app"})
    assert r1.json()["wf_id"] != r2.json()["wf_id"]


def test_soporte_chat_NO_colisiona_con_el_chat_del_copiloto_mismo_session_id(monkeypatch):
    monkeypatch.setattr(web_module, "route_inbound", _fake_route_inbound)
    app, _ = _build_app(require_tenant=_require_tenant_fixed("cid-A"))
    client = TestClient(app)
    r_copiloto = client.post("/chat", json={"session_id": "s1", "text": "hola"})
    r_soporte = client.post("/soporte/chat",
                            json={"session_id": "s1", "text": "hola", "funcion": "soporte_tecnico"})
    assert r_copiloto.json()["wf_id"] != r_soporte.json()["wf_id"]


# --- GET /soporte/tickets/{ticket_id} (S6-11) -----------------------------------
# `pedido_frontend-a-todos_S6-11-falta-endpoint-de-usuario-para-leer-su-propio-ticket.md`: el
# usuario final necesita leer el hilo de SU ticket. El aislamiento cross-tenant (H1) ya está
# probado contra Postgres real en test_soporte_store.py -- acá sólo importa que la RUTA delegue en
# `TicketStore` con el `cliente_id` de `require_tenant`, nunca de la URL.

def _seed_ticket(db: _FakeTenantsDB, *, cliente_id: str, ticket_id: int = 1,
                 codigo: str = "SOP-0001") -> None:
    db.tickets[(cliente_id, ticket_id)] = {
        "id": ticket_id, "codigo": codigo, "canal": "soporte_tecnico", "estado": "abierto",
        "asunto": "no puedo facturar", "created_at": "t1", "updated_at": "t1"}
    db.mensajes.append({"cliente_id": cliente_id, "ticket_id": ticket_id, "id": 1,
                        "autor": "usuario", "texto": "AFIP me tira un error raro", "created_at": "t1"})


def test_soporte_ticket_propio_sin_token_401():
    app, _ = _build_app(require_tenant=_require_tenant_401())
    r = TestClient(app).get("/soporte/tickets/1")
    assert r.status_code == 401


def test_soporte_ticket_propio_200_con_el_hilo_completo():
    db = _FakeTenantsDB()
    _seed_ticket(db, cliente_id="cid-A")
    app, _ = _build_app(require_tenant=_require_tenant_fixed("cid-A"), db=db)
    r = TestClient(app).get("/soporte/tickets/1")
    assert r.status_code == 200
    body = r.json()
    assert body["ticket"]["codigo"] == "SOP-0001"
    assert body["ticket"]["estado"] == "abierto"
    assert len(body["mensajes"]) == 1
    assert body["mensajes"][0]["texto"] == "AFIP me tira un error raro"


def test_soporte_ticket_propio_404_si_no_existe():
    app, _ = _build_app(require_tenant=_require_tenant_fixed("cid-A"), db=_FakeTenantsDB())
    r = TestClient(app).get("/soporte/tickets/999")
    assert r.status_code == 404


def test_soporte_ticket_propio_404_si_es_de_otro_tenant():
    """El mismo 404 que 'no existe' -- H1: no hay una segunda respuesta que delate que el ticket sí
    existe pero es ajeno."""
    db = _FakeTenantsDB()
    _seed_ticket(db, cliente_id="cid-A")
    app, _ = _build_app(require_tenant=_require_tenant_fixed("cid-B"), db=db)
    r = TestClient(app).get("/soporte/tickets/1")
    assert r.status_code == 404
