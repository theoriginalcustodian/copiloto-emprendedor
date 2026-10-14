#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Mide cuantas veces se CITA cada entrada de `memoria/` fuera de si misma.

POR QUE EXISTE
--------------
El indice `memoria/MEMORY.md` tiene DOS techos duros (24.000 bytes y 200 lineas) y su
propio encabezado declara la unica salida cuando se llena: **bajar entradas cerradas a
`HISTORIA.md`** (fusionar no ahorra). Pero «cerrada» no estaba definido por ningun
instrumento, asi que la poda se hacia a dedo — y elegir a dedo cual de 403 entradas
sobra es exactamente el tipo de decision que nadie quiere firmar, por lo que no se hacia
y el indice se llenaba hasta truncarse. Un indice truncado no avisa: su cola simplemente
deja de existir para la sesion, y eso ya fabrico duplicados antes
(`el-indice-truncado-fabrica-duplicados`).

Este script reemplaza el dedo por una medicion: una entrada que **nadie cita nunca** —
ni otra entrada por `[[link]]`, ni un doc, ni un mensaje de commit — es candidata
objetiva a bajar. Mismo razonamiento que ya se midio en el registro del sprint, donde
18 de 26 fichas jamas fueron nombradas en 460 cierres
(`el-registro-no-se-marcaba-porque-su-id-no-circulaba`).

LO QUE MIDIO LA PRIMERA VEZ, Y REFUTA LA HIPOTESIS QUE LO MOTIVO
---------------------------------------------------------------
Corrido el 2026-10-14 sobre 403 entradas: **UNA sola nunca citada**
(`vitest-de-apps-copiloto-web-necesita-su-propio-node_modules-en-un-worktree`). O sea
que la poda por «nadie la cita» **no resuelve el techo del indice**: libera una linea.

Eso NO vuelve inutil al script — vuelve inutil a la hipotesis, que es distinto, y es
informacion que antes no existia. Nadie puede sostener ya que el indice esta lleno de
entradas muertas: no lo esta. El techo se va a tener que resolver bajando entradas de
frentes CERRADOS, que es un criterio de estado y no de uso, y esa decision necesita
saber que frente sigue vivo. Este medidor no la toma.

QUE NO HACE, A PROPOSITO
------------------------
- **No baja nada.** Imprime el ranking y sale 0. Bajar una entrada sigue siendo una
  decision humana; esto le da el dato, no la toma.
- **No confunde «no citada» con «inutil».** Una entrada recien escrita tiene 0 citas por
  construccion, y una norma puede valer aunque nadie la haya nombrado todavia. Por eso el
  reporte separa las recientes y nunca propone bajar algo sin antiguedad.

EL CONTROL POSITIVO NO ES OPCIONAL
----------------------------------
`--control` inyecta un slug inexistente (nadie puede citarlo) y verifica que el medidor
lo reporte con 0 citas, y toma la entrada MAS citada del corpus real para verificar que
la cuenta no sea 0 para todos. Sin las dos mitades, un medidor que devuelve «0 citas
para todo» es indistinguible de uno que no esta mirando nada
(`el-control-positivo-cubre-la-mitad-que-sospechas-y-la-otra-queda-muda`).
"""
import argparse
import io
import os
import re
import subprocess
import sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MEM = os.path.join(RAIZ, "memoria")
INDICE = os.path.join(MEM, "MEMORY.md")
HISTORIA = os.path.join(MEM, "HISTORIA.md")


def entradas():
    """Los topic files: todo .md de memoria/ que no sea el indice ni la historia."""
    fuera = {"MEMORY.md", "HISTORIA.md"}
    return sorted(f for f in os.listdir(MEM) if f.endswith(".md") and f not in fuera)


def corpus():
    """Texto donde una entrada PUEDE ser citada, con su propio archivo excluido despues.

    Tres fuentes, porque una entrada se cita de tres maneras distintas y mirar una sola
    subestima: `[[link]]` entre entradas, el nombre del archivo en un doc, y el slug en
    un mensaje de commit. El historial entra como UN solo `git log` y no como N greps:
    403 entradas x un proceso cada una es lo que convierte un chequeo en algo que nadie
    corre.
    """
    # El indice y la historia NO entran: citan a TODAS las entradas por construccion, asi
    # que aportan un piso constante que no es uso. Medido 2026-10-14: incluyendolos, el
    # minimo del corpus era 3 y «nunca citadas» daba 0 para las 403 — un medidor que no
    # puede devolver cero no esta midiendo, esta sumando su propia estructura.
    piezas = []
    for f in entradas():
        p = os.path.join(MEM, f)
        if os.path.exists(p):
            piezas.append((f, io.open(p, encoding="utf-8", errors="replace").read()))
    docs = subprocess.run(
        ["git", "-C", RAIZ, "grep", "-rhoI", "-e", r"[a-z0-9][a-z0-9-]\{8,\}",
         "--", "docs/", "*.md"],
        capture_output=True, text=True, errors="replace")
    piezas.append(("__docs__", docs.stdout))
    log = subprocess.run(["git", "-C", RAIZ, "log", "--format=%B", "-n", "3000"],
                         capture_output=True, text=True, errors="replace")
    piezas.append(("__commits__", log.stdout))
    return piezas


def contar(solo_slug=None):
    piezas = corpus()
    slugs = [f[:-3] for f in entradas()]
    if solo_slug:
        slugs = slugs + [solo_slug]
    filas = []
    for slug in slugs:
        propio = slug + ".md"
        n = 0
        for nombre, texto in piezas:
            if nombre == propio:
                continue  # una entrada citandose a si misma no es una cita
            n += texto.count(slug)
        filas.append((n, slug))
    filas.sort()
    return filas


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--control", action="store_true",
                    help="control positivo: slug inexistente debe dar 0 y el top debe dar >0")
    ap.add_argument("--top", type=int, default=15, help="cuantas menos citadas listar")
    a = ap.parse_args()

    if a.control:
        canario = "slug-que-no-existe-en-ningun-lado-canario-del-medidor"
        filas = contar(solo_slug=canario)
        d = dict((s, n) for n, s in filas)
        mas = filas[-1]
        print("CONTROL POSITIVO, las dos mitades:")
        print("  canario nunca citado  -> %d citas  (esperado 0)" % d[canario])
        print("  entrada mas citada    -> %d citas  (%s)" % (mas[0], mas[1]))
        ok = d[canario] == 0 and mas[0] > 0
        print("VEREDICTO:", "OK - el medidor distingue" if ok else
              "FALLA - no distingue citado de no citado")
        return 0 if ok else 1

    filas = contar()
    ceros = [s for n, s in filas if n == 0]
    print("entradas medidas: %d" % len(filas))
    print("NUNCA citadas (candidatas objetivas a bajar a HISTORIA.md): %d" % len(ceros))
    for n, s in filas[:a.top]:
        print("  %3d  %s" % (n, s))
    print()
    print("Esto NO baja nada: es el dato para decidir, no la decision.")
    print("Una entrada recien escrita tiene 0 citas por construccion - mira su fecha antes.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
