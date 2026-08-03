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

import os
from contextlib import contextmanager
from decimal import Decimal
from typing import Callable

from evento_store import registrar_evento


@contextmanager
def _transaccion(conn):
    """Agrupa varias sentencias en UNA transacción real sobre una conexión autocommit.

    🔴 **Existía la palabra, no el mecanismo.** El docstring de `crear` decía "en UNA transacción" y
    "dentro de la misma transacción", pero la conexión viene con `autocommit=True`
    (`serve.py::_conn_factory_from_env`): cada `execute` se confirmaba solo. Un fallo entre el INSERT
    de la cabecera y el de los ítems —un ítem con un decimal inválido alcanza— dejaba un presupuesto
    guardado **sin lo presupuestado**, que es exactamente lo que la pantalla de detalle no puede
    mostrar. Una afirmación de atomicidad que el código no cumple es peor que no afirmarla: nadie
    vuelve a revisarla.

    Se restaura el `autocommit` previo al salir: la conexión sale de una fábrica que crea una nueva
    por invocación, así que nadie más la comparte, pero devolverla como vino evita que el próximo uso
    dependa de por dónde pasó ésta.
    """
    previo = conn.autocommit
    conn.autocommit = False
    try:
        yield
        conn.commit()
    except BaseException:
        conn.rollback()
        raise
    finally:
        conn.autocommit = previo

_SCHEMA = "uc_factory"
_TABLE = f"{_SCHEMA}.copiloto_presupuestos"
_ITEMS = f"{_SCHEMA}.copiloto_presupuesto_items"
_COMPROBANTES = f"{_SCHEMA}.afip_comprobantes"

_COLS = ("id", "numero", "fecha", "concepto", "receptor_nombre", "receptor_doc_tipo",
         "receptor_doc_nro", "receptor_condicion_iva", "receptor_domicilio", "receptor_contacto",
         "total", "moneda", "doc_id", "doc_link", "reemplaza_a", "factura_id",
         "estado", "estado_actualizado_en")

# TODO(sheet-fila-drop, backend, 2026-08-03): DEUDA DELIBERADA Y VISIBLE, paso 1 de 2 pagado -- mismo
# patrón que `contacto` en `provision.py` (`_migrar_clientes_contacto_a_email_telefono`). La columna
# `sheet_fila` de `copiloto_presupuestos` (uc_tables.json) queda HUÉRFANA acá (fuera de `_COLS`, ya no
# se lee ni se escribe -- el Sheet de trazabilidad se descartó, `COPILOTO_PRESUPUESTOS_SHEET_ID` nunca
# se configuró y la columna siempre fue null en todo tenant). El `DROP COLUMN` -- irreversible sobre
# una base viva, aunque acá no haya NINGUNA fila con dato adentro -- queda pendiente del OK del
# operador, no se hace unilateral. Propietario: BACKEND.

# ── El estado del presupuesto (hueco 2 del hito 3) ───────────────────────────────────────────────
#
# TRES categorías, siempre: ganado / perdido / **no sé**. Si los no-marcados contaran como rechazos,
# la tasa de conversión diría que se pierde el 80% de los presupuestos cuando en realidad no se sabe
# qué pasó — y un número mal una sola vez hace que el emprendedor no vuelva a mirar la pantalla.
PENDIENTE, APROBADO, DESESTIMADO = "pendiente", "aprobado", "desestimado"
ESTADOS = (PENDIENTE, APROBADO, DESESTIMADO)

# Transiciones válidas. Las dos que faltan son deliberadas:
#   · `desestimado → aprobado` NO existe: se emite un presupuesto nuevo (contrato §2.2). Revivir uno
#     rechazado dejaría el precio y el alcance viejos con un "sí" nuevo encima.
#   · `→ pendiente` NO existe desde ningún lado: volver a "no sé" **borra información** que alguien
#     declaró. Si se marcó por error, el camino es marcar lo correcto, no fingir que no se sabe.
TRANSICIONES = {PENDIENTE: (APROBADO, DESESTIMADO),
                APROBADO: (DESESTIMADO,),
                DESESTIMADO: ()}

# `sin_respuesta` es un MATIZ de "pendiente", no un cuarto estado, y **se calcula** — no se guarda.
# Guardarlo obligaría a correr algo todas las noches para mantenerlo al día, y un estado que depende
# de que alguien se acuerde de actualizarlo miente apenas nadie lo corre. Derivarlo del tiempo no
# puede desincronizarse.
DIAS_SIN_RESPUESTA = int(os.environ.get("COPILOTO_PRESUPUESTO_SIN_RESPUESTA_DIAS") or 30)


