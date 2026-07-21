"""Presupuestos + sus ítems (capa CLIENTE, multi-tenant).

Postgres es la FUENTE DE VERDAD; el Google Doc y la fila del Sheet son PROYECCIONES. Si el usuario
borra el Doc, el presupuesto sigue completo y el botón Facturar sigue funcionando — por eso los ítems
viven estructurados acá y no sólo dentro de un documento que habría que re-parsear.

Dos propiedades se DERIVAN en SQL, no se guardan:

- `facturado`  = existe un comprobante con CAE cuyo `workflow_id` es el `factura_id` de este
  presupuesto. Guardarlo como flag exigiría que alguien lo actualice al emitir, y un borrador
  cancelado dejaría el flag mal puesto para siempre.
- `reemplazado_por` = quién me referencia con `reemplaza_a`. Calcularlo del lado del cliente sería
  correcto sólo si toda la cadena entró en la página pedida (hallazgo de la sesión frontend).

Aislamiento por tenant: filtro EXPLÍCITO por `cliente_id` en CADA query — el proceso usa el rol owner
de `DATABASE_URL`, que BYPASSA la policy RLS.
"""
from __future__ import annotations

from decimal import Decimal
from typing import Callable

_SCHEMA = "uc_factory"
_TABLE = f"{_SCHEMA}.copiloto_presupuestos"
_ITEMS = f"{_SCHEMA}.copiloto_presupuesto_items"
_COMPROBANTES = f"{_SCHEMA}.afip_comprobantes"

_COLS = ("id", "numero", "fecha", "concepto", "receptor_nombre", "receptor_doc_tipo",
         "receptor_doc_nro", "receptor_condicion_iva", "receptor_domicilio", "receptor_contacto",
         "total", "moneda", "doc_id", "doc_link", "sheet_fila", "reemplaza_a", "factura_id")

def workflow_id_de_factura(cliente_id: str, factura_id: str) -> str:
    """El `workflow_id` que `afip_comprobantes` guarda para una factura.

    ⚠️ NO es el `factura_id`. El id que ve el front es corto (`uuid4().hex`); el workflow se llama
    `factura-{cliente_id}-{factura_id}` porque el prefijo se reconstruye SIEMPRE con el tenant
    autenticado (ver `web._wf_id_factura`: si el front mandara el workflow_id completo, un tenant
    podría operar la factura de otro).

    Cruzar por el id corto daría `facturado: false` para SIEMPRE, sin error y sin log — el cruce
    simplemente no encontraría nada. `test_presupuesto_facturado.py` compara esta función contra
    `web._wf_id_factura` para que un cambio de formato allá rompa acá, ruidosamente.
    """
    return f"factura-{cliente_id}-{factura_id}"


# `facturado` cruza contra el comprobante REAL (el que tiene CAE), no contra el borrador. El link no
# necesitó ninguna columna nueva ni tocar el workflow de facturación: `afip_comprobantes.workflow_id`
# ya existía. Se arma en SQL el mismo id que construye `workflow_id_de_factura`.
_DERIVADOS = f"""
    EXISTS (SELECT 1 FROM {_COMPROBANTES} c
             WHERE c.cliente_id = p.cliente_id
               AND c.workflow_id = 'factura-' || p.cliente_id::text || '-' || p.factura_id)
        AS facturado,
    (SELECT r.id FROM {_TABLE} r
      WHERE r.cliente_id = p.cliente_id AND r.reemplaza_a = p.id
      ORDER BY r.id DESC LIMIT 1) AS reemplazado_por,
    (SELECT count(*) FROM {_ITEMS} i
      WHERE i.cliente_id = p.cliente_id AND i.presupuesto_id = p.id) AS cantidad_items
"""

_SELECT = (f"SELECT {', '.join('p.' + c for c in _COLS)}, {_DERIVADOS} FROM {_TABLE} p")

_CAMPOS_SALIDA = _COLS + ("facturado", "reemplazado_por", "cantidad_items")


