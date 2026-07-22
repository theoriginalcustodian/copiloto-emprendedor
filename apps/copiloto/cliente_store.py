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
LIMITES = {"nombre": 200, "doc_nro": 20, "domicilio": 200,
           "email": 120, "telefono": 60, "notas": 500}

# Los códigos de documento son los de AFIP (`afip_rules.TipoDoc`), no un catálogo paralelo: el día que
# se le factura a este cliente tienen que entrar tal cual al WSFE.
DOC_CUIT = 80
DOC_DNI = 96
DOC_CONSUMIDOR_FINAL = 99

_COLS = ("id", "nombre", "nombre_normalizado", "doc_tipo", "doc_nro", "condicion_iva",
         "domicilio", "email", "telefono", "notas", "origen", "created_at")


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


def partir_contacto(texto: str) -> tuple[str, str]:
    """Un `contacto` de texto libre → `(email, telefono)`. Determinista y sin heurística fina.

    Regla del addendum: **el token con `@` es el mail; todo lo demás es el teléfono.** Si no hay `@`,
    todo es teléfono — que es el caso real: el emprendedor cargó una cosa **o** la otra.

    Se usa en dos lugares y por eso es una función: la migración de las filas que ya existen, y el
    backfill al derivar de `copiloto_presupuestos.receptor_contacto`, que sigue siendo **un solo
    campo de texto libre** y no se toca (es otra entidad, con su propio contrato).

    **No valida formato, ni acá ni en el handler.** Un emprendedor que escribe `juan@gmail` o
    `1155554444` no puede quedar trabado: rechazar por forma es el tapón que la regla dura de este
    repo prohíbe. Si algún día un envío falla por un mail mal escrito, eso se resuelve **en el envío**,
    con el error real de vuelta — no adivinando en el formulario.
    """
    partes = (texto or "").split()
    con_arroba = [p for p in partes if "@" in p]
    if not con_arroba:
        return "", (texto or "").strip()
    resto = " ".join(p for p in partes if "@" not in p)
    return con_arroba[0], resto.strip()


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


# Nombres que NO son un nombre: el `receptor_nombre` que el propio sistema pone cuando no hay a
# quién nombrar. Se comparan normalizados (ver `normalizar_nombre`).
_NO_SON_NOMBRE = frozenset({"consumidor final", "sin identificar", "s d", "n n"})


