"""Persistencia del CATÁLOGO DE CONCEPTOS — lo que el negocio vende (capa CLIENTE, multi-tenant).

**El hueco 3 del hito 3.** Hoy lo único que existe es `copiloto_perfil_negocio.que_vende`: **un texto
libre de 500 caracteres** ("Instalaciones eléctricas"). Es una frase, no una lista.

Sin catálogo, el nodo `Concepto` del grafo (hito 5) tendría que salir del texto libre de los ítems de
presupuesto — y *«pintura de living»*, *«pintar el living»* y *«living - pintura»* serían **tres
conceptos distintos, con la serie de precios partida en tres**. Justo lo que el grafo viene a evitar.

`que_vende` **no se toca**: sigue siendo la descripción del negocio para el system prompt. El catálogo
es otra cosa y vive aparte.

🔴 **El precio del catálogo es de REFERENCIA.** El presupuesto congela el suyo al emitirse. Si cambiar
el precio de referencia cambiara los presupuestos viejos se reescribiría la historia — y el grafo se
apoya en esa historia. Este store no toca presupuestos ni ítems: esa es toda la garantía, y tiene su
test.
"""
from __future__ import annotations

from decimal import Decimal, InvalidOperation
from typing import Callable

from cliente_store import normalizar_nombre

_SCHEMA = "uc_factory"
_TABLE = f"{_SCHEMA}.copiloto_conceptos"

_COLS = ("id", "nombre", "nombre_normalizado", "precio_referencia", "activo",
         "created_at", "updated_at")

LARGO_NOMBRE = 120


class ConceptoInvalido(ValueError):
    """Nombre vacío o precio ilegible. Lo traduce a 400 la capa web."""


class ConceptoDuplicado(Exception):
    """Ya existe un concepto con ese nombre. Lleva la ficha del que ya está — mismo patrón que
    Clientes: el 409 no dice sólo "ya existe", trae con qué chocaste, así la app puede ofrecer
    abrirlo en vez de dejar al emprendedor adivinando."""

    def __init__(self, existente: dict) -> None:
        super().__init__("ya existe un concepto con ese nombre")
        self.existente = existente


def _precio(valor):
    if valor in (None, ""):
        return None
    try:
        d = Decimal(str(valor)).quantize(Decimal("0.01"))
    except (InvalidOperation, ValueError, TypeError):
        raise ConceptoInvalido("el precio de referencia no es un número válido")
    if d < 0:
        raise ConceptoInvalido("el precio de referencia no puede ser negativo")
    return d


