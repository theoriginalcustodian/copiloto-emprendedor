#!/usr/bin/env python3
"""Cuenta presupuestos DUPLICADOS en prod, CON claims por tenant (K-01 / BL-D1, R-8 del plan).

Sólo lectura (no hay nada que `--dry-run`). Con `FORCE ROW LEVEL SECURITY` una consulta sin tenant
declarado devuelve 0 aunque haya datos: un `count` sin claims no es dato (memoria
`afip-vacia-en-prod-era-una-consulta-ciega-por-force-rls`). Por eso itera `uc_factory.tenants` (tabla
exenta), declara cada tenant como lo hace el borde y cuenta ADENTRO.

Duplicado = mismo (concepto, receptor, total, moneda) creado dentro de `--ventana` minutos del
anterior (default 10) y sin `idem_key`: la firma del doble toque / reintento de red. Es una cota
superior — dos presupuestos legítimos idénticos seguidos también cuentan.

Control positivo: si ningún tenant ve NINGÚN presupuesto propio, se grita (el instrumento estaría ciego).

Uso (en el VPS, con los env de prod sourceados):
    /opt/uc-copiloto-venv/bin/python deploy/copiloto/contar_presupuestos_duplicados.py [--ventana 10]
"""
from __future__ import annotations

import argparse
import json
import os
import sys

import psycopg2

# `{filtro}`: antes del deploy de K-01 la columna `idem_key` no existe todavía -> sin filtro.
SQL = """
SELECT count(*) FROM (
  SELECT fecha - lag(fecha) OVER (PARTITION BY concepto, receptor_nombre, total, moneda ORDER BY fecha) AS dt
  FROM uc_factory.copiloto_presupuestos {filtro}
) t WHERE dt IS NOT NULL AND dt < make_interval(mins => %s)
"""

def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--ventana", type=int, default=10, help="minutos entre dos altas iguales")
    args = ap.parse_args()
    conn = psycopg2.connect(os.environ["DATABASE_URL"]); conn.autocommit = True
    cur = conn.cursor()
    cur.execute("SELECT 1 FROM information_schema.columns WHERE table_schema='uc_factory' AND "
                "table_name='copiloto_presupuestos' AND column_name='idem_key'")
    filtro = "WHERE idem_key IS NULL" if cur.fetchone() else ""
    print(f"columna idem_key: {'presente' if filtro else 'AUSENTE (pre-deploy)'}")
    cur.execute("SELECT cliente_id::text FROM uc_factory.tenants")
    tenants = [r[0] for r in cur.fetchall()]
    total_dup = total_filas = ciegos = 0
    for cid in tenants:
        cur.execute("SELECT set_config('request.jwt.claims', %s, false)", (json.dumps({"cliente_id": cid}),))
        cur.execute("SELECT count(*) FROM uc_factory.copiloto_presupuestos")
        filas = cur.fetchone()[0]
        cur.execute(SQL.format(filtro=filtro), (args.ventana,))
        dup = cur.fetchone()[0]
        total_filas += filas; total_dup += dup
        if filas: print(f"tenant {cid[:8]}…  presupuestos={filas}  duplicados_sospechosos={dup}")
        else: ciegos += 1
    print(f"\nTOTAL tenants={len(tenants)} presupuestos={total_filas} duplicados_sospechosos={total_dup} "
          f"(ventana {args.ventana} min)")
    if total_filas == 0:
        print("❌ CONTROL POSITIVO FALLÓ: ningún tenant ve presupuestos propios — la consulta está ciega, "
              "el 0 NO significa 'sin duplicados'.")
        return 2
    return 0

if __name__ == "__main__":
    sys.exit(main())
