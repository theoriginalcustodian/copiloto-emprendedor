"""Persistencia de CLIENTES (capa CLIENTE, multi-tenant) — contrato `clientes` §3.

Mismo patrón que `gasto_store` / `presupuesto_store`: el `cliente_id` se fija en el constructor y
**todas** las consultas filtran por él. No se confía en RLS como única barrera — el rol de
`DATABASE_URL` es dueño y la bypassea; el filtro explícito es la barrera efectiva, y hay un test
adversarial que lo ejercita.
"""
from __future__ import annotations

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


def normalizar_documento(doc_nro) -> str:
    """El documento se guarda **sólo con dígitos**: `"30-71234567-8"` → `"30712345678"`.

    No es cosmética, es la clave de deduplicación. El emprendedor dicta y tipea el CUIT como sale en
    el papel —con guiones, con puntos, a veces con espacios— y el mismo CUIT escrito de dos maneras
    son dos filas distintas para el índice único: el duplicado que §3.3 existe para impedir entraría
    por la puerta de al lado, sin chocar contra nada.

    Se normaliza en UN lugar y lo usan los tres caminos (alta a mano, voz, backfill), por lo mismo:
    tres normalizaciones parecidas divergen, y la que diverja crea el duplicado.
    """
    return re.sub(r"\D", "", str(doc_nro or ""))


def inferir_doc_tipo(doc_nro: str) -> int | None:
    """El tipo desde el largo del número, cuando el que carga no lo dijo. 11 dígitos = CUIT,
    7 u 8 = DNI, cualquier otra cosa = None (y el handler responde 400).

    **No es adivinar el dato: es derivarlo de un formato que no se solapa.** No existe un DNI de 11
    dígitos ni un CUIT de 8, así que dentro de datos válidos la derivación es total. La alternativa
    —exigir `doc_tipo` cada vez que viene un número— traba el caso más común (el que escribe el CUIT
    y nada más) por un dato que el propio número ya contiene.
    """
    largo = len(normalizar_documento(doc_nro))
    if largo == 11:
        return DOC_CUIT
    if largo in (7, 8):
        return DOC_DNI
    return None


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


