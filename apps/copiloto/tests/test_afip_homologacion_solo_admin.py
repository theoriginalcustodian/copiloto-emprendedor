"""SM-K1 / D6 — Homologación (`dev`) sólo para `copiloto_admin`, y la rechaza el BACKEND.

Ocultar el botón no es un control: acá se ejercita el caso hostil por API con JWT reales firmados.
Superficie de Homologación: `POST /afip/conectar` (ambiente dev, explícito u omitido) y
`POST /afip/ambiente` (activar dev). Cada rechazo se prueba junto con su CONTROL POSITIVO (admin pasa;
no admin sí puede ir a producción) y de que el rechazo ocurre ANTES de tocar la clave fiscal.
"""
from __future__ import annotations

import time

import jwt
import pytest
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

from afip_web import create_afip_app
from auth import es_admin, make_require_claims

SECRET = "test-secret-not-real"
CUIT = "20269996065"
TENANT = "t-1"


def _tok(app_metadata=None, user_metadata=None) -> str:
    claims = {"sub": "u-1", "aud": "authenticated", "exp": int(time.time()) + 3600}
    if app_metadata is not None:
        claims["app_metadata"] = app_metadata
    if user_metadata is not None:
        claims["user_metadata"] = user_metadata
    return jwt.encode(claims, SECRET, algorithm="HS256")


H_ADMIN = {"Authorization": f"Bearer {_tok(app_metadata={'copiloto_admin': True})}"}
H_USER = {"Authorization": f"Bearer {_tok(app_metadata={})}"}
# escalada: el usuario se pone el claim donde SÍ puede escribir (user_metadata). No debe valer.
H_ESCALADA = {"Authorization": f"Bearer {_tok(app_metadata={}, user_metadata={'copiloto_admin': True})}"}


class _Handoff:
    def __init__(self): self.guardados = 0
    def stash(self, clave): self.guardados += 1; return "h1"


class _Cred:
    def __init__(self): self.activaciones = []
    def activar(self, cuit, ambiente): self.activaciones.append((cuit, ambiente)); return True


def _armar(con_wiring=True):
    handoff, cred, arranques = _Handoff(), _Cred(), []
    require_claims = make_require_claims(secret=SECRET)

    def es_admin_dep(claims: dict = Depends(require_claims)) -> bool:
        return es_admin(claims)

    kwargs = {"es_admin_dep": es_admin_dep} if con_wiring else {}
    afip = create_afip_app(
        require_tenant=lambda: TENANT,
        perfil_store_factory=lambda cid: None, cred_store_factory=lambda cid: cred,
        handoff_factory=lambda cid: handoff,
        start_onboarding=lambda cid, cuit, handle, ambiente="dev": (arranques.append(ambiente), "wf")[1],
        **kwargs)
    app = FastAPI()
    app.include_router(afip.router)
    return TestClient(app), handoff, cred, arranques


def _conectar(client, headers, **extra):
    return client.post("/afip/conectar", headers=headers,
                       json={"cuit": CUIT, "usuario": "u", "clave_fiscal": "x", **extra})


@pytest.mark.parametrize("headers", [H_USER, H_ESCALADA], ids=["no-admin", "escalada-user_metadata"])
def test_no_admin_NO_puede_vincular_homologacion(headers):
    client, handoff, _, arranques = _armar()
    r = _conectar(client, headers, ambiente="dev")
    assert r.status_code == 403 and r.json()["detail"]["codigo"] == "homologacion_solo_admin"
    assert arranques == [] and handoff.guardados == 0, "el rechazo es ANTES de tocar la clave fiscal"


def test_no_admin_sin_ambiente_no_cae_en_homologacion_ni_en_produccion_por_defecto():
    client, handoff, _, arranques = _armar()
    r = _conectar(client, H_USER)
    assert r.status_code == 422 and r.json()["detail"]["codigo"] == "ambiente_requerido"
    assert arranques == [] and handoff.guardados == 0


def test_no_admin_SI_puede_vincular_produccion():
    """Control positivo del lado del no-admin: el rechazo es de homologación, no de todo."""
    client, _, _, arranques = _armar()
    r = _conectar(client, H_USER, ambiente="prod")
    assert r.status_code == 200 and arranques == ["prod"]


def test_admin_SI_puede_vincular_homologacion_explicita_u_omitida():
    client, _, _, arranques = _armar()
    assert _conectar(client, H_ADMIN, ambiente="dev").status_code == 200
    assert _conectar(client, H_ADMIN).status_code == 200
    assert arranques == ["dev", "dev"]


@pytest.mark.parametrize("headers", [H_USER, H_ESCALADA], ids=["no-admin", "escalada-user_metadata"])
def test_no_admin_NO_puede_activar_homologacion(headers):
    client, _, cred, _ = _armar()
    r = client.post("/afip/ambiente", headers=headers, json={"cuit": CUIT, "ambiente": "dev"})
    assert r.status_code == 403 and r.json()["detail"]["codigo"] == "homologacion_solo_admin"
    assert cred.activaciones == [], "no se cambió el ambiente activo"


def test_activar_produccion_no_admin_y_homologacion_admin_pasan():
    client, _, cred, _ = _armar()
    assert client.post("/afip/ambiente", headers=H_USER, json={"cuit": CUIT, "ambiente": "prod"}).status_code == 200
    assert client.post("/afip/ambiente", headers=H_ADMIN, json={"cuit": CUIT, "ambiente": "dev"}).status_code == 200
    assert cred.activaciones == [(CUIT, "prod"), (CUIT, "dev")]


def test_sin_wiring_de_admin_NADIE_homologa_ni_el_admin_fail_closed():
    client, handoff, cred, arranques = _armar(con_wiring=False)
    assert _conectar(client, H_ADMIN, ambiente="dev").status_code == 403
    assert client.post("/afip/ambiente", headers=H_ADMIN, json={"cuit": CUIT, "ambiente": "dev"}).status_code == 403
    assert arranques == [] and cred.activaciones == [] and handoff.guardados == 0