class TransicionInvalida(Exception):
    """El estado pedido no es alcanzable desde el actual. Lo traduce a 409 la capa web."""

    def __init__(self, desde: str, hacia: str) -> None:
        super().__init__(f"un presupuesto {desde} no puede pasar a {hacia}")
        self.desde, self.hacia = desde, hacia

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


def factura_id_de_presupuesto(presupuesto_id: int) -> str:
    """El `factura_id` del borrador que nace de ESTE presupuesto — DETERMINÍSTICO, no un uuid.

    🔴 Es lo que impide que "facturar" dos veces cree dos borradores del mismo trabajo, y de ahí dos
    facturas con CAE (irreversibles salvo nota de crédito). Con el id derivado del presupuesto, el
    segundo `start_workflow` choca contra el primero **en el servidor de Temporal**, que es atómico:
    un `if ya_existe:` del lado de la app tendría una ventana entre la consulta y el arranque, y dos
    toques simultáneos —dos dispositivos, un doble tap— caen justo ahí.

    No abre un agujero multi-tenant aunque sea adivinable: el workflow real es
    `factura-{cliente_id}-presu-N` y el prefijo lo pone SIEMPRE el token (`web._wf_id_factura`), así
    que el tenant B pidiendo `presu-7` sólo alcanza su propio `presu-7`.

    Y no bloquea el reintento: si el borrador anterior se cerró (cancelado, rechazado), el mismo id
    vuelve a arrancar como run nuevo — verificado contra el Temporal real, no deducido.
    """
    return f"presu-{presupuesto_id}"


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
      WHERE i.cliente_id = p.cliente_id AND i.presupuesto_id = p.id) AS cantidad_items,
    (p.estado = '{PENDIENTE}'
     AND p.fecha < now() - interval '{DIAS_SIN_RESPUESTA} days') AS sin_respuesta
