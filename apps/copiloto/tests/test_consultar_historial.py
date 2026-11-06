"""`consultar_historial` — Inteligencia de Negocio por chat: la HISTORIA del negocio desde el grafo.

Lo que se defiende (cada punto es una forma de contestarle al emprendedor algo falso con cara de cierto):
  1. **Tenant del `ctx`, nunca de los `arguments`** (regla 7) — test ADVERSARIAL: el modelo intenta
     nombrar el grafo de otro emprendedor y la búsqueda igual va al propio.
  2. **Lo superado no se contesta como vigente**: `/graph/search` NO filtra `invalid_at`.
  3. **Vacío ≠ error**: sin resultados se dice «no lo tengo»; con el grafo caído, error explícito.
  4. La observación prohíbe sumar (la búsqueda es top-K, una muestra).
"""
from __future__ import annotations

import httpx

import tool_catalog
from graphity_structured_client import GrafoIngestError, GraphityStructuredClient

from test_execute_tool import _Ctx


def _edge(fact, valid="2026-09-23T00:00:00Z", invalid=None):
    return {"name": "X", "fact": fact, "valid_at": valid, "invalid_at": invalid, "uuid": "u"}


class _GrafoFalso:
    def __init__(self, edges=(), boom=False):
        self.edges, self.boom, self.llamadas = list(edges), boom, []

    def search(self, query, *, group_ids, scope="edges", limit=10):
        self.llamadas.append({"query": query, "group_ids": group_ids, "scope": scope, "limit": limit})
        if self.boom:
            raise GrafoIngestError("POST /graph/search: agotados 3 intentos")
        return {"edges": self.edges, "nodes": [], "communities": []}


def _correr(args, grafo, ctx=None):
    ex = tool_catalog.make_tool_executor(None, now_iso_provider=lambda: "2026-11-06T12:00:00+00:00",
                                         grafo_client_factory=lambda: grafo)
    return ex("consultar_historial", args, ctx or _Ctx(), confirmed=False, idem_key="k")


def test_esta_en_el_catalogo_es_read_y_tiene_su_capacidad():
    nombres = {s["function"]["name"] for s in tool_catalog.build_tool_catalog()}
    assert {"consultar_historial", "consultar_cliente"} <= nombres
    assert "consultar_historial" not in tool_catalog.WRITE_TOOLS
    tools_guia = {c["tool"] for c in tool_catalog.capacidades_vivas()["capacidades"]}
    assert {"consultar_historial", "consultar_cliente"} <= tools_guia


def test_ADVERSARIAL_el_grafo_sale_del_ctx_aunque_el_modelo_nombre_otro_tenant():
    """Actor A pide el grafo de B por los argumentos → la búsqueda va igual al de A."""
    grafo = _GrafoFalso([_edge("hecho de A")])
    _correr({"pregunta": "presupuestos", "group_id": "negocio-B", "group_ids": ["negocio-B"],
             "cliente_id": "B"}, grafo)
    assert grafo.llamadas[0]["group_ids"] == [f"negocio-{_Ctx.cliente_id}"]
    assert all("B" not in g for g in grafo.llamadas[0]["group_ids"])


def test_lo_superado_no_se_contesta_como_vigente():
    grafo = _GrafoFalso([_edge("El flete costaba $5000", invalid="2026-10-01T00:00:00Z"),
                         _edge("El flete costaba $7000", valid="2026-10-01T00:00:00Z")])
    obs = _correr({"pregunta": "precio del flete"}, grafo).observation["result"]
    assert "$7000" in obs and "$5000" not in obs


def test_incluir_anteriores_trae_lo_superado_MARCADO():
    grafo = _GrafoFalso([_edge("El flete costaba $5000", invalid="2026-10-01T00:00:00Z"),
                         _edge("El flete costaba $7000", valid="2026-10-01T00:00:00Z")])
    obs = _correr({"pregunta": "cómo cambió el flete", "incluir_anteriores": True},
                  grafo).observation["result"]
    linea_vieja = next(l for l in obs.splitlines() if "$5000" in l)
    assert "YA NO VIGENTE desde 2026-10-01" in linea_vieja


def test_sin_resultados_dice_que_no_lo_tiene_y_no_es_error():
    tr = _correr({"pregunta": "algo que no pasó"}, _GrafoFalso([]))
    assert tr.status == "ok" and tr.is_write is False
    assert "No encontré nada registrado" in tr.observation["result"]


def test_solo_superados_sin_pedirlos_cuenta_como_vacio():
    """Si todo lo que vuelve está superado, NO hay hecho vigente que contestar."""
    tr = _correr({"pregunta": "flete"}, _GrafoFalso([_edge("viejo", invalid="2026-10-01T00:00:00Z")]))
    assert "No encontré nada registrado" in tr.observation["result"]


def test_grafo_caido_es_error_explicito_nunca_un_vacio():
    tr = _correr({"pregunta": "presupuestos"}, _GrafoFalso(boom=True))
    assert tr.status == "error"
    assert "No encontré" not in str(tr.observation)


def test_sin_grafo_configurado_es_error_explicito():
    ex = tool_catalog.make_tool_executor(None, now_iso_provider=lambda: "x")
    tr = ex("consultar_historial", {"pregunta": "x"}, _Ctx(), confirmed=False, idem_key="k")
    assert tr.status == "error"


def test_la_observacion_prohibe_sumar_y_lleva_la_fecha():
    obs = _correr({"pregunta": "cobros"}, _GrafoFalso([_edge("el negocio cobró $100")])).observation["result"]
    assert "no los sumes" in obs
    assert "- 2026-09-23: el negocio cobró $100" in obs


def test_deduplica_el_mismo_hecho_repetido():
    grafo = _GrafoFalso([_edge("mismo hecho"), _edge("mismo hecho")])
    obs = _correr({"pregunta": "x"}, grafo).observation["result"]
    assert obs.count("mismo hecho") == 1


def test_camino_de_produccion_el_cliente_real_filtra_por_el_group_del_ctx():
    """Composition root real (`GraphityStructuredClient` sobre HTTP mock): el body que llega al server
    lleva SÓLO el group del tenant del ctx."""
    import json
    cuerpos = []

    def handler(req: httpx.Request) -> httpx.Response:
        cuerpos.append(json.loads(req.content))
        return httpx.Response(200, json={"edges": [_edge("hecho real")], "nodes": [], "communities": []})

    real = GraphityStructuredClient(base_url="https://g.test", api_key="gphy_test",
                                    client=httpx.Client(transport=httpx.MockTransport(handler)),
                                    sleep=lambda _s: None)
    obs = _correr({"pregunta": "x", "group_ids": ["negocio-otro"]}, real).observation["result"]
    assert cuerpos[0]["group_ids"] == [f"negocio-{_Ctx.cliente_id}"]
    assert "hecho real" in obs
