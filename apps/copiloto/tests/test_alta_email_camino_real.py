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

⚠️ EL 403 SE RETIRÓ (SM-C2 / Ítem 11, decisión del operador 2026-10-14, bajada por planificación):
`POST /auth/signup` ya no exige `invite_token` — alta por email self-service. Los casos que antes
afirmaban «sin invite ⇒ 403 y ni user ni tenant» y «fail-closed sin la env» están INVERTIDOS acá, no
borrados: afirman que el alta FUNCIONA sin token, con uno equivocado y sin la env. Si alguien vuelve
a poner el gate, estos casos se ponen rojos. Lo que abre (repo público, sin límite de volumen) está
escrito junto al retiro en `web.py`.

Contrato que fija: `POST /auth/signup {email, password}` (`invite_token` se acepta e ignora).
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

@pytest.fixture(autouse=True)
def _entorno(monkeypatch):
    from clients.agent.providers.crypto import FernetCrypto
    monkeypatch.setenv("COPILOTO_FERNET_KEY", FernetCrypto.generate_key())
    # SIN env de invitación a propósito: el alta self-service no puede depender de ella.
    monkeypatch.delenv("COPILOTO_INVITE_TOKEN", raising=False)


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

    r = cli.post("/auth/signup", json={"email": email, "password": password})   # sin invite_token
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
def test_SMC2_INVERTIDO_sin_invite_o_con_uno_equivocado_se_registra_igual(alta_real, invite):
    """INVERTIDO (antes: 403 y «ni user ni tenant»). El `invite_token` se ignora: user real en la
    GoTrue y fila de tenant creados. Es el control que se pone rojo si el gate vuelve."""
    cli, admin, creados = alta_real
    email, password = _email(), "clave-real-sm-c2-2"
    creados.append(email)

    r = cli.post("/auth/signup", json={"email": email, "password": password, "invite_token": invite})
    assert r.status_code == 200, r.text

    assert admin.password_grant(email, password)     # el user EXISTE en la GoTrue real
    conn = _conn_factory_cruda()()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT count(*) FROM uc_factory.tenants WHERE email = %s", (email,))
            assert cur.fetchone()[0] == 1            # y su fila de tenant
    finally:
        conn.close()


@necesita_real
def test_SMC2_INVERTIDO_sin_env_del_invite_el_alta_funciona(alta_real, monkeypatch):
    """INVERTIDO (antes: «fail-closed sin la env ⇒ 403»). Ya no hay env de invitación que leer."""
    cli, admin, creados = alta_real
    monkeypatch.delenv("COPILOTO_INVITE_TOKEN", raising=False)
    email = _email()
    creados.append(email)
    r = cli.post("/auth/signup", json={"email": email, "password": "clave-real-sm-c2-3"})
    assert r.status_code == 200, r.text
    assert admin.password_grant(email, "clave-real-sm-c2-3")
