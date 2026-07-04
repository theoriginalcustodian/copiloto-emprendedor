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
claim SIEMPRE se setea con el `cliente_id` correcto, sea la 1ª o la Nª llamada.

Idempotencia CONTRA GoTrue REAL (no solo contra el fake de test): con el login por email
habilitado, la re-signup es un camino de usuario real (doble-click, "me olvidé que ya tenía
cuenta"). Contra el GoTrue real, `admin_create_user` de un email YA registrado devuelve HTTP
422 — que sin tolerancia explotaría en `raise_for_status()` ANTES de llegar al `INSERT ... ON
CONFLICT`, tirando 500 en vez de devolver el tenant existente. Por eso `admin_create_user`
TOLERA el 422: ante email duplicado hace un lookup admin (`GET /auth/v1/admin/users`) y devuelve
el user existente (con su `id` real). Así el flujo completo es idempotente de punta a punta: la
2ª signup del mismo email → mismo `auth_user_id` → ON CONFLICT no-op → `resolve_cliente_id`
relee el `cliente_id` existente → mismo tenant, sin excepción, sin fila duplicada."""
from __future__ import annotations

import os
import uuid
from typing import Callable

import httpx

from auth import resolve_cliente_id

_SCHEMA = "uc_factory"
_TENANTS_TABLE = f"{_SCHEMA}.tenants"
_HTTP_TIMEOUT_SECONDS = 30.0


_EMAIL_EXISTS_STATUS = 422  # GoTrue devuelve 422 al crear un user con email ya registrado
_INVALID_GRANT_STATUSES = (400, 401)  # GoTrue devuelve 400 (invalid_grant) o 401 ante login inválido


class InvalidCredentials(Exception):
    """Email/password inválidos en el password-grant de GoTrue (Task 6, `password_grant`). La ruta
    HTTP (`POST /auth/login`, web.py) la traduce a 401 sin filtrar el detalle del error de GoTrue
    al cliente."""


class GoTrueAdmin:
    """Adaptador HTTP fino sobre la GoTrue admin API (self-host fusion, spec §5.1). Inyectable —
    nunca se instancia contra literales; el real se construye con `from_env()`, el de test usa un
    `client` con `httpx.MockTransport` (constraint del brief: los tests NO llaman a GoTrue real).

    El `httpx.Client` se inyecta (default: uno propio) para que el camino de tolerancia al 422
    (email ya registrado → lookup) sea testeable sin red real."""

    def __init__(self, *, base_url: str, service_role_key: str, client: httpx.Client | None = None) -> None:
        self._base_url = base_url.rstrip("/")
        self._service_role_key = service_role_key
        self._client = client or httpx.Client(timeout=_HTTP_TIMEOUT_SECONDS)

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
        """POST /auth/v1/admin/users — crea el user confirmado (`email_confirm:true`, spec §5.1).
        Devuelve el objeto GoTrue completo (incluye `id` = auth_user_id).

        Tolera el 422 (email ya registrado): la re-signup es un camino de usuario real (doble-clic,
        cuenta olvidada). En vez de explotar en `raise_for_status()`, busca el user existente
        (`_find_user_by_email`) y lo devuelve → hace idempotente al flujo completo (ver docstring
        del módulo). Si el 422 NO corresponde a un email hallable, se propaga el error original."""
        resp = self._client.post(
            f"{self._base_url}/auth/v1/admin/users",
            headers=self._headers(),
            json={"email": email, "password": password, "email_confirm": True},
        )
        if resp.status_code == _EMAIL_EXISTS_STATUS:
            existing = self._find_user_by_email(email)
            if existing is not None:
                return existing
            # 422 pero el lookup no encontró el email → error genuino (raro): propagar el 422.
        resp.raise_for_status()
        return resp.json()

    def _find_user_by_email(self, email: str) -> dict | None:
        """GET admin lookup del user por email (para tolerar el 422 de email duplicado). Devuelve
        el user (con `id`) o `None` si no aparece.

        [ASSUMED_PENDING_VERIFY @ go-live] El parámetro de filtro exacto de GoTrue v2.186.0 no se
        pudo re-verificar en sesión (la lectura admin trae PII; el operador pidió no re-verificar
        contra fusion). Se manda `filter=<email>` (el query documentado de GoTrue para búsqueda de
        users) PERO el match final es defensivo: se recorre la lista devuelta y se compara el email
        exacto (case-insensitive) — así, aunque el server ignore/aproxime el filtro, un match exacto
        dentro de la página devuelta funciona. La forma real se valida en el go-live smoke (Task 12).
        Se parsea tanto `{"users": [...]}` (shape estándar de GoTrue admin list) como una lista pelada."""
        resp = self._client.get(
            f"{self._base_url}/auth/v1/admin/users",
            headers=self._headers(),
            params={"filter": email},
        )
        resp.raise_for_status()
        payload = resp.json()
        users = payload.get("users", []) if isinstance(payload, dict) else payload
        target = email.lower()
        for user in users or []:
            if (user.get("email") or "").lower() == target:
                return user
        return None

    def admin_set_claim(self, user_id: str, cliente_id: str) -> None:
        """PUT /auth/v1/admin/users/{id} — setea `app_metadata.cliente_id` (paridad RLS; NO es
        el camino crítico de resolución, ver docstring del módulo)."""
        resp = self._client.put(
            f"{self._base_url}/auth/v1/admin/users/{user_id}",
            headers=self._headers(),
            json={"app_metadata": {"cliente_id": cliente_id}},
        )
        resp.raise_for_status()

    def password_grant(self, email: str, password: str) -> dict:
        """POST /auth/v1/token?grant_type=password — login real vía GoTrue self-host (Task 6, spec
        login proxy). Devuelve el JSON completo del token (`access_token`, `token_type`,
        `expires_in`, `refresh_token`, `user`) tal cual lo emite GoTrue -- el front-door lo reenvía
        sin tocarlo (`POST /auth/login`, web.py) para que el frontend lo use como Bearer.

        Mismos headers que las rutas admin (`_headers()`): el gateway (Kong) exige `apikey` en TODA
        ruta bajo `/auth/v1`, y este endpoint NO recibe el JWT del usuario (todavía no existe) --
        solo el `service_role_key` que la clase ya tiene. [Nota de diseño, no bloqueante: un `anon
        key` dedicado sería más semántico para un endpoint público de login, pero el `service_role_key`
        es equivalente en permisos server-side (nunca llega al browser) -- no bloquea Task 6.]

        Ante credenciales inválidas, GoTrue responde 400 (`invalid_grant`) o 401 -- se traduce a
        `InvalidCredentials` en vez de dejar que `raise_for_status()` tire un `httpx.HTTPStatusError`
        genérico, así el caller (la ruta `/auth/login`) puede mapearlo a un 401 propio sin acoplarse
        al shape de excepción de httpx. [ASSUMED_PENDING_VERIFY @ go-live] El status code EXACTO
        (400 vs 401) de GoTrue v2.186.0 ante credenciales inválidas no se re-verificó contra fusion
        en esta sesión -- se cubren ambos; se confirma en el go-live smoke (Task 12)."""
        resp = self._client.post(
            f"{self._base_url}/auth/v1/token",
            headers=self._headers(),
            params={"grant_type": "password"},
            json={"email": email, "password": password},
        )
        if resp.status_code in _INVALID_GRANT_STATUSES:
            raise InvalidCredentials(f"password grant failed: {resp.status_code}")
        resp.raise_for_status()
        return resp.json()


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
