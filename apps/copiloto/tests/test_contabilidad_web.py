"""`GET /contabilidad/resumen` — contrato hito-C. HTTP con `TestClient` (no llamando al handler
directo): el bug histórico de `/gastos/resumen` cayendo en `/gastos/{id}` es de ROUTING, y sólo un
test por HTTP lo vería (mismo criterio que `test_gastos_web.py`).

Los cálculos reales (caja con Postgres, cross-tenant) están en `test_contabilidad_integracion.py` —
acá se prueban forma del wire, fail-soft y las trampas que el contrato marca como "verificadas en el
cliente": `caja` siempre presente, `cliente_ref` como int, `tope`/`mes_anterior` como `null`, período
inválido.
"""
from __future__ import annotations

import pytest
from fastapi import Header, HTTPException
from fastapi.testclient import TestClient

from contabilidad_web import create_contabilidad_app


def _require_tenant_fixed(cliente_id: str):
    def dep() -> str:
        return cliente_id
    return dep


def _require_tenant_401():
    def dep(authorization: str | None = Header(default=None)) -> str:
        raise HTTPException(status_code=401, detail="sin token")
    return dep


class _FakeCobroStore:
    def __init__(self, ingresos: dict | None = None, clientes: list | None = None):
        self._ingresos = ingresos or {"periodo": "2026-07", "total": "0.00", "mes_anterior": None}
        self._clientes = clientes if clientes is not None else []

    def total_periodo(self, periodo=None):
        return {**self._ingresos, "periodo": periodo or self._ingresos["periodo"]}

    def top_clientes(self, periodo=None, *, limite=5):
        return self._clientes


class _FakeGastoStore:
    def __init__(self, gastos: dict | None = None):
        self._gastos = gastos or {"total": "0.00", "por_categoria": [], "mes_anterior": None}

    def resumen(self, periodo=None):
        return dict(self._gastos)


class _FakeAfipComprobanteStore:
    def __init__(self, facturado: dict | None = None):
        self._facturado = facturado or {"periodo": "0.00", "doce_meses": "0.00"}

    def total_periodo(self, periodo=None):
        return dict(self._facturado)


def _app(*, cliente_id="cid-A", require_tenant=None, ingresos=None, gastos=None, facturado=None,
         clientes=None):
    app = create_contabilidad_app(
        require_tenant=require_tenant or _require_tenant_fixed(cliente_id),
        cobro_store_factory=lambda cid: _FakeCobroStore(ingresos, clientes),
        gasto_store_factory=lambda cid: _FakeGastoStore(gastos),
        afip_comprobante_store_factory=lambda cid: _FakeAfipComprobanteStore(facturado),
    )
    return TestClient(app)


# --- forma del wire (§1 del contrato, "verificado en el cliente") ---

def test_la_clave_caja_SIEMPRE_esta_presente_aunque_todo_este_vacio():
    """§1 trampa 1: el cliente valida por FORMA, no por status. Un `{}` se lee como "no desplegado"
    aunque el status sea 200 — el catch-all del SPA devuelve 200 con HTML sobre rutas inexistentes."""
    r = _app().get("/contabilidad/resumen")
    assert r.status_code == 200, r.text
    body = r.json()
    assert "caja" in body and "gastos" in body and "facturado" in body and "clientes" in body
    assert body["caja"] == {"entro": "0.00", "salio": "0.00", "queda": "0.00", "mes_anterior": None}


def test_tope_es_null_sin_escala_de_monotributo_configurada():
    """§4.3 del contrato master: fail-soft deliberado, no un dato faltante por bug."""
    r = _app().get("/contabilidad/resumen")
    assert r.json()["facturado"]["tope"] is None


def test_cliente_ref_serializa_como_int_no_como_string():
    """Mismo bug que el id de tarjeta de PR #107: un `"12"` entrecomillado se lee como `0` en
    silencio (`typeof c.cliente_ref === 'number'` del lado cliente)."""
    r = _app(clientes=[{"cliente_ref": 12, "nombre": "Ferretería López", "total": "84000.00"}]) \
        .get("/contabilidad/resumen")
    ref = r.json()["clientes"][0]["cliente_ref"]
    assert isinstance(ref, int) and ref == 12


def test_clientes_vacio_es_valido():
    r = _app(clientes=[]).get("/contabilidad/resumen")
    assert r.json()["clientes"] == []


def test_queda_negativo_viaja_tal_cual():
    """§1: `queda` puede ser negativo y la app lo muestra a propósito — no se clava en cero."""
    r = _app(ingresos={"periodo": "2026-07", "total": "50000.00", "mes_anterior": None},
             gastos={"total": "80000.00", "por_categoria": [], "mes_anterior": None}) \
        .get("/contabilidad/resumen")
    assert r.json()["caja"]["queda"] == "-30000.00"


def test_mes_anterior_null_cuando_no_hay_datos_de_ningun_lado():
    r = _app().get("/contabilidad/resumen")
    assert r.json()["caja"]["mes_anterior"] is None


def test_mes_anterior_completa_con_cero_el_lado_sin_datos():
    """Si sólo un lado tiene fila el mes pasado ("gastó pero no cobró nada"), el otro entra en
    0.00 -- es un estado real, no algo que esconder poniendo el objeto entero en null."""
    r = _app(ingresos={"periodo": "2026-07", "total": "0.00", "mes_anterior": None},
             gastos={"total": "0.00", "por_categoria": [], "mes_anterior": "5000.00"}) \
        .get("/contabilidad/resumen")
    assert r.json()["caja"]["mes_anterior"] == {"entro": "0.00", "salio": "5000.00", "queda": "-5000.00"}


def test_gastos_por_categoria_viaja_tal_cual_de_GastoStore_resumen():
    """§4.2: `por_categoria` es EXACTAMENTE la forma que ya devuelve `GET /gastos/resumen` — se
    reusa el cálculo, no se reimplementa."""
    por_cat = [{"categoria": "mercaderia", "total": "30000.00", "porcentaje": 62.5}]
    r = _app(gastos={"total": "30000.00", "por_categoria": por_cat, "mes_anterior": None}) \
        .get("/contabilidad/resumen")
    assert r.json()["gastos"]["por_categoria"] == por_cat


def test_periodo_invalido_400():
    r = _app().get("/contabilidad/resumen", params={"periodo": "no-es-un-periodo"})
    assert r.status_code == 400, r.text


def test_sin_periodo_usa_el_default_del_store():
    r = _app().get("/contabilidad/resumen")
    assert r.json()["periodo"] == "2026-07"


# --- tenant ---

def test_sin_token_401_no_pasa_por_los_stores():
    cli = _app(require_tenant=_require_tenant_401())
    r = cli.get("/contabilidad/resumen")
    assert r.status_code == 401
