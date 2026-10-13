"""preg-datos (C-D5, contrato 2026-10-13): la card `datos_negocio` y la tool `consultar_negocio`.

Tres capas, a propósito:

  1. `datos_card` con un `queries` falso: lo que se fija es que los números PASAN TAL CUAL (nada se
     suma, se resta ni se recalcula acá) y que cada forma sale como se declara.
  2. El executor real (`make_tool_executor`): read puro sin gate, el tenant sale del `ctx`, y «sin datos»
     no es una card vacía ni un cero inventado.
  3. Postgres REAL con dos tenants (`necesita_pg`): lo que este feature promete —que un emprendedor lee
     SU plata y no la de otro— vive en el SQL de `InteligenciaQueries`, y un fake no lo prueba.
"""
import uuid

import pytest

import datos_card
import tool_catalog
from inteligencia_queries import InteligenciaQueries

from test_execute_tool import _Ctx
from test_inteligencia_queries import (_comprobante, _gasto, necesita_pg, tenants)  # noqa: F401  (fixture)


class _QFalso:
    """`InteligenciaQueries` con respuestas fijas; guarda con qué se lo llamó."""

    def __init__(self, **respuestas):
        self.r = respuestas
        self.llamadas = []

    def _resp(self, nombre, *a):
        self.llamadas.append((nombre, a))
        return self.r[nombre]

    def portada(self):
        return self._resp("portada")

    def por_cobrar(self):
        return self._resp("por_cobrar")

    def facturacion_por_mes(self, meses=6):
        return self._resp("facturacion_por_mes", meses)

    def entro_vs_salio(self, meses=6):
        return self._resp("entro_vs_salio", meses)

    def torta_categorias(self, mes=None):
        return self._resp("torta_categorias", mes)


_PORTADA = {
    "caja": {"saldo": "70000.00", "moneda": "ARS", "fecha_corte": "2026-10-13",
             "variacion_pct": None, "incompleta": False},
    "mes": {"ingresos": "120000.00", "gastos": "50000.00", "rentabilidad": None,
            "facturado": "90000.50", "cobrado": "60000.00"},
    "serie_mensual": [],
    "mejores_clientes": [{"cliente": "Panadería Los Tilos", "total": "40000.00"},
                         {"cliente": "Pérez", "total": "20000.00"}],
    "por_cobrar": {"total": "5000.00", "vencido": "0.00"},
}


def _cifras(card):
    return {c["k"]: c["v"] for c in card["cifras"]}


# ── 1. los builders ──────────────────────────────────────────────────────────────────────────────

def test_portada_pasa_los_numeros_de_la_portada_tal_cual():
    card = datos_card.datos_de("portada", _QFalso(portada=_PORTADA))
    assert card["titulo"] == "Este mes"
    assert _cifras(card) == {"Entró": "$120.000,00", "Salió": "$50.000,00", "Queda": "$70.000,00",
                             "Facturado": "$90.000,50", "Cobrado": "$60.000,00"}
    assert card["chip"] == "Al 13 de octubre"
    assert card["nota"] is None


def test_portada_con_mercadopago_caido_avisa_que_lo_que_entro_puede_estar_incompleto():
    p = {**_PORTADA, "caja": {**_PORTADA["caja"], "incompleta": True}}
    card = datos_card.datos_de("portada", _QFalso(portada=p))
    assert card["nota"] == datos_card.NOTA_MP_CAIDO


def test_por_cobrar_total_y_vencido_y_el_umbral_no_esta_hardcodeado():
    card = datos_card.datos_de("por_cobrar", _QFalso(por_cobrar={"total": "5000.00", "vencido": "1200.00"}))
    assert _cifras(card) == {"Total": "$5.000,00", "Vencido": "$1.200,00"}
    from inteligencia_queries import DIAS_VENCIDO
    assert str(DIAS_VENCIDO) in card["nota"]


def test_mejores_clientes_conserva_el_orden_y_declara_que_mp_no_se_atribuye():
    card = datos_card.datos_de("mejores_clientes", _QFalso(portada=_PORTADA))
    assert [c["k"] for c in card["cifras"]] == ["Panadería Los Tilos", "Pérez"]
    assert card["nota"] == datos_card.NOTA_RANKING


def test_torta_muestra_solo_lo_que_gasto_ordenado_y_con_el_mes_en_el_chip():
    serie = [{"categoria": "nafta", "total": "3000.00"}, {"categoria": "otros", "total": "0.00"},
             {"categoria": "mercadería", "total": "15000.00"}]
    card = datos_card.datos_de("torta_categorias",
                               _QFalso(torta_categorias={"tipo": "torta", "periodo": "2026-09", "serie": serie}),
                               {"mes": "2026-09"})
    assert [c["k"] for c in card["cifras"]] == ["mercadería", "nafta"]      # sin el 0 y de mayor a menor
    assert card["chip"] == "septiembre 2026"


