"""K-06 (BL-J5): categoría/criticidad/verbo por regla — la tabla acordada en el contrato, fijada."""
from __future__ import annotations

import inspect

import mi_dia_clasificacion as clas
import mi_dia_detector as det
import mi_dia_tarjeta_store as store

TABLA = {
    det.REGLA_CERTIFICADO_POR_VENCER:  ("arca", "critico", "Renovarlo"),
    det.REGLA_CAE_POR_VENCER:          ("arca", "pronto", "Revisarla"),
    det.REGLA_FACTURAS_IMPAGAS_VIEJAS: ("cobros", "pronto", "Reclamar el pago"),
    det.REGLA_PRESUPUESTOS_ENFRIANDOSE: ("presupuestos", "pronto", "Mandarle un recordatorio"),
    det.REGLA_TRABAJO_MARGEN_NEGATIVO: (None, "pronto", "Revisar el trabajo"),
    det.REGLA_TRABAJO_SIN_INGRESO:     (None, "pronto", "¿Te lo pagaron?"),
    det.REGLA_GASTO_MES_ALTO:          (None, "sin_plazo", None),
}


def _t(regla):
    r = clas.clasificar(regla)
    return r["categoria"], r["criticidad"], r["verbo"]


def test_las_7_reglas_del_detector_dan_exactamente_la_tabla_acordada():
    for regla, esperado in TABLA.items():
        assert _t(regla) == esperado, regla


def test_toda_regla_del_detector_tiene_entrada_y_no_sobra_ninguna():
    reglas_detector = {v for k, v in vars(det).items() if k.startswith("REGLA_") and isinstance(v, str)}
    assert reglas_detector == set(TABLA) == set(clas.REGLAS_CONOCIDAS)


def test_tarjeta_manual_es_tuyas_sin_plazo_y_se_borra():
    assert _t(None) == ("tuyas", "sin_plazo", "Borrar")


def test_regla_futura_sin_entrada_nunca_inventa_critico():
    assert _t("regla_que_todavia_no_existe") == (None, "sin_plazo", None)


def test_el_unico_critico_es_el_certificado():
    criticos = [r for r in TABLA if _t(r)[1] == "critico"]
    assert criticos == [det.REGLA_CERTIFICADO_POR_VENCER]


def test_toda_tarjeta_que_sale_del_store_lleva_los_3_campos_y_conserva_los_viejos():
    import datetime
    ahora = datetime.datetime(2026, 9, 21, tzinfo=datetime.timezone.utc)
    fila = (42, det.REGLA_CERTIFICADO_POR_VENCER, "certificado", "x", "texto", "para_hoy", {}, ahora, None)
    d = store._fila_a_dict(fila)
    assert (d["categoria"], d["criticidad"], d["verbo"]) == ("arca", "critico", "Renovarlo")
    assert {"id", "regla", "entidad_tipo", "entidad_id", "texto", "estado", "datos",
            "creada_en", "movida_en"} <= set(d)              # compat: la forma vieja sigue entera
    manual = store._fila_a_dict((43, None, None, None, "anoté", "para_hoy", None, ahora, None))
    assert (manual["categoria"], manual["verbo"]) == ("tuyas", "Borrar")
