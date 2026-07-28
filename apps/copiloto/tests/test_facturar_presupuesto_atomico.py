"""Facturar un presupuesto desestimado lo dejaba trabado entre dos 409 que se contradecían.

El endpoint hacía, en este orden: abrir el borrador de factura → atar el presupuesto a ese
`factura_id` → **recién ahí** intentar `aprobado`, que sobre un `desestimado` levanta
`TransicionInvalida` → 409 «no se puede facturar».

Los dos primeros efectos ya habían ocurrido. Resultado: el presupuesto quedaba con un `factura_id`
apuntando a un borrador que nunca se iba a emitir, el siguiente intento contestaba `ya_facturado`, y
el emprendedor no podía ni facturar ni destrabarlo. Cada mensaje negaba el efecto del otro.

El chequeo de estado ahora va ANTES de todo efecto. Y para la carrera real que queda —alguien
desestima desde otro dispositivo mientras se abre el borrador— se compensan los dos efectos antes de
contestar, en vez de dejar la basura puesta.
"""
from __future__ import annotations

from fastapi import FastAPI
from fastapi.testclient import TestClient

from presupuesto_store import TransicionInvalida
from presupuestos_web import create_presupuestos_app


class StoreFalso:
    """Sólo lo que este endpoint toca. `estado` y `factura_id` son el estado observable."""

    def __init__(self, estado: str, *, desestimar_en_cambio: bool = False) -> None:
        self.estado = estado
        self.factura_id: str | None = None
        self._desestimar_en_cambio = desestimar_en_cambio
        self.cambios: list = []

    def detalle(self, presupuesto_id: int) -> dict:
        return {
            "id": presupuesto_id, "numero": 1, "estado": self.estado, "total": "100.00",
            "facturado": False, "factura_id": self.factura_id,
            "receptor": {"nombre": "Juan", "doc_tipo": 96, "doc_nro": "20111111112",
                         "condicion_iva": 5, "domicilio": "Calle 1"},
            "items": [{"descripcion": "Servicio", "cantidad": "1", "precio_unitario": "100.00"}],
        }

    def marcar_factura(self, presupuesto_id: int, factura_id: str | None) -> bool:
        self.factura_id = factura_id
        return True

    def cambiar_estado(self, presupuesto_id: int, nuevo: str) -> dict:
        self.cambios.append(nuevo)
        if self._desestimar_en_cambio:
            # Simula la carrera: otro cliente lo desestimó mientras abríamos el borrador.
            raise TransicionInvalida("desestimado", nuevo)
        self.estado = nuevo
        return self.detalle(presupuesto_id)


def _app(store: StoreFalso, abiertos: list, señales: list) -> FastAPI:
    async def abrir_borrador(cliente_id, cuit, factura_id):
        abiertos.append(factura_id)
        return True

    async def signal_factura(cliente_id, factura_id, nombre, payload):
        señales.append(nombre)

    # El CUIT sale del store de credenciales AFIP (`_cuit_del_tenant`), no de un parámetro propio.
    cred_store = type("Cred", (), {"primer_cuit": lambda self: "20269996065"})

    return create_presupuestos_app(
        require_tenant=lambda: "t1",
        perfil_negocio_store_factory=lambda cid: None,
        presupuesto_store_factory=lambda cid: store,
        afip_cred_store_factory=lambda cid: cred_store(),
        abrir_borrador=abrir_borrador,
        signal_factura=signal_factura,
        generar_doc=lambda cid, p: {},
    )


def test_un_presupuesto_desestimado_se_rechaza_SIN_abrir_el_borrador():
    """EL TEST QUE IMPORTA. Mide el daño: ¿quedó algún efecto puesto tras el rechazo?"""
    store = StoreFalso("desestimado")
    abiertos: list = []
    señales: list = []

    r = TestClient(_app(store, abiertos, señales)).post("/presupuestos/7/facturar")

    assert r.status_code == 409
    assert r.json()["detail"]["codigo"] == "presupuesto_no_facturable"
    assert abiertos == [], "abrió un borrador para un presupuesto que no se puede facturar"
    assert store.factura_id is None, "lo dejó atado a una factura que nunca se va a emitir"
    assert store.cambios == [], "ni siquiera tenía que intentar el cambio de estado"


def test_control_un_presupuesto_pendiente_se_factura_normal():
    """Control diferencial: si el chequeo nuevo rechazara de más, NADIE podría facturar — y este test
    es lo único que separa 'cerré el agujero' de 'rompí la función'."""
    store = StoreFalso("pendiente")
    abiertos: list = []
    señales: list = []

    r = TestClient(_app(store, abiertos, señales)).post("/presupuestos/7/facturar")

    assert r.status_code == 200
    assert abiertos == [r.json()["factura_id"]]
    assert store.factura_id == r.json()["factura_id"]
    assert store.estado == "aprobado"
    assert "cargar_cliente" in señales and "agregar_item" in señales


def test_control_un_presupuesto_ya_aprobado_se_puede_facturar():
    """`aprobado → aprobado` es idempotente en el store; el chequeo nuevo no puede volverlo un 409."""
    store = StoreFalso("aprobado")

    r = TestClient(_app(store, [], [])).post("/presupuestos/7/facturar")

    assert r.status_code == 200


def test_la_carrera_compensa_los_dos_efectos_antes_de_contestar():
    """Si alguien desestima MIENTRAS se abre el borrador, el 409 llega con el sistema como estaba:
    sin `factura_id` puesto y con el borrador cancelado."""
    store = StoreFalso("pendiente", desestimar_en_cambio=True)
    abiertos: list = []
    señales: list = []

    r = TestClient(_app(store, abiertos, señales)).post("/presupuestos/7/facturar")

    assert r.status_code == 409
    assert store.factura_id is None, "quedó atado: el próximo intento choca con `ya_facturado`"
    assert señales[-1] == "cancelar", "el borrador quedó vivo y facturable por otro camino"
