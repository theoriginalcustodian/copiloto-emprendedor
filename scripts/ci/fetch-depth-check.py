#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""fetch-depth-check.py — un job que NECESITA HISTORIA no puede correr sobre un clon superficial.

🔴 POR QUÉ EXISTE (medido el 2026-10-05). `scripts/ci/nativo-freeze.sh` es el guard del
congelamiento nativo: bloquea un PR que toque `apps/mobile/package.json` o `app.json` sin
`NATIVO-APROBADO`. Para saber si esos archivos cambiaron necesita `git merge-base HEAD origin/main`.
El `checkout@v4` del job `mobile` NO declaraba `fetch-depth: 0`, y el default es un clon de
profundidad 1: `origin/main` no existe, el `merge-base` falla, y el guard sale por su rama de
fail-open —`⚠️ sin merge-base … guard NO evaluado`, `exit 0`— **en todas y cada una de las
corridas**. O sea: un guard cableado, con mensaje prolijo, que **nunca bloqueó nada**. Su excepción
documentada era su único camino.

Lo que lo hace invisible es que el fail-open es *correcto como diseño* (avisa y no bloquea) y
*catastrófico como estado permanente*: nadie audita un warning que sale siempre, y el job queda
VERDE. Es [[instrumento-que-no-mira-nunca-falla]] con la vuelta de tuerca de que el instrumento
**dice** que no mira, en una línea que se pierde entre los `npm warn deprecated`.

QUÉ VERIFICA: para cada job de un workflow, si la cadena de scripts que ejecuta menciona
`merge-base` u `origin/main`, ese job declara `fetch-depth: 0`. No valida más que eso: es el
invariante que faltaba, no un linter de YAML.

FAIL-CLOSED en sus propios límites — si no puede medir, sale 2 («no pude medir») en vez de dar un OK
tranquilizador:
  · el parseo es por regex (no hay `yaml` en la stdlib). Si un job declara MÁS DE UN `checkout`, la
    búsqueda de `fetch-depth` en el bloque del job dejaría de ser concluyente -> exit 2. Medido hoy:
    6 jobs, 6 checkouts, uno por job.
  · si no encuentra ningún job, o el archivo no existe -> exit 2.

USO
  python3 scripts/ci/fetch-depth-check.py                      # el workflow del repo
  python3 scripts/ci/fetch-depth-check.py --workflow <path>     # otro (para el control positivo)
"""
import argparse
import pathlib
import re
import sys

RX_JOB = re.compile(r"^  ([a-z][a-z0-9_-]*):\s*$")
RX_SCRIPT = re.compile(r"scripts/[A-Za-z0-9_./-]+\.(?:sh|py)")
NECESITA_HISTORIA = re.compile(r"merge-base|origin/main")


def bloques_de_jobs(texto):
    """{job: texto-del-bloque} — un bloque va desde su cabecera hasta la cabecera siguiente.

    Se recorta a partir de `jobs:` a propósito: las claves de `on:` (`push`, `pull_request`,
    `workflow_dispatch`) viven en la MISMA indentación de 2 espacios, así que sin este corte entran
    al diccionario. No cambiaban el veredicto —tienen 0 checkout y se saltean— pero sí la CIFRA que
    el script reporta: decía «9 jobs» donde hay 6. Un número de más en una línea de OK es la forma
    más barata de que una medición pierda crédito.
    """
    lineas = texto.split("\n")
    corte = next((i for i, l in enumerate(lineas) if l.rstrip() == "jobs:"), None)
    if corte is not None:
        lineas = lineas[corte + 1:]
    inicios = [(i, m.group(1)) for i, l in enumerate(lineas) for m in [RX_JOB.match(l)] if m]
    out = {}
    for k, (i, nombre) in enumerate(inicios):
        fin = inicios[k + 1][0] if k + 1 < len(inicios) else len(lineas)
        out[nombre] = "\n".join(lineas[i:fin])
    return out


def scripts_del_job(bloque, root, niveles=2):
    """Los scripts que el job corre, más los que ésos mencionan (2 niveles).

    Un glob (`scripts/tests/test-*.sh`) no resuelve a un archivo y se ignora a propósito: el job que
    lo usa (lint) ya declara fetch-depth 0, y expandirlo acá volvería el chequeo dependiente del
    contenido de un directorio entero.
    """
    vistos, pendientes = set(), set(RX_SCRIPT.findall(bloque))
    for _ in range(niveles):
        nuevos = set()
        for rel in pendientes - vistos:
            vistos.add(rel)
            p = root / rel
            if p.is_file():
                nuevos |= set(RX_SCRIPT.findall(p.read_text(encoding="utf-8", errors="replace")))
        pendientes |= nuevos
    return {root / r for r in vistos if (root / r).is_file()}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--workflow", default=None)
    ap.add_argument("--root", default=None)
    a = ap.parse_args()
    root = pathlib.Path(a.root) if a.root else pathlib.Path(__file__).resolve().parents[2]
    wf = pathlib.Path(a.workflow) if a.workflow else root / ".github/workflows/tests.yml"

    if not wf.is_file():
        print("fetch-depth-check: ⚠️ no existe %s — NO PUDE MEDIR" % wf, file=sys.stderr)
        return 2

    texto = wf.read_text(encoding="utf-8", errors="replace")
    jobs = bloques_de_jobs(texto)
    if not jobs:
        print("fetch-depth-check: ⚠️ 0 jobs parseados en %s — NO PUDE MEDIR" % wf.name,
              file=sys.stderr)
        return 2

    faltan, examinados = [], 0
    for nombre, bloque in sorted(jobs.items()):
        n_checkout = len(re.findall(r"uses:\s*actions/checkout@", bloque))
        if n_checkout > 1:
            print("fetch-depth-check: ⚠️ el job '%s' declara %d checkout — el chequeo por bloque "
                  "deja de ser concluyente. NO PUDE MEDIR." % (nombre, n_checkout), file=sys.stderr)
            return 2
        if n_checkout == 0:
            continue
        culpables = sorted(p for p in scripts_del_job(bloque, root)
                           if NECESITA_HISTORIA.search(p.read_text(encoding="utf-8",
                                                                   errors="replace")))
        if not culpables:
            continue
        examinados += 1
        if not re.search(r"fetch-depth:\s*0", bloque):
            faltan.append((nombre, [str(p.relative_to(root)).replace("\\", "/")
                                    for p in culpables]))

    if faltan:
        print("fetch-depth-check: ❌ job(s) que necesitan historia sobre un clon SUPERFICIAL "
              "(default depth 1) — sus guards no evalúan y el job queda VERDE:", file=sys.stderr)
        for nombre, culpables in faltan:
            print("   - %s: %s" % (nombre, ", ".join(culpables)), file=sys.stderr)
        print("   Arreglo: `fetch-depth: 0` en el `actions/checkout` de ese job.", file=sys.stderr)
        return 1

    print("fetch-depth-check: ok (%d job(s) necesitan historia y los %d declaran fetch-depth: 0; "
          "%d jobs en total)" % (examinados, examinados, len(jobs)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
