"""K-12: cambiar contraseña / mail de la PROPIA cuenta, y `cuenta_google` en `/me`.

GoTrue se simula con un `httpx.MockTransport` que resuelve la cuenta SÓLO por el Bearer (como la real:
`PUT /auth/v1/user` no recibe ningún id de cuenta), con los códigos de error verificados contra GoTrue
v2.186.0 en `spikes/gotrue-cambiar-mail-contrasena/RESULT.md`. El adversarial es de verdad: el body
intenta apuntar a la cuenta B con el token de A y sólo A cambia.
"""
from __future__ import annotations

import json

import httpx
import pytest
from fastapi.testclient import TestClient

from onboarding import GoTrueAdmin
from test_web_app import _build_app, _require_claims_fixed, _require_tenant_401, _require_tenant_fixed


@pytest.fixture(autouse=True)
def _fernet(monkeypatch):
    from clients.agent.providers.crypto import FernetCrypto
    monkeypatch.setenv("COPILOTO_FERNET_KEY", FernetCrypto.generate_key())


class _GoTrueSim:
    """Cuentas por token. Emula: password grant (400 invalid_credentials), PUT /user con Bearer."""

    def __init__(self) -> None:
        self.cuentas = {
            "TOKEN-A": {"email": "a@x.com", "password": "clave-de-A", "new_email": None},
            "TOKEN-B": {"email": "b@x.com", "password": "clave-de-B", "new_email": None},
        }
        self.puts: list[tuple[str, dict]] = []

    def handler(self, request: httpx.Request) -> httpx.Response:
        if request.url.path == "/auth/v1/token":
            body = json.loads(request.content)
            for c in self.cuentas.values():
                if c["email"] == body["email"] and c["password"] == body["password"]:
                    return httpx.Response(200, json={"access_token": "x", "user": {"email": c["email"]}})
            return httpx.Response(400, json={"error_code": "invalid_credentials", "msg": "Invalid login"})
        if request.url.path == "/auth/v1/user" and request.method == "PUT":
            token = request.headers["authorization"].removeprefix("Bearer ")
            cuenta = self.cuentas.get(token)
            if cuenta is None:
                return httpx.Response(401, json={"error_code": "bad_jwt", "msg": "bad jwt"})
            cambios = json.loads(request.content)
            self.puts.append((token, cambios))
            if "password" in cambios:
                if len(cambios["password"]) < 6:
                    return httpx.Response(422, json={"error_code": "weak_password", "msg": "weak"})
                if cambios["password"] == cuenta["password"]:
                    return httpx.Response(422, json={"error_code": "same_password", "msg": "same"})
                cuenta["password"] = cambios["password"]
            if "email" in cambios:
                if any(c["email"] == cambios["email"] for c in self.cuentas.values()):
                    return httpx.Response(422, json={"error_code": "email_exists", "msg": "exists"})
                cuenta["new_email"] = cambios["email"]
            return httpx.Response(200, json={"email": cuenta["email"], "new_email": cuenta["new_email"]})
        return httpx.Response(404)


def _cliente(sim: _GoTrueSim, *, cliente_id="cid-A", email="a@x.com", token="TOKEN-A", claims_extra=None):
    gotrue = GoTrueAdmin(base_url="http://gotrue.test", service_role_key="srk",
                         client=httpx.Client(transport=httpx.MockTransport(sim.handler)))
    claims = {"sub": "u", "email": email, **(claims_extra or {})}
    app, _ = _build_app(require_tenant=_require_tenant_fixed(cliente_id), gotrue=gotrue,
                        require_claims=_require_claims_fixed(claims))
    cli = TestClient(app)
    cli.headers["Authorization"] = f"Bearer {token}"
    return cli


def _codigo(r):
    return r.json()["detail"]["codigo"]


# ── contraseña ───────────────────────────────────────────────────────────────────────────────────

def test_cambiar_contrasena_ok_cambia_la_de_A():
    sim = _GoTrueSim()
    r = _cliente(sim).post("/auth/cambiar-contrasena",
                           json={"contrasena_actual": "clave-de-A", "contrasena_nueva": "nueva-clave-1"})
    assert r.status_code == 200 and r.json() == {"ok": True}
    assert sim.cuentas["TOKEN-A"]["password"] == "nueva-clave-1"


def test_contrasena_actual_incorrecta_es_401_y_no_cambia_nada():
    sim = _GoTrueSim()
    r = _cliente(sim).post("/auth/cambiar-contrasena",
                           json={"contrasena_actual": "otra", "contrasena_nueva": "nueva-clave-1"})
    assert r.status_code == 401 and _codigo(r) == "contrasena_actual_incorrecta"
    assert sim.puts == [] and sim.cuentas["TOKEN-A"]["password"] == "clave-de-A"


