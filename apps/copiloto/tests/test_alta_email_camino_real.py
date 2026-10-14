"""SM-C2 (#1000) — el alta por email, medida por el CAMINO REAL y no por un fake.

La ficha pide *«test del camino real — el de producción, por el composition root, no un happy-path
mockeado. Causa: un test que no usa el camino de producción no puede verlo fallar»*. Los tests de
`/auth/signup` que ya existen (`test_web_app.py`) corren con un `_FakeGoTrue` y un `_FakeTenantsDB`:
prueban el gate del `invite_token`, pero no pueden ver una costura rota entre el alta y el ingreso
(claim que no se propaga, fila de tenant que el `require_tenant` real no resuelve, login que no
reconoce lo que el alta creó).

Acá, el mismo `create_web_app` que arma producción, con los tres colaboradores REALES:

  * GoTrue de test (misma imagen/versión que `copiloto-auth` de prod, `deploy/copiloto/test-gotrue.sh`),
  * Postgres de test con RLS `FORCE` (`deploy/copiloto/test-db.sh`),
  * `make_require_tenant` / `make_require_claims` de verdad, validando el JWT que GoTrue firmó.

Recorrido: `POST /auth/signup` → `POST /auth/login` → `GET /me` con el Bearer que salió del login.
El control negativo corre sobre el MISMO armado: sin invite-token no se crea NADA (ni user ni tenant).

Lo que este test NO cubre, y está dicho: que el CLIENTE web mande `invite_token`. Eso es el formulario
(`apps/copiloto-web`), mitad de frontend de la ficha; este archivo fija el contrato que tiene que
cumplir: `POST /auth/signup {email, password, invite_token}`.
"""
from __future__ import annotations

import os
import uuid

import pytest
from fastapi.testclient import TestClient

import web as web_module
from auth import make_require_claims, make_require_tenant
from contexto_tenant import conexion_con_tenant, declarar_tenant
from mp_web import create_mp_app
from onboarding import GoTrueAdmin, InvalidCredentials
from test_adversarial_multitenant import _NoopMpGateway, _SpyComposioGateway, _conn_factory_cruda

necesita_real = pytest.mark.skipif(
    not (os.environ.get("UC_TEST_GOTRUE_URL") and os.environ.get("DATABASE_URL")),
    reason="requiere GoTrue de test + Postgres: eval \"$(bash deploy/copiloto/test-db.sh --export)\" "
           "&& eval \"$(bash deploy/copiloto/test-gotrue.sh --export)\"")

INVITE = "invite-sm-c2-no-es-un-secreto-de-prod"


@pytest.fixture(autouse=True)
def _entorno(monkeypatch):
    from clients.agent.providers.crypto import FernetCrypto
    monkeypatch.setenv("COPILOTO_FERNET_KEY", FernetCrypto.generate_key())
    monkeypatch.setenv(web_module.INVITE_TOKEN_ENV, INVITE)


def _admin() -> GoTrueAdmin:
    return GoTrueAdmin(base_url=os.environ["UC_TEST_GOTRUE_URL"],
                       service_role_key=os.environ["UC_TEST_GOTRUE_SERVICE_ROLE_KEY"])


@pytest.fixture
def alta_real():
    """(client, admin, emails_creados): la app de producción sobre GoTrue + Postgres reales. Al
    terminar borra las filas de `tenants` que creó (el user de la GoTrue efímera se descarta con ella)."""
    from clients.agent.providers.crypto import FernetCrypto
    admin = _admin()
    cf_cruda = _conn_factory_cruda()
    cf = conexion_con_tenant(cf_cruda)
    secret = os.environ["UC_TEST_GOTRUE_JWT_SECRET"]
    crypto = FernetCrypto()   # lee COPILOTO_FERNET_KEY del entorno (fixture autouse)
    mp_app = create_mp_app(gateway=_NoopMpGateway(), crypto=crypto,
                           cred_store_factory=lambda cid: None, payment_store_factory=lambda cid: None)
    app = web_module.create_web_app(
        temporal_client=None, adapter=None, conn_factory=cf,
        require_tenant=make_require_tenant(secret=secret, conn_factory=cf_cruda),
        require_claims=make_require_claims(secret=secret),
        mp_app=mp_app, gotrue=admin, mp_gateway=_NoopMpGateway(),
        composio_gateway=_SpyComposioGateway(None))
    creados: list[str] = []
    yield TestClient(app), admin, creados
    conn = cf_cruda()
    try:
        with conn.cursor() as cur:
            for email in creados:
                cur.execute("DELETE FROM uc_factory.tenants WHERE email = %s", (email,))
    finally:
        conn.close()
    declarar_tenant(None)


def _email() -> str:
    return f"smc2-{uuid.uuid4().hex[:12]}@test.copiloto.local"


@necesita_real
def test_SMC2_alta_por_email_de_punta_a_punta_signup_login_me(alta_real):
    cli, _admin_, creados = alta_real
    email, password = _email(), "clave-real-sm-c2-1"
    creados.append(email)

    r = cli.post("/auth/signup", json={"email": email, "password": password, "invite_token": INVITE})
    assert r.status_code == 200, r.text
    cliente_id = r.json()["cliente_id"]
    assert cliente_id

    r = cli.post("/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    token = r.json()["access_token"]

    me = cli.get("/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200, me.text           # el require_tenant REAL resolvió la fila que creó el alta
    assert me.json()["cliente_id"] == cliente_id
    assert me.json()["email"] == email
    assert me.json()["onboarding_completado"] is False   # cuenta nueva: el hilo de bienvenida le toca


@necesita_real
@pytest.mark.parametrize("invite", ["", "otro-token"])
def test_SMC2_adversarial_sin_invite_o_con_uno_equivocado_no_crea_ni_user_ni_tenant(alta_real, invite):
    cli, admin, creados = alta_real
    email, password = _email(), "clave-real-sm-c2-2"
    creados.append(email)

    r = cli.post("/auth/signup", json={"email": email, "password": password, "invite_token": invite})
    assert r.status_code == 403

    with pytest.raises(InvalidCredentials):          # el user NO existe en la GoTrue real
        admin.password_grant(email, password)
    conn = _conn_factory_cruda()()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT count(*) FROM uc_factory.tenants WHERE email = %s", (email,))
            assert cur.fetchone()[0] == 0            # ni fila de tenant
    finally:
        conn.close()


@necesita_real
def test_SMC2_fail_closed_sin_la_env_del_invite_nadie_se_registra_ni_con_el_token_correcto(alta_real, monkeypatch):
    cli, admin, creados = alta_real
    monkeypatch.delenv(web_module.INVITE_TOKEN_ENV)
    email = _email()
    creados.append(email)
    r = cli.post("/auth/signup", json={"email": email, "password": "clave-real-sm-c2-3", "invite_token": INVITE})
    assert r.status_code == 403
    with pytest.raises(InvalidCredentials):
        admin.password_grant(email, "clave-real-sm-c2-3")
