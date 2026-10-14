"""PROTO4DEPS §3 + H12 — `presentacion` por tarjeta de «Mi día»: chip + prosa + kv + acción, por regla.

Lógica pura (sin Postgres): `presentar` y `_fila_a_dict` con una fila en mano. El contrato exige: derivada
en UN lugar, enum cerrado de `accion.destino.tipo`, reglas sin verbo sin `accion`, un test por regla
conocida (incluida la lista vacía del trabajo) y un caso de regla desconocida sin `presentacion`, con
`REGLAS_CONOCIDAS` como única lista.
"""
from __future__ import annotations

import datetime

import pytest

import mi_dia_presentacion as mp
from catalog import build_catalog
from mi_dia_clasificacion import REGLAS_CONOCIDAS, clasificar
from mi_dia_detector import _evaluar_facturas_impagas_viejas, _evaluar_presupuestos_enfriandose
from mi_dia_presentacion import PROSA_ANOTADA_A_MANO, TIPOS_DESTINO_ACCION, presentar
from mi_dia_tarjeta_store import _fila_a_dict

UTC = datetime.timezone.utc
HOY = datetime.date(2026, 10, 13)
TONOS = {"critico", "pronto", "sin_plazo"}
REGLAS_SIN_KV = {"trabajo_con_margen_negativo", "trabajo_con_gastos_y_sin_ingreso"}   # H12 §4


def _ts(dias_atras: int) -> datetime.datetime:
    d = HOY - datetime.timedelta(days=dias_atras)
    return datetime.datetime(d.year, d.month, d.day, 12, 0, tzinfo=UTC)


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
    assert set(p) <= {"chip", "prosa", "kv", "accion"}
    # H12 §3: prosa y kv viajan JUNTAS. Con un caso completo, ninguna regla sale sin prosa.
    assert isinstance(p.get("prosa"), str) and p["prosa"].strip(), f"{regla} sin prosa"
    if regla in REGLAS_SIN_KV:
        assert "kv" not in p, "el prototipo no modela el trabajo: kv vacío, sin rótulos inventados"
    else:
        assert p.get("kv"), f"{regla} sin kv"
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
    assert p["prosa"] == "Este mes gastaste $900.000; el mes anterior, $300.000."


def test_regla_desconocida_no_emite_presentacion_y_la_manual_sin_momento_tampoco():
    assert presentar("regla_del_futuro", "x", {"saldo": "10"}, _ts(0), HOY) is None
    assert presentar(None, None, {"texto": "anotado"}, None, HOY) is None   # sin `creada_en` no hay «Anotado»


def test_factura_impaga_trae_chip_prosa_kv_y_accion_y_el_importe_vive_en_la_PROSA():
    p = presentar("facturas_impagas_viejas", *CASOS["facturas_impagas_viejas"], _ts(0), HOY)
    assert p["chip"] == {"texto": "Emitida hace 31 días", "tono": "pronto"}
    assert p["prosa"] == "Emitida hace 31 días. Son $84.000 que ya facturaste y todavía no entraron."
    assert p["kv"] == [{"k": "Factura", "v": "0001-00000007"}, {"k": "Emitida", "v": "12 de septiembre"}]
    assert p["accion"] == {"texto": "Reclamar el pago",
                           "destino": {"tipo": "comprobante", "id": "412"}}
    # H12 §3: en `#tablero` el monto de la factura NO es una kv. Si la prosa no lo dice, el importe
    # desaparece de la pantalla con los dos lados en verde.
    assert "$84.000" in p["prosa"] and all("$84.000" not in f["v"] for f in p["kv"])


def test_presupuesto_enfriandose_cuenta_dias_desde_la_fecha_del_presupuesto():
    p = presentar("presupuestos_enfriandose", *CASOS["presupuestos_enfriandose"], _ts(0), HOY)
    assert p["chip"] == {"texto": "42 días sin respuesta", "tono": "pronto"}
    assert p["prosa"] == ("Se lo mandaste hace 42 días y no contestó. "
                          "Un presupuesto que se enfría rara vez se recupera solo.")
    assert p["kv"] == [{"k": "Monto", "v": "$150.000"}, {"k": "Enviado", "v": "1 de septiembre"}]
    assert p["accion"]["destino"] == {"tipo": "presupuesto", "id": "77"}


