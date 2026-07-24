"""INTELIGENCIA DE NEGOCIO — la capa ÚNICA de queries (capa CLIENTE, multi-tenant).

Contrato: `contrato_..._inteligencia-de-negocio` §0. **El invariante duro de este módulo:** la misma
información se muestra en cuatro caras —portada, gráfico, chat y el aviso proactivo—. Si cada una
sumara por su cuenta, un día la portada diría $340.000, el chat $338.500 y el aviso $341.200; ninguna
estaría "rota" y el emprendedor deja de creerle a las cuatro. **Una sola definición de cada número,
acá; las cuatro caras la consumen.** El DoD §5 lo verifica por lectura: `grep` de la función de
cálculo → un solo lugar que la define.

Por eso «Entró» (el número más delicado, §1.bis) vive en UN solo string SQL (`_INGRESOS`): cobros de
factura + ingresos dictados (efectivo/transferencia) + MercadoPago aprobado. Antes del hito 3.b un
cobro sólo existía si pasaba por MercadoPago, y en este mercado el efectivo puede ser la mitad — la
caja daba un número **prolijo y falso**. El control del contrato (§1.bis) NO se lee, se corre: cargar
un ingreso dictado y verificar que «Entró» sube. Un `JOIN` que no matchea devuelve el mismo número
prolijo sin protestar (`vacio-no-es-hallazgo-correr-el-control`); por eso hay un test que ejercita
justo eso.

Aislamiento: `cliente_id` se fija en el constructor y **todas** las consultas filtran por él. No se
confía en RLS como única barrera —el rol de `DATABASE_URL` es dueño y la bypassea—; el filtro
explícito es la barrera efectiva, con test adversarial que la ejercita (regla 7).
"""
from __future__ import annotations

import datetime
from decimal import Decimal
from typing import Callable

from cobro_store import CobroStore
from gasto_store import CATEGORIAS, dos_decimales, hoy_del_negocio
from trabajo_store import TrabajoStore

_SCHEMA = "uc_factory"

# ── LA definición de «Entró». Un solo lugar (§0). ────────────────────────────────────────────────
# Los cobros (factura + dictados) viven en `copiloto_cobros`; los pagos de MercadoPago en
# `mp_payments` (que TAMBIÉN lleva `cliente_id` — se filtra por él, no por `seller_user_id`, así el
# aislamiento es el mismo que el resto). `origen='mercadopago'` en `copiloto_cobros` está declarado
# pero **no lo escribe nadie todavía**, así que MP se suma desde su tabla; el día que se unifiquen, la
# fila del `UNION` se saca de acá y ninguna cara se entera. `occurred_at` es timestamptz → se lleva al
# día del negocio con el mismo -3h fijo que `hoy_del_negocio`, para que un pago de las 22:00 de Buenos
# Aires no caiga en el día —ni en el mes— siguiente.
_INGRESOS = f"""
    SELECT fecha AS dia, monto FROM {_SCHEMA}.copiloto_cobros WHERE cliente_id = %(cid)s
    UNION ALL
    SELECT (occurred_at - interval '3 hours')::date AS dia, amount
      FROM {_SCHEMA}.mp_payments
     WHERE cliente_id = %(cid)s AND status = 'approved' AND amount IS NOT NULL
"""

# «Salió» — una sola tabla, pero se aísla igual para que gráfico y portada usen la misma fuente.
_GASTOS = f"SELECT fecha AS dia, monto FROM {_SCHEMA}.copiloto_gastos WHERE cliente_id = %(cid)s"

# Una factura impaga se considera VENCIDA a los 30 días de emitida. No hay columna de vencimiento en
# el comprobante (AFIP no la exige acá); 30 días es el mismo umbral de "algo quedó sin respuesta" que
# el contrato usa para los presupuestos (§1). Es el `vencido` de `por_cobrar`.
DIAS_VENCIDO = 30

MONEDA = "ARS"


def _primer_dia_del_mes(d: datetime.date) -> datetime.date:
    return d.replace(day=1)


