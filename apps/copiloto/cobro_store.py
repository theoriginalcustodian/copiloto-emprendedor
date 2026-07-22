"""Persistencia de COBROS de comprobantes (capa CLIENTE, multi-tenant).

**El hueco 1 del hito 3:** hasta acá no había forma de saber si una factura fue cobrada.
`afip_comprobantes.estado` es sólo `emitida`/`anulada`, y el `external_reference` de MercadoPago se
usa para el checkout, no para enlazar el cobro con el comprobante. *«¿Quién me debe?»* —probablemente
la pregunta número uno de cualquier emprendedor— no se podía contestar ni por SQL ni por grafo.

## Por qué una TABLA y no una columna `cobrada boolean`

1. **La idempotencia necesita dónde vivir.** Un `UPDATE … SET cobrada = true` es idempotente por
   casualidad, pero no puede llevar clave de idempotencia ni distinguir *«marqué dos veces»* de
   *«cobré dos veces»*. Con tabla + índice único parcial, la segunda inserción con la misma
   `idem_key` **choca contra el índice**, no contra un `if` que tiene carrera.
2. **Los parciales entran gratis** — sin migración futura.
3. **El grafo (hito 5) quiere la arista** `Cobro → Comprobante`, con fecha, monto y medio. Un booleano
   no los tiene.

Y lo que el contrato prohíbe —que el cobro quede como **inferencia**— se respeta: cada cobro es una
declaración explícita del emprendedor. Lo único derivado es la **suma**, que es aritmética sobre
hechos declarados, no una adivinanza sobre un `external_reference` que se parece.

Mismo patrón de aislamiento que el resto de los stores: el `cliente_id` se fija en el constructor y
**todas** las consultas filtran por él. No se confía en RLS como única barrera — el rol de
`DATABASE_URL` es dueño y la bypassea; el filtro explícito es la barrera efectiva, y hay un test
adversarial que lo ejercita.
"""
from __future__ import annotations

import datetime
from decimal import Decimal, InvalidOperation
from typing import Callable

from gasto_store import dos_decimales, hoy_del_negocio

_SCHEMA = "uc_factory"
_TABLE = f"{_SCHEMA}.copiloto_cobros"
_COMPROBANTES = f"{_SCHEMA}.afip_comprobantes"

_COLS = ("id", "comprobante_id", "monto", "medio", "fecha", "idem_key", "origen",
         "cliente_ref", "presupuesto_ref", "cliente_nombre", "concepto", "created_at")

# Estados de cobro. NINGUNO se guarda: los tres se derivan de `total` y de la suma de cobros. Una
# columna de estado tendría que mantenerse en sincronía con las filas de cobro en cada alta y cada
# baja — y el día que diverjan, la que miente es la columna, no la suma.
IMPAGA, PARCIAL, COBRADA = "impaga", "parcial", "cobrada"

# 🔴 De dónde SALIÓ el ingreso. El addendum pide que se distingan y no es cosmética: un cobro que el
# sistema VIO no es la misma evidencia que uno que alguien TIPEÓ. El día que la caja no cuadre con el
# banco, esto es por dónde se empieza a mirar.
#
# `mercadopago` todavía no lo escribe nadie (esos pagos viven en `mp_payments`): está declarado acá
# para que el día que se unifiquen no haya que inventar el valor, y para que la app pueda cablear la
# distinción HOY sin esperar esa migración.
ORIGEN_FACTURA, ORIGEN_MANUAL, ORIGEN_MP = "factura", "manual", "mercadopago"


class CobroInvalido(ValueError):
    """Monto ≤ 0, monto que supera el saldo, o fecha ilegible. Lo traduce a 400 la capa web."""


def _decimal(valor, campo: str) -> Decimal:
    try:
        return Decimal(str(valor)).quantize(Decimal("0.01"))
    except (InvalidOperation, ValueError, TypeError):
        raise CobroInvalido(f"{campo} no es un número válido")


def estado_de_cobro(total, cobrado) -> str:
    """`impaga` · `parcial` · `cobrada`, derivados. Función pura, testeable sin base."""
    t, c = Decimal(str(total or 0)), Decimal(str(cobrado or 0))
    if c <= 0:
        return IMPAGA
    return COBRADA if c >= t else PARCIAL


