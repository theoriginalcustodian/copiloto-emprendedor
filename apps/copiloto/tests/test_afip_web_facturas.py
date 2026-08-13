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


class _WorkflowNoExiste(Exception):
    """Simula lo que Temporal real hace ante `handle.signal()` sobre un workflow_id compuesto que
    nadie abrió: `RPCError(status=NOT_FOUND)`. No se usa la clase real del SDK a propósito -- ninguna
    de las rutas de mutación de `afip_web.py` inspecciona el tipo (no llaman `_no_existe()`, sólo
    `web.py` lo hace para las lecturas), así que lo único que el test necesita es que ALGO escape sin
    convertirse en un `{"ok": True}`."""


class Espia:
    """Registra lo que los endpoints le piden a Temporal, sin levantar Temporal.

    `estricto=True` activa el modo adversarial: `signal_factura`/`signal_anulacion` sólo aceptan un
    workflow_id que ESE `cliente_id` abrió (vía `iniciar_factura`/`iniciar_anulacion`) -- igual que
    Temporal real, que jamás encuentra el workflow de otro tenant porque el id se compone con
    `_wf_id_factura`/`_wf_id_anulacion`. Default `False`: preserva el comportamiento de siempre para
    los tests que no arrancan la factura antes de mandarle signals.
    """

    def __init__(self, *, estricto: bool = False):
        self.iniciadas: list[tuple] = []
        self.signals: list[tuple] = []
        self.estados: dict[str, dict] = {}
        self._estricto = estricto
        self._abiertos: set[str] = set()

    def iniciar_factura(self, cliente_id, cuit):
        self.iniciadas.append((cliente_id, cuit))
        self._abiertos.add(_wf_id_factura(cliente_id, "fact-123"))
        return "fact-123"

    def consultar_factura(self, cliente_id, factura_id):
        return self.estados.get(_wf_id_factura(cliente_id, factura_id))

    def signal_factura(self, cliente_id, factura_id, nombre, payload):
        wf_id = _wf_id_factura(cliente_id, factura_id)
        if self._estricto and wf_id not in self._abiertos:
            raise _WorkflowNoExiste(wf_id)
        self.signals.append((cliente_id, factura_id, nombre, payload))

    def iniciar_anulacion(self, cliente_id, cuit, tipo, pto, nro):
        self.iniciadas.append((cliente_id, cuit, tipo, pto, nro))
        anulacion_id = f"{cuit}-{tipo}-{pto}-{nro}"
        self._abiertos.add(_wf_id_anulacion(cliente_id, anulacion_id))
        return anulacion_id

    def consultar_anulacion(self, cliente_id, anulacion_id):
        return self.estados.get(_wf_id_anulacion(cliente_id, anulacion_id))

    def signal_anulacion(self, cliente_id, anulacion_id, nombre, payload):
        wf_id = _wf_id_anulacion(cliente_id, anulacion_id)
        if self._estricto and wf_id not in self._abiertos:
            raise _WorkflowNoExiste(wf_id)
        self.signals.append((cliente_id, anulacion_id, nombre, payload))


class ComprobanteStoreFake:
    def __init__(self, filas=None):
        self._filas = filas or []

    def listar(self, *, cuit, limite=50):
        return self._filas[:limite]


class CredStoreConCertificado:
    """El tenant de estos tests YA vinculó ARCA: acá se prueba el ciclo del borrador, no el alta."""

    def get(self, cuit, ambiente=None):
        return {"cert": "c", "key": "k", "ambiente": ambiente or "dev", "ws_autorizados": ["wsfe"]}