def _mes_siguiente(d: datetime.date) -> datetime.date:
    """Primer día del mes siguiente al de `d`. El rango de un mes es `[primer_día, mes_siguiente)`."""
    return datetime.date(d.year + (d.month // 12), (d.month % 12) + 1, 1)


def _clave_mes(d: datetime.date) -> str:
    return f"{d.year:04d}-{d.month:02d}"


class InteligenciaQueries:
    def __init__(self, conn_factory: Callable, cliente_id: str) -> None:
        self._conn_factory = conn_factory
        self._cliente_id = cliente_id

    # ── sumas base (cursor-based: las comparte una sola conexión en portada) ──────────────────────

    def _suma(self, cur, fragmento: str, desde: datetime.date | None = None,
              hasta: datetime.date | None = None) -> Decimal:
        """Suma el `monto` del fragmento (`_INGRESOS`/`_GASTOS`), opcionalmente acotado a `[desde, hasta)`.

        El filtro por rango se aplica AFUERA del fragmento (sobre `dia`), no adentro, para que la
        definición del fragmento —qué cuenta como ingreso— sea una sola y el rango sea una decoración
        del que consulta. `dia` NULL (un pago MP sin fecha) queda afuera de cualquier rango acotado
        pero adentro del acumulado: un pago sin fecha no se puede ubicar en un mes, pero sí está en la
        caja.
        """
        where = ""
        params = {"cid": self._cliente_id}
        if desde is not None and hasta is not None:
            where = " WHERE x.dia >= %(desde)s AND x.dia < %(hasta)s"
            params["desde"], params["hasta"] = desde, hasta
        cur.execute(f"SELECT coalesce(sum(x.monto), 0) FROM ({fragmento}) x{where}", params)
        return Decimal(str(cur.fetchone()[0] or 0))

    def _serie(self, cur, fragmento: str, desde: datetime.date) -> dict[str, Decimal]:
        """`{'2026-03': Decimal, ...}` desde `desde` (inclusive) hasta hoy. Sólo los meses con datos;
        los vacíos los completa `_serie_mensual` para que el gráfico no tenga huecos."""
        cur.execute(
            f"SELECT to_char(x.dia, 'YYYY-MM') AS mes, coalesce(sum(x.monto), 0) "
            f"FROM ({fragmento}) x WHERE x.dia >= %(desde)s GROUP BY 1",
            {"cid": self._cliente_id, "desde": desde})
        return {mes: Decimal(str(total or 0)) for mes, total in cur.fetchall() if mes is not None}

    def _facturado(self, cur, desde: datetime.date, hasta: datetime.date) -> Decimal:
        """Lo FACTURADO en el rango: comprobantes con CAE, no anulados. Facturado ≠ cobrado — uno es lo
        que se emitió, el otro lo que entró; el contrato pide los dos por separado."""
        cur.execute(f"""
            SELECT coalesce(sum(total), 0) FROM {_SCHEMA}.afip_comprobantes
             WHERE cliente_id = %(cid)s AND estado <> 'anulada' AND cae IS NOT NULL
               AND fecha_emision >= %(desde)s AND fecha_emision < %(hasta)s
        """, {"cid": self._cliente_id, "desde": desde, "hasta": hasta})
        return Decimal(str(cur.fetchone()[0] or 0))

    def _cobrado(self, cur, desde: datetime.date, hasta: datetime.date) -> Decimal:
        """Lo COBRADO de facturas en el rango (`origen='factura'`). Subconjunto de «Entró»: no incluye
        dictados ni MP, a propósito —«cobrado» responde *cuánto de lo que facturé ya entró*, distinto
        de *cuánto entró en total*—."""
        cur.execute(f"""
            SELECT coalesce(sum(monto), 0) FROM {_SCHEMA}.copiloto_cobros
             WHERE cliente_id = %(cid)s AND origen = 'factura'
               AND fecha >= %(desde)s AND fecha < %(hasta)s
        """, {"cid": self._cliente_id, "desde": desde, "hasta": hasta})
        return Decimal(str(cur.fetchone()[0] or 0))

    def _mejores_clientes(self, cur, limite: int) -> list[dict]:
        """Ranking por lo cobrado, resolviendo el nombre: los dictados lo traen en `cliente_nombre`,
        los de factura en el `receptor_nombre` del comprobante. Los cobros sin nombre resoluble quedan
        afuera (no se inventan un "(sin nombre)" que encabece el ranking). MP no entra: sus pagos no
        vienen atados a un cliente, y atribuirlos sería adivinar."""
        cur.execute(f"""
            SELECT cliente, total FROM (
                SELECT coalesce(nullif(trim(k.cliente_nombre), ''), c.receptor_nombre, '') AS cliente,
                       coalesce(sum(k.monto), 0) AS total
                  FROM {_SCHEMA}.copiloto_cobros k
                  LEFT JOIN {_SCHEMA}.afip_comprobantes c
                         ON c.cliente_id = k.cliente_id AND c.id = k.comprobante_id
                 WHERE k.cliente_id = %(cid)s
                 GROUP BY 1
            ) x WHERE cliente <> '' ORDER BY total DESC, cliente LIMIT %(limite)s
        """, {"cid": self._cliente_id, "limite": max(1, int(limite))})
        return [{"cliente": nombre, "total": dos_decimales(total)} for nombre, total in cur.fetchall()]

    def _serie_mensual(self, cur, meses: int) -> list[dict]:
        """`[{mes, ingresos, gastos}]` para los últimos `meses` (incluido el actual), SIN huecos: los
        meses sin datos van en `"0.00"`, no ausentes, para que el eje del gráfico sea continuo."""
        hoy = hoy_del_negocio()
        primero = _primer_dia_del_mes(hoy)
        for _ in range(meses - 1):
            primero = _primer_dia_del_mes(primero - datetime.timedelta(days=1))
        ingresos = self._serie(cur, _INGRESOS, primero)
        gastos = self._serie(cur, _GASTOS, primero)
        serie, cursor_mes = [], primero
        for _ in range(meses):
            clave = _clave_mes(cursor_mes)
            serie.append({"mes": clave,
                          "ingresos": dos_decimales(ingresos.get(clave, 0)),
                          "gastos": dos_decimales(gastos.get(clave, 0))})
            cursor_mes = _mes_siguiente(cursor_mes)
        return serie

    # ── por cobrar: reusa CobroStore.impagos() (§0: el mismo «Te deben» de esa pantalla) ──────────

    def por_cobrar(self) -> dict:
        """`{total, vencido}`. `total` es EXACTAMENTE el `total_adeudado` de la pantalla «Te deben»
        (se reusa `CobroStore.impagos()`, no se recalcula — el §0 prohíbe dos caminos al mismo número).
        `vencido` es la parte con más de `DIAS_VENCIDO` días desde la emisión."""
        impagos = CobroStore(self._conn_factory, self._cliente_id).impagos()
        vencido = sum((Decimal(c["saldo"]) for c in impagos["comprobantes"]
                       if (c.get("dias") or 0) > DIAS_VENCIDO), Decimal(0))
        return {"total": impagos["total_adeudado"], "vencido": dos_decimales(vencido)}

    # ── la portada: arma el §3.1 con UNA conexión ────────────────────────────────────────────────

    def portada(self) -> dict:
        """El §3.1 completo, con datos reales. Importes como decimal string (regla del repo: el float
        de JS pierde centavos). `caja.saldo` = «Queda» del MES (ingresos − gastos del mes), coherente
        con el titular mensual del contrato §1 («Julio · Entró/Salió/Queda»); es igual a
        `mes.rentabilidad`. [COSTURA a confirmar en el connect: si se quiere la caja ACUMULADA de toda
        la historia en vez de la del mes, es un cambio de una línea — se marca en el avance.]"""
        hoy = hoy_del_negocio()
        ini_mes, ini_prox = _primer_dia_del_mes(hoy), _mes_siguiente(hoy)
        with self._conn_factory() as conn, conn.cursor() as cur:
            ingresos_mes = self._suma(cur, _INGRESOS, ini_mes, ini_prox)
            gastos_mes = self._suma(cur, _GASTOS, ini_mes, ini_prox)
            facturado_mes = self._facturado(cur, ini_mes, ini_prox)
            cobrado_mes = self._cobrado(cur, ini_mes, ini_prox)
            serie = self._serie_mensual(cur, 6)
            mejores = self._mejores_clientes(cur, 5)
        rentabilidad_mes = ingresos_mes - gastos_mes
        return {
            "caja": {"saldo": dos_decimales(rentabilidad_mes), "moneda": MONEDA},
            "mes": {
                "ingresos": dos_decimales(ingresos_mes),
                "gastos": dos_decimales(gastos_mes),
                "rentabilidad": dos_decimales(rentabilidad_mes),
                "facturado": dos_decimales(facturado_mes),
                "cobrado": dos_decimales(cobrado_mes),
            },
            "serie_mensual": serie,
            "mejores_clientes": mejores,
            "por_cobrar": self.por_cobrar(),
        }

    # ── ventana de N meses, compartida por los 3 gráficos de serie mensual ─────────────────────────

    def _ventana_meses(self, meses: int) -> tuple[datetime.date, datetime.date]:
        """`(desde, hasta)` = los últimos `meses` (incluido el actual), como rango `[desde, hasta)`."""
        hoy = hoy_del_negocio()
        desde = _primer_dia_del_mes(hoy)
        for _ in range(meses - 1):
            desde = _primer_dia_del_mes(desde - datetime.timedelta(days=1))
        return desde, _mes_siguiente(hoy)

    def _mes_o_actual(self, mes: str | None) -> tuple[datetime.date, datetime.date, str]:
        """Parsea `?mes=YYYY-MM`; sin él, el mes del negocio HOY. Devuelve `(ini, fin, clave)`."""
        if mes:
            ini = datetime.date.fromisoformat(f"{mes}-01")
        else:
            ini = _primer_dia_del_mes(hoy_del_negocio())
        return ini, _mes_siguiente(ini), _clave_mes(ini)

    # ── gráfico 1: facturación por mes (§2.1 del contrato IN) ───────────────────────────────────────

    def facturacion_por_mes(self, meses: int = 6) -> dict:
        """`{tipo, periodo, serie:[{mes, total, cantidad}]}`. Misma definición de «facturado» que la
        portada (`_facturado`) — acá agregada mes a mes en vez de un solo rango, y con el CONTEO al
        lado (la portada no lo necesita, el gráfico sí)."""
        desde, hasta = self._ventana_meses(meses)
        with self._conn_factory() as conn, conn.cursor() as cur:
            cur.execute(f"""
                SELECT to_char(fecha_emision, 'YYYY-MM') AS mes, coalesce(sum(total), 0), count(*)
                  FROM {_SCHEMA}.afip_comprobantes
                 WHERE cliente_id = %(cid)s AND estado <> 'anulada' AND cae IS NOT NULL
                   AND fecha_emision >= %(desde)s AND fecha_emision < %(hasta)s
                 GROUP BY 1
            """, {"cid": self._cliente_id, "desde": desde, "hasta": hasta})
            por_mes = {mes: (Decimal(str(total or 0)), int(cant)) for mes, total, cant in cur.fetchall()}
        serie, cursor_mes = [], desde
        while cursor_mes < hasta:
            clave = _clave_mes(cursor_mes)
            total, cant = por_mes.get(clave, (Decimal(0), 0))
            serie.append({"mes": clave, "total": dos_decimales(total), "cantidad": cant})
            cursor_mes = _mes_siguiente(cursor_mes)
        return {"tipo": "barras", "periodo": f"{serie[0]['mes']}..{serie[-1]['mes']}", "serie": serie}

    def facturacion_detalle_mes(self, mes: str) -> dict:
        """Las filas de comprobantes FACTURADOS (no anulados, con CAE) de `mes` — el desglose de una
        barra del gráfico 1. Mismo filtro que `facturacion_por_mes`, un mes solo."""
        ini, fin, clave = self._mes_o_actual(mes)
        with self._conn_factory() as conn, conn.cursor() as cur:
            cur.execute(f"""
                SELECT id, punto_venta, nro, fecha_emision, coalesce(receptor_nombre, ''), total
                  FROM {_SCHEMA}.afip_comprobantes
                 WHERE cliente_id = %(cid)s AND estado <> 'anulada' AND cae IS NOT NULL
                   AND fecha_emision >= %(ini)s AND fecha_emision < %(fin)s
                 ORDER BY fecha_emision, nro
            """, {"cid": self._cliente_id, "ini": ini, "fin": fin})
            filas = [{"id": cid, "numero": f"{pv:04d}-{nro:08d}", "fecha": fecha.isoformat(),
                     "cliente": cliente, "total": dos_decimales(total)}
                    for cid, pv, nro, fecha, cliente, total in cur.fetchall()]
        return {"mes": clave, "filas": filas}

    # ── gráfico 2: entró vs salió (§2.2) — la MISMA `_serie_mensual` de la portada, otras claves ─────

    def entro_vs_salio(self, meses: int = 6) -> dict:
        """Reusa `_serie_mensual` (§0: es la MISMA definición de «Entró»/«Salió» que la portada), sólo
        cambia el nombre de las claves para el shape del gráfico 2 (`entro`/`salio` en vez de
        `ingresos`/`gastos`)."""
        with self._conn_factory() as conn, conn.cursor() as cur:
            base = self._serie_mensual(cur, meses)
        serie = [{"mes": m["mes"], "entro": m["ingresos"], "salio": m["gastos"]} for m in base]
        return {"tipo": "barras_enfrentadas", "periodo": f"{serie[0]['mes']}..{serie[-1]['mes']}",
                "serie": serie}

    def entro_vs_salio_detalle(self, mes: str, lado: str) -> dict:
        """`lado='entro'`: filas de `_INGRESOS` con `origen` visible (factura/manual/mercadopago) —
        Ingresos ya distingue así, se reusa la misma etiqueta. `lado='salio'`: filas de `copiloto_gastos`.
        Dos queries de detalle porque las fuentes son tablas distintas con columnas distintas; el
        AGREGADO (arriba) sigue siendo una sola definición."""
        if lado not in ("entro", "salio"):
            raise ValueError(f"lado inválido: {lado!r} (entro | salio)")
        ini, fin, clave = self._mes_o_actual(mes)
        with self._conn_factory() as conn, conn.cursor() as cur:
            if lado == "salio":
                cur.execute(f"""
                    SELECT id, fecha, monto, categoria, coalesce(nullif(proveedor, ''), '')
                      FROM {_SCHEMA}.copiloto_gastos
                     WHERE cliente_id = %(cid)s AND fecha >= %(ini)s AND fecha < %(fin)s
                     ORDER BY fecha
                """, {"cid": self._cliente_id, "ini": ini, "fin": fin})
                filas = [{"id": gid, "fecha": fecha.isoformat(), "monto": dos_decimales(monto),
                         "categoria": cat, "proveedor": prov}
                        for gid, fecha, monto, cat, prov in cur.fetchall()]
            else:
                cur.execute(f"""
                    SELECT id, fecha, monto, origen, coalesce(nullif(cliente_nombre, ''), '')
                      FROM {_SCHEMA}.copiloto_cobros
                     WHERE cliente_id = %(cid)s AND fecha >= %(ini)s AND fecha < %(fin)s
                    UNION ALL
                    SELECT id, (occurred_at - interval '3 hours')::date, amount, 'mercadopago', ''
                      FROM {_SCHEMA}.mp_payments
                     WHERE cliente_id = %(cid)s AND status = 'approved' AND amount IS NOT NULL
                       AND (occurred_at - interval '3 hours')::date >= %(ini)s
                       AND (occurred_at - interval '3 hours')::date < %(fin)s
                     ORDER BY 2
                """, {"cid": self._cliente_id, "ini": ini, "fin": fin})
                filas = [{"id": rid, "fecha": fecha.isoformat(), "monto": dos_decimales(monto),
                         "origen": origen, "cliente": cliente}
                        for rid, fecha, monto, origen, cliente in cur.fetchall()]
        return {"mes": clave, "lado": lado, "filas": filas}

    # ── gráfico 3: en qué se me va la plata (§2.3) — torta por categoría, un mes ────────────────────

    def torta_categorias(self, mes: str | None = None) -> dict:
        """`{tipo, periodo, serie:[{categoria, total}]}` — las 8 de `gasto_store.CATEGORIAS`, SIEMPRE
        las 8 (en `"0.00"` la que no tuvo gasto ese mes), mismo criterio anti-hueco que `_serie_mensual`
        con los meses: un gráfico que omite categorías sin dato hace parecer completa una torta que no
        lo es."""
        ini, fin, clave = self._mes_o_actual(mes)
        with self._conn_factory() as conn, conn.cursor() as cur:
            cur.execute(f"""
                SELECT categoria, coalesce(sum(monto), 0) FROM {_SCHEMA}.copiloto_gastos
                 WHERE cliente_id = %(cid)s AND fecha >= %(ini)s AND fecha < %(fin)s
                 GROUP BY 1
            """, {"cid": self._cliente_id, "ini": ini, "fin": fin})
            por_cat = {cat: Decimal(str(total or 0)) for cat, total in cur.fetchall()}
        serie = [{"categoria": cat, "total": dos_decimales(por_cat.get(cat, 0))} for cat in CATEGORIAS]
        return {"tipo": "torta", "periodo": clave, "serie": serie}

    def categoria_detalle(self, mes: str | None, categoria: str) -> dict:
        """Las filas de `copiloto_gastos` de UNA categoría en `mes` — el desglose de una porción."""
        if categoria not in CATEGORIAS:
            raise ValueError(f"categoría inválida: {categoria!r}")
        ini, fin, clave = self._mes_o_actual(mes)
        with self._conn_factory() as conn, conn.cursor() as cur:
            cur.execute(f"""
                SELECT id, fecha, monto, coalesce(nullif(proveedor, ''), ''), descripcion
                  FROM {_SCHEMA}.copiloto_gastos
                 WHERE cliente_id = %(cid)s AND categoria = %(cat)s
                   AND fecha >= %(ini)s AND fecha < %(fin)s
                 ORDER BY fecha
            """, {"cid": self._cliente_id, "cat": categoria, "ini": ini, "fin": fin})
            filas = [{"id": gid, "fecha": fecha.isoformat(), "monto": dos_decimales(monto),
                     "proveedor": prov, "descripcion": desc}
                    for gid, fecha, monto, prov, desc in cur.fetchall()]
        return {"mes": clave, "categoria": categoria, "filas": filas}

    # ── gráfico 4: cuánto me dejó cada trabajo (§2.4 + addendum de imputación) ─────────────────────
    #
    # «El trabajo no es una entidad nueva: es la cadena» (trabajo_store.py). Este gráfico no puede
    # reinventar esa resolución en SQL agregado —sería el segundo camino al mismo número que el §0
    # prohíbe—: arranca de TODA referencia que aparece en `copiloto_gastos`/`copiloto_cobros` (gasto
    # imputado o cobro), la sube a su raíz con `TrabajoStore.resolver()` (la MISMA función que usa la
    # ficha de un presupuesto), deduplica por raíz, y calcula cada margen con `TrabajoStore.margen()`
    # — cero fórmula propia, cero riesgo de contar un gasto en dos trabajos.

    def _candidatos_de_trabajo(self, cur) -> set[tuple[str, int]]:
        """`{(eslabon, ref)}` — un punto de partida por cada gasto imputado y cada cobro. Puede haber
        varios candidatos que resuelven a la MISMA raíz (ej. un gasto imputado a la factura y un cobro
        del mismo presupuesto); la deduplicación pasa en `margen_por_trabajo`, no acá."""
        candidatos: set[tuple[str, int]] = set()
        for columna, eslabon in (("presupuesto_ref", "presupuesto"), ("comprobante_ref", "comprobante"),
                                 ("cobro_ref", "cobro")):
            cur.execute(f"SELECT DISTINCT {columna} FROM {_SCHEMA}.copiloto_gastos "
                        f"WHERE cliente_id = %(cid)s AND {columna} IS NOT NULL",
                        {"cid": self._cliente_id})
            candidatos |= {(eslabon, ref) for (ref,) in cur.fetchall()}
        cur.execute(f"SELECT id, comprobante_id, presupuesto_ref FROM {_SCHEMA}.copiloto_cobros "
                    f"WHERE cliente_id = %(cid)s", {"cid": self._cliente_id})
        for cobro_id, comprobante_id, presupuesto_ref in cur.fetchall():
            if comprobante_id is not None:
                candidatos.add(("comprobante", comprobante_id))
            elif presupuesto_ref is not None:
                candidatos.add(("presupuesto", presupuesto_ref))
            else:
                candidatos.add(("cobro", cobro_id))
        return candidatos

    def _etiqueta_trabajo(self, cur, eslabon: str, ref: int) -> str:
        """Nombre legible para la barra: `{cliente} · {fecha}`. Un margen sin nombre es un número que
        nadie puede ubicar entre las otras barras."""
        if eslabon == "presupuesto":
            cur.execute(f"SELECT receptor_nombre, fecha FROM {_SCHEMA}.copiloto_presupuestos "
                        f"WHERE cliente_id=%(cid)s AND id=%(ref)s",
                        {"cid": self._cliente_id, "ref": ref})
            fila = cur.fetchone()
            nombre, fecha = (fila or ("", None))
            fecha_str = fecha.date().isoformat() if fecha else ""
        elif eslabon == "comprobante":
            cur.execute(f"SELECT coalesce(receptor_nombre, ''), fecha_emision FROM {_SCHEMA}.afip_comprobantes "
                        f"WHERE cliente_id=%(cid)s AND id=%(ref)s",
                        {"cid": self._cliente_id, "ref": ref})
            fila = cur.fetchone()
            nombre, fecha = (fila or ("", None))
            fecha_str = fecha.isoformat() if fecha else ""
        else:
            cur.execute(f"SELECT coalesce(cliente_nombre, ''), fecha FROM {_SCHEMA}.copiloto_cobros "
                        f"WHERE cliente_id=%(cid)s AND id=%(ref)s",
                        {"cid": self._cliente_id, "ref": ref})
            fila = cur.fetchone()
            nombre, fecha = (fila or ("", None))
            fecha_str = fecha.isoformat() if fecha else ""
        nombre = (nombre or "").strip()
        return f"{nombre} · {fecha_str}" if nombre else (fecha_str or f"{eslabon} #{ref}")

    def margen_por_trabajo(self) -> dict:
        """`{tipo, trabajos:[...], sin_ingreso:[...]}` — TODOS los trabajos con al menos un cobro o un
        gasto imputado, SIN filtro de período (un trabajo puede abarcar cualquier fecha). Los de
        `cobrado == 0` van en `sin_ingreso`, aparte, **nunca promediados** con los demás (addendum §4 /
        contrato §2: un margen incompleto se ve igual que uno malo)."""
        ts = TrabajoStore(self._conn_factory, self._cliente_id)
        with self._conn_factory() as conn, conn.cursor() as cur:
            candidatos = self._candidatos_de_trabajo(cur)
            raices: dict[tuple, tuple[str, int]] = {}
            for eslabon, ref in candidatos:
                cadena = ts.resolver(eslabon, ref)
                clave = (cadena["presupuesto"], cadena["comprobante"], tuple(sorted(cadena["cobros"])))
                if clave in raices:
                    continue
                if cadena["presupuesto"] is not None:
                    raices[clave] = ("presupuesto", cadena["presupuesto"])
                elif cadena["comprobante"] is not None:
                    raices[clave] = ("comprobante", cadena["comprobante"])
                else:
                    raices[clave] = ("cobro", cadena["cobros"][0])
            etiquetas = {(e, r): self._etiqueta_trabajo(cur, e, r) for e, r in raices.values()}
        trabajos, sin_ingreso = [], []
        for eslabon, ref in raices.values():
            m = ts.margen(eslabon, ref)
            base = {"eslabon": eslabon, "ref": ref, "etiqueta": etiquetas[(eslabon, ref)],
                   "gastos_imputados": m["gastos_imputados"],
                   # Hito 7 (detector): "días desde el último movimiento" — NO desde que empezó el
                   # trabajo, para no avisar de algo que sigue EN CURSO. Campo aditivo, opcional
                   # para quien no lo necesita (gráfico 4 del hito 6 lo ignora sin romperse).
                   "dias_desde_ultimo_movimiento": m["dias_desde_ultimo_movimiento"]}
            if Decimal(m["gastado"]) > 0 and Decimal(m["cobrado"]) == 0:
                sin_ingreso.append({**base, "gastado": m["gastado"]})
            else:
                trabajos.append({**base, "cobrado": m["cobrado"], "gastado": m["gastado"],
                                 "margen": m["margen"]})
        trabajos.sort(key=lambda t: Decimal(t["margen"]), reverse=True)
        return {"tipo": "barras", "trabajos": trabajos, "sin_ingreso": sin_ingreso}

    def margen_trabajo_detalle(self, eslabon: str, ref: int) -> dict:
        """El mismo objeto que `GET /trabajos/{eslabon}/{ref}/margen` — no una forma nueva (§0)."""
        return TrabajoStore(self._conn_factory, self._cliente_id).margen(eslabon, ref)