def test_cae_rotula_vence_y_detectado_y_el_dia_detectado_es_el_LOCAL():
    cae = presentar("cae_por_vencer", *CASOS["cae_por_vencer"], _ts(0), HOY)
    assert cae["chip"] == {"texto": "CAE vence en 7 días", "tono": "pronto"}
    assert cae["prosa"] == "El CAE de esta factura vence en 7 días."
    assert cae["kv"] == [{"k": "Vence", "v": "20 de octubre"}, {"k": "Detectado", "v": "13 de octubre"}]
    # 01:00 UTC del 14 = 22:00 del 13 en Buenos Aires: «Detectado» no puede decir 14 (un día después).
    tarde = datetime.datetime(2026, 10, 14, 1, 0, tzinfo=UTC)
    cae2 = presentar("cae_por_vencer", *CASOS["cae_por_vencer"], tarde, HOY)
    assert {"k": "Detectado", "v": "13 de octubre"} in cae2["kv"]


def test_certificado_rotula_vence_cuit_y_ambiente():
    cert = presentar("certificado_afip_por_vencer", *CASOS["certificado_afip_por_vencer"], _ts(0), HOY)
    assert cert["chip"] == {"texto": "Certificado vence en 20 días", "tono": "critico"}
    assert cert["prosa"] == "El certificado de ARCA vence en 20 días."
    assert cert["kv"] == [{"k": "Vence", "v": "2 de noviembre"}, {"k": "CUIT", "v": "20111111112"},
                          {"k": "Ambiente", "v": "homologacion"}]
    assert cert["accion"]["destino"] == {"tipo": "certificado", "id": "20111111112:homologacion"}


def test_certificado_ilegible_o_vencido_lo_dice_y_no_inventa_dias():
    base = {"cuit": "20111111112", "ambiente": "produccion", "dias": None, "vence_at": None}
    ileg = presentar("certificado_afip_por_vencer", "c", {**base, "ilegible": True, "vencido": False}, None, HOY)
    assert ileg["chip"]["texto"] == "No se pudo leer el certificado"
    assert ileg["prosa"] == "No se pudo leer el certificado de ARCA."
    venc = presentar("certificado_afip_por_vencer", "c", {**base, "ilegible": False, "vencido": True}, None, HOY)
    assert venc["chip"]["texto"] == "Certificado vencido"
    assert venc["prosa"] == "El certificado de ARCA está vencido."


def test_trabajo_con_margen_negativo_va_con_kv_VACIO_y_solo_prosa():
    """H12 §4: el prototipo no modela el trabajo en ninguna superficie; la lista vacía es un estado
    legítimo y la clave `kv` directamente no existe (la app ya maneja `detalle.length > 0`)."""
    neg = presentar("trabajo_con_margen_negativo", *CASOS["trabajo_con_margen_negativo"], _ts(0), HOY)
    assert "kv" not in neg
    assert neg["prosa"] == "«Reforma»: cobraste $100.000 y gastaste $130.000, te queda en -$30.000."
    assert "accion" not in neg
    sin_etiqueta = presentar("trabajo_con_margen_negativo", "presupuesto:9",
                             {"cobrado": "1", "gastado": "2", "margen": "-1"}, _ts(0), HOY)
    assert sin_etiqueta["prosa"].startswith("Este trabajo: cobraste $1")


def test_las_dos_reglas_de_trabajo_NO_emiten_accion_aunque_tengan_verbo_y_entidad():
    """Contrato 2026-10-14: el prototipo no tiene tarjeta de trabajo ⇒ ninguna superficie cumple el verbo.
    El control es doble: el `verbo` de la clasificación SÍ existe y la entidad SÍ viene, que es justo
    lo que antes bastaba para emitir `accion`; sin el `None` del presentador este test se pone rojo."""
    for regla in ("trabajo_con_margen_negativo", "trabajo_con_gastos_y_sin_ingreso"):
        entidad_id, datos = CASOS[regla]
        assert clasificar(regla)["verbo"] and entidad_id
        p = presentar(regla, entidad_id, datos, _ts(0), HOY)
        assert p and "accion" not in p and "trabajo" not in str(p.get("accion", ""))


def test_trabajo_sin_ingreso_dice_el_gasto_y_los_dias_en_la_prosa():
    sin = presentar("trabajo_con_gastos_y_sin_ingreso", *CASOS["trabajo_con_gastos_y_sin_ingreso"], _ts(0), HOY)
    assert "kv" not in sin
    assert sin["chip"] == {"texto": "20 días sin movimiento", "tono": "pronto"}
    assert sin["prosa"] == "Gastaste $45.000 en «Pintura» y no registraste ningún ingreso. Hace 20 días que no se mueve."


