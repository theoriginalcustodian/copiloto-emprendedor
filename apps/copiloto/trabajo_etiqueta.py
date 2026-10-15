"""El rótulo humano de un trabajo — UNA sola definición para todo el que lo muestra.

Antes había tres: el selector de imputación armaba `concepto · #numero` en el front (core), el detalle
del gasto re-derivaba `Presupuesto #<id>` del id interno, y el gráfico de margen traía `cliente · fecha`
(a veces sólo la fecha). El emprendedor eligió «asesoría contable · #3» y el detalle le mostró
«Presupuesto #227»: dos números para el mismo trabajo (contrato 2026-10-15).

Acá el rótulo se arma UNA vez, en el backend, y viaja con el dato: `gasto.imputacion.etiqueta` y
`etiqueta` de cada fila del gráfico de margen salen de esta función. Regla de oro: **el id interno de
base NUNCA es parte del rótulo** — es un número que el emprendedor no ve en ninguna otra pantalla.

Capa de lectura pura (sin escritura, sin eventos): recibe el cursor del que llama y filtra SIEMPRE por
`cliente_id`, así que un par `(eslabon, ref)` de otro tenant no se resuelve (queda fuera del dict).
"""
from __future__ import annotations

from decimal import Decimal

_SCHEMA = "uc_factory"
_PRESUPUESTOS = f"{_SCHEMA}.copiloto_presupuestos"
_COMPROBANTES = f"{_SCHEMA}.afip_comprobantes"
_COBROS = f"{_SCHEMA}.copiloto_cobros"


def _con_nombre(nombre: str | None, resto: str) -> str:
    nombre = (nombre or "").strip()
    return f"{nombre} · {resto}" if nombre else resto


def etiquetas_de_trabajo(cur, cliente_id: str,
                         pares: "set[tuple[str, int]] | list[tuple[str, int]]") -> dict[tuple[str, int], str]:
    """`{(eslabon, ref): rótulo}` para los trabajos pedidos; **una consulta por eslabón**, no por par.

    Lo que no se puede resolver (no existe, o es de otro tenant) **no está en el dict**: el que llama
    decide (`None`). Nunca se arma un rótulo con el id interno para tapar el hueco.

    - presupuesto → `{concepto} · #{numero}` (sin concepto: `Presupuesto #{numero}`)
    - comprobante → `{receptor} · Factura {pv}-{nro}` (numeración AFIP, la que ve el cliente)
    - cobro       → `{cliente|concepto} · Cobro {fecha} ${monto}` (un cobro no tiene número humano:
                    fecha + monto es lo que lo distingue de otro del mismo cliente)
    """
    por_eslabon: dict[str, list[int]] = {}
    for eslabon, ref in pares:
        por_eslabon.setdefault(eslabon, []).append(ref)
    out: dict[tuple[str, int], str] = {}

    if refs := por_eslabon.get("presupuesto"):
        cur.execute(f"SELECT id, numero, concepto FROM {_PRESUPUESTOS} "
                    f"WHERE cliente_id=%s AND id = ANY(%s)", (cliente_id, refs))
        for pid, numero, concepto in cur.fetchall():
            concepto = (concepto or "").strip()
            out[("presupuesto", pid)] = (f"{concepto} · #{numero}" if concepto
                                         else f"Presupuesto #{numero}")

    if refs := por_eslabon.get("comprobante"):
        cur.execute(f"SELECT id, receptor_nombre, punto_venta, nro FROM {_COMPROBANTES} "
                    f"WHERE cliente_id=%s AND id = ANY(%s)", (cliente_id, refs))
        for cid, receptor, punto_venta, nro in cur.fetchall():
            out[("comprobante", cid)] = _con_nombre(
                receptor, f"Factura {int(punto_venta):04d}-{int(nro):08d}")

    if refs := por_eslabon.get("cobro"):
        cur.execute(f"SELECT id, cliente_nombre, concepto, fecha, monto FROM {_COBROS} "
                    f"WHERE cliente_id=%s AND id = ANY(%s)", (cliente_id, refs))
        for kid, cliente, concepto, fecha, monto in cur.fetchall():
            fecha_str = fecha.isoformat() if fecha else "sin fecha"
            out[("cobro", kid)] = _con_nombre(
                (cliente or "").strip() or concepto,
                f"Cobro {fecha_str} ${Decimal(str(monto or 0)).quantize(Decimal('0.01'))}")
    return out
