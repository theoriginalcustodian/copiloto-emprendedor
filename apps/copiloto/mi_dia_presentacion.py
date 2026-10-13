"""Qué significa cada tarjeta de «Mi día» EN PANTALLA, derivado de su `regla` (PROTO4DEPS §3).

Hermano de `mi_dia_clasificacion.py` y con el mismo criterio: función pura sobre el conjunto CERRADO de
reglas, sin columna ni migración, calculada al leer — una tarjeta ya persistida sale con su
`presentacion` sin backfill. El detector sabe *qué dispara*; la clasificación, *cómo se agrupa y se
urge*; esto, *qué se dice y a dónde lleva*.

## Por qué vive acá y no en la app

Si la app mapeara `regla → layout`, cada regla nueva saldría a producción muda o mal pintada y nadie se
enteraría: el agujero vive en el par, no en ninguno de los dos lados. El backend emite SEMÁNTICA (un
chip con tono, filas clave/valor ya rotuladas, una acción con `destino` de enum cerrado); la app pinta
y rutea. Una regla sin entrada en `_PRESENTADORES` rompe `test_mi_dia_presentacion.py` en vez de salir
muda, y `REGLAS_CONOCIDAS` (de `mi_dia_clasificacion`) sigue siendo la única lista de reglas.

## Forma

    {"chip":   {"texto": "47 días sin respuesta", "tono": "pronto"},        # opcional
     "kv":     [{"k": "Saldo", "v": "$84.000"}, {"k": "Emitida", "v": "12/09"}],   # opcional
     "accion": {"texto": "Reclamar el pago",
                "destino": {"tipo": "comprobante", "id": "412"}}}           # sólo reglas con verbo

* `tono` reusa `criticidad` (`critico|pronto|sin_plazo`): no hay una tercera escala.
* `accion.destino.tipo` es un ENUM CERRADO (`TIPOS_DESTINO_ACCION`), extensión del `destino` de H5b. La app
  trata un `tipo` desconocido como «rótulo sin acción»; por eso agregar uno exige enmendar el contrato.
* Regla sin verbo (`gasto_del_mes_alto`), tarjeta manual o regla desconocida NO llevan `accion`; las dos
  últimas ni siquiera llevan `presentacion` (`None`).
* Nada se fabrica: una fila o un chip sólo existe si el dato que lo sostiene está en `datos`. Una tarjeta
  vieja sin fecha sale sin esa fila, no con una fecha inventada.

## Los alias `monto`/`fecha`

El core lee `datos.monto` y `datos.fecha` (`packages/core/src/api/miDia.ts`) y ninguna regla los
escribía (H12/DETALLEKV): las filas del detalle estaban cerradas en código e inalcanzables. `alias`
devuelve esas dos claves, ya resueltas por regla, para completarlas al leer — así la costura que ya está
en producción empieza a recibir dato sin esperar a que la app lea `presentacion`.
"""
from __future__ import annotations

import datetime
from decimal import Decimal, InvalidOperation

from catalog import TIPO_DESTINO_CONEXION, destino_conexion
from mi_dia_clasificacion import clasificar

TIPO_DESTINO_COMPROBANTE = "comprobante"
TIPO_DESTINO_PRESUPUESTO = "presupuesto"
TIPO_DESTINO_TRABAJO = "trabajo"
TIPO_DESTINO_CERTIFICADO = "certificado"

#: ENUM CERRADO de `accion.destino.tipo`. Un valor nuevo exige enmendar el contrato (ver docstring).
TIPOS_DESTINO_ACCION = (TIPO_DESTINO_CONEXION, TIPO_DESTINO_COMPROBANTE, TIPO_DESTINO_PRESUPUESTO,
                        TIPO_DESTINO_TRABAJO, TIPO_DESTINO_CERTIFICADO)


# ── formato ─────────────────────────────────────────────────────────────────────────────────────

def _fecha(v) -> datetime.date | None:
    """`date` de un ISO (`2026-09-12`, `2026-09-12T10:30:00+00:00` o `2026-09-12 10:30:00`), o `None`."""
    if isinstance(v, datetime.datetime):
        return v.date()
    if isinstance(v, datetime.date):
        return v
    if isinstance(v, str) and len(v) >= 10:
        try:
            return datetime.date.fromisoformat(v[:10])
        except ValueError:
            # Fecha ilegible: degradar a «sin fecha» es lo correcto -- el presentador OMITE el chip o la
            # fila que dependía de ella (`None` ≠ `0 días`), no inventa una antigüedad ni rompe el feed.
            return None
    return None


def _dd_mm(d: datetime.date, hoy: datetime.date) -> str:
    """`12/09` dentro del año en curso, `12/09/2025` fuera de él."""
    return d.strftime("%d/%m") if d.year == hoy.year else d.strftime("%d/%m/%Y")


