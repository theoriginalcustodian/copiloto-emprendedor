"""La DLQ del copiloto — Fase 2, ítems 2.1 a 2.4.

## Qué deposita, y por qué no es "otro log"

`log_estructurado.log_error` deja el error en journald: **consultable, pero no accionable**. Nadie
vuelve sobre una línea de log. Esta tabla es el otro lado del *Trauma Empaquetado*: el error queda
**con estado**, deduplicado y contado, para que algo lo reintente o alguien lo mire — el material del
que se alimenta la Fase 3.

El `fingerprint` no se inventa acá: ya lo calcula `fingerprint_de_error` y ya viaja en cada línea de
log desde la Fase 1. Esta tabla simplemente lo usa como clave.

## Las tres reglas duras

1. **Nunca lanza.** Un fallo al depositar un trauma no puede tumbar el turno del usuario — sería el
   manejo de errores generando el error. `depositar()` devuelve `None` si algo salió mal, y quien lo
   llama (las costuras) ya ignora el resultado. Mismo principio que `log_error`.
2. **Sin `error_message`.** Puede traer CUIT, montos, nombres. El `fingerprint` identifica el error
   sin exponer su contenido; el traceback vive en el canal de excepción, no acá.
3. **El tenant NO es un parámetro de negocio.** Viene del borde vía `contexto_tenant`, igual que en
   todos los stores: la fila se escribe con el `cliente_id` que la conexión ya declaró, y el
   `WITH CHECK` de la policy rechaza cualquier otra cosa.

## La deduplicación, medida (spike S2)

`ON CONFLICT (cliente_id, fingerprint) DO UPDATE … RETURNING (xmax = 0) AS insertado` distingue en
**una sola ida** si la fila nació o se actualizó — sin `SELECT` previo y sin la ventana de carrera
que ese `SELECT` abriría. `xmax = 0` es cierto sólo en la fila recién insertada.

⚠️ **La clave es compuesta a propósito.** Ver el encabezado de `traumas_indexes.sql`: con RLS, dos
tenants con el mismo error chocarían contra una fila que el segundo no puede ver.
"""
from __future__ import annotations

import json
import os
from typing import Any

#: Los tres estados. `pendiente` → `en_proceso` → `resuelto`. `descartado` es la salida sin reintento
#: (error de negocio que no se repara solo); no cuenta como cuarto estado del ciclo, es su terminal.
PENDIENTE = "pendiente"
EN_PROCESO = "en_proceso"
RESUELTO = "resuelto"
DESCARTADO = "descartado"

SCHEMA = "uc_factory"
TABLA = f"{SCHEMA}.copiloto_traumas"

#: Cuántas repeticiones del MISMO fingerprint marcan una inundación. Parametrizado y no el `10`
#: hardcodeado que traía ARCA (ítem 2.3): el umbral que sirve para un tenant con 3 usuarios no sirve
#: para uno con 3000, y un número fijo en el código se descubre tarde y se cambia por deploy.
FLOOD_THRESHOLD_DEFAULT = 10


def flood_threshold() -> int:
    """Umbral de inundación, con env var y default sano. Un valor inválido no puede tumbar la captura
    de errores: se degrada al default en vez de lanzar (regla 1)."""
    try:
        valor = int(os.environ.get("COPILOTO_FLOOD_THRESHOLD", FLOOD_THRESHOLD_DEFAULT))
        return valor if valor > 0 else FLOOD_THRESHOLD_DEFAULT
    except (TypeError, ValueError):
        # Degradar acá es correcto y deliberado (caso (c) del censo de `except`): una env var mal
        # tipeada no puede ser el motivo de que se deje de capturar errores. Lanzar tumbaría el
        # depósito entero por un problema de configuración de un umbral secundario, y loguear haría
        # que un valor inválido grite en CADA error registrado — ruido en el peor momento. El default
        # es sano y el test `test_un_umbral_invalido_se_degrada_al_default_en_vez_de_lanzar` lo fija.
        return FLOOD_THRESHOLD_DEFAULT


