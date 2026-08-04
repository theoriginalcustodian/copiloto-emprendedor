"""Tests del validador fiscal puro.

No hay mocks ni fixtures de red: el módulo bajo prueba no toca nada externo. Si un test de acá falla,
falla la regla fiscal, no el entorno.

El foco está en los casos **adversariales**: no alcanza con probar que una factura bien cargada pasa.
Hay que probar que una mal cargada NO pasa — sobre todo en R1 y R2, que son las reglas que ARCA ya pagó
caro en producción (error 10243, `RECHAZADO_ARCA`).
"""

from __future__ import annotations

from datetime import date
from decimal import Decimal

import pytest

from afip_rules import (
    BorradorFactura,
    Concepto,
    CondicionEmisor,
    CondicionIVA,
    DatosVenta,
    EstadoFactura,
    Item,
    PerfilFiscal,
    Receptor,
    TipoComprobante,
    TipoDoc,
    a_decimal,
    armar_params_pdf,
    armar_params_pdf_nota_credito,
    receptor_desde_payload,
    armar_payload_wsfe,
    calcular_totales,
    determinar_tipo_comprobante,
    fecha_valida_para_afip,
    normalizar_condicion_iva_receptor,
    puede_emitir,
    siguiente_estado,
    validar_cuit,
    validar_datos_venta,
    validar_factura_completa,
    validar_items,
    validar_perfil,
    validar_receptor,
)

HOY = date(2026, 7, 21)

# CUITs con dígito verificador real (validados a mano contra el módulo 11).
CUIT_EMISOR = "20409378472"  # el CUIT de testing compartido de AfipSDK
CUIT_RECEPTOR = "33693450239"


def perfil_monotributo(**kw) -> PerfilFiscal:
    base = dict(
        cuit=CUIT_EMISOR,
        razon_social="Emprendimiento de Prueba",
        domicilio_comercial="Calle Falsa 123, CABA",
        condicion_iva=CondicionEmisor.MONOTRIBUTO,
        ingresos_brutos="20-40937847-2",
        inicio_actividades=date(2020, 1, 1),
        punto_venta=1,
    )
    base.update(kw)
    return PerfilFiscal(**base)  # type: ignore[arg-type]


def borrador_valido(**kw) -> BorradorFactura:
    b = BorradorFactura(
        datos_venta=DatosVenta(
            fecha=HOY, concepto=Concepto.PRODUCTOS, condicion_venta="Contado"
        ),
        items=[Item(descripcion="Servicio web", cantidad=Decimal("1"), precio_unitario=Decimal("250000"))],
        receptor=Receptor(condicion_iva=CondicionIVA.CONSUMIDOR_FINAL),
    )
    for k, v in kw.items():
        setattr(b, k, v)
    return b


# ---------------------------------------------------------------------------
# CUIT
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("cuit", [CUIT_EMISOR, CUIT_RECEPTOR])
def test_cuit_valido(cuit):
    assert validar_cuit(cuit)


@pytest.mark.parametrize(
    "cuit",
    [
        "20409378473",  # dígito verificador cambiado
        "2040937847",  # 10 dígitos
        "204093784721",  # 12 dígitos
        "20-40937847-2",  # con guiones
        "",
        None,
    ],
)
def test_cuit_invalido(cuit):
    assert not validar_cuit(cuit)


# ---------------------------------------------------------------------------
# R1 — el guardrail de la RG 5616/2024. Es el test que más importa de este archivo.
# ---------------------------------------------------------------------------


def test_r1_consumidor_final_fuerza_condicion_5():
    """Aunque alguien cargue 'Responsable Inscripto', si no hay documento la condición es 5."""
    receptor = Receptor(
        condicion_iva=CondicionIVA.RESPONSABLE_INSCRIPTO,  # ← dato incoherente, a propósito
        tipo_doc=TipoDoc.CONSUMIDOR_FINAL,
    )
    assert normalizar_condicion_iva_receptor(receptor) is CondicionIVA.CONSUMIDOR_FINAL