def armar(tenant=TENANT_A, comprobantes=None, *, espia=None, raise_server_exceptions=True):
    espia = espia or Espia()
    store = ComprobanteStoreFake(comprobantes)
    afip = create_afip_app(
        require_tenant=lambda: tenant,
        perfil_store_factory=lambda cid: None,
        cred_store_factory=lambda cid: CredStoreConCertificado(),
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
    cliente = TestClient(app, raise_server_exceptions=raise_server_exceptions)
    return cliente, espia


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


def _rutas_de_mutacion_factura(factura_id: str):
    """Las 6 rutas de ESCRITURA del ciclo del borrador. El GET ya tiene su adversarial arriba -- acá
    falta lo que D5 encontró sin cubrir: nada verificaba que un `factura_id` ajeno no alcanzara para
    escribir (no sólo leer)."""
    return [
        ("post", f"/afip/facturas/{factura_id}/datos-venta", {"fecha": "2026-07-21", "concepto": 1}),
        ("post", f"/afip/facturas/{factura_id}/items",
         {"descripcion": "x", "cantidad": "1", "precio_unitario": "100"}),
        ("delete", f"/afip/facturas/{factura_id}/items/0", None),
        ("post", f"/afip/facturas/{factura_id}/cliente", {"condicion_iva": 5, "tipo_doc": 99}),
        ("post", f"/afip/facturas/{factura_id}/confirmar", {"token": "3:1000.00:99:0"}),
        ("post", f"/afip/facturas/{factura_id}/cancelar", None),
    ]


def test_ADVERSARIAL_las_mutaciones_de_factura_no_alcanzan_la_de_otro_tenant():
    """D5: `datos-venta` / `items` (alta y baja) / `cliente` / `confirmar` / `cancelar` llaman
    `signal_factura` y devuelven `{"ok": True}` SIN mirar el resultado -- a diferencia del GET, ninguna
    captura el `NOT_FOUND` que Temporal real tira cuando el workflow_id compuesto
    (`_wf_id_factura(cliente_id, factura_id)`) no es de este tenant. El fail-closed sigue siendo real
    (nunca aplica el signal ajeno: `Espia(estricto=True)` lo prueba), pero sin este test nada lo
    ejercitaba a nivel HTTP -- exactamente el hueco que el contrato de D5 pedía cerrar."""
    espia = Espia(estricto=True)
    client_b, _ = armar(TENANT_B, espia=espia)
    factura_b = client_b.post("/afip/facturas", json={"cuit": CUIT}).json()["factura_id"]

    client_a, _ = armar(TENANT_A, espia=espia, raise_server_exceptions=False)
    for metodo, ruta, body in _rutas_de_mutacion_factura(factura_b):
        kwargs = {"json": body} if body is not None else {}
        r = getattr(client_a, metodo)(ruta, **kwargs)
        assert r.status_code != 200, f"{metodo.upper()} {ruta} dejó pasar una mutación con datos ajenos"
    assert espia.signals == [], "ningún signal con datos de A llegó a aplicarse sobre la factura de B"


def test_ADVERSARIAL_confirmar_anulacion_no_alcanza_la_de_otro_tenant():
    """Mismo hueco que arriba, del lado de anulaciones: `POST /afip/anulaciones/{id}/confirmar` es la
    única mutación de ese sub-recurso (`GET` ya usa `consultar_anulacion`, que sí filtra por wf_id)."""
    espia = Espia(estricto=True)
    client_b, _ = armar(TENANT_B, espia=espia)
    cuerpo = {"cuit": CUIT, "tipo_cbte": 11, "punto_venta": 6, "nro": 9}
    anulacion_b = client_b.post("/afip/comprobantes/anular", json=cuerpo).json()["anulacion_id"]

    client_a, _ = armar(TENANT_A, espia=espia, raise_server_exceptions=False)
    r = client_a.post(f"/afip/anulaciones/{anulacion_b}/confirmar")
    assert r.status_code != 200, "confirmar la anulación de otro tenant no puede devolver 200"
    assert espia.signals == []


def test_CONTROL_las_mutaciones_adversariales_pasan_si_el_espia_no_es_estricto():
    """Control del par de arriba: sin el modo estricto (el `Espia` de siempre, el que usan los demás
    tests de este archivo), ¿el escenario hostil se cazaría igual? Tiene que dar 200 -- si no,
    el par de arriba no está probando el guard real, sino una coincidencia del fake."""
    espia = Espia()  # default: no estricto, exactamente como antes de este test
    client_b, _ = armar(TENANT_B, espia=espia)
    factura_b = client_b.post("/afip/facturas", json={"cuit": CUIT}).json()["factura_id"]
    client_a, _ = armar(TENANT_A, espia=espia)
    r = client_a.post(f"/afip/facturas/{factura_b}/cancelar")
    assert r.status_code == 200, "el fake permeable tiene que dejarlo pasar para que el test de arriba pruebe algo"


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
