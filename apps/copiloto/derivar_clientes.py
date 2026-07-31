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
from contexto_tenant import conexion_con_tenant, tenant  # noqa: E402

SCHEMA = "uc_factory"


def _conn_crudo(db_url: str):
    import psycopg2

    def factory():
        conn = psycopg2.connect(db_url)
        conn.autocommit = True
        return conn

    return factory


def tenants_con_historia(conn_crudo, conn_factory) -> list[str]:
    """Los tenants que tienen algo de lo que derivar. **Sin filas no se llama al store**: correrlo
    sobre un tenant vacío no rompe nada, pero mete ruido en el parte y hace que «0 creados» aparezca
    cien veces, que es cómo un reporte deja de leerse.

    ⚠️ Antes esto era **una sola consulta global** (`SELECT cliente_id FROM presupuestos UNION ...`)
    sin declarar tenant. Con `FORCE ROW LEVEL SECURITY` eso devuelve **cero filas** y el script
    imprime *"no hay tenants con presupuestos ni comprobantes"* y **sale con éxito**: un vacío que no
    protesta y que se lee como "no había nada que hacer". Ahora se enumeran los tenants desde
    `uc_factory.tenants` —la única tabla que se consulta antes de saber de quién es la operación, y
    por eso la única sin `FORCE`— y se pregunta **por cada uno, con su tenant declarado**.
    """
    with conn_crudo() as conn, conn.cursor() as cur:
        cur.execute(f"SELECT cliente_id::text FROM {SCHEMA}.tenants")
        candidatos = [r[0] for r in cur.fetchall()]

    con_historia = []
    for cliente_id in candidatos:
        with tenant(cliente_id):
            conn = conn_factory()
            with conn.cursor() as cur:
                cur.execute(
                    f"SELECT EXISTS (SELECT 1 FROM {SCHEMA}.copiloto_presupuestos) "
                    f"    OR EXISTS (SELECT 1 FROM {SCHEMA}.afip_comprobantes)")
                if cur.fetchone()[0]:
                    con_historia.append(cliente_id)
            conn.close()
    return con_historia


def main() -> None:
    # Dos fábricas y la diferencia importa: la CRUDA sólo se usa para enumerar `tenants` (la tabla
    # exenta de FORCE, ver `tenants_con_historia`); todo lo demás pasa por la envuelta, que declara el
    # tenant a la conexión igual que el borde HTTP y la costura de activities.
    crudo = _conn_crudo(os.environ["DATABASE_URL"])
    factory = conexion_con_tenant(crudo)
    pedidos = sys.argv[1:] or tenants_con_historia(crudo, factory)
    if not pedidos:
        print("no hay tenants con presupuestos ni comprobantes — nada que derivar")
        return

    total_dups = 0
    for cliente_id in pedidos:
        # El scope declara de quién es la operación ANTES de que el store abra su conexión — el mismo
        # contrato que `require_tenant` en HTTP. Sin esto, con `FORCE` el store no ve ni escribe nada.
        with tenant(cliente_id):
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