@pytest.mark.parametrize("mes_pedido, esperado", [("2026-09", "2026-09"), ("septiembre", None),
                                                   ("2026-13", None), ("2026-9", None), (None, None),
                                                   (202609, None)])
def test_un_mes_sin_forma_YYYY_MM_se_ignora_y_el_chip_dice_cual_se_mostro(mes_pedido, esperado):
    """El mes que le llega a `InteligenciaQueries` es el validado, o `None` (mes en curso). Nunca el
    crudo: `date.fromisoformat('septiembre-01')` lanzaría y tumbaría la respuesta."""
    q = _QFalso(torta_categorias={"tipo": "torta", "periodo": "2026-10", "serie": []})
    datos_card.datos_de("torta_categorias", q, {"mes": mes_pedido})
    assert q.llamadas == [("torta_categorias", (esperado,))]


def test_facturacion_por_mes_pluraliza_comprobante_y_declara_el_criterio():
    serie = [{"mes": "2026-09", "total": "1000.00", "cantidad": 1},
             {"mes": "2026-10", "total": "2500.00", "cantidad": 3}]
    card = datos_card.datos_de("facturacion_por_mes", _QFalso(facturacion_por_mes={"serie": serie}))
    assert _cifras(card) == {"septiembre 2026": "$1.000,00 · 1 comprobante",
                             "octubre 2026": "$2.500,00 · 3 comprobantes"}
    assert card["nota"] == datos_card.NOTA_FACTURADO


def test_entro_vs_salio_lleva_las_dos_cifras_de_cada_mes():
    serie = [{"mes": "2026-10", "entro": "100.00", "salio": "40.00"}]
    card = datos_card.datos_de("entro_vs_salio", _QFalso(entro_vs_salio={"serie": serie}))
    assert _cifras(card) == {"octubre 2026": "Entró $100,00 · Salió $40,00"}


def test_consulta_desconocida_devuelve_None():
    assert datos_card.datos_de("margen_por_trabajo", _QFalso()) is None


def test_el_texto_para_el_llm_trae_las_mismas_cifras_que_la_card():
    card = datos_card.datos_de("portada", _QFalso(portada=_PORTADA))
    texto = datos_card.texto_para_el_llm(card)
    for c in card["cifras"]:
        assert c["v"] in texto, f"el modelo no vería {c}"
    assert "No los recalcules" in texto


# ── drift: la tabla de consultas no puede divergir de lo que existe ───────────────────────────────

def test_cada_consulta_es_un_metodo_real_de_InteligenciaQueries():
    """Si alguien renombra un método de la capa de queries, esto falla ACÁ y no en el vivo con un
    `AttributeError` dentro del turno. `mejores_clientes` es la única que sale de otra (la portada)."""
    for consulta in datos_card.CONSULTAS:
        if consulta == "mejores_clientes":
            continue
        assert callable(getattr(InteligenciaQueries, consulta, None)), consulta


def test_el_schema_ofrece_exactamente_las_consultas_de_la_tabla_y_las_describe_todas():
    schema = tool_catalog.CONSULTAR_NEGOCIO_SCHEMA["function"]
    assert tuple(schema["parameters"]["properties"]["consulta"]["enum"]) == datos_card.CONSULTAS
    for consulta in datos_card.CONSULTAS:
        assert f"`{consulta}`" in schema["description"], f"el modelo no sabría cuándo usar {consulta}"


def test_consultar_negocio_esta_en_el_catalogo_y_NO_es_write():
    nombres = {s["function"]["name"] for s in tool_catalog.build_tool_catalog()}
    assert "consultar_negocio" in nombres
    assert "consultar_negocio" not in tool_catalog.WRITE_TOOLS
    # las otras dos consultivas siguen podadas (la poda del hito 2 no se deshizo)
    assert "consultar_actividad" not in nombres and "consultar_cliente" not in nombres


def test_la_guia_de_capacidades_publica_los_numeros_porque_la_tool_esta_viva():
    tools = {c["tool"]: c for c in tool_catalog.capacidades_vivas()["capacidades"]}
    assert "consultar_negocio" in tools
    assert tools["consultar_negocio"]["ejemplos"]


# ── 2. el executor ───────────────────────────────────────────────────────────────────────────────

def _ex(queries=None, *, factory=None):
    fac = factory if factory is not None else (lambda cid: queries)
    return tool_catalog.make_tool_executor(None, now_iso_provider=lambda: "2026-10-13T12:00:00+00:00",
                                           inteligencia_queries_factory=fac)


