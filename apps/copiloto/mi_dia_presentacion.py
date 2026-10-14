"""Qué significa cada tarjeta de «Mi día» EN PANTALLA, derivado de su `regla` (PROTO4DEPS §3 + H12).

Hermano de `mi_dia_clasificacion.py` y con el mismo criterio: función pura sobre el conjunto CERRADO de
reglas, sin columna ni migración, calculada al leer — una tarjeta ya persistida sale con su
`presentacion` sin backfill. El detector sabe *qué dispara*; la clasificación, *cómo se agrupa y se
urge*; esto, *qué se dice y a dónde lleva*.

## Por qué vive acá y no en la app

Si la app mapeara `regla → layout`, cada regla nueva saldría a producción muda o mal pintada y nadie se
enteraría: el agujero vive en el par, no en ninguno de los dos lados. El backend emite SEMÁNTICA (un
chip con tono, una prosa, filas clave/valor ya rotuladas y formateadas, una acción con `destino` de enum
cerrado); la app pinta y rutea. Una regla sin entrada en `_PRESENTADORES` rompe `test_mi_dia_presentacion.py`
en vez de salir muda, y `REGLAS_CONOCIDAS` (de `mi_dia_clasificacion`) sigue siendo la única lista de reglas.

## Forma

    {"chip":   {"texto": "47 días sin respuesta", "tono": "pronto"},                    # opcional
     "prosa":  "Emitida hace 31 días. Son $84.000 que ya facturaste y todavía no entraron.",   # opcional
     "kv":     [{"k": "Factura", "v": "0001-00000007"}, {"k": "Emitida", "v": "12 de septiembre"}],
     "accion": {"texto": "Reclamar el pago",
                "destino": {"tipo": "comprobante", "id": "412"}}}                     # sólo reglas con verbo

* `kv` va con `{k, v}` (lo que lee el parser del core), YA formateado: importe con `$` y miles, fecha en
  texto. Mandar el valor crudo obligaría a la app a tener la tabla regla→formato que esto existe para evitar.
* **La prosa y las kv se entregan JUNTAS** (contrato H12 §3): en la pantalla del prototipo el importe de una
  factura impaga vive en la prosa, no en una kv. Cada presentador las arma del mismo `datos`.
* `tono` reusa `criticidad` (`critico|pronto|sin_plazo`): no hay una tercera escala.
* `accion.destino.tipo` es un ENUM CERRADO (`TIPOS_DESTINO_ACCION`), extensión del `destino` de H5b. La app
  trata un `tipo` desconocido como «rótulo sin acción»; por eso agregar uno exige enmendar el contrato.
* Regla sin verbo (`gasto_del_mes_alto`) NO lleva `accion`. Una regla DESCONOCIDA no lleva `presentacion`
  (`None`); la tarjeta anotada a mano (`regla is None`) sí: «Lo anotaste vos» + la fila «Anotado».
* Nada se fabrica: una fila, un chip o una frase sólo existe si el dato que lo sostiene está en `datos`. Una
  tarjeta vieja sin fecha sale sin esa fila, no con una fecha inventada.

## Lo que el prototipo NO modela (extrapolación declarada, no medición)

* **Trabajo** (`trabajo_con_*`): ninguna superficie del prototipo lo dibuja ⇒ `kv: []` y sólo prosa. No se
  inventan rótulos.
* **CAE** («Vence» / «Detectado»): sólo la capa `#midia` del prototipo lo muestra; se extrapola de ahí.
* **Factura**: el prototipo dice «Venció»; acá es «Emitida» porque `CobroStore.impagos()` trae la fecha de
  emisión y NO la de vencimiento de pago (`fecha_vto_pago` sólo existe en el payload de facturar servicios).
"""
from __future__ import annotations

import datetime
from decimal import Decimal, InvalidOperation
from zoneinfo import ZoneInfo

from catalog import TIPO_DESTINO_CONEXION, destino_conexion
from clients.agent.datetime_resolver import DEFAULT_TZ
from mi_dia_clasificacion import clasificar

