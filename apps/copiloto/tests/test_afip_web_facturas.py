"""Tests de la superficie HTTP de facturación (la que va a consumir la app).

El foco: que el contrato sea el que el frontend espera, y que el `factura_id` que viaja por la URL no
alcance para tocar la factura de otro tenant.
"""
from __future__ import annotations

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from afip_web import create_afip_app
from web import _wf_id_anulacion, _wf_id_factura

CUIT = "20409378472"
TENANT_A = "tenant-a"
TENANT_B = "tenant-b"


class Espia:
    """Registra lo que los endpoints le piden a Temporal, sin levantar Temporal."""

    def __init__(self):
        self.iniciadas: list[tuple] = []
        self.signals: list[tuple] = []
        self.estados: dict[str, dict] = {}

    def iniciar_factura(self, cliente_id, cuit):
        self.iniciadas.append((cliente_id, cuit))
        return "fact-123"

    def consultar_factura(self, cliente_id, factura_id):
        return self.estados.get(_wf_id_factura(cliente_id, factura_id))

    def signal_factura(self, cliente_id, factura_id, nombre, payload):
        self.signals.append((cliente_id, factura_id, nombre, payload))

    def iniciar_anulacion(self, cliente_id, cuit, tipo, pto, nro):
        self.iniciadas.append((cliente_id, cuit, tipo, pto, nro))
        return f"{cuit}-{tipo}-{pto}-{nro}"

    def consultar_anulacion(self, cliente_id, anulacion_id):
        return self.estados.get(_wf_id_anulacion(cliente_id, anulacion_id))

    def signal_anulacion(self, cliente_id, anulacion_id, nombre, payload):
        self.signals.append((cliente_id, anulacion_id, nombre, payload))


class ComprobanteStoreFake:
    def __init__(self, filas=None):
        self._filas = filas or []

    def listar(self, *, cuit, limite=50):
        return self._filas[:limite]


def armar(tenant=TENANT_A, comprobantes=None):
    espia = Espia()
    store = ComprobanteStoreFake(comprobantes)
    afip = create_afip_app(
        require_tenant=lambda: tenant,
        perfil_store_factory=lambda cid: None,
        cred_store_factory=lambda cid: None,
        handoff_factory=lambda cid: None,
        start_onboarding=lambda *a: "wf",
        comprobante_store_factory=lambda cid: store,
        iniciar_factura=espia.iniciar_factura,
        consultar_factura=espia.consultar_factura,
        signal_factura=espia.signal_factura,
        iniciar_anulacion=espia.iniciar_anulacion,
        consultar_anulacion=espia.consultar_anulacion,
        signal_anulacion=espia.signal_anulacion,
    )
    app = FastAPI()
    app.include_router(afip.router)
    return TestClient(app), espia


# ---------------------------------------------------------------------------
# Aislamiento
# ---------------------------------------------------------------------------


def test_adversarial_el_factura_id_no_alcanza_para_cruzar_tenants():
    """El id de la URL se combina SIEMPRE con el cliente_id del token, nunca se usa crudo.

    Si el workflow_id saliera del request, bastaría con adivinar (o filtrar) un id ajeno para leer o
    confirmar la factura de otro emprendedor.
    """
    client_a, espia_a = armar(TENANT_A)
    espia_a.estados[_wf_id_factura(TENANT_A, "fact-123")] = {"estado": "borrador"}

    assert client_a.get("/afip/facturas/fact-123").status_code == 200

    client_b, espia_b = armar(TENANT_B)
    espia_b.estados = espia_a.estados  # mismo "Temporal" detrás
    r = client_b.get("/afip/facturas/fact-123")
    assert r.status_code == 404, "el tenant B leyó el borrador del tenant A"


def test_el_workflow_id_se_arma_con_el_tenant():
    assert _wf_id_factura("t1", "f1") == "factura-t1-f1"
    assert _wf_id_factura("t2", "f1") != _wf_id_factura("t1", "f1")


# ---------------------------------------------------------------------------
# Ciclo de vida del borrador
# ---------------------------------------------------------------------------


def test_crear_factura_devuelve_id():
    client, espia = armar()
    r = client.post("/afip/facturas", json={"cuit": CUIT})
    assert r.status_code == 200
    assert r.json()["factura_id"] == "fact-123"
    assert espia.iniciadas == [(TENANT_A, CUIT)]


def test_cargar_datos_manda_los_signals_correctos():
    client, espia = armar()
    client.post("/afip/facturas/f1/datos-venta", json={"fecha": "2026-07-21", "concepto": 1})
    client.post("/afip/facturas/f1/items", json={"descripcion": "x", "cantidad": "1",
                                                 "precio_unitario": "100"})
    client.post("/afip/facturas/f1/cliente", json={"condicion_iva": 5, "tipo_doc": 99})

    nombres = [s[2] for s in espia.signals]
    assert nombres == ["cargar_datos_venta", "agregar_item", "cargar_cliente"]
    assert all(s[0] == TENANT_A for s in espia.signals)


def test_quitar_item_manda_el_indice():
    client, espia = armar()
    client.delete("/afip/facturas/f1/items/2")
    assert espia.signals[-1][2:] == ("quitar_item", 2)


def test_confirmar_manda_el_token():
    client, espia = armar()
    client.post("/afip/facturas/f1/confirmar", json={"token": "3:1000.00:99:0"})
    assert espia.signals[-1][2:] == ("confirmar", "3:1000.00:99:0")


def test_confirmar_sin_token_es_422():
    client, _ = armar()
    assert client.post("/afip/facturas/f1/confirmar", json={}).status_code == 422


def test_cancelar():
    client, espia = armar()
    client.post("/afip/facturas/f1/cancelar")
    assert espia.signals[-1][2] == "cancelar"


def test_estado_de_factura_inexistente_es_404():
    client, _ = armar()
    assert client.get("/afip/facturas/no-existe").status_code == 404


# ---------------------------------------------------------------------------
# Comprobantes y anulación
# ---------------------------------------------------------------------------


def test_listar_comprobantes():
    filas = [{"nro": 6, "estado": "anulada", "pdf_url": "https://x/y.pdf"}]
    client, _ = armar(comprobantes=filas)
    r = client.get(f"/afip/comprobantes?cuit={CUIT}")
    assert r.status_code == 200
    assert r.json()["comprobantes"] == filas


def test_anular_arranca_con_id_determinístico_por_comprobante():
    """Dos toques de 'anular' sobre la misma factura no pueden emitir dos notas de crédito."""
    client, espia = armar()
    cuerpo = {"cuit": CUIT, "tipo_cbte": 11, "punto_venta": 6, "nro": 9}
    r1 = client.post("/afip/comprobantes/anular", json=cuerpo)
    r2 = client.post("/afip/comprobantes/anular", json=cuerpo)
    assert r1.json()["anulacion_id"] == r2.json()["anulacion_id"]


def test_confirmar_anulacion():
    client, espia = armar()
    client.post("/afip/anulaciones/abc/confirmar")
    assert espia.signals[-1][2] == "confirmar"


@pytest.mark.parametrize("cuit", ["123", "204093784721"])
def test_anular_valida_el_cuit(cuit):
    client, _ = armar()
    r = client.post("/afip/comprobantes/anular",
                    json={"cuit": cuit, "tipo_cbte": 11, "punto_venta": 6, "nro": 9})
    assert r.status_code == 422