class ClienteDuplicado(Exception):
    """La clave de deduplicación ya es de otro cliente. Trae la **ficha entera del dueño**, no sólo su
    id: el contrato §3.4 pide que la app diga *«ese documento ya es de Juan Pérez — ¿querés abrirlo?»*,
    y con el id pelado la app tendría que hacer un segundo GET para poder nombrarlo."""

    def __init__(self, duenio: dict | None, por: str) -> None:
        super().__init__(f"ya existe un cliente con ese {por}")
        self.duenio = duenio
        self.por = por            # "documento" | "nombre"


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

    # ── hito 3: alta, edición parcial y el choque contra el índice ────────────────────────────────

    def _duenio_de_la_clave(self, doc_tipo, doc_nro: str, normalizado: str) -> tuple[dict | None, str]:
        """Quién tiene hoy la clave con la que se acaba de chocar. **Se busca por la MISMA clave que
        usa el índice**, no por «algo parecido»: si el índice que reventó fue el del documento, el
        dueño es el del documento — con nombre distinto y todo, que es justamente el caso de §3.4."""
        con_doc = bool(doc_nro) and not es_consumidor_final(doc_tipo)
        with self._conn_factory() as conn, conn.cursor() as cur:
            if con_doc:
                cur.execute(f"SELECT {', '.join(_COLS)} FROM {_TABLE} WHERE cliente_id = %s "
                            f"AND doc_tipo = %s AND doc_nro = %s",
                            (self._cliente_id, doc_tipo, doc_nro))
            else:
                cur.execute(f"SELECT {', '.join(_COLS)} FROM {_TABLE} WHERE cliente_id = %s "
                            f"AND nombre_normalizado = %s AND (doc_nro IS NULL OR doc_nro = '')",
                            (self._cliente_id, normalizado))
            row = cur.fetchone()
        return (self._fila(row) if row else None), ("documento" if con_doc else "nombre")

    def crear(self, *, nombre: str, doc_tipo=None, doc_nro: str = "", condicion_iva=None,
              domicilio: str = "", contacto: str = "", notas: str = "",
              origen: str = "manual") -> dict:
        """Alta. Si la clave ya existe, levanta `ClienteDuplicado` con la ficha del dueño.

        🔴 **El duplicado lo detecta el ÍNDICE, no un `SELECT` previo.** Un «busco y si no está, lo
        creo» tiene una ventana entre las dos operaciones, y acá el caso que la abre es concreto: el
        backfill recorriendo presupuestos mientras el emprendedor da de alta al mismo cliente. Este
        repo ya pagó esa lección con **dos facturas con CAE del mismo trabajo**
        (`memoria/idempotencia-con-un-if-tiene-ventana.md`). Acá se inserta, se choca, y recién
        entonces se lee quién ganó — la atomicidad la pone Postgres, que es el único que puede.
        """
        normalizado = normalizar_nombre(nombre)
        doc = normalizar_documento(doc_nro)
        try:
            with self._conn_factory() as conn, conn.cursor() as cur:
                cur.execute(
                    f"INSERT INTO {_TABLE} (cliente_id, nombre, nombre_normalizado, doc_tipo, "
                    f"doc_nro, condicion_iva, domicilio, contacto, notas, origen) "
                    f"VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING {', '.join(_COLS)}",
                    (self._cliente_id, nombre, normalizado, doc_tipo, doc, condicion_iva,
                     domicilio or "", contacto or "", notas or "", origen))
                return self._fila(cur.fetchone())
        except Exception as exc:
            # `23505` es `unique_violation` en SQLSTATE. Se compara el CÓDIGO y no se importa
            # `psycopg2.errors` para que este módulo siga importándose sin la librería instalada —
            # los tests de la capa web corren con un store falso y no deberían necesitar la base.
            if getattr(exc, "pgcode", None) != "23505":
                raise
            duenio, por = self._duenio_de_la_clave(doc_tipo, doc, normalizado)
            raise ClienteDuplicado(duenio, por) from None

    def editar(self, cliente: int, cambios: dict) -> dict | None:
        """Edición **parcial**: se tocan únicamente las claves presentes en `cambios`.

        🔴 La diferencia entre «la clave no vino» y «la clave vino en null» es intencional y la
        resuelve el llamador (`exclude_unset` de pydantic): ausente = no se toca, `null` = borrar.
        Mandar el objeto entero con los vacíos **borra** lo que había — incluido el domicilio que vino
        de las facturas de AFIP, que ningún formulario muestra porque nadie lo cargó a mano.

        Devuelve `None` si el cliente no existe **o es de otro tenant** (el `WHERE cliente_id` está en
        el propio UPDATE: un id ajeno no actualiza nada y sale 404, nunca 403).
        """
        campos = {k: v for k, v in cambios.items()
                  if k in ("nombre", "doc_tipo", "doc_nro", "condicion_iva",
                           "domicilio", "contacto", "notas")}
        if not campos:
            return self.detalle(cliente)

        if "nombre" in campos:
            # El normalizado es un DERIVADO del nombre, no un campo editable: si se actualizara uno
            # sin el otro, la dedup por nombre pasaría a comparar contra un valor viejo y dejaría
            # entrar el duplicado que existe para bloquear.
            campos["nombre_normalizado"] = normalizar_nombre(campos["nombre"] or "")
        if "doc_nro" in campos:
            campos["doc_nro"] = normalizar_documento(campos["doc_nro"])
            if campos["doc_nro"] and campos.get("doc_tipo") is None and "doc_tipo" not in cambios:
                campos["doc_tipo"] = inferir_doc_tipo(campos["doc_nro"])
        for texto in ("domicilio", "contacto", "notas"):
            if texto in campos and campos[texto] is None:
                campos[texto] = ""      # la columna es NOT NULL DEFAULT '' (ver `_fila`)

        sets = ", ".join(f"{k} = %s" for k in campos)
        try:
            with self._conn_factory() as conn, conn.cursor() as cur:
                cur.execute(f"UPDATE {_TABLE} SET {sets} WHERE cliente_id = %s AND id = %s "
                            f"RETURNING {', '.join(_COLS)}",
                            (*campos.values(), self._cliente_id, cliente))
                row = cur.fetchone()
                return self._fila(row) if row else None
        except Exception as exc:
            if getattr(exc, "pgcode", None) != "23505":
                raise
            actual = self.detalle(cliente) or {}
            doc = campos.get("doc_nro", normalizar_documento(actual.get("doc_nro")))
            tipo = campos.get("doc_tipo", actual.get("doc_tipo"))
            nombre = campos.get("nombre_normalizado",
                                normalizar_nombre(actual.get("nombre") or ""))
            duenio, por = self._duenio_de_la_clave(tipo, doc, nombre)
            raise ClienteDuplicado(duenio, por) from None
