"""INTELIGENCIA DE NEGOCIO — el endpoint de portada (routing, forma, barrera de tenant).

Con `TestClient` y fakes: lo que se defiende acá es routing, la barrera `require_tenant` y que la
**forma** sea la del §3.1 con `caja` siempre presente (el centinela que la app usa para distinguir la
portada real del HTML del SPA). La aritmética real —qué cuenta como «Entró», el control del §1.bis—
vive en `test_inteligencia_queries.py`, contra la base: un fake que devuelve lo que le pido no puede
falsear una suma que no hizo.
"""
from __future__ import annotations

import pytest
from fastapi import Header, HTTPException
from fastapi.testclient import TestClient

from inteligencia_web import create_inteligencia_app


def _tenant_fijo(cid: str = "cid-A"):
    def dep() -> str:
        return cid
    return dep


def _tenant_401():
    def dep(authorization: str | None = Header(default=None)) -> str:
        raise HTTPException(status_code=401, detail="sin token")
    return dep


def _app(**kw):
    return TestClient(create_inteligencia_app(require_tenant=kw.pop("require_tenant", _tenant_fijo()),
                                              **kw))


CLAVES_PORTADA = {"caja", "mes", "serie_mensual", "mejores_clientes", "por_cobrar"}
CLAVES_MES = {"ingresos", "gastos", "rentabilidad", "facturado", "cobrado"}


# --- el punto de encuentro: la forma final aunque no haya queries (front-door sin DB) ---

def test_sin_queries_es_200_con_la_forma_final_y_ceros_calculados():
    """El §6 (punto de encuentro): el endpoint devuelve la forma final con datos vacíos. Los importes
    en "0.00" son un cero CALCULADO, no ausente — la app los distingue por la presencia de `caja`."""
    r = _app().get("/inteligencia/portada")
    assert r.status_code == 200
    body = r.json()
    assert set(body) == CLAVES_PORTADA
    assert body["caja"] == {"saldo": "0.00", "moneda": "ARS"}
    assert set(body["mes"]) == CLAVES_MES
    assert all(v == "0.00" for v in body["mes"].values())
    assert body["serie_mensual"] == [] and body["mejores_clientes"] == []
    assert body["por_cobrar"] == {"total": "0.00", "vencido": "0.00"}


def test_caja_es_el_centinela_y_viaja_siempre():
    """El adapter de la app corta con `'caja' in raw`: si la clave no está, trata la respuesta como
    'endpoint no desplegado'. Tiene que estar en las dos ramas (con y sin queries)."""
    assert "caja" in _app().get("/inteligencia/portada").json()

    class _Q:
        def portada(self):
            return {"caja": {"saldo": "530000.00", "moneda": "ARS"}, "mes": {}, "serie_mensual": [],
                    "mejores_clientes": [], "por_cobrar": {"total": "0.00", "vencido": "0.00"}}

    r = _app(queries_factory=lambda cid: _Q()).get("/inteligencia/portada")
    assert r.status_code == 200
    assert r.json()["caja"]["saldo"] == "530000.00"


def test_pasa_el_cliente_id_del_tenant_a_la_factory():
    """La factory recibe EXACTAMENTE el `cliente_id` que resolvió `require_tenant` — no un default ni
    un header crudo. Es la mitad web del aislamiento (regla 7): el resto lo ejercita el test pg."""
    vistos = []

    class _Q:
        def __init__(self, cid):
            vistos.append(cid)

        def portada(self):
            return {"caja": {"saldo": "0.00", "moneda": "ARS"}}

    _app(require_tenant=_tenant_fijo("cid-XYZ"),
         queries_factory=lambda cid: _Q(cid)).get("/inteligencia/portada")
    assert vistos == ["cid-XYZ"]


def test_sin_token_es_401_no_200_vacio():
    """Sin la barrera, la portada de un tenant sería accesible sin auth. 401, no una portada en cero
    que parecería 'este negocio no tiene nada'."""
    assert _app(require_tenant=_tenant_401()).get("/inteligencia/portada").status_code == 401
