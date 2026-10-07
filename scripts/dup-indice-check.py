#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Caza la línea de índice DUPLICADA que `medir-indice-memoria.py` no puede ver.

⏸ CONGELADO A PROPÓSITO — no está cableado a ningún gate (ni `gate.sh`, ni `tests.yml`, ni el
   pre-push). Se corre a mano. Cablearlo es la decisión diferida de la fila `DUPINDICE`, por la orden
   `CONGELAINSTR` del operador: un hallazgo de INSTRUMENTO se anota y se difiere, no se arregla en el
   sprint. Está en el repo para que el diseño —que ya está validado en las dos direcciones— no se
   evapore con el scratchpad de la sesión que lo midió.

EL CASO QUE LO MOTIVÓ (2026-10-07, PR #885 → revertido en #889):
   `medir-indice-memoria.py` reportó 5 entradas «sin línea en ningún índice»; se mergeó un PR que les
   agregó línea; las cinco YA tenían una. El PR metió 5 duplicados. Los dos gates existentes dijeron
   que todo estaba bien:
     · los 6 jobs de CI pasaron        -> el diff era válido; la PREMISA era falsa
     · `medir-indice-memoria.py` dijo  -> `[OK] líneas duplicadas exactas: 0`
   Lo segundo es literal: ese chequeo busca líneas **idénticas**, y dos punteros al mismo slug con
   título y emoji distintos no son idénticos. El duplicado real es semántico, no textual.

EL CRITERIO (v2, el que pasa el control de dos lados):
   duplicado = un slug que GANA una referencia NETA en `MEMORY.md` + `HISTORIA.md` entre el commit y
   su base, **y que ya tenía al menos una**.
   · un refuerzo reescribe su línea -> −1 +1 = 0  -> NO dispara
   · una entrada nueva estrena línea -> 0 → 1     -> NO dispara (no tenía ninguna)
   · un 2º puntero a un slug indexado -> 1 → 2    -> DISPARA

   🔴 LA v1 QUE NO SIRVE, escrita acá para que nadie la vuelva a escribir: «¿alguna línea AGREGADA en
   el diff referencia un slug ya indexado?». Pasa el positivo (5/5 en #885) y FALLA el negativo: da
   falsos positivos en PRs de refuerzo legítimos (medido: 2 en 5398515d, 2 en aa555700, 3 en
   c60add70), porque un refuerzo reescribe la línea y el diff la muestra como «+». Un guard que grita
   en el caso NORMAL de este repo —donde los refuerzos son rutina— se desarma solo a la tercera vez.
   -> memoria/el-guard-que-grita-en-el-caso-normal-se-desarma-solo.md

   🔴 Y EL CRITERIO SOBRE EL ESTADO TAMPOCO SIRVE: «mismo destino referenciado dos veces» contado
   sobre el árbol da 20 pares legítimos en `main` ya revertido (puntero en el índice + mención en la
   narrativa de HISTORIA). Arrancaría con 20 rojos el día 1. La señal es el DELTA, nunca el absoluto.

Diseño medido por la sesión de auditoría; verificado de forma independiente antes de portarlo.

Uso:
    python scripts/dup-indice-check.py                 # HEAD vs su merge-base con origin/main
    python scripts/dup-indice-check.py --rev <sha>     # un commit vs su padre
    python scripts/dup-indice-check.py --base <ref>
    python scripts/dup-indice-check.py --autotest      # los 5 controles históricos

Exit: 0 sin duplicados · 1 con duplicados · 2 si no pudo medir (que NO es lo mismo que 0).
"""
import argparse
import re
import subprocess
import sys
from collections import Counter

# cp1252 en Windows: este script imprime `→` y flechas en el veredicto, y sin esto revienta con
# UnicodeEncodeError en el PRIMER print -- antes de decir nada. Peor: el crash sale con exit 1, el
# MISMO código que "encontré un duplicado", así que un rojo del gate sería ambiguo entre hallazgo y
# script roto. Mismo patrón que el hermano `medir-indice-memoria.py`, que ya lo tenía.
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")

# Un destino de índice: link markdown a un .md local, o wikilink. Los dos, porque mirar uno solo da
# falsos: el propio medir-indice-memoria.py pagó eso («reportó 25 huérfanas donde había 24»).
DESTINO = re.compile(r"\]\((?!https?:)([A-Za-z0-9._-]+\.md)\)|\[\[([A-Za-z0-9._-]+)\]\]")
INDICES = ("memoria/MEMORY.md", "memoria/HISTORIA.md")

# Controles históricos. El positivo y CUATRO negativos: sin los negativos esto no es un control,
# es una anécdota que coincide.
CONTROLES = (
    ("87c57cb1", "#885 — los 5 duplicados", 5),
    ("65db604c", "#889 — el revert de #885", 0),
    ("5398515d", "3 clases + 4 refuerzos", 0),
    ("aa555700", "+9 líneas de índice legítimas", 0),
    ("c60add70", "+6 líneas de índice legítimas", 0),
)


def git(*args: str) -> str:
    r = subprocess.run(["git", *args], capture_output=True)
    return r.stdout.decode("utf-8", "replace") if r.returncode == 0 else ""


def referencias(ref: str) -> Counter:
    """Cuántas veces cada slug es referenciado por los DOS índices en ese ref."""
    cuenta: Counter = Counter()
    for path in INDICES:
        for m in DESTINO.finditer(git("show", f"{ref}:{path}")):
            v = m.group(1) or m.group(2)
            cuenta[v[:-3] if v.endswith(".md") else v] += 1
    return cuenta


def duplicados(base: str, rev: str) -> list[str]:
    antes, despues = referencias(base), referencias(rev)
    if not despues:
        return []
    return sorted(k for k, n in despues.items() if n > antes.get(k, 0) and antes.get(k, 0) >= 1)


def autotest() -> int:
    print("Controles históricos — el positivo Y cuatro negativos:")
    ok = True
    for ref, rotulo, esperado in CONTROLES:
        padre = git("rev-parse", f"{ref}^").strip()
        if not padre:
            print(f"   ?? {rotulo:32s} NO MEDIDO — {ref} no está en este clon")
            return 2
        hallados = duplicados(padre, ref)
        bien = len(hallados) == esperado
        ok = ok and bien
        print(f"   {'OK ' if bien else 'MAL'} {rotulo:32s} duplicados={len(hallados):2d}  (esperado {esperado})")
        for d in hallados[:6]:
            print(f"        +1 ref a un slug YA indexado: {d}")
    ok = canario_del_ruteo_de_errores() and ok
    print(f"\n   control de dos lados: {'PASA' if ok else 'NO PASA'}")
    return 0 if ok else 1




def canario_del_ruteo_de_errores() -> bool:
    """Exige que un error INTERNO salga por exit 2 y no por el 1 de «encontré duplicados».

    Vive DENTRO del --autotest por una razón medida: el autotest daba `control de dos lados:
    PASA` mientras la invocación real moría de UnicodeEncodeError en el print de la cabecera,
    porque su camino de salida no emite el «→». Un control que no pasa por el entrypoint real no
    acredita al entrypoint real
    (memoria/el-control-positivo-cubre-la-mitad-que-sospechas-y-la-otra-queda-muda.md).
    """
    global duplicados
    original = duplicados

    def revienta(*a, **k):
        raise RuntimeError("canario inyectado a propósito")

    try:
        duplicados = revienta
        cod = main_protegido()
    finally:
        duplicados = original    # revertir SIEMPRE: un mutante que sobrevive a la corrida deja
                                 # el instrumento mintiendo en la siguiente
    bien = cod == 2
    rotulo = "error interno -> exit 2 (no 1)"
    print(f"   {'OK ' if bien else 'MAL'} {rotulo:32s} exit={cod}  (esperado 2)")
    if not bien:
        print("        Un crash con exit 1 es indistinguible de «hay un duplicado», y el falso")
        print("        rojo es el que empuja al --no-verify.")
    return bien
def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--rev", default="HEAD", help="commit a medir (default HEAD)")
    p.add_argument("--base", help="base de comparación (default: merge-base con origin/main)")
    p.add_argument("--autotest", action="store_true", help="corre los 5 controles históricos")
    a = p.parse_args()
    if a.autotest:
        return autotest()

    rev = git("rev-parse", a.rev).strip()
    if not rev:
        print(f"NO MEDIDO: {a.rev} no resuelve en este clon", file=sys.stderr)
        return 2
    # El base se rev-parsea igual que el rev: sin eso, `--base <ref>` se imprimía crudo y el guard de
    # rango vacío de abajo comparaba una cadena contra un sha, así que podía dejar pasar base == rev.
    base = (git("rev-parse", a.base).strip() if a.base
            else git("merge-base", rev, "origin/main").strip() or git("rev-parse", f"{rev}^").strip())
    if not base:
        print("NO MEDIDO: sin base (¿clon shallow, o commit raíz?)", file=sys.stderr)
        return 2

    # Un rango vacío no es «sin duplicados»: es no haber mirado, y eso NO puede salir verde.
    # (Pasa al correrlo sobre el propio HEAD de origin/main: el merge-base es él mismo.)
    if base == rev:
        print(f"NO MEDIDO: base == rev ({rev[:8]}) — el rango está vacío, no hay nada que comparar.\n"
              f"           Pasá --base explícito, o corré --autotest.", file=sys.stderr)
        return 2

    halla = duplicados(base, rev)
    print(f"base {base[:8]} → rev {rev[:8]}")
    if not halla:
        print("[OK ] 0 líneas de índice duplicadas (semánticas, no textuales)")
        return 0
    print(f"[MAL] {len(halla)} slug(s) GANAN una línea de índice y YA tenían una:")
    for d in halla:
        print(f"       · {d}")
    print("\n       Un 2º puntero al mismo slug no es un refuerzo: es un duplicado. Antes de agregar")
    print("       una línea de índice, medí si ya existe — y medilo contra el árbol que PUBLICÁS,")
    print("       no contra el checkout compartido (memoria/el-medidor-mide-el-arbol-donde-vive-no-el-que-publicas.md).")
    return 1


def main_protegido() -> int:
    """Rutea cualquier excepción inesperada al exit 2 (NO MEDIDO), nunca al 1.

    Por qué no alcanza con dejar que Python propague: un traceback sale con **exit 1**, que en
    este script significa «encontré duplicados en tu commit». Cableado así, el primer rojo del
    gate sería ambiguo entre «hay un duplicado» y «el script no arranca» — y el falso rojo es
    justo el que empuja al `--no-verify`
    (memoria/dos-causas-distintas-comparten-el-codigo-de-salida-y-el-mensaje-elige-una.md).

    El fix de encoding de #897 cerró la causa conocida de crash, y su comentario nombra esta
    colisión — pero nombrarla no la arregla: cualquier OTRA excepción seguía saliendo por el 1.
    """
    try:
        return main()
    except Exception as e:                       # noqa: BLE001 - es el guard de salida
        print(f"NO MEDIDO: error interno del instrumento — {type(e).__name__}: {e}",
              file=sys.stderr)
        print("           exit 2 = no se pudo medir. NO es «encontré duplicados» (eso es exit 1).",
              file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main_protegido())
