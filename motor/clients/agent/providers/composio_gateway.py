"""ComposioGateway — boundary fail-closed entre el agente (LLM no confiable) y los servicios
externos vía Composio (capa PLANTILLA, agnóstica del dominio).

Gemelo de LlmProvider/GroqSTT: sync (se invoca desde una activity vía asyncio.to_thread; I/O de
red -> activity, NUNCA workflow). El SDK `composio` se importa LAZY dentro del client_factory default,
así los unit (factory mockeado) no requieren composio instalado. Cero secretos: COMPOSIO_API_KEY del env
(SDK key de api.composio.dev, NO la MCP key). Spec: docs/superpowers/specs/2026-06-30-composio-gateway-design.md
"""
from __future__ import annotations

import logging
import os
from dataclasses import dataclass


_log = logging.getLogger(__name__)


@dataclass(frozen=True)
class ToolkitPolicy:
    version: str                 # versión pineada del toolkit; NUNCA "latest"
    read: frozenset              # slugs read-only permitidos (UPPER)
    write: frozenset             # slugs de escritura permitidos (UPPER; exigen confirmed=True)


# Meta-tools del workbench universal de Composio: ejecución arbitraria. Denylist HARD.
DEFAULT_DENYLIST = frozenset({"COMPOSIO_REMOTE_BASH_TOOL", "COMPOSIO_MULTI_EXECUTE_TOOL"})

# Prioridad de estados de una connected account: ACTIVE gana sobre intentos intermedios/expirados.
_STATUS_RANK = {"ACTIVE": 3, "INITIALIZING": 2, "INITIATED": 2, "EXPIRED": 1}


class ComposioPolicyError(Exception):
    """Base de los rechazos de policy del gateway."""


class ToolNotAllowed(ComposioPolicyError):
    """El slug no está en read∪write de ningún toolkit de la policy."""


class MetaToolBlocked(ComposioPolicyError):
    """El slug está en el denylist (gana sobre la policy)."""


class ConfirmationRequired(ComposioPolicyError):
    """Un write se intentó ejecutar sin confirmed=True."""


class ComposioExecutionError(Exception):
    """Envuelve un fallo del SDK con contexto (sin secretos)."""


class ConnectionRequired(ComposioExecutionError):
    """La cuenta del toolkit NO está conectada para el user (Composio 400 / slug ActionExecute_
    ConnectedAccountNotFound / code 1810). Error PERMANENTE, NO reintentable: el user debe conectar el
    servicio. Subclase de ComposioExecutionError para que el manejo genérico la siga atrapando; el dispatcher
    la DISTINGUE para dar un mensaje accionable ('conectá X'). NUNCA debe propagarse como excepción de activity
    → Temporal la reintentaría ∞ y colgaría el turno ('Pensando…' eterno, bug 2026-07-04)."""

    def __init__(self, toolkit: str):
        self.toolkit = toolkit
        super().__init__(f"toolkit {toolkit!r} no conectado para el user (ConnectedAccountNotFound)")


def _is_connection_missing(err: Exception) -> bool:
    """True si el fallo del SDK es 'cuenta no conectada' (Composio 400, slug ActionExecute_
    ConnectedAccountNotFound). Se inspecciona el texto — el gateway es agnóstico del SDK (no importa
    composio_client) y así resiste cambios de la clase de excepción concreta."""
    s = str(err)
    return "ConnectedAccountNotFound" in s or "No connected account found" in s