def test_executor_devuelve_la_card_como_artifact_y_el_texto_con_las_mismas_cifras():
    tr = _ex(_QFalso(portada=_PORTADA))("consultar_negocio", {"consulta": "portada"}, _Ctx(),
                                       confirmed=False, idem_key="k1")
    assert tr.status == "ok" and tr.is_write is False          # read puro: sin gate, sin confirmar
    assert tr.artifact.kind == "datos_negocio"
    assert tr.artifact.data["titulo"] == "Este mes"
    assert "$120.000,00" in tr.observation["result"]


def test_el_tenant_sale_del_ctx_y_un_cliente_id_en_los_arguments_se_ignora():
    """Regla 7. El modelo puede ser inducido a pedir «los números de otro»: el argumento no tiene
    ningún camino hasta la factory."""
    pedidos = []

    def factory(cid):
        pedidos.append(cid)
        return _QFalso(portada=_PORTADA)

    _ex(factory=factory)("consultar_negocio", {"consulta": "portada", "cliente_id": "OTRO-TENANT"},
                         _Ctx(), confirmed=False, idem_key="k2")
    assert pedidos == ["42"]                                    # `_Ctx.cliente_id`, nunca el argumento


def test_sin_cifras_no_hay_card_ni_un_cero_inventado():
    q = _QFalso(portada={**_PORTADA, "mejores_clientes": []})
    tr = _ex(q)("consultar_negocio", {"consulta": "mejores_clientes"}, _Ctx(), confirmed=False,
                idem_key="k3")
    assert tr.status == "ok" and tr.artifact is None
    assert "NO inventes" in tr.observation["result"]


def test_consulta_desconocida_es_error_de_negocio_y_lista_las_validas():
    tr = _ex(_QFalso())("consultar_negocio", {"consulta": "margen_por_trabajo"}, _Ctx(),
                        confirmed=False, idem_key="k4")
    assert tr.status == "error" and "portada" in tr.observation["error"]


def test_sin_factory_degrada_con_error_de_negocio_no_explota():
    tr = tool_catalog.make_tool_executor(None, now_iso_provider=lambda: "x")(
        "consultar_negocio", {"consulta": "portada"}, _Ctx(), confirmed=False, idem_key="k5")
    assert tr.status == "error"


# ── 3. Postgres real, dos tenants ────────────────────────────────────────────────────────────────

@necesita_pg
def test_ADVERSARIAL_B_pregunta_por_su_mes_y_no_ve_la_plata_ni_el_cliente_de_A(conn_de_tenant, tenants):
    a, b = tenants
    # A tiene plata: una factura emitida, un cobro y un gasto.
    comp = _comprobante(conn_de_tenant, a, "7777.00", receptor="Cliente Secreto de A")
    from cobro_store import CobroStore
    CobroStore(conn_de_tenant(a), a).registrar(comp, monto="7777.00")
    _gasto(conn_de_tenant, a, "1234.00")

    class _CtxDe:
        composio_user_id = "x"
        mp_gateway = mp_cred_store = mp_seller_user_id = mp_webhook_base = None

        def __init__(self, cid):
            self.cliente_id = cid

    ex = _ex(factory=lambda cid: InteligenciaQueries(conn_de_tenant(cid), cid))

    for consulta in ("portada", "mejores_clientes", "por_cobrar", "facturacion_por_mes",
                     "entro_vs_salio", "torta_categorias"):
        tr_b = ex("consultar_negocio", {"consulta": consulta, "cliente_id": a}, _CtxDe(b),
                  confirmed=False, idem_key=f"b-{consulta}")
        visto_por_b = repr(tr_b.observation) + repr(tr_b.artifact.data if tr_b.artifact else None)
        for dato_de_a in ("7777", "7.777", "1234", "1.234", "Cliente Secreto de A"):
            assert dato_de_a not in visto_por_b, f"B vio «{dato_de_a}» de A en {consulta}"

    # CONTROL POSITIVO: la misma consulta, con el tenant correcto, SÍ ve esa plata. Sin esto, el rojo de
    # arriba podría ser «la consulta no devuelve nada nunca».
    tr_a = ex("consultar_negocio", {"consulta": "portada"}, _CtxDe(a), confirmed=False, idem_key="a-p")
    assert "$7.777,00" in _cifras_texto(tr_a)
    tr_a_g = ex("consultar_negocio", {"consulta": "torta_categorias"}, _CtxDe(a), confirmed=False,
                idem_key="a-g")
    assert "$1.234,00" in _cifras_texto(tr_a_g)


def _cifras_texto(tr):
    return " ".join(c["v"] for c in tr.artifact.data["cifras"])