def _pesos(v) -> str | None:
    """`84000` → `$84.000`, `1250.5` → `$1.250,50`, `-300` → `-$300`. `None` si no es un número."""
    if v is None or v == "":
        return None
    try:
        n = Decimal(str(v))
    except (InvalidOperation, ValueError):
        # No es un número: sin monto. El presentador omite la fila; formatear `$0` afirmaría un saldo
        # que nadie calculó (hay un test que lo ancla).
        return None
    if not n.is_finite():
        return None
    cuerpo = f"{abs(n):,.0f}" if n == n.to_integral_value() else f"{abs(n):,.2f}"
    cuerpo = cuerpo.replace(",", "X").replace(".", ",").replace("X", ".")
    return f"-${cuerpo}" if n < 0 else f"${cuerpo}"


def _dias(n: int) -> str:
    return "1 día" if n == 1 else f"{n} días"


def _entero(v) -> int | None:
    try:
        return int(v) if v is not None and not isinstance(v, bool) else None
    except (TypeError, ValueError):
        # No es entero: `None` = «no sé cuántos días», y el chip de días no se emite (mismo criterio
        # que `_fecha`/`_pesos`: ausencia explícita antes que un número inventado).
        return None


def _transcurridos(creada, hoy: datetime.date) -> int:
    """Días entre que se sacó la foto de `datos` (`creada_en`; `crear_si_no_existe` es DO NOTHING, así
    que `datos` NO se refresca) y hoy. Un `dias` guardado envejece con la tarjeta; sin esto el chip diría
    «hace 47 días» cuando ya son 60. Aproximación de ±1 día (zona horaria del instante de creación)."""
    d = _fecha(creada)
    return max(0, (hoy - d).days) if d else 0


def _chip(texto: str, regla: str) -> dict:
    return {"texto": texto, "tono": clasificar(regla)["criticidad"]}


def _kv(*filas) -> list[dict]:
    return [{"k": k, "v": v} for k, v in filas if v]


# ── un presentador por regla: (datos, entidad_id, creada, hoy) → (chip, kv, alias) ───────────────

def _facturas_impagas_viejas(datos, entidad_id, creada, hoy):
    emision = _fecha(datos.get("fecha_emision"))
    dias = (hoy - emision).days if emision else None
    if dias is None and _entero(datos.get("dias")) is not None:
        dias = _entero(datos["dias"]) + _transcurridos(creada, hoy)
    chip = (_chip(f"Emitida hace {_dias(dias)}", "facturas_impagas_viejas")
            if dias is not None and dias >= 0 else None)
    saldo = _pesos(datos.get("saldo"))
    fecha = _dd_mm(emision, hoy) if emision else None
    alias = {**({"monto": str(datos["saldo"])} if saldo else {}),
             **({"fecha": fecha} if fecha else {})}
    return chip, _kv(("Saldo", saldo), ("Emitida", fecha)), alias


def _presupuestos_enfriandose(datos, entidad_id, creada, hoy):
    fecha_p = _fecha(datos.get("fecha"))
    dias = (hoy - fecha_p).days if fecha_p else None
    chip = (_chip(f"{_dias(dias)} sin respuesta", "presupuestos_enfriandose")
            if dias is not None and dias >= 0 else None)
    total = _pesos(datos.get("total"))
    fecha = _dd_mm(fecha_p, hoy) if fecha_p else None
    alias = {**({"monto": str(datos["total"])} if total else {}),
             **({"fecha": fecha} if fecha else {})}
    return chip, _kv(("Total", total), ("Fecha", fecha)), alias


def _por_vencer(datos, clave_fecha, creada, hoy):
    """Días que faltan para un vencimiento: por la FECHA absoluta si está; si no, el `dias` de la foto
    menos lo transcurrido. Devuelve `(dias_o_None, fecha_o_None)`."""
    venc = _fecha(datos.get(clave_fecha))
    if venc:
        return (venc - hoy).days, venc
    snap = _entero(datos.get("dias"))
    return (None if snap is None else snap - _transcurridos(creada, hoy)), None


def _vence_texto(n: int | None, sujeto: str) -> str | None:
    if n is None:
        return None
    if n < 0:
        return f"{sujeto} vencido"
    return f"{sujeto} vence hoy" if n == 0 else f"{sujeto} vence en {_dias(n)}"


def _cae_por_vencer(datos, entidad_id, creada, hoy):
    n, venc = _por_vencer(datos, "cae_vto", creada, hoy)
    texto = _vence_texto(n, "CAE")
    fecha = _dd_mm(venc, hoy) if venc else None
    return (_chip(texto, "cae_por_vencer") if texto else None,
            _kv(("Vence", fecha)), {"fecha": fecha} if fecha else {})