def test_r1_adversarial_el_payload_nunca_sale_con_cond_1_y_doc_99():
    """ADVERSARIAL: el caso exacto que AFIP rechaza con el error 10243.

    Se construye un receptor deliberadamente inconsistente y se verifica que el payload que sale hacia
    AFIP ya viene corregido. No alcanza con que exista una función de normalización: hay que probar que
    el camino de datos la usa. En ARCA la validación existía y el workflow no la invocaba.
    """
    borrador = borrador_valido(
        receptor=Receptor(
            condicion_iva=CondicionIVA.RESPONSABLE_INSCRIPTO,
            tipo_doc=TipoDoc.CONSUMIDOR_FINAL,
            nro_doc="0",
        )
    )
    payload = armar_payload_wsfe(perfil_monotributo(), borrador, hoy=HOY)

    assert payload["DocTipo"] == 99
    assert payload["CondicionIVAReceptorId"] == 5, (
        "REGRESIÓN CRÍTICA: se está mandando a AFIP una condición de IVA incompatible con "
        "DocTipo=99. Esto es el error 10243 (RECHAZADO_ARCA)."
    )


def test_r1_receptor_identificado_conserva_su_condicion():
    receptor = Receptor(
        condicion_iva=CondicionIVA.RESPONSABLE_INSCRIPTO,
        tipo_doc=TipoDoc.CUIT,
        nro_doc=CUIT_RECEPTOR,
    )
    assert normalizar_condicion_iva_receptor(receptor) is CondicionIVA.RESPONSABLE_INSCRIPTO


# ---------------------------------------------------------------------------
# R2 — letra del comprobante
# ---------------------------------------------------------------------------


def test_r2_monotributo_siempre_emite_c_aunque_el_receptor_sea_ri():
    """ADVERSARIAL: un monotributista NO puede emitir A ni aunque le facture a un RI con CUIT."""
    receptor_ri = Receptor(
        condicion_iva=CondicionIVA.RESPONSABLE_INSCRIPTO, tipo_doc=TipoDoc.CUIT, nro_doc=CUIT_RECEPTOR
    )
    assert determinar_tipo_comprobante(perfil_monotributo(), receptor_ri) is TipoComprobante.FACTURA_C


def test_r2_exento_tambien_emite_c():
    perfil = perfil_monotributo(condicion_iva=CondicionEmisor.EXENTO)
    receptor = Receptor(condicion_iva=CondicionIVA.RESPONSABLE_INSCRIPTO, tipo_doc=TipoDoc.CUIT, nro_doc=CUIT_RECEPTOR)
    assert determinar_tipo_comprobante(perfil, receptor) is TipoComprobante.FACTURA_C


def test_r2_ri_a_ri_con_cuit_emite_a():
    perfil = perfil_monotributo(condicion_iva=CondicionEmisor.RESPONSABLE_INSCRIPTO)
    receptor = Receptor(condicion_iva=CondicionIVA.RESPONSABLE_INSCRIPTO, tipo_doc=TipoDoc.CUIT, nro_doc=CUIT_RECEPTOR)
    assert determinar_tipo_comprobante(perfil, receptor) is TipoComprobante.FACTURA_A


def test_r2_ri_a_consumidor_final_emite_b():
    perfil = perfil_monotributo(condicion_iva=CondicionEmisor.RESPONSABLE_INSCRIPTO)
    receptor = Receptor(condicion_iva=CondicionIVA.CONSUMIDOR_FINAL, tipo_doc=TipoDoc.CONSUMIDOR_FINAL)
    assert determinar_tipo_comprobante(perfil, receptor) is TipoComprobante.FACTURA_B


# ---------------------------------------------------------------------------
# R3 — forma de la Factura C
# ---------------------------------------------------------------------------


def test_r3_factura_c_omite_la_clave_iva():
    """Verificado empíricamente en el spike: la clave se OMITE, no se manda como lista vacía."""
    payload = armar_payload_wsfe(perfil_monotributo(), borrador_valido(), hoy=HOY)
    assert "Iva" not in payload


def test_r3_factura_c_neto_es_el_total_y_iva_cero():
    payload = armar_payload_wsfe(perfil_monotributo(), borrador_valido(), hoy=HOY)
    assert payload["ImpNeto"] == payload["ImpTotal"] == 250000.0
    assert payload["ImpIVA"] == 0
    assert payload["ImpOpEx"] == 0


def test_moneda_es_pes_no_ars():
    """AFIP usa 'PES'. 'ARS' es el código ISO 4217 y no corresponde en el web service."""
    payload = armar_payload_wsfe(perfil_monotributo(), borrador_valido(), hoy=HOY)
    assert payload["MonId"] == "PES"


