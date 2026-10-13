"""PROTO4DEPS §3 — `presentacion` por tarjeta de «Mi día»: chip + kv + acción, derivados de la regla.

Lógica pura (sin Postgres): `presentar`/`alias_datos` y `_fila_a_dict` con una fila en mano. El contrato
exige: derivada en UN lugar, enum cerrado de `accion.destino.tipo`, reglas sin verbo sin `accion`, un test
por regla conocida y un caso de regla desconocida sin `presentacion`, y `REGLAS_CONOCIDAS` como única lista.
"""
import datetime

import pytest

import mi_dia_presentacion as mp
from catalog import build_catalog
from mi_dia_clasificacion import REGLAS_CONOCIDAS, clasificar
from mi_dia_detector import _evaluar_facturas_impagas_viejas, _evaluar_presupuestos_enfriandose
from mi_dia_presentacion import TIPOS_DESTINO_ACCION, alias_datos, presentar
from mi_dia_tarjeta_store import _fila_a_dict

HOY = datetime.date(2026, 10, 13)
TONOS = {"critico", "pronto", "sin_plazo"}


def _ts(dias_atras: int) -> datetime.datetime:
    d = HOY - datetime.timedelta(days=dias_atras)
    return datetime.datetime(d.year, d.month, d.day, 12, 0, tzinfo=datetime.timezone.utc)


# Un `datos` representativo por regla, con la forma EXACTA que emite el detector.
CASOS = {
    "facturas_impagas_viejas": ("412", {"nro": "0001-00000007", "cliente": "Panadería", "saldo": "84000.00",
                                        "dias": 31, "fecha_emision": "2026-09-12"}),
    "presupuestos_enfriandose": ("77", {"numero": 12, "cliente": "Juan", "total": "150000.00",
                                        "fecha": "2026-09-01"}),
    "cae_por_vencer": ("55", {"nro": "0001-00000009", "cae_vto": "2026-10-20", "dias": 7}),
    "certificado_afip_por_vencer": ("20111111112:homologacion",
                                    {"cuit": "20111111112", "ambiente": "homologacion", "dias": 20,
                                     "ilegible": False, "vencido": False, "vence_at": "2026-11-02T00:00:00+00:00"}),
    "trabajo_con_margen_negativo": ("presupuesto:9", {"etiqueta": "Reforma", "cobrado": "100000",
                                                      "gastado": "130000", "margen": "-30000"}),
    "trabajo_con_gastos_y_sin_ingreso": ("presupuesto:10", {"etiqueta": "Pintura", "gastado": "45000", "dias": 20}),
    "gasto_del_mes_alto": ("2026-10", {"mes": "2026-10", "gasto_actual": "900000", "gasto_anterior": "300000"}),
    "conexion_caida": ("mercadopago", {"servicio": "mercadopago", "nombre": "Mercado Pago"}),
}


def test_presentadores_cubren_EXACTAMENTE_las_reglas_conocidas():
    """`REGLAS_CONOCIDAS` es la única lista: una regla nueva sin presentador rompe acá, no sale muda."""
    assert set(mp._PRESENTADORES) == set(REGLAS_CONOCIDAS)
    assert set(CASOS) == set(REGLAS_CONOCIDAS), "falta un caso de prueba para una regla conocida"


@pytest.mark.parametrize("regla", sorted(CASOS))
def test_toda_regla_conocida_emite_presentacion_con_forma_valida(regla):
    entidad_id, datos = CASOS[regla]
    p = presentar(regla, entidad_id, datos, _ts(0), HOY)
    assert p, regla
    assert set(p) <= {"chip", "kv", "accion"}
    if "chip" in p:
        assert set(p["chip"]) == {"texto", "tono"} and p["chip"]["tono"] in TONOS
        assert p["chip"]["tono"] == clasificar(regla)["criticidad"], "el tono REUSA criticidad"
    for fila in p.get("kv", []):
        assert set(fila) == {"k", "v"} and fila["k"] and fila["v"]
    if "accion" in p:
        assert p["accion"]["texto"] == clasificar(regla)["verbo"]
        assert p["accion"]["destino"]["tipo"] in TIPOS_DESTINO_ACCION
        assert p["accion"]["destino"]["id"]


def test_el_enum_de_destino_es_cerrado_y_no_crece_solo():
    assert TIPOS_DESTINO_ACCION == ("conexion", "comprobante", "presupuesto", "trabajo", "certificado")


def test_las_reglas_sin_verbo_NO_emiten_accion():
    entidad_id, datos = CASOS["gasto_del_mes_alto"]
    assert clasificar("gasto_del_mes_alto")["verbo"] is None
    p = presentar("gasto_del_mes_alto", entidad_id, datos, _ts(0), HOY)
    assert p and "accion" not in p
    assert p["kv"] == [{"k": "Este mes", "v": "$900.000"}, {"k": "Mes anterior", "v": "$300.000"}]


