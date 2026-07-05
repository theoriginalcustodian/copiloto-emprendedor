"""apps/copiloto/graphity_memory_client.py — cliente HTTP fino del thread-memory de Graphity (Zep-compat).

Tercer cliente Graphity del repo — NO confundir con los otros dos (domain-card `graphity.md`):
  (A) fábrica  → `deploy/worker/graphity_client.py` (SDK async, graph/fact-triples, memoria del músculo).
  (B) app-gen  → `clients/graphity_client.py` (urllib, lo que el asistente genera dentro de una app).
  (C) ESTE     → thread-memory del Copiloto (users/threads/messages/context), sync httpx, control-plane
                 confiable (tiene la key). Da la **memoria conversacional** del agente del emprendedor.

Espeja el patrón testeable de `onboarding.GoTrueAdmin`: `httpx.Client` inyectable → los tests ejercitan la
lógica con `httpx.MockTransport` sin red real; `from_env()` es el composition root (cero secretos hardcode).

Shapes verificados contra el server real (`Graphity/src/graphity_memory/api/v2/{users,threads,messages}.py`):
  POST /api/v2/users                      {user_id, email?, ...}          → 201 · **409 si existe** (idempotente)
  POST /api/v2/threads                    {thread_id, user_id}            → 201 · 409 si existe · **404 si el user no existe**
  POST /api/v2/threads/{id}/messages      {messages:[{role, content, name?}]}  (síncrono por default)
  GET  /api/v2/threads/{id}/context?facts_limit=&message_count=           → {context: str} · 404 si el thread no existe
  POST /api/v2/graph/episodes/user/{uid}  {lastn<=500}   → {episodes:[{content, valid_at, created_at, role, ...}]}
Auth: `X-API-Key: gphy_…` (el tenant se infiere de la key; NUNCA mandar X-Internal-Token — lo inyecta Caddy).
"""
from __future__ import annotations

import os
import random
import time
from datetime import datetime, timezone
from typing import Callable

import httpx

# Roles válidos del server (models/api/messages.py::RoleType). El copiloto usa user/assistant.
VALID_ROLES = frozenset({"user", "assistant", "tool", "system", "function"})

_IDEMPOTENT_OK = frozenset({200, 201, 409})   # 409 = el recurso ya existe → lazy-create idempotente
_RETRYABLE = frozenset({429, 502, 503, 504})  # backoff (client-integration §3); 401/404/4xx NO se reintentan
_READ_TIMEOUT_S = 10.0                          # reads ~10s (client-integration §latencias)
_WRITE_TIMEOUT_S = 35.0                         # ingest ≥35s (add_messages dispara extracción LLM server-side)
_WARM_TIMEOUT_S = 15.0                          # warm cold ~8s peor caso (spike graphity-memory-connectivity)


class GraphityMemoryError(RuntimeError):
    """Falla no recuperable del thread-memory (status inesperado tras agotar reintentos)."""


