#!/usr/bin/env python3
"""Dry-run del reconcile: enumera QUE borraria el sync, sin borrar nada.

Por que existe (evidencia, 2026-07-31): el reconcile aborto con "el diff borraria 221
objetos (tope absoluto 200)" y el CLI del bridge solo ofrece `--force`. Eso deja dos
salidas y las dos son malas: **borrar a ciegas** 221 objetos sin saber cuales, o **no
limpiar nunca** — y como el `pre-push` es fail-closed sobre el sync, no limpiar
significa que NINGUN push entra. El guard estaba bien; lo que faltaba era poder mirar.

Reproduce exactamente el mismo diff que aplica el sync (`present - expected`,
`bridge/reconciler/differ.py:77`) reusando `expected_uuids` del propio bridge — no
reimplementa la identidad, que es justo el error que `differ.py:4-6` advierte que
vaciaria el grafo. En vez de aplicarlo lo IMPRIME con nombre, tipo y `source_file`.

Como se lee el resultado:
  - ZOMBIES   = en el grafo pero ya no en el codigo. Huerfanos: nodos de funciones
                borradas, o aristas que apuntan a un nodo que cambio de identidad.
  - FALTANTES = el codigo los tiene y el grafo no. **Esto si es grave**: significa que
                la ingesta no completo. Un sync sano deja FALTANTES en 0. Desde 2026-10-14 se
                imprimen con tipo y nombre (antes salian como uuid5 opacos, que es justo lo
                que hacia falta para resolverlos). Ver `expected_index`.

Antes de correr `sync --force`, correr esto y mirar la lista. Si los zombies son de
archivos que efectivamente cambiaron/se borraron, el --force es seguro.

Uso (desde el directorio del bridge, con su venv — mismo patron que
`scripts/graphity_positive_control.py`):
    uv run python <ruta-a-este-archivo> --config config/repos.toml \
        --repo copiloto-emprendedor [--volcar zombies.json]

Exit codes:
    0 — el diff se computo (haya o no zombies).
    2 — `expected` vino VACIO: el instrumento no midio nada y cualquier conteo que
        reporte seria falso. Ver el control positivo horneado abajo.
    3 — el indice de descripciones divergio de `expected_uuids`: ver `expected_index`.
"""
from __future__ import annotations

import argparse
import json
import sys
from collections import Counter
from pathlib import Path
from typing import Any

from bridge.client.graphity import GraphityClient
from bridge.config import load_repos, select_repos
from bridge.enrich import build_enriched_graph
from bridge.reader.graph_json import read_code_graph
from bridge.reconciler.differ import expected_uuids
from bridge.identity import edge_uuid, external_id, node_uuid
from bridge.partition.partitioner import DEFAULT_EXCLUDED, partition_edges

for _s in (sys.stdout, sys.stderr):
    if hasattr(_s, "reconfigure"):
        _s.reconfigure(encoding="utf-8", errors="replace")


def listar_completo(client: GraphityClient, kind: str, group_id: str) -> dict[str, dict[str, Any]]:
    """Como `_list_uuids`, pero conserva el objeto entero (el endpoint ya lo devuelve)."""
    fuera: dict[str, dict[str, Any]] = {}
    campo = "nodes" if kind == "node" else "edges"
    cursor = None
    while True:
        payload: dict[str, Any] = {"limit": 200}
        if cursor:
            payload["uuid_cursor"] = cursor
        r = client._http.post(f"/api/v2/graph/{kind}/graph/{group_id}", json=payload)
        if r.status_code == 404:
            return fuera
        r.raise_for_status()
        body = r.json()
        for item in body.get(campo, []):
            fuera[str(item["uuid"])] = item
        cursor = body.get("next_cursor")
        if not cursor:
            return fuera


