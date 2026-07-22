"""Persistencia de GASTOS (capa CLIENTE, multi-tenant).

Mismo patrón que `presupuesto_store.py`: el `cliente_id` se fija en el constructor y **todas** las
consultas filtran por él. No se confía en RLS como única barrera — el rol de `DATABASE_URL` es dueño y
la bypassea; el filtro explícito es la barrera efectiva, y hay un test adversarial que lo ejercita.
"""
from __future__ import annotations

import datetime
from decimal import Decimal, InvalidOperation
from typing import Callable

_SCHEMA = "uc_factory"
_TABLE = f"{_SCHEMA}.copiloto_gastos"

CATEGORIAS = ("mercaderia", "servicios", "alquiler", "sueldos",
              "impuestos", "transporte", "herramientas", "otros")
ORIGENES = ("voz", "manual", "foto")

LIMITES = {"proveedor": 120, "medio_pago": 40, "descripcion": 500}

# El negocio es argentino (AFIP, MercadoPago, pesos): "hoy" es hoy EN ARGENTINA, no en UTC.
# A las 22:00 de Buenos Aires ya son las 01:00 UTC del día siguiente, así que con UTC un gasto
# cargado de noche cae en el día equivocado —y en el MES equivocado los días 30 y 31, que es donde
# rompe el resumen mensual, la única pantalla que justifica cargar gastos.
#
# Es hardcoding DELIBERADO y declarado, no un descuido: no existe zona horaria por tenant en ningún
# contrato de este repo (lo preguntó FRONTEND y ésta es la respuesta). El día que haya tenants fuera
# de Argentina, este es el único lugar a tocar.
ZONA_DEL_NEGOCIO = datetime.timezone(datetime.timedelta(hours=-3))

_COLS = ("id", "monto", "fecha", "categoria", "proveedor", "medio_pago", "descripcion",
         "origen", "monto_sugerido", "created_at")


def hoy_del_negocio() -> datetime.date:
    """La ÚNICA fuente de "hoy" para gastos.

    La columna `fecha` a propósito **no tiene DEFAULT en SQL**: un `DEFAULT current_date` lo evaluaría
    Postgres en la zona del servidor (UTC) y daría un día distinto al de esta función en las horas de
    la noche argentina. Dos definiciones de "hoy" que divergen 3 horas por día es exactamente el tipo
    de bug que aparece sólo a veces, de noche, y se cierra como "no reproducible".
    """
    return datetime.datetime.now(ZONA_DEL_NEGOCIO).date()


def dos_decimales(valor) -> str:
    """Los montos salen SIEMPRE como string con 2 decimales: el cliente los formatea sin convertir a
    número, porque el float de JS pierde centavos y esto suma plata."""
    try:
        d = Decimal(str(valor if valor is not None else 0))
    except (InvalidOperation, ValueError, TypeError):
        d = Decimal(0)
    return str(d.quantize(Decimal("0.01")))