class GraphityMemoryClient:
    """Cliente sync del thread-memory. NO decide política (best-effort, identidad, envoltura) — eso vive en
    `MemoryProvider`. Acá solo: autenticar, hablar el shape correcto, reintentar 429/5xx, distinguir status."""

    def __init__(self, *, base_url: str, api_key: str, client: httpx.Client | None = None,
                 max_attempts: int = 4, sleep: Callable[[float], None] = time.sleep) -> None:
        self._base = base_url.rstrip("/") + "/api/v2"
        self._headers = {"X-API-Key": api_key, "Content-Type": "application/json"}
        # `httpx.Client` inyectable (default propio) → testeable con MockTransport, igual que GoTrueAdmin.
        self._client = client or httpx.Client(timeout=_READ_TIMEOUT_S)
        self._max_attempts = max_attempts
        self._sleep = sleep   # inyectable → los tests noopean el backoff sin esperas reales

    @classmethod
    def from_env(cls) -> "GraphityMemoryClient":
        """Composition root: lee las MISMAS vars que la fábrica (`config.GRAPHITY_BASE_URL_ENV`/`_KEY_ENV`).
        Falla claro si faltan (no degrada a un cliente mudo que enmascare un deploy sin credenciales)."""
        base = os.environ.get("GRAPHITY_BASE_URL")
        key = os.environ.get("GRAPHITY_API_KEY")
        if not base or not key:
            raise RuntimeError("faltan GRAPHITY_BASE_URL / GRAPHITY_API_KEY en el env del copiloto")
        return cls(base_url=base, api_key=key)

    # ── transporte con retry (429/5xx + timeout); 4xx no-retryable se devuelven para que el caller decida ──
    def _request(self, method: str, path: str, *, json: dict | None = None,
                 params: dict | None = None, timeout: float) -> httpx.Response:
        last_exc: Exception | None = None
        for attempt in range(self._max_attempts):
            try:
                resp = self._client.request(method, self._base + path, headers=self._headers,
                                            json=json, params=params, timeout=timeout)
            except (httpx.TimeoutException, httpx.TransportError) as exc:
                last_exc = exc
                if attempt == self._max_attempts - 1:
                    raise GraphityMemoryError(f"{method} {path}: {type(exc).__name__}") from exc
                self._sleep((2 ** attempt) + random.uniform(0, 0.5))
                continue
            if resp.status_code in _RETRYABLE and attempt < self._max_attempts - 1:
                self._sleep((2 ** attempt) + random.uniform(0, 0.5))
                continue
            return resp
        raise GraphityMemoryError(f"{method} {path}: agotados {self._max_attempts} intentos") from last_exc

    def ensure_user(self, user_id: str, *, email: str | None = None) -> None:
        """Lazy-create del user (owner del user graph = memoria general+chat). 409 = ya existía → OK."""
        body: dict = {"user_id": user_id}
        if email:
            body["email"] = email
        resp = self._request("POST", "/users", json=body, timeout=_READ_TIMEOUT_S)
        if resp.status_code not in _IDEMPOTENT_OK:
            raise GraphityMemoryError(f"ensure_user {user_id} → HTTP {resp.status_code}")

    def ensure_thread(self, thread_id: str, user_id: str) -> None:
        """Lazy-create del thread. El server da 404 si el user no existe → SIEMPRE llamar ensure_user antes.
        409 = el thread ya existía → OK."""
        resp = self._request("POST", "/threads", json={"thread_id": thread_id, "user_id": user_id},
                             timeout=_READ_TIMEOUT_S)
        if resp.status_code not in _IDEMPOTENT_OK:
            raise GraphityMemoryError(f"ensure_thread {thread_id} → HTTP {resp.status_code}")

    def add_messages(self, thread_id: str, messages: list[dict]) -> None:
        """Persiste + ingesta (extracción LLM server-side) los mensajes del turno/batch. Body verificado:
        {messages:[{role, content, name?}]}. `role` ∈ VALID_ROLES; `content` no vacío. Síncrono (sin ?async)."""
        clean = [_validate_message(m) for m in messages]
        resp = self._request("POST", f"/threads/{thread_id}/messages", json={"messages": clean},
                             timeout=_WRITE_TIMEOUT_S)
        if resp.status_code not in (200, 201, 202):
            raise GraphityMemoryError(f"add_messages {thread_id} → HTTP {resp.status_code}")

    def get_user_context(self, thread_id: str, *, facts_limit: int | None = None,
                         message_count: int | None = None) -> str:
        """Devuelve el Context Block (FACTS+ENTITIES) del thread para inyectar en el system prompt.
        404 (thread aún inexistente, primer turno) → "" (no es un error: es 'no hay memoria todavía')."""
        params = {k: v for k, v in (("facts_limit", facts_limit), ("message_count", message_count))
                  if v is not None}
        resp = self._request("GET", f"/threads/{thread_id}/context", params=params or None,
                             timeout=_READ_TIMEOUT_S)
        if resp.status_code == 404:
            return ""
        if resp.status_code != 200:
            raise GraphityMemoryError(f"get_user_context {thread_id} → HTTP {resp.status_code}")
        return (resp.json() or {}).get("context", "") or ""

    def search_user_facts(self, user_id: str, query: str, *, limit: int = 15) -> list[str]:
        """Busca en el USER GRAPH (cross-thread) los facts relevantes al `query` (RAG sobre el grafo del
        emprendedor). A DIFERENCIA de `get_user_context` — que hace RAG sobre los mensajes DEL THREAD y por eso
        devuelve vacío en una charla nueva sin mensajes (bug 2026-07-04) — esto usa el mensaje ACTUAL del turno
        como query y funciona cross-sesión. POST /graph/search scope=edges (facts). Devuelve la lista de
        strings `fact`; [] si no hay match (o 404). Shape verificado contra el server (spike): la respuesta trae
        `edges:[{fact, ...}]`."""
        if not query or not query.strip():
            return []
        resp = self._request("POST", "/graph/search",
                             json={"user_id": user_id, "query": query, "scope": "edges", "limit": limit},
                             timeout=_READ_TIMEOUT_S)
        if resp.status_code == 404:
            return []
        if resp.status_code != 200:
            raise GraphityMemoryError(f"search_user_facts {user_id} → HTTP {resp.status_code}")
        edges = (resp.json() or {}).get("edges") or []
        facts: list[str] = []
        for e in edges:
            fact = e.get("fact") if isinstance(e, dict) else None
            if isinstance(fact, str) and fact.strip():
                facts.append(fact.strip())
        return facts

    def list_episodes_in_range(self, user_id: str, since: datetime, until: datetime, *,
                               max_fetch: int = 500) -> list[dict]:
        """Episodios del user graph cuyo `valid_at` (cuándo PASÓ el evento; fallback `created_at`) cae en
        [since, until]. Fuente EXHAUSTIVA para "qué hice en tal período" — a diferencia de `search_user_facts`
        (semántico top-K, incompleto), trae TODO el rango, cross-sesión (un user graph unifica los threads).

        El server NO filtra por fecha en el listado (spike 2026-07-04: `lastn`→`created_at DESC`, `uuid_cursor`
        →uuid ASC, sin date-filter) → se traen los `lastn`≤500 más recientes y se filtra client-side por
        `valid_at`. **Se filtra por `valid_at`, NO `created_at`**: `created_at` es la fecha de INGESTA (≈ahora
        para todo), `valid_at` es cuándo ocurrió (spike-verificado). En charla real ≈ coinciden; si algún día se
        ingieren eventos pasados, `valid_at` sigue siendo el correcto.

        LÍMITE CONOCIDO (deuda visible, memoria `copiloto-recall-temporal`): si el user supera `max_fetch`
        episodios, se traen los más recientes; un rango más viejo que ese corte puede quedar incompleto. En
        early-days no se toca; la extensión es paginar por `uuid_cursor` (sin orden fecha → traer todo y filtrar).

        Devuelve `[{valid_at, role, content}]` ASCENDENTE por fecha; `[]` si no hay o ante 404."""
        lastn = max(1, min(int(max_fetch), 500))
        resp = self._request("POST", f"/graph/episodes/user/{user_id}",
                             json={"lastn": lastn}, timeout=_READ_TIMEOUT_S)
        if resp.status_code == 404:
            return []
        if resp.status_code != 200:
            raise GraphityMemoryError(f"list_episodes_in_range {user_id} → HTTP {resp.status_code}")
        episodes = (resp.json() or {}).get("episodes") or []
        rows: list[tuple[datetime, dict]] = []
        for e in episodes:
            if not isinstance(e, dict):
                continue
            stamp = e.get("valid_at") or e.get("created_at")
            when = _parse_iso(stamp)
            content = e.get("content")
            if when is None or not (since <= when <= until):
                continue
            if not isinstance(content, str) or not content.strip():
                continue
            rows.append((when, {"valid_at": stamp, "role": e.get("role"), "content": content.strip()}))
        # Orden cronológico por el datetime PARSEADO, no por el string crudo (2ª pasada 2026-07-04): con
        # formatos mixtos el string engaña — '…T12:00:00+03:00' (=09:00Z) ordena lexicográficamente DESPUÉS
        # de '…T10:00:00' (=10:00Z). El aware normalizado sí tiene orden total.
        rows.sort(key=lambda r: r[0])
        return [r[1] for r in rows]

    def warm_session(self, user_id: str) -> bool:
        """Precarga el page-cache de Neo4j del user graph del emprendedor (índices HNSW) — GET
        /users/{id}/warm. Llamar al ABRIR la sesión de chat para bajar la latencia del 1er recall.
        BEST-EFFORT: devuelve `warmed` (True/False), NUNCA lanza — un warm que falla no debe bloquear
        el inicio de sesión (el enfriamiento es LRU del page-cache, no un timer; ver server graph.py)."""
        try:
            resp = self._request("GET", f"/users/{user_id}/warm", timeout=_WARM_TIMEOUT_S)
        except GraphityMemoryError:
            return False
        return resp.status_code == 200 and bool((resp.json() or {}).get("warmed", False))

    def delete_user(self, user_id: str) -> None:
        """RTBF / GDPR: borra el user + cascade (threads/messages) + su namespace en Neo4j (server DELETE
        /users/{id}). 404 = ya no existe → OK (idempotente)."""
        resp = self._request("DELETE", f"/users/{user_id}", timeout=_READ_TIMEOUT_S)
        if resp.status_code not in (200, 204, 404):
            raise GraphityMemoryError(f"delete_user {user_id} → HTTP {resp.status_code}")


