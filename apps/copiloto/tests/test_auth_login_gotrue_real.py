"""MECLAVESRESTO (lado backend, `/auth/login`): el control que `test_auth_login.py` no puede dar.

Ese archivo corre con un `_FakeGoTrueLogin` que devuelve el dict que el TEST MISMO escribió — nunca
observa qué claves manda GoTrue de verdad. `web.py:login` reenvía `gotrue.password_grant(...)` tal
cual (sin spreads, sin filtrar campos), así que el set real de claves es el que GoTrue devuelve, no
el que alguien tipeó en un fixture.

Este archivo pega la ruta HTTP `/auth/login` contra una GoTrue de TEST real (mismo compose que prod,
`deploy/copiloto/test-gotrue.sh`, GoTrue v2.186.0) con una cuenta real y efímera, y compara el set de
claves del body contra `CLAVES_LOGIN` (`apps/copiloto/auth_login_contrato.py`, MECLAVESRESTO) en las
DOS direcciones — mismo criterio que `MECLAVESRUNTIME` para `/me`. Si GoTrue algún día agrega o quita
una clave del token (cambio de versión, config distinta), esto se pone rojo contra el PRODUCTOR real,
no contra una copia de lo que alguien asumió que devuelve.
"""
from __future__ import annotations

import os
import uuid

import pytest
from fastapi.testclient import TestClient

from onboarding import GoTrueAdmin
from auth_login_contrato import CLAVES_LOGIN
from test_auth_login import _build_app

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


@necesita_gotrue
def test_login_contra_gotrue_real_devuelve_exactamente_CLAVES_LOGIN():
    admin = _admin()
    email = f"meclavesresto-{uuid.uuid4().hex[:12]}@test.copiloto.local"
    password = "clave-real-1"
    admin.admin_create_user(email, password)

    app = _build_app(gotrue=admin)
    r = TestClient(app).post("/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200
    body = r.json()

    recibidas = frozenset(body.keys())
    sobra = sorted(recibidas - CLAVES_LOGIN)
    falta = sorted(CLAVES_LOGIN - recibidas)
    assert not sobra and not falta, f"sobra_no_declaradas={sobra} faltan_declaradas={falta}"


# ── controles positivos (en las dos direcciones): sin esto, el assert de arriba no se distingue de
#    "no mira" -- memoria/instrumento-que-no-mira-nunca-falla.md ──────────────────────────────────
#
# Ninguno de los dos asume cuántas claves tiene el payload real (ese número es justamente lo que el
# test principal mide, y hoy difiere de CLAVES_LOGIN -- ver el hallazgo reportado al buzón). Cada
# control inyecta/retira UNA clave puntual y verifica sólo esa asimetría, sea cual sea el resto.

@necesita_gotrue
def test_CONTROL_POSITIVO_clave_de_mas_en_el_payload_real_se_detecta():
    admin = _admin()
    email = f"meclavesresto-sobra-{uuid.uuid4().hex[:12]}@test.copiloto.local"
    password = "clave-real-1"
    admin.admin_create_user(email, password)

    app = _build_app(gotrue=admin)
    r = TestClient(app).post("/auth/login", json={"email": email, "password": password})
    recibidas_con_mentira = frozenset(r.json().keys()) | {"clave_de_mentira"}   # simula GoTrue agregando una

    sobra = sorted(recibidas_con_mentira - CLAVES_LOGIN)
    assert "clave_de_mentira" in sobra, f"el control no detectó la clave inyectada: {sobra}"


@necesita_gotrue
def test_CONTROL_POSITIVO_clave_faltante_en_la_declaracion_se_detecta():
    admin = _admin()
    email = f"meclavesresto-falta-{uuid.uuid4().hex[:12]}@test.copiloto.local"
    password = "clave-real-1"
    admin.admin_create_user(email, password)

    app = _build_app(gotrue=admin)
    r = TestClient(app).post("/auth/login", json={"email": email, "password": password})
    recibidas = frozenset(r.json().keys())
    assert "refresh_token" in recibidas, "precondición del control: GoTrue dejó de mandar refresh_token"

    declaradas_incompletas = CLAVES_LOGIN - {"refresh_token"}   # simula que alguien borró una del contrato
    falta = sorted(declaradas_incompletas - recibidas)
    # refresh_token sí vino en el payload real, así que al quitarla de "declaradas" tiene que aparecer
    # como sobrante del lado recibido-vs-declaradas-incompletas (la asimetría es la señal):
    sobra = sorted(recibidas - declaradas_incompletas)
    assert "refresh_token" in sobra, f"el control no detectó la clave quitada del contrato: {sobra}"
