"""Tests de apps/copiloto/onboarding.py (Task 3 del sprint deploy vivo + multitenant).

Cubre `signup_and_provision`: crea la fila `tenants` con `composio_user_id == cliente_id`;
2ª llamada con el mismo email/auth_user_id es idempotente (no duplica, mismo cliente_id); el
claim se setea con el `cliente_id` correcto. `gotrue` SIEMPRE es un fake determinístico (regla
del brief: nunca llamar al GoTrue real desde los tests); `conn_factory` es real (VPS, DATABASE_URL)
— usa `auth_user_id` fijos de test y limpia `uc_factory.tenants` al final.

Cubre TAMBIÉN `GoTrueAdmin.admin_create_user` a nivel transporte con `httpx.MockTransport` (sin
red real): create OK (POST 200) y la tolerancia al 422 (email ya registrado → GET lookup →
devuelve el user existente, sin excepción). Esos tests NO tocan la DB (no llevan `_db_required`).
El 422 REAL contra GoTrue no se prueba acá (se valida en el go-live smoke, Task 12) — acá se
ejercita la LÓGICA de tolerancia con un transport fake, que es lo verificable en sesión."""
from __future__ import annotations

import os

import httpx
import psycopg2
import pytest

from onboarding import GoTrueAdmin, signup_and_provision

_db_required = pytest.mark.skipif(not os.environ.get("DATABASE_URL"),
                                  reason="requiere Postgres del VPS (DATABASE_URL)")

# auth_user_id fijos de test (Task 3) — no colisionan con datos reales (namespace 00000000-...-00003X)
TEST_AUTH_USER_A = "00000000-0000-0000-0000-000000000031"
TEST_AUTH_USER_B = "00000000-0000-0000-0000-000000000032"
TEST_AUTH_USER_C = "00000000-0000-0000-0000-000000000033"
_ALL_TEST_AUTH_USERS = (TEST_AUTH_USER_A, TEST_AUTH_USER_B, TEST_AUTH_USER_C)


def _conn_factory():
    def f():
        c = psycopg2.connect(os.environ["DATABASE_URL"])
        c.autocommit = True
        return c
    return f


def _fetch_tenant_row(conn_factory, auth_user_id: str):
    conn = conn_factory()
    with conn.cursor() as cur:
        cur.execute(
            "SELECT cliente_id::text, composio_user_id, email FROM uc_factory.tenants "
            "WHERE auth_user_id=%s", (auth_user_id,))
        return cur.fetchone()


def _count_tenant_rows(conn_factory, auth_user_id: str) -> int:
    conn = conn_factory()
    with conn.cursor() as cur:
        cur.execute("SELECT count(*) FROM uc_factory.tenants WHERE auth_user_id=%s", (auth_user_id,))
        return cur.fetchone()[0]


class _FakeGoTrue:
    """Fake determinístico que MODELA la semántica real de `admin_create_user` (create-or-lookup):
    mapea email -> auth_user_id fijo; la 1ª vez "crea" (registra el email), en las siguientes
    "detecta" el email ya registrado (equivalente al 422→lookup del GoTrue real) y devuelve el
    MISMO user id — incrementando `lookups` para poder assertar que ese camino se ejercitó.
    Registra los claims seteados (`user_id -> cliente_id`) para assertar sobre `admin_set_claim`
    sin tocar GoTrue real."""

    def __init__(self, email_to_auth_user_id: dict) -> None:
        self._registry = email_to_auth_user_id
        self._created: set[str] = set()
        self.lookups = 0
        self.claims: dict[str, str] = {}

    def admin_create_user(self, email: str, password: str) -> dict:
        if email in self._created:
            self.lookups += 1          # simula el 422 → lookup del user existente (idempotente)
        else:
            self._created.add(email)
        return {"id": self._registry[email], "email": email}

    def admin_set_claim(self, user_id: str, cliente_id: str) -> None:
        self.claims[user_id] = cliente_id


@pytest.fixture
def cleanup_tenants():
    yield
    conn = _conn_factory()()
    with conn.cursor() as cur:
        cur.execute(
            "DELETE FROM uc_factory.tenants WHERE auth_user_id = ANY(%s::uuid[])",
            (list(_ALL_TEST_AUTH_USERS),),
        )


@_db_required
def test_signup_and_provision_creates_tenant_with_matching_composio_user_id(cleanup_tenants):
    conn_factory = _conn_factory()
    gotrue = _FakeGoTrue({"a@test.com": TEST_AUTH_USER_A})

    result = signup_and_provision(email="a@test.com", password="pw", gotrue=gotrue, conn_factory=conn_factory)

    assert result["auth_user_id"] == TEST_AUTH_USER_A
    assert result["email"] == "a@test.com"
    assert result["cliente_id"]

    row = _fetch_tenant_row(conn_factory, TEST_AUTH_USER_A)
    assert row is not None
    cliente_id_db, composio_user_id_db, email_db = row
    assert cliente_id_db == result["cliente_id"]
    assert composio_user_id_db == cliente_id_db      # composio_user_id == cliente_id (spec §4)
    assert email_db == "a@test.com"