def nombre_derivado(nombre: str, doc_tipo, doc_nro) -> str | None:
    """Con qué nombre entra a la cartera algo que ya se emitió — o `None` si **no genera cliente**.

    Es una función pura y separada del store a propósito: acá viven las decisiones del backfill que
    hay que poder leer y testear sin una base de datos delante.

    🔴 **Lo que decide NO es el código 99: es si hay un nombre usable.** Esto se corrigió después de
    verlo en el teléfono, y el error de origen fue leer §3.2 más ancho de lo que dice. §3.2 habla de
    *«un comprobante con `doc_tipo = 99`»* — una venta de mostrador a alguien que no se identificó—.
    Yo lo apliqué a **todo**, incluidos los presupuestos, y ahí 99 significa otra cosa: el formulario
    lo rotula *«Sin identificar»* y quiere decir **«todavía no le pedí el documento»**. El presupuesto
    igual tiene nombre, y ese nombre es un cliente real.

    **El bug medido:** cargué a mano desde el device un presupuesto para «Marta Sin Documento», corrí
    el backfill, y salió `omitidos_consumidor_final: 24` con `creados: 0`. Marta nunca iba a entrar a
    la cartera — contra lo que el propio §3.3 punto 2 manda: *«si no hay documento, la clave es el
    nombre normalizado»*. El contrato se contradecía y yo lo resolví para el lado equivocado.

    Las reglas, en orden:

    1. **Sin nombre usable → no hay cliente.** Cubre los 20 comprobantes reales del operador con
       `receptor_nombre` vacío, y —vía `_NO_SON_NOMBRE`— los 3 que dicen literalmente *«Consumidor
       Final»*. Ese literal es el registro fantasma de §3.2 entrando **por la puerta del nombre** en
       vez de la del documento, y sin esta lista pasaría: tiene nombre, así que la regla 3 lo
       aceptaría. **23 de los 24 comprobantes reales son 99.**
    2. Sin nombre y sin documento tampoco hay cliente (§3.3 punto 3).
    3. Con documento y sin nombre, el nombre ES el documento: `"CUIT 30712345678"`. Feo y honesto —
       el emprendedor lo reconoce y lo edita. Un cliente sin nombre no se muestra en ninguna lista.

    (Y el 99 nunca viaja al cliente: `doc_tipo` de un cliente **jamás** vale 99, §3.1. Eso lo hace
    `_asegurar_derivado`, que lo convierte en «sin documento» y deja la clave por nombre.)
    """
    limpio = (nombre or "").strip()
    if limpio and normalizar_nombre(limpio) not in _NO_SON_NOMBRE:
        return limpio
    if es_consumidor_final(doc_tipo):
        return None
    doc = normalizar_documento(doc_nro)
    if not doc:
        return None
    return f"{'CUIT' if int(doc_tipo or 0) == DOC_CUIT else 'DNI'} {doc}"


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
            # `email` y `telefono` separados, no un `contacto` de texto libre: el destino los usa
            # distinto (el PDF de la factura sale por WhatsApp, el presupuesto por mail), y con un
            # campo único **cada envío tendría que adivinar qué guardó el emprendedor** — adivinar
            # justo en el momento de mandar, que es el peor. Dos campos convierten una pregunta que
            # se repite en cada envío en un dato que se responde UNA vez, al cargarlo, por la única
            # persona que lo sabe.
            "email": c["email"] or None,
            "telefono": c["telefono"] or None,
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

    def _siguiente_homonimo(self, normalizado: str) -> int:
        with self._conn_factory() as conn, conn.cursor() as cur:
            cur.execute(f"SELECT coalesce(max(homonimo), 0) + 1 FROM {_TABLE} "
                        f"WHERE cliente_id = %s AND nombre_normalizado = %s "
                        f"AND (doc_nro IS NULL OR doc_nro = '')", (self._cliente_id, normalizado))
            return int(cur.fetchone()[0])

    def crear(self, *, nombre: str, doc_tipo=None, doc_nro: str = "", condicion_iva=None,
              domicilio: str = "", email: str = "", telefono: str = "", notas: str = "",
              origen: str = "manual", forzar: bool = False) -> dict:
        """Alta. Si la clave ya existe, levanta `ClienteDuplicado` con la ficha del dueño.

        🔴 **El duplicado lo detecta el ÍNDICE, no un `SELECT` previo.** Un «busco y si no está, lo
        creo» tiene una ventana entre las dos operaciones, y acá el caso que la abre es concreto: el
        backfill recorriendo presupuestos mientras el emprendedor da de alta al mismo cliente. Este
        repo ya pagó esa lección con **dos facturas con CAE del mismo trabajo**
        (`memoria/idempotencia-con-un-if-tiene-ventana.md`). Acá se inserta, se choca, y recién
        entonces se lee quién ganó — la atomicidad la pone Postgres, que es el único que puede.

        `forzar=True` es *«sí, ya sé que hay otro con ese nombre, es OTRA persona»*, y **sólo aplica
        al choque por NOMBRE**. Contra un choque por documento se ignora: dos CUIT iguales no son dos
        personas, son un error de tipeo, y no existe el caso en el que forzarlo sea correcto. El
        backfill nunca fuerza — su dedup por nombre es toda su razón de ser.
        """
        normalizado = normalizar_nombre(nombre)
        doc = normalizar_documento(doc_nro)
        intentos = 3        # acotado: el reintento sólo cubre la carrera de dos altas forzadas a la
        #                     vez sobre el mismo nombre. Si pasa 3 veces seguidas no es una carrera,
        #                     y un loop infinito escondería el problema real.
        homonimo = 0
        for intento in range(intentos):
            try:
                with self._conn_factory() as conn, conn.cursor() as cur:
                    cur.execute(
                        f"INSERT INTO {_TABLE} (cliente_id, nombre, nombre_normalizado, doc_tipo, "
                        f"doc_nro, condicion_iva, domicilio, email, telefono, notas, origen, "
                        f"homonimo) "
                        f"VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING {', '.join(_COLS)}",
                        (self._cliente_id, nombre, normalizado, doc_tipo, doc, condicion_iva,
                         domicilio or "", email or "", telefono or "", notas or "", origen,
                         homonimo))
                    return self._fila(cur.fetchone())
            except Exception as exc:
                # `23505` es `unique_violation` en SQLSTATE. Se compara el CÓDIGO y no se importa
                # `psycopg2.errors` para que este módulo siga importándose sin la librería instalada
                # — los tests de la capa web corren con un store falso y no necesitan la base.
                if getattr(exc, "pgcode", None) != "23505":
                    raise
                duenio, por = self._duenio_de_la_clave(doc_tipo, doc, normalizado)
                if not (forzar and por == "nombre") or intento == intentos - 1:
                    raise ClienteDuplicado(duenio, por) from None
                homonimo = self._siguiente_homonimo(normalizado)

    def editar(self, cliente: int, cambios: dict, *, forzar: bool = False) -> dict | None:
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
                           "domicilio", "email", "telefono", "notas")}
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
        for texto in ("domicilio", "email", "telefono", "notas"):
            if texto in campos and campos[texto] is None:
                campos[texto] = ""      # la columna es NOT NULL DEFAULT '' (ver `_fila`)

        # `forzar` vale también acá, y no es simetría gratuita: renombrar «Kiosco 2» a «Kiosco» tiene
        # el MISMO callejón sin salida que el alta —la app dice «ya existe», el emprendedor sabe que
        # es otro, y no hay maniobra—. Que una de las dos puertas tenga salida y la otra no es peor
        # que ninguna: el que la encuentra cerrada supone que la función no existe.
        for intento in range(3):
            try:
                sets = ", ".join(f"{k} = %s" for k in campos)
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
                if not (forzar and por == "nombre") or intento == 2:
                    raise ClienteDuplicado(duenio, por) from None
                campos["homonimo"] = self._siguiente_homonimo(nombre)

    # ── hito 2: el backfill ──────────────────────────────────────────────────────────────────────

    def _asegurar_derivado(self, *, nombre: str, doc_tipo, doc_nro: str,
                           condicion_iva=None, domicilio: str = "",
                           contacto: str = "") -> tuple[int | None, bool]:
        """Un cliente derivado. Devuelve `(id, era_nuevo)`.

        🔴 **Un dato cargado a mano gana siempre sobre uno derivado (§4).** Por eso al chocar NO se
        actualiza nada: se devuelve el id del que ya está. El backfill sólo puede *agregar* clientes,
        nunca pisar lo que el emprendedor escribió — si pisara, correrlo una segunda vez desharía
        media tarde de correcciones y ni siquiera se notaría.

        Las tres decisiones de «con qué nombre entra, o si no entra» viven en `nombre_derivado`, que
        es pura y se testea sin base.

        `contacto` llega como el campo único de `copiloto_presupuestos.receptor_contacto` —esa tabla
        NO cambia, es otra entidad con su propio contrato— y se parte acá con la misma regla que usó
        la migración. Una sola función (`partir_contacto`) para los dos caminos: dos reglas parecidas
        divergen, y la que diverja manda un presupuesto al destino equivocado.
        """
        nombre = nombre_derivado(nombre, doc_tipo, doc_nro)
        if nombre is None:
            return None, False
        doc = normalizar_documento(doc_nro)
        if es_consumidor_final(doc_tipo):
            # §3.1: `doc_tipo` de un cliente NUNCA vale 99. Un presupuesto «Sin identificar» con
            # nombre sí genera cliente (ver `nombre_derivado`), pero entra **sin documento** — la
            # clave es el nombre normalizado, que es lo que §3.3 punto 2 manda para este caso. Si el
            # 99 viajara al cliente, todos ellos compartirían clave `(99, '')` y colapsarían en el
            # registro fantasma por la puerta de siempre.
            doc_tipo, doc = None, ""
        email, telefono = partir_contacto(contacto)
        try:
            return self.crear(nombre=nombre, doc_tipo=doc_tipo, doc_nro=doc,
                              condicion_iva=condicion_iva, domicilio=domicilio,
                              email=email, telefono=telefono, origen="derivado")["id"], True
        except ClienteDuplicado as choque:
            return (choque.duenio or {}).get("id"), False

    def derivar_clientes(self) -> dict:
        """Arma la cartera desde lo que el emprendedor ya emitió (contrato §4). **Idempotente.**

        **El orden del cruce lo decide dónde están los nombres.** Los presupuestos van primero porque
        traen nombre, documento, condición de IVA, domicilio y contacto; los comprobantes de AFIP se
        enganchan después, por documento, y aportan a los que no tenían presupuesto.

        *(El contrato §4 dice que `afip_comprobantes` **no guarda el nombre del comprador**. Medido
        hoy contra la tabla viva: **sí lo guarda**, en `receptor_nombre`, y viene lleno en algunos
        comprobantes. Se usa cuando está, y la caída a «CUIT 30712345678» queda para cuando no.)*

        Devuelve el parte de lo que hizo — no un booleano: el número de duplicados es un dato que
        alguien pidió, y un backfill que no cuenta lo que tocó no se puede auditar dos días después.
        """
        # `omitidos_sin_cliente`, no `omitidos_consumidor_final`: el nombre viejo decía la CAUSA que
        # yo suponía en vez del hecho que el contador mide. Y estaba mal — omitía también los
        # presupuestos «Sin identificar» CON nombre, que sí son clientes. Un contador que nombra una
        # causa equivocada no informa: confirma.
        parte = {"presupuestos_vistos": 0, "comprobantes_vistos": 0, "creados": 0,
                 "ya_estaban": 0, "omitidos_sin_cliente": 0, "presupuestos_vinculados": 0}

        with self._conn_factory() as conn, conn.cursor() as cur:
            cur.execute(f"SELECT id, receptor_nombre, receptor_doc_tipo, receptor_doc_nro, "
                        f"receptor_condicion_iva, receptor_domicilio, receptor_contacto "
                        f"FROM {_SCHEMA}.copiloto_presupuestos WHERE cliente_id = %s ORDER BY id",
                        (self._cliente_id,))
            presupuestos = cur.fetchall()
            cur.execute(f"SELECT doc_tipo, doc_nro, receptor_nombre "
                        f"FROM {_SCHEMA}.afip_comprobantes WHERE cliente_id = %s "
                        f"AND cae IS NOT NULL ORDER BY id", (self._cliente_id,))
            comprobantes = cur.fetchall()

        for presu_id, nombre, doc_tipo, doc_nro, cond, domicilio, contacto in presupuestos:
            parte["presupuestos_vistos"] += 1
            ref, nuevo = self._asegurar_derivado(
                nombre=nombre or "", doc_tipo=doc_tipo, doc_nro=doc_nro or "",
                condicion_iva=cond, domicilio=domicilio or "", contacto=contacto or "")
            if ref is None:
                parte["omitidos_sin_cliente"] += 1
                continue
            parte["creados" if nuevo else "ya_estaban"] += 1
            # El vínculo de §5. `IS DISTINCT FROM` y no `IS NULL`: así re-correr el backfill no
            # reescribe filas que ya apuntan bien, y el `rowcount` cuenta vínculos REALES —si
            # contara los ya vinculados, la segunda corrida informaría el mismo trabajo dos veces.
            with self._conn_factory() as conn, conn.cursor() as cur:
                cur.execute(f"UPDATE {_SCHEMA}.copiloto_presupuestos SET cliente_ref = %s "
                            f"WHERE cliente_id = %s AND id = %s "
                            f"AND cliente_ref IS DISTINCT FROM %s",
                            (ref, self._cliente_id, presu_id, ref))
                parte["presupuestos_vinculados"] += cur.rowcount

        for doc_tipo, doc_nro, nombre in comprobantes:
            parte["comprobantes_vistos"] += 1
            ref, nuevo = self._asegurar_derivado(nombre=nombre or "", doc_tipo=doc_tipo,
                                                 doc_nro=doc_nro or "")
            if ref is None:
                parte["omitidos_sin_cliente"] += 1
            else:
                parte["creados" if nuevo else "ya_estaban"] += 1

        return parte

    def duplicados_probables(self) -> list[dict]:
        """El `[ASSUMED_PENDING_VERIFY]` de §3.4: **cuántos duplicados reales genera esto**.

        Un duplicado probable es el mismo `nombre_normalizado` en dos filas del tenant —una con
        documento y otra sin—, que es el caso concreto que el contrato describe: *«Juan Pérez»* sin
        documento en un presupuesto y *«Juan Perez»* con CUIT en otro. Los dos índices únicos no lo
        impiden, porque cada fila cae en un índice distinto.

        Esto **reporta**, no fusiona. Nadie diseña la fusión antes de conocer el número.
        """
        with self._conn_factory() as conn, conn.cursor() as cur:
            cur.execute(f"SELECT nombre_normalizado, count(*), array_agg(id ORDER BY id) "
                        f"FROM {_TABLE} WHERE cliente_id = %s "
                        f"GROUP BY nombre_normalizado HAVING count(*) > 1 ORDER BY 2 DESC",
                        (self._cliente_id,))
            return [{"nombre_normalizado": n, "cuantos": c, "ids": list(ids)}
                    for n, c, ids in cur.fetchall()]
