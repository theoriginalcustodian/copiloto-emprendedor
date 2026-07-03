"""apps/copiloto/onboarding.py — signup admin-mediado + alta de tenant (Task 3, spec §5.1).

`disable_signup:true` en fusion (self-host Supabase) ⇒ el alta de un tenant nuevo se hace
SIEMPRE mediada por backend vía la GoTrue admin API (`Authorization: Bearer SERVICE_ROLE_KEY`):
crea el user en GoTrue + la fila en `uc_factory.tenants` (Task 1) + setea el claim
`app_metadata.cliente_id` (paridad de RLS para tokens futuros — el camino crítico de resolución
en runtime sigue siendo `resolve_cliente_id` por registry, spec §5.2/§5.3, no el claim del token).

Cero hardcoding: `base_url`/`service_role_key`/`conn_factory` se inyectan siempre desde el
composition root (nunca literales acá). Sumar un tenant nuevo = una llamada a
`signup_and_provision`, cero cambios de código.

Diseño de idempotencia (elección deliberada — el brief ofrecía 2 caminos, se eligió el más
simple): `cliente_id` se genera en PYTHON (`uuid4`) ANTES del INSERT, en vez de dejar que lo
genere el `DEFAULT gen_random_uuid()` de la tabla. Así el alta es UNA sola sentencia atómica
`INSERT (auth_user_id, cliente_id, email, composio_user_id) VALUES (...)` con
`composio_user_id = cliente_id` ya resuelto en el mismo INSERT — se evita el camino alternativo
(`INSERT ... RETURNING cliente_id` + `UPDATE ... SET composio_user_id`), que bajo la convención
de `conn_factory` de este repo (conexiones SIEMPRE `autocommit=True` — cada sentencia es su
propia transacción, ver `provision.py`/`reply_store.py`) NO sería atómico entre 2 sentencias
sueltas sin envolver un `BEGIN` explícito. `ON CONFLICT (auth_user_id) DO NOTHING` vuelve la 2ª
llamada un no-op de escritura; cuando el INSERT no insertó nada, el `cliente_id` REAL (el ya
existente, nunca el candidato descartado) se relee con `resolve_cliente_id` (Task 2) — así el
claim SIEMPRE se setea con el `cliente_id` correcto, sea la 1ª o la Nª llamada."""
from __future__ import annotations

import os
import uuid
from typing import Callable

import httpx

from auth import resolve_cliente_id

_SCHEMA = "uc_factory"
_TENANTS_TABLE = f"{_SCHEMA}.tenants"
_HTTP_TIMEOUT_SECONDS = 30.0


class GoTrueAdmin:
    """Adaptador HTTP fino sobre la GoTrue admin API (self-host fusion, spec §5.1). Inyectable —
    nunca se instancia contra literales; el real se construye con `from_env()`, el de test es
    reemplazado por un fake (constraint del brief: los tests NO llaman a GoTrue real)."""

    def __init__(self, *, base_url: str, service_role_key: str) -> None:
        self._base_url = base_url.rstrip("/")
        self._service_role_key = service_role_key

    @classmethod
    def from_env(cls) -> "GoTrueAdmin":
        """Composition root: lee `SUPABASE_URL`/`SERVICE_ROLE_KEY` (mismas vars que
        `fusion-supabase.env`, ya en el dev loop). Cero hardcoding."""
        return cls(
            base_url=os.environ["SUPABASE_URL"],
            service_role_key=os.environ["SERVICE_ROLE_KEY"],
        )

    def _headers(self) -> dict:
        # `apikey` + `Authorization: Bearer` verificado empíricamente contra fusion para GET
        # /auth/v1/admin/users (de-risk del sprint). Se incluye también `apikey` en POST/PUT: el
        # gateway (Kong, self-host Supabase) exige ese header en toda ruta bajo /auth/v1, por lo
        # que es la misma barrera de acceso para las 3 operaciones admin (GET/POST/PUT).
        return {
            "apikey": self._service_role_key,
            "Authorization": f"Bearer {self._service_role_key}",
        }

    def admin_create_user(self, email: str, password: str) -> dict:
        """POST /auth/v1/admin/users — crea el user confirmado (`email_confirm:true`, spec
        §5.1). Devuelve el objeto GoTrue completo (incluye `id` = auth_user_id)."""
        resp = httpx.post(
            f"{self._base_url}/auth/v1/admin/users",
            headers=self._headers(),
            json={"email": email, "password": password, "email_confirm": True},
            timeout=_HTTP_TIMEOUT_SECONDS,
        )
        resp.raise_for_status()
        return resp.json()

    def admin_set_claim(self, user_id: str, cliente_id: str) -> None:
        """PUT /auth/v1/admin/users/{id} — setea `app_metadata.cliente_id` (paridad RLS; NO es
        el camino crítico de resolución, ver docstring del módulo)."""
        resp = httpx.put(
            f"{self._base_url}/auth/v1/admin/users/{user_id}",
            headers=self._headers(),
            json={"app_metadata": {"cliente_id": cliente_id}},
            timeout=_HTTP_TIMEOUT_SECONDS,
        )
        resp.raise_for_status()


def signup_and_provision(*, email: str, password: str, gotrue, conn_factory: Callable) -> dict:
    """Signup admin-mediado completo (spec §5.1): crea el user en GoTrue, da de alta el tenant
    (idempotente por `auth_user_id`, ver diseño en el docstring del módulo) y propaga el claim.
    `gotrue` es cualquier objeto con `admin_create_user`/`admin_set_claim` (el `GoTrueAdmin` real
    o un fake de test).

    Devuelve `{cliente_id, auth_user_id, email}`. Una 2ª llamada con el mismo `auth_user_id`
    (mismo email vía el mismo `gotrue`) NO duplica la fila y devuelve el `cliente_id` YA
    existente (nunca uno nuevo)."""
    user = gotrue.admin_create_user(email, password)
    auth_user_id = user["id"]
    candidate_cliente_id = str(uuid.uuid4())

    conn = conn_factory()
    with conn.cursor() as cur:
        cur.execute(
            f"INSERT INTO {_TENANTS_TABLE} (auth_user_id, cliente_id, email, composio_user_id) "
            f"VALUES (%s,%s,%s,%s) ON CONFLICT (auth_user_id) DO NOTHING RETURNING cliente_id::text",
            (auth_user_id, candidate_cliente_id, email, candidate_cliente_id),
        )
        row = cur.fetchone()

    if row is not None:
        cliente_id = row[0]
    else:
        # ON CONFLICT DO NOTHING => ya existía la fila: releer el cliente_id REAL (Task 2),
        # nunca el candidato recién generado (que se descartó).
        cliente_id = resolve_cliente_id(conn_factory, auth_user_id)

    gotrue.admin_set_claim(auth_user_id, cliente_id)

    return {"cliente_id": cliente_id, "auth_user_id": auth_user_id, "email": email}