TIPO_DESTINO_COMPROBANTE = "comprobante"
TIPO_DESTINO_PRESUPUESTO = "presupuesto"
TIPO_DESTINO_TRABAJO = "trabajo"
TIPO_DESTINO_CERTIFICADO = "certificado"

#: ENUM CERRADO de `accion.destino.tipo`. Un valor nuevo exige enmendar el contrato (ver docstring).
TIPOS_DESTINO_ACCION = (TIPO_DESTINO_CONEXION, TIPO_DESTINO_COMPROBANTE, TIPO_DESTINO_PRESUPUESTO,
                        TIPO_DESTINO_TRABAJO, TIPO_DESTINO_CERTIFICADO)

_MESES = ("enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre",
          "octubre", "noviembre", "diciembre")

#: La frase fija de la tarjeta anotada a mano (prototipo `#tablero`, tercer renglón).
PROSA_ANOTADA_A_MANO = "Lo anotaste vos, así que lo cerrás vos."


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


def _en_local(instante: datetime.datetime) -> datetime.datetime:
    """El instante en la zona del producto (`DEFAULT_TZ`). Un `datetime` sin zona se toma como UTC: es lo
    que la base devuelve para un `timestamptz` sin sesión configurada."""
    if instante.tzinfo is None:
        instante = instante.replace(tzinfo=datetime.timezone.utc)
    return instante.astimezone(ZoneInfo(DEFAULT_TZ))


def _dia_local(v) -> datetime.date | None:
    """El DÍA (en zona local) de un instante. A las 22:00 de Buenos Aires el UTC ya es «mañana»: usar
    `.date()` a secas dice «Detectado» un día después de cuando fue."""
    if isinstance(v, datetime.datetime):
        return _en_local(v).date()
    return _fecha(v)


def _hoy_local() -> datetime.date:
    return datetime.datetime.now(ZoneInfo(DEFAULT_TZ)).date()


def _fecha_texto(d: datetime.date, hoy: datetime.date) -> str:
    """`12 de septiembre` dentro del año en curso, `12 de septiembre de 2025` fuera de él."""
    base = f"{d.day} de {_MESES[d.month - 1]}"
    return base if d.year == hoy.year else f"{base} de {d.year}"


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
    d = _dia_local(creada)
    return max(0, (hoy - d).days) if d else 0


def _chip(texto: str, regla: str) -> dict:
    return {"texto": texto, "tono": clasificar(regla)["criticidad"]}


def _kv(*filas) -> list[dict]:
    return [{"k": k, "v": v} for k, v in filas if v]


def _prosa(*frases) -> str | None:
    """Une las frases que SÍ tienen dato; `None` si ninguna (no se emite una prosa hueca)."""
    return " ".join(f for f in frases if f) or None


# ── un presentador por regla: (datos, entidad_id, creada, hoy) → (chip, kv, prosa) ───────────────

def _facturas_impagas_viejas(datos, entidad_id, creada, hoy):
    emision = _fecha(datos.get("fecha_emision"))
    dias = (hoy - emision).days if emision else None
    if dias is None and _entero(datos.get("dias")) is not None:
        dias = _entero(datos["dias"]) + _transcurridos(creada, hoy)
    emitida = dias is not None and dias >= 0
    saldo = _pesos(datos.get("saldo"))
    prosa = _prosa(f"Emitida hace {_dias(dias)}." if emitida else None,
                   f"Son {saldo} que ya facturaste y todavía no entraron." if saldo else None)
    kv = _kv(("Factura", datos.get("nro")),
             ("Emitida", _fecha_texto(emision, hoy) if emision else None))
    chip = _chip(f"Emitida hace {_dias(dias)}", "facturas_impagas_viejas") if emitida else None
    return chip, kv, prosa


