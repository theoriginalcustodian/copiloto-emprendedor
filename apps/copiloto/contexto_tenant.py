"""El tenant de la operación en curso — la pieza que le falta a la base para aplicar RLS de verdad.

## El problema que resuelve (medido en producción, 2026-07-31)

Las 77 tablas de `uc_factory` tienen RLS activado, pero **72 sin `FORCE`**. La app se conecta como
`uc_factory`, que es **dueña de todas ellas**, y Postgres **exime al dueño de sus propias policies**
salvo que se declare `FORCE`. Comprobado por efecto: una consulta sin JWT devolvió filas de **3
tenants distintos**.

El aislamiento real hoy lo dan los `WHERE cliente_id = %s` de cada store. Funciona —los 8 tests
adversariales lo respaldan— pero significa que **no hay segunda línea**: una query nueva que olvide el
filtro devuelve datos ajenos **sin error y sin síntoma**. El `CLAUDE.md` de este repo declara *"RLS
obligatorio en DBs multi-tenant"*, y hasta ahora eso era cierto en el catálogo y falso en la práctica.

## Por qué no alcanzaba con activar `FORCE`

La policy dice `cliente_id = current_setting('request.jwt.claims')::jsonb->>'cliente_id'` — la GUC que
setea PostgREST. La app se conecta directo con `psycopg2`, donde esa GUC **no existe**: activar `FORCE`
sin más haría que toda query devuelva 0 filas y la app dejaría de ver sus propios datos.

Este módulo es la pieza faltante: **quién declara el tenant a la conexión**.

## Cómo funciona, y por qué el tenant NO lo pasa el store

El `ContextVar` lo setea **el borde** —`require_tenant` en HTTP, la costura C3 en activities—, nunca el
llamador de un store. Es deliberado: si el tenant fuera un parámetro más, cualquier código podría pasar
uno distinto del autenticado, y el RLS pasaría a proteger contra errores de tipeo en vez de contra
errores de lógica. Al venir del borde, **la base sólo puede ver lo que la autenticación ya decidió**.

## Validado antes de escribirlo (spike S6 → `spikes/RESULT.md`)

Contra un Postgres con un rol que replica producción (no-superuser, owner de la tabla):
el tenant ve **sólo lo suyo**, el `ContextVar` **sobrevive a `asyncio.to_thread`** (donde corren los
stores), sin tenant la app ve **0 filas**, y escribir con el `cliente_id` de otro es **rechazado** por
el `WITH CHECK`.

⚠️ El spike falló en su primera corrida diciendo que nada de esto funcionaba — porque su rol era
**superuser**, y los superusuarios saltean RLS *incluso con `FORCE`*. Vale saberlo: si alguna vez la
app corriera con un rol superuser o con `BYPASSRLS`, **todo este mecanismo sería decorativo**.
`test_contexto_tenant.py` deja un test que lo vigila.
"""
from __future__ import annotations

import json
from contextlib import contextmanager
from contextvars import ContextVar
from typing import Any, Iterator

#: Tenant de la operación en curso. `None` = no hay tenant declarado → la conexión queda sin claims y
#: las tablas con `FORCE` no devuelven nada. Fail-closed a propósito: el olvido no puede leer datos.
_tenant: ContextVar[str | None] = ContextVar("tenant_actual", default=None)

#: La GUC que la policy consulta. Es la misma que usa PostgREST y la que ya usan las 5 tablas de
#: `documed` en esta base — se reutiliza el nombre para que un solo modelo de policy sirva para los
#: dos caminos de acceso (directo y vía PostgREST) sin bifurcar la seguridad.
GUC_CLAIMS = "request.jwt.claims"


def tenant_actual() -> str | None:
    return _tenant.get()


def declarar_tenant(cliente_id: str | None) -> Any:
    """Declara el tenant del contexto. Devuelve el token para restaurarlo (`_tenant.reset(token)`)."""
    return _tenant.set(cliente_id or None)


@contextmanager
def tenant(cliente_id: str | None) -> Iterator[None]:
    """Scope explícito del tenant. Restaura el anterior al salir, incluso si hubo excepción."""
    token = declarar_tenant(cliente_id)
    try:
        yield
    finally:
        _tenant.reset(token)


def declarar_en_conexion(conn) -> None:  # noqa: ANN001
    """Le dice a la conexión de quién es la operación en curso.

    `set_config(..., false)` —equivalente a `SET`, no a `SET LOCAL`— porque la app corre en
    **autocommit**: con `SET LOCAL` la GUC moriría al terminar esa sentencia y la query siguiente
    quedaría sin tenant, que con `FORCE` significa **cero filas**. El valor se pisa en cada apertura,
    así que una conexión reusada nunca arrastra el tenant de otro request.
    """
    cid = _tenant.get()
    claims = json.dumps({"cliente_id": cid}) if cid else ""
    with conn.cursor() as cur:
        cur.execute("SELECT set_config(%s, %s, false)", (GUC_CLAIMS, claims))


def conexion_con_tenant(conn_factory):  # noqa: ANN001, ANN201
    """Envuelve un `conn_factory()` para que toda conexión nazca con el tenant declarado.

    Se envuelve la **fábrica** y no cada store (son 19) para que la garantía no dependa de que
    alguien se acuerde: es la misma inversión que las costuras de error — el default correcto en vez
    del cableado manual.
    """

    def factory():  # noqa: ANN202
        conn = conn_factory()
        try:
            declarar_en_conexion(conn)
        except Exception:
            # Si no se puede declarar el tenant, la conexión NO sirve: con `FORCE` daría 0 filas y el
            # llamador lo leería como "no hay datos". Cerrarla y propagar es la única lectura honesta.
            conn.close()
            raise
        return conn

    return factory
