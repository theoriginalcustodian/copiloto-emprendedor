#!/usr/bin/env python3
"""Control positivo del sync del grafo — confirma que el sync REALMENTE llegó.

Por qué existe (evidencia, 2026-07-24): una sincronización reportó ``exit 0`` con
``GraphityError: timeout`` adentro (``tasks/b12f3vc5e.output``) — graphify había corrido
bien LOCAL (extrajo el grafo a ``graph_raw.json``/``graph_clustered.json``), pero la
ingesta remota a Graphity nunca terminó. El síntoma vigente: el grafo de
copiloto-emprendedor no tiene el hito 9. Un ``exit 0`` verde no medía el sync — medía
el proceso equivocado (ver ``scripts/graph-sync.sh``, que ya blinda el status real y el
grep de errores). Ninguna de esas dos defensas prueba que el dato haya ATERRIZADO en
Graphity: solo una consulta contra el servidor lo prueba. Eso es lo que hace este script.

Mecanismo: toma los archivos cambiados en el rango ``--since``, cruza contra los nodos
que graphify extrajo en la ÚLTIMA corrida (``graph_raw.json``/``graph_clustered.json``
del ``graphify_workdir`` del repo — ya regenerados por el sync que acaba de correr),
elige uno determinísticamente, recalcula su UUID con la MISMA identidad que usa el
server (``bridge.identity``, réplica exacta — ver ese módulo) y le pregunta a Graphity
si ese nodo existe. No asume nada sobre el símbolo: lo lee del propio output de graphify,
no reimplementa su convención de nombres.

Uso (desde el venv del bridge — normalmente invocado por scripts/graph-sync.sh):
    cd <bridge> && uv run python <ruta-a-este-archivo> \
        --config config/repos.toml --repo copiloto-emprendedor --since <ref-git>

Exit codes:
    0 — el símbolo elegido existe en Graphity (control positivo PASA).
    1 — el símbolo NO existe — sync silenciosamente incompleto. Fallar ruidoso.
    2 — no hay ningún símbolo verificable en este rango (ningún archivo cambiado cae
        dentro de los source_dirs que graphify indexa, o falta el graph.json). No es
        un fallo del sync — es un rango sin nada que este control pueda mirar. El
        caller NO debe tratar 2 como éxito silencioso ni como fallo duro.
"""

from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

from bridge.client.graphity import GraphityClient, GraphityError
from bridge.config import load_repos, select_repos
from bridge.enrich import build_enriched_graph
from bridge.identity import EXTERNAL_SYMBOL, external_id, node_uuid
from bridge.reader.graph_json import read_code_graph

# Windows: cuando stdout/stderr no cuelgan de una consola real (pipe anidado, como
# cuando scripts/graph-sync.sh nos invoca desde un subshell), Python resuelve el
# encoding al codepage ANSI (cp1252) en vez de UTF-8 — cualquier emoji en un print()
# revienta con UnicodeEncodeError DESPUÉS de que el control ya se calculó, disfrazando
# un PASS real de un traceback. reconfigure() es no-op en plataformas donde ya es UTF-8.
for _stream in (sys.stdout, sys.stderr):
    if hasattr(_stream, "reconfigure"):
        _stream.reconfigure(encoding="utf-8", errors="replace")


def _changed_files(repo_path: Path, since_ref: str) -> set[str]:
    """Réplica de ``bridge.orchestrator.incremental.changed_files`` (mismo comando)."""
    out = subprocess.run(
        ["git", "-C", str(repo_path), "diff", "--name-only", f"{since_ref}..HEAD"],
        capture_output=True,
        text=True,
        check=True,
    )
    return {line.strip() for line in out.stdout.splitlines() if line.strip()}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config", type=Path, required=True)
    parser.add_argument("--repo", required=True)
    parser.add_argument(
        "--since",
        default=None,
        help="ref git — verificar sólo los símbolos de ese rango. Sin él (sync COMPLETO) se verifica "
             "un nodo cualquiera del grafo recién construido.",
    )
    args = parser.parse_args(argv)

    repos = select_repos(load_repos(args.config), args.repo)
    if len(repos) != 1:
        print(
            f"[positive-control] ❌ --repo debe resolver a exactamente 1 repo, resolvió a {len(repos)}",
            file=sys.stderr,
        )
        return 2
    repo = repos[0]

    raw = repo.graphify_workdir / "graph_raw.json"
    clustered = repo.graphify_workdir / "graph_clustered.json"
    if not raw.exists() or not clustered.exists():
        print(
            f"[positive-control] ❌ no encuentro {raw} / {clustered} — ¿corrió graphify recién?",
            file=sys.stderr,
        )
        return 2

    graph, types = build_enriched_graph(read_code_graph(raw, clustered), repo)

    # Sin --since el sync fue COMPLETO: no hay "rango" que mirar y filtrar por el último commit
    # dejaría el control sin nada que verificar casi siempre — que es como un control positivo se
    # vuelve decorativo: no falla nunca porque nunca mira. En ese caso se verifica un nodo
    # cualquiera del grafo recién construido, elegido determinísticamente.
    if args.since is None:
        candidates = sorted(
            (node_id, node.source_file)
            for node_id, node in graph.nodes.items()
            if types.get(node_id) not in (None, EXTERNAL_SYMBOL)
        )
        if not candidates:
            print(
                "[positive-control] ❌ graphify no extrajo NINGÚN nodo verificable — el sync no puede "
                "haber subido nada. Esto sí es un fallo.",
                file=sys.stderr,
            )
            return 1
    else:
        try:
            changed = _changed_files(repo.path, args.since)
        except subprocess.CalledProcessError as exc:
            print(f"[positive-control] ❌ 'git diff {args.since}..HEAD' falló: {exc.stderr}", file=sys.stderr)
            return 2

        candidates = sorted(
            (node_id, node.source_file)
            for node_id, node in graph.nodes.items()
            if node.source_file in changed and types.get(node_id) not in (None, EXTERNAL_SYMBOL)
        )
        if not candidates:
            print(
                f"[positive-control] ⚠️  ningún nodo de graphify cae en los {len(changed)} archivo(s) "
                f"cambiados desde {args.since} (source_dirs de {repo.name}: {list(repo.source_dirs)}) — "
                "nada verificable en este rango. No es un fallo del sync."
            )
            return 2

    node_id, source_file = candidates[0]
    entity_type = types[node_id]
    key = external_id(repo.name, node_id, entity_type)
    uuid = node_uuid(repo.group_id, entity_type, key)

    client = GraphityClient.from_env()
    try:
        found = client.node_exists(uuid)
    except GraphityError as exc:
        print(f"[positive-control] ❌ error consultando Graphity: {exc}", file=sys.stderr)
        return 1
    finally:
        client.close()

    if found:
        print(f"[positive-control] ✅ '{node_id}' ({source_file}) está en Graphity — uuid {uuid}")
        return 0

    print(
        f"[positive-control] ❌ '{node_id}' ({source_file}) NO está en Graphity (uuid {uuid}) — "
        "el sync reportó éxito pero el dato no llegó. Grafo desactualizado.",
        file=sys.stderr,
    )
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
