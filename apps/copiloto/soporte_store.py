"""Persistencia del agente de soporte técnico (SOP3, bloque B del sprint).

## Qué NO es esto

`copiloto_feedback` no se toca -- convive. Este módulo es el otro sistema: el ticket de soporte
técnico y "cómo uso la app" (canal `soporte_tecnico` / `como_uso_la_app`), con su historial de
mensajes. `copiloto_feedback` sigue siendo el buzón de una sola línea; un ticket es una conversación.

## El código `SOP-XXXX`, y por qué se reserva ANTES del INSERT

`reservar_codigo` hace UN solo `INSERT ... ON CONFLICT (cliente_id) DO UPDATE SET ultimo = ultimo + 1
RETURNING ultimo` contra `copiloto_ticket_secuencia` (DDL en `provision.py`). Es atómico: dos tickets
del MISMO tenant creados en paralelo obtienen números distintos porque Postgres serializa el UPSERT
por fila -- no hay `SELECT COUNT(*) + 1` con ventana de carrera. Y como el contador vive en la base y
no en memoria de workflow/activity, sobrevive a un `continue-as-new`
([[derivar-la-clave-dentro-de-la-activity-no-tocar-el-payload]]).

## Multi-tenant, mismo mecanismo que el resto de los stores

`cliente_id` lo declara el borde (`contexto_tenant`), nunca un parámetro de negocio que el llamador
elija. `copiloto_tickets`/`copiloto_mensajes` nacen con `FORCE ROW LEVEL SECURITY` (mecanismo
estándar de `provision_tables.py`, vía `uc_tables.json`) -- un tenant no puede leer ni escribir el
ticket de otro, y el índice único `(cliente_id, codigo)` es la segunda línea de defensa si algún
caller futuro se salteara `reservar_codigo`.
"""
from __future__ import annotations

from typing import Any

SCHEMA = "uc_factory"
TABLA_TICKETS = f"{SCHEMA}.copiloto_tickets"
TABLA_MENSAJES = f"{SCHEMA}.copiloto_mensajes"
TABLA_SECUENCIA = f"{SCHEMA}.copiloto_ticket_secuencia"

#: Los dos canales que este módulo cubre. `feedback` NO es un canal de acá -- sigue en
#: `copiloto_feedback` (B4: convive, no migra).
SOPORTE_TECNICO = "soporte_tecnico"
COMO_USO_LA_APP = "como_uso_la_app"
CANALES_VALIDOS = (SOPORTE_TECNICO, COMO_USO_LA_APP)

#: Estados del ticket. `abierto` → `respondido` (el operador contestó, SOP6) → `cerrado`.
ABIERTO = "abierto"
RESPONDIDO = "respondido"
CERRADO = "cerrado"