def _parse_iso(value) -> datetime | None:
    """Parsea un timestamp ISO del server a datetime AWARE (UTC); None si no se puede. Usado por el filtro de
    rango — comparar contra `since`/`until` que llegan aware UTC del resolver.

    CLAVE (review adversarial 2026-07-04): el server serializa muchos timestamps SIN offset ('2026-07-14T10:00:00'
    — el copiloto persiste reference_time con `datetime.now(tz=UTC).replace(tzinfo=None)`, que sale naive). Sin
    normalizar, `datetime.fromisoformat` devolvería un naive y `since <= naive <= until` (aware) lanzaría
    TypeError (offset-naive vs offset-aware) que colgaba el turno. Los timestamps naive del server SON UTC-valued
    → se les fija UTC. Un timestamp con offset se respeta tal cual."""
    if not isinstance(value, str) or not value.strip():
        return None
    try:
        dt = datetime.fromisoformat(value.strip().replace("Z", "+00:00"))
    except ValueError:
        return None
    return dt if dt.tzinfo is not None else dt.replace(tzinfo=timezone.utc)


def _validate_message(m: dict) -> dict:
    """Normaliza/valida UN mensaje contra el contrato del server (role enum + content no vacío). Falla
    fuerte ante un mensaje mal formado ANTES de la red (mejor un error claro local que un 422 opaco)."""
    role = m.get("role")
    content = m.get("content")
    if role not in VALID_ROLES:
        raise ValueError(f"role inválido: {role!r} (válidos: {sorted(VALID_ROLES)})")
    if not isinstance(content, str) or not content.strip():
        raise ValueError("content debe ser un string no vacío")
    out = {"role": role, "content": content}
    if m.get("name"):
        out["name"] = m["name"]
    return out