def test_conexion_caida_reusa_el_destino_del_catalogo_con_su_connect_path():
    cat = {s["key"]: s for s in build_catalog(valid_toolkits=["gmail"], mp_connected=False, composio_connected=[])}
    for key, nombre in (("mercadopago", "Mercado Pago"), ("gmail", "Gmail")):
        p = presentar("conexion_caida", key, {"servicio": key, "nombre": nombre}, _ts(0), HOY)
        assert p["accion"]["texto"] == "Reconectar"
        assert p["accion"]["destino"] == {"tipo": "conexion", "id": key,
                                          "connect_path": cat[key]["connect_path"]}
        assert p["kv"] == [{"k": "Servicio", "v": nombre}]
        assert p["prosa"] == f"Se cortó la conexión con {nombre}."


def test_conexion_caida_con_instante_real_agrega_la_fila_Se_cayo_en_hora_local():
    """Rama CON `desde`: 12:12 UTC = 09:12 en Buenos Aires (zona declarada, no implícita)."""
    hoy_utc = datetime.datetime(2026, 10, 13, 12, 12, tzinfo=UTC)
    base = {"servicio": "mercadopago", "nombre": "Mercado Pago"}
    p = presentar("conexion_caida", "mercadopago", {**base, "desde": hoy_utc.isoformat()}, _ts(0), HOY)
    assert p["kv"] == [{"k": "Servicio", "v": "Mercado Pago"}, {"k": "Se cayó", "v": "Hoy, 09:12"}]
    # El sufijo `Z` también es un instante; «ayer» y «otro día» usan el mismo formato que «Anotado».
    p = presentar("conexion_caida", "mercadopago", {**base, "desde": "2026-10-12T22:20:00Z"}, _ts(0), HOY)
    assert p["kv"][1] == {"k": "Se cayó", "v": "Ayer, 19:20"}
    p = presentar("conexion_caida", "mercadopago", {**base, "desde": "2026-09-12T15:00:00+00:00"}, _ts(0), HOY)
    assert p["kv"][1] == {"k": "Se cayó", "v": "12 de septiembre, 12:00"}


def test_conexion_caida_SIN_instante_real_no_agrega_fila_y_nunca_usa_creada():
    """Rama SIN `desde` (Composio): el kv sigue siendo sólo «Servicio». `creada` es cuándo corrió el
    detector: presentarla como «se cayó» sería una hora fabricada indistinguible de una medida."""
    base = {"servicio": "gmail", "nombre": "Gmail"}
    for desde in (None, "", "2026-10-13", "no-es-fecha"):   # ausente, vacío, fecha SOLA, ilegible
        datos = dict(base) if desde is None else {**base, "desde": desde}
        p = presentar("conexion_caida", "gmail", datos, _ts(0), HOY)
        assert p["kv"] == [{"k": "Servicio", "v": "Gmail"}], desde
        assert "Se cayó" not in str(p), desde


# ── la tarjeta anotada a mano (`regla is None`) ──────────────────────────────────────────────────

def test_anotada_a_mano_dice_lo_anotaste_vos_y_UNA_fila_con_el_momento_en_hora_local():
    # 22:20 UTC del 12/10 = 19:20 en Buenos Aires -> «Ayer, 19:20» (el ejemplo del prototipo).
    ayer = datetime.datetime(2026, 10, 12, 22, 20, tzinfo=UTC)
    p = presentar(None, None, {"nota": "llamar"}, ayer, HOY)
    assert p == {"prosa": PROSA_ANOTADA_A_MANO, "kv": [{"k": "Anotado", "v": "Ayer, 19:20"}]}
    assert PROSA_ANOTADA_A_MANO == "Lo anotaste vos, así que lo cerrás vos."
    assert presentar(None, None, {}, _ts(0), HOY)["kv"] == [{"k": "Anotado", "v": "Hoy, 09:00"}]
    vieja = datetime.datetime(2026, 10, 1, 15, 5, tzinfo=UTC)
    assert presentar(None, None, {}, vieja, HOY)["kv"] == [{"k": "Anotado", "v": "1 de octubre, 12:05"}]


# ── envejecimiento: un `dias` guardado no puede congelar el chip ────────────────────────────────

