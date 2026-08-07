"""Tests adversariales de aislamiento cross-tenant (Task 10 — REGLA DURA, precondición de merge).

El worker usa el rol OWNER de DATABASE_URL (bypassa RLS): la barrera EFECTIVA de todo el Copiloto
es el filtro `cliente_id` EXPLÍCITO en cada query + el `context_factory` que ata ESE cliente_id al
del request. Si ese filtro se rompiera en cualquier capa (store, context_factory, auth, ruta HTTP),
un tenant podría leer/operar sobre los datos de otro. Cada test acá simula un ATACANTE: siembra
datos de un tenant B, e intenta acceder con la identidad/credencial de un tenant A, y assert
DENEGACIÓN — nunca solo el happy-path de "cada quien ve lo suyo" (eso ya está cubierto en
test_mp_credential_store.py/test_context_factory.py/test_web_app.py; acá se ejercita el camino
HOSTIL de punta a punta, incluida la capa HTTP con una sola instancia de app sirviendo a los dos
tenants por token, contra la DB REAL del VPS).

Corre contra Postgres real (DATABASE_URL, dev loop `deploy_sync_test.sh`). Cada test siembra
auth_user_id/cliente_id/seller/session_id ÚNICOS (uuid4 + sufijo random) y el fixture `two_tenants`
limpia TODA la huella en el teardown — correr la suite 2x no rompe por residuos ni colisiona con
datos reales."""
from __future__ import annotations

import os
import sys
import uuid
from pathlib import Path

import pytest


from fastapi import HTTPException, Request  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

import web as web_module  # noqa: E402
from auth import resolve_cliente_id  # noqa: E402
from clients.agent.providers.crypto import FernetCrypto  # noqa: E402
from context_factory import make_context_factory  # noqa: E402
from contexto_tenant import conexion_con_tenant, declarar_tenant  # noqa: E402
from mp_credential_store import MpCredentialStore  # noqa: E402
from mp_payment_store import MpPaymentStore  # noqa: E402
from mp_web import create_mp_app  # noqa: E402
from reply_store import make_pg_reply_sink, read_replies  # noqa: E402

pytestmark = pytest.mark.skipif(not os.environ.get("DATABASE_URL"),
                                reason="requiere Postgres del VPS (DATABASE_URL)")

_SCHEMA = "uc_factory"


def _conn_factory_cruda():
    """SOLO para `uc_factory.tenants`: la tabla no tiene RLS (resuelve el tenant, no puede exigirlo
    de antemano) y `resolve_cliente_id` la consulta antes de que exista un tenant que declarar --
    es el mismo camino que usa el `require_tenant` real (`auth.py::resolve_cliente_id`)."""
    import psycopg2

    def f():
        c = psycopg2.connect(os.environ["DATABASE_URL"])
        c.autocommit = True
        return c
    return f


def _payment(pid: str, amount: float) -> dict:
    return {"id": pid, "status": "approved", "transaction_amount": amount,
            "external_reference": "adv-test", "payer": {"email": "adv@test.invalid"},
            "date_approved": "2026-07-03T00:00:00Z"}


class _Tenant:
    """Datos de un tenant sembrado en la DB real por el fixture `two_tenants`."""

    def __init__(self, *, auth_user_id: str, cliente_id: str, seller: str, session_id: str, token: str) -> None:
        self.auth_user_id = auth_user_id
        self.cliente_id = cliente_id
        self.seller = seller
        self.session_id = session_id
        self.token = token


@pytest.fixture
def crypto(monkeypatch):
    monkeypatch.setenv("COPILOTO_FERNET_KEY", FernetCrypto.generate_key())
    return FernetCrypto()


