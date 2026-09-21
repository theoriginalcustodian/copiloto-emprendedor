"""Categoría, criticidad y verbo de una tarjeta de «Mi día», derivados de su `regla` (K-06, BL-J5).

Función pura sobre un conjunto CERRADO de reglas: no hay columna ni migración, se calcula al leer, así
que una tarjeta vieja ya persistida sale con los tres campos sin backfill. Vive acá y no dentro del
detector porque el detector sólo sabe *qué dispara*; esto es cómo se PRESENTA (agrupar, urgir, accionar).

Las claves son los strings de `mi_dia_detector.REGLA_*` (no se importan: el detector arrastra los
stores de AFIP/cobros y este módulo lo lee el store liviano de tarjetas). Que las claves coincidan con
las del detector lo fija `test_mi_dia_clasificacion.py`, así una regla nueva sin entrada rompe un test
en vez de salir muda.

Regla sin entrada (o futura) → `categoria`/`verbo` `None` y `criticidad` `"sin_plazo"`: nunca se
inventa un `"critico"` por default (un banner de «esto rompe tu negocio» falso es peor que ninguno).
"""
from __future__ import annotations

CRITICO, PRONTO, SIN_PLAZO = "critico", "pronto", "sin_plazo"
COBROS, ARCA, PRESUPUESTOS, TUYAS = "cobros", "arca", "presupuestos", "tuyas"

# regla -> (categoria, criticidad, verbo). `categoria None` = sólo visible en «Todo».
_POR_REGLA: dict[str, tuple[str | None, str, str | None]] = {
    "certificado_afip_por_vencer":       (ARCA, CRITICO, "Renovarlo"),
    "cae_por_vencer":                    (ARCA, PRONTO, "Revisarla"),
    "facturas_impagas_viejas":           (COBROS, PRONTO, "Reclamar el pago"),
    "presupuestos_enfriandose":          (PRESUPUESTOS, PRONTO, "Mandarle un recordatorio"),
    "trabajo_con_margen_negativo":       (None, PRONTO, "Revisar el trabajo"),
    "trabajo_con_gastos_y_sin_ingreso":  (None, PRONTO, "¿Te lo pagaron?"),
    "gasto_del_mes_alto":                (None, SIN_PLAZO, None),
}
# Tarjeta manual (`regla is None`): la anotó el emprendedor.
_MANUAL = (TUYAS, SIN_PLAZO, "Borrar")
_DESCONOCIDA = (None, SIN_PLAZO, None)

REGLAS_CONOCIDAS = frozenset(_POR_REGLA)


def clasificar(regla: str | None) -> dict:
    categoria, criticidad, verbo = _MANUAL if regla is None else _POR_REGLA.get(regla, _DESCONOCIDA)
    return {"categoria": categoria, "criticidad": criticidad, "verbo": verbo}