def test_sin_fecha_absoluta_el_dias_de_la_foto_envejece_con_los_dias_transcurridos():
    """Tarjeta vieja (sin `fecha_emision`): `dias=10` hace 5 días ⇒ hoy son 15. Sin esto el chip diría
    «hace 10 días» para siempre, porque `crear_si_no_existe` es DO NOTHING y `datos` no se refresca."""
    datos = {"nro": "1", "cliente": "X", "saldo": "500", "dias": 10}
    p = presentar("facturas_impagas_viejas", "9", datos, _ts(5), HOY)
    assert p["chip"]["texto"] == "Emitida hace 15 días"
    assert p["prosa"] == "Emitida hace 15 días. Son $500 que ya facturaste y todavía no entraron."
    assert [f["k"] for f in p["kv"]] == ["Factura"], "sin fecha guardada NO se fabrica una fila Emitida"


def test_una_fecha_de_otro_anio_lleva_el_anio_y_una_del_corriente_no():
    p = presentar("facturas_impagas_viejas", "9",
                  {"nro": "1", "saldo": "500", "fecha_emision": "2025-09-12"}, _ts(0), HOY)
    assert {"k": "Emitida", "v": "12 de septiembre de 2025"} in p["kv"]
    q = presentar("facturas_impagas_viejas", "9",
                  {"nro": "1", "saldo": "500", "fecha_emision": "2026-09-12"}, _ts(0), HOY)
    assert {"k": "Emitida", "v": "12 de septiembre"} in q["kv"]


def test_presupuesto_viejo_sin_fecha_sale_sin_chip_ni_fecha_pero_conserva_monto_prosa_y_accion():
    p = presentar("presupuestos_enfriandose", "77", {"numero": 1, "total": "1000"}, _ts(3), HOY)
    assert "chip" not in p
    assert p["kv"] == [{"k": "Monto", "v": "$1.000"}]
    assert p["prosa"] == "No contestó. Un presupuesto que se enfría rara vez se recupera solo."
    assert p["accion"]["destino"]["id"] == "77"


def test_cae_ya_vencido_o_que_vence_hoy_no_dice_en_0_dias():
    hoy_ = presentar("cae_por_vencer", "5", {"cae_vto": "2026-10-13"}, None, HOY)
    assert hoy_["chip"]["texto"] == "CAE vence hoy"
    assert hoy_["prosa"] == "El CAE de esta factura vence hoy."
    venc = presentar("cae_por_vencer", "5", {"cae_vto": "2026-10-10"}, None, HOY)
    assert venc["chip"]["texto"] == "CAE vencido"
    assert venc["prosa"] == "El CAE de esta factura está vencido."


def _fila(regla, entidad_tipo, entidad_id, datos, creada=None):
    return (1, regla, entidad_tipo, entidad_id, "texto", "para_hoy", datos, creada or _ts(0), _ts(0))


def test_fila_a_dict_emite_presentacion_colgada_de_la_tarjeta_y_NO_toca_datos():
    """D2: `presentacion` es hermana de `datos`. H12: `datos` queda como lo guardó el detector (sin los
    alias `monto`/`fecha` que se probaron y se rechazaron)."""
    entidad_id, datos = CASOS["facturas_impagas_viejas"]
    t = _fila_a_dict(_fila("facturas_impagas_viejas", "comprobante", entidad_id, datos))
    assert t["datos"] == datos and "monto" not in t["datos"] and "fecha" not in t["datos"]
    assert "presentacion" not in t["datos"]
    assert t["presentacion"]["accion"]["destino"] == {"tipo": "comprobante", "id": "412"}
    assert t["presentacion"]["prosa"] and t["presentacion"]["kv"]
    assert t["verbo"] == "Reclamar el pago" and t["criticidad"] == "pronto"             # K-06 intacto


def test_fila_a_dict_manual_lleva_presentacion_y_regla_desconocida_no():
    manual = _fila_a_dict(_fila(None, None, None, {"nota": "llamar"}))
    assert manual["datos"] == {"nota": "llamar"}
    assert manual["presentacion"]["prosa"] == PROSA_ANOTADA_A_MANO
    assert [f["k"] for f in manual["presentacion"]["kv"]] == ["Anotado"]
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
         "receptor": {"nombre": "B"}, "fecha": datetime.datetime(2026, 9, 1, 15, 30, tzinfo=UTC)}])
    assert pres[0]["datos"]["fecha"] == "2026-09-01"


@pytest.mark.parametrize("v,esperado", [
    ("84000", "$84.000"), (84000, "$84.000"), ("1250.5", "$1.250,50"), ("-300", "-$300"),
    ("0", "$0"), (None, None), ("", None), ("abc", None), ("NaN", None), ("Infinity", None)])
def test_pesos_es_AR_y_no_inventa_cuando_no_es_numero(v, esperado):
    assert mp._pesos(v) == esperado
