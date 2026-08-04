"""Registro de comprobantes emitidos (capa CLIENTE, multi-tenant).

Es el libro propio: qué se emitió, con qué CAE, y si después se anuló. **No reemplaza a AFIP como
fuente de verdad fiscal** — es la proyección local que permite listar "mis facturas" sin pegarle al web
service en cada pantalla, y resolver la idempotencia sin depender de una consulta remota.

Aislamiento: filtro explícito por `cliente_id` en cada query (el worker usa el rol owner, que bypassa RLS).
"""
from __future__ import annotations

from datetime import date, datetime
from typing import Callable

from psycopg2.extras import Json

from afip_rules import NOTAS_CREDITO
from evento_store import registrar_evento
from gasto_store import dos_decimales, hoy_del_negocio

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
                  receptor_nombre: str | None = None,
                  pdf_url: str | None = None, pdf_expira_at: datetime | None = None,
                  idem_key: str | None = None, workflow_id: str | None = None,
                  cbte_asoc_nro: int | None = None) -> int:
        """Alta idempotente: si el comprobante ya está registrado, actualiza en vez de duplicar.

        El `ON CONFLICT` va sobre (cliente_id, cuit, tipo_cbte, punto_venta, nro): un comprobante de
        AFIP es único por esa tupla. Si la activity se reintenta después de haber registrado, no
        explota ni crea una segunda fila.

        Devuelve el **`id` de fila** del comprobante (fresco o el que ya estaba): es lo que la app
        necesita para direccionar la factura —cargarle un cobro, abrir su detalle— y lo que la activity
        expone en su resultado para que la card de éxito ofrezca cobrar sin rebuscar por `(pv, nro)`.
        """
        conn = self._conn_factory()
        with conn.cursor() as cur:
            cur.execute(
                f"INSERT INTO {_TABLE} (cliente_id, cuit, tipo_cbte, punto_venta, nro, cae, cae_vto, "
                f"fecha_emision, doc_tipo, doc_nro, receptor_nombre, total, estado, pdf_url, "
                f"pdf_expira_at, idem_key, workflow_id, cbte_asoc_nro) "
                f"VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) "
                f"ON CONFLICT (cliente_id, cuit, tipo_cbte, punto_venta, nro) DO UPDATE SET "
                f"estado=EXCLUDED.estado, pdf_url=COALESCE(EXCLUDED.pdf_url, {_TABLE}.pdf_url), "
                f"pdf_expira_at=COALESCE(EXCLUDED.pdf_expira_at, {_TABLE}.pdf_expira_at), "
                f"cbte_asoc_nro=COALESCE(EXCLUDED.cbte_asoc_nro, {_TABLE}.cbte_asoc_nro) "
                f"RETURNING id, (xmax = 0) AS fue_insert",
                (self._cid, cuit, tipo_cbte, punto_venta, nro, cae, cae_vto, fecha_emision,
                 doc_tipo, doc_nro, receptor_nombre, total, estado, pdf_url, pdf_expira_at, idem_key,
                 workflow_id, cbte_asoc_nro))
            # 🔴 `EMITIO` (Negocio→Comprobante) + `FACTURADO_A` (→Cliente), §2.1, y el arranque de
            # `ESTADO_COMPROBANTE` en `emitida` (§2.2). Este método es un UPSERT llamado desde una
            # activity de Temporal, que **reintenta**: `RETURNING (xmax = 0)` distingue el INSERT fresco
            # (xmax=0) del camino ON CONFLICT DO UPDATE (xmax≠0, un retry o un re-registro de PDF/estado).
            # Se loggea SÓLO en el insert fresco: sin esto, cada reintento de la activity sumaría un
            # `EMITIO` duplicado de una factura que se emitió una sola vez. `Comprobante` es EVENTO, su
            # clave natural es la tupla que AFIP considera única (§1.2). ⚠️ Anular NO invalida `EMITIO`
            # (§2.2): eso lo maneja `marcar_anulada` como cambio de `ESTADO_COMPROBANTE`, no acá.
            comprobante_id, fue_insert = cur.fetchone()
            if fue_insert:
                registrar_evento(cur, self._cid, entidad_tipo="comprobante",
                                 entidad_id=f"{cuit}|{tipo_cbte}|{punto_venta}|{nro}",
                                 evento="emitido", campo="estado", valor_de=None, valor_a=estado,
                                 ocurrido_en=fecha_emision,
                                 datos={"tipo_cbte": tipo_cbte, "punto_venta": punto_venta, "nro": nro,
                                        "total": (None if total is None else str(total)),
                                        "fecha_emision": (fecha_emision.isoformat()
                                                          if fecha_emision else None),
                                        "receptor_nombre": receptor_nombre or "",
                                        "doc_tipo": doc_tipo, "doc_nro": doc_nro, "cae": cae})
        return comprobante_id

    def adjuntar_pdf(self, *, cuit: str, tipo_cbte: int, punto_venta: int, nro: int,
                     pdf_url: str, pdf_expira_at: datetime | None,
                     params_pdf: dict | None = None) -> None:
        """Adjunta el PDF a un comprobante YA registrado, sin tocar nada más.

        Existe porque usar `registrar()` para esto corrompía el estado: es un upsert completo y su
        `estado` tiene default "emitida", así que el `DO UPDATE` lo pisaba. El PDF se genera DESPUÉS
        de que la factura tiene CAE, y la anulación puede ocurrir en el medio — con lo cual una
        factura recién anulada volvía sola a "emitida" cuando terminaba de generarse su PDF.
        Detectado por el E2E HTTP el 2026-07-21.

        Una actualización parcial se escribe como UPDATE parcial. Un upsert "por reuso" es cómodo
        hasta que pisa una columna que otro camino acaba de escribir.

        `params_pdf` (opcional, default `None` no pisa lo existente vía `COALESCE`): el `params`
        COMPLETO que se le mandó al template de AfipSDK (items, receptor, emisor, totales). Sin esto
        una anulación no puede reconstruir el PDF de la nota de crédito — ver
        `_ensure_afip_comprobante_params_pdf_column` en `provision.py`.
        """
        conn = self._conn_factory()
        with conn.cursor() as cur:
            cur.execute(
                f"UPDATE {_TABLE} SET pdf_url=%s, pdf_expira_at=%s, "
                f"params_pdf_json=COALESCE(%s, params_pdf_json) "
                f"WHERE cliente_id=%s AND cuit=%s AND tipo_cbte=%s AND punto_venta=%s AND nro=%s",
                (pdf_url, pdf_expira_at, Json(params_pdf) if params_pdf is not None else None,
                 self._cid, cuit, tipo_cbte, punto_venta, nro))

    def adjuntar_drive(self, *, cuit: str, tipo_cbte: int, punto_venta: int, nro: int,
                       drive_file_id: str, drive_link: str | None) -> None:
        """Adjunta la copia en Drive. UPDATE parcial por el mismo motivo que `adjuntar_pdf`: el
        archivado ocurre después del CAE y una anulación puede pasar en el medio."""
        conn = self._conn_factory()
        with conn.cursor() as cur:
            cur.execute(
                f"UPDATE {_TABLE} SET drive_file_id=%s, drive_link=%s "
                f"WHERE cliente_id=%s AND cuit=%s AND tipo_cbte=%s AND punto_venta=%s AND nro=%s",
                (drive_file_id, drive_link, self._cid, cuit, tipo_cbte, punto_venta, nro))

    def get(self, *, cuit: str, tipo_cbte: int, punto_venta: int, nro: int) -> dict | None:
        conn = self._conn_factory()
        with conn.cursor() as cur:
            cur.execute(
                f"SELECT cuit, tipo_cbte, punto_venta, nro, cae, cae_vto, fecha_emision, total, "
                f"estado, pdf_url, cbte_asoc_nro, drive_file_id, drive_link, "
                f"doc_tipo, doc_nro, receptor_nombre, params_pdf_json FROM {_TABLE} "
                f"WHERE cliente_id=%s AND cuit=%s AND tipo_cbte=%s AND punto_venta=%s AND nro=%s",
                (self._cid, cuit, tipo_cbte, punto_venta, nro))
            row = cur.fetchone()
        return self._fila(row, con_params_pdf=True)

    def por_idem_key(self, idem_key: str) -> dict | None:
        """Dedup: ¿esta misma operación ya emitió un comprobante?

        Es la red de seguridad ante un reintento que ocurrió DESPUÉS de que AFIP autorizó pero ANTES
        de que nosotros lo diéramos por hecho. Emitir de nuevo ahí significa una factura duplicada.
        """
        conn = self._conn_factory()
        with conn.cursor() as cur:
            cur.execute(
                f"SELECT id, cuit, tipo_cbte, punto_venta, nro, cae, cae_vto, fecha_emision, total, "
                f"estado, pdf_url, cbte_asoc_nro, drive_file_id, drive_link, "
                f"doc_tipo, doc_nro, receptor_nombre FROM {_TABLE} "
                f"WHERE cliente_id=%s AND idem_key=%s", (self._cid, idem_key))
            row = cur.fetchone()
        # `con_id=True`: el dedup viaja de vuelta al workflow (`**ya` en `_emitir_sync`) y el resultado
        # que la app consume necesita el `id` de fila para direccionar la factura. Es una de las dos
        # consultas que `_fila` expone con id a propósito (la otra es `listar`).
        return self._fila(row, con_id=True)

    def listar(self, *, cuit: str, limite: int = 50) -> list[dict]:
        conn = self._conn_factory()
        with conn.cursor() as cur:
            cur.execute(
                f"SELECT id, cuit, tipo_cbte, punto_venta, nro, cae, cae_vto, fecha_emision, total, "
                f"estado, pdf_url, cbte_asoc_nro, drive_file_id, drive_link, "
                f"doc_tipo, doc_nro, receptor_nombre FROM {_TABLE} "
                f"WHERE cliente_id=%s AND cuit=%s ORDER BY created_at DESC LIMIT %s",
                (self._cid, cuit, int(limite)))
            filas = cur.fetchall()
        return [self._fila(f, con_id=True) for f in filas if f]

    def total_periodo(self, periodo: str | None = None) -> dict:
        """Facturado del período + acumulado de los ÚLTIMOS 12 MESES contando hacia atrás desde el
        período consultado (no año calendario — contrato hito-C §2). Las notas de crédito RESTAN:
        contrato master §2, "afip_comprobantes − notas de crédito" — sin esto una NC infla el
        facturado en vez de corregirlo. `NOTAS_CREDITO` (afip_rules.py) es la MISMA tupla de
        `tipo_cbte` que ya usa `tipo_nota_credito()`; no se reinventa el criterio de qué es una NC.
        Las anuladas no cuentan (mismo criterio que `impagos()` en cobro_store.py)."""
        hoy = hoy_del_negocio()
        if periodo:
            anio, mes = int(periodo[:4]), int(periodo[5:7])
        else:
            anio, mes = hoy.year, hoy.month
        desde = date(anio, mes, 1)
        hasta = date(anio + (mes == 12), (mes % 12) + 1, 1)
        # 12 meses hacia atrás CONTANDO el período consultado -- termina en `hasta` (excluyente).
        m0 = anio * 12 + (mes - 1) - 11
        desde_12 = date(m0 // 12, m0 % 12 + 1, 1)

        sql = (f"SELECT sum(CASE WHEN tipo_cbte = ANY(%s) THEN -total ELSE total END) "
              f"FROM {_TABLE} WHERE cliente_id = %s AND estado != %s "
              f"AND fecha_emision >= %s AND fecha_emision < %s")
        with self._conn_factory() as conn, conn.cursor() as cur:
            cur.execute(sql, (list(NOTAS_CREDITO), self._cid, ESTADO_ANULADA, desde, hasta))
            del_periodo = cur.fetchone()[0]
            cur.execute(sql, (list(NOTAS_CREDITO), self._cid, ESTADO_ANULADA, desde_12, hasta))
            doce_meses = cur.fetchone()[0]
        return {"periodo": dos_decimales(del_periodo), "doce_meses": dos_decimales(doce_meses)}

    def detalle_por_id(self, comprobante_id: int) -> dict | None:
        """Un comprobante por su **id de fila**, que es el único identificador que la app puede usar
        para direccionarlo.

        Existe porque faltaba: el listado devolvía comprobantes **sin id**, así que la pantalla de
        detalle sólo podía abrirse pasando el objeto entero, y nada que viniera de afuera —un ítem de
        «actividad reciente», un link, una notificación— tenía cómo apuntar a una factura. Lo cazó
        FRONTEND al cablear el tap: `"factura:42"` no ruteaba a ningún lado.

        Ojo con el otro espacio de ids: `/afip/facturas/{factura_id}` toma el **id del workflow** de
        emisión (`presu-12`, un uuid), que es otra cosa — ese sirve mientras se emite; éste, después.
        """
        conn = self._conn_factory()
        with conn.cursor() as cur:
            cur.execute(
                f"SELECT id, cuit, tipo_cbte, punto_venta, nro, cae, cae_vto, fecha_emision, total, "
                f"estado, pdf_url, cbte_asoc_nro, drive_file_id, drive_link, "
                f"doc_tipo, doc_nro, receptor_nombre FROM {_TABLE} "
                f"WHERE cliente_id=%s AND id=%s", (self._cid, comprobante_id))
            row = cur.fetchone()
        return self._fila(row, con_id=True)

    def con_cae_vigente(self) -> list[dict]:
        """Todos los comprobantes NO anulados con `cae_vto` cargado — hito 7 (detector proactivo,
        regla `cae_por_vencer`). `dias_para_vencer` sale de SQL (`cae_vto - CURRENT_DATE`, negativo
        si ya venció) para que el umbral de "por vencer" se decida en el detector, no acá: esta
        capa sólo trae el dato, no interpreta qué es "pronto"."""
        conn = self._conn_factory()
        with conn.cursor() as cur:
            cur.execute(
                f"SELECT id, nro, cae_vto, (cae_vto - CURRENT_DATE) FROM {_TABLE} "
                f"WHERE cliente_id=%s AND estado != %s AND cae_vto IS NOT NULL",
                (self._cid, ESTADO_ANULADA))
            filas = cur.fetchall()
        return [{"id": i, "nro": n, "cae_vto": v.isoformat() if v else None, "dias_para_vencer": d}
                for i, n, v, d in filas]

    def nota_credito_de(self, *, cuit: str, punto_venta: int, nro: int) -> int | None:
        """¿Existe ya una nota de crédito que apunte a este comprobante? Devuelve su número.

        **Por qué no alcanza con `estado == 'anulada'`.** Ese flag lo escribe `marcar_anulada`, un
        UPDATE que ocurre DESPUÉS de que la NC tiene CAE y que puede fallar por su cuenta (red, base
        caída, reintentos agotados). Si falla, la factura queda `emitida` ante nuestra base aunque
        fiscalmente ya esté neutralizada — y la validación R10, que sólo mira ese flag, deja pasar una
        SEGUNDA anulación: dos notas de crédito por una factura, el fisco acreditando el doble.

        Este puntero, en cambio, se escribe en el MISMO `registrar()` que guarda el CAE de la NC: si
        la nota de crédito existe en el libro, el puntero existe. Es un hecho derivado de la escritura
        que ya era imprescindible, no de una segunda escritura que puede perderse.

        Limitación consciente: la asociación se guarda como número suelto (`cbte_asoc_nro`), sin el
        tipo del original, así que el filtro es por `(punto_venta, nro)`. Alcanza para monotributo,
        donde el único tipo emitido es C. Si algún día se emiten A y B en el mismo punto de venta,
        hay que guardar también el tipo asociado.
        """
        conn = self._conn_factory()
        with conn.cursor() as cur:
            cur.execute(
                f"SELECT nro FROM {_TABLE} WHERE cliente_id=%s AND cuit=%s AND punto_venta=%s "
                f"AND cbte_asoc_nro=%s ORDER BY created_at LIMIT 1",
                (self._cid, cuit, punto_venta, nro))
            row = cur.fetchone()
        return int(row[0]) if row else None

    def marcar_anulada(self, *, cuit: str, tipo_cbte: int, punto_venta: int, nro: int,
                       nro_nota_credito: int) -> None:
        """Marca la factura original como anulada y deja el puntero a la NC que la anuló."""
        conn = self._conn_factory()
        with conn.cursor() as cur:
            # Estado previo, para el de→a del log Y para no re-loggear en un reintento de la activity.
            # El UPDATE de abajo queda EXACTO —método verificado E2E, no lo toco—: la condición de
            # loggear se decide con este SELECT, no cambiando el WHERE. Con autocommit son dos
            # sentencias, misma tolerancia best-effort que el resto del log (ver evento_store).
            cur.execute(f"SELECT estado FROM {_TABLE} WHERE cliente_id=%s AND cuit=%s "
                        f"AND tipo_cbte=%s AND punto_venta=%s AND nro=%s",
                        (self._cid, cuit, tipo_cbte, punto_venta, nro))
            prev = cur.fetchone()
            estado_previo = prev[0] if prev else None
            cur.execute(
                f"UPDATE {_TABLE} SET estado=%s, cbte_asoc_nro=%s "
                f"WHERE cliente_id=%s AND cuit=%s AND tipo_cbte=%s AND punto_venta=%s AND nro=%s",
                (ESTADO_ANULADA, nro_nota_credito, self._cid, cuit, tipo_cbte, punto_venta, nro))
            # `ESTADO_COMPROBANTE`: emitida → anulada (§2.2). NO invalida `EMITIO`: la factura se emitió
            # y eso sigue siendo cierto. Se loggea sólo si el estado REALMENTE cambió — un reintento
            # sobre una ya anulada tiene `estado_previo == anulada` y no re-loggea.
            if estado_previo is not None and estado_previo != ESTADO_ANULADA:
                registrar_evento(cur, self._cid, entidad_tipo="comprobante",
                                 entidad_id=f"{cuit}|{tipo_cbte}|{punto_venta}|{nro}",
                                 evento="estado_cambiado", campo="estado",
                                 valor_de=estado_previo, valor_a=ESTADO_ANULADA,
                                 datos={"nota_credito_nro": nro_nota_credito})

    @staticmethod
    def _fila(row, *, con_id: bool = False, con_params_pdf: bool = False) -> dict | None:
        """`con_id` es opt-in a propósito: las consultas que alimentan las activities de Temporal
        siguen devolviendo exactamente las mismas claves que antes. Agregar `id` a TODAS habría
        cambiado el payload que viaja por el workflow —y el shape del payload es parte del historial
        de ejecución—, para beneficiar sólo a las dos consultas que la app consume.

        `con_params_pdf` (mismo criterio): sólo `get()` lo pide — es el `params` completo del PDF
        (puede traer un `items` largo) y `listar()`/`por_idem_key()` no lo necesitan; agregarlo ahí
        infla cada resultado de activity sin beneficio."""
        if not row:
            return None
        campos = ("cuit", "tipo_cbte", "punto_venta", "nro", "cae", "cae_vto", "fecha_emision",
                  "total", "estado", "pdf_url", "cbte_asoc_nro", "drive_file_id", "drive_link",
                  "doc_tipo", "doc_nro", "receptor_nombre")
        if con_id:
            campos = ("id",) + campos
        if con_params_pdf:
            campos = campos + ("params_pdf_json",)
        d = dict(zip(campos, row))
        # `total` viene como Decimal de psycopg2: a str para que sea serializable por Temporal sin
        # perder precisión (float rompería centavos).
        if d.get("total") is not None:
            d["total"] = str(d["total"])
        for campo in ("cae_vto", "fecha_emision"):
            if d.get(campo) is not None:
                d[campo] = d[campo].isoformat()
        return d
