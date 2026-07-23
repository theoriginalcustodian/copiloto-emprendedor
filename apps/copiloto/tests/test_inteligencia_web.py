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


# --- gráficos: forma final sin queries (mismo punto de encuentro que la portada) ---

def test_facturacion_sin_queries_es_200_forma_vacia():
    r = _app().get("/inteligencia/graficos/facturacion")
    assert r.status_code == 200
    assert r.json() == {"tipo": "barras", "periodo": "", "serie": []}


def test_facturacion_detalle_sin_queries_es_200_forma_vacia():
    r = _app().get("/inteligencia/graficos/facturacion?detalle=2026-07")
    assert r.status_code == 200
    assert r.json() == {"mes": "2026-07", "filas": []}


def test_entro_vs_salio_sin_queries_es_200_forma_vacia():
    r = _app().get("/inteligencia/graficos/entro-vs-salio")
    assert r.status_code == 200
    assert r.json() == {"tipo": "barras_enfrentadas", "periodo": "", "serie": []}


def test_entro_vs_salio_detalle_mal_formado_es_400():
    r = _app(queries_factory=lambda cid: object()).get(
        "/inteligencia/graficos/entro-vs-salio?detalle=2026-07-sin-dos-puntos")
    assert r.status_code == 400


def test_categorias_sin_queries_es_200_forma_vacia():
    r = _app().get("/inteligencia/graficos/categorias")
    assert r.status_code == 200
    assert r.json() == {"tipo": "torta", "periodo": "", "serie": []}


def test_categorias_detalle_categoria_invalida_es_400():
    class _Q:
        def categoria_detalle(self, mes, cat):
            raise ValueError(f"categoría inválida: {cat!r}")

    r = _app(queries_factory=lambda cid: _Q()).get(
        "/inteligencia/graficos/categorias?detalle=inventada")
    assert r.status_code == 400


def test_graficos_pasan_el_cliente_id_del_tenant():
    vistos = []

    class _Q:
        def __init__(self, cid):
            vistos.append(cid)

        def facturacion_por_mes(self):
            return {"tipo": "barras", "periodo": "", "serie": []}

    _app(require_tenant=_tenant_fijo("cid-XYZ"),
        queries_factory=lambda cid: _Q(cid)).get("/inteligencia/graficos/facturacion")
    assert vistos == ["cid-XYZ"]


def test_graficos_sin_token_son_401():
    app = _app(require_tenant=_tenant_401())
    assert app.get("/inteligencia/graficos/facturacion").status_code == 401
    assert app.get("/inteligencia/graficos/entro-vs-salio").status_code == 401
    assert app.get("/inteligencia/graficos/categorias").status_code == 401
    assert app.get("/inteligencia/graficos/margen-trabajo").status_code == 401


# --- gráfico 4: margen por trabajo ---

def test_margen_trabajo_sin_queries_es_200_forma_vacia():
    r = _app().get("/inteligencia/graficos/margen-trabajo")
    assert r.status_code == 200
    assert r.json() == {"tipo": "barras", "trabajos": [], "sin_ingreso": []}


def test_margen_trabajo_detalle_mal_formado_es_400():
    r = _app(queries_factory=lambda cid: object()).get(
        "/inteligencia/graficos/margen-trabajo?detalle=presupuesto-sin-dos-puntos")
    assert r.status_code == 400


def test_margen_trabajo_detalle_ref_no_numerico_es_400():
    r = _app(queries_factory=lambda cid: object()).get(
        "/inteligencia/graficos/margen-trabajo?detalle=presupuesto:abc")
    assert r.status_code == 400


def test_margen_trabajo_detalle_inexistente_es_404():
    from trabajo_store import TrabajoInexistente

    class _Q:
        def margen_trabajo_detalle(self, eslabon, ref):
            raise TrabajoInexistente()

    r = _app(queries_factory=lambda cid: _Q()).get(
        "/inteligencia/graficos/margen-trabajo?detalle=presupuesto:9999")
    assert r.status_code == 404


# --- el chat (§3) ---

def test_chat_sin_chat_factory_es_200_no_tengo_ese_dato():
    """Punto de encuentro: sin LLM/Graphity configurados (best-effort, como `memory_provider`), el
    endpoint sigue vivo — nunca 500."""
    r = _app().post("/inteligencia/chat", json={"texto": "¿cuánto me queda?"})
    assert r.status_code == 200
    assert r.json() == {"respuesta": "No tengo ese dato.", "fuente": "no-se"}


def test_chat_pasa_el_texto_y_el_cliente_id_a_la_factory():
    vistos = []

    class _Chat:
        def __init__(self, cid):
            vistos.append(cid)

        def responder(self, texto):
            vistos.append(texto)
            return {"respuesta": "ok", "fuente": "sql"}

    r = _app(require_tenant=_tenant_fijo("cid-XYZ"),
            chat_factory=lambda cid: _Chat(cid)).post(
        "/inteligencia/chat", json={"texto": "¿cuánto facturé?"})
    assert r.status_code == 200
    assert r.json() == {"respuesta": "ok", "fuente": "sql"}
    assert vistos == ["cid-XYZ", "¿cuánto facturé?"]


def test_chat_sin_texto_es_422_body_invalido():
    r = _app().post("/inteligencia/chat", json={})
    assert r.status_code == 422


def test_chat_sin_token_es_401():
    r = _app(require_tenant=_tenant_401()).post("/inteligencia/chat", json={"texto": "hola"})
    assert r.status_code == 401
