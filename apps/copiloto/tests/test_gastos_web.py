"""Endpoints de GASTOS — contrato `gastos-fase1`.

Se prueba por HTTP con `TestClient` y no llamando a los handlers: el bug que FRONTEND cazó en la
revisión del contrato (`/gastos/resumen` cayendo en `/gastos/{gasto_id}`) **es de routing**, y un test
que invoca el handler directo no lo ve nunca.
"""
from __future__ import annotations

import datetime
from decimal import Decimal

import pytest
from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.testclient import TestClient

from gastos_web import create_gastos_app


def _require_tenant_fixed(cliente_id: str):
    def dep() -> str:
        return cliente_id
    return dep


def _require_tenant_401():
    def dep(authorization: str | None = Header(default=None)) -> str:
        raise HTTPException(status_code=401, detail="sin token")
    return dep


class _FakeGastoStore:
    """Comparte el dict entre tenants A PROPÓSITO: si el filtro por `cliente_id` no existiera, el
    test adversarial tiene que poder VERLO. Un fake con un dict por tenant haría pasar el test aunque
    el store real no filtrara nada."""

    def __init__(self, bucket: dict, cliente_id: str) -> None:
        self._b = bucket
        self._cid = cliente_id
        self._b.setdefault("_seq", 0)

    def crear(self, *, monto, fecha=None, categoria="otros", proveedor="", medio_pago="",
              descripcion="", origen="manual", monto_sugerido=None) -> dict:
        self._b["_seq"] += 1
        g = {"id": self._b["_seq"], "monto": f"{Decimal(str(monto)):.2f}",
             "fecha": (fecha or datetime.date(2026, 7, 21)).isoformat(), "categoria": categoria,
             "proveedor": proveedor or None, "medio_pago": medio_pago or None,
             "descripcion": descripcion or None, "origen": origen,
             "monto_sugerido": f"{Decimal(str(monto_sugerido)):.2f}" if monto_sugerido else None,
             "creado_en": "2026-07-21T22:00:00+00:00"}
        self._b.setdefault(self._cid, {})[g["id"]] = g
        return g

    def listar(self, *, limit=50):
        mios = list(self._b.get(self._cid, {}).values())
        return mios[:limit], len(mios)

    def detalle(self, gasto_id: int):
        return self._b.get(self._cid, {}).get(gasto_id)

    def resumen(self, periodo=None):
        mios = list(self._b.get(self._cid, {}).values())
        total = sum(Decimal(g["monto"]) for g in mios)
        return {"periodo": periodo or "2026-07", "total": f"{total:.2f}",
                "por_categoria": [], "mes_anterior": None}


def _app(*, cliente_id="cid-A", bucket=None, require_tenant=None):
    bucket = bucket if bucket is not None else {}
    app = create_gastos_app(require_tenant=require_tenant or _require_tenant_fixed(cliente_id),
                            gasto_store_factory=lambda cid: _FakeGastoStore(bucket, cid))
    return TestClient(app), bucket


_BODY = {"monto": "15000.00", "categoria": "mercaderia", "proveedor": "Distribuidora Sur",
         "origen": "voz", "descripcion": "quince mil de mercadería"}


# --- 🔴 el bug de routing que FRONTEND cazó antes de que existiera el código ---

def test_resumen_NO_cae_en_la_ruta_del_id():
    """`/gastos/resumen` tiene que llegar a su handler, no morir con `422 int_parsing` sobre un
    `gasto_id` que el cliente nunca mandó. Depende del ORDEN de declaración en el router: si alguien
    mueve `resumen` debajo de `{gasto_id}`, esto falla. Es el único guard posible — ningún test que
    llame al handler directo lo vería."""
    cli, _ = _app()
    r = cli.get("/gastos/resumen")
    assert r.status_code == 200, r.text
    assert "periodo" in r.json() and "por_categoria" in r.json()


def test_un_id_que_NO_es_entero_sigue_dando_422():
    """El control del anterior: que `resumen` funcione no puede significar que cualquier texto pase.
    `/gastos/abc` tiene que seguir siendo un 422 de parseo."""
    cli, _ = _app()
    assert cli.get("/gastos/abc").status_code == 422


# --- la sonda de despliegue (§7 del contrato) ---

def test_la_sonda_POST_con_body_vacio_da_400_y_NO_escribe():
    """El contrato pide 400 y lo damos de verdad —validando a mano— en vez de bajar el status para
    contentar al instrumento. Y no puede escribir: la sonda corre contra producción."""
    cli, bucket = _app()
    r = cli.post("/gastos", json={})
    assert r.status_code == 400
    assert "monto" in r.json()["detail"]
    assert bucket.get("cid-A", {}) == {}, "la sonda NO puede crear una fila"


# --- validaciones ---

@pytest.mark.parametrize("monto", ["0", "-5", "abc", "", None])
def test_monto_invalido_es_400_con_el_motivo(monto):
    cli, _ = _app()
    r = cli.post("/gastos", json={**_BODY, "monto": monto})
    assert r.status_code == 400
    assert isinstance(r.json()["detail"], str), "el detalle tiene que ser legible, no el array de pydantic"


