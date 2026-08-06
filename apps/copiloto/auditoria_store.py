"""Registro de auditoría de acciones de administrador (CONS1) — la precondición de toda acción que
muta un tenant desde la Consola (CONS7: suspender/reactivar, cambiar tier, reintentar un trauma).

## Por qué NO copia la regla 1 de `trauma_store.py` ("nunca lanza")

Ahí, un fallo al depositar no puede tumbar el turno del usuario — sería el manejo de errores
generando el error. Acá es lo opuesto: el registro de auditoría es la PRECONDICIÓN de la mutación
(`coordinacion/PLAN.md` §Consola: *"es lo único que no existe hoy ... por eso es precondición de
toda acción que muta"*). Si no se puede dejar constancia de quién hizo qué, la mutación NO debe
ejecutarse en silencio — sería la consola operando sin rastro. `registrar()` por lo tanto **lanza**
si el INSERT falla; el llamador (CONS7, todavía sin construir) decide si aborta la mutación entera o
reintenta, pero nunca la deja pasar sin auditoría.

## Append-only, y por qué no hay `actualizar`/`borrar`

`auditoria_append_only.sql` lo hace cumplir con un trigger (dispara incluso para el rol dueño de la
conexión — ver ese archivo, y por qué un `REVOKE` no habría alcanzado). Este módulo ni siquiera
expone esos métodos: no hay ruta de código que intente mutar una fila ya escrita.

## Multi-tenant, con una salvedad

`cliente_id` es el tenant **afectado** por la acción del admin, no un tenant del propio admin (el
admin no tiene uno). Se escribe con una conexión que declara ESE tenant vía `contexto_tenant` — el
mismo mecanismo que ya usan `trauma_store`/`evento_store` —, así que el `WITH CHECK` de la policy
estándar protege igual que en cualquier otra tabla. La lectura cross-tenant (para la consola, CONS6)
usa el rol `copiloto_consola` (`BYPASSRLS`, SELECT-only), igual que hoy lee `copiloto_metering`/
`copiloto_traumas`.
"""
from __future__ import annotations

import json
from typing import Any

SCHEMA = "uc_factory"
TABLA = f"{SCHEMA}.copiloto_auditoria"


class AuditoriaStore:
    """Escritura por tenant (acción sobre UN tenant) y lectura cross-tenant (consola, `BYPASSRLS`)."""

    def __init__(self, conn_factory, cliente_id: str = "") -> None:  # noqa: ANN001
        self._conn_factory = conn_factory
        self._cid = cliente_id

    def registrar(self, *, admin_user_id: str, admin_email: str, accion: str,
                  detalle: dict[str, Any] | None = None, resultado: str = "exitoso") -> int:
        """Inserta una fila de auditoría. **Lanza** si falla — ver el docstring del módulo, por qué
        diverge de la regla 1 de `trauma_store`. Devuelve el `id` de la fila creada."""
        conn = self._conn_factory()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    f"""INSERT INTO {TABLA}
                            (cliente_id, admin_user_id, admin_email, accion, detalle, resultado)
                        VALUES (%s, %s, %s, %s, %s, %s)
                        RETURNING id""",
                    (self._cid, admin_user_id, admin_email, accion,
                     json.dumps(detalle, ensure_ascii=False, default=str) if detalle else None,
                     resultado))
                (fila_id,) = cur.fetchone()
            return fila_id
        finally:
            conn.close()

    def listar(self, *, cliente_id: str | None = None, admin_user_id: str | None = None,
               limite: int = 50) -> list[dict]:
        """Lee auditoría. Con una conexión de tenant, `cliente_id` es redundante (RLS ya filtra) —
        con la conexión cross-tenant de la consola (`copiloto_consola`), es el único filtro real."""
        conn = self._conn_factory()
        try:
            with conn.cursor() as cur:
                sql = (f"SELECT id, cliente_id::text, admin_user_id::text, admin_email, accion, "
                       f"detalle, resultado, created_at FROM {TABLA}")
                condiciones: list[str] = []
                params: list[Any] = []
                if cliente_id:
                    condiciones.append("cliente_id = %s")
                    params.append(cliente_id)
                if admin_user_id:
                    condiciones.append("admin_user_id = %s")
                    params.append(admin_user_id)
                if condiciones:
                    sql += " WHERE " + " AND ".join(condiciones)
                sql += " ORDER BY created_at DESC LIMIT %s"
                params.append(limite)
                cur.execute(sql, tuple(params))
                cols = [d[0] for d in cur.description]
                return [dict(zip(cols, fila)) for fila in cur.fetchall()]
        finally:
            conn.close()