@pytest.fixture
def two_tenants(crypto, conn_de_tenant):
    """Siembra 2 tenants A/B en la DB REAL: fila `tenants`, credencial MP propia (seller distinto),
    reply propio (session_id distinto) y pago propio (amount distinto). uuid4 + sufijo random ->
    idempotente entre corridas (jamás colisiona con datos previos); teardown borra TODA la huella
    de (A, B) en las 4 tablas.

    `tenants` (sin RLS) se siembra/borra con conexión cruda -- es la tabla que resuelve el tenant, no
    puede exigirlo de antemano. Las otras 3 (`mp_credentials`, `copiloto_web_replies`, `mp_payments`)
    tienen `FORCE ROW LEVEL SECURITY`: cada escritura nace con `conn_de_tenant(cliente_id)`, como el
    borde real."""
    cf_cruda = _conn_factory_cruda()
    suffix = uuid.uuid4().hex[:8]
    a = _Tenant(auth_user_id=str(uuid.uuid4()), cliente_id=str(uuid.uuid4()),
                seller=f"seller-A-{suffix}", session_id=f"sess-A-{suffix}", token=f"TOKEN-A-{suffix}")
    b = _Tenant(auth_user_id=str(uuid.uuid4()), cliente_id=str(uuid.uuid4()),
                seller=f"seller-B-{suffix}", session_id=f"sess-B-{suffix}", token=f"TOKEN-B-{suffix}")

    conn = cf_cruda()
    with conn.cursor() as cur:
        for t, email in ((a, f"adv-a-{suffix}@test.invalid"), (b, f"adv-b-{suffix}@test.invalid")):
            cur.execute(
                f"INSERT INTO {_SCHEMA}.tenants (auth_user_id, cliente_id, email, composio_user_id) "
                f"VALUES (%s,%s,%s,%s)", (t.auth_user_id, t.cliente_id, email, t.cliente_id))

    MpCredentialStore(conn_de_tenant(a.cliente_id), a.cliente_id, crypto).save(
        a.seller, access_token="AT-A", refresh_token="RT-A", expires_at=1)
    MpCredentialStore(conn_de_tenant(b.cliente_id), b.cliente_id, crypto).save(
        b.seller, access_token="AT-B", refresh_token="RT-B", expires_at=1)

    sink_a = make_pg_reply_sink(conn_de_tenant(a.cliente_id))
    sink_a(a.cliente_id, a.session_id, "reply de A", None)
    sink_b = make_pg_reply_sink(conn_de_tenant(b.cliente_id))
    sink_b(b.cliente_id, b.session_id, "reply de B", None)

    MpPaymentStore(conn_de_tenant(a.cliente_id), a.cliente_id).upsert_from_payment(
        _payment(f"pay-A-{suffix}", 111.0), seller_user_id=a.seller)
    MpPaymentStore(conn_de_tenant(b.cliente_id), b.cliente_id).upsert_from_payment(
        _payment(f"pay-B-{suffix}", 222.0), seller_user_id=b.seller)

    yield a, b

    for cid in (a.cliente_id, b.cliente_id):
        conn_propia = conn_de_tenant(cid)()
        try:
            with conn_propia.cursor() as cur:
                cur.execute(f"DELETE FROM {_SCHEMA}.copiloto_web_replies WHERE cliente_id=%s", (cid,))
                cur.execute(f"DELETE FROM {_SCHEMA}.mp_payments WHERE cliente_id=%s", (cid,))
                cur.execute(f"DELETE FROM {_SCHEMA}.mp_credentials WHERE cliente_id=%s", (cid,))
        finally:
            conn_propia.close()

    cleanup_conn = cf_cruda()
    with cleanup_conn.cursor() as cur:
        for cid in (a.cliente_id, b.cliente_id):
            cur.execute(f"DELETE FROM {_SCHEMA}.tenants WHERE cliente_id=%s", (cid,))


# --- Store-level (MpCredentialStore / reply_store / MpPaymentStore) ---------------


