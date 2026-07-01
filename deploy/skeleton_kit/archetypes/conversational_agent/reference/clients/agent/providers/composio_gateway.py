"""ComposioGateway — boundary fail-closed entre el agente (LLM no confiable) y los servicios
externos vía Composio (capa PLANTILLA, agnóstica del dominio).

Gemelo de LlmProvider/GroqSTT: sync (se invoca desde una activity vía asyncio.to_thread; I/O de
red -> activity, NUNCA workflow). El SDK `composio` se importa LAZY dentro del client_factory default,
así los unit (factory mockeado) no requieren composio instalado. Cero secretos: COMPOSIO_API_KEY del env
(SDK key de api.composio.dev, NO la MCP key). Spec: docs/superpowers/specs/2026-06-30-composio-gateway-design.md
"""
from __future__ import annotations

import os
from dataclasses import dataclass


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

    def _auth_config_id(self, toolkit: str) -> str:
        """auth_config_id del toolkit (Composio-managed). Necesario para generar el link de conexión."""
        acs = self._sdk.auth_configs.list(toolkit_slug=toolkit)
        items = self._unwrap_items(acs)
        for a in items:
            ac_id = getattr(a, "id", None) or (a.get("id") if isinstance(a, dict) else None)
            if ac_id:
                return ac_id
        raise ComposioExecutionError(f"no hay auth_config para toolkit={toolkit!r}")

    def authorize(self, user_id: str, toolkit: str) -> str:
        """redirect_url para que el usuario conecte su cuenta del toolkit (onboarding OAuth). El endpoint
        legacy (sdk.create().authorize()) fue RETIRADO por Composio (400 ConnectedAccount_BadRequest) →
        se usa connected_accounts.link con el auth_config_id del toolkit."""
        req = self._sdk.connected_accounts.link(user_id=user_id,
                                                auth_config_id=self._auth_config_id(toolkit))
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
