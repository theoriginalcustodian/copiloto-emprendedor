"""K-12 (BL-J11): integración REAL contra una GoTrue de test efímera — no `httpx.MockTransport`.

Auditoría A2 (`hallazgo_…A2-la-prueba-verifica-un-sustituto-…md`): el DoD de K-12 pide una GoTrue de
TEST real con cuentas efímeras; `test_cambiar_cuenta.py` sólo ejercitaba un simulador casero
(`_GoTrueSim`). Integración > mocks es regla dura del repo (CLAUDE.md raíz §Testing) — "no acepto el
sustituto". Este archivo crea cuentas reales y descartables contra la GoTrue efímera que levanta
`deploy/copiloto/test-gotrue.sh` (GoTrue v2.186.0, la misma imagen que `copiloto-auth` de prod) y
ejercita el camino completo: `admin_create_user` → `password_grant` real → los endpoints
`/auth/cambiar-contrasena`/`/auth/cambiar-email` → verificación con un SEGUNDO `password_grant` real
(no una aserción sobre un diccionario en memoria).

`test_cambiar_cuenta.py` queda como complemento rápido para los caminos que NUNCA tocan GoTrue
(validación de formato, ausencia de token: `sim.puts == []` lo prueba) — ésos sí son unidades puras.
"""
from __future__ import annotations

import os
import uuid

import pytest
from fastapi.testclient import TestClient

from onboarding import GoTrueAdmin, InvalidCredentials
from test_web_app import _build_app, _require_claims_fixed, _require_tenant_fixed

necesita_gotrue = pytest.mark.skipif(
    not os.environ.get("UC_TEST_GOTRUE_URL"),
    reason="requiere GoTrue de test real: eval \"$(bash deploy/copiloto/test-gotrue.sh --export)\"")


@pytest.fixture(autouse=True)
def _fernet(monkeypatch):
    from clients.agent.providers.crypto import FernetCrypto
    monkeypatch.setenv("COPILOTO_FERNET_KEY", FernetCrypto.generate_key())


def _admin() -> GoTrueAdmin:
    return GoTrueAdmin(base_url=os.environ["UC_TEST_GOTRUE_URL"],
                       service_role_key=os.environ["UC_TEST_GOTRUE_SERVICE_ROLE_KEY"])


def _crear_cuenta(admin: GoTrueAdmin, password: str) -> tuple[str, str]:
    """User real y efímero en la GoTrue de test; devuelve (email, access_token de una sesión real)."""
    email = f"k12-{uuid.uuid4().hex[:12]}@test.copiloto.local"
    admin.admin_create_user(email, password)
    token = admin.password_grant(email, password)["access_token"]
    return email, token


def _cliente(admin: GoTrueAdmin, email: str, token: str, *, cliente_id: str = "cid-real"):
    app, _ = _build_app(require_tenant=_require_tenant_fixed(cliente_id), gotrue=admin,
                        require_claims=_require_claims_fixed({"sub": "u", "email": email}))
    cli = TestClient(app)
    cli.headers["Authorization"] = f"Bearer {token}"
    return cli


def _codigo(r):
    return r.json()["detail"]["codigo"]


# ── contraseña ───────────────────────────────────────────────────────────────────────────────────

@necesita_gotrue
def test_cambiar_contrasena_ok_contra_gotrue_real():
    admin = _admin()
    email, token = _crear_cuenta(admin, "clave-inicial-1")
    r = _cliente(admin, email, token).post(
        "/auth/cambiar-contrasena",
        json={"contrasena_actual": "clave-inicial-1", "contrasena_nueva": "clave-nueva-2"})
    assert r.status_code == 200 and r.json() == {"ok": True}
    # control positivo REAL (no un dict en memoria): la vieja ya no autentica, la nueva sí.
    with pytest.raises(InvalidCredentials):
        admin.password_grant(email, "clave-inicial-1")
    assert admin.password_grant(email, "clave-nueva-2")["access_token"]