class TraumaStore:
    """Depósito de errores por tenant. `conn_factory` debe venir envuelta con `conexion_con_tenant`."""

    def __init__(self, conn_factory, cliente_id: str) -> None:  # noqa: ANN001
        self._conn_factory = conn_factory
        self._cid = cliente_id

    # ---------------------------------------------------------------- depositar
    def depositar(self, *, fingerprint: str, workflow: str, error_type: str,
                  costura: str | None = None, contexto: dict[str, Any] | None = None) -> dict | None:
        """Deposita (o vuelve a contar) un trauma. Devuelve `{dedupe_count, insertado, inundado}`.

        **Nunca lanza** (regla 1): ante cualquier fallo devuelve `None`. El llamador es una costura de
        captura de errores; si esto explotara, el error original se perdería y encima se sumaría uno
        nuevo.
        """
        try:
            conn = self._conn_factory()
        except Exception:  # noqa: BLE001
            return None
        try:
            with conn.cursor() as cur:
                cur.execute(
                    f"""INSERT INTO {TABLA}
                            (cliente_id, fingerprint, workflow, error_type, costura, contexto,
                             estado, dedupe_count)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, 1)
                        ON CONFLICT (cliente_id, fingerprint) DO UPDATE
                            SET dedupe_count = {TABLA}.dedupe_count + 1,
                                updated_at   = now(),
                                -- Un trauma que vuelve a ocurrir NO sigue 'resuelto': se reabre. Si no,
                                -- un error que reaparece queda enterrado bajo su propio cierre anterior.
                                estado = CASE WHEN {TABLA}.estado = %s THEN %s
                                              ELSE {TABLA}.estado END,
                                workflow = EXCLUDED.workflow,
                                error_type = EXCLUDED.error_type,
                                costura = COALESCE(EXCLUDED.costura, {TABLA}.costura),
                                contexto = COALESCE(EXCLUDED.contexto, {TABLA}.contexto)
                        RETURNING dedupe_count, (xmax = 0) AS insertado""",
                    (self._cid, fingerprint, workflow, error_type, costura,
                     json.dumps(contexto, ensure_ascii=False, default=str) if contexto else None,
                     PENDIENTE, RESUELTO, PENDIENTE))
                dedupe_count, insertado = cur.fetchone()
        except Exception:  # noqa: BLE001 — regla 1: depositar un error no puede generar otro
            return None
        finally:
            try:
                conn.close()
            except Exception:  # noqa: BLE001
                pass
        return {"dedupe_count": dedupe_count, "insertado": bool(insertado),
                "inundado": dedupe_count >= flood_threshold()}

    # ------------------------------------------------------- máquina de estados
    def tomar(self, *, limite: int = 10) -> list[dict]:
        """Marca hasta `limite` pendientes como `en_proceso` y los devuelve, en una sola sentencia.

        `FOR UPDATE SKIP LOCKED` para que dos recuperadores corriendo a la vez no tomen el mismo
        trauma. Sin eso, la única defensa sería que nunca haya dos — que es una suposición, no un
        mecanismo.

        **Devuelve `cliente_id`.** Es el dueño de la fila y lo necesita todo lo que viene después
        (declarar el tenant para marcarla, soltarla, o cerrarla). Antes no lo devolvía y el llamador
        lo inyectaba desde su propio argumento — algo que dejó de existir cuando el ciclo pasó a ser
        uno solo para toda la app.
        """
        conn = self._conn_factory()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    f"""UPDATE {TABLA} SET estado = %s, intentos = intentos + 1,
                                           ultimo_intento_en = now(), updated_at = now()
                        WHERE id IN (SELECT id FROM {TABLA} WHERE estado = %s
                                     ORDER BY updated_at LIMIT %s FOR UPDATE SKIP LOCKED)
                        RETURNING id, cliente_id::text, fingerprint, workflow, error_type, costura,
                                  contexto, dedupe_count, intentos""",
                    (EN_PROCESO, PENDIENTE, limite))
                cols = [d[0] for d in cur.description]
                return [dict(zip(cols, fila)) for fila in cur.fetchall()]
        finally:
            conn.close()

    def tomar_un_bug_distinto(self) -> dict | None:
        """Toma **un** trauma por cada BUG distinto, no por cada ocurrencia. Cross-tenant.

        ## Por qué existe (2026-08-01, decisión del operador)

        El ciclo de auto-reparación era **uno por tenant**: 19 Schedules hoy, 5.000 el día que haya
        5.000 emprendedores, cada uno corriendo la suite completa dos veces a las 04:00. Y el error
        de fondo era conceptual, no de escala: **el bug está en NUESTRO código, no en los datos del
        emprendedor.** Un `KeyError` en `fingerprint.py` es el mismo defecto lo haya pegado el tenant
        A o el Z. El tenant es un atributo de la *ocurrencia*; la unidad de reparación es el *bug*.

        Y la deduplicación no es opcional acá: el índice único de la DLQ es
        **`(cliente_id, fingerprint)`**, así que un solo bug que toque a N tenants deja **N filas con
        el mismo fingerprint**. Sin agrupar, el ciclo propondría N parches idénticos y el humano que
        revisa recibiría N veces el mismo PR.

        `DISTINCT ON (fingerprint)` elige un representante por bug —el de mayor `dedupe_count`, o sea
        el que más veces pegó— y ordena por eso: **se repara primero lo que más duele**, no lo que
        llegó primero.

        Requiere una conexión que vea la DLQ entera: el rol `copiloto_autosanacion` con `BYPASSRLS`.
        Con una conexión de tenant esto devuelve sólo lo de ese tenant y el `DISTINCT` no agrupa
        nada — funcionaría, en silencio, midiendo mal.
        """
        conn = self._conn_factory()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    f"""UPDATE {TABLA} SET estado = %s, intentos = intentos + 1,
                                           ultimo_intento_en = now(), updated_at = now()
                        WHERE id = (
                            SELECT id FROM (
                                SELECT DISTINCT ON (fingerprint) id, dedupe_count, updated_at
                                  FROM {TABLA} WHERE estado = %s
                                 ORDER BY fingerprint, dedupe_count DESC, updated_at
                            ) AS por_bug
                            ORDER BY dedupe_count DESC, updated_at
                            LIMIT 1
                            FOR UPDATE SKIP LOCKED
                        )
                        RETURNING id, cliente_id::text, fingerprint, workflow, error_type, costura,
                                  contexto, dedupe_count, intentos""",
                    (EN_PROCESO, PENDIENTE))
                fila = cur.fetchone()
                if fila is None:
                    return None
                return dict(zip([d[0] for d in cur.description], fila))
        finally:
            conn.close()

    def hermanos_del_mismo_bug(self, fingerprint: str, *, excepto: int) -> list[dict]:
        """Las OTRAS filas pendientes con el mismo `fingerprint` — el mismo bug en otros tenants.

        No se tocan al tomar: si el ciclo falla a mitad de camino, quedan intactas para el próximo
        intento. Se usan al **cerrar**, para que un bug reparado no vuelva a proponerse N veces.
        """
        conn = self._conn_factory()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    f"""SELECT id, cliente_id::text FROM {TABLA}
                         WHERE fingerprint = %s AND estado = %s AND id <> %s""",
                    (fingerprint, PENDIENTE, excepto))
                return [{"id": r[0], "cliente_id": r[1]} for r in cur.fetchall()]
        finally:
            conn.close()

    def cerrar(self, trauma_id: int, *, estado: str = RESUELTO) -> bool:
        """Cierra un trauma. `resuelto` (se reparó) o `descartado` (no se repara solo)."""
        if estado not in (RESUELTO, DESCARTADO):
            raise ValueError(f"estado de cierre inválido: {estado!r}")
        conn = self._conn_factory()
        try:
            with conn.cursor() as cur:
                cur.execute(f"UPDATE {TABLA} SET estado = %s, updated_at = now() WHERE id = %s",
                            (estado, trauma_id))
                return cur.rowcount == 1
        finally:
            conn.close()

    def rescatar_colgados(self, *, minutos: int = 30) -> int:
        """Devuelve a `pendiente` los `en_proceso` que quedaron viejos, y dice cuántos.

        Un proceso que muere a mitad de reparar deja su trauma en `en_proceso` **para siempre**: sin
        esta ventana, la máquina de estados tiene un sumidero silencioso donde los errores entran y no
        vuelven a salir. Es el modo de fallo que no da síntoma — la cola se ve vacía porque todo está
        "en proceso".
        """
        conn = self._conn_factory()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    f"""UPDATE {TABLA} SET estado = %s, updated_at = now()
                        WHERE estado = %s AND updated_at < now() - make_interval(mins => %s)""",
                    (PENDIENTE, EN_PROCESO, minutos))
                return cur.rowcount or 0
        finally:
            conn.close()

    def listar(self, *, estado: str | None = None, limite: int = 50) -> list[dict]:
        """Los traumas del tenant, el más reciente primero. Para diagnóstico y para la Fase 3."""
        conn = self._conn_factory()
        try:
            with conn.cursor() as cur:
                sql = (f"SELECT id, fingerprint, workflow, error_type, costura, estado, "
                       f"dedupe_count, intentos, created_at, updated_at FROM {TABLA}")
                params: tuple = ()
                if estado:
                    sql += " WHERE estado = %s"
                    params = (estado,)
                sql += " ORDER BY updated_at DESC LIMIT %s"
                cur.execute(sql, params + (limite,))
                cols = [d[0] for d in cur.description]
                return [dict(zip(cols, fila)) for fila in cur.fetchall()]
        finally:
            conn.close()
