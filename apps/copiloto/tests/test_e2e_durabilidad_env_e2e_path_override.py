"""BLB1: `scripts/e2e_g6_durabilidad_worker_restart.py` resolvía `.env.e2e` hardcodeado relativo a
su propia ubicación -- cada worktree de deploy aislado (p.ej. `wt-deploy`) necesitaba una copia
propia del archivo gitignoreado. Se parametrizó vía `UC_ENV_E2E_PATH` (default sin cambios) para
poder apuntar al `.env.e2e` del checkout ya existente sin duplicarlo. Control positivo: el override
realmente cambia la ruta resuelta; sin la env var, el default no se mueve.

El script vive fuera del árbol de import de pytest (mismo motivo que
`test_instrumento_durabilidad_literal_sincronizado.py`): se ejercita vía subprocess, no import
directo, para no correr su código de nivel de módulo dentro del proceso de test.
"""
from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

_REPO_ROOT = Path(__file__).resolve().parents[3]
_SCRIPT = _REPO_ROOT / "scripts" / "e2e_g6_durabilidad_worker_restart.py"

_SNIPPET = (
    "import importlib.util, sys\n"
    "spec = importlib.util.spec_from_file_location('e2e_g6', sys.argv[1])\n"
    "mod = importlib.util.module_from_spec(spec)\n"
    "spec.loader.exec_module(mod)\n"
    "print(mod.ENV_E2E)\n"
)


def _resolver_env_e2e(*, override: str | None) -> str:
    env = os.environ.copy()
    if override is None:
        env.pop("UC_ENV_E2E_PATH", None)
    else:
        env["UC_ENV_E2E_PATH"] = override
    r = subprocess.run(
        [sys.executable, "-c", _SNIPPET, str(_SCRIPT)],
        capture_output=True, text=True, timeout=15, env=env,
    )
    assert r.returncode == 0, f"stderr: {r.stderr}"
    return r.stdout.strip()


def test_con_uc_env_e2e_path_el_override_gana():
    resuelto = _resolver_env_e2e(override="C:/algun/lado/otro.env")
    assert resuelto == str(Path("C:/algun/lado/otro.env"))


def test_sin_uc_env_e2e_path_el_default_no_cambia():
    resuelto = _resolver_env_e2e(override=None)
    assert resuelto == str(_REPO_ROOT / ".env.e2e")
