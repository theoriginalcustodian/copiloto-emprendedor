"""Tests de apps/copiloto/admin_web.py (CONS0b). `/admin/salud` es el sujeto de prueba mínimo del
gate `require_admin` -- no adelanta A1-A6 de las specs, es lo que el contrato pide para tener algo
real contra qué correr los 3 tests adversariales."""
from __future__ import annotations

import time

import jwt
from fastapi.testclient import TestClient

from admin_web import create_admin_app
from auth import make_require_admin

SECRET = "test-secret-not-real"


def _tok(claims: dict) -> str:
    base = {"sub": "u-admin", "aud": "authenticated", "exp": int(time.time()) + 3600}
    return jwt.encode({**base, **claims}, SECRET, algorithm="HS256")


def _client() -> TestClient:
    app = create_admin_app(require_admin=make_require_admin(secret=SECRET))
    return TestClient(app)


def test_admin_con_el_claim_entra():
    """CONTROL POSITIVO -- sin esto, un 403 en el resto de la suite no probaría el gate, probaría
    que el endpoint está roto para todos (memoria/un-mecanismo-roto-hacia-el-no-no-da-sintoma.md).

    503, no 200: `_client()` no conecta Temporal (CONS0b no lo necesitaba). El punto de este test es
    el GATE (`require_admin`), no el contenido de A1 -- 503 prueba que se pasó el gate y se llegó al
    cuerpo del endpoint, que es exactamente lo que un 403/401 impediría. Ver `test_admin_salud.py`
    para el contenido real de A1, con Temporal mockeado."""
    tok = _tok({"app_metadata": {"copiloto_admin": True}})
    resp = _client().get("/admin/salud", headers={"Authorization": f"Bearer {tok}"})
    assert resp.status_code == 503


def test_usuario_normal_403():
    """ADVERSARIAL -- regla dura del repo: control de acceso sin este test = no verificado."""
    tok = _tok({})
    resp = _client().get("/admin/salud", headers={"Authorization": f"Bearer {tok}"})
    assert resp.status_code == 403


def test_no_puede_autoasignarse_via_user_metadata():
    """ESCALADA -- el claim en user_metadata (el único lugar que GoTrue deja auto-editar,
    verificado contra el server real en el spike de CONS0b) no debe otorgar acceso."""
    tok = _tok({"user_metadata": {"copiloto_admin": True}})
    resp = _client().get("/admin/salud", headers={"Authorization": f"Bearer {tok}"})
    assert resp.status_code == 403


def test_sin_header_401():
    assert _client().get("/admin/salud").status_code == 401
