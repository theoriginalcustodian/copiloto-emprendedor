"""Los DOS guards que protegen las propiedades derivadas del presupuesto.

Se testean aparte del router porque no son lógica de endpoint: son acuerdos con OTROS módulos que se
romperían en silencio si alguien los cambia de un lado solo.
"""
from __future__ import annotations

from decimal import Decimal

import presupuesto_store
import web as web_module
# `componer_system_extra` se importa del MOTOR, no de la capa cliente: es la que corre de verdad en
# `call_llm_tools`. Testear una copia local dejaría el test verde mientras producción hace otra cosa.
from backend.agent.agent_activities import componer_system_extra
from perfil_negocio_prompt import bloque_de_contexto
from presupuesto_store import dos_decimales, workflow_id_de_factura


# --- guard 1: el id con el que se cruza `facturado` ---------------------------

def test_el_workflow_id_del_presupuesto_es_EL_MISMO_que_construye_web():
    """🔴 EL guard que evita un `facturado: false` eterno y mudo.

    `afip_comprobantes.workflow_id` guarda `workflow.info().workflow_id`, que es
    `factura-{cliente_id}-{factura_id}` — NO el `factura_id` corto que ve el front. Cruzar por el id
    corto no da error: simplemente no encuentra nada, y todo presupuesto facturado se vería como no
    facturado para siempre.

    Este assert ata las dos construcciones: si alguien cambia el formato en `web._wf_id_factura`,
    esto falla acá en vez de degradar la app en producción."""
    assert workflow_id_de_factura("cid-A", "abc123") == web_module._wf_id_factura("cid-A", "abc123")


def test_el_sql_de_facturado_arma_ese_mismo_id():
    """El cruce vive en SQL (no puede llamar a la función Python), así que el formato está escrito dos
    veces. Este test verifica que la CONCATENACIÓN del SQL coincide con la función — es lo que
    convierte una duplicación silenciosa en una duplicación vigilada."""
    sql = presupuesto_store._DERIVADOS
    assert "'factura-' || p.cliente_id::text || '-' || p.factura_id" in sql
    # y que la función produzca exactamente esa forma
    assert workflow_id_de_factura("X", "Y") == "factura-X-Y"


def test_facturado_cruza_contra_el_comprobante_real_no_contra_el_borrador():
    """`facturado` tiene que mirar `afip_comprobantes` (donde hay CAE), no `factura_id` (que es sólo
    el borrador). Si mirara el borrador, un presupuesto cuya factura el usuario canceló quedaría
    marcado como facturado para siempre."""
    sql = presupuesto_store._DERIVADOS
    assert "afip_comprobantes" in sql
    assert "AS facturado" in sql


def test_reemplazado_por_se_calcula_en_sql_no_en_el_cliente():
    """Se calcula acá porque del lado del cliente sólo sería correcto si toda la cadena de reemplazos
    entrara en la página pedida (hallazgo de la sesión frontend). Con `limit`, no está garantizado."""
    assert "AS reemplazado_por" in presupuesto_store._DERIVADOS


# --- guard 2: el formato de los montos ----------------------------------------

def test_los_montos_salen_SIEMPRE_con_dos_decimales():
    """El contrato promete `"45000.00"`, nunca `"45000"`: el cliente formatea el string sin
    convertirlo a número, porque el float de JS pierde precisión y un centavo en un presupuesto que
    después se factura es un problema fiscal."""
    assert dos_decimales(45000) == "45000.00"
    assert dos_decimales("45000") == "45000.00"
    assert dos_decimales(Decimal("45000.5")) == "45000.50"
    assert dos_decimales(None) == "0.00"
    assert dos_decimales(Decimal("0.1") + Decimal("0.2")) == "0.30"


# --- el bloque de contexto del perfil -----------------------------------------

def test_sin_perfil_el_bloque_es_VACIO_no_un_texto_generico():
    """Un tenant sin perfil tiene que comportarse EXACTAMENTE como antes de que este frente
    existiera. Un texto de relleno cambiaría el prompt de todos los que nunca entraron a Ajustes —que
    hoy son todos— y es justo lo que el A/B del soul tiene que poder aislar."""
    assert bloque_de_contexto(None) == ""
    assert bloque_de_contexto({}) == ""


def test_el_bloque_solo_menciona_lo_que_el_usuario_cargo():
    perfil = {"nombre_comercial": "Electricidad Pérez", "que_vende": "", "a_quien": "",
              "horario_atencion": "", "formalidad": "", "largo_respuesta": "", "nombre_copiloto": ""}
    bloque = bloque_de_contexto(perfil)
    assert "Electricidad Pérez" in bloque
    assert "Horario" not in bloque          # no inventa lo que no cargó


def test_el_horario_se_traduce_a_una_INSTRUCCION_no_a_un_dato_suelto():
    """Poner "Horario: 8 a 17" no cambia el comportamiento — el modelo puede igual proponer un
    domingo. El campo justifica su lugar sólo si dice qué hacer con él."""
    bloque = bloque_de_contexto({"horario_atencion": "Lunes a viernes de 8 a 17"})
    assert "No propongas" in bloque


def test_el_perfil_va_ANTES_que_la_memoria_en_el_system_extra():
    """🔴 El orden es la razón de que `componer_system_extra` exista.

    El perfil es ESTABLE y la memoria VARÍA por turno. Con lo estable primero, el prefijo del prompt
    queda cacheable; invertido se invalida el cache en cada turno. No rompe nada visible — sólo se
    nota en la factura del LLM, que es ~95% del COGS."""
    salida = componer_system_extra("PERFIL", "MEMORIA-DEL-TURNO")
    assert salida.index("PERFIL") < salida.index("MEMORIA-DEL-TURNO")


def test_componer_no_deja_separadores_colgando_si_falta_una_parte():
    assert componer_system_extra("", "MEMORIA") == "MEMORIA"
    assert componer_system_extra("PERFIL", "") == "PERFIL"
    assert componer_system_extra("", "") == ""
    assert componer_system_extra("  ", "MEMORIA") == "MEMORIA"