def test_factura_a_b_falla_ruidoso_en_vez_de_calcular_mal():
    with pytest.raises(NotImplementedError):
        calcular_totales([Item("x", Decimal("1"), Decimal("100"))], tipo=TipoComprobante.FACTURA_A)


# ---------------------------------------------------------------------------
# R4 — fecha
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("dias", [0, 10, -10])
def test_r4_fecha_dentro_del_margen(dias):
    from datetime import timedelta

    assert fecha_valida_para_afip(HOY + timedelta(days=dias), hoy=HOY)


@pytest.mark.parametrize("dias", [11, -11, 60])
def test_r4_fecha_fuera_del_margen(dias):
    from datetime import timedelta

    fecha = HOY + timedelta(days=dias)
    assert not fecha_valida_para_afip(fecha, hoy=HOY)
    errores = validar_datos_venta(
        DatosVenta(fecha=fecha, concepto=Concepto.PRODUCTOS, condicion_venta="Contado"), hoy=HOY
    )
    assert any(e.codigo == "fecha_fuera_de_rango" for e in errores)


# ---------------------------------------------------------------------------
# R5 — tope de consumidor final sin identificar
# ---------------------------------------------------------------------------


def test_r5_monto_alto_sin_identificar_es_rechazado():
    errores = validar_receptor(
        Receptor(condicion_iva=CondicionIVA.CONSUMIDOR_FINAL, tipo_doc=TipoDoc.CONSUMIDOR_FINAL),
        total=Decimal("10000001"),
    )
    assert any(e.codigo == "supera_tope_sin_identificar" for e in errores)


def test_r5_monto_alto_con_cliente_identificado_pasa():
    errores = validar_receptor(
        Receptor(condicion_iva=CondicionIVA.RESPONSABLE_INSCRIPTO, tipo_doc=TipoDoc.CUIT, nro_doc=CUIT_RECEPTOR),
        total=Decimal("99000000"),
    )
    assert errores == []


def test_r5_el_tope_es_parametrizable_no_hardcodeado():
    """El valor vigente está pendiente de verificar contra normativa: tiene que poder cambiarse."""
    errores = validar_receptor(
        Receptor(condicion_iva=CondicionIVA.CONSUMIDOR_FINAL, tipo_doc=TipoDoc.CONSUMIDOR_FINAL),
        total=Decimal("5000"),
        tope_sin_identificar=Decimal("1000"),
    )
    assert any(e.codigo == "supera_tope_sin_identificar" for e in errores)


# ---------------------------------------------------------------------------
# R6 — servicios
# ---------------------------------------------------------------------------


def test_r6_servicios_exigen_las_tres_fechas():
    errores = validar_datos_venta(
        DatosVenta(fecha=HOY, concepto=Concepto.SERVICIOS, condicion_venta="Contado"), hoy=HOY
    )
    faltantes = {e.campo for e in errores if e.codigo == "fecha_servicio_faltante"}
    assert faltantes == {"fecha_servicio_desde", "fecha_servicio_hasta", "fecha_vto_pago"}


def test_r6_productos_no_exige_fechas_de_servicio():
    errores = validar_datos_venta(
        DatosVenta(fecha=HOY, concepto=Concepto.PRODUCTOS, condicion_venta="Contado"), hoy=HOY
    )
    assert not any(e.codigo == "fecha_servicio_faltante" for e in errores)


def test_r6_periodo_invertido_es_error():
    errores = validar_datos_venta(
        DatosVenta(
            fecha=HOY,
            concepto=Concepto.SERVICIOS,
            condicion_venta="Contado",
            fecha_servicio_desde=date(2026, 7, 20),
            fecha_servicio_hasta=date(2026, 7, 10),
            fecha_vto_pago=HOY,
        ),
        hoy=HOY,
    )
    assert any(e.codigo == "periodo_servicio_invertido" for e in errores)


def test_r6_servicios_completo_arma_las_fechas_en_el_payload():
    borrador = borrador_valido(
        datos_venta=DatosVenta(
            fecha=HOY,
            concepto=Concepto.SERVICIOS,
            condicion_venta="Contado",
            fecha_servicio_desde=date(2026, 7, 1),
            fecha_servicio_hasta=date(2026, 7, 31),
            fecha_vto_pago=date(2026, 8, 10),
        )
    )
    payload = armar_payload_wsfe(perfil_monotributo(), borrador, hoy=HOY)
    assert payload["FchServDesde"] == 20260701
    assert payload["FchServHasta"] == 20260731
    assert payload["FchVtoPago"] == 20260810


