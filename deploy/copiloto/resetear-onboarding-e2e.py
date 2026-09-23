"""Deja `onboarding_completado=false` SOLO al tenant canónico de pruebas (`e2e-device@copiloto.test`),
para repetir la evidencia del onboarding (K-14) sin crear usuarios E2E nuevos (regla dura R-9).

DRY-RUN POR DEFECTO: muestra qué cambiaría. Para aplicar: `--ejecutar`. Idempotente.

    /opt/uc-copiloto-venv/bin/python deploy/copiloto/resetear-onboarding-e2e.py
    /opt/uc-copiloto-venv/bin/python deploy/copiloto/resetear-onboarding-e2e.py --ejecutar

Nunca toca otro tenant: el WHERE es por el email canónico, y se aborta si no resuelve exactamente UNA fila.
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
    _heredar_env_del_proceso(UNIT)
    import psycopg2

    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    conn.autocommit = True
    with conn.cursor() as cur:
        cur.execute("SELECT cliente_id::text, onboarding_completado FROM uc_factory.tenants WHERE email = %s",
                    (EMAIL_CANONICO,))
        filas = cur.fetchall()
        if len(filas) != 1:
            print(f"ABORT: {EMAIL_CANONICO} resuelve {len(filas)} fila(s), esperaba 1")
            return 2
        cid, estado = filas[0]
        print(f"{EMAIL_CANONICO} cliente_id={cid} onboarding_completado={estado}")
        if not ejecutar:
            print("dry-run: no se cambió nada (usar --ejecutar)")
            return 0
        cur.execute("UPDATE uc_factory.tenants SET onboarding_completado = false WHERE cliente_id = %s::uuid",
                    (cid,))
        print(f"OK reseteado ({cur.rowcount} fila)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
