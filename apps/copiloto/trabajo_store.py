"""El TRABAJO y su margen — addendum del hito 3 (capa CLIENTE, multi-tenant).

## El «trabajo» no es una entidad nueva: es la CADENA

```
presupuesto  →  factura  →  cobro        ← los tres enlaces YA existían
     └──────── el trabajo es la cadena ────────┘
```

No se crea una tabla `trabajos` a propósito. Una entidad nueva obligaría a decidir **cuándo nace un
trabajo** —¿al presupuestar? ¿al facturar sin presupuesto?— y a mantenerla sincronizada con los tres
eslabones que ya se enlazan solos. La cadena, en cambio, **ya está**: sólo hay que leerla.

## La regla que evita contar dos veces

El gasto se imputa **al eslabón que el usuario indicó** y la referencia **nunca se reescribe**. La
equivalencia se resuelve **al calcular**: imputar a un presupuesto o a su factura es el mismo trabajo,
y el margen tiene que dar igual por los dos caminos.

⚠️ Si en vez de esto se «normalizara» la referencia al crear (moverla siempre al presupuesto), un
gasto imputado a una factura **antes** de que apareciera su presupuesto quedaría en otro trabajo para
siempre — y nadie lo notaría, porque los dos márgenes se verían plausibles.

## Y la advertencia que va a la pantalla, no sólo al código

**Un margen incompleto se ve igual que uno bueno.** Un trabajo con 2 de 5 gastos imputados muestra un
margen excelente y es falso. Por eso `margen()` devuelve `gastos_imputados` (el conteo) **al lado del
número**: un margen sin contexto de completitud es peor que no mostrarlo.
"""
from __future__ import annotations

from decimal import Decimal
from typing import Callable

from evento_store import registrar_evento
from gasto_store import dos_decimales

_SCHEMA = "uc_factory"
_GASTOS = f"{_SCHEMA}.copiloto_gastos"
_COBROS = f"{_SCHEMA}.copiloto_cobros"
_PRESUPUESTOS = f"{_SCHEMA}.copiloto_presupuestos"
_COMPROBANTES = f"{_SCHEMA}.afip_comprobantes"

# Los tres eslabones donde se puede imputar. El orden ES la jerarquía de la cadena: el presupuesto
# manda sobre la factura, y la factura sobre el cobro.
ESLABONES = ("presupuesto", "comprobante", "cobro")
_COLUMNA = {"presupuesto": "presupuesto_ref", "comprobante": "comprobante_ref", "cobro": "cobro_ref"}


class TrabajoInexistente(Exception):
    """El eslabón no existe **para este emprendedor**. La web lo traduce a 404 — el mismo código que
    "no existe", porque confirmar que el id de otro existe ya es filtrar información."""


