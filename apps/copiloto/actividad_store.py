"""La unión de ACTIVIDAD RECIENTE (contrato §3.2) — hito 2.

**Una sola query con `UNION ALL` y orden global, no N consultas ordenadas en Python.** Traer el top-N
de cada tabla y mezclar en memoria **rompe la paginación**: el ítem 21 global puede no estar en ningún
top-20 parcial, así que desaparece de la lista y nadie se entera. Con la unión, Postgres ordena el
conjunto completo y el `LIMIT` corta donde tiene que cortar.

**Cursor keyset, no offset.** Entre que el usuario ve la página 1 y pide la 2, el emprendedor carga un
gasto: con `OFFSET` todo se corre una posición y se **saltea o repite** un ítem. Es una lista que se
lee de arriba hacia abajo mientras crece por arriba — el caso donde offset siempre falla.
"""
from __future__ import annotations

import datetime
from typing import Callable

from afip_rules import NOTAS_CREDITO

_SCHEMA = "uc_factory"

# El id es `"<tipo>:<id>"` (texto) y el orden es `(fecha DESC, id DESC)` con ESE texto. Comparar ids
# textuales ordena `gasto:9` antes que `gasto:10` —lexicográfico, no numérico—, y está bien: lo que el
# keyset necesita no es que el orden sea "natural" sino que sea **total y determinista**. Mientras el
# ORDER BY y el WHERE del cursor usen la misma expresión, no se saltea ni se repite nada.
#
# La `fecha` de cada tipo es la de NEGOCIO (la que se muestra), no `created_at`: ordenar por una y
# mostrar otra haría que la lista se vea desordenada, que es peor que cualquier ganancia de precisión.
# 🔴 Los códigos de AFIP salen de `afip_rules.TipoComprobante`, NO de memoria. Las notas de crédito
# son **3 (A), 8 (B) y 13 (C)** — la primera versión de esta query usó `IN (12, 13)`, y el 12 no existe
# en el catálogo. Consecuencia: una nota de crédito A o B habría caído en la rama de facturas y se
# habría mostrado con `signo: entra`, o sea **plata que ENTRA cuando en realidad salió**.
#
# No se notó porque este tenant sólo tiene notas C (13): los datos reales alcanzaban para que se viera
# bien y no para que la rama estuviera bien. Un verde de datos poco representativos.
#
# 🔴 Ya no se escribe acá: se **importa** de `afip_rules.NOTAS_CREDITO`, que la deriva del enum. La
# copia local era la que estaba mal, y el comentario de arriba —«salen de afip_rules, NO de memoria»—
# describía una disciplina que el propio código no cumplía. Una constante duplicada con un comentario
# que promete que no lo está es peor que la duplicación sola: desactiva la sospecha.
_NOTAS_CREDITO = NOTAS_CREDITO

# `tipo_cbte` es un código interno de AFIP y el emprendedor no lo conoce. El contrato §3 pide el título
# "en el idioma del emprendedor" — la primera versión mostraba literalmente **«Factura 11»**, que es
# como llamarle a una factura C por su número de fila en una tabla de la AFIP.
_LETRA = "CASE tipo_cbte WHEN 1 THEN 'A' WHEN 6 THEN 'B' WHEN 11 THEN 'C' " \
         "WHEN 3 THEN 'A' WHEN 8 THEN 'B' WHEN 13 THEN 'C' ELSE '' END"

# El número completo (`0006-00000018`) no entra en el ancho de la fila y se trunca justo donde está lo
# que distingue un comprobante de otro: seis «Nota de crédito 0006-0000…» idénticas en pantalla. Se
# muestra el número SIN el padding, que es lo que el emprendedor lee en el papel igual.
_NUMERO = "(punto_venta::text || '-' || nro::text)"