class GastoStore:
    def __init__(self, conn_factory: Callable, cliente_id: str) -> None:
        self._conn_factory = conn_factory
        self._cliente_id = cliente_id

    def _fila(self, row) -> dict:
        g = dict(zip(_COLS, row))
        return {
            "id": g["id"],
            "monto": dos_decimales(g["monto"]),
            "fecha": g["fecha"].isoformat() if g["fecha"] else None,
            "categoria": g["categoria"],
            # Los opcionales viajan SIEMPRE, con null si no hay dato (contrato §4). En la base son
            # text NOT NULL DEFAULT '' —así no hay que distinguir '' de NULL al escribir— y acá el
            # vacío se traduce a null: un cliente que se defiende de dos formas del mismo objeto
            # termina defendiéndose mal de una.
            "proveedor": g["proveedor"] or None,
            "medio_pago": g["medio_pago"] or None,
            "descripcion": g["descripcion"] or None,
            "origen": g["origen"],
            # Lo que el OCR propuso, si vino de una foto. Sin esto, un monto aceptado de la sugerencia
            # queda indistinguible de uno tipeado a mano y dentro de un mes la pregunta "¿el OCR
            # acierta?" sólo se puede contestar con una impresión. Es el argumento de `origen`
            # aplicado a la foto, y lo pidió FRONTEND mientras todavía era gratis: agregarlo después
            # es migrar una tabla con datos. Null para voz y manual.
            "monto_sugerido": dos_decimales(g["monto_sugerido"]) if g["monto_sugerido"] is not None
                              else None,
            "creado_en": g["created_at"].isoformat() if g["created_at"] else None,
        }

    def crear(self, *, monto: Decimal, fecha: datetime.date | None = None,
              categoria: str = "otros", proveedor: str = "", medio_pago: str = "",
              descripcion: str = "", origen: str = "manual",
              monto_sugerido: Decimal | None = None) -> dict:
        with self._conn_factory() as conn, conn.cursor() as cur:
            cur.execute(
                f"INSERT INTO {_TABLE} (cliente_id, monto, fecha, categoria, proveedor, "
                f"medio_pago, descripcion, origen, monto_sugerido) "
                f"VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING {', '.join(_COLS)}",
                (self._cliente_id, monto, fecha or hoy_del_negocio(), categoria,
                 proveedor or "", medio_pago or "", descripcion or "", origen, monto_sugerido))
            return self._fila(cur.fetchone())

    def listar(self, *, limit: int = 50) -> tuple[list[dict], int]:
        """`(pagina, total_del_tenant)`. El total es el conteo completo, NO el largo de la página:
        el cliente lo usa para saber si hay más, y confundirlos hace que "37 gastos" diga 50."""
        with self._conn_factory() as conn, conn.cursor() as cur:
            cur.execute(f"SELECT {', '.join(_COLS)} FROM {_TABLE} WHERE cliente_id = %s "
                        f"ORDER BY fecha DESC, id DESC LIMIT %s", (self._cliente_id, limit))
            filas = [self._fila(r) for r in cur.fetchall()]
            cur.execute(f"SELECT count(*) FROM {_TABLE} WHERE cliente_id = %s", (self._cliente_id,))
            return filas, int(cur.fetchone()[0])

    def detalle(self, gasto_id: int) -> dict | None:
        with self._conn_factory() as conn, conn.cursor() as cur:
            cur.execute(f"SELECT {', '.join(_COLS)} FROM {_TABLE} "
                        f"WHERE cliente_id = %s AND id = %s", (self._cliente_id, gasto_id))
            row = cur.fetchone()
            return self._fila(row) if row else None

    def resumen(self, periodo: str | None = None) -> dict:
        """Total del mes + desglose por categoría + total del mes anterior.

        `periodo` es 'YYYY-MM'; default el mes en curso **del negocio** (ver ZONA_DEL_NEGOCIO)."""
        hoy = hoy_del_negocio()
        if periodo:
            anio, mes = int(periodo[:4]), int(periodo[5:7])
        else:
            anio, mes = hoy.year, hoy.month
        desde = datetime.date(anio, mes, 1)
        hasta = datetime.date(anio + (mes == 12), (mes % 12) + 1, 1)
        prev_desde = datetime.date(anio - (mes == 1), 12 if mes == 1 else mes - 1, 1)

        with self._conn_factory() as conn, conn.cursor() as cur:
            cur.execute(f"SELECT categoria, sum(monto) FROM {_TABLE} WHERE cliente_id = %s "
                        f"AND fecha >= %s AND fecha < %s GROUP BY categoria ORDER BY 2 DESC",
                        (self._cliente_id, desde, hasta))
            por_cat = cur.fetchall()
            cur.execute(f"SELECT sum(monto) FROM {_TABLE} WHERE cliente_id = %s "
                        f"AND fecha >= %s AND fecha < %s", (self._cliente_id, prev_desde, desde))
            anterior = cur.fetchone()[0]

        total = sum((Decimal(str(t)) for _, t in por_cat), Decimal(0))
        return {
            "periodo": f"{anio:04d}-{mes:02d}",
            "total": dos_decimales(total),
            # `porcentaje` es DECIMAL con una posición, y puede no sumar 100.00: tres categorías
            # iguales dan 33.3 tres veces. Se declara acá porque el cliente dibuja barras con esto y
            # necesita saber si puede confiar en la suma (no puede) — lo preguntó FRONTEND.
            "por_categoria": [
                {"categoria": c,
                 "total": dos_decimales(t),
                 "porcentaje": float(round(Decimal(str(t)) / total * 100, 1)) if total else 0.0}
                for c, t in por_cat],
            # null, no "0.00": "no hay datos del mes anterior" y "el mes anterior gastó cero" son
            # cosas distintas, y la app pinta una comparación sólo en el segundo caso.
            "mes_anterior": dos_decimales(anterior) if anterior is not None else None,
        }