def _presupuestos_enfriandose(datos, entidad_id, creada, hoy):
    fecha_p = _fecha(datos.get("fecha"))
    dias = (hoy - fecha_p).days if fecha_p else None
    hay_dias = dias is not None and dias >= 0
    chip = _chip(f"{_dias(dias)} sin respuesta", "presupuestos_enfriandose") if hay_dias else None
    prosa = _prosa(f"Se lo mandaste hace {_dias(dias)} y no contestó." if hay_dias else "No contestó.",
                   "Un presupuesto que se enfría rara vez se recupera solo.")
    kv = _kv(("Monto", _pesos(datos.get("total"))),
             ("Enviado", _fecha_texto(fecha_p, hoy) if fecha_p else None))
    return chip, kv, prosa


def _por_vencer(datos, clave_fecha, creada, hoy):
    """Días que faltan para un vencimiento: por la FECHA absoluta si está; si no, el `dias` de la foto
    menos lo transcurrido. Devuelve `(dias_o_None, fecha_o_None)`."""
    venc = _fecha(datos.get(clave_fecha))
    if venc:
        return (venc - hoy).days, venc
    snap = _entero(datos.get("dias"))
    return (None if snap is None else snap - _transcurridos(creada, hoy)), None


def _vence_texto(n: int | None, sujeto: str, *, vencido: str = "vencido") -> str | None:
    if n is None:
        return None
    if n < 0:
        return f"{sujeto} {vencido}"
    return f"{sujeto} vence hoy" if n == 0 else f"{sujeto} vence en {_dias(n)}"


def _cae_por_vencer(datos, entidad_id, creada, hoy):
    n, venc = _por_vencer(datos, "cae_vto", creada, hoy)
    texto = _vence_texto(n, "CAE")
    frase = _vence_texto(n, "El CAE de esta factura", vencido="está vencido")
    detectado = _dia_local(creada)
    kv = _kv(("Vence", _fecha_texto(venc, hoy) if venc else None),
             ("Detectado", _fecha_texto(detectado, hoy) if detectado else None))
    return (_chip(texto, "cae_por_vencer") if texto else None, kv, f"{frase}." if frase else None)


def _certificado_afip_por_vencer(datos, entidad_id, creada, hoy):
    n, venc = _por_vencer(datos, "vence_at", creada, hoy)
    if datos.get("ilegible"):
        texto, frase = "No se pudo leer el certificado", "No se pudo leer el certificado de ARCA"
    elif datos.get("vencido"):
        texto, frase = "Certificado vencido", "El certificado de ARCA está vencido"
    else:
        texto = _vence_texto(n, "Certificado")
        frase = _vence_texto(n, "El certificado de ARCA", vencido="está vencido")
    kv = _kv(("Vence", _fecha_texto(venc, hoy) if venc else None),
             ("CUIT", datos.get("cuit")), ("Ambiente", datos.get("ambiente")))
    return (_chip(texto, "certificado_afip_por_vencer") if texto else None, kv,
            f"{frase}." if frase else None)


def _sujeto_trabajo(datos) -> str:
    etiqueta = (datos.get("etiqueta") or "").strip()
    return f"«{etiqueta}»" if etiqueta else "Este trabajo"


def _trabajo_con_margen_negativo(datos, entidad_id, creada, hoy):
    cobrado, gastado, margen = (_pesos(datos.get(k)) for k in ("cobrado", "gastado", "margen"))
    prosa = (f"{_sujeto_trabajo(datos)}: cobraste {cobrado} y gastaste {gastado}, te queda en {margen}."
             if cobrado and gastado and margen else None)
    return None, [], prosa    # el prototipo no modela el trabajo: sin rótulos inventados (H12 §4)


def _trabajo_con_gastos_y_sin_ingreso(datos, entidad_id, creada, hoy):
    snap = _entero(datos.get("dias"))
    dias = None if snap is None else snap + _transcurridos(creada, hoy)
    chip = (_chip(f"{_dias(dias)} sin movimiento", "trabajo_con_gastos_y_sin_ingreso")
            if dias is not None else None)
    gastado = _pesos(datos.get("gastado"))
    etiqueta = (datos.get("etiqueta") or "").strip()
    en_trabajo = f" en «{etiqueta}»" if etiqueta else ""
    prosa = _prosa(f"Gastaste {gastado}{en_trabajo} y no registraste ningún ingreso." if gastado else None,
                   f"Hace {_dias(dias)} que no se mueve." if dias is not None else None)
    return chip, [], prosa