def test_adversarial_credential_store_a_cannot_read_b_creds(two_tenants, crypto, conn_de_tenant):
    """A conoce (o adivina) el seller_user_id de B y pide esa credencial CON SU PROPIO cliente_id.
    Si el filtro cliente_id se hubiera perdido en el WHERE de `MpCredentialStore.get`, esto
    devolvería la credencial de B (fail-open). Debe ser None.

    Ahora hay DOS barreras: el filtro `cliente_id` del store, y el RLS de la conexión de A (declarada
    con `conn_de_tenant(a.cliente_id)`), que ya no puede ver la fila física de B."""
    a, b = two_tenants
    store_a = MpCredentialStore(conn_de_tenant(a.cliente_id), a.cliente_id, crypto)
    assert store_a.get(b.seller) is None


def test_adversarial_credential_store_first_seller_never_leaks_b(two_tenants, crypto, conn_de_tenant):
    """`first_seller_user_id()` (usado por `/me` y `context_factory` para resolver el seller sin env
    manual) debe resolver SIEMPRE el seller del cliente_id con el que se construyó el store, nunca
    el de otro tenant aunque ambos tengan filas en la misma tabla física."""
    a, b = two_tenants
    assert MpCredentialStore(conn_de_tenant(a.cliente_id), a.cliente_id, crypto).first_seller_user_id() == a.seller
    assert MpCredentialStore(conn_de_tenant(b.cliente_id), b.cliente_id, crypto).first_seller_user_id() == b.seller


def test_adversarial_reply_store_a_cannot_read_b_session(two_tenants, conn_de_tenant):
    """A conoce el session_id de B (ej. lo vio en un log/URL) y lo consulta con SU PROPIO
    cliente_id. Si `read_replies` filtrara solo por session_id (sin cliente_id), devolvería el
    reply de B. Debe ser vacío.

    Ahora hay DOS barreras: el filtro `cliente_id` de `read_replies`, y el RLS de la conexión de A
    (declarada con `conn_de_tenant(a.cliente_id)`)."""
    a, b = two_tenants
    assert read_replies(conn_de_tenant(a.cliente_id), a.cliente_id, b.session_id, 0) == []
    # control positivo: A SÍ ve su propio reply con su propio session_id -- si este control
    # fallara, el assert de arriba sería vacuo (pasaría igual con la ruta rota de otra forma).
    own = read_replies(conn_de_tenant(a.cliente_id), a.cliente_id, a.session_id, 0)
    assert [r["reply_text"] for r in own] == ["reply de A"]


def test_adversarial_payment_store_isolation_and_cash_sum_per_tenant(two_tenants, conn_de_tenant):
    """El BI de caja de A no debe listar NI sumar el pago de B. Si el filtro cliente_id faltara en
    `list_payments`/`sum_approved`, `sum_approved()` de A daría 333.0 (111+222) en vez de 111.0 --
    un tenant vería (y facturaría) la caja de otro."""
    a, b = two_tenants
    store_a = MpPaymentStore(conn_de_tenant(a.cliente_id), a.cliente_id)
    rows = store_a.list_payments()
    assert len(rows) == 1 and rows[0]["amount"] == 111.0
    assert store_a.sum_approved() == 111.0


# --- context_factory / auth (resolución per-request) ------------------------------


def test_adversarial_context_factory_binds_to_a_never_b(two_tenants, crypto):
    """El `TenantCtx` armado con `conv={"cliente_id": A}` debe atar TODO (el store y el seller
    resuelto) a A -- nunca al seller de B, aunque la misma factory sirva ambos tenants en el mismo
    proceso (patrón real: 1 worker, N tenants por request).

    Con RLS, el `conn_factory` de `context_factory` tiene que nacer declarando el tenant -- igual que
    en producción (`worker_b.py`: `conexion_con_tenant(_conn_crudo)` + `declarar_tenant(cliente_id)`
    antes de invocar la factory, costura C3)."""
    a, b = two_tenants
    cf = conexion_con_tenant(_conn_factory_cruda())
    declarar_tenant(a.cliente_id)
    try:
        factory = make_context_factory(conn_factory=cf, crypto=crypto)
        ctx_a = factory({"cliente_id": a.cliente_id})
    finally:
        declarar_tenant(None)
    assert ctx_a.mp_cred_store._cid == a.cliente_id
    assert ctx_a.mp_seller_user_id == a.seller
    assert ctx_a.mp_seller_user_id != b.seller


