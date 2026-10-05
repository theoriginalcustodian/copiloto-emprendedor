"""Solo lectura: reporta si e2e-device ya tiene fila real en mp_credentials / afip_credentials,
para decidir sin adivinar si sembrar `conexion_caida` / `certificado_por_vencer` pisaria un E2E
que ya depende de datos reales de ese tenant. No imprime DATABASE_URL ni ninguna credencial.
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
        sys.exit(f"{unit} no esta corriendo")
    with open(f"/proc/{pid}/environ", "rb") as fh:
        for entrada in fh.read().split(b"\x00"):
            if b"=" in entrada:
                clave, valor = entrada.decode("utf-8", "replace").split("=", 1)
                os.environ.setdefault(clave, valor)


def main() -> int:
    _heredar_env_del_proceso(UNIT)
    import psycopg2

    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    conn.autocommit = True
    with conn.cursor() as cur:
        cur.execute("SELECT cliente_id::text FROM uc_factory.tenants WHERE email = %s", (EMAIL_CANONICO,))
        filas = cur.fetchall()
        if len(filas) != 1:
            print(f"ABORT: {EMAIL_CANONICO} resuelve {len(filas)} fila(s), esperaba 1")
            return 2
        cid = filas[0][0]
        print(f"cliente_id resuelto (no se imprime, solo confirmado 1 fila)")

        cur.execute("SELECT count(*) FROM uc_factory.mp_credentials WHERE cliente_id = %s::uuid", (cid,))
        n_mp = cur.fetchone()[0]
        print(f"mp_credentials filas para el tenant: {n_mp}")

        cur.execute("SELECT count(*) FROM uc_factory.afip_credentials WHERE cliente_id = %s::uuid", (cid,))
        n_afip = cur.fetchone()[0]
        print(f"afip_credentials filas para el tenant: {n_afip}")

        cur.execute("SELECT count(*) FROM uc_factory.mi_dia_tarjetas WHERE cliente_id = %s::uuid AND estado <> 'hecha'",
                    (cid,))
        n_midia = cur.fetchone()[0]
        print(f"mi_dia_tarjetas activas hoy: {n_midia}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