@pytest.mark.parametrize("nueva,esperado", [("abc", "contrasena_invalida"), ("clave-de-A", "contrasena_invalida")])
def test_contrasena_nueva_debil_o_igual_es_422_contrasena_invalida(nueva, esperado):
    sim = _GoTrueSim()
    r = _cliente(sim).post("/auth/cambiar-contrasena",
                           json={"contrasena_actual": "clave-de-A", "contrasena_nueva": nueva})
    assert r.status_code == 422 and _codigo(r) == esperado
    assert r.json()["detail"]["mensaje"]


def test_cambiar_contrasena_sin_token_es_401():
    sim = _GoTrueSim()
    gotrue = GoTrueAdmin(base_url="http://gotrue.test", service_role_key="srk",
                         client=httpx.Client(transport=httpx.MockTransport(sim.handler)))
    app, _ = _build_app(require_tenant=_require_tenant_401(), gotrue=gotrue,
                        require_claims=_require_claims_fixed({"email": "a@x.com"}))
    r = TestClient(app).post("/auth/cambiar-contrasena",
                             json={"contrasena_actual": "clave-de-A", "contrasena_nueva": "nueva-clave-1"})
    assert r.status_code == 401 and sim.puts == []


def test_ADVERSARIAL_el_token_de_A_no_cambia_la_contrasena_de_B():
    """El body intenta apuntar a B (email, cliente_id, id) y hasta manda la contraseña de B como «actual».
    Ninguna ruta acepta identificador de cuenta: el PUT sale con el Bearer de A y sólo lleva `password`."""
    sim = _GoTrueSim()
    cli = _cliente(sim)      # sesión de A
    r = cli.post("/auth/cambiar-contrasena", json={
        "contrasena_actual": "clave-de-B", "contrasena_nueva": "hackeada-123",
        "email": "b@x.com", "cliente_id": "cid-B", "user_id": "B"})
    assert r.status_code == 401          # reautenticación: se verifica contra el email de A (del token)
    assert sim.cuentas["TOKEN-B"]["password"] == "clave-de-B"
    r = cli.post("/auth/cambiar-contrasena", json={
        "contrasena_actual": "clave-de-A", "contrasena_nueva": "nueva-clave-1",
        "email": "b@x.com", "cliente_id": "cid-B"})
    assert r.status_code == 200
    assert [t for t, _ in sim.puts] == ["TOKEN-A"] and sim.puts[0][1] == {"password": "nueva-clave-1"}
    assert sim.cuentas["TOKEN-B"]["password"] == "clave-de-B"


# ── email ────────────────────────────────────────────────────────────────────────────────────────

def test_cambiar_email_ok_queda_pendiente_de_confirmacion():
    sim = _GoTrueSim()
    r = _cliente(sim).post("/auth/cambiar-email", json={"email_nuevo": "  nueva@dir.com "})
    assert r.status_code == 200 and r.json() == {"ok": True, "confirmacion_pendiente": True}
    assert sim.cuentas["TOKEN-A"]["email"] == "a@x.com"          # NO cambia hasta confirmar
    assert sim.cuentas["TOKEN-A"]["new_email"] == "nueva@dir.com"


def test_cambiar_email_ya_en_uso_es_409():
    r = _cliente(_GoTrueSim()).post("/auth/cambiar-email", json={"email_nuevo": "b@x.com"})
    assert r.status_code == 409 and _codigo(r) == "email_ya_registrado"


@pytest.mark.parametrize("valor", ["", "sin-arroba", "a@b", "a b@c.com"])
def test_cambiar_email_invalido_es_400_sin_tocar_gotrue(valor):
    sim = _GoTrueSim()
    r = _cliente(sim).post("/auth/cambiar-email", json={"email_nuevo": valor})
    assert r.status_code == 400 and _codigo(r) == "email_invalido" and sim.puts == []


def test_ADVERSARIAL_el_token_de_A_no_cambia_el_mail_de_B():
    sim = _GoTrueSim()
    r = _cliente(sim).post("/auth/cambiar-email", json={
        "email_nuevo": "robado@x.com", "email": "b@x.com", "cliente_id": "cid-B", "user_id": "B"})
    assert r.status_code == 200
    assert [t for t, _ in sim.puts] == ["TOKEN-A"]
    assert sim.cuentas["TOKEN-B"]["new_email"] is None and sim.cuentas["TOKEN-B"]["email"] == "b@x.com"


# ── /me.cuenta_google ────────────────────────────────────────────────────────────────────────────

@pytest.mark.parametrize("meta,esperado", [
    ({"provider": "email", "providers": ["email"]}, False),
    ({"provider": "google", "providers": ["google"]}, True),
    ({"provider": "email", "providers": ["email", "google"]}, True),
    ({}, False),
])
def test_me_cuenta_google_sale_de_app_metadata(meta, esperado):
    cli = _cliente(_GoTrueSim(), claims_extra={"app_metadata": meta})
    assert cli.get("/me").json()["cuenta_google"] is esperado


def test_me_sin_require_claims_cuenta_google_es_false():
    app, _ = _build_app(require_tenant=_require_tenant_fixed("cid-A"))
    assert TestClient(app).get("/me").json()["cuenta_google"] is False