def test_adversarial_resolve_cliente_id_never_returns_other_tenant(two_tenants):
    """`resolve_cliente_id` (camino crítico de `require_tenant`) resuelve el `sub` del JWT de A al
    cliente_id de A -- nunca al de B, ni siquiera devuelve un valor ambiguo cuando ambos tenants
    están sembrados en la misma tabla. Contra `uc_factory.tenants`, que no tiene RLS -- es la tabla
    que resuelve el tenant, no puede exigirlo de antemano (mismo camino que el `require_tenant`
    real)."""
    a, b = two_tenants
    cf = _conn_factory_cruda()
    assert resolve_cliente_id(cf, a.auth_user_id) == a.cliente_id
    assert resolve_cliente_id(cf, a.auth_user_id) != b.cliente_id
    assert resolve_cliente_id(cf, b.auth_user_id) == b.cliente_id


# --- HTTP (misma instancia de app, distinguida SOLO por el Bearer token) ----------


class _RequireTenantByToken:
    """Fake de `require_tenant`: en vez de un cliente_id horneado (patrón de test_web_app.py, que
    alcanza para probar wiring), resuelve el cliente_id del BEARER TOKEN del request vía un dict.
    Con esto, la MISMA instancia de `FastAPI` app sirve a A o a B según el token que llegue --
    si una ruta ignorara `Depends(require_tenant)` y usara un cliente_id de closure/global, este
    fake lo delataría porque los dos tokens golpean la misma app.

    También `declarar_tenant(cliente_id)` -- igual que el `require_tenant` real (`auth.py`) -- porque
    el `conn_factory` de la app está envuelto con `conexion_con_tenant`: sin esto, con RLS, cada ruta
    vería 0 filas para los dos tenants, y el test no distinguiría "aislado" de "roto".

    `async def __call__`, NO `def`: medido en `auth.py::make_require_tenant` que una dependencia SYNC
    de FastAPI corre en un threadpool y el `ContextVar` que setea no llega al handler (0 filas, sin
    error). Con `def` acá el control positivo del test fallaría igual que si el aislamiento real
    estuviera roto -- sería el instrumento fallando, no la app."""

    def __init__(self, token_to_cid: dict[str, str]) -> None:
        self._token_to_cid = token_to_cid

    async def __call__(self, request: Request) -> str:
        authorization = request.headers.get("Authorization", "")
        scheme, _, token = authorization.partition(" ")
        if scheme.lower() != "bearer" or token not in self._token_to_cid:
            raise HTTPException(status_code=401, detail="invalid test token")
        cliente_id = self._token_to_cid[token]
        declarar_tenant(cliente_id)
        return cliente_id


class _NoopMpGateway:
    """Solo se usa para construir `mp_app`/`create_web_app` -- ninguna ruta de este archivo llama
    a MercadoPago real; `/mp/*` ya está cubierto en test_connect_endpoints.py/test_mp_web.py."""

    def connect_url(self, state: str) -> str:
        return f"https://mp.example/auth?state={state}"

    def exchange_code(self, code):  # pragma: no cover - no ejercitado acá
        raise NotImplementedError

    def verify_webhook(self, *a, **k):  # pragma: no cover - no ejercitado acá
        return False

    def get_payment(self, *a, **k):  # pragma: no cover - no ejercitado acá
        raise NotImplementedError


class _SpyComposioGateway:
    """`connections`: cliente_id -> lista de conexiones ACTIVE (para probar que /me no filtra
    composio_connected de un tenant hacia otro)."""

    def __init__(self, connections: dict[str, list] | None = None) -> None:
        self._connections = connections or {}

    def list_connections(self, user_id: str) -> list:
        return self._connections.get(user_id, [])

    def authorize(self, user_id: str, toolkit: str) -> str:
        return f"https://composio.example/connect?user={user_id}&toolkit={toolkit}"


