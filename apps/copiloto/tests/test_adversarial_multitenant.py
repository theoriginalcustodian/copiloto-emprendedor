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
from mi_dia_web import create_mi_dia_app  # noqa: E402
from mp_credential_store import MpCredentialStore  # noqa: E402
from tenant_onboarding_store import TenantOnboardingStore  # noqa: E402
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
    composio_connected de un tenant hacia otro). `eventos_por_user`: cliente_id -> resultado crudo
    de FIND_EVENT (para CAL1: cada tenant tiene SUS propios eventos "reales" en Composio, y el test
    adversarial verifica que A nunca reciba los de B)."""

    def __init__(self, connections: dict[str, list] | None = None,
                eventos_por_user: dict[str, dict] | None = None) -> None:
        self._connections = connections or {}
        self._eventos_por_user = eventos_por_user or {}
        self.execute_calls: list[dict] = []

    def list_connections(self, user_id: str) -> list:
        return self._connections.get(user_id, [])

    def authorize(self, user_id: str, toolkit: str) -> str:
        return f"https://composio.example/connect?user={user_id}&toolkit={toolkit}"

    def execute(self, slug: str, *, user_id: str, arguments: dict, confirmed: bool) -> dict:
        self.execute_calls.append({"slug": slug, "user_id": user_id, "arguments": arguments})
        return self._eventos_por_user.get(user_id, {"data": {"items": []}})


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


def _build_mi_dia_http_app(two_tenants, *, gw: _SpyComposioGateway):
    """Mismo criterio que `_build_http_app`: UNA instancia de `mi_dia_app`, distinguida sólo por el
    Bearer token, para que un `require_tenant` roto (closure/global en vez de `Depends`) se delate
    con los dos tenants golpeando el mismo proceso -- acá aplicado a `/mi-dia/calendario` (CAL1)."""
    a, b = two_tenants
    token_to_cid = {a.token: a.cliente_id, b.token: b.cliente_id}
    return create_mi_dia_app(require_tenant=_RequireTenantByToken(token_to_cid), composio_gateway=gw)


def test_adversarial_http_calendario_a_cannot_read_b_events(two_tenants):
    """CAL1: A y B tienen cada uno sus propios eventos "reales" en Composio (simulados por
    `_SpyComposioGateway.eventos_por_user`, indexados por cliente_id). Con el token de A, el
    endpoint NUNCA debe devolver ni pedirle a Composio los eventos de B -- si `/mi-dia/calendario`
    derivara el `user_id` de otra fuente que no fuera `Depends(require_tenant)`, este test lo cazaría
    (mismo patrón que `test_adversarial_http_reply_endpoint_a_cannot_read_b_session`)."""
    a, b = two_tenants
    eventos_por_user = {
        a.cliente_id: {"data": {"items": [{"id": "evt-a", "summary": "Evento de A", "start": {}}]}},
        b.cliente_id: {"data": {"items": [{"id": "evt-b", "summary": "Evento de B", "start": {}}]}},
    }
    gw = _SpyComposioGateway(eventos_por_user=eventos_por_user)
    client = TestClient(_build_mi_dia_http_app(two_tenants, gw=gw))

    r_a = client.get("/mi-dia/calendario", headers={"Authorization": f"Bearer {a.token}"})
    assert r_a.status_code == 200
    assert [e["id"] for e in r_a.json()["eventos"]] == ["evt-a"]

    # control positivo (mismo proceso, token distinto): B ve SUS propios eventos, no los de A ni una
    # respuesta vacía por accidente -- sin esto, un endpoint que siempre devolviera [] pasaría el
    # assert de arriba por la razón equivocada.
    r_b = client.get("/mi-dia/calendario", headers={"Authorization": f"Bearer {b.token}"})
    assert r_b.status_code == 200
    assert [e["id"] for e in r_b.json()["eventos"]] == ["evt-b"]

    assert [c["user_id"] for c in gw.execute_calls] == [a.cliente_id, b.cliente_id]
    declarar_tenant(None)  # higiene: no dejar el ContextVar de proceso apuntando a B entre tests


def test_adversarial_http_calendario_con_rango_a_cannot_read_b_events(two_tenants):
    """K-13: mismo aislamiento que CAL1 pero CON `?desde&hasta` de 7 días. La ventana ampliada no puede
    cambiar de quién es el `user_id` que viaja a Composio: A pide 7 días y a Composio sólo llega A, con el
    rango pedido; nada de B se lee ni se devuelve."""
    a, b = two_tenants
    eventos_por_user = {
        a.cliente_id: {"data": {"items": [{"id": "evt-a", "summary": "Evento de A", "start": {}}]}},
        b.cliente_id: {"data": {"items": [{"id": "evt-b", "summary": "Evento de B", "start": {}}]}},
    }
    gw = _SpyComposioGateway(eventos_por_user=eventos_por_user)
    client = TestClient(_build_mi_dia_http_app(two_tenants, gw=gw))
    rango = {"desde": "2026-09-22", "hasta": "2026-09-28"}

    r_a = client.get("/mi-dia/calendario", params=rango, headers={"Authorization": f"Bearer {a.token}"})
    assert r_a.status_code == 200
    assert [e["id"] for e in r_a.json()["eventos"]] == ["evt-a"]
    assert [c["user_id"] for c in gw.execute_calls] == [a.cliente_id]   # a Composio no llegó B
    args = gw.execute_calls[0]["arguments"]
    assert "2026-09-22" in args["time_min"] and "2026-09-28" in args["time_max"]   # el rango pedido viajó

    # control positivo: B con el mismo rango ve SUS eventos (un endpoint que devolviera vacío pasaría lo de arriba).
    r_b = client.get("/mi-dia/calendario", params=rango, headers={"Authorization": f"Bearer {b.token}"})
    assert [e["id"] for e in r_b.json()["eventos"]] == ["evt-b"]
    assert [c["user_id"] for c in gw.execute_calls] == [a.cliente_id, b.cliente_id]
    declarar_tenant(None)


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


def test_adversarial_http_reply_card_a_cannot_read_b_card(two_tenants, crypto, conn_de_tenant):
    """K-07-B contrato §3 (auditoría A2): mismo patrón que el test de arriba, pero sobre `card` -- la
    metadata HITL/sugerencia (K-11/K-07-B) que viaja en la MISMA fila que `reply_text`. `card` es un
    payload nuevo; sin un assert propio, un bug que sólo tocara SU proyección (ej. un JOIN que la
    resolviera por fuera del filtro `cliente_id`/`session_id` de `reply_store.read_replies`) pasaría
    inadvertido detrás del test de `reply_text`, que no mira `card`."""
    a, b = two_tenants
    card_a = {"kind": "requiere_conexion", "service": "gmail", "label": "Gmail", "bloquea": True,
              "alcance": ["Leer mails"], "connect_path": "/composio/connect?service=gmail"}
    card_b = {"kind": "sugerencia_armar_factura", "presupuesto_id": 999, "texto": "¿Te armo la factura?",
              "bloquea": False}
    make_pg_reply_sink(conn_de_tenant(a.cliente_id))(a.cliente_id, a.session_id, "conectá Gmail", None, card_a)
    make_pg_reply_sink(conn_de_tenant(b.cliente_id))(b.cliente_id, b.session_id, "¿armo la factura?", None, card_b)

    app = _build_http_app(two_tenants, crypto)
    client = TestClient(app)

    # token de A + session_id de B: ni texto ni card de B viajan.
    r = client.get("/reply", params={"session_id": b.session_id},
                   headers={"Authorization": f"Bearer {a.token}"})
    assert r.status_code == 200
    assert r.json()["replies"] == []

    # control positivo: cada uno ve SU PROPIA card con su propio token+session (nunca la del otro, y
    # nunca None por una proyección que la pierda).
    r_a = client.get("/reply", params={"session_id": a.session_id},
                     headers={"Authorization": f"Bearer {a.token}"})
    assert [x["card"] for x in r_a.json()["replies"]][-1] == card_a

    r_b = client.get("/reply", params={"session_id": b.session_id},
                     headers={"Authorization": f"Bearer {b.token}"})
    assert [x["card"] for x in r_b.json()["replies"]][-1] == card_b
    declarar_tenant(None)  # higiene: no dejar el ContextVar de proceso apuntando a B entre tests


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
                    "es_admin": False, "cuenta_google": False, "onboarding_completado": False}
    # B también conectó MP (su propio seller) -- prueba que el true de A no es un default global;
    # y B NO ve la conexión composio que solo existe para A.
    assert me_b == {"cliente_id": b.cliente_id, "mp_connected": True, "composio_connected": [],
                    "es_admin": False, "cuenta_google": False, "onboarding_completado": False}
    declarar_tenant(None)  # higiene: no dejar el ContextVar de proceso apuntando a B entre tests


def test_adversarial_http_catalog_reflects_only_own_tenant_state(two_tenants, crypto, conn_de_tenant):
    """`GET /catalog` (gap store-only señalado en #660, contrato STORE3): usa
    `MpCredentialStore.salud()` + `composio_gateway.list_connections`, mismo dato que `/me` pero con
    metadata de presentación. Mismo patrón que `test_adversarial_http_me_endpoint_...`: si `/catalog`
    derivara el tenant de otra fuente que no fuera `Depends(require_tenant)`, este test lo cazaría.

    Borro la credencial MP de B (que el fixture `two_tenants` sembró vencida, igual que la de A) para
    que A y B queden en estados DISTINTOS ("caido" vs "nunca_conectado") -- si el status cruzara de
    tenant, ambos leerían el mismo valor por accidente."""
    a, b = two_tenants
    MpCredentialStore(conn_de_tenant(b.cliente_id), b.cliente_id, crypto).delete_all()
    composio_connections = {a.cliente_id: [{"id": "1", "toolkit": "gmail", "status": "ACTIVE"}]}
    app = _build_http_app(two_tenants, crypto, composio_connections=composio_connections)
    client = TestClient(app)

    cat_a = client.get("/catalog", headers={"Authorization": f"Bearer {a.token}"}).json()["services"]
    cat_b = client.get("/catalog", headers={"Authorization": f"Bearer {b.token}"}).json()["services"]

    mp_a = next(s for s in cat_a if s["key"] == "mercadopago")
    mp_b = next(s for s in cat_b if s["key"] == "mercadopago")
    assert mp_a["status"] == "caido"            # A: la credencial vencida del fixture
    assert mp_b["status"] == "nunca_conectado"  # B: borrada -- si "caido" cruzara de A, fallaría acá

    gmail_a = next(s for s in cat_a if s["key"] == "gmail")
    gmail_b = next(s for s in cat_b if s["key"] == "gmail")
    assert gmail_a["connected"] is True
    assert gmail_b["connected"] is False  # composio_connected de A no se filtra hacia B
    declarar_tenant(None)  # higiene: no dejar el ContextVar de proceso apuntando a B entre tests


def test_adversarial_http_mp_disconnect_a_cannot_delete_b_connection(two_tenants, crypto, conn_de_tenant):
    """`DELETE /mp/connection` AGRAVA respecto a los tests de arriba: no es una lectura que se filtra,
    es una MUTACIÓN que borra filas. El caso hostil no es "A ve algo de B" -- es que la conexión de B,
    sembrada por el MISMO fixture, siga viva después de que A la borra con SU PROPIO token. Que la
    respuesta de A sea 200/404 no prueba nada por sí solo (contrato STORE3 §3): lo que prueba el
    aislamiento es leer la fila de B directamente del store DESPUÉS del DELETE de A."""
    a, b = two_tenants
    app = _build_http_app(two_tenants, crypto)
    client = TestClient(app)

    # control positivo de la mutación misma: A borra SU PROPIA conexión (sembrada por el fixture).
    r = client.delete("/mp/connection", headers={"Authorization": f"Bearer {a.token}"})
    assert r.status_code == 200
    assert r.json() == {"desconectado": True, "revocadas": 1}

    # el caso hostil: la conexión de B sigue viva -- el DELETE de A no debe haber tocado su fila.
    assert MpCredentialStore(conn_de_tenant(b.cliente_id), b.cliente_id, crypto).get(b.seller) is not None

    # A ya no tiene nada que borrar -> 404 (no hay ambigüedad entre "no tenía" y "no puede").
    r2 = client.delete("/mp/connection", headers={"Authorization": f"Bearer {a.token}"})
    assert r2.status_code == 404
    declarar_tenant(None)  # higiene: no dejar el ContextVar de proceso apuntando a A entre tests


# --- K-14: onboarding_completado por tenant ---------------------------------------

def test_K14_completar_con_el_cliente_de_A_no_cambia_la_fila_de_B(two_tenants, conn_de_tenant):
    a, b = two_tenants
    TenantOnboardingStore(conn_de_tenant(a.cliente_id), a.cliente_id).completar()
    assert TenantOnboardingStore(conn_de_tenant(b.cliente_id), b.cliente_id).completado() is False


def test_adversarial_http_onboarding_completar_a_cannot_complete_for_b(two_tenants, crypto):
    """`POST /me/onboarding/completar` a nivel HTTP (gap del mismo patrón que K-14 store-level, señalado
    por planificación en #660/contrato STORE3): el test de arriba recibe el `cliente_id` YA RESUELTO y
    no ejercita `require_tenant`. De paso cierra el menor de la misma corrida: el test HTTP de `/me`
    nunca ejercitaba `onboarding_completado=True` -- acá sí, vía `/me` después de completar."""
    a, b = two_tenants
    app = _build_http_app(two_tenants, crypto)
    client = TestClient(app)

    r = client.post("/me/onboarding/completar", headers={"Authorization": f"Bearer {a.token}"})
    assert r.status_code == 200
    assert r.json() == {"onboarding_completado": True}

    me_a = client.get("/me", headers={"Authorization": f"Bearer {a.token}"}).json()
    me_b = client.get("/me", headers={"Authorization": f"Bearer {b.token}"}).json()
    assert me_a["onboarding_completado"] is True
    assert me_b["onboarding_completado"] is False  # completar de A no cambió la fila de B
    declarar_tenant(None)  # higiene: no dejar el ContextVar de proceso apuntando a B entre tests


# --- K-08: feedback propio ("Lo pediste vos") -------------------------------------

def test_K08_el_feedback_de_A_no_aparece_en_la_lista_de_B(two_tenants, conn_de_tenant):
    from feedback_store import FeedbackStore
    a, b = two_tenants
    try:
        fid = FeedbackStore(conn_de_tenant(a.cliente_id), a.cliente_id).crear(
            tipo="texto", texto="secreto de A", contexto=None)
        assert [i["id"] for i in FeedbackStore(conn_de_tenant(a.cliente_id), a.cliente_id).listar_propio()] == [fid]
        assert FeedbackStore(conn_de_tenant(b.cliente_id), b.cliente_id).listar_propio() == []
    finally:
        conn = conn_de_tenant(a.cliente_id)()
        with conn.cursor() as cur:
            cur.execute("DELETE FROM uc_factory.copiloto_feedback WHERE cliente_id = %s", (a.cliente_id,))
        conn.commit()
        conn.close()


def test_adversarial_http_feedback_a_cannot_read_b_feedback(two_tenants, crypto, conn_de_tenant):
    """K-08 a nivel HTTP (gap encontrado por planificación, 2026-09-22): el test de arriba ejercita el
    aislamiento a nivel STORE con el `cliente_id` YA RESUELTO -- no pasa por `require_tenant`, que es
    justo la pieza que decide de quién es el request. Si `/feedback` derivara el tenant de otra fuente
    (query param, header custom, default), ese test pasaría igual. Mismo patrón que
    `test_adversarial_http_reply_endpoint_a_cannot_read_b_session`: token real contra el endpoint HTTP
    real, con control positivo para que un endpoint que siempre devolviera `[]` no pase por accidente."""
    from feedback_store import FeedbackStore
    a, b = two_tenants
    try:
        FeedbackStore(conn_de_tenant(a.cliente_id), a.cliente_id).crear(
            tipo="texto", texto="secreto de A", contexto=None)
        FeedbackStore(conn_de_tenant(b.cliente_id), b.cliente_id).crear(
            tipo="texto", texto="secreto de B", contexto=None)

        app = _build_http_app(two_tenants, crypto)
        client = TestClient(app)

        r_a = client.get("/feedback", headers={"Authorization": f"Bearer {a.token}"})
        assert r_a.status_code == 200
        assert [i["texto"] for i in r_a.json()["items"]] == ["secreto de A"]

        # control positivo (misma app, token distinto): B ve SU PROPIO feedback, nunca el de A ni una
        # lista vacía por accidente -- sin esto, un endpoint que siempre devolviera [] pasaría el
        # assert de arriba por la razón equivocada.
        r_b = client.get("/feedback", headers={"Authorization": f"Bearer {b.token}"})
        assert r_b.status_code == 200
        assert [i["texto"] for i in r_b.json()["items"]] == ["secreto de B"]
        declarar_tenant(None)  # higiene: no dejar el ContextVar de proceso apuntando a B entre tests
    finally:
        conn = conn_de_tenant(a.cliente_id)()
        with conn.cursor() as cur:
            cur.execute("DELETE FROM uc_factory.copiloto_feedback WHERE cliente_id IN (%s, %s)",
                        (a.cliente_id, b.cliente_id))
        conn.commit()
        conn.close()
