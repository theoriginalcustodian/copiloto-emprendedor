"""Verdad de referencia del eval de fidelidad de Inteligencia de Negocio — SOLO LECTURA, en el VPS.

Lee SQL con el claim RLS del tenant (mismas fuentes que las tools: `InteligenciaQueries`,
`ClienteStore`, `copiloto_eventos`) y emite JSON por stdout. El eval puntúa la respuesta del chat con
CÓDIGO contra esto: ningún LLM juzga a otro LLM.

Uso (en el VPS, con el env del worker): python verdad_sql.py <cliente_id> [<tenant_ajeno>...]
"""
from __future__ import annotations

import json
import os
import sys

import psycopg2

from cliente_store import ClienteStore
from contexto_tenant import conexion_con_tenant, tenant
from datos_card import CONSULTAS, datos_de
from inteligencia_queries import InteligenciaQueries


def _crudo():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def _eventos(conn_factory, cid, sql, params=()):
    conn = conn_factory()
    with conn.cursor() as cur:
        cur.execute(sql, (cid, *params))
        return cur.fetchall()


def verdad(cid: str) -> dict:
    with tenant(cid):
        cf = conexion_con_tenant(_crudo)
        q = InteligenciaQueries(cf, cid)
        cards = {c: datos_de(c, q, {}) for c in CONSULTAS}
        store = ClienteStore(cf, cid)
        clientes, _ = store.listar(q="", limit=50)
        resumenes = {}
        for c in clientes[:15]:
            r = store.resumen_operaciones(c["id"])
            if r:
                resumenes[c["nombre"]] = {k: r[k] for k in ("facturado", "facturas", "presupuestos",
                                                           "presupuestado", "facturas_atribuibles")}
        # el ÚLTIMO estado de cada presupuesto y la ÚLTIMA imputación de cada gasto (lo vigente)
        presu = _eventos(cf, cid,
                         "SELECT DISTINCT ON (entidad_id) entidad_id, valor_a FROM "
                         "uc_factory.copiloto_eventos WHERE cliente_id=%s AND entidad_tipo='presupuesto' "
                         "AND campo='estado' ORDER BY entidad_id, id DESC")
        imput = _eventos(cf, cid,
                         "SELECT DISTINCT ON (entidad_id) entidad_id, valor_a FROM "
                         "uc_factory.copiloto_eventos WHERE cliente_id=%s AND entidad_tipo='gasto' "
                         "AND campo='imputacion' ORDER BY entidad_id, id DESC")
    return {"cliente_id": cid, "cards": cards, "clientes": [c["nombre"] for c in clientes],
            "resumenes": resumenes,
            "presupuestos_estado": {str(k): v for k, v in presu},
            "imputaciones": {str(k): v for k, v in imput}}


def nombres_de(cid: str) -> list[str]:
    with tenant(cid):
        clientes, _ = ClienteStore(conexion_con_tenant(_crudo), cid).listar(q="", limit=50)
    return [c["nombre"] for c in clientes]


if __name__ == "__main__":
    propio, ajenos = sys.argv[1], sys.argv[2:]
    salida = verdad(propio)
    mios = {n.lower() for n in salida["clientes"]}
    salida["clientes_ajenos"] = sorted({n for a in ajenos for n in nombres_de(a)
                                        if n.lower() not in mios})
    print(json.dumps(salida, ensure_ascii=False, default=str))