class ConceptoStore:
    def __init__(self, conn_factory: Callable, cliente_id: str) -> None:
        self._conn_factory = conn_factory
        self._cliente_id = cliente_id

    def _fila(self, row) -> dict:
        c = dict(zip(_COLS, row))
        return {"id": c["id"], "nombre": c["nombre"],
                # El precio viaja como string con 2 decimales o `null` — nunca como número: el float
                # de JS pierde centavos, y de acá salen los importes que se proponen en un presupuesto.
                "precio_referencia": (None if c["precio_referencia"] is None
                                      else str(Decimal(str(c["precio_referencia"])).quantize(Decimal("0.01")))),
                "activo": bool(c["activo"])}

    def listar(self, *, incluir_inactivos: bool = False) -> list[dict]:
        with self._conn_factory() as conn, conn.cursor() as cur:
            sql = (f"SELECT {', '.join(_COLS)} FROM {_TABLE} WHERE cliente_id = %s")
            if not incluir_inactivos:
                sql += " AND activo"
            sql += " ORDER BY nombre_normalizado"
            cur.execute(sql, (self._cliente_id,))
            return [self._fila(r) for r in cur.fetchall()]

    def obtener(self, concepto_id: int) -> dict | None:
        with self._conn_factory() as conn, conn.cursor() as cur:
            cur.execute(f"SELECT {', '.join(_COLS)} FROM {_TABLE} "
                        f"WHERE cliente_id = %s AND id = %s", (self._cliente_id, concepto_id))
            fila = cur.fetchone()
            return self._fila(fila) if fila else None

    def crear(self, nombre: str, precio_referencia=None) -> dict:
        limpio = (nombre or "").strip()[:LARGO_NOMBRE]
        if not limpio:
            raise ConceptoInvalido("el concepto necesita un nombre")
        normalizado = normalizar_nombre(limpio)
        precio = _precio(precio_referencia)
        with self._conn_factory() as conn, conn.cursor() as cur:
            try:
                cur.execute(f"INSERT INTO {_TABLE} "
                            f"(cliente_id, nombre, nombre_normalizado, precio_referencia) "
                            f"VALUES (%s, %s, %s, %s) RETURNING {', '.join(_COLS)}",
                            (self._cliente_id, limpio, normalizado, precio))
            except Exception as exc:
                # `23505` = unique_violation, por CÓDIGO y no por el texto del mensaje (que cambia con
                # la versión de Postgres y el locale).
                if getattr(exc, "pgcode", None) != "23505":
                    raise
                conn.rollback()
                with conn.cursor() as c2:
                    c2.execute(f"SELECT {', '.join(_COLS)} FROM {_TABLE} "
                               f"WHERE cliente_id = %s AND nombre_normalizado = %s",
                               (self._cliente_id, normalizado))
                    fila = c2.fetchone()
                raise ConceptoDuplicado(self._fila(fila) if fila else {})
            return self._fila(cur.fetchone())

    def editar(self, concepto_id: int, datos: dict) -> dict | None:
        """Edición **parcial de verdad**: sólo se toca lo que viene en `datos`.

        La clave ausente deja el campo como está; `precio_referencia: null` explícito lo borra. Es la
        misma regla que en Clientes, y existe porque la app manda sólo el campo que el emprendedor
        tocó — si acá se armara el UPDATE con todas las columnas, guardar el nombre borraría el precio.
        """
        sets, valores = [], []
        if "nombre" in datos:
            limpio = (datos["nombre"] or "").strip()[:LARGO_NOMBRE]
            if not limpio:
                raise ConceptoInvalido("el concepto necesita un nombre")
            sets += ["nombre = %s", "nombre_normalizado = %s"]
            valores += [limpio, normalizar_nombre(limpio)]
        if "precio_referencia" in datos:
            sets.append("precio_referencia = %s")
            valores.append(_precio(datos["precio_referencia"]))
        if "activo" in datos:
            sets.append("activo = %s")
            valores.append(bool(datos["activo"]))
        if not sets:
            return self.obtener(concepto_id)
        sets.append("updated_at = now()")
        with self._conn_factory() as conn, conn.cursor() as cur:
            try:
                cur.execute(f"UPDATE {_TABLE} SET {', '.join(sets)} "
                            f"WHERE cliente_id = %s AND id = %s RETURNING {', '.join(_COLS)}",
                            (*valores, self._cliente_id, concepto_id))
            except Exception as exc:
                if getattr(exc, "pgcode", None) != "23505":
                    raise
                conn.rollback()
                with conn.cursor() as c2:
                    c2.execute(f"SELECT {', '.join(_COLS)} FROM {_TABLE} "
                               f"WHERE cliente_id = %s AND nombre_normalizado = %s",
                               (self._cliente_id, normalizar_nombre(datos.get("nombre") or "")))
                    fila = c2.fetchone()
                raise ConceptoDuplicado(self._fila(fila) if fila else {})
            fila = cur.fetchone()
            return self._fila(fila) if fila else None

    def desactivar(self, concepto_id: int) -> dict | None:
        """`DELETE` en la web **desactiva**, no borra.

        Un concepto borrado de verdad dejaría los presupuestos viejos apuntando a la nada y le
        arrancaría al grafo la serie histórica de ese precio — que es el dato que el catálogo existe
        para poder tener.
        """
        return self.editar(concepto_id, {"activo": False})