# ---------------------------------------------------------------------------
# R7 — perfil fiscal completo (los campos que descubrió el spike)
# ---------------------------------------------------------------------------


def test_r7_perfil_ausente_bloquea():
    errores = validar_perfil(None)
    assert errores and errores[0].codigo == "perfil_ausente"


@pytest.mark.parametrize(
    "campo,valor,codigo",
    [
        ("razon_social", "", "razon_social_vacio"),
        ("domicilio_comercial", "  ", "domicilio_comercial_vacio"),
        ("ingresos_brutos", "", "ingresos_brutos_vacio"),
        ("cuit", "12345678901", "cuit_invalido"),
        ("punto_venta", 0, "punto_venta_invalido"),
    ],
)
def test_r7_perfil_incompleto_se_detecta(campo, valor, codigo):
    errores = validar_perfil(perfil_monotributo(**{campo: valor}))
    assert any(e.codigo == codigo for e in errores), f"esperaba {codigo}, obtuve {[e.codigo for e in errores]}"


def test_r7_sin_perfil_no_se_arma_payload():
    with pytest.raises(ValueError):
        armar_payload_wsfe(perfil_monotributo(razon_social=""), borrador_valido(), hoy=HOY)


# ---------------------------------------------------------------------------
# R8 — aritmética
# ---------------------------------------------------------------------------


def test_r8_suma_de_subtotales():
    items = [
        Item("a", Decimal("2"), Decimal("100.50")),
        Item("b", Decimal("3"), Decimal("33.33")),
    ]
    totales = calcular_totales(items, tipo=TipoComprobante.FACTURA_C)
    assert totales.total == Decimal("300.99")  # 201.00 + 99.99


def test_r8_redondeo_es_half_up_no_bankers():
    """Python redondea 2.5 → 2 por defecto (bankers'). En dinero, AFIP espera 2.5 → 3."""
    item = Item("x", Decimal("1"), Decimal("0.125"))
    assert item.subtotal == Decimal("0.13")


def test_no_se_aceptan_floats_en_importes():
    with pytest.raises(ValueError, match="no se aceptan float"):
        a_decimal(1000.10, campo="precio_unitario")


def test_decimal_desde_string_funciona():
    assert a_decimal("1000.10", campo="precio") == Decimal("1000.10")


# ---------------------------------------------------------------------------
# Ítems
# ---------------------------------------------------------------------------


def test_factura_sin_items_no_es_valida():
    assert any(e.codigo == "sin_items" for e in validar_items([]))


@pytest.mark.parametrize(
    "item,codigo",
    [
        (Item("", Decimal("1"), Decimal("100")), "item_sin_descripcion"),
        (Item("x", Decimal("0"), Decimal("100")), "item_cantidad_invalida"),
        (Item("x", Decimal("-1"), Decimal("100")), "item_cantidad_invalida"),
        (Item("x", Decimal("1"), Decimal("0")), "item_precio_invalido"),
        (Item("x", Decimal("1"), Decimal("-50")), "item_precio_invalido"),
    ],
)
def test_items_invalidos(item, codigo):
    assert any(e.codigo == codigo for e in validar_items([item]))


# ---------------------------------------------------------------------------
# Máquina de estados
# ---------------------------------------------------------------------------


def test_estado_borrador_sin_nada():
    estado = siguiente_estado(
        EstadoFactura.BORRADOR, perfil=perfil_monotributo(), borrador=BorradorFactura(), hoy=HOY
    )
    assert estado is EstadoFactura.BORRADOR


def test_estado_avanza_al_cargar_datos_de_venta():
    borrador = BorradorFactura(
        datos_venta=DatosVenta(fecha=HOY, concepto=Concepto.PRODUCTOS, condicion_venta="Contado")
    )
    estado = siguiente_estado(EstadoFactura.BORRADOR, perfil=perfil_monotributo(), borrador=borrador, hoy=HOY)
    assert estado is EstadoFactura.DATOS_VENTA_OK


def test_estado_llega_a_esperando_confirmacion_con_todo_cargado():
    estado = siguiente_estado(
        EstadoFactura.BORRADOR, perfil=perfil_monotributo(), borrador=borrador_valido(), hoy=HOY
    )
    assert estado is EstadoFactura.ESPERANDO_CONFIRMACION