_UNION = f"""
SELECT (fecha_emision::timestamptz) AS fecha,
       ('factura:' || id::text)     AS item_id,
       'factura'                    AS tipo,
       ('Factura ' || ({_LETRA}) || ' ' || {_NUMERO})   AS titulo,
       coalesce(receptor_nombre, '')                    AS detalle,
       total::text                                      AS monto,
       'entra'                                          AS signo
  FROM {_SCHEMA}.afip_comprobantes
 WHERE cliente_id = %(cid)s AND tipo_cbte NOT IN {_NOTAS_CREDITO} AND cae IS NOT NULL

UNION ALL

SELECT (fecha_emision::timestamptz),
       ('nota_credito:' || id::text),
       'nota_credito',
       ('Nota de crédito ' || ({_LETRA}) || ' ' || {_NUMERO}),
       coalesce(receptor_nombre, ''),
       total::text,
       'sale'
  FROM {_SCHEMA}.afip_comprobantes
 WHERE cliente_id = %(cid)s AND tipo_cbte IN {_NOTAS_CREDITO} AND cae IS NOT NULL

UNION ALL

SELECT fecha,
       ('presupuesto:' || id::text),
       'presupuesto',
       ('Presupuesto Nº' || numero::text),
       coalesce(nullif(receptor_nombre, ''), concepto, ''),
       total::text,
       'neutro'
  FROM {_SCHEMA}.copiloto_presupuestos
 WHERE cliente_id = %(cid)s

UNION ALL

SELECT (fecha::timestamptz),
       ('gasto:' || id::text),
       'gasto',
       ('Gasto en ' || categoria),
       coalesce(nullif(proveedor, ''), nullif(descripcion, ''), ''),
       monto::text,
       'sale'
  FROM {_SCHEMA}.copiloto_gastos
 WHERE cliente_id = %(cid)s

UNION ALL

-- Los INGRESOS (cobros: de factura, dictados y MercadoPago) son actividad —el emprendedor registró
-- que entró plata—, y la unión los omitía: `funcion=ingresos` (contrato recientes/buscar) volvía vacío
-- sin este branch. El cobro de una factura es un evento DISTINTO de la emisión (la factura ya está en
-- su propio branch con signo 'entra'): son dos cosas que pasaron, no un duplicado. El feed no suma
-- —eso es `/inteligencia/portada`, que separa facturado de entró—; acá cada evento es una fila.
SELECT (fecha::timestamptz),
       ('ingreso:' || id::text),
       'ingreso',
       (CASE WHEN origen = 'factura' THEN 'Cobro de factura'
             ELSE ('Ingreso' || CASE WHEN coalesce(medio, '') <> '' THEN ' (' || medio || ')'
                                     ELSE '' END) END),
       coalesce(nullif(cliente_nombre, ''), nullif(concepto, ''), ''),
       monto::text,
       'entra'
  FROM {_SCHEMA}.copiloto_cobros
 WHERE cliente_id = %(cid)s

UNION ALL

-- Los clientes DERIVADOS no son actividad: nacieron de un backfill, no de algo que el emprendedor
-- hizo. Meter 200 derivados acá vuelve la lista inútil el día uno (contrato §3.2).
SELECT created_at,
       ('cliente:' || id::text),
       'cliente',
       ('Cliente nuevo: ' || nombre),
       '',
       NULL,
       'neutro'
  FROM {_SCHEMA}.copiloto_clientes
 WHERE cliente_id = %(cid)s AND origen <> 'derivado'

UNION ALL

-- SOP6/S6-8: la respuesta del operador a un ticket, en el feed del usuario -- reusa `copiloto_mensajes`
-- TAL CUAL (ya lo escribe `TicketStore.agregar_mensaje` con autor='operador' desde el front-door de
-- SOP6), no una tabla de notificaciones nueva. El `item_id` lleva el `ticket_id` adentro
-- (`ticket_respuesta:<ticket_id>:<mensaje_id>`) para que el frontend arme el link al hilo (S6-11) sin
-- una segunda consulta.
SELECT m.created_at,
       ('ticket_respuesta:' || m.ticket_id::text || ':' || m.id::text),
       'ticket_respuesta',
       ('Respuesta a tu ticket ' || t.codigo),
       coalesce(nullif(t.asunto, ''), ''),
       NULL,
       'neutro'
  FROM {_SCHEMA}.copiloto_mensajes m
  JOIN {_SCHEMA}.copiloto_tickets t ON t.id = m.ticket_id AND t.cliente_id = m.cliente_id
 WHERE m.cliente_id = %(cid)s AND m.autor = 'operador'
"""

_COLS = ("fecha", "id", "tipo", "titulo", "detalle", "monto", "signo")

