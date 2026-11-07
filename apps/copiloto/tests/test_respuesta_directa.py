"""La 2ª llamada al LLM, por código (2026-11-06). Flag `COPILOTO_RESPUESTA_DIRECTA=1`; sin él, el camino de
siempre. El hook decide cuándo NO contesta el código (causa, pregunta doble, cadena de tools)."""
import asyncio
import json

import pytest

import respuesta_directa as rd


def _turno(pregunta, tool, args, obs, *, previas=()):
    msgs = [{"role": "user", "content": pregunta}]
    for p in previas:
        msgs += p
    msgs += [{"role": "assistant", "content": None, "tool_calls": [
                 {"id": "t1", "type": "function", "function": {"name": tool, "arguments": json.dumps(args)}}]},
             {"role": "tool", "tool_call_id": "t1", "content": json.dumps(obs, ensure_ascii=False)}]
    return msgs


@pytest.fixture
def activo(monkeypatch):
    monkeypatch.setenv("COPILOTO_RESPUESTA_DIRECTA", "1")


_OBS = {"result": "x", rd.CAMPO: "En octubre de 2026 entraron $10 y salieron $5."}


def test_sin_flag_redacta_el_llm(monkeypatch):
    monkeypatch.delenv("COPILOTO_RESPUESTA_DIRECTA", raising=False)
    assert rd.elegir(_turno("¿cuánto entró en octubre?", "consultar_negocio",
                            {"consulta": "entro_vs_salio"}, _OBS)) is None


def test_con_flag_contesta_el_codigo(activo):
    assert rd.elegir(_turno("¿cuánto entró en octubre?", "consultar_negocio",
                            {"consulta": "entro_vs_salio"}, _OBS)) == _OBS[rd.CAMPO]


@pytest.mark.parametrize("pregunta", ["¿por qué bajaron mis ventas?", "porque vendí menos?",
                                      "¿a qué se debe que entró menos?"])
def test_una_pregunta_de_causa_la_redacta_el_llm(activo, pregunta):
    assert rd.elegir(_turno(pregunta, "consultar_negocio", {"consulta": "facturacion_por_mes"}, _OBS)) is None


def test_la_pregunta_doble_con_quien_la_redacta_el_llm(activo):
    m = _turno("¿en qué gasté y a quién le pagué?", "consultar_negocio", {"consulta": "torta_categorias"}, _OBS)
    assert rd.elegir(m) is None


def test_quien_en_el_ranking_de_clientes_si_la_contesta_el_codigo(activo):
    m = _turno("¿quiénes son mis mejores clientes?", "consultar_negocio", {"consulta": "mejores_clientes"}, _OBS)
    assert rd.elegir(m) == _OBS[rd.CAMPO]


def test_si_ya_corrio_otra_tool_en_el_turno_termina_el_llm(activo):
    previa = [{"role": "assistant", "content": None, "tool_calls": [
                  {"id": "t0", "type": "function", "function": {"name": "consultar_historial", "arguments": "{}"}}]},
              {"role": "tool", "tool_call_id": "t0", "content": "{}"}]
    m = _turno("¿cuánto entró?", "consultar_negocio", {"consulta": "portada"}, _OBS, previas=[previa])
    assert rd.elegir(m) is None


def test_otra_tool_o_sin_campo_redacta_el_llm(activo):
    assert rd.elegir(_turno("¿qué pasó con Pérez?", "consultar_historial", {}, _OBS)) is None
    assert rd.elegir(_turno("¿cuánto entró?", "consultar_negocio", {"consulta": "portada"}, {"result": "x"})) is None


def test_el_turno_anterior_no_cuenta_como_cadena(activo):
    """Sólo cuentan las tools DESPUÉS del último mensaje del usuario."""
    viejo = _turno("hola", "consultar_historial", {}, {})
    m = viejo + [{"role": "assistant", "content": "listo"}] + _turno(
        "¿cuánto entró?", "consultar_negocio", {"consulta": "portada"}, _OBS)
    assert rd.elegir(m) == _OBS[rd.CAMPO]


# ── frases: salen de la card, con los mismos números ─────────────────────────────────────────────────

def _card(cifras, chip=None, nota=None, titulo="T"):
    return {"titulo": titulo, "cifras": [{"k": k, "v": v} for k, v in cifras], "chip": chip, "nota": nota}


_EVS = _card([("septiembre 2026", "Entró $282.500,00 · Salió $1.234,00"),
              ("octubre 2026", "Entró $0,00 · Salió $201.234,50")], chip="Últimos 6 meses")


