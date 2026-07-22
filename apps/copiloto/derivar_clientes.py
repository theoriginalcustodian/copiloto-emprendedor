"""Backfill de la cartera (contrato clientes §4, hito 2). **Idempotente: corrible N veces.**

Uso (en el VPS, con el env de la base cargado):

    set -a; . /etc/unreal-copilot/fusion-pg.env; set +a
    /opt/uc-copiloto-venv/bin/python derivar_clientes.py            # todos los tenants
    /opt/uc-copiloto-venv/bin/python derivar_clientes.py <cliente_id>

Corre **por tenant**, y no por una consulta global que junte todo: `ClienteStore` fija el
`cliente_id` en el constructor y filtra con él en cada consulta, que es la barrera efectiva de
aislamiento de este repo. Un backfill que hiciera un `UPDATE` global saltearía justamente esa barrera
— y sería el único lugar del sistema que la saltea, escrito una vez y leído nunca.

Al final imprime **los duplicados probables** (§3.4). Ese número es el entregable del hito tanto como
las filas creadas: el contrato dice explícitamente que nadie diseña la fusión antes de conocerlo.
"""
from __future__ import annotations

import os
import sys

from _paths import ensure_paths

ensure_paths()

from cliente_store import ClienteStore  # noqa: E402

SCHEMA = "uc_factory"


def _conn_factory(db_url: str):
    import psycopg2

    def factory():
        conn = psycopg2.connect(db_url)
        conn.autocommit = True
        return conn

    return factory


def tenants_con_historia(conn_factory) -> list[str]:
    """Los tenants que tienen algo de lo que derivar. **Sin filas no se llama al store**: correrlo
    sobre un tenant vacío no rompe nada, pero mete ruido en el parte y hace que «0 creados» aparezca
    cien veces, que es cómo un reporte deja de leerse."""
    with conn_factory() as conn, conn.cursor() as cur:
        cur.execute(f"SELECT cliente_id FROM {SCHEMA}.copiloto_presupuestos "
                    f"UNION SELECT cliente_id FROM {SCHEMA}.afip_comprobantes")
        return [str(r[0]) for r in cur.fetchall()]


def main() -> None:
    factory = _conn_factory(os.environ["DATABASE_URL"])
    pedidos = sys.argv[1:] or tenants_con_historia(factory)
    if not pedidos:
        print("no hay tenants con presupuestos ni comprobantes — nada que derivar")
        return

    total_dups = 0
    for cliente_id in pedidos:
        store = ClienteStore(factory, cliente_id)
        parte = store.derivar_clientes()
        dups = store.duplicados_probables()
        total_dups += len(dups)
        print(f"\n== {cliente_id} ==")
        for k, v in parte.items():
            print(f"   {k:>28}: {v}")
        print(f"   {'duplicados probables':>28}: {len(dups)}")
        for d in dups:
            print(f"        · «{d['nombre_normalizado']}» ×{d['cuantos']}  ids={d['ids']}")

    print(f"\n== duplicados probables en total: {total_dups} ==")
    print("   (§3.4: se REPORTAN, no se fusionan. Fusionar es destructivo y nadie lo diseña antes "
          "de conocer este número.)")


if __name__ == "__main__":
    main()
