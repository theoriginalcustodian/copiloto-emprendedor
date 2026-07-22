"""La tool `registrar_gasto` del motor — hito 4 del contrato de Gastos Fase 1.

Lo que estos tests defienden, en orden de qué tan caro sale que se rompa:

1. **No persiste.** El contrato §5 es una regla dura: nada dictado se guarda sin que el emprendedor lo
   vea y pueda corregirlo. La tool propone; el `POST /gastos` lo dispara la app cuando él toca Guardar.
2. **El monto dictado se interpreta con el separador argentino.** `"15.000"` son quince mil, no quince.
   Ese error convierte un gasto en uno mil veces menor y no lo nota nadie: lo que se mira después es el
   total del mes, no el gasto.
3. **La categoría inventada cae en `otros`**, no falla — el schema y la base comparten lista.
"""
from __future__ import annotations

import datetime
from decimal import Decimal

import pytest

from gasto_store import CATEGORIAS
from tool_catalog import REGISTRAR_GASTO_SCHEMA, WRITE_TOOLS, _monto_dictado, _run_registrar_gasto

AHORA = "2026-07-21T15:00:00-03:00"


def _ctx():
    class C:
        cliente_id = "cid-A"
        composio_user_id = "cid-A"
    return C()


def _correr(**args):
    return _run_registrar_gasto(args, _ctx(), "idem-1", lambda: AHORA)


# --- 🔴 la regla dura: proponer no es guardar ---

def test_la_tool_NO_es_un_write_y_no_pasa_por_el_gate():
    """Si entrara a WRITE_TOOLS, el motor la mandaría al confirm-gate de sí/no — y confirmar re-ejecuta
    los MISMOS argumentos, así que un 'quince mil' transcripto como 'cincuenta mil' sólo se podría
    aceptar o repetir el dictado entero. La card editable existe justamente para eso."""
    assert "registrar_gasto" not in WRITE_TOOLS
    assert _correr(monto="15000").is_write is False


def test_devuelve_una_card_de_gasto_propuesto_con_el_body_del_POST_listo():
    r = _correr(monto="15000", categoria="mercaderia", proveedor="Distribuidora Sur",
                descripcion="quince mil de mercadería")
    assert r.artifact.kind == "gasto_propuesto"
    assert r.artifact.data == {"monto": "15000.00", "fecha": "2026-07-21", "categoria": "mercaderia",
                               "proveedor": "Distribuidora Sur", "medio_pago": None,
                               "descripcion": "quince mil de mercadería", "origen": "voz"}


def test_le_dice_al_LLM_que_TODAVIA_no_esta_guardado():
    """Sin esto el modelo cierra con «listo, ya lo anoté»: el emprendedor lo lee, no toca Guardar, y el
    gasto se pierde creyendo los dos que estaba hecho."""
    obs = _correr(monto="15000").observation["result"]
    assert "TODAVÍA NO" in obs or "todavía no" in obs.lower()


# --- 🔴 el monto dictado y el separador argentino ---

@pytest.mark.parametrize("dictado, esperado", [
    ("15000", "15000.00"),
    ("15.000", "15000.00"),        # punto = miles en Argentina. Lo caro: leerlo como 15 pesos
    ("$ 15.000", "15000.00"),
    ("15000,50", "15000.50"),      # coma = decimal
    ("1.234.567", "1234567.00"),
    ("15000.50", "15000.50"),      # un punto que deja 2 decimales SÍ es decimal
    (15000, "15000.00"),           # el LLM a veces manda número, no string
])
def test_el_monto_se_interpreta_como_lo_dice_un_argentino(dictado, esperado):
    assert _correr(monto=dictado).artifact.data["monto"] == esperado


def test_CONTROL_leer_el_punto_como_decimal_daria_otro_numero():
    """Sin este control, los casos de arriba pasarían igual con `Decimal(texto)` a secas para varios de
    ellos. Acá se comprueba que la interpretación ingenua da un resultado DISTINTO —y catastrófico— para
    el caso que importa: quince mil pesos convertidos en quince."""
    ingenua = Decimal("15.000")               # lo que da Decimal() sin tocar nada
    correcta = _monto_dictado("15.000")
    assert ingenua == Decimal("15") and correcta == Decimal("15000")
    assert correcta / ingenua == 1000, "la diferencia es de tres órdenes de magnitud, no un redondeo"


@pytest.mark.parametrize("basura", [None, "", "no dijo", "cero", "0", "-500", "abc"])
def test_sin_monto_usable_se_REPREGUNTA_y_no_hay_card(basura):
    """Contrato §5.3: falta el monto —y sólo el monto— se repregunta. Se devuelve `ok`, no `error`: no
    falló nada, falta un dato, y el loop tiene que poder preguntarlo en vez de disculparse."""
    r = _correr(monto=basura)
    assert r.status == "ok" and r.artifact is None
    assert "monto" in r.observation["result"].lower()


# --- categoría, fecha y recortes ---

def test_una_categoria_inventada_cae_en_otros_y_no_falla():
    """El schema que ve el LLM y la lista que acepta la base son la MISMA (`CATEGORIAS` del store). Aun
    así el modelo puede inventar: cae en `otros`, porque hacer fallar algo que el copiloto propuso es
    peor que clasificarlo de más."""
    assert _correr(monto="500", categoria="stock").artifact.data["categoria"] == "otros"
    assert _correr(monto="500").artifact.data["categoria"] == "otros"


def test_el_schema_ofrece_EXACTAMENTE_las_categorias_de_la_base():
    """Si divergen, el modelo propone un rubro que el POST rechaza con 400 y el emprendedor ve fallar
    algo que el copiloto le ofreció."""
    enum = REGISTRAR_GASTO_SCHEMA["function"]["parameters"]["properties"]["categoria"]["enum"]
    assert tuple(enum) == CATEGORIAS


def test_la_fecha_por_defecto_es_hoy_del_negocio():
    assert _correr(monto="500").artifact.data["fecha"] == "2026-07-21"


def test_ayer_se_resuelve_a_ayer():
    d = _correr(monto="500", fecha_raw="ayer").artifact.data["fecha"]
    assert d == "2026-07-20", f"resolvió a {d}"


def test_una_fecha_que_no_se_entiende_cae_en_hoy_y_no_revienta():
    assert _correr(monto="500", fecha_raw="cuando llovió").artifact.data["fecha"] == "2026-07-21"


def test_los_textos_largos_se_recortan_al_limite_de_la_base():
    r = _correr(monto="500", proveedor="P" * 500, descripcion="D" * 900)
    assert len(r.artifact.data["proveedor"]) == 120
    assert len(r.artifact.data["descripcion"]) == 500


def test_los_opcionales_ausentes_viajan_como_null_no_como_vacio():
    """Misma forma que devuelve `POST /gastos`: un objeto que cambia de forma según el caso obliga al
    cliente a defenderse de dos maneras del mismo dato."""
    d = _correr(monto="500").artifact.data
    assert d["proveedor"] is None and d["medio_pago"] is None and d["descripcion"] is None


def test_el_origen_siempre_es_voz():
    assert _correr(monto="500").artifact.data["origen"] == "voz"
