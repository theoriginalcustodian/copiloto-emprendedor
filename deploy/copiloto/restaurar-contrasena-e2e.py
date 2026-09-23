"""Restaura la contraseña canónica de `e2e-device@copiloto.test` tras probar «Cambiar contraseña» (K-12).

La contraseña canónica entra por STDIN (nunca por argv ni por archivo del repo: quedaría en el historial
del shell / en `ps`). DRY-RUN POR DEFECTO: sólo verifica si el login con la canónica funciona y lo informa.
Con `--ejecutar`, si NO funciona, la restablece con la API admin (`PUT /auth/v1/admin/users/{id}`).
Idempotente: si ya es la canónica, no toca nada. Nunca opera sobre otro usuario.

    printf '%s' "$E2E_DEVICE_PASSWORD" | /opt/uc-copiloto-venv/bin/python deploy/copiloto/restaurar-contrasena-e2e.py
    printf '%s' "$E2E_DEVICE_PASSWORD" | /opt/uc-copiloto-venv/bin/python deploy/copiloto/restaurar-contrasena-e2e.py --ejecutar
"""
from __future__ import annotations

import os
import subprocess
import sys

EMAIL_CANONICO = "e2e-device@copiloto.test"
UNIT = "uc-copiloto-web.service"


def _heredar_env_del_proceso(unit: str) -> None:
    pid = subprocess.check_output(["systemctl", "show", unit, "-p", "MainPID", "--value"]).decode().strip()
    if not pid or pid == "0":
        sys.exit(f"{unit} no está corriendo")
    with open(f"/proc/{pid}/environ", "rb") as fh:
        for entrada in fh.read().split(b"\x00"):
            if b"=" in entrada:
                clave, valor = entrada.decode("utf-8", "replace").split("=", 1)
                os.environ.setdefault(clave, valor)


def main() -> int:
    ejecutar = "--ejecutar" in sys.argv
    canonica = sys.stdin.read().strip()
    if not canonica:
        print("ABORT: la contraseña canónica tiene que venir por stdin")
        return 2
    _heredar_env_del_proceso(UNIT)
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "apps", "copiloto"))
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "motor"))
    from onboarding import GoTrueAdmin, InvalidCredentials

    gotrue = GoTrueAdmin.from_env()
    try:
        gotrue.password_grant(EMAIL_CANONICO, canonica)
        print(f"OK {EMAIL_CANONICO}: el login con la canónica ya funciona — nada que restaurar")
        return 0
    except InvalidCredentials:
        print(f"{EMAIL_CANONICO}: el login con la canónica FALLA (la contraseña fue cambiada)")
    usuario = gotrue.find_user_by_email(EMAIL_CANONICO)
    if usuario is None:
        print(f"ABORT: {EMAIL_CANONICO} no existe en GoTrue")
        return 2
    if not ejecutar:
        print("dry-run: no se cambió nada (usar --ejecutar para restablecerla)")
        return 0
    resp = gotrue._client.put(f"{gotrue._base_url}/auth/v1/admin/users/{usuario['id']}",
                              headers=gotrue._headers(), json={"password": canonica})
    resp.raise_for_status()
    gotrue.password_grant(EMAIL_CANONICO, canonica)      # verificación posterior: el arreglo tiene que andar
    print(f"OK {EMAIL_CANONICO}: contraseña restaurada y verificada con login")
    return 0


if __name__ == "__main__":
    sys.exit(main())
