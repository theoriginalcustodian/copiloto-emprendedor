"""Registro de comprobantes emitidos (capa CLIENTE, multi-tenant).

Es el libro propio: qué se emitió, con qué CAE, y si después se anuló. **No reemplaza a AFIP como
fuente de verdad fiscal** — es la proyección local que permite listar "mis facturas" sin pegarle al web
service en cada pantalla, y resolver la idempotencia sin depender de una consulta remota.

Aislamiento: filtro explícito por `cliente_id` en cada query (el worker usa el rol owner, que bypassa RLS).
"""
from __future__ import annotations

from datetime import date, datetime
from typing import Callable

_TABLE = "uc_factory.afip_comprobantes"

ESTADO_EMITIDA = "emitida"
ESTADO_ANULADA = "anulada"
ESTADO_NOTA_CREDITO = "nota_credito"


class AfipComprobanteStore:
    def __init__(self, conn_factory: Callable, cliente_id: str) -> None:
        self._conn_factory = conn_factory
        self._cid = cliente_id

    def registrar(self, *, cuit: str, tipo_cbte: int, punto_venta: int, nro: int, cae: str,
                  cae_vto: date | None, fecha_emision: date | None, doc_tipo: int | None,
                  doc_nro: str | None, total, estado: str = ESTADO_EMITIDA,
                  pdf_url: str | None = None, pdf_expira_at: datetime | None = None,
                  idem_key: str | None = None, workflow_id: str | None = None,
                  cbte_asoc_nro: int | None = None) -> None:
        """Alta idempotente: si el comprobante ya está registrado, actualiza en vez de duplicar.

        El `ON CONFLICT` va sobre (cliente_id, cuit, tipo_cbte, punto_venta, nro): un comprobante de
        AFIP es único por esa tupla. Si la activity se reintenta después de haber registrado, no
        explota ni crea una segunda fila.
        """
        conn = self._conn_factory()
        with conn.cursor() as cur:
            cur.execute(
                f"INSERT INTO {_TABLE} (cliente_id, cuit, tipo_cbte, punto_venta, nro, cae, cae_vto, "
                f"fecha_emision, doc_tipo, doc_nro, total, estado, pdf_url, pdf_expira_at, idem_key, "
                f"workflow_id, cbte_asoc_nro) "
                f"VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) "
                f"ON CONFLICT (cliente_id, cuit, tipo_cbte, punto_venta, nro) DO UPDATE SET "
                f"estado=EXCLUDED.estado, pdf_url=COALESCE(EXCLUDED.pdf_url, {_TABLE}.pdf_url), "
                f"pdf_expira_at=COALESCE(EXCLUDED.pdf_expira_at, {_TABLE}.pdf_expira_at), "
                f"cbte_asoc_nro=COALESCE(EXCLUDED.cbte_asoc_nro, {_TABLE}.cbte_asoc_nro)",
                (self._cid, cuit, tipo_cbte, punto_venta, nro, cae, cae_vto, fecha_emision,
                 doc_tipo, doc_nro, total, estado, pdf_url, pdf_expira_at, idem_key,
                 workflow_id, cbte_asoc_nro))

    def adjuntar_pdf(self, *, cuit: str, tipo_cbte: int, punto_venta: int, nro: int,
                     pdf_url: str, pdf_expira_at: datetime | None) -> None:
        """Adjunta el PDF a un comprobante YA registrado, sin tocar nada más.

        Existe porque usar `registrar()` para esto corrompía el estado: es un upsert completo y su
        `estado` tiene default "emitida", así que el `DO UPDATE` lo pisaba. El PDF se genera DESPUÉS
        de que la factura tiene CAE, y la anulación puede ocurrir en el medio — con lo cual una
        factura recién anulada volvía sola a "emitida" cuando terminaba de generarse su PDF.
        Detectado por el E2E HTTP el 2026-07-21.

        Una actualización parcial se escribe como UPDATE parcial. Un upsert "por reuso" es cómodo
        hasta que pisa una columna que otro camino acaba de escribir.
        """
        conn = self._conn_factory()
        with conn.cursor() as cur:
            cur.execute(
                f"UPDATE {_TABLE} SET pdf_url=%s, pdf_expira_at=%s "
                f"WHERE cliente_id=%s AND cuit=%s AND tipo_cbte=%s AND punto_venta=%s AND nro=%s",
                (pdf_url, pdf_expira_at, self._cid, cuit, tipo_cbte, punto_venta, nro))

    def get(self, *, cuit: str, tipo_cbte: int, punto_venta: int, nro: int) -> dict | None:
        conn = self._conn_factory()
        with conn.cursor() as cur:
            cur.execute(
                f"SELECT cuit, tipo_cbte, punto_venta, nro, cae, cae_vto, fecha_emision, total, "
                f"estado, pdf_url, cbte_asoc_nro FROM {_TABLE} "
                f"WHERE cliente_id=%s AND cuit=%s AND tipo_cbte=%s AND punto_venta=%s AND nro=%s",
                (self._cid, cuit, tipo_cbte, punto_venta, nro))
            row = cur.fetchone()
        return self._fila(row)

    def por_idem_key(self, idem_key: str) -> dict | None:
        """Dedup: ¿esta misma operación ya emitió un comprobante?

        Es la red de seguridad ante un reintento que ocurrió DESPUÉS de que AFIP autorizó pero ANTES
        de que nosotros lo diéramos por hecho. Emitir de nuevo ahí significa una factura duplicada.
        """
        conn = self._conn_factory()
        with conn.cursor() as cur:
            cur.execute(
                f"SELECT cuit, tipo_cbte, punto_venta, nro, cae, cae_vto, fecha_emision, total, "
                f"estado, pdf_url, cbte_asoc_nro FROM {_TABLE} "
                f"WHERE cliente_id=%s AND idem_key=%s", (self._cid, idem_key))
            row = cur.fetchone()
        return self._fila(row)

    def listar(self, *, cuit: str, limite: int = 50) -> list[dict]:
        conn = self._conn_factory()
        with conn.cursor() as cur:
            cur.execute(
                f"SELECT cuit, tipo_cbte, punto_venta, nro, cae, cae_vto, fecha_emision, total, "
                f"estado, pdf_url, cbte_asoc_nro FROM {_TABLE} "
                f"WHERE cliente_id=%s AND cuit=%s ORDER BY created_at DESC LIMIT %s",
                (self._cid, cuit, int(limite)))
            filas = cur.fetchall()
        return [self._fila(f) for f in filas if f]

    def marcar_anulada(self, *, cuit: str, tipo_cbte: int, punto_venta: int, nro: int,
                       nro_nota_credito: int) -> None:
        """Marca la factura original como anulada y deja el puntero a la NC que la anuló."""
        conn = self._conn_factory()
        with conn.cursor() as cur:
            cur.execute(
                f"UPDATE {_TABLE} SET estado=%s, cbte_asoc_nro=%s "
                f"WHERE cliente_id=%s AND cuit=%s AND tipo_cbte=%s AND punto_venta=%s AND nro=%s",
                (ESTADO_ANULADA, nro_nota_credito, self._cid, cuit, tipo_cbte, punto_venta, nro))

    @staticmethod
    def _fila(row) -> dict | None:
        if not row:
            return None
        campos = ("cuit", "tipo_cbte", "punto_venta", "nro", "cae", "cae_vto", "fecha_emision",
                  "total", "estado", "pdf_url", "cbte_asoc_nro")
        d = dict(zip(campos, row))
        # `total` viene como Decimal de psycopg2: a str para que sea serializable por Temporal sin
        # perder precisión (float rompería centavos).
        if d.get("total") is not None:
            d["total"] = str(d["total"])
        for campo in ("cae_vto", "fecha_emision"):
            if d.get(campo) is not None:
                d[campo] = d[campo].isoformat()
        return d
