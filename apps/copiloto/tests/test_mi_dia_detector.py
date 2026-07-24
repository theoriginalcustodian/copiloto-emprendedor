"""Detector proactivo (hito 7) — la mitad PURA de las reglas: datos fijos, mismo resultado siempre.

Contrato §5 (DoD): "Las reglas corren con datos fijos y dan siempre lo mismo — test propio, sin
LLM." Por diseño (`mi_dia_detector.py`, docstring del módulo) `_evaluar_*` no toca la DB — estos tests
no abren conexión ni necesitan el VPS.
"""
from __future__ import annotations

from decimal import Decimal

import mi_dia_detector as detector


# ── presupuestos_enfriandose ────────────────────────────────────────────────────────────────────

def test_presupuesto_pendiente_y_sin_respuesta_dispara():
    presupuestos = [{"id": 1, "estado": "pendiente", "sin_respuesta": True, "total": "50000.00",
                     "numero": "0001-00001", "receptor_nombre": "Panadería SRL"}]
    salida = detector._evaluar_presupuestos_enfriandose(presupuestos)
    assert len(salida) == 1
    assert salida[0]["regla"] == detector.REGLA_PRESUPUESTOS_ENFRIANDOSE
    assert salida[0]["entidad_tipo"] == "presupuesto"
    assert salida[0]["entidad_id"] == 1
    assert salida[0]["dias_silencio"] == 14


def test_presupuesto_pendiente_pero_CON_respuesta_no_dispara():
    """`sin_respuesta` ya viene calculado del SQL del hito 6 — la regla confía en ese campo, no
    recalcula los 30 días."""
    presupuestos = [{"id": 1, "estado": "pendiente", "sin_respuesta": False, "total": "50000.00"}]
    assert detector._evaluar_presupuestos_enfriandose(presupuestos) == []


def test_presupuesto_aprobado_no_dispara_aunque_diga_sin_respuesta():
    """`sin_respuesta` es un matiz de "pendiente" — un aprobado nunca debería traerlo en `True`, pero
    la regla no confía ciegamente: filtra por estado explícitamente."""
    presupuestos = [{"id": 1, "estado": "aprobado", "sin_respuesta": True, "total": "50000.00"}]
    assert detector._evaluar_presupuestos_enfriandose(presupuestos) == []


def test_presupuesto_bajo_el_umbral_no_dispara(monkeypatch):
    monkeypatch.setattr(detector, "UMBRAL_PRESUPUESTO_ENFRIANDOSE", Decimal("100000"))
    presupuestos = [{"id": 1, "estado": "pendiente", "sin_respuesta": True, "total": "50000.00"}]
    assert detector._evaluar_presupuestos_enfriandose(presupuestos) == []


# ── facturas_impagas_viejas ─────────────────────────────────────────────────────────────────────

def test_factura_vieja_dispara():
    impagos = {"comprobantes": [{"id": 7, "nro": "0001-00042", "receptor_nombre": "Kiosco",
                                 "saldo": "1000.00", "dias": detector.DIAS_FACTURA_VENCIDA + 1}]}
    salida = detector._evaluar_facturas_impagas_viejas(impagos)
    assert len(salida) == 1
    assert salida[0]["regla"] == detector.REGLA_FACTURAS_IMPAGAS_VIEJAS
    assert salida[0]["entidad_id"] == 7


def test_factura_reciente_no_dispara():
    impagos = {"comprobantes": [{"id": 7, "dias": detector.DIAS_FACTURA_VENCIDA - 1}]}
    assert detector._evaluar_facturas_impagas_viejas(impagos) == []


def test_sin_comprobantes_impagos_no_dispara_nada():
    assert detector._evaluar_facturas_impagas_viejas({"comprobantes": []}) == []


# ── trabajo_con_margen_negativo ─────────────────────────────────────────────────────────────────

def test_trabajo_con_margen_negativo_dispara_y_no_se_repite():
    trabajos = [{"eslabon": "presupuesto", "ref": 5, "etiqueta": "Panadería SRL · 2026-07-01",
                "cobrado": "10000.00", "gastado": "18000.00", "margen": "-8000.00"}]
    salida = detector._evaluar_trabajo_margen_negativo(trabajos)
    assert len(salida) == 1
    assert salida[0]["regla"] == detector.REGLA_TRABAJO_MARGEN_NEGATIVO
    assert salida[0]["entidad_id"] == "presupuesto:5"
    # 🔴 "no se repite" (contrato §1.bis) = silencio para siempre, no un número de días.
    assert salida[0]["dias_silencio"] is None


def test_trabajo_con_margen_positivo_no_dispara():
    trabajos = [{"eslabon": "presupuesto", "ref": 5, "margen": "8000.00",
                "cobrado": "18000.00", "gastado": "10000.00"}]
    assert detector._evaluar_trabajo_margen_negativo(trabajos) == []


def test_trabajo_con_margen_exactamente_cero_no_dispara():
    """`< 0`, no `<= 0` (contrato §1.bis) — un trabajo que empató no "dejó plata en contra"."""
    trabajos = [{"eslabon": "presupuesto", "ref": 5, "margen": "0.00",
                "cobrado": "10000.00", "gastado": "10000.00"}]
    assert detector._evaluar_trabajo_margen_negativo(trabajos) == []


