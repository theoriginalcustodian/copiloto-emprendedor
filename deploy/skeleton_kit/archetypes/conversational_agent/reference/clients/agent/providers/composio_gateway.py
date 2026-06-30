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
    def authorize(self, user_id: str, toolkit: str) -> str:
        session = self._sdk.create(user_id=user_id)
        link = session.authorize(toolkit)
        return (getattr(link, "redirect_url", None)
                or (link.get("redirect_url") if isinstance(link, dict) else None)
                or str(link))

    def list_connections(self, user_id: str) -> list:
        accounts = self._sdk.connected_accounts.list()
        items = getattr(accounts, "items", None) or accounts
        out = []
        for a in items:
            a_uid = getattr(a, "user_id", None) or (a.get("user_id") if isinstance(a, dict) else None)
            if a_uid != user_id:
                continue
            out.append({
                "id": getattr(a, "id", None) or (a.get("id") if isinstance(a, dict) else None),
                "toolkit": getattr(a, "toolkit", None) or (a.get("toolkit") if isinstance(a, dict) else None),
                "status": getattr(a, "status", None) or (a.get("status") if isinstance(a, dict) else None),
            })
        return out

    def connection_status(self, user_id: str, toolkit: str):
        for c in self.list_connections(user_id):
            if c["toolkit"] == toolkit:
                return c["status"]
        return None

    def revoke(self, connection_id: str) -> None:
        self._sdk.connected_accounts.delete(connection_id)