def test_entro_vs_salio_con_mes_dice_ese_mes():
    assert rd.frase_negocio("entro_vs_salio", _EVS, {"mes": "2026-10"}) == \
        "En octubre de 2026 entraron $0 y salieron $201.234,50."


def test_entro_vs_salio_sin_mes_dice_el_ultimo_y_remite_a_la_tarjeta():
    t = rd.frase_negocio("entro_vs_salio", _EVS, {})
    assert t.startswith("En octubre de 2026 entraron $0 y salieron $201.234,50.") and "6 meses" in t


def test_un_mes_fuera_de_la_tarjeta_no_inventa():
    assert "No tengo enero de 2026" in rd.frase_negocio("entro_vs_salio", _EVS, {"mes": "2026-01"})


def test_facturacion_por_mes_nombra_los_meses_con_algo():
    card = _card([("agosto 2026", "$70.000,00 · 2 comprobantes"), ("septiembre 2026", "$0,00 · 0 comprobantes")])
    assert rd.frase_negocio("facturacion_por_mes", card, {}) == \
        "En los últimos 6 meses facturaste $70.000 en agosto; en el resto de los meses, nada."
    assert rd.frase_negocio("facturacion_por_mes", card, {"mes": "2026-08"}) == \
        "En agosto de 2026 facturaste $70.000 (2 comprobantes)."


def test_torta_dice_el_total_y_lo_que_mas_pesa():
    card = _card([("mercadería", "$15.000,00"), ("nafta", "$3.000,00"), ("Total gastado", "$18.000,00")],
                 chip="octubre 2026")
    assert rd.frase_negocio("torta_categorias", card, {}) == \
        "En octubre de 2026 gastaste $18.000 en total. Lo que más pesa es mercadería ($15.000), seguido de nafta ($3.000)."


def test_por_cobrar_sin_vencido():
    assert rd.frase_negocio("por_cobrar", _card([("Total", "$5.000,00"), ("Vencido", "$0,00")]), {}) == \
        "Te deben $5.000 en total, y no hay nada vencido."


def test_portada_lleva_los_cinco_numeros():
    card = _card([("Entró", "$1,00"), ("Salió", "$2,00"), ("Queda", "$3,00"), ("Facturado", "$4,00"),
                  ("Cobrado", "$5,00")], chip="Al 6 de noviembre")
    t = rd.frase_negocio("portada", card, {})
    assert all(f"${n}" in t for n in range(1, 6)) and "al 6 de noviembre" in t


def test_cliente_sin_documento_no_dice_que_no_compro():
    resumen = {"facturas_atribuibles": False, "facturas": 0, "facturado": "0", "notas_credito": 0,
               "presupuestos": 0, "presupuestado": "0", "cobros": 2, "cobrado": "19000.00",
               "operaciones": [{"fecha": "2026-10-14", "detalle": "cobro", "monto": "12000.00"}]}
    t = rd.frase_cliente({"nombre": "Kiosco Don Ramón"}, resumen)
    assert "le cobraste $19.000 en 2 cobros" in t and "no tiene CUIT o DNI" in t and "$0" not in t
    assert "14 de octubre, cobro por $12.000" in t


# ── el hook del motor ─────────────────────────────────────────────────────────────────────────────────

def test_el_motor_devuelve_el_texto_del_hook_sin_llamar_al_llm(monkeypatch):
    from backend.agent import agent_activities as aa

    monkeypatch.setattr(aa, "log_evento", lambda *a, **k: None, raising=False)
    dom = {"respuesta_directa": lambda msgs: "listo por código"}
    msgs = [{"role": "user", "content": "x"}, {"role": "tool", "tool_call_id": "1", "content": "{}"}]
    out = aa._respuesta_directa(dom, msgs, {"domain": "d"})
    assert aa._respuesta_directa(dom, msgs[:1], {"domain": "d"}) is None   # sin resultado de tool, no actúa
    assert out["content"] == "listo por código" and out["model"] == "respuesta_directa" and out["tool_calls"] == []


def test_un_hook_que_falla_deja_redactar_al_llm(monkeypatch):
    from backend.agent import agent_activities as aa

    def _roto(msgs):
        raise RuntimeError("boom")

    class _Log:
        def warning(self, *a, **k):
            pass

    monkeypatch.setattr(aa.activity, "logger", _Log())
    assert aa._respuesta_directa({"respuesta_directa": _roto}, [{"role": "tool", "content": "{}"}],
                                 {"domain": "d"}) is None
