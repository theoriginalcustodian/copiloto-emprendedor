"""SM-P20 puntos 2 y 3: «Vencen esta semana» (CAE + certificado de ARCA) y el lugar del evento de Calendar."""
from __future__ import annotations

import os
import uuid
from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient

import mi_dia_vencimientos as mv
from mi_dia_web import _eventos_de, create_mi_dia_app

DATABASE_URL = os.environ.get("DATABASE_URL")


# ── puros ────────────────────────────────────────────────────────────────────────────────────────

def test_tenant_vacio_da_lista_vacia():
    assert mv.armar([], []) == []


def test_ventana_ordena_y_conserva_lo_vencido_y_lo_ilegible():
    hoy = date.today()
    caes = [{"id": 1, "nro": 10, "cae_vto": hoy + timedelta(days=5), "dias_para_vencer": 5},
            {"id": 2, "nro": 11, "cae_vto": hoy - timedelta(days=1), "dias_para_vencer": -1},
            {"id": 3, "nro": 12, "cae_vto": hoy + timedelta(days=30), "dias_para_vencer": 30}]   # fuera
    certs = [{"cuit": "20111111112", "vence_at": None, "dias_para_vencer": None, "ilegible": True},
             {"cuit": "20333333334", "vence_at": None, "dias_para_vencer": 200, "ilegible": False}]  # fuera
    salida = mv.armar(caes, certs, dias=7)
    assert [(i["tipo"], i["id"], i["dias"], i["vencido"]) for i in salida] == [
        ("cae", "2", -1, True), ("cae", "1", 5, False), ("certificado", "20111111112", None, False)]
    assert salida[1]["fecha"] == (hoy + timedelta(days=5)).isoformat()
    assert salida[1]["titulo"] == "CAE de la factura N° 10"


# ── endpoint ─────────────────────────────────────────────────────────────────────────────────────

def _app(listar):
    return create_mi_dia_app(require_tenant=lambda: "cid-A", listar_vencimientos=listar)


def test_endpoint_usa_el_tenant_del_token_y_la_ventana():
    llamadas = []
    r = TestClient(_app(lambda cid, dias: llamadas.append((cid, dias)) or [])).get(
        "/mi-dia/vencimientos", params={"dias": 3})
    assert r.status_code == 200 and r.json() == {"vencimientos": []}
    assert llamadas == [("cid-A", 3)]


def test_endpoint_sin_dependencia_da_vacio_y_ventana_fuera_de_rango_es_422():
    c = TestClient(_app(None))
    assert c.get("/mi-dia/vencimientos").json() == {"vencimientos": []}
    assert c.get("/mi-dia/vencimientos", params={"dias": 99}).status_code == 422


# ── punto 3: lugar del evento ────────────────────────────────────────────────────────────────────

def test_ubicacion_presente_ausente_y_vacia():
    res = {"items": [{"id": "e1", "summary": "Visita", "start": {"dateTime": "2026-11-07T10:00:00-03:00"},
                      "location": "Av. Siempreviva 742"},
                     {"id": "e2", "summary": "Llamada", "start": {"dateTime": "2026-11-07T11:00:00-03:00"}},
                     {"id": "e3", "summary": "Otra", "start": {"date": "2026-11-07"}, "location": "  "}]}
    por_id = {e["id"]: e["ubicacion"] for e in _eventos_de(res)}
    assert por_id == {"e1": "Av. Siempreviva 742", "e2": None, "e3": None}


# ── adversarial cross-tenant contra Postgres real (ADR-013) ─────────────────────────────────────

class _CryptoFake:
    def encrypt(self, s):
        return s

    def decrypt(self, s):
        return s


@pytest.mark.skipif(not DATABASE_URL, reason="requiere DATABASE_URL (corre en el VPS)")
def test_ADVERSARIAL_A_no_ve_los_vencimientos_de_B(conn_de_tenant):
    from afip_comprobante_store import AfipComprobanteStore
    a, b = str(uuid.uuid4()), str(uuid.uuid4())
    try:
        AfipComprobanteStore(conn_de_tenant(b), b).registrar(
            cuit="30712345678", tipo_cbte=11, punto_venta=1, nro=4242, cae="CAE-B",
            cae_vto=date.today() + timedelta(days=2), fecha_emision=date.today(), doc_tipo=99,
            doc_nro="0", total="100.00")
        # Cada listar con la conexión DECLARADA de su tenant, como en prod (RLS).
        de_a = mv.make_listar_vencimientos(conn_de_tenant(a), _CryptoFake())(a, 7)
        de_b = mv.make_listar_vencimientos(conn_de_tenant(b), _CryptoFake())(b, 7)
        assert de_a == []
        assert [(i["tipo"], i["dias"]) for i in de_b] == [("cae", 2)]   # control positivo
    finally:
        for cid in (a, b):
            conn = conn_de_tenant(cid)()
            try:
                with conn.cursor() as cur:
                    for tabla in ("afip_comprobantes", "copiloto_eventos"):
                        cur.execute(f"DELETE FROM uc_factory.{tabla} WHERE cliente_id = %s", (cid,))
            finally:
                conn.close()