class TicketStore:
    """Escritura y lectura de tickets/mensajes, por tenant (`cliente_id` vía `contexto_tenant`)."""

    def __init__(self, conn_factory, cliente_id: str = "") -> None:  # noqa: ANN001
        self._conn_factory = conn_factory
        self._cid = cliente_id

    def reservar_codigo(self) -> str:
        """Reserva atómicamente el siguiente número para ESTE tenant y devuelve `SOP-0007` (4
        dígitos, sin ceros de más allá de eso -- un tenant con miles de tickets no necesita más)."""
        conn = self._conn_factory()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    f"""INSERT INTO {TABLA_SECUENCIA} (cliente_id, ultimo) VALUES (%s, 1)
                        ON CONFLICT (cliente_id)
                        DO UPDATE SET ultimo = {TABLA_SECUENCIA}.ultimo + 1
                        RETURNING ultimo""",
                    (self._cid,))
                (numero,) = cur.fetchone()
            conn.commit()
            return f"SOP-{numero:04d}"
        finally:
            conn.close()

    def crear_ticket(self, *, canal: str, asunto: str, primer_mensaje: str,
                     autor: str = "usuario") -> dict[str, Any]:
        """Crea el ticket con su primer mensaje. `canal` debe ser uno de `CANALES_VALIDOS` -- lanza
        `ValueError` si no (falla temprano, antes de reservar un código que quedaría huérfano)."""
        if canal not in CANALES_VALIDOS:
            raise ValueError(f"canal inválido: {canal!r} (válidos: {CANALES_VALIDOS})")
        codigo = self.reservar_codigo()
        conn = self._conn_factory()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    f"""INSERT INTO {TABLA_TICKETS} (cliente_id, codigo, canal, estado, asunto)
                        VALUES (%s, %s, %s, %s, %s)
                        RETURNING id, created_at""",
                    (self._cid, codigo, canal, ABIERTO, asunto))
                ticket_id, created_at = cur.fetchone()
                cur.execute(
                    f"""INSERT INTO {TABLA_MENSAJES} (cliente_id, ticket_id, autor, texto)
                        VALUES (%s, %s, %s, %s)""",
                    (self._cid, ticket_id, autor, primer_mensaje))
            conn.commit()
            return {"id": ticket_id, "codigo": codigo, "canal": canal, "estado": ABIERTO,
                    "asunto": asunto, "created_at": created_at}
        finally:
            conn.close()

    def agregar_mensaje(self, *, ticket_id: int, autor: str, texto: str) -> int:
        """Agrega un mensaje a un ticket existente. Devuelve el `id` de la fila creada. El `WITH
        CHECK` de la policy de `copiloto_mensajes` rechaza escribir con el `cliente_id` de otro
        tenant; no hace falta verificar acá que el ticket pertenece a este tenant."""
        conn = self._conn_factory()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    f"""INSERT INTO {TABLA_MENSAJES} (cliente_id, ticket_id, autor, texto)
                        VALUES (%s, %s, %s, %s)
                        RETURNING id""",
                    (self._cid, ticket_id, autor, texto))
                (mensaje_id,) = cur.fetchone()
            conn.commit()
            return mensaje_id
        finally:
            conn.close()

    def listar_tickets(self, *, estado: str | None = None, limite: int = 50) -> list[dict[str, Any]]:
        """Tickets de ESTE tenant, más recientes primero."""
        conn = self._conn_factory()
        try:
            with conn.cursor() as cur:
                if estado:
                    cur.execute(
                        f"""SELECT id, codigo, canal, estado, asunto, created_at, updated_at
                            FROM {TABLA_TICKETS}
                            WHERE cliente_id = %s AND estado = %s
                            ORDER BY created_at DESC LIMIT %s""",
                        (self._cid, estado, limite))
                else:
                    cur.execute(
                        f"""SELECT id, codigo, canal, estado, asunto, created_at, updated_at
                            FROM {TABLA_TICKETS}
                            WHERE cliente_id = %s
                            ORDER BY created_at DESC LIMIT %s""",
                        (self._cid, limite))
                cols = ("id", "codigo", "canal", "estado", "asunto", "created_at", "updated_at")
                return [dict(zip(cols, fila)) for fila in cur.fetchall()]
        finally:
            conn.close()

    def cambiar_estado(self, *, ticket_id: int, nuevo_estado: str) -> str | None:
        """El verbo que faltaba (SOP6 §0): `abierto → respondido → cerrado`, vocabulario cerrado.
        Devuelve el estado ANTERIOR (para la auditoría del caller) o `None` si `ticket_id` no
        existe EN ESTE TENANT -- el `WHERE cliente_id = %s` es lo que hace que "no existe" y "es de
        otro tenant" se vean exactamente igual, que es la propiedad que RLS/multi-tenant necesita."""
        if nuevo_estado not in (ABIERTO, RESPONDIDO, CERRADO):
            raise ValueError(f"estado inválido: {nuevo_estado!r} (válidos: abierto/respondido/cerrado)")
        conn = self._conn_factory()
        try:
            with conn.cursor() as cur:
                cur.execute(f"SELECT estado FROM {TABLA_TICKETS} WHERE cliente_id = %s AND id = %s",
                           (self._cid, ticket_id))
                fila = cur.fetchone()
                if fila is None:
                    return None
                anterior = fila[0]
                cur.execute(
                    f"UPDATE {TABLA_TICKETS} SET estado = %s, updated_at = now() "
                    f"WHERE cliente_id = %s AND id = %s",
                    (nuevo_estado, self._cid, ticket_id))
            conn.commit()
            return anterior
        finally:
            conn.close()

    def listar_mensajes(self, *, ticket_id: int) -> list[dict[str, Any]]:
        """Mensajes de UN ticket de este tenant, en orden cronológico."""
        conn = self._conn_factory()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    f"""SELECT id, autor, texto, created_at FROM {TABLA_MENSAJES}
                        WHERE cliente_id = %s AND ticket_id = %s
                        ORDER BY created_at ASC""",
                    (self._cid, ticket_id))
                cols = ("id", "autor", "texto", "created_at")
                return [dict(zip(cols, fila)) for fila in cur.fetchall()]
        finally:
            conn.close()