def test_regla_desconocida_y_tarjeta_manual_NO_emiten_presentacion():
    assert presentar("regla_del_futuro", "x", {"saldo": "10"}, _ts(0), HOY) is None
    assert presentar(None, None, {"texto": "anotado"}, _ts(0), HOY) is None
    assert alias_datos("regla_del_futuro", "x", {"saldo": "10"}, _ts(0), HOY) == {}
    assert alias_datos(None, None, {}, _ts(0), HOY) == {}


def test_factura_impaga_trae_chip_kv_y_accion_hacia_el_comprobante():
    p = presentar("facturas_impagas_viejas", *CASOS["facturas_impagas_viejas"], _ts(0), HOY)
    assert p["chip"] == {"texto": "Emitida hace 31 días", "tono": "pronto"}
    assert p["kv"] == [{"k": "Saldo", "v": "$84.000"}, {"k": "Emitida", "v": "12/09"}]
    assert p["accion"] == {"texto": "Reclamar el pago",
                           "destino": {"tipo": "comprobante", "id": "412"}}


def test_presupuesto_enfriandose_cuenta_dias_desde_la_fecha_del_presupuesto():
    p = presentar("presupuestos_enfriandose", *CASOS["presupuestos_enfriandose"], _ts(0), HOY)
    assert p["chip"] == {"texto": "42 días sin respuesta", "tono": "pronto"}
    assert p["kv"] == [{"k": "Total", "v": "$150.000"}, {"k": "Fecha", "v": "01/09"}]
    assert p["accion"]["destino"] == {"tipo": "presupuesto", "id": "77"}


def test_cae_y_certificado_rotulan_el_vencimiento_con_Vence():
    cae = presentar("cae_por_vencer", *CASOS["cae_por_vencer"], _ts(0), HOY)
    assert cae["chip"] == {"texto": "CAE vence en 7 días", "tono": "pronto"}
    assert cae["kv"] == [{"k": "Vence", "v": "20/10"}]
    cert = presentar("certificado_afip_por_vencer", *CASOS["certificado_afip_por_vencer"], _ts(0), HOY)
    assert cert["chip"] == {"texto": "Certificado vence en 20 días", "tono": "critico"}
    assert {"k": "Vence", "v": "02/11"} in cert["kv"] and {"k": "CUIT", "v": "20111111112"} in cert["kv"]
    assert cert["accion"]["destino"] == {"tipo": "certificado", "id": "20111111112:homologacion"}


def test_certificado_ilegible_o_vencido_lo_dice_y_no_inventa_dias():
    base = {"cuit": "20111111112", "ambiente": "produccion", "dias": None, "vence_at": None}
    ileg = presentar("certificado_afip_por_vencer", "c", {**base, "ilegible": True, "vencido": False}, None, HOY)
    assert ileg["chip"]["texto"] == "No se pudo leer el certificado"
    venc = presentar("certificado_afip_por_vencer", "c", {**base, "ilegible": False, "vencido": True}, None, HOY)
    assert venc["chip"]["texto"] == "Certificado vencido"


def test_trabajos_llevan_kv_de_plata_y_accion_hacia_el_trabajo():
    neg = presentar("trabajo_con_margen_negativo", *CASOS["trabajo_con_margen_negativo"], _ts(0), HOY)
    assert neg["kv"] == [{"k": "Cobrado", "v": "$100.000"}, {"k": "Gastado", "v": "$130.000"},
                         {"k": "Margen", "v": "-$30.000"}]
    assert neg["accion"]["destino"] == {"tipo": "trabajo", "id": "presupuesto:9"}
    sin = presentar("trabajo_con_gastos_y_sin_ingreso", *CASOS["trabajo_con_gastos_y_sin_ingreso"], _ts(0), HOY)
    assert sin["chip"] == {"texto": "20 días sin movimiento", "tono": "pronto"}


def test_conexion_caida_reusa_el_destino_del_catalogo_con_su_connect_path():
    cat = {s["key"]: s for s in build_catalog(valid_toolkits=["gmail"], mp_connected=False, composio_connected=[])}
    for key, nombre in (("mercadopago", "Mercado Pago"), ("gmail", "Gmail")):
        p = presentar("conexion_caida", key, {"servicio": key, "nombre": nombre}, _ts(0), HOY)
        assert p["accion"]["texto"] == "Reconectar"
        assert p["accion"]["destino"] == {"tipo": "conexion", "id": key,
                                          "connect_path": cat[key]["connect_path"]}
        assert p["kv"] == [{"k": "Servicio", "v": nombre}]


# ── envejecimiento: un `dias` guardado no puede congelar el chip ────────────────────────────────

def test_sin_fecha_absoluta_el_dias_de_la_foto_envejece_con_los_dias_transcurridos():
    """Tarjeta vieja (sin `fecha_emision`): `dias=10` hace 5 días ⇒ hoy son 15. Sin esto el chip diría
    «hace 10 días» para siempre, porque `crear_si_no_existe` es DO NOTHING y `datos` no se refresca."""
    datos = {"nro": "1", "cliente": "X", "saldo": "500", "dias": 10}
    p = presentar("facturas_impagas_viejas", "9", datos, _ts(5), HOY)
    assert p["chip"]["texto"] == "Emitida hace 15 días"
    assert all(f["k"] != "Emitida" for f in p["kv"]), "sin fecha guardada NO se fabrica una fila Emitida"