class ComposioGateway:
    def __init__(self, policy, *, api_key_env: str = "COMPOSIO_API_KEY",
                 denylist=DEFAULT_DENYLIST, client_factory=None):
        if not policy:
            raise ValueError("ComposioGateway requiere una policy no vacía (fail-closed)")
        # Normaliza slugs a UPPER para resolución case-insensitive robusta.
        self._policy = {
            tk: ToolkitPolicy(version=p.version,
                              read=frozenset(s.upper() for s in p.read),
                              write=frozenset(s.upper() for s in p.write))
            for tk, p in policy.items()
        }
        self._api_key_env = api_key_env
        self._denylist = frozenset(s.upper() for s in denylist)
        self._client_factory = client_factory or self._default_client_factory
        self._client = None  # lazy

    def _default_client_factory(self):
        from composio import Composio  # lazy: los unit con mock nunca lo disparan
        if not os.environ.get(self._api_key_env):
            raise RuntimeError(f"falta {self._api_key_env} en el env")
        return Composio()

    @property
    def _sdk(self):
        if self._client is None:
            self._client = self._client_factory()
        return self._client

    # ── plano de ejecución ────────────────────────────────────────────────────
    def _classify(self, slug: str):
        for toolkit, pol in self._policy.items():
            if slug in pol.read:
                return toolkit, "read"
            if slug in pol.write:
                return toolkit, "write"
        raise ToolNotAllowed(slug)

    def execute(self, slug: str, *, user_id: str, arguments: dict, confirmed: bool = False) -> dict:
        slug = slug.upper()
        if slug in self._denylist:
            raise MetaToolBlocked(slug)
        toolkit, mode = self._classify(slug)            # ToolNotAllowed si no está
        if mode == "write" and not confirmed:
            raise ConfirmationRequired(slug)
        version = self._policy[toolkit].version
        try:
            return self._sdk.tools.execute(slug, user_id=user_id, arguments=arguments, version=version)
        except (ComposioPolicyError, ComposioExecutionError):
            raise
        except Exception as e:
            if _is_connection_missing(e):
                raise ConnectionRequired(toolkit) from e   # permanente: el user debe conectar el toolkit
            raise ComposioExecutionError(
                f"execute {slug} (toolkit={toolkit}, user_id={user_id}) falló: {type(e).__name__}"
            ) from e

    def allowed_tools(self, toolkit: str, *, mode: str = "read") -> list:
        pol = self._policy.get(toolkit)
        if pol is None:
            return []
        if mode == "read":
            return sorted(pol.read)
        if mode == "write":
            return sorted(pol.write)
        if mode == "all":
            return sorted(pol.read | pol.write)
        raise ValueError(f"mode inválido: {mode!r} (read|write|all)")

    # ── plano de conexión (onboarding) ────────────────────────────────────────
    @staticmethod
    def _slug_of(tk):
        """Normaliza el toolkit de una connected account a su slug string. El SDK lo devuelve como
        objeto ItemToolkit(slug=...), pero según el endpoint puede venir como dict o string → unificar.
        Sin esto, comparar el objeto contra un slug string siempre da False (bug de connection_status)."""
        if tk is None:
            return None
        if isinstance(tk, str):
            return tk
        slug = getattr(tk, "slug", None)
        if slug:
            return slug
        if isinstance(tk, dict):
            return tk.get("slug") or tk.get("toolkit")
        return str(tk)

    @staticmethod
    def _unwrap_items(resp):
        """Desempaqueta la lista de items de una respuesta paginada del SDK. Distingue 'sin atributo items'
        (cae al propio resp — algunos endpoints devuelven la lista directa) de 'items == []' (lista vacía
        legítima). El patrón ingenuo `getattr(resp, "items", None) or resp` cae al objeto contenedor cuando
        la lista está vacía (usuario sin conexiones) → TypeError al iterar."""
        if isinstance(resp, dict):
            return resp.get("items", resp)
        items = getattr(resp, "items", None)
        return items if items is not None else resp

    @staticmethod
    def _campo(obj, nombre):
        """Lee un campo de un objeto del SDK o de un dict — el SDK devuelve las dos formas según el
        endpoint, y `getattr(dict, x, None)` siempre da None sin avisar."""
        if isinstance(obj, dict):
            return obj.get(nombre)
        return getattr(obj, nombre, None)

    def _auth_config(self, toolkit: str) -> tuple[str, bool]:
        """`(auth_config_id, es_de_composio)` de la config a usar. **Prefiere SIEMPRE la propia.**

        🔴 Antes devolvía la PRIMERA de la lista. Mientras hubo una sola config por toolkit eso daba
        igual; con la nuestra y la de Composio conviviendo —el estado durante la migración a
        credenciales propias— elegiría una de las dos **sin criterio y sin error**. El síntoma sería
        "a veces conecta bien y a veces te manda al dashboard de Composio", que llega como bug de la
        app y se busca en la pantalla equivocada.

        Ante empate dentro del mismo grupo se ordena por id: no importa cuál gane, importa que gane
        siempre la misma. Un desempate arbitrario convierte un bug reproducible en uno intermitente.
        """
        items = self._unwrap_items(self._sdk.auth_configs.list(toolkit_slug=toolkit))
        candidatas = [(self._campo(a, "id"), bool(self._campo(a, "is_composio_managed")))
                      for a in items if self._campo(a, "id")]
        if not candidatas:
            raise ComposioExecutionError(f"no hay auth_config para toolkit={toolkit!r}")
        propias = [c for c in candidatas if not c[1]]
        return sorted(propias or candidatas)[0]

    def authorize(self, user_id: str, toolkit: str) -> str:
        """redirect_url para que el usuario conecte su cuenta del toolkit (onboarding OAuth).

        Dos caminos, según de quién sea la app OAuth:

        - **config propia** → `initiate`, que devuelve el consentimiento de Google directo, con la
          marca del copiloto. Es el que queremos.
        - **config de Composio** → sólo su link hospedado. `initiate` está RETIRADO para esas
          (400 `ComposioLegacyConnectedAccountsEndpointRetiredError`) y el link resuelve a
          `dashboard.composio.dev`: el usuario ve una pantalla de un tercero que no es Google ni
          nosotros. Es el estado actual y lo que el cliente OAuth propio viene a arreglar.

        El fallback a `link` cuando `initiate` falla con config propia **loguea**: sin eso, una
        degradación silenciosa nos devolvería al dashboard sin que nadie se entere de por qué.
        """
        ac_id, es_de_composio = self._auth_config(toolkit)
        if not es_de_composio:
            try:
                return self._redirect_de(
                    self._sdk.connected_accounts.initiate(user_id=user_id, auth_config_id=ac_id))
            except Exception as exc:  # noqa: BLE001 — degradar es preferible a no poder conectar
                _log.warning("initiate falló con la auth config propia de %r (%s: %s); "
                             "se cae al link hospedado de Composio", toolkit, type(exc).__name__, exc)
        return self._redirect_de(
            self._sdk.connected_accounts.link(user_id=user_id, auth_config_id=ac_id))

    @staticmethod
    def _redirect_de(req) -> str:
        return (getattr(req, "redirect_url", None)
                or (req.get("redirect_url") if isinstance(req, dict) else None)
                or str(req))

    def _iter_accounts(self, **filters):
        """Itera TODAS las connected accounts que matchean los filtros server-side, paginando por cursor.
        connected_accounts.list devuelve una pagina (~10-20 items) + next_cursor: sin paginar, una conexion
        ACTIVE en una pagina posterior quedaba invisible (bug 2026-07-01)."""
        kw = {k: v for k, v in filters.items() if v is not None}
        cursor = None
        while True:
            page = self._sdk.connected_accounts.list(**kw, **({"cursor": cursor} if cursor else {}))
            for a in self._unwrap_items(page):
                yield a
            cursor = (getattr(page, "next_cursor", None)
                      or (page.get("next_cursor") if isinstance(page, dict) else None))
            if not cursor:
                break

    def list_connections(self, user_id: str) -> list:
        """Todas las conexiones del user: filtro server-side por user_id + paginacion completa (antes traia
        solo la primera pagina de connected_accounts.list() sin filtrar -> ocultaba conexiones)."""
        out = []
        for a in self._iter_accounts(user_ids=[user_id]):
            a_uid = getattr(a, "user_id", None) or (a.get("user_id") if isinstance(a, dict) else None)
            if a_uid != user_id:            # defensa si el backend ignora el filtro server-side
                continue
            tk = getattr(a, "toolkit", None) or (a.get("toolkit") if isinstance(a, dict) else None)
            out.append({
                "id": getattr(a, "id", None) or (a.get("id") if isinstance(a, dict) else None),
                "toolkit": self._slug_of(tk),          # slug string, NO el objeto ItemToolkit
                "status": getattr(a, "status", None) or (a.get("status") if isinstance(a, dict) else None),
            })
        return out

    def connection_status(self, user_id: str, toolkit: str):
        """Estado de la conexion del toolkit para el user, priorizando ACTIVE sobre estados intermedios
        (INITIALIZING/INITIATED/EXPIRED) — un intento a medias no debe ocultar una conexion ACTIVE."""
        want = (toolkit or "").lower()
        best, best_rank = None, -1
        for c in self.list_connections(user_id):
            if (c["toolkit"] or "").lower() != want:
                continue
            rank = _STATUS_RANK.get((c["status"] or "").upper(), 0)
            if rank > best_rank:
                best, best_rank = c["status"], rank
        return best

    def revoke(self, connection_id: str) -> None:
        self._sdk.connected_accounts.delete(connection_id)
