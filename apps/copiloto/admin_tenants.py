"""CONS7a — suspender/reactivar tenant. Escribe `uc_factory.tenants.status`.

## El punto de aplicación real vive en `auth.py`, no acá

Este módulo sólo ESCRIBE el estado. Lo que hace que suspender tenga EFECTO es
`auth.make_require_tenant` (vía `resolve_cliente_id_y_estado`), que en cada request lee esa columna
y responde 403 si no es `'active'` -- el guard va en el borde, no en cada endpoint de negocio, para
que no haya una ruta N+1 que se olvide de chequearlo. Sin ese guard, este módulo sería exactamente
la mutación-sin-sustrato que el contrato CONS7 prohíbe.

`tenants` no tiene `FORCE ROW LEVEL SECURITY` (deliberado -- es la tabla que RESUELVE el tenant,
antes de que exista uno que declarar; ver `contexto_tenant.py` y `test_rls_invariantes.py`), así que
el rol dueño de la app la escribe sin necesitar declarar ningún tenant.
"""
from __future__ import annotations

SCHEMA = "uc_factory"
TABLA = f"{SCHEMA}.tenants"

ESTADOS_VALIDOS = ("active", "suspended")


def cambiar_estado(conn_factory, *, cliente_id: str, nuevo_estado: str) -> str | None:
    """Cambia el `status` del tenant. Devuelve el estado ANTERIOR (para la auditoría), o `None` si
    `cliente_id` no existe (404 para quien llama). Idempotente: cambiar al mismo estado que ya tenía
    igual devuelve el anterior -- es responsabilidad del caller decidir si eso vale auditoría."""
    assert nuevo_estado in ESTADOS_VALIDOS, f"estado inválido: {nuevo_estado!r}"
    conn = conn_factory()
    try:
        with conn.cursor() as cur:
            cur.execute(f"SELECT status FROM {TABLA} WHERE cliente_id = %s", (cliente_id,))
            fila = cur.fetchone()
            if fila is None:
                return None
            anterior = fila[0]
            cur.execute(f"UPDATE {TABLA} SET status = %s WHERE cliente_id = %s",
                        (nuevo_estado, cliente_id))
        return anterior
    finally:
        conn.close()
