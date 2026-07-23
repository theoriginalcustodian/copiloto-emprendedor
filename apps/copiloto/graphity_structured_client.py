"""Cliente HTTP del camino STRUCTURED (0-LLM) de Graphity — la plomería del writer del grafo de negocio.

Hito 5 §1.2. Es la capa BAJA: autenticar, hablar el shape correcto, reintentar 429/5xx, y distinguir
status. **No decide política de dominio** (qué se deduplica, qué es evento, cuándo invalidar) — eso
vive en el mapping (§1.3) y en la máquina del writer (`grafo_writer`, la capa de arriba). Contrato del
servidor verificado en `docs/ingesta-determinista-grafo.md` (leído contra el código real de Graphity).

Espeja el patrón testeable de `graphity_memory_client`: `httpx.Client` inyectable → los tests
ejercitan la lógica con `httpx.MockTransport` sin red real; `from_env()` es el composition root (cero
secretos hardcode).

🔴 **Tenant/key PROPIOS, distintos de la memoria.** El grafo de negocio vive en un tenant Graphity
**dedicado** (`copiloto`, decisión del operador 2026-07-22: la instancia está compartida entre
proyectos y sin aislamiento propio hay fuga cross-proyecto). Por eso `from_env` lee
`GRAPHITY_GRAFO_*`, NO las `GRAPHITY_*` de la memoria conversacional — pisarlas mezclaría los dos
grafos.

Auth: `X-API-Key: gphy_…` (el tenant sale de la key; NUNCA mandar X-Internal-Token — lo inyecta Caddy).

Dos posturas fail-closed que el doc exige, porque el modo de fallo de este camino es **200 y vacío**,
no un error (trampas 2/3 del doc):
- El **202 no es "escrito", es "encolado"** (trampa 3): `post_structured` devuelve el `migration_id` y
  el caller DEBE `poll_migration` hasta `completed`/`failed`.
- `on_error` va en **`"strict"`** por default (trampa 2: el default del server es `"partial"`, que
  termina `completed` con filas perdidas), y `poll_migration` **igual** revienta si `totals.failed>0`
  o `status=="failed"` — es la última línea de defensa, no una capa redundante.
"""
from __future__ import annotations

import math
import os
import random
import time
from typing import Any, Callable

import httpx

_RETRYABLE = frozenset({429, 502, 503, 504})   # backoff; 4xx (400 scope / 422 ontología) NO se reintentan
_READ_TIMEOUT_S = 10.0
_WRITE_TIMEOUT_S = 30.0                          # el POST encola (no corre LLM), pero el batch puede ser grande
_POLL_INTERVAL_S = 2.0
_ESTADOS_TERMINALES = frozenset({"completed", "failed"})


class GrafoIngestError(RuntimeError):
    """Falla no recuperable de la ingesta structured: status inesperado, ontología (422), scope (400),
    migración `failed`, o `totals.failed>0`. Se rechaza fail-closed en vez de reportar un éxito vacío."""