def test_presupuesto_viejo_sin_fecha_sale_sin_chip_ni_fecha_pero_conserva_total_y_accion():
    p = presentar("presupuestos_enfriandose", "77", {"numero": 1, "total": "1000"}, _ts(3), HOY)
    assert "chip" not in p
    assert p["kv"] == [{"k": "Total", "v": "$1.000"}]
    assert p["accion"]["destino"]["id"] == "77"


def test_cae_ya_vencido_o_que_vence_hoy_no_dice_en_0_dias():
    hoy_ = presentar("cae_por_vencer", "5", {"cae_vto": "2026-10-13"}, None, HOY)
    assert hoy_["chip"]["texto"] == "CAE vence hoy"
    venc = presentar("cae_por_vencer", "5", {"cae_vto": "2026-10-10"}, None, HOY)
    assert venc["chip"]["texto"] == "CAE vencido"


# ── alias monto/fecha (H12): lo que el core ya lee ──────────────────────────────────────────────

def test_alias_monto_y_fecha_por_regla():
    assert alias_datos("facturas_impagas_viejas", *CASOS["facturas_impagas_viejas"], _ts(0), HOY) == \
        {"monto": "84000.00", "fecha": "12/09"}
    assert alias_datos("presupuestos_enfriandose", *CASOS["presupuestos_enfriandose"], _ts(0), HOY) == \
        {"monto": "150000.00", "fecha": "01/09"}
    assert alias_datos("cae_por_vencer", *CASOS["cae_por_vencer"], _ts(0), HOY) == {"fecha": "20/10"}
    assert alias_datos("trabajo_con_margen_negativo", *CASOS["trabajo_con_margen_negativo"], _ts(0), HOY) == {}


def _fila(regla, entidad_tipo, entidad_id, datos, creada=None):
    return (1, regla, entidad_tipo, entidad_id, "texto", "para_hoy", datos, creada or _ts(0), _ts(0))


def test_fila_a_dict_completa_monto_y_fecha_en_datos_y_emite_presentacion():
    entidad_id, datos = CASOS["facturas_impagas_viejas"]
    t = _fila_a_dict(_fila("facturas_impagas_viejas", "comprobante", entidad_id, datos))
    assert t["datos"]["monto"] == "84000.00" and t["datos"]["fecha"]
    assert t["datos"]["saldo"] == "84000.00" and t["datos"]["cliente"] == "Panadería"   # lo guardado sigue
    assert t["presentacion"]["accion"]["destino"] == {"tipo": "comprobante", "id": "412"}
    assert t["verbo"] == "Reclamar el pago" and t["criticidad"] == "pronto"             # K-06 intacto


def test_fila_a_dict_lo_guardado_gana_sobre_el_alias():
    entidad_id, datos = CASOS["facturas_impagas_viejas"]
    t = _fila_a_dict(_fila("facturas_impagas_viejas", "comprobante", entidad_id, {**datos, "monto": "1.00"}))
    assert t["datos"]["monto"] == "1.00"


def test_fila_a_dict_manual_y_regla_desconocida_salen_SIN_presentacion_y_con_datos_intactos():
    manual = _fila_a_dict(_fila(None, None, None, {"nota": "llamar"}))
    assert "presentacion" not in manual and manual["datos"] == {"nota": "llamar"}
    futura = _fila_a_dict(_fila("regla_del_futuro", "x", "1", {"saldo": "5"}))
    assert "presentacion" not in futura and futura["datos"] == {"saldo": "5"}
    sin_datos = _fila_a_dict(_fila("facturas_impagas_viejas", "comprobante", "3", None))
    assert sin_datos["datos"] is None


# ── el detector guarda la fecha que sostiene el chip ────────────────────────────────────────────

def test_detector_guarda_fecha_emision_de_la_factura_y_fecha_ISO_del_presupuesto():
    imp = _evaluar_facturas_impagas_viejas({"comprobantes": [
        {"id": 1, "nro": "1", "receptor_nombre": "A", "saldo": "10", "dias": 99, "fecha_emision": "2026-06-01"}]})
    assert imp[0]["datos"]["fecha_emision"] == "2026-06-01"
    pres = _evaluar_presupuestos_enfriandose([
        {"id": 5, "estado": "pendiente", "sin_respuesta": True, "total": 100, "numero": 3,
         "receptor": {"nombre": "B"}, "fecha": datetime.datetime(2026, 9, 1, 15, 30, tzinfo=datetime.timezone.utc)}])
    assert pres[0]["datos"]["fecha"] == "2026-09-01"


@pytest.mark.parametrize("v,esperado", [
    ("84000", "$84.000"), (84000, "$84.000"), ("1250.5", "$1.250,50"), ("-300", "-$300"),
    ("0", "$0"), (None, None), ("", None), ("abc", None), ("NaN", None), ("Infinity", None)])
def test_pesos_es_AR_y_no_inventa_cuando_no_es_numero(v, esperado):
    assert mp._pesos(v) == esperado