class CobroStore:
    def __init__(self, conn_factory: Callable, cliente_id: str) -> None:
        self._conn_factory = conn_factory
        self._cliente_id = cliente_id

    # ── lectura ──────────────────────────────────────────────────────────────────────────────────

    def _resumen(self, cur, comprobante_id: int) -> dict | None:
        """Total, cobrado, saldo y estado de UN comprobante. `None` si no es de este emprendedor.

        🔴 El `WHERE cliente_id` no es cosmético: es lo que hace que un id ajeno devuelva `None` en vez
        de la ficha de otro. La capa web lo traduce a 404 — el mismo código que "no existe", a
        propósito: distinguirlos filtraría qué comprobantes tiene el vecino.
        """
        cur.execute(f"""
            SELECT c.id, c.total, c.estado,
                   coalesce((SELECT sum(k.monto) FROM {_TABLE} k
                              WHERE k.cliente_id = c.cliente_id AND k.comprobante_id = c.id), 0)
              FROM {_COMPROBANTES} c
             WHERE c.cliente_id = %s AND c.id = %s
        """, (self._cliente_id, comprobante_id))
        fila = cur.fetchone()
        if fila is None:
            return None
        cid, total, estado, cobrado = fila
        return {"id": cid, "total": dos_decimales(total), "cobrado": dos_decimales(cobrado),
                "saldo": dos_decimales(Decimal(str(total or 0)) - Decimal(str(cobrado or 0))),
                "estado_cobro": estado_de_cobro(total, cobrado), "estado": estado}

    def resumen(self, comprobante_id: int) -> dict | None:
        with self._conn_factory() as conn, conn.cursor() as cur:
            return self._resumen(cur, comprobante_id)

    def listar(self, comprobante_id: int) -> list[dict]:
        with self._conn_factory() as conn, conn.cursor() as cur:
            cur.execute(f"SELECT {', '.join(_COLS)} FROM {_TABLE} "
                        f"WHERE cliente_id = %s AND comprobante_id = %s ORDER BY fecha, id",
                        (self._cliente_id, comprobante_id))
            return [self._fila(r) for r in cur.fetchall()]

    def impagos(self) -> dict:
        """Todo lo que le deben, servido: las filas y el total. La pantalla no tiene que sumar nada.

        **Las anuladas quedan afuera.** Una factura anulada con nota de crédito no es una deuda: si
        entrara, *«me deben»* mostraría plata que nadie va a pagar nunca — y ese número mal una vez
        hace que el emprendedor no vuelva a mirar la pantalla.
        """
        with self._conn_factory() as conn, conn.cursor() as cur:
            cur.execute(f"""
                SELECT c.id, c.nro, c.receptor_nombre, c.fecha_emision, c.total,
                       coalesce((SELECT sum(k.monto) FROM {_TABLE} k
                                  WHERE k.cliente_id = c.cliente_id AND k.comprobante_id = c.id), 0)
                                AS cobrado,
                       (CURRENT_DATE - c.fecha_emision) AS dias
                  FROM {_COMPROBANTES} c
                 WHERE c.cliente_id = %s
                   AND c.estado <> 'anulada'
                   AND c.cae IS NOT NULL
                   AND coalesce((SELECT sum(k.monto) FROM {_TABLE} k
                                  WHERE k.cliente_id = c.cliente_id AND k.comprobante_id = c.id), 0)
                       < c.total
                 ORDER BY c.fecha_emision
            """, (self._cliente_id,))
            filas, adeudado = [], Decimal(0)
            for cid, nro, receptor, emision, total, cobrado, dias in cur.fetchall():
                saldo = Decimal(str(total or 0)) - Decimal(str(cobrado or 0))
                adeudado += saldo
                filas.append({"id": cid, "nro": nro, "receptor_nombre": receptor or "",
                              "fecha_emision": emision.isoformat() if emision else None,
                              "total": dos_decimales(total), "cobrado": dos_decimales(cobrado),
                              "saldo": dos_decimales(saldo),
                              "estado_cobro": estado_de_cobro(total, cobrado),
                              "dias": int(dias) if dias is not None else None})
            return {"comprobantes": filas, "total_adeudado": dos_decimales(adeudado)}

    # ── escritura ────────────────────────────────────────────────────────────────────────────────

    def registrar(self, comprobante_id: int, *, monto=None, medio: str = "",
                  fecha=None, idem_key: str | None = None) -> tuple[dict, dict]:
        """Registra un cobro. Devuelve `(cobro, resumen)`. `None` en `monto` = el saldo completo.

        🔴 **Idempotente de verdad, por índice — no por un `if`.** Con `idem_key`, repetir la misma
        request devuelve **el cobro que ya estaba**, sin crear otro. Lo garantiza el índice único
        parcial `copiloto_cobros_idem_uk`, no un `SELECT` previo: entre un `SELECT` y su `INSERT` entra
        la otra request, y ya nos costó dos CAE. Ver [[idempotencia-con-un-if-tiene-ventana]].

        Sin `idem_key` **no hay deduplicación, y es correcto**: dos cobros parciales del mismo monto
        son un caso real, y el backend no puede distinguirlos de un doble toque. Esa distinción sólo la
        sabe quien hizo el gesto.
        """
        with self._conn_factory() as conn, conn.cursor() as cur:
            resumen = self._resumen(cur, comprobante_id)
            if resumen is None:
                return None, None                      # ajeno o inexistente → la web lo hace 404

            # 🔴 El reintento se resuelve ANTES de validar el saldo, y el orden no es cosmético.
            #
            # Al revés —validar primero— el reintento de un cobro TOTAL muere con «el cobro supera lo
            # que falta cobrar»: el primer intento ya dejó el saldo en 0. O sea, la request que la
            # idempotencia existe para cubrir era justo la que fallaba, y encima con un mensaje que
            # dice lo contrario de lo que pasó (la operación había funcionado). Lo encontró el test,
            # no el razonamiento: escribí este método convencido de que el índice alcanzaba.
            #
            # Esto NO reemplaza al índice único: es el atajo del camino feliz. La carrera —dos
            # requests simultáneas, ninguna ve a la otra— sigue chocando abajo contra `23505`, que es
            # atómico. Las dos capas, no una: el `if` solo tendría ventana, el índice solo daría 400.
            if idem_key:
                cur.execute(f"SELECT {', '.join(_COLS)} FROM {_TABLE} "
                            f"WHERE cliente_id = %s AND idem_key = %s",
                            (self._cliente_id, idem_key))
                ya_estaba = cur.fetchone()
                if ya_estaba is not None:
                    return self._fila(ya_estaba), resumen

            saldo = Decimal(resumen["saldo"])
            importe = saldo if monto is None else _decimal(monto, "monto")
            if importe <= 0:
                raise CobroInvalido("el monto tiene que ser mayor a cero")
            if importe > saldo:
                raise CobroInvalido(
                    f"el cobro ({dos_decimales(importe)}) supera lo que falta cobrar "
                    f"({resumen['saldo']})")
            dia = _fecha(fecha)
            try:
                cur.execute(
                    f"INSERT INTO {_TABLE} (cliente_id, comprobante_id, monto, medio, fecha, "
                    f"idem_key, origen) VALUES (%s, %s, %s, %s, %s, %s, %s) "
                    f"RETURNING {', '.join(_COLS)}",
                    (self._cliente_id, comprobante_id, importe, (medio or "").strip()[:40],
                     dia, idem_key or None, ORIGEN_FACTURA))
            except Exception as exc:
                # `23505` = unique_violation. Se compara el CÓDIGO, no el texto del mensaje: el texto
                # cambia con la versión de Postgres y con el locale, y un `if "duplicate" in str(exc)`
                # deja de detectar el choque sin que ningún test lo note.
                if getattr(exc, "pgcode", None) != "23505" or not idem_key:
                    raise
                conn.rollback()
                with conn.cursor() as c2:
                    c2.execute(f"SELECT {', '.join(_COLS)} FROM {_TABLE} "
                               f"WHERE cliente_id = %s AND idem_key = %s",
                               (self._cliente_id, idem_key))
                    fila = c2.fetchone()
                    return self._fila(fila), self._resumen(c2, comprobante_id)
            fila = cur.fetchone()
            return self._fila(fila), self._resumen(cur, comprobante_id)

    def registrar_suelto(self, *, monto, medio: str = "", fecha=None, cliente_ref: int | None = None,
                         presupuesto_ref: int | None = None, idem_key: str | None = None,
                         cliente_nombre: str = "", concepto: str = "") -> dict:
        """Un cobro SIN comprobante: *«me pagaron 85 mil en efectivo por el trabajo de la panadería»*.

        🔴 **Esto no es una comodidad: es lo que hace que la caja no mienta.** Hasta acá un cobro sólo
        existía si había pasado por MercadoPago — el efectivo y las transferencias no dejaban rastro
        de ninguna clase. *«Entró $840.000»* contaba sólo lo facturado y lo cobrado por MP, dejando
        afuera lo que en este mercado puede ser la mitad de los ingresos reales.

        `origen='manual'` lo distingue de lo que el sistema **vio** (`mercadopago`). No valen lo mismo
        como evidencia y la pantalla tiene que poder mostrarlos distinto: uno lo observó el sistema,
        el otro lo tipeó alguien.
        """
        importe = _decimal(monto, "monto")
        if importe <= 0:
            raise CobroInvalido("el monto tiene que ser mayor a cero")
        with self._conn_factory() as conn, conn.cursor() as cur:
            if idem_key:
                cur.execute(f"SELECT {', '.join(_COLS)} FROM {_TABLE} "
                            f"WHERE cliente_id = %s AND idem_key = %s", (self._cliente_id, idem_key))
                ya_estaba = cur.fetchone()
                if ya_estaba is not None:
                    return self._fila(ya_estaba)
            try:
                # 🔴 `nacio_completo` se fija ACÁ y nunca se actualiza: es un hecho del momento del
                # alta, no un estado. Derivarlo después de `falta` sería imposible —un ingreso
                # completado a mano queda con `falta = []`, idéntico a uno que nació completo— y de
                # esta distinción depende a quién se le ofrece el modo automático.
                nacio_completo = bool((cliente_nombre or "").strip()
                                      and (medio or "").strip()
                                      and (concepto or "").strip())
                cur.execute(
                    f"INSERT INTO {_TABLE} (cliente_id, monto, medio, fecha, idem_key, origen, "
                    f"cliente_ref, presupuesto_ref, cliente_nombre, concepto, nacio_completo) "
                    f"VALUES (%s,%s,%s,%s,%s,'manual',%s,%s,%s,%s,%s) "
                    f"RETURNING {', '.join(_COLS)}",
                    (self._cliente_id, importe, (medio or "").strip()[:40], _fecha(fecha),
                     idem_key or None, cliente_ref, presupuesto_ref,
                     (cliente_nombre or "").strip()[:120], (concepto or "").strip()[:500],
                     nacio_completo))
            except Exception as exc:
                if getattr(exc, "pgcode", None) != "23505" or not idem_key:
                    raise
                conn.rollback()
                with conn.cursor() as c2:
                    c2.execute(f"SELECT {', '.join(_COLS)} FROM {_TABLE} "
                               f"WHERE cliente_id = %s AND idem_key = %s",
                               (self._cliente_id, idem_key))
                    return self._fila(c2.fetchone())
            return self._fila(cur.fetchone())

    def completitud_dictada(self) -> dict:
        """Cuántos ingresos dictados **nacieron completos** y cuántos hubo que completar a mano.

        Es el insumo de la oferta del modo automático: sólo se le propone a quien ya demostró que
        dicta completo, porque en automático **no hay card que corrija** y lo dictado a medias se
        guarda a medias sin que nadie lo vea.

        ⚠️ **Los `NULL` quedan afuera de la cuenta, no cuentan como completos.** Son las filas
        anteriores a la columna: no sabemos cómo nacieron, y meterlas del lado bueno inflaría el
        porcentaje justo en los tenants con más historia — que son los que primero cruzarían el
        umbral. Un porcentaje sobre 3 de 3 medidos es honesto; sobre 3 medidos y 40 supuestos, no.

        `total_medido` viaja para que quien decida pueda ver **sobre cuántos** se calculó: 100% de 2
        no es lo mismo que 100% de 30, y sin ese número el porcentaje solo no permite distinguirlos.
        """
        with self._conn_factory() as conn, conn.cursor() as cur:
            cur.execute(f"""
                SELECT count(*) FILTER (WHERE nacio_completo IS TRUE),
                       count(*) FILTER (WHERE nacio_completo IS FALSE),
                       count(*) FILTER (WHERE nacio_completo IS NULL)
                  FROM {_TABLE}
                 WHERE cliente_id = %s AND origen = %s
            """, (self._cliente_id, ORIGEN_MANUAL))
            completos, incompletos, sin_dato = cur.fetchone()
        medido = completos + incompletos
        return {"completos": completos, "incompletos": incompletos,
                "sin_dato": sin_dato, "total_medido": medido,
                # `None` y no `0` cuando no hay nada medido: 0% diría «dicta mal», y lo cierto es
                # «todavía no sé». La diferencia importa porque de acá sale una oferta.
                "porcentaje": round(100 * completos / medido) if medido else None}

    def listar_ingresos(self, *, limite: int = 100) -> dict:
        """**Todos** los ingresos: los de facturas cobradas, los de MercadoPago y los dictados.

        Conviven en una lista pero **se distinguen por `origen`**, y no es cosmética: un cobro que el
        sistema **vio** no es la misma evidencia que uno que alguien **tipeó**. Si se mezclaran sin
        marca, en tres meses nadie sabría qué dato es duro y cuál es de memoria — y el día que la caja
        no cuadre con el banco no habría por dónde empezar a mirar.
        """
        with self._conn_factory() as conn, conn.cursor() as cur:
            cur.execute(f"""
                SELECT k.id, k.monto, k.medio, k.fecha, k.origen, k.cliente_nombre, k.concepto,
                       k.comprobante_id, k.presupuesto_ref, c.nro
                  FROM {_TABLE} k
                  LEFT JOIN {_COMPROBANTES} c
                         ON c.cliente_id = k.cliente_id AND c.id = k.comprobante_id
                 WHERE k.cliente_id = %s
                 ORDER BY k.fecha DESC, k.id DESC LIMIT %s
            """, (self._cliente_id, max(1, min(int(limite), 500))))
            filas, total = [], Decimal(0)
            for (kid, monto, medio, fecha, origen, nombre, concepto,
                 comprobante, presupuesto, nro) in cur.fetchall():
                total += Decimal(str(monto or 0))
                filas.append({
                    "id": kid, "monto": dos_decimales(monto), "medio": medio or "",
                    "fecha": fecha.isoformat() if fecha else None,
                    "origen": origen or "manual", "cliente_nombre": nombre or "",
                    "concepto": concepto or "", "comprobante_id": comprobante,
                    "comprobante_nro": nro, "presupuesto_ref": presupuesto,
                    # Sólo los dictados se pueden borrar: el cobro de una factura se deshace por su
                    # propia ruta, y borrar acá el rastro de un pago que el sistema VIO sería inventar
                    # que no pasó.
                    "borrable": (origen or "manual") == "manual",
                })
            return {"ingresos": filas, "total": dos_decimales(total)}

    def posible_duplicado(self, *, monto, cliente_nombre: str = "", dias: int = 5) -> dict | None:
        """¿Ya hay un ingreso parecido en los últimos días? Devuelve el candidato, o `None`.

        🔴 **Esto se pregunta ANTES de guardar, al revés que los datos que faltan.** Los dos casos
        tienen costos distintos: un dato faltante **se ve** y se completa cuando aparezca; un ingreso
        de más **infla la caja y no se ve nunca**. Por eso uno se avisa después y el otro antes.

        Y avisa, **no prohíbe** — mismo criterio que el 409 de clientes: el emprendedor sabe mejor que
        el sistema si le pagaron dos veces lo mismo.
        """
        importe = _decimal(monto, "monto")
        with self._conn_factory() as conn, conn.cursor() as cur:
            cur.execute(f"""
                SELECT id, monto, medio, fecha, origen, cliente_nombre
                  FROM {_TABLE}
                 WHERE cliente_id = %s
                   AND fecha >= CURRENT_DATE - %s
                   AND monto = %s
                   AND (%s = '' OR lower(cliente_nombre) = lower(%s))
                 ORDER BY fecha DESC, id DESC LIMIT 1
            """, (self._cliente_id, int(dias), importe,
                  (cliente_nombre or "").strip(), (cliente_nombre or "").strip()))
            fila = cur.fetchone()
        if fila is None:
            return None
        kid, monto_previo, medio, fecha, origen, nombre = fila
        return {"id": kid, "monto": dos_decimales(monto_previo), "medio": medio or "",
                "fecha": fecha.isoformat() if fecha else None, "origen": origen or "manual",
                "cliente_nombre": nombre or ""}

    def borrar_ingreso(self, ingreso_id: int) -> bool:
        """Borra un ingreso **dictado**. Los que el sistema vio no se tocan por acá.

        Que borrar sea fácil es lo que permite que guardar sea rápido: si arrepentirse costara más que
        equivocarse, el sistema tendría que volverse cauteloso — y un sistema cauteloso pregunta antes
        de anotar, que es exactamente lo que hace que el emprendedor deje de anotar.
        """
        with self._conn_factory() as conn, conn.cursor() as cur:
            cur.execute(f"DELETE FROM {_TABLE} "
                        f"WHERE cliente_id = %s AND id = %s AND origen = 'manual'",
                        (self._cliente_id, ingreso_id))
            return cur.rowcount > 0

    def completar(self, ingreso_id: int, datos: dict) -> dict | None:
        """Completa un ingreso ya guardado — la respuesta al aviso de *«no me dijiste de quién»*.

        **Completa el MISMO ingreso, no crea otro** (DoD del addendum). Y es parcial de verdad: la
        clave ausente no se toca.
        """
        campos = {"cliente_nombre": 120, "medio": 40, "concepto": 500}
        sets, valores = [], []
        for campo, tope in campos.items():
            if campo in datos:
                sets.append(f"{campo} = %s")
                valores.append((str(datos[campo] or "")).strip()[:tope])
        for campo in ("cliente_ref", "presupuesto_ref"):
            if campo in datos:
                sets.append(f"{campo} = %s")
                valores.append(datos[campo])
        if not sets:
            return None
        with self._conn_factory() as conn, conn.cursor() as cur:
            cur.execute(f"UPDATE {_TABLE} SET {', '.join(sets)} "
                        f"WHERE cliente_id = %s AND id = %s RETURNING {', '.join(_COLS)}",
                        (*valores, self._cliente_id, ingreso_id))
            fila = cur.fetchone()
            return self._fila(fila) if fila else None

    def borrar(self, comprobante_id: int, cobro_id: int) -> dict | None:
        """Deshace un cobro. Alguien se equivoca, y sin esto la única salida sería tocar la base."""
        with self._conn_factory() as conn, conn.cursor() as cur:
            cur.execute(f"DELETE FROM {_TABLE} "
                        f"WHERE cliente_id = %s AND comprobante_id = %s AND id = %s",
                        (self._cliente_id, comprobante_id, cobro_id))
            if cur.rowcount == 0:
                return None
            return self._resumen(cur, comprobante_id)

    # ── helpers ──────────────────────────────────────────────────────────────────────────────────

    def _fila(self, row) -> dict:
        k = dict(zip(_COLS, row))
        return {"id": k["id"], "comprobante_id": k["comprobante_id"],
                "monto": dos_decimales(k["monto"]), "medio": k["medio"] or "",
                "fecha": k["fecha"].isoformat() if k["fecha"] else None,
                # `origen` viaja SIEMPRE: un cobro que el sistema VIO (mercadopago) no es la misma
                # evidencia que uno que alguien TIPEÓ, y la pantalla tiene que poder distinguirlos.
                "origen": k["origen"] or "manual",
                "cliente_ref": k["cliente_ref"], "presupuesto_ref": k["presupuesto_ref"],
                "cliente_nombre": k["cliente_nombre"] or "", "concepto": k["concepto"] or "",
                # Lo que FALTÓ, calculado acá y no en la app: el copiloto avisa después de guardar
                # («no me dijiste de quién ni cómo te pagaron»), y ese aviso tiene que salir del
                # mismo lugar que el dato o los dos van a divergir.
                "falta": [c for c, v in (("cliente", k["cliente_nombre"] or k["cliente_ref"]),
                                         ("medio", k["medio"]), ("concepto", k["concepto"]))
                          if not v],
                "created_at": k["created_at"].isoformat() if k["created_at"] else None}


def _fecha(valor) -> datetime.date:
    """`None` → hoy **del negocio** (UTC-3), no hoy en UTC.

    Mismo motivo que en gastos: a las 22:00 de Buenos Aires ya son las 01:00 UTC del día siguiente, y
    un cobro registrado de noche caería en el día —y los 30/31, en el MES— equivocado. El resumen
    mensual es la única pantalla que justifica registrar cobros.
    """
    if valor in (None, ""):
        return hoy_del_negocio()
    if isinstance(valor, datetime.date):
        return valor
    try:
        return datetime.date.fromisoformat(str(valor)[:10])
    except ValueError:
        raise CobroInvalido("la fecha tiene que ser AAAA-MM-DD")