@_db_required
def test_signup_and_provision_idempotent_same_auth_user_no_duplicate(cleanup_tenants):
    conn_factory = _conn_factory()
    gotrue = _FakeGoTrue({"b@test.com": TEST_AUTH_USER_B})

    r1 = signup_and_provision(email="b@test.com", password="pw", gotrue=gotrue, conn_factory=conn_factory)
    r2 = signup_and_provision(email="b@test.com", password="pw", gotrue=gotrue, conn_factory=conn_factory)

    assert r1["cliente_id"] == r2["cliente_id"]      # 2da llamada NO genera un cliente_id nuevo
    assert _count_tenant_rows(conn_factory, TEST_AUTH_USER_B) == 1   # no duplica
    assert gotrue.lookups == 1   # la 2da signup tomó el camino "email existente → lookup" (re-signup real)


@_db_required
def test_signup_and_provision_sets_claim_with_correct_cliente_id(cleanup_tenants):
    conn_factory = _conn_factory()
    gotrue = _FakeGoTrue({"c@test.com": TEST_AUTH_USER_C})

    result = signup_and_provision(email="c@test.com", password="pw", gotrue=gotrue, conn_factory=conn_factory)

    assert gotrue.claims[TEST_AUTH_USER_C] == result["cliente_id"]


# --- GoTrueAdmin.admin_create_user (transporte fake, sin DB ni GoTrue real) -----------------
# Ejercita la LÓGICA real de la clase (POST → 422 → GET lookup) con httpx.MockTransport.
# El 422 REAL de GoTrue v2.186.0 se valida en el go-live smoke (Task 12) — acá se prueba que,
# DADO un 422, la clase hace el lookup y devuelve el user existente sin explotar.

def _admin_with_transport(handler) -> GoTrueAdmin:
    client = httpx.Client(transport=httpx.MockTransport(handler), timeout=5.0)
    return GoTrueAdmin(base_url="http://gotrue.test", service_role_key="svc-key", client=client)


def test_admin_create_user_success_returns_user():
    """POST 200 → devuelve el user creado (camino feliz, sin lookup)."""
    calls = {"post": 0, "get": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        calls[request.method.lower()] += 1
        assert request.method == "POST"
        return httpx.Response(200, json={"id": "uid-new", "email": "new@test.com"})

    admin = _admin_with_transport(handler)
    user = admin.admin_create_user("new@test.com", "pw")

    assert user["id"] == "uid-new"
    assert calls == {"post": 1, "get": 0}   # sin lookup en el camino feliz


def test_admin_create_user_email_exists_422_tolerated_returns_existing_via_lookup():
    """POST 422 (email ya registrado) → GET lookup → devuelve el user existente, SIN excepción.
    Verifica que el path 422→lookup se ejercita (post==1 y get==1) y que el match es por email
    exacto (case-insensitive), ignorando otros users de la lista."""
    calls = {"post": 0, "get": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        calls[request.method.lower()] += 1
        if request.method == "POST":
            return httpx.Response(422, json={"error_code": "email_exists", "msg": "User already registered"})
        assert request.method == "GET"
        assert request.url.params.get("filter") == "DUP@test.com"   # se manda el email como filtro
        return httpx.Response(200, json={"users": [
            {"id": "uid-other", "email": "someone@test.com"},
            {"id": "uid-existing", "email": "dup@test.com"},        # match case-insensitive de DUP@
        ]})

    admin = _admin_with_transport(handler)
    user = admin.admin_create_user("DUP@test.com", "pw")

    assert user["id"] == "uid-existing"     # devuelve el existente, no explota
    assert calls == {"post": 1, "get": 1}   # el camino 422 → lookup se ejercitó


def test_admin_create_user_422_but_email_not_found_propagates_error():
    """POST 422 pero el lookup NO encuentra el email → no se traga el error: propaga el 422
    (evita devolver un user equivocado ante un 422 de otra causa)."""
    def handler(request: httpx.Request) -> httpx.Response:
        if request.method == "POST":
            return httpx.Response(422, json={"error_code": "weak_password", "msg": "otra causa"})
        return httpx.Response(200, json={"users": []})   # lookup vacío

    admin = _admin_with_transport(handler)
    with pytest.raises(httpx.HTTPStatusError):
        admin.admin_create_user("ghost@test.com", "pw")


# --- CONS0b: admin_grant_operador + find_user_by_email ---------------------------------------

def test_admin_grant_operador_manda_el_claim_correcto():
    """PUT con exactamente app_metadata.copiloto_admin=True -- nada más en el body (el merge del
    lado del server es lo que preserva otros claims, verificado empíricamente contra GoTrue real;
    acá sólo se prueba que ESTE cliente manda lo que dice mandar)."""
    visto = {}

    def handler(request: httpx.Request) -> httpx.Response:
        assert request.method == "PUT"
        visto["body"] = httpx.Request("PUT", request.url, content=request.content).content
        return httpx.Response(200, json={"id": "uid-1", "app_metadata": {"copiloto_admin": True}})

    admin = _admin_with_transport(handler)
    admin.admin_grant_operador("uid-1")
    assert b'"copiloto_admin": true' in visto["body"] or b'"copiloto_admin":true' in visto["body"]


def test_find_user_by_email_encuentra_match_exacto():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"users": [{"id": "uid-9", "email": "op@test.com"}]})

    admin = _admin_with_transport(handler)
    user = admin.find_user_by_email("op@test.com")
    assert user == {"id": "uid-9", "email": "op@test.com"}


def test_find_user_by_email_sin_match_devuelve_none():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"users": []})

    admin = _admin_with_transport(handler)
    assert admin.find_user_by_email("nadie@test.com") is None