def dos_decimales(valor) -> str:
    """Todo monto sale como string con EXACTAMENTE 2 decimales.

    Es plata: el `float` de JavaScript pierde precisión (`0.1+0.2 !== 0.3`), y un redondeo de un
    centavo en un presupuesto que después se factura es un problema fiscal. Fijar el formato además
    le permite al cliente formatear sin convertir a número — `"45000.00"`, nunca `"45000"`.
    """
    return str(Decimal(str(valor if valor is not None else 0)).quantize(Decimal("0.01")))


def _fila_a_dict(fila: tuple) -> dict:
    d = dict(zip(_CAMPOS_SALIDA, fila))
    return {
        "id": d["id"],
        "numero": d["numero"],
        "fecha": d["fecha"],
        "concepto": d["concepto"],
        "receptor": {
            "nombre": d["receptor_nombre"],
            "doc_tipo": d["receptor_doc_tipo"],
            "doc_nro": d["receptor_doc_nro"],
            "condicion_iva": d["receptor_condicion_iva"],
            "domicilio": d["receptor_domicilio"],
            "contacto": d["receptor_contacto"],
        },
        "total": dos_decimales(d["total"]),
        "moneda": d["moneda"],
        "doc_id": d["doc_id"],
        "doc_link": d["doc_link"],
        "sheet_fila": d["sheet_fila"],
        "reemplaza_a": d["reemplaza_a"],
        "reemplazado_por": d["reemplazado_por"],
        "factura_id": d["factura_id"],
        "facturado": bool(d["facturado"]),
        "cantidad_items": int(d["cantidad_items"] or 0),
    }