def test_estado_retrocede_si_se_borran_los_items():
    """El estado se recalcula desde los datos: si el usuario vacía los ítems, no queda listo para emitir."""
    borrador = borrador_valido()
    assert (
        siguiente_estado(EstadoFactura.ESPERANDO_CONFIRMACION, perfil=perfil_monotributo(), borrador=borrador, hoy=HOY)
        is EstadoFactura.ESPERANDO_CONFIRMACION
    )
    borrador.items = []
    assert (
        siguiente_estado(EstadoFactura.ESPERANDO_CONFIRMACION, perfil=perfil_monotributo(), borrador=borrador, hoy=HOY)
        is EstadoFactura.DATOS_VENTA_OK
    )


def test_perfil_incompleto_frena_antes_de_la_confirmacion():
    estado = siguiente_estado(
        EstadoFactura.BORRADOR,
        perfil=perfil_monotributo(ingresos_brutos=""),
        borrador=borrador_valido(),
        hoy=HOY,
    )
    assert estado is EstadoFactura.CLIENTE_OK


@pytest.mark.parametrize(
    "estado", [EstadoFactura.ENTREGADA, EstadoFactura.RECHAZADA, EstadoFactura.CANCELADA]
)
def test_estados_terminales_no_se_recalculan(estado):
    """Una vez emitida o cancelada, tocar los slots no puede revivir la factura."""
    assert (
        siguiente_estado(estado, perfil=perfil_monotributo(), borrador=BorradorFactura(), hoy=HOY) is estado
    )


def test_emitiendo_no_retrocede_aunque_se_vacien_los_slots():
    """ADVERSARIAL: si ya salió hacia AFIP, ningún cambio de datos puede hacerla retroceder."""
    assert (
        siguiente_estado(EstadoFactura.EMITIENDO, perfil=None, borrador=BorradorFactura(), hoy=HOY)
        is EstadoFactura.EMITIENDO
    )


@pytest.mark.parametrize(
    "estado",
    [
        EstadoFactura.BORRADOR,
        EstadoFactura.DATOS_VENTA_OK,
        EstadoFactura.ITEMS_OK,
        EstadoFactura.CLIENTE_OK,
        EstadoFactura.EMITIDA,
        EstadoFactura.ENTREGADA,
        EstadoFactura.CANCELADA,
        EstadoFactura.RECHAZADA,
    ],
)
def test_solo_se_emite_desde_esperando_confirmacion(estado):
    """ADVERSARIAL: no hay atajo hacia la emisión desde ningún otro estado."""
    assert not puede_emitir(estado)


def test_se_emite_desde_esperando_confirmacion():
    assert puede_emitir(EstadoFactura.ESPERANDO_CONFIRMACION)


# ---------------------------------------------------------------------------
# Validación integral + params del PDF
# ---------------------------------------------------------------------------


def test_validacion_integral_devuelve_todos_los_errores_no_solo_el_primero():
    """La UI tiene que poder mostrar todo lo que falta de una vez, no de a un campo por vez."""
    errores = validar_factura_completa(
        perfil_monotributo(razon_social=""), BorradorFactura(), hoy=HOY
    )
    codigos = {e.codigo for e in errores}
    assert {"razon_social_vacio", "datos_venta_ausentes", "sin_items", "receptor_ausente"} <= codigos


def test_factura_valida_no_tiene_errores():
    assert validar_factura_completa(perfil_monotributo(), borrador_valido(), hoy=HOY) == []


def test_params_pdf_usan_formato_ddmmyyyy():
    """Formato descubierto por el 400 del spike — el WS devuelve ISO, el template exige DD/MM/YYYY."""
    params = armar_params_pdf(
        perfil_monotributo(),
        borrador_valido(),
        numero=14681,
        cae="86290616997729",
        cae_vto=date(2026, 7, 31),
        fecha_emision=HOY,
    )
    assert params["issue_date"] == "21/07/2026"
    assert params["cae_due_date"] == "31/07/2026"
    assert params["issuer_activity_start_date"] == "01/01/2020"


def test_params_pdf_tipos_enteros_donde_el_template_los_exige():
    params = armar_params_pdf(
        perfil_monotributo(), borrador_valido(), numero=1, cae="123", cae_vto=HOY, fecha_emision=HOY
    )
    assert isinstance(params["receiver_document_type"], int)
    assert isinstance(params["concept"], int)


