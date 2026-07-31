"""S6 — ¿se puede tener RLS REAL con conexión directa (psycopg2), sin tumbar la app?

**El problema, medido en producción (2026-07-31):** las 77 tablas de `uc_factory` tienen RLS activado,
pero **72 sin `FORCE`** — y la app se conecta como `uc_factory`, que es **dueña de todas**. Postgres
exime al dueño de sus propias policies salvo `FORCE`, así que el RLS **no filtra nada** para la app.
Comprobado por efecto: una consulta sin JWT devolvió filas de **3 tenants distintos**.

El aislamiento real hoy lo dan los `WHERE cliente_id = %s` de la aplicación. Funciona, pero significa
que **no hay segunda línea**: una query nueva que olvide el filtro devuelve datos ajenos sin error.

**Por qué no alcanza con "activar FORCE".** La policy dice
`cliente_id = current_setting('request.jwt.claims')::jsonb->>'cliente_id'` — la GUC que setea
PostgREST. Con `psycopg2` esa GUC **no existe**, así que activar `FORCE` haría que toda query devuelva
0 filas: la app entera dejaría de ver sus propios datos.

**El mecanismo candidato** (reutiliza el patrón que las 5 tablas de `documed` ya usan en esta misma
base, más la costura C3 recién construida, que ya sabe extraer el tenant):

  1. un `ContextVar` con el tenant del request/activity en curso,
  2. la conexión setea `request.jwt.claims` desde ese ContextVar al abrirse,
  3. las tablas pasan a `FORCE` + policy con `USING` **y** `WITH CHECK`.

**Los cuatro supuestos que hay que validar antes de tocar 77 tablas** — si alguno falla, el plan cambia:

  A. el `ContextVar` sobrevive a `asyncio.to_thread` (los stores corren ahí: `await asyncio.to_thread(store...)`),
  B. con la GUC seteada y `FORCE`, la app ve **sus** filas (no se rompe),
  C. **sin** la GUC, la app ve **0** filas — fail-closed, que es el punto de todo esto,
  D. el `WITH CHECK` impide escribir con el `cliente_id` de otro.
"""
from __future__ import annotations

import asyncio
import json
import os
import sys
from contextvars import ContextVar

import psycopg2

DSN = dict(host="127.0.0.1", port=55444, user="s", password="s", dbname="s")

#: El tenant del request/activity en curso. Lo setea el borde (auth HTTP / interceptor de activities),
#: nunca el store — así ningún llamador puede "elegir" un tenant distinto del autenticado.
tenant_actual: ContextVar[str | None] = ContextVar("tenant_actual", default=None)


def conexion():
    """Conexión con el tenant del contexto ya declarado a la base.

    `SET` (no `SET LOCAL`) porque la app corre en autocommit: `SET LOCAL` moriría al terminar la
    sentencia y la GUC no llegaría a la query siguiente.
    """
    conn = psycopg2.connect(**DSN)
    conn.autocommit = True
    cid = tenant_actual.get()
    with conn.cursor() as cur:
        if cid:
            cur.execute("SELECT set_config('request.jwt.claims', %s, false)",
                        (json.dumps({"cliente_id": cid}),))
        else:
            # Explícito: sin tenant en contexto, la conexión queda SIN claims → la policy no matchea
            # nada. Es la mitad que hace fail-closed al olvido.
            cur.execute("SELECT set_config('request.jwt.claims', '', false)")
    return conn


def _filas() -> list:
    with conexion() as c, c.cursor() as cur:
        cur.execute("SELECT cliente_id, dato FROM gastos ORDER BY id")
        return cur.fetchall()


A = "11111111-1111-1111-1111-111111111111"
B = "22222222-2222-2222-2222-222222222222"


async def _en_thread() -> list:
    """Supuesto A: los stores corren dentro de `asyncio.to_thread`."""
    return await asyncio.to_thread(_filas)


def main() -> int:
    fallas = []

    # --- Supuesto B: con la GUC seteada, la app ve LO SUYO -----------------------------
    tenant_actual.set(A)
    vistas_a = _filas()
    print(f"[B] tenant A ve: {len(vistas_a)} fila(s) → {[f[1] for f in vistas_a]}")
    if not (len(vistas_a) == 2 and all(str(f[0]) == A for f in vistas_a)):
        fallas.append("B: el tenant no ve sus propias filas — activar FORCE rompería la app")

    tenant_actual.set(B)
    vistas_b = _filas()
    print(f"[B] tenant B ve: {len(vistas_b)} fila(s) → {[f[1] for f in vistas_b]}")
    if not (len(vistas_b) == 1 and all(str(f[0]) == B for f in vistas_b)):
        fallas.append("B: el tenant B no ve exactamente lo suyo")

    # --- Supuesto A: sobrevive a to_thread ---------------------------------------------
    tenant_actual.set(A)
    en_thread = asyncio.run(_en_thread())
    print(f"[A] dentro de asyncio.to_thread, tenant A ve: {len(en_thread)} fila(s)")
    if len(en_thread) != 2:
        fallas.append("A: el ContextVar NO se propaga a to_thread — el mecanismo no sirve para los stores")

    # --- Supuesto C: SIN tenant, cero filas (fail-closed) ------------------------------
    tenant_actual.set(None)
    sin_tenant = _filas()
    print(f"[C] SIN tenant en contexto: {len(sin_tenant)} fila(s)  (debe ser 0)")
    if sin_tenant:
        fallas.append("C: sin tenant la app VE datos — no es fail-closed, que es todo el punto")

    # --- Supuesto D: el WITH CHECK impide escribir como otro ---------------------------
    tenant_actual.set(B)
    try:
        with conexion() as c, c.cursor() as cur:
            cur.execute("INSERT INTO gastos (cliente_id, dato) VALUES (%s, %s)", (A, "robo"))
        print("[D] B escribió una fila con el cliente_id de A → ¡NO hay WITH CHECK efectivo!")
        fallas.append("D: se pudo escribir con el tenant de otro")
    except psycopg2.errors.CheckViolation as exc:  # type: ignore[attr-defined]
        print(f"[D] B intenta escribir como A → RECHAZADO ({type(exc).__name__})")
    except Exception as exc:  # noqa: BLE001
        print(f"[D] B intenta escribir como A → RECHAZADO ({type(exc).__name__}: {str(exc)[:70]})")

    print()
    if fallas:
        print("S6 FALLA:")
        for f in fallas:
            print(f"  - {f}")
        return 1
    print("S6 PASA: RLS real con conexión directa, fail-closed, y sobrevive a to_thread.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
