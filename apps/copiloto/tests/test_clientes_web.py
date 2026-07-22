"""Endpoints de CLIENTES — hito 1 del contrato (el punto de encuentro: los dos GET).

Se prueba por HTTP con `TestClient` y no llamando a los handlers: el bug de routing que FRONTEND cazó
en Gastos (`/gastos/resumen` cayendo en `/gastos/{id}`) **es de routing**, y un test que invoca el
handler directo no lo ve nunca. Acá todavía no hay segmento fijo, pero el guard se ejercita igual —
ver `test_el_guard_del_orden_de_rutas_DISCRIMINA`.
"""
from __future__ import annotations

import pytest
from fastapi import Header, HTTPException
from fastapi.testclient import TestClient

from cliente_store import (DOC_CONSUMIDOR_FINAL, DOC_CUIT, es_consumidor_final,
                           normalizar_nombre)
from clientes_web import create_clientes_app


def _tenant_fijo(cliente_id: str):
    def dep() -> str:
        return cliente_id
    return dep


def _tenant_401():
    def dep(authorization: str | None = Header(default=None)) -> str:
        raise HTTPException(status_code=401, detail="sin token")
    return dep


class _FakeClienteStore:
    """Comparte el dict entre tenants A PROPÓSITO: si el filtro por `cliente_id` no existiera, el test
    adversarial tiene que poder VERLO. Un fake con un dict por tenant haría pasar el test aunque el
    store real no filtrara nada."""

    def __init__(self, bucket: dict, cliente_id: str) -> None:
        self._b = bucket
        self._cid = cliente_id
        self._b.setdefault("_seq", 0)

    def sembrar(self, nombre: str, **extra) -> dict:
        self._b["_seq"] += 1
        c = {"id": self._b["_seq"], "nombre": nombre, "doc_tipo": None, "doc_nro": None,
             "condicion_iva": None, "domicilio": None, "contacto": None, "notas": None,
             "origen": "manual", "creado_en": "2026-07-22T10:00:00+00:00", **extra}
        self._b.setdefault(self._cid, {})[c["id"]] = c
        return c

    def listar(self, *, q="", limit=50):
        mios = list(self._b.get(self._cid, {}).values())
        if q:
            mios = [c for c in mios if normalizar_nombre(q) in normalizar_nombre(c["nombre"])]
        return mios[:limit], len(mios)

    def detalle(self, cliente: int):
        return self._b.get(self._cid, {}).get(cliente)


def _app(*, cliente_id="cid-A", bucket=None, require_tenant=None):
    bucket = bucket if bucket is not None else {}
    app = create_clientes_app(require_tenant=require_tenant or _tenant_fijo(cliente_id),
                              cliente_store_factory=lambda cid: _FakeClienteStore(bucket, cid))
    return TestClient(app), bucket


# --- el punto de encuentro: los dos GET, vacíos ---

def test_la_cartera_vacia_es_200_con_lista_vacia_no_404():
    """El estado hasta que corra el backfill del hito 2. Un 404 acá haría que la app trate «todavía no
    hay clientes» como «algo salió mal»."""
    cli, _ = _app()
    r = cli.get("/clientes")
    assert r.status_code == 200 and r.json() == {"clientes": [], "total": 0}


def test_una_ficha_inexistente_es_404():
    cli, _ = _app()
    r = cli.get("/clientes/999")
    assert r.status_code == 404 and "cliente" in r.json()["detail"]


def test_la_ficha_devuelve_SECCIONES_no_un_objeto_plano():
    """Contrato §13: sumar «sus pagos» después no cambia el contrato de los consumidores actuales.
    `presupuestos` y `facturas` viajan vacías y DECLARADAS, que es distinto de no estar."""
    cli, bucket = _app()
    _FakeClienteStore(bucket, "cid-A").sembrar("Panadería Los Tilos")
    r = cli.get("/clientes/1")
    assert r.status_code == 200
    assert set(r.json()) == {"cliente", "presupuestos", "facturas"}
    assert r.json()["presupuestos"] == [] and r.json()["facturas"] == []


def test_el_total_del_listado_es_el_del_TENANT_no_el_de_la_pagina():
    cli, bucket = _app()
    store = _FakeClienteStore(bucket, "cid-A")
    for i in range(5):
        store.sembrar(f"Cliente {i}")
    r = cli.get("/clientes?limit=2").json()
    assert len(r["clientes"]) == 2 and r["total"] == 5


def test_la_busqueda_por_q_ignora_tildes_y_mayusculas():
    cli, bucket = _app()
    _FakeClienteStore(bucket, "cid-A").sembrar("Panadería Los Tilos")
    assert cli.get("/clientes?q=PANADERIA").json()["total"] == 1
    assert cli.get("/clientes?q=ferretería").json()["total"] == 0


