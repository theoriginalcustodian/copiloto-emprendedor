"""Tests de apps/copiloto/onboarding.py (Task 3 del sprint deploy vivo + multitenant).

Cubre `signup_and_provision`: crea la fila `tenants` con `composio_user_id == cliente_id`;
2ª llamada con el mismo email/auth_user_id es idempotente (no duplica, mismo cliente_id); el
claim se setea con el `cliente_id` correcto. `gotrue` SIEMPRE es un fake determinístico (regla
del brief: nunca llamar al GoTrue real desde los tests); `conn_factory` es real (VPS, DATABASE_URL)
— usa `auth_user_id` fijos de test y limpia `uc_factory.tenants` al final."""
from __future__ import annotations

import os

import psycopg2
import pytest

from onboarding import signup_and_provision

pytestmark = pytest.mark.skipif(not os.environ.get("DATABASE_URL"),
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
    """Fake determinístico: mapea email -> auth_user_id fijo (simula `admin_create_user` de
    GoTrue sin red real). Registra los claims seteados (`user_id -> cliente_id`) para poder
    assertar sobre `admin_set_claim` sin tocar GoTrue real."""

    def __init__(self, email_to_auth_user_id: dict) -> None:
        self._registry = email_to_auth_user_id
        self.claims: dict[str, str] = {}

    def admin_create_user(self, email: str, password: str) -> dict:
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


def test_signup_and_provision_idempotent_same_auth_user_no_duplicate(cleanup_tenants):
    conn_factory = _conn_factory()
    gotrue = _FakeGoTrue({"b@test.com": TEST_AUTH_USER_B})

    r1 = signup_and_provision(email="b@test.com", password="pw", gotrue=gotrue, conn_factory=conn_factory)
    r2 = signup_and_provision(email="b@test.com", password="pw", gotrue=gotrue, conn_factory=conn_factory)

    assert r1["cliente_id"] == r2["cliente_id"]      # 2da llamada NO genera un cliente_id nuevo
    assert _count_tenant_rows(conn_factory, TEST_AUTH_USER_B) == 1   # no duplica


def test_signup_and_provision_sets_claim_with_correct_cliente_id(cleanup_tenants):
    conn_factory = _conn_factory()
    gotrue = _FakeGoTrue({"c@test.com": TEST_AUTH_USER_C})

    result = signup_and_provision(email="c@test.com", password="pw", gotrue=gotrue, conn_factory=conn_factory)

    assert gotrue.claims[TEST_AUTH_USER_C] == result["cliente_id"]