class GraphityStructuredClient:
    def __init__(self, *, base_url: str, api_key: str, client: httpx.Client | None = None,
                 max_attempts: int = 4, sleep: Callable[[float], None] = time.sleep) -> None:
        self._base = base_url.rstrip("/") + "/api/v2"
        self._headers = {"X-API-Key": api_key, "Content-Type": "application/json"}
        self._client = client or httpx.Client(timeout=_READ_TIMEOUT_S)
        self._max_attempts = max_attempts
        self._sleep = sleep   # inyectable → los tests noopean el backoff y el poll sin esperas reales

    @classmethod
    def from_env(cls) -> "GraphityStructuredClient":
        """Composition root. Lee las vars del grafo de NEGOCIO (dedicado), NO las de la memoria."""
        base = os.environ.get("GRAPHITY_GRAFO_BASE_URL")
        key = os.environ.get("GRAPHITY_GRAFO_API_KEY")
        if not base or not key:
            raise RuntimeError(
                "faltan GRAPHITY_GRAFO_BASE_URL / GRAPHITY_GRAFO_API_KEY en el env del copiloto "
                "(el grafo de negocio usa un tenant dedicado, distinto del de la memoria)")
        return cls(base_url=base, api_key=key)

    # ── transporte con retry (429/5xx + timeout); 4xx se devuelven para que el caller decida ──────────
    def _request(self, method: str, path: str, *, json: dict | None = None,
                 headers: dict | None = None, timeout: float = _READ_TIMEOUT_S) -> httpx.Response:
        last_exc: Exception | None = None
        merged = self._headers if headers is None else {**self._headers, **headers}
        for attempt in range(self._max_attempts):
            try:
                resp = self._client.request(method, self._base + path, headers=merged,
                                            json=json, timeout=timeout)
            except (httpx.TimeoutException, httpx.TransportError) as exc:
                last_exc = exc
                if attempt == self._max_attempts - 1:
                    break
                self._sleep((2 ** attempt) + random.uniform(0, 0.5))
                continue
            if resp.status_code in _RETRYABLE and attempt < self._max_attempts - 1:
                self._sleep((2 ** attempt) + random.uniform(0, 0.5))
                continue
            return resp
        raise GrafoIngestError(f"{method} {path}: agotados {self._max_attempts} intentos") from last_exc

    # ── POST /graph/structured ───────────────────────────────────────────────────────────────────────
    def post_structured(self, mapping: dict, rows: list[dict], *, group_id: str,
                        dedup: str = "exact", on_error: str = "strict",
                        validate_only: bool = False, idempotency_key: str | None = None) -> dict:
        """POST del dataset. `dedup="exact"` (0-LLM, trampa 1) y `on_error="strict"` (trampa 2) por
        default — cambiarlos es optar por un camino con LLM o por perder filas en silencio.

        `validate_only=True` → dry-run: 200 sin escribir, para probar el mapping/ontología antes de
        tocar nada. Devuelve el body de validación.

        `validate_only=False` → **202 encolado**: devuelve `{migration_id, ...}`. NO está escrito hasta
        que `poll_migration` diga `completed` (trampa 3).
        """
        body = {"mapping": mapping, "rows": rows, "group_id": group_id,
                "dedup": dedup, "on_error": on_error, "validate_only": validate_only}
        # Idempotency-Key atado a CONTENIDO+scope (nunca al índice posicional de la partición): un
        # reintento del mismo dataset no duplica; dos datasets distintos no colisionan.
        hdr = {"Idempotency-Key": idempotency_key} if idempotency_key else None
        resp = self._request("POST", "/graph/structured", json=body, headers=hdr,
                             timeout=_WRITE_TIMEOUT_S)
        if validate_only:
            if resp.status_code == 200:
                return resp.json()
            raise GrafoIngestError(f"validate_only POST /graph/structured: {resp.status_code} {resp.text[:300]}")
        if resp.status_code == 202:
            return resp.json()
        # 400 (falta project scope) / 422 (tipo/edge/atributo fuera de la ontología) / otro: fail-loud.
        raise GrafoIngestError(f"POST /graph/structured: {resp.status_code} {resp.text[:300]}")

    # ── GET /graph/structured/{migration_id} — pollear hasta terminal ────────────────────────────────
    def poll_migration(self, migration_id: str, *, budget_s: float = 90.0,
                       poll_interval_s: float = _POLL_INTERVAL_S) -> dict:
        """Pollea hasta `completed`/`failed` o hasta agotar `budget_s` (que DEBE ser menor que el
        timeout de la activity Temporal que envuelve esto). Fail-closed: revienta si `failed`, si
        `totals.failed>0`, o si se agota el presupuesto — nunca devuelve un job a medio hacer como
        éxito."""
        # Contamos iteraciones en vez de mirar el reloj: determinista y testeable (sleep inyectable).
        max_polls = max(1, math.ceil(budget_s / poll_interval_s))
        estado = None
        for i in range(max_polls):
            resp = self._request("GET", f"/graph/structured/{migration_id}")
            if resp.status_code != 200:
                raise GrafoIngestError(
                    f"GET /graph/structured/{migration_id}: {resp.status_code} {resp.text[:300]}")
            estado = resp.json()
            if estado.get("status") in _ESTADOS_TERMINALES:
                break
            if i < max_polls - 1:
                self._sleep(poll_interval_s)
        else:
            raise GrafoIngestError(
                f"migración {migration_id}: presupuesto de {budget_s}s agotado sin terminar "
                f"(último status={estado.get('status') if estado else 'desconocido'})")

        if estado.get("status") == "failed":
            raise GrafoIngestError(f"migración {migration_id} failed: {estado.get('row_errors')}")
        totals = estado.get("totals") or {}
        if (totals.get("failed") or 0) > 0:
            # on_error='strict' NO debería llegar acá, pero es la última línea de defensa (trampa 2).
            raise GrafoIngestError(
                f"migración {migration_id} completada con {totals['failed']} filas perdidas: "
                f"{estado.get('row_errors')}")
        return estado

    # ── GET /graph/edges/{uuid} — leer una arista CON sus attributes (para el guard anti-resurrección) ─
    def get_edge(self, edge_uuid: str) -> dict | None:
        """La arista con sus `attributes` (`invalid_at` incluido), o `None` si no existe (404). Es lo
        que el guard anti-resurrección consulta ANTES de todo POST: una arista ya invalidada NO se
        re-emite (si no, el `SET e = edge` del re-POST le pisa el `invalid_at` con `None` y la resucita
        — trampa 4). Sólo este GET proyecta `attributes`; `/search` y `/traverse` no (trampa 6)."""
        resp = self._request("GET", f"/graph/edges/{edge_uuid}")
        if resp.status_code == 404:
            return None
        if resp.status_code == 200:
            return resp.json()
        raise GrafoIngestError(f"GET /graph/edges/{edge_uuid}: {resp.status_code} {resp.text[:300]}")

    # ── PATCH /graph/edge/{uuid} — invalidar (después de TODOS los POST) ──────────────────────────────
    def patch_edge_invalidate(self, edge_uuid: str, invalid_at: str) -> dict:
        """Invalida una arista seteando su `invalid_at` (ISO-8601). Va DESPUÉS de que todos los POST
        terminaron (orden obligatorio, trampa 4). `PATCH {"invalid_at": null}` NO des-invalida —devuelve
        200 y no hace nada (trampa 5)—, así que reactivar es escribir un hecho nuevo, no revivir éste."""
        resp = self._request("PATCH", f"/graph/edge/{edge_uuid}", json={"invalid_at": invalid_at})
        if resp.status_code == 200:
            return resp.json() if resp.content else {}
        raise GrafoIngestError(f"PATCH /graph/edge/{edge_uuid}: {resp.status_code} {resp.text[:300]}")

    # ── LECTURA (IN §3, el chat) ─────────────────────────────────────────────────────────────────────
    # 🔴 `/graph/traverse` NO EXISTE en el server (spike 2026-07-23: 405 Method Not Allowed, pese a que
    # el contrato de IN lo menciona). El mecanismo real de lectura son estos dos: `search` (semántico,
    # top-K) y los listados exhaustivos por graph — se usan compuestos para navegación multi-hop
    # (ej. Comprobante→INCLUYE→Concepto): traer el listado y resolver la relación en memoria.

    def search(self, query: str, *, group_ids: list[str], scope: str = "edges", limit: int = 10) -> dict:
        """`POST /graph/search` — semántico, top-K. Confirmado (hito 5): **NO filtra `invalid_at`** —
        el caller filtra vigencia del lado del cliente antes de usar el resultado (trampa 6)."""
        resp = self._request("POST", "/graph/search",
                             json={"query": query, "group_ids": group_ids, "scope": scope, "limit": limit})
        if resp.status_code == 200:
            return resp.json()
        raise GrafoIngestError(f"POST /graph/search: {resp.status_code} {resp.text[:300]}")

    def listar_edges_del_graph(self, group_id: str, *, limit: int = 500) -> list[dict]:
        """`GET /graph/edge/graph/{group_id}` — TODAS las aristas del graph (paginado por `limit`), con
        `invalid_at` en la raíz (no bajo `attributes` — mismo shape que `get_edge`). Sirve de sustituto
        de `traverse`: sin navegación por uuid, se trae el listado y se resuelve la relación en memoria
        (el dataset de negocio es chico; ver el límite conocido en `inteligencia_chat.py`)."""
        resp = self._request("GET", f"/graph/edge/graph/{group_id}?limit={limit}")
        if resp.status_code == 200:
            return (resp.json() or {}).get("edges") or []
        raise GrafoIngestError(f"GET /graph/edge/graph/{group_id}: {resp.status_code} {resp.text[:300]}")

    def listar_nodes_del_graph(self, group_id: str, *, limit: int = 500) -> list[dict]:
        """`GET /graph/node/graph/{group_id}` — todos los nodos del graph, paginado."""
        resp = self._request("GET", f"/graph/node/graph/{group_id}?limit={limit}")
        if resp.status_code == 200:
            return (resp.json() or {}).get("nodes") or []
        raise GrafoIngestError(f"GET /graph/node/graph/{group_id}: {resp.status_code} {resp.text[:300]}")
