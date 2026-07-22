"""Persistencia de CLIENTES (capa CLIENTE, multi-tenant) — contrato `clientes` §3.

Mismo patrón que `gasto_store` / `presupuesto_store`: el `cliente_id` se fija en el constructor y
**todas** las consultas filtran por él. No se confía en RLS como única barrera — el rol de
`DATABASE_URL` es dueño y la bypassea; el filtro explícito es la barrera efectiva, y hay un test
adversarial que lo ejercita.
"""
from __future__ import annotations

import datetime
import re
import unicodedata
from typing import Callable

_SCHEMA = "uc_factory"
_TABLE = f"{_SCHEMA}.copiloto_clientes"

ORIGENES = ("derivado", "manual", "voz")
LIMITES = {"nombre": 200, "doc_nro": 20, "domicilio": 200, "contacto": 120, "notas": 500}

# Los códigos de documento son los de AFIP (`afip_rules.TipoDoc`), no un catálogo paralelo: el día que
# se le factura a este cliente tienen que entrar tal cual al WSFE.
DOC_CUIT = 80
DOC_DNI = 96
DOC_CONSUMIDOR_FINAL = 99

_COLS = ("id", "nombre", "nombre_normalizado", "doc_tipo", "doc_nro", "condicion_iva",
         "domicilio", "contacto", "notas", "origen", "created_at")


def normalizar_nombre(nombre: str) -> str:
    """La clave de deduplicación cuando NO hay documento: minúsculas, sin tildes, sin puntuación,
    espacios colapsados. `"Panadería  Los Tilos."` → `panaderia los tilos`.

    Es una función pura y está acá arriba a propósito: el valor se calcula en Python y se guarda en la
    columna, en vez de calcularse dentro del índice. Un índice sobre una expresión ata la regla de
    deduplicación al DDL, y cambiarla obliga a un REINDEX de una tabla viva; con la columna, cambiar la
    regla es un UPDATE. Y sobre todo: acá se puede leer, testear y explicar.
    """
    sin_tildes = "".join(c for c in unicodedata.normalize("NFD", nombre or "")
                         if unicodedata.category(c) != "Mn")
    sin_puntuacion = re.sub(r"[^\w\s]", " ", sin_tildes, flags=re.UNICODE)
    return re.sub(r"\s+", " ", sin_puntuacion).strip().lower()


def es_consumidor_final(doc_tipo) -> bool:
    """🔴 Contrato §3.2: un comprobante a consumidor final NO genera cliente.

    El WSFE acepta emitir a consumidor final **sin nombre, sin documento y sin domicilio**
    (`afip_rules.py`). Si la deduplicación fuera sólo por documento, todas esas ventas colapsarían en
    un ÚNICO registro con `doc_nro` vacío — un cliente fantasma con el grueso de la facturación
    adentro, que además encabezaría el ranking de mejores clientes de Contabilidad.

    Una venta a consumidor final es una venta SIN cliente, que es exactamente lo que es. La cartera va
    a tener menos entradas que ventas, y eso es la verdad de un negocio que le vende a la gente de la
    calle.
    """
    return doc_tipo is not None and int(doc_tipo) == DOC_CONSUMIDOR_FINAL


class ClienteStore:
    def __init__(self, conn_factory: Callable, cliente_id: str) -> None:
        self._conn_factory = conn_factory
        self._cliente_id = cliente_id

    def _fila(self, row) -> dict:
        c = dict(zip(_COLS, row))
        return {
            "id": c["id"],
            "nombre": c["nombre"],
            # Los opcionales viajan SIEMPRE, con null si no hay dato. Misma forma que gastos, por lo
            # mismo: un objeto que cambia de forma según el caso obliga al cliente a defenderse de dos
            # maneras del mismo dato.
            "doc_tipo": c["doc_tipo"],
            "doc_nro": c["doc_nro"] or None,
            "condicion_iva": c["condicion_iva"],
            "domicilio": c["domicilio"] or None,
            "contacto": c["contacto"] or None,
            "notas": c["notas"] or None,
            "origen": c["origen"],
            # `creado_en`, no `creado_at`: es el único deletreo que existe en esta API (`gasto_store`).
            # Dos deletreos del mismo concepto producen el bug silencioso favorito de este repo — el
            # normalizador lee la clave que no vino, cae al default, y el dato desaparece sin error.
            "creado_en": c["created_at"].isoformat() if c["created_at"] else None,
        }

    def listar(self, *, q: str = "", limit: int = 50) -> tuple[list[dict], int]:
        """`(pagina, total_del_tenant)`. El total es el conteo completo, NO el largo de la página."""
        patron = f"%{normalizar_nombre(q)}%" if q else None
        with self._conn_factory() as conn, conn.cursor() as cur:
            if patron:
                cur.execute(f"SELECT {', '.join(_COLS)} FROM {_TABLE} WHERE cliente_id = %s "
                            f"AND nombre_normalizado LIKE %s ORDER BY nombre_normalizado LIMIT %s",
                            (self._cliente_id, patron, limit))
            else:
                cur.execute(f"SELECT {', '.join(_COLS)} FROM {_TABLE} WHERE cliente_id = %s "
                            f"ORDER BY nombre_normalizado LIMIT %s", (self._cliente_id, limit))
            filas = [self._fila(r) for r in cur.fetchall()]
            cur.execute(f"SELECT count(*) FROM {_TABLE} WHERE cliente_id = %s", (self._cliente_id,))
            return filas, int(cur.fetchone()[0])

    def detalle(self, cliente: int) -> dict | None:
        with self._conn_factory() as conn, conn.cursor() as cur:
            cur.execute(f"SELECT {', '.join(_COLS)} FROM {_TABLE} "
                        f"WHERE cliente_id = %s AND id = %s", (self._cliente_id, cliente))
            row = cur.fetchone()
            return self._fila(row) if row else None
