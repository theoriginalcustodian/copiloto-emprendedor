"""Ambiente (homologación ↔ producción) y CUIT descubrible.

Los dos pedidos de la sesión frontend (`coordinacion/2026-07-21_pedido_frontend-a-backend-afip.md`).

Lo que se protege acá no es el feature: es el modo de fallo caro. Un usuario que cree estar probando y
emite un comprobante fiscal real no tiene deshacer — sólo nota de crédito. Por eso el default es
homologación en toda la superficie, y por eso el ambiente sale de la credencial y no de una constante.
"""
from __future__ import annotations

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from afip_web import create_afip_app
from web import _wf_id_onboarding

CUIT = "20409378472"
TENANT = "tenant-a"


class CredStoreFake:
    def __init__(self, por_ambiente=None, cuit_vinculado=None):
        self._creds = dict(por_ambiente or {})
        self._activo = next(iter(self._creds), None)
        self._cuit = cuit_vinculado
        self.activaciones: list[tuple] = []

    def get(self, cuit, ambiente=None):
        amb = ambiente if ambiente is not None else self._activo
        if amb is None or amb not in self._creds:
            return None
        return {"cert": "c", "key": "k", "ambiente": amb, "ws_autorizados": ["wsfe"]}

    def ambientes_vinculados(self, cuit):
        return sorted(self._creds)

    def activar(self, cuit, ambiente):
        self.activaciones.append((cuit, ambiente))
        if ambiente not in self._creds:
            return False
        self._activo = ambiente
        return True

    def primer_cuit(self):
        return self._cuit


class HandoffFake:
    def stash(self, clave):
        return "handle-opaco"


def armar(*, creds=None, perfil=None, onboarding_spy=None):
    store = CredStoreFake(**(creds or {}))
    arranques: list[tuple] = []

    def start_onboarding(cliente_id, cuit, handle, ambiente="dev"):
        arranques.append((cliente_id, cuit, handle, ambiente))
        return _wf_id_onboarding(cliente_id, cuit, ambiente)

    afip = create_afip_app(
        require_tenant=lambda: TENANT,
        perfil_store_factory=lambda cid: type("P", (), {"get": lambda s, c: perfil})(),
        cred_store_factory=lambda cid: store,
        handoff_factory=lambda cid: HandoffFake(),
        start_onboarding=start_onboarding,
        consultar_onboarding=onboarding_spy,
    )
    app = FastAPI()
    app.include_router(afip.router)
    return TestClient(app), store, arranques


# ---------------------------------------------------------------------------
# Punto 2 — el CUIT tiene que poder descubrirse
# ---------------------------------------------------------------------------


def test_estado_sin_cuit_lo_resuelve_y_lo_devuelve():
    """Sin esto el CUIT sería estado derivado viviendo en el cliente: el emprendedor cambia de
    teléfono y la app le pide rehacer un alta que ya hizo."""
    client, _, _ = armar(creds={"por_ambiente": {"dev": True}, "cuit_vinculado": CUIT})
    r = client.get("/afip/estado")
    assert r.status_code == 200
    assert r.json()["cuit"] == CUIT
    assert r.json()["conectado"] is True


def test_estado_sin_cuit_y_sin_nada_vinculado_no_es_error():
    """Tenant nuevo: es el estado inicial de Ajustes, no un 404."""
    client, _, _ = armar(creds={"por_ambiente": {}, "cuit_vinculado": None})
    r = client.get("/afip/estado")
    assert r.status_code == 200
    cuerpo = r.json()
    assert cuerpo["cuit"] is None
    assert cuerpo["puede_facturar"] is False
    assert cuerpo["ambientes_vinculados"] == []


def test_estado_con_cuit_explicito_sigue_andando():
    """Compatibilidad: lo que frontend ya escribió no se rompe."""
    client, _, _ = armar(creds={"por_ambiente": {"dev": True}, "cuit_vinculado": None})
    assert client.get(f"/afip/estado?cuit={CUIT}").json()["cuit"] == CUIT


# ---------------------------------------------------------------------------
# Punto 3 — ambiente
# ---------------------------------------------------------------------------


def test_estado_expone_ambiente_activo_y_vinculados():
    client, _, _ = armar(creds={"por_ambiente": {"dev": True, "prod": True},
                                "cuit_vinculado": CUIT})
    cuerpo = client.get("/afip/estado").json()
    assert cuerpo["ambiente"] == "dev"
    assert cuerpo["ambientes_vinculados"] == ["dev", "prod"]


def test_conectar_default_es_homologacion():
    """El default NO es una preferencia: es la dirección segura del fallo. Si el campo se pierde en un
    refactor del cliente, el peor caso es una factura de prueba — no un comprobante fiscal real."""
    client, _, arranques = armar()
    r = client.post("/afip/conectar", json={"cuit": CUIT, "usuario": "u", "clave_fiscal": "x"})
    assert r.status_code == 200
    assert r.json()["ambiente"] == "dev"
    assert arranques[-1][3] == "dev"