def _gasto_del_mes_alto(datos, entidad_id, creada, hoy):
    actual, anterior = _pesos(datos.get("gasto_actual")), _pesos(datos.get("gasto_anterior"))
    prosa = f"Este mes gastaste {actual}; el mes anterior, {anterior}." if actual and anterior else None
    return None, _kv(("Este mes", actual), ("Mes anterior", anterior)), prosa


def _instante(v) -> datetime.datetime | None:
    """El INSTANTE (fecha + hora) de un ISO, o `None`. Una fecha sola (`2026-09-12`) NO es un instante: dar
    «Hoy, 0:00» sería una hora fabricada, así que se degrada a «sin instante» y la fila se omite."""
    if isinstance(v, datetime.datetime):
        return v
    if isinstance(v, str) and len(v.strip()) > 10:
        try:
            return datetime.datetime.fromisoformat(v.strip().replace("Z", "+00:00"))
        except ValueError:
            return None
    return None


def _conexion_caida(datos, entidad_id, creada, hoy):
    nombre = datos.get("nombre")
    # «Se cayó» sólo si el detector trajo el instante REAL de la caída (`datos["desde"]`, hoy sólo MercadoPago).
    # Ausente ⇒ sin fila: NUNCA `creada` como sustituto — es cuándo corrió el detector, no cuándo se cayó.
    desde = _instante(datos.get("desde"))
    se_cayo = _momento_texto(desde, hoy) if desde else None
    return (None, _kv(("Servicio", nombre), ("Se cayó", se_cayo)),
            f"Se cortó la conexión con {nombre}." if nombre else None)


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


def _momento_texto(instante: datetime.datetime, hoy: datetime.date) -> str:
    """`Hoy, 19:20` · `Ayer, 19:20` · `12 de septiembre, 19:20`, en la zona del producto (`DEFAULT_TZ`).
    Un solo formato para «Anotado» y «Se cayó»: dos copias del mismo texto se desincronizan."""
    local = _en_local(instante)
    dias = (hoy - local.date()).days
    hora = local.strftime("%H:%M")
    if dias == 0:
        return f"Hoy, {hora}"
    if dias == 1:
        return f"Ayer, {hora}"
    return f"{_fecha_texto(local.date(), hoy)}, {hora}"


def _anotada_a_mano(creada, hoy: datetime.date) -> dict | None:
    """Tarjeta sin regla: «Lo anotaste vos» + UNA fila «Anotado» con el momento (`Ayer, 19:20`). Sin
    `creada_en` no hay momento que decir, y entonces tampoco hay nada que presentar."""
    if not isinstance(creada, datetime.datetime):
        return None
    return {"prosa": PROSA_ANOTADA_A_MANO, "kv": [{"k": "Anotado", "v": _momento_texto(creada, hoy)}]}


def presentar(regla: str | None, entidad_id, datos, creada=None, hoy: datetime.date | None = None) -> dict | None:
    """El bloque `presentacion` de la tarjeta, o `None` (regla desconocida o nada que decir)."""
    hoy = hoy or _hoy_local()
    if regla is None:
        return _anotada_a_mano(creada, hoy)
    if regla not in _PRESENTADORES:
        return None
    datos = datos if isinstance(datos, dict) else {}
    tipo, presentador = _PRESENTADORES[regla]
    chip, kv, prosa = presentador(datos, entidad_id, creada, hoy)
    bloque: dict = {}
    if chip:
        bloque["chip"] = chip
    if prosa:
        bloque["prosa"] = prosa
    if kv:
        bloque["kv"] = kv
    verbo = clasificar(regla)["verbo"]
    if tipo is not None and verbo and entidad_id not in (None, ""):
        bloque["accion"] = {"texto": verbo, "destino": _destino(tipo, entidad_id)}
    return bloque or None