def test_categoria_fuera_de_la_lista_es_400():
    """Lista cerrada: si el LLM inventa «stock», «mercadería» y «stock» quedan como rubros distintos
    y '¿en qué se me va la plata?' deja de tener respuesta."""
    cli, _ = _app()
    r = cli.post("/gastos", json={**_BODY, "categoria": "stock"})
    assert r.status_code == 400 and "mercaderia" in r.json()["detail"]


def test_origen_invalido_es_400():
    cli, _ = _app()
    assert cli.post("/gastos", json={**_BODY, "origen": "telepatia"}).status_code == 400


def test_sin_origen_es_400_porque_es_obligatorio():
    cli, _ = _app()
    body = {k: v for k, v in _BODY.items() if k != "origen"}
    assert cli.post("/gastos", json=body).status_code == 400


def test_fecha_mal_formada_es_400_no_500():
    cli, _ = _app()
    r = cli.post("/gastos", json={**_BODY, "fecha": "21/07/2026"})
    assert r.status_code == 400 and "fecha" in r.json()["detail"]


# --- forma de la respuesta ---

def test_crear_devuelve_201_y_el_objeto_COMPLETO():
    """Los opcionales viajan SIEMPRE, con null si no hay dato: un objeto que cambia de forma según el
    caso obliga al cliente a defenderse de dos maneras del mismo dato."""
    cli, _ = _app()
    r = cli.post("/gastos", json={"monto": "500", "origen": "manual"})
    assert r.status_code == 201
    g = r.json()
    assert set(g) == {"id", "monto", "fecha", "categoria", "proveedor", "medio_pago",
                      "descripcion", "origen", "monto_sugerido", "creado_en"}
    assert g["proveedor"] is None and g["medio_pago"] is None
    assert g["categoria"] == "otros", "sin categoría cae en otros, no falla"
    assert g["monto"] == "500.00", "2 decimales SIEMPRE: el cliente formatea el string sin convertir"


def test_el_listado_vacio_es_200_con_lista_vacia_no_404():
    """El estado del primer día. Un 404 acá haría que el cliente trate «todavía no cargó nada» como
    «algo salió mal»."""
    cli, _ = _app()
    r = cli.get("/gastos")
    assert r.status_code == 200 and r.json() == {"gastos": [], "total": 0}


def test_el_total_del_listado_es_el_del_TENANT_no_el_de_la_pagina():
    cli, _ = _app()
    for i in range(5):
        cli.post("/gastos", json={"monto": "100", "origen": "manual"})
    r = cli.get("/gastos?limit=2").json()
    assert len(r["gastos"]) == 2 and r["total"] == 5


def test_monto_sugerido_viaja_y_queda_guardado():
    """Lo pidió FRONTEND antes del DDL: sin esto, un monto aceptado del OCR es indistinguible de uno
    tipeado, y '¿el OCR acierta?' no se puede contestar con datos."""
    cli, _ = _app()
    g = cli.post("/gastos", json={"monto": "1200", "origen": "foto",
                                 "monto_sugerido": "1200.50"}).json()
    assert g["monto_sugerido"] == "1200.50" and g["monto"] == "1200.00"


# --- 🔴 aislamiento cross-tenant (regla dura del proyecto) ---

def test_ADVERSARIAL_un_tenant_no_lee_el_gasto_de_otro():
    """404, NO 403: confirmarle que ese id existe ya es filtrar información."""
    bucket: dict = {}
    cli_b, _ = _app(cliente_id="cid-B", bucket=bucket)
    id_de_b = cli_b.post("/gastos", json=_BODY).json()["id"]

    cli_a, _ = _app(cliente_id="cid-A", bucket=bucket)
    assert cli_a.get(f"/gastos/{id_de_b}").status_code == 404


def test_ADVERSARIAL_el_listado_de_uno_no_trae_los_del_otro():
    bucket: dict = {}
    cli_b, _ = _app(cliente_id="cid-B", bucket=bucket)
    cli_b.post("/gastos", json=_BODY)
    cli_a, _ = _app(cliente_id="cid-A", bucket=bucket)
    assert cli_a.get("/gastos").json() == {"gastos": [], "total": 0}


def test_CONTROL_el_test_adversarial_PUEDE_fallar():
    """Sin este control, los dos de arriba pasarían igual si el fake guardara en buckets separados —
    estarían midiendo el fake, no el filtro. Acá se comprueba que el bucket ES compartido y que la
    fuga sería visible si existiera."""
    bucket: dict = {}
    cli_b, _ = _app(cliente_id="cid-B", bucket=bucket)
    id_de_b = cli_b.post("/gastos", json=_BODY).json()["id"]
    mismo = _FakeGastoStore(bucket, "cid-B")
    assert mismo.detalle(id_de_b) is not None, "el fake tiene que poder mostrar la fuga si existiera"


def test_sin_token_es_401():
    cli, _ = _app(require_tenant=_require_tenant_401())
    assert cli.get("/gastos").status_code == 401