def test_params_pdf_incluyen_los_campos_que_el_spike_descubrio_obligatorios():
    params = armar_params_pdf(
        perfil_monotributo(), borrador_valido(), numero=1, cae="123", cae_vto=HOY, fecha_emision=HOY
    )
    for campo in (
        "issuer_gross_income",
        "issuer_activity_start_date",
        "receiver_address",
        "sale_condition",
        "net_amount_taxed",
        "net_amount_untaxed",
        "exempt_amount",
    ):
        assert campo in params, f"falta {campo}: el template devuelve 400 sin él"


def test_params_pdf_con_servicios_incluye_las_fechas_del_periodo():
    """REGRESIÓN: el template rechaza el PDF de un servicio sin billing_from/to ni payment_due_date.

    Costó una factura real en producción: el E2E de homologación usaba concepto 1 (productos), así que
    el hueco no aparecía. La emisión salió bien, falló el PDF, y la factura quedó viva hasta anularla.
    """
    borrador = borrador_valido(
        datos_venta=DatosVenta(
            fecha=HOY, concepto=Concepto.SERVICIOS, condicion_venta="Contado",
            fecha_servicio_desde=date(2026, 7, 1), fecha_servicio_hasta=date(2026, 7, 31),
            fecha_vto_pago=date(2026, 8, 10)))
    params = armar_params_pdf(perfil_monotributo(), borrador, numero=1, cae="1",
                              cae_vto=HOY, fecha_emision=HOY)
    assert params["billing_from"] == "01/07/2026"
    assert params["billing_to"] == "31/07/2026"
    assert params["payment_due_date"] == "10/08/2026"


def test_params_pdf_con_productos_no_manda_fechas_de_periodo():
    params = armar_params_pdf(perfil_monotributo(), borrador_valido(), numero=1, cae="1",
                              cae_vto=HOY, fecha_emision=HOY)
    assert "billing_from" not in params


def test_params_pdf_condicion_receptor_es_string_legible():
    """El template pide la condición como texto, no como el id numérico."""
    params = armar_params_pdf(
        perfil_monotributo(), borrador_valido(), numero=1, cae="123", cae_vto=HOY, fecha_emision=HOY
    )
    assert params["receiver_iva_condition"] == "Consumidor Final"
    assert params["issuer_iva_condition"] == "Responsable Monotributo"


def test_params_pdf_rellenan_al_receptor_no_identificado():
    """Consumidor final sin datos: el WSFE lo AUTORIZA, pero el template del PDF exige los tres campos.

    Sin el relleno, el caso más común del producto —venta mostrador— emite con CAE y se queda sin
    comprobante imprimible: AfipSDK devuelve 400 con "El campo Nombre receptor es obligatorio".
    Apareció en la primera emisión real desde el device (factura N° 5, 2026-07-21), justo cuando el
    frontend sacó la validación de más que lo estaba tapando.
    """
    # El caso REAL: el formulario manda las claves con cadena vacía (el usuario dejó el campo en
    # blanco), no las omite. El default de la dataclass no aplica ahí.
    borrador = borrador_valido()
    borrador.receptor = Receptor(condicion_iva=CondicionIVA.CONSUMIDOR_FINAL,
                                 nro_doc="", nombre="", domicilio="")

    params = armar_params_pdf(
        perfil_monotributo(), borrador, numero=5, cae="123", cae_vto=HOY, fecha_emision=HOY
    )
    assert params["receiver_name"] == "Consumidor Final"
    assert params["receiver_address"] == "-"
    assert params["receiver_document_number"] == "0"
    # Ninguno puede quedar vacío: el template los rechaza los tres por igual.
    for campo in ("receiver_name", "receiver_address", "receiver_document_number"):
        assert params[campo], f"{campo} vacío → 400 del template"


def test_params_pdf_respetan_los_datos_reales_del_receptor_cuando_existen():
    """El relleno es para el hueco, no un pisado: si el usuario cargó los datos, van los suyos."""
    borrador = borrador_valido()
    borrador.receptor = Receptor(
        condicion_iva=CondicionIVA.RESPONSABLE_INSCRIPTO, tipo_doc=TipoDoc.CUIT,
        nro_doc=CUIT_RECEPTOR, nombre="ACME SA", domicilio="Corrientes 1234")

    params = armar_params_pdf(
        perfil_monotributo(), borrador, numero=6, cae="123", cae_vto=HOY, fecha_emision=HOY
    )
    assert params["receiver_name"] == "ACME SA"
    assert params["receiver_address"] == "Corrientes 1234"
    assert params["receiver_document_number"] == CUIT_RECEPTOR