# El filtro `funcion` del contrato recientes/buscar: cada función mapea a uno o más `tipo` del feed.
# `facturacion` junta factura + nota de crédito; las demás son homónimas. `clientes` NO está —un cliente
# no es un movimiento y su glass va por `/clientes?q=` (decisión del addendum)—; `contabilidad` tampoco,
# porque todavía no hay tipo de item contable. Fuente única: la valida la capa web contra `FUNCIONES`.
_FUNCION_TIPOS: dict[str, tuple[str, ...]] = {
    "facturacion": ("factura", "nota_credito"),
    "gastos": ("gasto",),
    "ingresos": ("ingreso",),
    "presupuestos": ("presupuesto",),
}
FUNCIONES = tuple(_FUNCION_TIPOS)


class FuncionInvalida(ValueError):
    """`funcion` fuera de `FUNCIONES`. La capa web lo traduce a 400 (no se filtra en silencio a vacío)."""


def _dos_decimales(valor) -> str | None:
    if valor is None:
        return None
    from decimal import Decimal, InvalidOperation
    try:
        return str(Decimal(str(valor)).quantize(Decimal("0.01")))
    except (InvalidOperation, ValueError, TypeError):
        return None


class ActividadStore:
    def __init__(self, conn_factory: Callable, cliente_id: str) -> None:
        self._conn_factory = conn_factory
        self._cliente_id = cliente_id

    def listar(self, *, limit: int = 20,
               desde: tuple[datetime.datetime, str] | None = None,
               funcion: str | None = None, q: str = "") -> dict:
        """Una página. `desde` es el `(fecha, id)` del cursor — estrictamente MENOR, para no repetir
        el último ítem de la página anterior. `funcion` acota a una función (contrato recientes/buscar);
        `q` busca por texto (`ILIKE` sobre título+detalle). Los tres filtros se combinan con AND: el
        cursor sigue funcionando dentro de la vista filtrada, así que paginar una búsqueda no repite ni
        saltea."""
        from actividad_web import formatear_cursor

        params: dict = {"cid": self._cliente_id, "limite": int(limit)}
        condiciones: list[str] = []
        if desde is not None:
            # `(fecha, item_id) < (%(f)s, %(i)s)` — comparación de TUPLAS, no dos condiciones con AND.
            # `fecha < f OR (fecha = f AND id < i)` es lo mismo pero se escribe mal una de cada tres
            # veces, y el error (usar `<=` en la segunda rama) repite un ítem por página.
            condiciones.append("(a.fecha, a.item_id) < (%(f)s, %(i)s)")
            params["f"], params["i"] = desde
        if funcion:
            tipos = _FUNCION_TIPOS.get(funcion)
            if tipos is None:
                raise FuncionInvalida(funcion)
            condiciones.append("a.tipo = ANY(%(tipos)s)")
            params["tipos"] = list(tipos)
        if q:
            # `ILIKE` sobre título+detalle. 🔴 Se escapan los comodines de LIKE (`%`, `_`, `\`) del texto
            # del usuario: la parametrización del driver frena la inyección SQL, NO la de comodines —son
            # dos cosas distintas—. Sin esto, buscar `100%` trae TODO (`%` = "cualquier cosa") y `a_b`
            # matchea `axb`. Con el escape, el usuario busca el texto literal que tipeó.
            patron = q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
            condiciones.append("(a.titulo ILIKE %(q)s OR a.detalle ILIKE %(q)s)")
            params["q"] = f"%{patron}%"
        filtro = (" WHERE " + " AND ".join(condiciones)) if condiciones else ""

        sql = (f"SELECT a.fecha, a.item_id, a.tipo, a.titulo, a.detalle, a.monto, a.signo "
               f"FROM ({_UNION}) AS a{filtro} "
               f"ORDER BY a.fecha DESC, a.item_id DESC LIMIT %(limite)s")

        with self._conn_factory() as conn, conn.cursor() as cur:
            cur.execute(sql, params)
            filas = cur.fetchall()

        items = [{"id": f[1], "tipo": f[2], "fecha": f[0].isoformat() if f[0] else None,
                  "titulo": f[3], "detalle": f[4] or "", "monto": _dos_decimales(f[5]),
                  "signo": f[6]} for f in filas]

        # El cursor sale sólo si la página vino LLENA. Si vino corta, no hay más — y devolver un cursor
        # igual haría que la app pida una página vacía de más en cada scroll hasta el fondo.
        cursor = (formatear_cursor(filas[-1][0], filas[-1][1])
                  if len(filas) == int(limit) and filas else None)
        return {"items": items, "cursor": cursor}