def test_datos_fijos_dan_siempre_el_mismo_resultado():
    """El DoD lo pide explícito: correr la misma regla dos veces con los mismos datos no puede
    variar (nada de `datetime.now()`, `random`, ni orden de dict no determinista en la salida)."""
    trabajos = [{"eslabon": "cobro", "ref": 9, "margen": "-500.00", "cobrado": "100", "gastado": "600"}]
    assert (detector._evaluar_trabajo_margen_negativo(trabajos)
            == detector._evaluar_trabajo_margen_negativo(trabajos))


# ── AvisosEmitidosStore — guards estructurales (sin DB, igual que test_presupuesto_derivados.py) ──

def test_emitir_usa_on_conflict_sobre_el_indice_de_idempotencia():
    """Sin `ON CONFLICT` sobre `(cliente_id, regla, entidad_tipo, entidad_id)`, el mismo candidato
    detectado dos días seguidos duplicaría la fila en vez de refrescar el silencio — el mismo bug de
    "if ya existe, devolvelo" que ya se pagó con cobros duplicados (memoria:
    idempotencia-con-un-if-tiene-ventana)."""
    import inspect
    fuente = inspect.getsource(detector.AvisosEmitidosStore.emitir)
    assert "ON CONFLICT" in fuente
    assert "cliente_id, regla, entidad_tipo, entidad_id" in fuente


def test_silencio_para_siempre_es_muy_futuro_y_naive_no_se_cuela():
    assert detector.SILENCIO_PARA_SIEMPRE.year == 9999
    assert detector.SILENCIO_PARA_SIEMPRE.tzinfo is not None


# ── trabajo_con_gastos_y_sin_ingreso ────────────────────────────────────────────────────────────

def test_trabajo_sin_ingreso_dispara_pasado_el_umbral():
    trabajos = [{"eslabon": "presupuesto", "ref": 3, "etiqueta": "Panadería SRL · 2026-06-01",
                "gastado": "42000.00", "dias_desde_ultimo_movimiento": detector.DIAS_TRABAJO_SIN_INGRESO + 1}]
    salida = detector._evaluar_trabajo_sin_ingreso(trabajos)
    assert len(salida) == 1
    assert salida[0]["regla"] == detector.REGLA_TRABAJO_SIN_INGRESO
    assert salida[0]["entidad_id"] == "presupuesto:3"
    assert salida[0]["dias_silencio"] == 14


def test_trabajo_EN_CURSO_no_dispara_aunque_sea_viejo():
    """🔴 La trampa del contrato (§1.bis): un trabajo con movimiento RECIENTE no es "impago", está en
    curso. `dias_desde_ultimo_movimiento` bajo el umbral (aunque el trabajo haya arrancado hace
    meses) tiene que ganarle a cualquier otra señal."""
    trabajos = [{"eslabon": "presupuesto", "ref": 3, "gastado": "42000.00",
                "dias_desde_ultimo_movimiento": detector.DIAS_TRABAJO_SIN_INGRESO - 1}]
    assert detector._evaluar_trabajo_sin_ingreso(trabajos) == []


def test_trabajo_exactamente_en_el_umbral_no_dispara():
    trabajos = [{"eslabon": "presupuesto", "ref": 3, "gastado": "1",
                "dias_desde_ultimo_movimiento": detector.DIAS_TRABAJO_SIN_INGRESO}]
    assert detector._evaluar_trabajo_sin_ingreso(trabajos) == []


def test_trabajo_sin_fecha_de_movimiento_no_dispara():
    """Sin `dias_desde_ultimo_movimiento` (caso degenerado, ni cobro ni gasto con fecha) no hay forma
    de distinguir "viejo" de "recién empezado" — no se arriesga un aviso equivocado (contrato §0)."""
    trabajos = [{"eslabon": "presupuesto", "ref": 3, "gastado": "1", "dias_desde_ultimo_movimiento": None}]
    assert detector._evaluar_trabajo_sin_ingreso(trabajos) == []


def test_trabajo_sin_ingreso_esta_en_reglas_auto_cierre():
    """DoD (contrato §5): "la tarjeta de `trabajo_con_gastos_y_sin_ingreso` se cierra sola al
    registrar el ingreso" — eso es exactamente "el trabajo deja de aparecer en `sin_ingreso`"."""
    assert detector.REGLA_TRABAJO_SIN_INGRESO in detector.REGLAS_AUTO_CIERRE


def test_margen_negativo_no_esta_en_auto_cierre_pero_sin_ingreso_si():
    assert detector.REGLAS_AUTO_CIERRE == (
        detector.REGLA_PRESUPUESTOS_ENFRIANDOSE, detector.REGLA_FACTURAS_IMPAGAS_VIEJAS,
        detector.REGLA_TRABAJO_SIN_INGRESO,
    )
    assert detector.REGLA_TRABAJO_MARGEN_NEGATIVO not in detector.REGLAS_AUTO_CIERRE


def test_detectar_todos_pide_margen_por_trabajo_UNA_sola_vez():
    """Antes tenía dos funciones `_candidatos_*` distintas, cada una llamando a
    `InteligenciaQueries.margen_por_trabajo()` por su cuenta — dos recorridos completos de TODOS los
    trabajos del tenant en cada corrida del detector. `_candidatos_margen_por_trabajo` comparte el
    resultado entre las dos reglas que lo usan; este guard (fuente, sin DB) cazaría el regreso a la
    duplicación si alguien vuelve a llamar `margen_por_trabajo()` dos veces en `detectar_todos`."""
    import inspect
    fuente = inspect.getsource(detector.detectar_todos)
    assert fuente.count("_candidatos_margen_por_trabajo(") == 1  # una sola invocación de la query cara