"""
# El umbral va INTERPOLADO y no como parámetro a propósito: `_SELECT` lo usan media docena de queries
# con placeholders POSICIONALES, y psycopg2 no deja mezclar `%s` con `%(nombre)s` en la misma
# ejecución — sumarlo como parámetro obligaría a tocar todas. Es seguro porque `DIAS_SIN_RESPUESTA`
# pasó por `int()` al leerse del entorno: no puede llevar comillas ni un `;`.

_SELECT = (f"SELECT {', '.join('p.' + c for c in _COLS)}, {_DERIVADOS} FROM {_TABLE} p")

_CAMPOS_SALIDA = _COLS + ("facturado", "reemplazado_por", "cantidad_items", "sin_respuesta")


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
        "reemplaza_a": d["reemplaza_a"],
        "reemplazado_por": d["reemplazado_por"],
        "factura_id": d["factura_id"],
        "facturado": bool(d["facturado"]),
        "cantidad_items": int(d["cantidad_items"] or 0),
        "estado": d["estado"] or PENDIENTE,
        "estado_actualizado_en": d["estado_actualizado_en"],
        # `sin_respuesta` es un MATIZ de "pendiente", no una cuarta categoría: viaja aparte para que
        # la app pueda destacarlo sin sacarlo del grupo "no sé".
        "sin_respuesta": bool(d["sin_respuesta"]),
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
        with _transaccion(conn), conn.cursor() as cur:
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
            # `PRESUPUESTO` (Negocio→Presupuesto), `DIRIGIDO_A` (→Cliente) e `INCLUYE` (→Concepto por
            # ítem), §2.1. `Presupuesto` es un EVENTO (§1.2). El estado inicial `pendiente` viaja en
            # `datos` como el arranque de la serie `ESTADO_PRESUPUESTO` (§2.2), igual que el precio
            # inicial del concepto. Los ítems van enteros porque el `fact_template` de `INCLUYE`
            # interpola `cantidad`/`precio_unitario`/`Concepto` — lo que no esté acá no se lee (trampa 6).
            registrar_evento(cur, self._cid, entidad_tipo="presupuesto", entidad_id=presupuesto_id,
                             evento="creado", campo="estado", valor_de=None, valor_a=PENDIENTE,
                             datos={"numero": numero, "total": str(total), "concepto": concepto,
                                    "receptor_nombre": receptor.get("nombre", ""),
                                    "reemplaza_a": reemplaza_a,
                                    "items": [{"descripcion": str(it.get("descripcion", "")),
                                               "cantidad": str(Decimal(str(it.get("cantidad", 1)))),
                                               "precio_unitario": str(Decimal(str(
                                                   it.get("precio_unitario", 0))))}
                                              for it in items]})
        return self.detalle(presupuesto_id) or {}

    def adjuntar_doc(self, presupuesto_id: int, *, doc_id: str | None, doc_link: str | None) -> None:
        """Pega el Doc a un presupuesto YA creado.

        Va aparte del alta a propósito: generar el Doc habla con Google y puede fallar o tardar, y el
        presupuesto NO puede depender de eso para existir (misma decisión que el archivado del PDF en
        Drive). `COALESCE` para no borrar un valor previo con un `None` de un reintento parcial.
        """
        conn = self._conn_factory()
        with conn.cursor() as cur:
            cur.execute(
                f"UPDATE {_TABLE} SET doc_id=COALESCE(%s, doc_id), doc_link=COALESCE(%s, doc_link) "
                f"WHERE cliente_id=%s AND id=%s",
                (doc_id, doc_link, self._cid, presupuesto_id))

    def marcar_factura(self, presupuesto_id: int, factura_id: str | None) -> bool:
        """Ata el presupuesto al BORRADOR de factura que se armó desde él.

        `factura_id=None` lo DESATA. Existe para compensar: si abrir el borrador se ata y el paso
        siguiente falla, dejar el vínculo puesto bloquearía el presupuesto para siempre con un
        `ya_facturado` sobre una factura que nunca se emitió (ver `presupuestos_web::facturar`).

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

    def cambiar_estado(self, presupuesto_id: int, nuevo: str) -> dict | None:
        """`pendiente → aprobado | desestimado`, con las transiciones prohibidas del contrato §2.2.

        Devuelve el presupuesto actualizado, o `None` si no es de este tenant / no existe (la web lo
        hace 404). Levanta `TransicionInvalida` (→ 409) si el salto no está permitido.

        ⚠️ **El UPDATE lleva el estado actual en el `WHERE`.** No alcanza con leer, comparar en Python
        y después escribir: entre la lectura y la escritura entra la otra request —el emprendedor
        desestimando desde el teléfono mientras el copiloto aprueba por voz— y las dos verían
        `pendiente`. Con el estado esperado en el `WHERE`, la segunda toca 0 filas y se entera.
        """
        if nuevo not in ESTADOS:
            raise ValueError(f"estado desconocido: {nuevo!r}")
        conn = self._conn_factory()
        with conn.cursor() as cur:
            cur.execute(f"SELECT estado FROM {_TABLE} WHERE cliente_id=%s AND id=%s",
                        (self._cid, presupuesto_id))
            fila = cur.fetchone()
            if fila is None:
                return None
            actual = fila[0] or PENDIENTE
            if nuevo == actual:
                return self.detalle(presupuesto_id)      # idempotente: re-marcar lo mismo no es error
            if nuevo not in TRANSICIONES.get(actual, ()):
                raise TransicionInvalida(actual, nuevo)
            cur.execute(f"UPDATE {_TABLE} SET estado=%s, estado_actualizado_en=now() "
                        f"WHERE cliente_id=%s AND id=%s AND estado=%s",
                        (nuevo, self._cid, presupuesto_id, actual))
            if cur.rowcount == 0:
                # Alguien lo movió entre el SELECT y el UPDATE. Se relee y se decide con el valor real
                # en vez de responder un éxito que no ocurrió.
                cur.execute(f"SELECT estado FROM {_TABLE} WHERE cliente_id=%s AND id=%s",
                            (self._cid, presupuesto_id))
                otro = cur.fetchone()
                raise TransicionInvalida((otro[0] if otro else actual), nuevo)
            # `ESTADO_PRESUPUESTO` cambió (§2.2): el derivador invalida la arista de estado anterior y
            # crea la nueva. Se loggea sólo acá —después del UPDATE que sí movió una fila—: el camino
            # idempotente `nuevo == actual` de arriba devolvió sin tocar nada y no es un cambio.
            registrar_evento(cur, self._cid, entidad_tipo="presupuesto", entidad_id=presupuesto_id,
                             evento="estado_cambiado", campo="estado", valor_de=actual, valor_a=nuevo)
        return self.detalle(presupuesto_id)

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