def _build_http_app(two_tenants, crypto, *, composio_connections=None):
    """`cf` envuelto con `conexion_con_tenant` -- igual que `serve.py::_conn_factory_from_env` en
    producción -- porque `create_web_app` usa el `conn_factory` que recibe directo, sin volver a
    envolverlo (la declaración del tenant es responsabilidad del composition root, no de la app)."""
    a, b = two_tenants
    cf = conexion_con_tenant(_conn_factory_cruda())
    token_to_cid = {a.token: a.cliente_id, b.token: b.cliente_id}
    mp_app = create_mp_app(
        gateway=_NoopMpGateway(), crypto=crypto,
        cred_store_factory=lambda cid: MpCredentialStore(cf, cid, crypto),
        payment_store_factory=lambda cid: MpPaymentStore(cf, cid))
    app = web_module.create_web_app(
        temporal_client=None, adapter=None, conn_factory=cf,
        require_tenant=_RequireTenantByToken(token_to_cid),
        mp_app=mp_app, gotrue=None, mp_gateway=_NoopMpGateway(),
        composio_gateway=_SpyComposioGateway(composio_connections))
    return app


def test_adversarial_http_reply_endpoint_a_cannot_read_b_session(two_tenants, crypto):
    """A nivel HTTP: token de A + `session_id` de B (ej. adivinado/leakeado por otro canal) -> el
    front-door NUNCA debe devolver el reply de B. Si `/reply` derivara cliente_id de otra fuente que
    no fuera `Depends(require_tenant)` (querystring, header custom, etc.), este test lo cazaría."""
    a, b = two_tenants
    app = _build_http_app(two_tenants, crypto)
    client = TestClient(app)

    r = client.get("/reply", params={"session_id": b.session_id},
                   headers={"Authorization": f"Bearer {a.token}"})
    assert r.status_code == 200
    assert r.json()["replies"] == []

    # control positivo (misma app, mismo token): A SÍ ve su propio reply con su propio session_id --
    # sin esto, el assert de arriba podría pasar por una ruta rota distinta (ej. /reply siempre vacío).
    r_own = client.get("/reply", params={"session_id": a.session_id},
                       headers={"Authorization": f"Bearer {a.token}"})
    assert [x["reply_text"] for x in r_own.json()["replies"]] == ["reply de A"]
    declarar_tenant(None)  # higiene: no dejar el ContextVar de proceso apuntando a A entre tests


def test_adversarial_http_me_endpoint_reflects_only_own_tenant_state(two_tenants, crypto):
    """`/me` con el token de A refleja SOLO el estado de A (su propio mp_connected/seller propio,
    su propia lista de composio_connected) -- nunca el de B, aunque la MISMA instancia de app y el
    MISMO conn_factory (DB compartida) sirvan a ambos tenants."""
    a, b = two_tenants
    composio_connections = {a.cliente_id: [{"id": "1", "toolkit": "gmail", "status": "ACTIVE"}]}
    app = _build_http_app(two_tenants, crypto, composio_connections=composio_connections)
    client = TestClient(app)

    me_a = client.get("/me", headers={"Authorization": f"Bearer {a.token}"}).json()
    me_b = client.get("/me", headers={"Authorization": f"Bearer {b.token}"}).json()

    assert me_a == {"cliente_id": a.cliente_id, "mp_connected": True, "composio_connected": ["gmail"],
                    "es_admin": False}
    # B también conectó MP (su propio seller) -- prueba que el true de A no es un default global;
    # y B NO ve la conexión composio que solo existe para A.
    assert me_b == {"cliente_id": b.cliente_id, "mp_connected": True, "composio_connected": [],
                    "es_admin": False}
    declarar_tenant(None)  # higiene: no dejar el ContextVar de proceso apuntando a B entre tests