class PresupuestoStore:
    def __init__(self, conn_factory: Callable, cliente_id: str) -> None:
        self._conn_factory = conn_factory
        self._cid = cliente_id

    # --- escritura ---------------------------------------------------------------

    def crear(self, *, concepto: str, receptor: dict, items: list, moneda: str = "ARS",
              reemplaza_a: int | None = None) -> dict:
        """Alta del presupuesto + sus ítems, en UNA transacción.

        El `total` lo calcula ACÁ (Σ cantidad × precio_unitario) y se ignora cualquier total que venga
        del cliente: una sola fuente para la aritmética, o dos capas empiezan a discrepar por
        redondeo.

        El correlativo (`numero`) es por tenant y se calcula con `max(numero)+1` dentro de la misma
        transacción. Dos creaciones simultáneas pueden calcular el mismo número; el índice único
        (cliente_id, numero) hace fallar a la segunda en vez de duplicar el número en silencio, y el
        caller reintenta. Preferí eso a un lock: la colisión es rarísima (un solo usuario por tenant
        creando presupuestos) y un lock por tenant costaría en todas las altas para cubrir un caso que
        casi no pasa.
        """
        total = sum(Decimal(str(i.get("cantidad", 1))) * Decimal(str(i.get("precio_unitario", 0)))
                    for i in items)
        conn = self._conn_factory()
        with conn.cursor() as cur:
            cur.execute(f"SELECT COALESCE(max(numero), 0) + 1 FROM {_TABLE} WHERE cliente_id=%s",
                        (self._cid,))
            numero = cur.fetchone()[0]
            cur.execute(
                f"INSERT INTO {_TABLE} (cliente_id, numero, concepto, receptor_nombre, "
                f"receptor_doc_tipo, receptor_doc_nro, receptor_condicion_iva, receptor_domicilio, "
                f"receptor_contacto, total, moneda, reemplaza_a) "
                f"VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id",
                (self._cid, numero, concepto, receptor.get("nombre", ""),
                 receptor.get("doc_tipo"), receptor.get("doc_nro"),
                 receptor.get("condicion_iva"), receptor.get("domicilio"),
                 receptor.get("contacto"), total, moneda, reemplaza_a))
            presupuesto_id = cur.fetchone()[0]
            for orden, it in enumerate(items):
                cur.execute(
                    f"INSERT INTO {_ITEMS} (cliente_id, presupuesto_id, orden, descripcion, "
                    f"cantidad, precio_unitario, codigo) VALUES (%s,%s,%s,%s,%s,%s,%s)",
                    (self._cid, presupuesto_id, orden, str(it.get("descripcion", "")),
                     Decimal(str(it.get("cantidad", 1))),
                     Decimal(str(it.get("precio_unitario", 0))), str(it.get("codigo") or "")))
        return self.detalle(presupuesto_id) or {}

    def adjuntar_doc(self, presupuesto_id: int, *, doc_id: str | None, doc_link: str | None,
                     sheet_fila: str | None = None) -> None:
        """Pega el Doc y la fila del Sheet a un presupuesto YA creado.

        Va aparte del alta a propósito: generar el Doc habla con Google y puede fallar o tardar, y el
        presupuesto NO puede depender de eso para existir (misma decisión que el archivado del PDF en
        Drive). `COALESCE` para no borrar un valor previo con un `None` de un reintento parcial.
        """
        conn = self._conn_factory()
        with conn.cursor() as cur:
            cur.execute(
                f"UPDATE {_TABLE} SET doc_id=COALESCE(%s, doc_id), doc_link=COALESCE(%s, doc_link), "
                f"sheet_fila=COALESCE(%s, sheet_fila) WHERE cliente_id=%s AND id=%s",
                (doc_id, doc_link, sheet_fila, self._cid, presupuesto_id))

    def marcar_factura(self, presupuesto_id: int, factura_id: str) -> bool:
        """Ata el presupuesto al BORRADOR de factura que se armó desde él.

        Guarda `factura_id`, no un flag "facturado": el borrador puede cancelarse y entonces este
        presupuesto NUNCA se facturó. `facturado` se deriva del comprobante real (ver `_DERIVADOS`).

        Devuelve False si no tocó ninguna fila (el presupuesto no es de este tenant o no existe) — un
        UPDATE sobre 0 filas es un no-op silencioso y el endpoint necesita distinguirlo del éxito.
        """
        conn = self._conn_factory()
        with conn.cursor() as cur:
            cur.execute(f"UPDATE {_TABLE} SET factura_id=%s WHERE cliente_id=%s AND id=%s",
                        (factura_id, self._cid, presupuesto_id))
            return cur.rowcount > 0

    # --- lectura -----------------------------------------------------------------

    def listar(self, *, limit: int = 50, incluir_reemplazados: bool = False) -> list[dict]:
        """Listado para las cards, más nuevo primero. SIN ítems (para eso está `detalle`).

        Por default oculta los reemplazados: corregir tres veces un presupuesto dejaría cuatro cards
        del mismo trabajo sin forma de saber cuál vale. El filtro va en SQL (`NOT EXISTS`) y no en el
        cliente porque del lado del cliente sólo sería correcto si toda la cadena de reemplazos entró
        en la página pedida.
        """
        where = "WHERE p.cliente_id=%s"
        if not incluir_reemplazados:
            where += (f" AND NOT EXISTS (SELECT 1 FROM {_TABLE} r WHERE r.cliente_id=p.cliente_id "
                      f"AND r.reemplaza_a = p.id)")
        conn = self._conn_factory()
        with conn.cursor() as cur:
            cur.execute(f"{_SELECT} {where} ORDER BY p.fecha DESC, p.id DESC LIMIT %s",
                        (self._cid, limit))
            filas = cur.fetchall()
        return [_fila_a_dict(f) for f in filas]

    def detalle(self, presupuesto_id: int) -> dict | None:
        """El presupuesto CON sus ítems, o None si no existe **para este tenant**.

        No distingue "no existe" de "es de otro": las dos devuelven None y el endpoint responde 404.
        Confirmar que un id ajeno existe ya es filtrar información.
        """
        conn = self._conn_factory()
        with conn.cursor() as cur:
            cur.execute(f"{_SELECT} WHERE p.cliente_id=%s AND p.id=%s", (self._cid, presupuesto_id))
            fila = cur.fetchone()
            if not fila:
                return None
            presupuesto = _fila_a_dict(fila)
            cur.execute(
                f"SELECT orden, descripcion, cantidad, precio_unitario, codigo FROM {_ITEMS} "
                f"WHERE cliente_id=%s AND presupuesto_id=%s ORDER BY orden",
                (self._cid, presupuesto_id))
            presupuesto["items"] = [
                {"orden": o, "descripcion": d, "cantidad": dos_decimales(c),
                 "precio_unitario": dos_decimales(p), "codigo": cod or ""}
                for o, d, c, p, cod in cur.fetchall()]
        return presupuesto
