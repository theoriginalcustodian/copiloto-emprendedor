"""Tests de `apps/copiloto/serve.py` — composition root real del front-door (Task 11).

NO conecta Temporal, Postgres ni GoTrue reales; NO arranca uvicorn. Solo ejercita el wiring
import-safe: el módulo importa aunque NINGÚN env obligatorio esté seteado (todos los
`os.environ[...]` que revientan viven dentro de `_serve()`, jamás a nivel de módulo), expone la
forma esperada (`_serve` coroutine, `main` sync) y los defaults de host/puerto documentados
(Caddy `copiloto.*` -> 127.0.0.1:8099, `deploy/copiloto/Caddyfile.snippet`)."""
from __future__ import annotations

import importlib
import inspect
import sys
from pathlib import Path


import serve  # noqa: E402

_REQUIRED_AT_RUNTIME_ONLY = (
    "DATABASE_URL", "SUPABASE_JWT_SECRET", "COPILOTO_FERNET_KEY", "SUPABASE_URL", "SERVICE_ROLE_KEY",
    "MP_CLIENT_ID", "MP_CLIENT_SECRET", "MP_REDIRECT_URI", "MP_WEBHOOK_SECRET",
)


def test_serve_module_imports_without_any_env_set(monkeypatch):
    """Import-safety: reimportar el módulo SIN ninguno de los env obligatorios en runtime no
    revienta -- prueba que están todos detrás de `_serve()`, nunca a nivel de módulo."""
    for var in _REQUIRED_AT_RUNTIME_ONLY:
        monkeypatch.delenv(var, raising=False)
    importlib.reload(serve)


def test_serve_exposes_async_entrypoint_and_sync_main():
    assert inspect.iscoroutinefunction(serve._serve)
    assert not inspect.iscoroutinefunction(serve.main)
    assert callable(serve._conn_factory_from_env)


def test_web_host_port_defaults_match_vps_caddy_route(monkeypatch):
    """Defaults documentados (Caddy `copiloto.*` -> 127.0.0.1:8099) -- parametrizables vía env
    (COPILOTO_WEB_HOST/COPILOTO_WEB_PORT), nunca un literal sin vía de override."""
    monkeypatch.delenv("COPILOTO_WEB_HOST", raising=False)
    monkeypatch.delenv("COPILOTO_WEB_PORT", raising=False)
    importlib.reload(serve)
    assert serve.WEB_HOST == "127.0.0.1"
    assert serve.WEB_PORT == 8099


def test_web_port_overridable_via_env(monkeypatch):
    monkeypatch.setenv("COPILOTO_WEB_PORT", "9911")
    importlib.reload(serve)
    assert serve.WEB_PORT == 9911
    monkeypatch.delenv("COPILOTO_WEB_PORT", raising=False)
    importlib.reload(serve)  # deja el módulo con los defaults para no filtrar estado a otros tests