@pytest.mark.parametrize("vacio", ["", None])
def test_receptor_desde_payload_normaliza_los_campos_vacios(vacio):
    """`payload.get(k, default)` sólo cubre la clave AUSENTE, no la vacía.

    Un formulario que manda `{"nombre": ""}` —el usuario dejó el campo en blanco en una venta a
    consumidor final— pasaba de largo y el template del PDF respondía 400: factura con CAE y sin
    comprobante imprimible. Con `null`, `str(None)` habría impreso "None" en la factura.
    """
    r = receptor_desde_payload({"condicion_iva": 5, "tipo_doc": 99,
                                "nombre": vacio, "domicilio": vacio, "nro_doc": vacio})
    assert r.nombre == "Consumidor Final"
    assert r.domicilio == "-"
    assert r.nro_doc == "0"


def test_receptor_desde_payload_respeta_los_datos_cargados():
    r = receptor_desde_payload({"condicion_iva": 1, "tipo_doc": 80, "nro_doc": CUIT_RECEPTOR,
                                "nombre": "ACME SA", "domicilio": "Corrientes 1234"})
    assert (r.nombre, r.domicilio, r.nro_doc) == ("ACME SA", "Corrientes 1234", CUIT_RECEPTOR)
    assert r.condicion_iva is CondicionIVA.RESPONSABLE_INSCRIPTO


# ---------------------------------------------------------------------------
# PDF de la nota de crédito (Bandeja AFIP, 2026-08-04) — clona el params_pdf_json de la factura
# original y sólo pisa lo que cambia con la anulación.
# ---------------------------------------------------------------------------

def _params_pdf_de_ejemplo() -> dict:
    return {
        "voucher_number": 555, "sales_point": 1, "issue_date": "20/07/2026",
        "cae_due_date": "30/07/2026", "issuer_cuit": int(CUIT_EMISOR), "cae": "CAE-ORIGINAL",
        "issuer_business_name": "Fulano SRL", "receiver_name": "Consumidor Final",
        "items": [{"code": "001", "description": "Servicio", "quantity": 1.0,
                   "unit_price": 500.0, "subtotal": 500.0}],
        "total_amount": 500.0, "vat_amount": 0,
    }


def test_armar_params_pdf_nota_credito_clona_items_y_pisa_solo_lo_que_cambia():
    original = {"tipo_cbte": int(TipoComprobante.FACTURA_C), "params_pdf_json": _params_pdf_de_ejemplo()}
    params = armar_params_pdf_nota_credito(
        original, numero=901, cae="CAE-NC", cae_vto=date(2026, 8, 14), fecha_emision=date(2026, 8, 4))

    # Lo que cambia con la anulación:
    assert params["voucher_number"] == 901
    assert params["cae"] == "CAE-NC"
    assert params["issue_date"] == "04/08/2026"
    assert params["cae_due_date"] == "14/08/2026"
    # Lo que NO cambia — clonado tal cual del original, ítem por ítem:
    assert params["items"] == original["params_pdf_json"]["items"]
    assert params["total_amount"] == 500.0
    assert params["receiver_name"] == "Consumidor Final"
    assert params["issuer_business_name"] == "Fulano SRL"


def test_armar_params_pdf_nota_credito_sin_params_pdf_json_levanta_value_error():
    """Comprobantes emitidos ANTES de la migración 2026-08-04 no tienen `params_pdf_json` — no hay
    ítems que reconstruir. El caller (`AnulacionWorkflow`) lo atrapa y falla BLANDO: la NC ya tiene
    CAE, sólo se queda sin PDF adjunto."""
    original_viejo = {"tipo_cbte": int(TipoComprobante.FACTURA_C), "params_pdf_json": None}
    with pytest.raises(ValueError, match="params_pdf_json"):
        armar_params_pdf_nota_credito(
            original_viejo, numero=901, cae="CAE-NC",
            cae_vto=date(2026, 8, 14), fecha_emision=date(2026, 8, 4))