class TrabajoStore:
    def __init__(self, conn_factory: Callable, cliente_id: str) -> None:
        self._conn_factory = conn_factory
        self._cid = cliente_id

    # ── la cadena ────────────────────────────────────────────────────────────────────────────────

    def resolver(self, eslabon: str, ref: int) -> dict:
        """Desde CUALQUIER eslabón, la cadena entera: `{presupuesto, comprobante, cobros}`.

        Es la pieza que hace que imputar al presupuesto o a su factura dé el mismo margen. Sube y baja
        por los enlaces que ya existen:

        - `presupuesto.factura_id` → `afip_comprobantes.workflow_id` (`factura-{cliente}-{factura_id}`)
        - `cobro.comprobante_id`   → el comprobante
        - `cobro.presupuesto_ref`  → el presupuesto, para el trabajo que **nunca se facturó**
        """
        if eslabon not in ESLABONES:
            raise ValueError(f"eslabón desconocido: {eslabon!r}")
        with self._conn_factory() as conn, conn.cursor() as cur:
            presupuesto = comprobante = None

            if eslabon == "cobro":
                cur.execute(f"SELECT comprobante_id, presupuesto_ref FROM {_COBROS} "
                            f"WHERE cliente_id=%s AND id=%s", (self._cid, ref))
                fila = cur.fetchone()
                if fila is None:
                    raise TrabajoInexistente()
                comprobante, presupuesto = fila
                if comprobante is None and presupuesto is None:
                    # Un cobro suelto sin trabajo ES su propio trabajo: entra a la caja igual. Que no
                    # tenga margen calculable no lo hace inválido.
                    return {"presupuesto": None, "comprobante": None, "cobros": [ref]}
                eslabon = "presupuesto" if presupuesto is not None else "comprobante"
                ref = presupuesto if presupuesto is not None else comprobante

            if eslabon == "comprobante":
                cur.execute(f"SELECT workflow_id FROM {_COMPROBANTES} WHERE cliente_id=%s AND id=%s",
                            (self._cid, ref))
                fila = cur.fetchone()
                if fila is None:
                    raise TrabajoInexistente()
                comprobante = ref
                # Subir de la factura a su presupuesto: el `workflow_id` guarda `factura-{cid}-{fid}`
                # y el presupuesto guarda el `factura_id` corto. Es el MISMO cruce que usa `facturado`
                # en `presupuesto_store._DERIVADOS`; si el formato cambiara allá, acá también.
                cur.execute(f"SELECT id FROM {_PRESUPUESTOS} WHERE cliente_id=%s AND factura_id IS NOT NULL "
                            f"AND 'factura-' || cliente_id::text || '-' || factura_id = %s",
                            (self._cid, fila[0] or ""))
                arriba = cur.fetchone()
                presupuesto = arriba[0] if arriba else None

            elif eslabon == "presupuesto":
                cur.execute(f"SELECT factura_id FROM {_PRESUPUESTOS} WHERE cliente_id=%s AND id=%s",
                            (self._cid, ref))
                fila = cur.fetchone()
                if fila is None:
                    raise TrabajoInexistente()
                presupuesto = ref
                if fila[0]:
                    cur.execute(f"SELECT id FROM {_COMPROBANTES} WHERE cliente_id=%s AND workflow_id=%s",
                                (self._cid, f"factura-{self._cid}-{fila[0]}"))
                    abajo = cur.fetchone()
                    comprobante = abajo[0] if abajo else None

            # Los cobros del trabajo: los del comprobante MÁS los sueltos que apuntan al presupuesto.
            cur.execute(f"SELECT id FROM {_COBROS} WHERE cliente_id=%s "
                        f"AND ((%s IS NOT NULL AND comprobante_id = %s) "
                        f"  OR (%s IS NOT NULL AND presupuesto_ref = %s))",
                        (self._cid, comprobante, comprobante, presupuesto, presupuesto))
            cobros = [f[0] for f in cur.fetchall()]
            return {"presupuesto": presupuesto, "comprobante": comprobante, "cobros": cobros}

    # ── el margen ────────────────────────────────────────────────────────────────────────────────

    def margen(self, eslabon: str, ref: int) -> dict:
        """*«¿Cuánto me dejó este trabajo?»* — cobrado menos gastos imputados, **con el conteo**.

        El ingreso es lo **cobrado**, no lo facturado: una factura emitida y no cobrada todavía no
        dejó nada, y contarla como ingreso convertiría el margen en una promesa.
        """
        cadena = self.resolver(eslabon, ref)
        with self._conn_factory() as conn, conn.cursor() as cur:
            # `(CURRENT_DATE - max(fecha))` — mismo patrón que `CobroStore.impagos()` (`dias` en
            # SQL, no en Python): el "último movimiento" de la cadena es el más reciente entre sus
            # cobros y sus gastos, y lo que el hito 7 necesita no es la fecha en sí sino "hace
            # cuántos días" (contrato §1.bis: "el umbral es de días desde el último movimiento, no
            # desde que empezó" — para no avisar de un trabajo que sigue EN CURSO).
            cur.execute(f"SELECT coalesce(sum(monto), 0), (CURRENT_DATE - max(fecha)) FROM {_COBROS} "
                        f"WHERE cliente_id=%s AND id = ANY(%s)",
                        (self._cid, cadena["cobros"] or [0]))
            cobrado, dias_desde_cobro = cur.fetchone()
            cobrado = Decimal(str(cobrado or 0))

            # 🔴 El gasto se cuenta UNA vez aunque esté imputado a un eslabón distinto del que se
            # preguntó: se buscan los tres a la vez sobre la MISMA fila, y el check de la tabla
            # garantiza que ninguna tiene dos referencias puestas.
            cur.execute(f"""
                SELECT count(*), coalesce(sum(monto), 0), (CURRENT_DATE - max(fecha)) FROM {_GASTOS}
                 WHERE cliente_id = %s
                   AND ( (%s IS NOT NULL AND presupuesto_ref = %s)
                      OR (%s IS NOT NULL AND comprobante_ref = %s)
                      OR (cobro_ref = ANY(%s)) )
            """, (self._cid, cadena["presupuesto"], cadena["presupuesto"],
                  cadena["comprobante"], cadena["comprobante"], cadena["cobros"] or [0]))
            cuantos, gastado, dias_desde_gasto = cur.fetchone()

            dias_candidatos = [d.days for d in (dias_desde_cobro, dias_desde_gasto) if d is not None]
            dias_desde_ultimo_movimiento = min(dias_candidatos) if dias_candidatos else None

        return {
            "trabajo": cadena,
            "cobrado": dos_decimales(cobrado),
            "gastado": dos_decimales(gastado),
            "margen": dos_decimales(cobrado - Decimal(str(gastado or 0))),
            # ⚠️ El conteo viaja SIEMPRE, aunque sea 0: es lo que le permite a la pantalla decir «con 0
            # gastos imputados» en vez de mostrar un margen del 100% que parece una gran noticia.
            "gastos_imputados": int(cuantos or 0),
            "dias_desde_ultimo_movimiento": dias_desde_ultimo_movimiento,
        }

    # ── imputar ──────────────────────────────────────────────────────────────────────────────────

    def imputar(self, gasto_id: int, eslabon: str | None, ref: int | None) -> dict | None:
        """Imputa un gasto a un eslabón, o lo **desimputa** (`eslabon=None`).

        Las tres columnas se escriben en el mismo `UPDATE`, poniendo en `NULL` las otras dos: mover un
        gasto de un trabajo a otro no puede dejar la referencia vieja puesta. El check de la tabla lo
        atraparía, pero fallar es peor que no ensuciar.
        """
        if eslabon is not None:
            if eslabon not in ESLABONES:
                raise ValueError(f"eslabón desconocido: {eslabon!r}")
            self.resolver(eslabon, ref)          # 🔴 valida que el trabajo sea de ESTE emprendedor
        valores = {c: None for c in _COLUMNA.values()}
        if eslabon is not None:
            valores[_COLUMNA[eslabon]] = ref
        sets = ", ".join(f"{c} = %s" for c in valores)
        with self._conn_factory() as conn, conn.cursor() as cur:
            cur.execute(f"UPDATE {_GASTOS} SET {sets} WHERE cliente_id=%s AND id=%s "
                        f"RETURNING presupuesto_ref, comprobante_ref, cobro_ref",
                        (*valores.values(), self._cid, gasto_id))
            fila = cur.fetchone()
            if fila is None:
                return None
            # `IMPUTADO_A` (Gasto→eslabón, §2.1). Se loggea para que el derivador arme la arista desde
            # el log solo (§3/§5), sin leer el `*_ref` mutable. `eslabon=None` es una DESIMPUTACIÓN: la
            # arista vigente se invalida y no nace otra. ⚠️ La ontología §2.1 lista `IMPUTADO_A` como
            # EVENTO ("no se invalida jamás"), pero re-imputar un gasto DEBE invalidar la anterior o el
            # margen contaría el gasto en dos trabajos — así que en el grafo se comporta como arista de
            # ESTADO. Contradicción a resolver en §1.2/§1.3 (anotada como hallazgo del derivador).
            registrar_evento(cur, self._cid, entidad_tipo="gasto", entidad_id=gasto_id,
                             evento=("imputado" if eslabon is not None else "desimputado"),
                             campo="imputacion",
                             valor_a=({"eslabon": eslabon, "ref": ref} if eslabon is not None else None))
        return {"gasto_id": gasto_id, "presupuesto_ref": fila[0],
                "comprobante_ref": fila[1], "cobro_ref": fila[2]}