@necesita_gotrue
def test_contrasena_actual_incorrecta_es_401_contra_gotrue_real():
    admin = _admin()
    email, token = _crear_cuenta(admin, "clave-inicial-1")
    r = _cliente(admin, email, token).post(
        "/auth/cambiar-contrasena",
        json={"contrasena_actual": "otra-cualquiera", "contrasena_nueva": "clave-nueva-2"})
    assert r.status_code == 401 and _codigo(r) == "contrasena_actual_incorrecta"
    assert admin.password_grant(email, "clave-inicial-1")["access_token"]   # no cambió nada


@necesita_gotrue
@pytest.mark.parametrize("nueva", ["abc", "clave-inicial-1"])
def test_contrasena_nueva_debil_o_igual_es_422_contra_gotrue_real(nueva):
    admin = _admin()
    email, token = _crear_cuenta(admin, "clave-inicial-1")
    r = _cliente(admin, email, token).post(
        "/auth/cambiar-contrasena",
        json={"contrasena_actual": "clave-inicial-1", "contrasena_nueva": nueva})
    assert r.status_code == 422 and _codigo(r) == "contrasena_invalida" and r.json()["detail"]["mensaje"]


@necesita_gotrue
def test_ADVERSARIAL_token_de_A_no_cambia_la_contrasena_de_B_contra_gotrue_real():
    """El caso que la auditoría rechazó como sustituto: acá el guard corre contra la GoTrue REAL. Si
    `GoTrueAdmin.update_user` alguna vez resolviera la cuenta por un campo del body en vez de por el
    Bearer, esto lo cazaría contra el servidor real, no contra una simulación que asume la forma."""
    admin = _admin()
    email_a, token_a = _crear_cuenta(admin, "clave-de-A-1")
    email_b, _token_b = _crear_cuenta(admin, "clave-de-B-1")
    cli = _cliente(admin, email_a, token_a)   # sesión real de A
    r = cli.post("/auth/cambiar-contrasena", json={
        "contrasena_actual": "clave-de-A-1", "contrasena_nueva": "hackeada-para-B",
        "email": email_b, "cliente_id": "cid-B", "user_id": "B"})
    assert r.status_code == 200
    assert admin.password_grant(email_b, "clave-de-B-1")["access_token"]     # B intacta (real)
    with pytest.raises(InvalidCredentials):
        admin.password_grant(email_a, "clave-de-A-1")                        # A cambió la SUYA
    assert admin.password_grant(email_a, "hackeada-para-B")["access_token"]


# ── email ────────────────────────────────────────────────────────────────────────────────────────

@necesita_gotrue
def test_cambiar_email_ok_queda_pendiente_contra_gotrue_real():
    admin = _admin()
    email, token = _crear_cuenta(admin, "clave-inicial-1")
    nuevo = f"nuevo-{uuid.uuid4().hex[:12]}@test.copiloto.local"
    r = _cliente(admin, email, token).post("/auth/cambiar-email", json={"email_nuevo": nuevo})
    assert r.status_code == 200 and r.json() == {"ok": True, "confirmacion_pendiente": True}
    # H3 del spike (RESULT.md): siempre asíncrono -- el user real sigue con el email VIEJO hasta confirmar.
    user = admin.find_user_by_email(email)
    assert user is not None and user["email"] == email


@necesita_gotrue
def test_cambiar_email_ya_en_uso_es_409_contra_gotrue_real():
    admin = _admin()
    email_a, token_a = _crear_cuenta(admin, "clave-de-A-1")
    email_b, _token_b = _crear_cuenta(admin, "clave-de-B-1")
    r = _cliente(admin, email_a, token_a).post("/auth/cambiar-email", json={"email_nuevo": email_b})
    assert r.status_code == 409 and _codigo(r) == "email_ya_registrado"


@necesita_gotrue
def test_ADVERSARIAL_token_de_A_no_cambia_el_email_de_B_contra_gotrue_real():
    admin = _admin()
    email_a, token_a = _crear_cuenta(admin, "clave-de-A-1")
    email_b, _token_b = _crear_cuenta(admin, "clave-de-B-1")
    cli = _cliente(admin, email_a, token_a)
    r = cli.post("/auth/cambiar-email", json={
        "email_nuevo": "robado@test.copiloto.local", "email": email_b, "cliente_id": "cid-B", "user_id": "B"})
    assert r.status_code == 200
    user_b = admin.find_user_by_email(email_b)
    assert user_b is not None and user_b["email"] == email_b   # B intacta (real, no simulada)
