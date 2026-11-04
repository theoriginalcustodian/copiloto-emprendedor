#!/usr/bin/env python3
"""Cuenta los `skipped` de la suite backend y los compara contra una LÍNEA BASE declarada (SM-N58).

Por qué existe: un `skipped` dentro de un verde se lee como cobertura. Ya costó dos veces:
  - SM-I7: el único test que cruzaba catálogo↔íconos daba `1 skipped` justo donde corre el gate, y
    la costura se afirmaba «cubierta» (medido 2026-11-04).
  - el conteo de skips de la suite salió 27 cuando eran 41 porque el runner se leía con `tail -30`:
    el instrumento recortó la evidencia y el recorte no avisó.
Con este script el conteo sale SIEMPRE al final, con el delta contra la línea base, y un skip que no
está declarado hace fallar el job: deja de depender de que alguien lo busque.

Entrada: el `--junitxml` de pytest (no el texto de `-rs`: el texto trae `path:línea`, que se corre con
cualquier edición y volvería la línea base inestable; el junit da el nodeid).

Línea base: un nodeid por línea, `#` empieza comentario. Es la UNIÓN de los entornos donde corre la
suite (gate del VPS y GitHub Actions): un skip declarado que en un entorno no ocurre no es error
(se reporta como «no ocurrió», que suele ser buena noticia); uno que ocurre y no está declarado sí.

Salida: exit 0 si no hay skips nuevos, 1 si los hay, 2 si la entrada no se puede leer (fail-closed:
un junit ilegible NO es «cero skips»).
"""
from __future__ import annotations

import argparse
import sys
import xml.etree.ElementTree as ET
from pathlib import Path


def leer_skips(junit: Path) -> tuple[dict[str, str], int, int]:
    """Devuelve ({nodeid: motivo}, total_de_testcases, xfails). Lanza si el XML no se puede leer."""
    raiz = ET.parse(junit).getroot()
    skips: dict[str, str] = {}
    total = xfails = 0
    for tc in raiz.iter("testcase"):
        total += 1
        sk = tc.find("skipped")
        if sk is None:
            continue
        if (sk.get("type") or "") == "pytest.xfail":
            xfails += 1  # un xfail es otra clase: se espera que falle, no se dejó de correr
            continue
        nodeid = f"{tc.get('classname', '')}::{tc.get('name', '')}"
        motivo = " ".join((sk.get("message") or "").split())
        skips[nodeid] = motivo
    return skips, total, xfails


def leer_linea_base(path: Path) -> set[str]:
    declarados: set[str] = set()
    for linea in path.read_text(encoding="utf-8").splitlines():
        nodeid = linea.split("#", 1)[0].strip()
        if nodeid:
            declarados.add(nodeid)
    return declarados


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("junit", type=Path)
    ap.add_argument("linea_base", type=Path)
    ap.add_argument("--solo-informar", action="store_true",
                    help="imprime el conteo pero no falla por skips nuevos (corrida sin Postgres)")
    a = ap.parse_args(argv)

    try:
        skips, total, xfails = leer_skips(a.junit)
        declarados = leer_linea_base(a.linea_base)
    except (OSError, ET.ParseError) as e:
        print(f"==> ❌ SKIPS: no pude leer la entrada ({e}). Un conteo ilegible NO es cero.", file=sys.stderr)
        return 2
    if total == 0:
        print("==> ❌ SKIPS: el junit no trae ningún testcase. Cero tests no es «cero skips».", file=sys.stderr)
        return 2

    nuevos = sorted(set(skips) - declarados)
    no_ocurrieron = sorted(declarados - set(skips))

    print(f"==> SKIPS: {len(skips)} saltados de {total} (línea base declarada: {len(declarados)} · "
          f"NUEVOS: {len(nuevos)} · declarados que no ocurrieron: {len(no_ocurrieron)} · xfail: {xfails})")
    for n in nuevos:
        print(f"    + NUEVO  {n}  — {skips[n]}")
    if not nuevos:
        return 0
    if a.solo_informar:
        print("==> ⚠️  skips NUEVOS, pero la corrida es sin Postgres (--solo-informar): no se evalúa")
        return 0
    print(f"==> ❌ {len(nuevos)} skip(s) que NO están en {a.linea_base.name}. Un skip no declarado se lee "
          "como cobertura. O hacelo correr, o declaralo en la línea base con su motivo y la pregunta "
          "que queda sin responder (ver el inventario de SM-N58).", file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())