def _certificado_afip_por_vencer(datos, entidad_id, creada, hoy):
    n, venc = _por_vencer(datos, "vence_at", creada, hoy)
    if datos.get("ilegible"):
        texto = "No se pudo leer el certificado"
    elif datos.get("vencido"):
        texto = "Certificado vencido"
    else:
        texto = _vence_texto(n, "Certificado")
    fecha = _dd_mm(venc, hoy) if venc else None
    filas = _kv(("Vence", fecha), ("CUIT", datos.get("cuit")), ("Ambiente", datos.get("ambiente")))
    return (_chip(texto, "certificado_afip_por_vencer") if texto else None,
            filas, {"fecha": fecha} if fecha else {})


def _trabajo_con_margen_negativo(datos, entidad_id, creada, hoy):
    return None, _kv(("Cobrado", _pesos(datos.get("cobrado"))), ("Gastado", _pesos(datos.get("gastado"))),
                     ("Margen", _pesos(datos.get("margen")))), {}


def _trabajo_con_gastos_y_sin_ingreso(datos, entidad_id, creada, hoy):
    snap = _entero(datos.get("dias"))
    dias = None if snap is None else snap + _transcurridos(creada, hoy)
    chip = (_chip(f"{_dias(dias)} sin movimiento", "trabajo_con_gastos_y_sin_ingreso")
            if dias is not None else None)
    return chip, _kv(("Gastado", _pesos(datos.get("gastado")))), {}


def _gasto_del_mes_alto(datos, entidad_id, creada, hoy):
    return None, _kv(("Este mes", _pesos(datos.get("gasto_actual"))),
                     ("Mes anterior", _pesos(datos.get("gasto_anterior")))), {}


def _conexion_caida(datos, entidad_id, creada, hoy):
    return None, _kv(("Servicio", datos.get("nombre"))), {}


#: regla → (tipo del `accion.destino` o `None` si la regla no lleva acción, presentador).
#: Mismas claves que `REGLAS_CONOCIDAS` (lo exige el test): una regla nueva sin entrada rompe, no sale muda.
_PRESENTADORES = {
    "facturas_impagas_viejas":          (TIPO_DESTINO_COMPROBANTE, _facturas_impagas_viejas),
    "presupuestos_enfriandose":         (TIPO_DESTINO_PRESUPUESTO, _presupuestos_enfriandose),
    "cae_por_vencer":                   (TIPO_DESTINO_COMPROBANTE, _cae_por_vencer),
    "certificado_afip_por_vencer":      (TIPO_DESTINO_CERTIFICADO, _certificado_afip_por_vencer),
    "trabajo_con_margen_negativo":      (TIPO_DESTINO_TRABAJO, _trabajo_con_margen_negativo),
    "trabajo_con_gastos_y_sin_ingreso": (TIPO_DESTINO_TRABAJO, _trabajo_con_gastos_y_sin_ingreso),
    "gasto_del_mes_alto":               (None, _gasto_del_mes_alto),
    "conexion_caida":                   (TIPO_DESTINO_CONEXION, _conexion_caida),
}


def _destino(tipo: str, entidad_id) -> dict:
    if tipo == TIPO_DESTINO_CONEXION:
        return destino_conexion(str(entidad_id))   # `connect_path` copiado del catálogo, no armado acá
    return {"tipo": tipo, "id": str(entidad_id)}


def _calcular(regla, entidad_id, datos, creada, hoy):
    if regla not in _PRESENTADORES:
        return None
    datos = datos if isinstance(datos, dict) else {}
    hoy = hoy or datetime.date.today()
    tipo, presentador = _PRESENTADORES[regla]
    chip, kv, alias = presentador(datos, entidad_id, creada, hoy)
    bloque: dict = {}
    if chip:
        bloque["chip"] = chip
    if kv:
        bloque["kv"] = kv
    verbo = clasificar(regla)["verbo"]
    if tipo is not None and verbo and entidad_id not in (None, ""):
        bloque["accion"] = {"texto": verbo, "destino": _destino(tipo, entidad_id)}
    return bloque or None, alias


def presentar(regla: str | None, entidad_id, datos, creada=None, hoy: datetime.date | None = None) -> dict | None:
    """El bloque `presentacion` de la tarjeta, o `None` (manual, regla desconocida, o nada que decir)."""
    r = _calcular(regla, entidad_id, datos, creada, hoy)
    return r[0] if r else None


def alias_datos(regla: str | None, entidad_id, datos, creada=None, hoy: datetime.date | None = None) -> dict:
    """`{monto?, fecha?}` ya resueltos por regla, para completar `datos` al leer (ver docstring)."""
    r = _calcular(regla, entidad_id, datos, creada, hoy)
    return r[1] if r else {}