# --- 🔴 el guard del orden de rutas ---

def test_el_guard_del_orden_de_rutas_DISCRIMINA():
    """Hoy no hay ningún segmento fijo bajo `/clientes`, así que no hay nada que romper — y por eso
    mismo el guard tiene que existir: el que agregue el primero es el que no va a saber.

    Este test comprueba que el mecanismo del bug ESTÁ ACTIVO: un segmento textual cae en la ruta del
    id y muere con `422 int_parsing`. Si mañana alguien agrega `/clientes/opciones` DESPUÉS de
    `/clientes/{cliente}`, va a ver exactamente este 422 y va a saber por qué."""
    cli, _ = _app()
    r = cli.get("/clientes/loquesea")
    assert r.status_code == 422
    assert r.json()["detail"][0]["type"] == "int_parsing", \
        "si esto deja de ser int_parsing, el guard del comentario en clientes_web.py quedó obsoleto"


# --- 🔴 aislamiento cross-tenant (regla dura del proyecto) ---

def test_ADVERSARIAL_un_tenant_no_ve_la_ficha_de_otro():
    """404, NO 403: confirmarle que ese id existe ya es filtrar información."""
    bucket: dict = {}
    id_de_b = _FakeClienteStore(bucket, "cid-B").sembrar("Cliente de B")["id"]
    cli_a, _ = _app(cliente_id="cid-A", bucket=bucket)
    assert cli_a.get(f"/clientes/{id_de_b}").status_code == 404


def test_ADVERSARIAL_el_listado_de_uno_no_trae_los_del_otro():
    bucket: dict = {}
    _FakeClienteStore(bucket, "cid-B").sembrar("Cliente de B")
    cli_a, _ = _app(cliente_id="cid-A", bucket=bucket)
    assert cli_a.get("/clientes").json() == {"clientes": [], "total": 0}


def test_CONTROL_el_test_adversarial_PUEDE_fallar():
    """Sin este control, los dos de arriba pasarían igual si el fake guardara en buckets separados —
    estarían midiendo el fake, no el filtro."""
    bucket: dict = {}
    id_de_b = _FakeClienteStore(bucket, "cid-B").sembrar("Cliente de B")["id"]
    mismo = _FakeClienteStore(bucket, "cid-B")
    assert mismo.detalle(id_de_b) is not None, "el fake tiene que poder mostrar la fuga si existiera"


def test_sin_token_es_401():
    cli, _ = _app(require_tenant=_tenant_401())
    assert cli.get("/clientes").status_code == 401


# --- 🔴 §3.2: el consumidor final no crea cliente ---

def test_el_consumidor_final_NO_es_un_cliente():
    """Verificado contra `afip_rules.TipoDoc.CONSUMIDOR_FINAL = 99`. Si la deduplicación por documento
    lo aceptara, TODAS las ventas de mostrador colapsarían en un único registro fantasma con el grueso
    de la facturación adentro — que además encabezaría el ranking de mejores clientes."""
    assert es_consumidor_final(DOC_CONSUMIDOR_FINAL) is True
    assert es_consumidor_final(99) is True and es_consumidor_final("99") is True


@pytest.mark.parametrize("doc_tipo", [DOC_CUIT, 96, None])
def test_CONTROL_los_demas_tipos_SI_son_clientes(doc_tipo):
    """El control del anterior: que 99 no sea cliente no puede significar que nada lo sea."""
    assert es_consumidor_final(doc_tipo) is False


# --- la normalización, que es la clave de dedup sin documento ---

@pytest.mark.parametrize("crudo, esperado", [
    ("Panadería  Los Tilos.", "panaderia los tilos"),
    ("PANADERIA LOS TILOS", "panaderia los tilos"),
    ("Panadería Los Tilos", "panaderia los tilos"),
    ("  Ferretería   El Tornillo  ", "ferreteria el tornillo"),
    ("Juan Pérez", "juan perez"),
    ("S.A. Gómez & Hnos", "s a gomez hnos"),
])
def test_la_normalizacion_colapsa_lo_que_es_el_mismo_nombre(crudo, esperado):
    assert normalizar_nombre(crudo) == esperado


def test_CONTROL_la_normalizacion_NO_colapsa_nombres_distintos():
    """Sin esto, una normalización demasiado agresiva —que borrara todo y devolviera ''— pasaría todos
    los tests de arriba y fusionaría clientes que no tienen nada que ver."""
    assert normalizar_nombre("Panadería Los Tilos") != normalizar_nombre("Ferretería El Tornillo")
    assert normalizar_nombre("Juan Pérez") != normalizar_nombre("Juan Gómez")
    assert normalizar_nombre("Los Tilos") != ""
