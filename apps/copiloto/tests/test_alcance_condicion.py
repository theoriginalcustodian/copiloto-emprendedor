"""PROTO4DEPS §2 — el alcance del consentimiento lleva un calificador por ítem (`condicion`).

La hoja «Conectar X» le dice al usuario qué va a poder hacer Copiloto y con qué límite («Solo lectura»,
«Nunca sin tu OK»). El backend emite la SEMÁNTICA en un enum cerrado; la etiqueta la pinta la app.
Lógica pura (sin Postgres ni Temporal)."""
import math

import pytest

import catalog
from catalog import (CONDICION_REQUIERE_OK, CONDICION_SOLO_LECTURA, CONDICIONES, build_catalog,
                     pendiente_de_cobro, requiere_conexion_card)

_TOOLKITS = ("gmail", "googlecalendar", "googledrive", "googledocs", "googlesheets")


def _catalogo():
    return build_catalog(valid_toolkits=_TOOLKITS, mp_connected=False, composio_connected=[])


def _fuera_del_enum(items) -> list:
    """Los ítems cuya `condicion` no es del enum cerrado (o a los que les falta una clave)."""
    return [i for i in items
            if set(i) != {"texto", "condicion"} or i["condicion"] not in CONDICIONES
            or not isinstance(i["texto"], str) or not i["texto"].strip()]


def test_el_enum_es_cerrado_y_son_tres_valores():
    assert CONDICIONES == ("solo_lectura", "requiere_ok", "ninguna")


def test_toda_condicion_del_catalogo_y_de_la_card_sale_del_enum():
    for entrada in _catalogo():
        assert entrada["alcance_items"], f"{entrada['key']} sin alcance declarado"
        assert _fuera_del_enum(entrada["alcance_items"]) == [], entrada["key"]
    for key in ("mercadopago", *_TOOLKITS):
        card = requiere_conexion_card(key, key)
        assert _fuera_del_enum(card["alcance"]) == [], key


def test_CONTROL_el_chequeo_de_enum_SI_caza_una_condicion_inventada():
    """Control positivo: sin esto, `_fuera_del_enum` podría devolver siempre [] y el test de arriba
    pasaría por la razón equivocada."""
    malo = [{"texto": "Leer mails", "condicion": "SOLO_LECTURA"},
            {"texto": "Enviar", "condicion": "nunca_sin_ok"},
            {"texto": "Buscar"},
            {"texto": "  ", "condicion": "ninguna"}]
    assert len(_fuera_del_enum(malo)) == 4
    assert _fuera_del_enum([{"texto": "ok", "condicion": "ninguna"}]) == []


def test_una_condicion_inventada_en_PRESENTATION_la_delata_lo_que_el_catalogo_emite(monkeypatch):
    """Si alguien edita `_PRESENTATION` con un valor fuera del enum, lo que el catálogo emite lo delata."""
    monkeypatch.setitem(catalog._PRESENTATION, "gmail", {
        **catalog._PRESENTATION["gmail"],
        "alcance": [{"texto": "Leer mails", "condicion": "casi_lectura"}]})
    gmail = next(s for s in _catalogo() if s["key"] == "gmail")
    assert _fuera_del_enum(gmail["alcance_items"]) != []


def test_mercadopago_declara_sus_DOS_capacidades_con_su_calificador():
    mp = next(s for s in _catalogo() if s["key"] == "mercadopago")
    assert [i["condicion"] for i in mp["alcance_items"]] == [CONDICION_SOLO_LECTURA,
                                                             CONDICION_REQUIERE_OK]
    assert "movimientos" not in " ".join(i["texto"] for i in mp["alcance_items"]).lower(), \
        "lo que se lee de MP son los pagos que entran, no el extracto: no prometer «movimientos»"


def test_las_dos_superficies_salen_de_la_MISMA_lista_y_no_driftean():
    for entrada in _catalogo():
        card = requiere_conexion_card(entrada["key"], entrada["display_name"])
        assert card["alcance"] == entrada["alcance_items"]
        assert entrada["capabilities"] == [i["texto"] for i in entrada["alcance_items"]]


def test_la_card_manda_alcance_con_objetos_y_NO_duplica_la_lista_en_otra_clave():
    """D1 (planificación): el core ya lee `card.alcance` en las dos formas y pinta la insignia; una clave
    paralela (`alcance_items`) en la card quedaría sin lector, y la insignia moriría muda."""
    card = requiere_conexion_card("mercadopago", "Mercado Pago")
    assert all(isinstance(i, dict) and set(i) == {"texto", "condicion"} for i in card["alcance"])
    assert "alcance_items" not in card


def test_el_catalogo_conserva_capabilities_como_list_de_str():
    """La web tipa `capabilities` como `string[]` (`types.ts`): un objeto ahí rompe esa pantalla sin avisar."""
    for entrada in _catalogo():
        assert all(isinstance(c, str) for c in entrada["capabilities"])


def test_un_toolkit_sin_copy_dedicado_aparece_con_alcance_vacio_y_valido():
    entrada = next(s for s in build_catalog(valid_toolkits=["toolkitnuevo"], mp_connected=False,
                                            composio_connected=[]) if s["key"] == "toolkitnuevo")
    assert entrada["alcance_items"] == [] and entrada["capabilities"] == []


# --- `pendiente`: opcional, en la CARD, ausente cuando no se puede resumir el turno -------------

def test_pendiente_AUSENTE_es_el_caso_normal():
    card = requiere_conexion_card("gmail", "Gmail")
    assert "pendiente" not in card


@pytest.mark.parametrize("vacio", [None, "", "   "])
def test_pendiente_vacio_no_emite_la_clave(vacio):
    assert "pendiente" not in requiere_conexion_card("gmail", "Gmail", pendiente=vacio)


def test_pendiente_presente_viaja_como_objeto_con_texto():
    card = requiere_conexion_card("mercadopago", "Mercado Pago", pendiente=" armar el link de cobro ")
    assert card["pendiente"] == {"texto": "armar el link de cobro"}


@pytest.mark.parametrize("args,esperado", [
    ({"amount": 15000}, "armar el link de cobro de $15.000"),
    ({"amount": 1250.5}, "armar el link de cobro de $1.250,50"),
    ({"amount": "5000"}, "armar el link de cobro de $5.000"),
    ({"amount": 0}, "armar el link de cobro"),
    ({"amount": -5}, "armar el link de cobro"),
    ({"amount": "mucho"}, "armar el link de cobro"),
    ({"amount": math.nan}, "armar el link de cobro"),
    ({"amount": math.inf}, "armar el link de cobro"),
    ({}, "armar el link de cobro"),
    (None, "armar el link de cobro"),
])
def test_pendiente_de_cobro_sale_de_los_argumentos_y_nunca_inventa(args, esperado):
    assert pendiente_de_cobro(args) == esperado
