"""`POST /ingresos` — el chequeo de duplicado corre ANTES del registro y parsea `monto` él mismo.

Regresión (2026-07-23, cazada en E2E de device): un `monto` con coma decimal ("5678,90", el formato
que tipea el teclado argentino) tira `CobroInvalido` dentro de `store.posible_duplicado(...)`, que se
llamaba FUERA del `try/except CobroInvalido` que sólo envolvía a `registrar_suelto(...)`. Resultado:
500 en vez de 400. `gastos` no tenía este bug porque ahí `_monto_o_400` es la única parada del monto
antes de tocar la DB — acá había DOS paradas y solo una estaba guardada.
"""
from __future__ import annotations

from fastapi import FastAPI
from fastapi.testclient import TestClient

from decimal import Decimal, InvalidOperation

from afip_web import create_afip_app
from cobro_store import CobroInvalido

TENANT = "tenant-ingresos"


class CobroStoreFake:
    """Reproduce la única parte de `CobroStore` que este endpoint toca: el parseo de `monto` en
    `posible_duplicado` (primera parada) y en `registrar_suelto` (segunda parada) — MISMA
    implementación que `cobro_store._decimal` (ni `Decimal` ni el store real aceptan coma decimal;
    ese es justo el bug que este test cubre en el endpoint, no en el parseo)."""

    def __init__(self):
        self.registrados: list[dict] = []

    def _decimal_o_explota(self, monto):
        try:
            Decimal(str(monto))
        except (InvalidOperation, ValueError, TypeError):
            raise CobroInvalido(f"monto no es un número válido: {monto!r}") from None

    def posible_duplicado(self, *, monto, cliente_nombre=""):
        self._decimal_o_explota(monto)
        return None

    def registrar_suelto(self, *, monto, **kw):
        self._decimal_o_explota(monto)
        self.registrados.append({"monto": monto, **kw})
        return {"id": 1, "monto": str(monto).replace(",", "."), "origen": "manual",
                "medio": kw.get("medio") or "", "fecha": "2026-07-23",
                "cliente_nombre": kw.get("cliente_nombre") or "",
                "concepto": kw.get("concepto") or "", "comprobante_id": None,
                "presupuesto_ref": None, "falta": [], "created_at": "2026-07-23T17:00:00+00:00"}


def armar():
    store = CobroStoreFake()
    afip = create_afip_app(
        require_tenant=lambda: TENANT,
        perfil_store_factory=lambda cid: None,
        cred_store_factory=lambda cid: None,
        handoff_factory=lambda cid: None,
        start_onboarding=lambda *a: "wf",
        cobro_store_factory=lambda cid: store,
    )
    app = FastAPI()
    app.include_router(afip.router)
    return TestClient(app), store


def test_monto_con_coma_decimal_da_400_no_500():
    client, _ = armar()
    resp = client.post("/ingresos", json={"monto": "5678,90"})
    assert resp.status_code == 400
    assert "monto" in resp.json()["detail"]


def test_monto_valido_registra_igual_que_antes():
    client, store = armar()
    resp = client.post("/ingresos", json={"monto": "5678.90"})
    assert resp.status_code == 201
    assert store.registrados[0]["monto"] == "5678.90"
