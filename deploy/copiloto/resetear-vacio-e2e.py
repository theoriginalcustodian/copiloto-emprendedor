"""Devuelve al tenant de prueba `e2e-vacio@copiloto.test` a CERO filas de datos de negocio.

Por qué existe: `e2e-vacio` es el ÚNICO instrumento para medir el estado VACÍO (cero filas no es «pocas
filas»: tiene su propio texto y layout). Sembrar una fila tiene endpoint (`POST /gastos`) y retirarla no,
así que cualquier medición de «pocas filas» lo dejaba inutilizado (2026-11-03: gasto 253).

DRY-RUN POR DEFECTO: cuenta las filas por tabla y no cambia nada. Para aplicar: `--ejecutar`. Idempotente.

    /opt/uc-copiloto-venv/bin/python deploy/copiloto/resetear-vacio-e2e.py
    /opt/uc-copiloto-venv/bin/python deploy/copiloto/resetear-vacio-e2e.py --ejecutar

Guardas, todas fail-closed:
- El tenant se resuelve por el email canónico y se aborta si no resuelve exactamente UNA fila.
- Cada DELETE lleva `WHERE cliente_id = <ese tenant>` y corre bajo el claim RLS del mismo tenant: aunque el
  WHERE se perdiera, FORCE RLS no deja ver ni borrar filas de otro.
- Sólo las tablas `copiloto_*` con columna `cliente_id` (datos de negocio). Nunca `tenants` ni las de
  identidad/conexión: el tenant tiene que seguir pudiendo entrar y conservar su perfil.
"""
from __future__ import annotations

import json
import os
import subprocess
import sys

EMAIL_VACIO = "e2e-vacio@copiloto.test"
UNIT = "uc-copiloto-web.service"
SCHEMA = "uc_factory"
# Tablas `copiloto_*` que NO son filas visibles de negocio: estado del tenant, bitácora append-only
# (`eventos`, `metering`) o cursores de ingesta al grafo. El estado VACÍO se mide sobre lo que la UI
# dibuja (gastos, cobros, presupuestos…), y borrar auditoría/consumo falsearía el historial. Medido
# 2026-11-03 sobre e2e-vacio: eventos 12 (cobros ya inexistentes), metering 40, grafo_* 5 → todas fuera.
EXCLUIR = frozenset({"copiloto_web_replies", "copiloto_perfil_negocio", "copiloto_conexiones",
                     "copiloto_eventos", "copiloto_metering",
                     "copiloto_grafo_cursor", "copiloto_grafo_vigencia"})


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
    from psycopg2 import sql

    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    conn.autocommit = False
    with conn.cursor() as cur:
        cur.execute(f"SELECT cliente_id::text FROM {SCHEMA}.tenants WHERE email = %s", (EMAIL_VACIO,))
        filas = cur.fetchall()
        if len(filas) != 1:
            print(f"ABORT: {EMAIL_VACIO} resuelve {len(filas)} fila(s), esperaba 1")
            return 2
        cid = filas[0][0]
        cur.execute("SELECT set_config('request.jwt.claims', %s, false)", (json.dumps({"cliente_id": cid}),))
        cur.execute(
            "SELECT table_name FROM information_schema.columns WHERE table_schema = %s "
            "AND column_name = 'cliente_id' AND table_name LIKE 'copiloto\\_%%' ORDER BY 1", (SCHEMA,))
        tablas = [t for (t,) in cur.fetchall() if t not in EXCLUIR]
        print(f"{EMAIL_VACIO} cliente_id={cid} · {len(tablas)} tablas de negocio")
        total = 0
        for t in tablas:
            ident = sql.Identifier(SCHEMA, t)
            cur.execute(sql.SQL("SELECT count(*) FROM {} WHERE cliente_id = %s::uuid").format(ident), (cid,))
            n = cur.fetchone()[0]
            if n:
                print(f"  {t}: {n}")
            total += n
            if ejecutar and n:
                cur.execute(sql.SQL("DELETE FROM {} WHERE cliente_id = %s::uuid").format(ident), (cid,))
        if not ejecutar:
            conn.rollback()
            print(f"dry-run: {total} fila(s) a borrar, no se cambió nada (usar --ejecutar)")
            return 0
        conn.commit()
        print(f"OK borradas {total} fila(s). Idempotente: una 2ª corrida da 0.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
