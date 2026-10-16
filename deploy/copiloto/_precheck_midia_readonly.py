"""Solo lectura: reporta si e2e-device ya tiene fila real en mp_credentials / afip_credentials,
para decidir sin adivinar si sembrar `conexion_caida` / `certificado_por_vencer` pisaria un E2E
que ya depende de datos reales de ese tenant. No imprime DATABASE_URL ni ninguna credencial.
"""
from __future__ import annotations

import json
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

        # DECLARAR EL TENANT, o los tres count de abajo dan 0 aunque las filas existan.
        #
        # Las tablas tienen RLS con la policy `cliente_id = uc_factory.current_cliente_id()`, que lee
        # esta GUC (`deploy/worker/provision_tables.py:49`), y el rol de la `DATABASE_URL` es
        # `uc_factory`, SIN `BYPASSRLS` (medido 2026-10-16). Sin el claim la funcion devuelve NULL,
        # ninguna fila matchea, y el `where cliente_id = %s` de abajo no alcanza: RLS filtra primero.
        #
        # Este archivo vivio asi desde que se escribio, y el falso negativo esta MEDIDO, no deducido:
        # `scripts/diag/estado-tenant-prod.sh --email e2e-device@copiloto.test` devuelve
        # `afip_credentials: 1 (ACTIVAS 1, dev:***112)` declarando el claim, y `0` sin declararlo.
        # O sea que el precheck habria contestado «no hay fila real» justo cuando la hay — y su
        # proposito es decidir si sembrar datos pisaria un E2E que depende de datos reales: el 0
        # falso autoriza exactamente la escritura que el script existe para evitar.
        #
        # `is_local=false` (no `true`) a proposito: con `autocommit = True` un claim local a la
        # transaccion se perderia al cerrar cada statement y el fix no haria nada.
        cur.execute(
            "SELECT set_config('request.jwt.claims', %s, false)",
            (json.dumps({"cliente_id": cid}),),
        )

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