def test_conectar_propaga_produccion():
    client, _, arranques = armar()
    r = client.post("/afip/conectar",
                    json={"cuit": CUIT, "usuario": "u", "clave_fiscal": "x", "ambiente": "prod"})
    assert r.status_code == 200
    assert arranques[-1][3] == "prod"
    assert "producción" in r.json()["mensaje"]


def test_conectar_rechaza_ambiente_inventado():
    client, _, _ = armar()
    r = client.post("/afip/conectar",
                    json={"cuit": CUIT, "usuario": "u", "clave_fiscal": "x", "ambiente": "staging"})
    assert r.status_code == 422


def test_cambiar_a_ambiente_no_vinculado_es_409_con_camino_de_salida():
    """409 y no 500: es un caso esperado del producto. La app tiene que ofrecer el alta, no un error."""
    client, _, _ = armar(creds={"por_ambiente": {"dev": True}, "cuit_vinculado": CUIT})
    r = client.post("/afip/ambiente", json={"cuit": CUIT, "ambiente": "prod"})
    assert r.status_code == 409
    assert r.json()["detail"]["codigo"] == "ambiente_no_vinculado"


def test_cambiar_entre_ambientes_vinculados_es_un_toggle():
    client, store, _ = armar(creds={"por_ambiente": {"dev": True, "prod": True},
                                    "cuit_vinculado": CUIT})
    r = client.post("/afip/ambiente", json={"cuit": CUIT, "ambiente": "prod"})
    assert r.status_code == 200
    assert store.activaciones == [(CUIT, "prod")]
    assert client.get("/afip/estado").json()["ambiente"] == "prod"


@pytest.mark.parametrize("ambiente,esperado", [
    ("dev", "afip-onboarding-t-20409378472"),
    ("prod", "afip-onboarding-t-20409378472-prod"),
])
def test_el_workflow_id_del_alta_separa_ambientes(ambiente, esperado):
    """Sin el ambiente en el id, vincular producción con un alta de homologación en curso se
    engancharía a esa (USE_EXISTING) y reportaría éxito sin haber generado nada."""
    assert _wf_id_onboarding("t", CUIT, ambiente) == esperado


# ---------------------------------------------------------------------------
# Hallazgo de frontend: el borrador sin certificado nacía terminal (2026-07-21)
# ---------------------------------------------------------------------------


def test_crear_factura_sin_certificado_es_409_y_no_abre_workflow():
    """El caso del usuario nuevo — el 100% de los usuarios el primer día.

    Antes se abría un workflow que moría en el acto con `estado="rechazada"`, que en este dominio se
    lee como "AFIP rechazó tu factura". Un rechazo fiscal inventado es peor que un error: manda al
    usuario a revisar datos que están bien.
    """
    iniciadas = []
    store = CredStoreFake(por_ambiente={}, cuit_vinculado=None)
    afip = create_afip_app(
        require_tenant=lambda: TENANT,
        perfil_store_factory=lambda cid: type("P", (), {"get": lambda s, c: None})(),
        cred_store_factory=lambda cid: store,
        handoff_factory=lambda cid: HandoffFake(),
        start_onboarding=lambda *a, **k: "wf",
        iniciar_factura=lambda cid, cuit: (iniciadas.append(cuit), "no-deberia")[1],
    )
    app = FastAPI()
    app.include_router(afip.router)
    client = TestClient(app)

    r = client.post("/afip/facturas", json={"cuit": CUIT})
    assert r.status_code == 409
    assert r.json()["detail"]["codigo"] == "sin_certificado_afip"
    assert iniciadas == [], "se abrió un workflow condenado a morir"


def test_crear_factura_con_certificado_sigue_funcionando():
    iniciadas = []
    store = CredStoreFake(por_ambiente={"dev": True}, cuit_vinculado=CUIT)
    afip = create_afip_app(
        require_tenant=lambda: TENANT,
        perfil_store_factory=lambda cid: type("P", (), {"get": lambda s, c: {"x": 1}})(),
        cred_store_factory=lambda cid: store,
        handoff_factory=lambda cid: HandoffFake(),
        start_onboarding=lambda *a, **k: "wf",
        iniciar_factura=lambda cid, cuit: (iniciadas.append(cuit), "fact-1")[1],
    )
    app = FastAPI()
    app.include_router(afip.router)
    r = TestClient(app).post("/afip/facturas", json={"cuit": CUIT})
    assert r.status_code == 200
    assert r.json()["factura_id"] == "fact-1"
    assert iniciadas == [CUIT]