def expected_index(graph, types, group_id: str, repo: str,
                   exclude_types=DEFAULT_EXCLUDED) -> dict[str, str]:
    """``{uuid: descripcion}`` de lo que la corrida DEBERIA haber producido.

    Por que existe (2026-10-14): los ZOMBIES se imprimian con tipo, nombre y `source_file` porque
    estan EN Graphity y el endpoint devuelve el objeto entero. Los FALTANTES, por definicion, NO
    estan ahi -- `expected_uuids` solo devuelve un `set` de uuid5-- asi que salian como hashes
    opacos. La asimetria importaba: los faltantes son el UNICO criterio que bloquea el destrabe
    (`destrabar-grafo-force.ps1` aborta si FALTANTES != 0), de modo que cuando el guard disparaba,
    el instrumento no entregaba con que resolverlo. Medido ese dia: 11 faltantes, 11 UUIDs y nada mas.

    NO reimplementa la identidad: importa `node_uuid`/`edge_uuid`/`external_id` y `partition_edges`,
    las MISMAS que usa `differ.py` -- `differ.py:4-6` advierte que reimplementarla vaciaria el grafo.
    Lo que si duplica es el RECORRIDO, y por eso su llamador DEBE comparar las claves contra
    `expected_uuids`: si los dos recorridos divergen alguna vez, el control lo ve y aborta en vez de
    describir mal lo que falta. Ese control es la razon por la que esta duplicacion es segura.
    """
    idx: dict[str, str] = {}

    def _nid(node_id: str) -> str:
        etype = types[node_id]
        return node_uuid(group_id, etype, external_id(repo, node_id, etype))

    for p in partition_edges(graph, types, exclude_types):
        for e in p.edges:
            src, tgt = _nid(e.source), _nid(e.target)
            idx.setdefault(src, f"[{types[e.source]}] {e.source}")
            idx.setdefault(tgt, f"[{types[e.target]}] {e.target}")
            idx.setdefault(edge_uuid(group_id, src, p.relation, tgt),
                           f"[{p.relation}] {e.source} -> {e.target}")
    for nid in graph.nodes:
        if types[nid] not in exclude_types:
            idx.setdefault(_nid(nid), f"[{types[nid]}] {nid}")
    return idx


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--config", type=Path, required=True)
    ap.add_argument("--repo", required=True)
    ap.add_argument("--volcar", type=Path, default=None, help="escribe el detalle completo a un json")
    args = ap.parse_args()

    repo = select_repos(load_repos(args.config), args.repo)[0]
    raw = repo.graphify_workdir / "graph_raw.json"
    clustered = repo.graphify_workdir / "graph_clustered.json"
    graph, types = build_enriched_graph(read_code_graph(raw, clustered), repo)
    expected = expected_uuids(graph, types, repo.group_id, repo.name)
    indice = expected_index(graph, types, repo.group_id, repo.name)
    # CONTROL del indice: `expected_index` DUPLICA el recorrido de `expected_uuids` para poder
    # ponerle nombre a cada uuid. Si los dos recorridos divergieran, describiria MAL lo que falta
    # -- y un instrumento que nombra el objeto equivocado es peor que uno que imprime hashes.
    # Se compara ANTES de llamar a Graphity: falla barato y no deja dudas sobre quien difiere.
    if set(indice) != expected:
        sobran, faltan = len(set(indice) - expected), len(expected - set(indice))
        print()
        print(f"[CONTROL] el indice divergio de expected_uuids "
              f"(+{sobran} / -{faltan}) -> no puedo nombrar los faltantes sin mentir. Abortar.",
              file=sys.stderr)
        return 3

    client = GraphityClient.from_env()
    try:
        nodos = listar_completo(client, "node", repo.group_id)
        aristas = listar_completo(client, "edge", repo.group_id)
    finally:
        client.close()

    present = set(nodos) | set(aristas)
    zombies = present - expected
    faltantes = expected - present

    print(f"expected (graphify) : {len(expected)}")
    print(f"present  (Graphity) : {len(present)}  ({len(nodos)} nodos + {len(aristas)} aristas)")
    print(f"ZOMBIES (a borrar)  : {len(zombies)}")
    print(f"FALTANTES (no subio): {len(faltantes)}")
    # Control positivo: si `expected` viniera vacio, TODO seria zombie y el conteo
    # pareceria informativo igual. Sin esto el instrumento confirma en vez de medir.
    if not expected:
        print("\n[CONTROL] expected VACIO -> el instrumento no midio nada. Abortar.", file=sys.stderr)
        return 2
    print()

    z_nodos = [nodos[u] for u in zombies if u in nodos]
    z_aristas = [aristas[u] for u in zombies if u in aristas]
    print(f"--- desglose: {len(z_nodos)} nodos, {len(z_aristas)} aristas ---\n")

    def etiqueta(n: dict[str, Any]) -> str:
        ls = [x for x in (n.get("labels") or []) if x != "Entity"]
        return ls[0] if ls else "?"

    if z_nodos:
        print("NODOS zombie por tipo:")
        for t, c in Counter(etiqueta(n) for n in z_nodos).most_common():
            print(f"  {t:<18} {c}")
        print("\nNODOS zombie por archivo de origen (top 15):")
        for f, c in Counter((n.get("attributes") or {}).get("source_file", "(sin source_file)")
                            for n in z_nodos).most_common(15):
            print(f"  {c:>4}  {f}")
        print("\nMuestra de 15 nodos zombie:")
        for n in sorted(z_nodos, key=lambda x: str(x.get("name")))[:15]:
            sf = (n.get("attributes") or {}).get("source_file", "")
            print(f"  [{etiqueta(n):<14}] {str(n.get('name'))[:60]:<60} {sf}")

    if z_aristas:
        print("\nARISTAS zombie por relacion:")
        for t, c in Counter(str(e.get("name")) for e in z_aristas).most_common(12):
            print(f"  {t:<18} {c}")
        print("\nMuestra de 10 aristas zombie:")
        for e in z_aristas[:10]:
            print(f"  {str(e.get('name')):<14} {str(e.get('fact'))[:95]}")

    if faltantes:
        # Los faltantes van DESPUES de los zombies a proposito: son los que bloquean el destrabe
        # (`destrabar-grafo-force.ps1` aborta si != 0), asi que cierran la salida y quedan a la vista.
        print()
        print(f"--- FALTANTES: {len(faltantes)} objeto(s) que el codigo tiene y el grafo NO ---")
        for u in sorted(faltantes, key=lambda x: indice.get(x, '')):
            print(f"  {indice.get(u, '(sin descripcion: uuid fuera del indice)')}")
        print()
        print("  por tipo:")
        for t, c in Counter(indice.get(u, '[?]').split(']')[0].lstrip('[')
                            for u in faltantes).most_common():
            print(f"    {t:<18} {c}")

    if args.volcar:
        args.volcar.write_text(json.dumps(
            {"zombies_nodos": z_nodos, "zombies_aristas": z_aristas,
             "faltantes": [{"uuid": u, "descripcion": indice.get(u)}
                           for u in sorted(faltantes, key=lambda x: indice.get(x, ''))[:500]]},
            ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"\ndetalle completo -> {args.volcar}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
