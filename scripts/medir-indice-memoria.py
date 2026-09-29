#!/usr/bin/env python3
"""Control del índice de memoria — que entre entero y que no esconda nada.

Cuatro medidas (ver memoria/el-indice-truncado-fabrica-duplicados.md):
  1. PRESUPUESTO  — MEMORY.md debe entrar completo bajo el límite de carga (~25 KB medido).
  2. COBERTURA    — todo memoria/*.md tiene línea en MEMORY.md o en HISTORIA.md.
  3. INVERSO      — ningún link del índice apunta a un archivo que no existe.
  4. DUPLICADOS   — descripciones muy parecidas: es la firma del bucle índice-truncado.

Control positivo horneado: si el parser no encuentra links, aborta en vez de reportar "todo bien".
Un instrumento que no mira nunca falla.

Uso:  python scripts/medir-indice-memoria.py [--presupuesto 25000]
Sale 1 si alguna medida falla — sirve como gate.
"""
from __future__ import annotations

import argparse
import re
import sys
from difflib import SequenceMatcher
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]
MEM = RAIZ / "memoria"

LINK_MD = re.compile(r"\]\(([A-Za-z0-9._-]+\.md)\)")
WIKILINK = re.compile(r"\[\[([A-Za-z0-9._-]+)\]\]")
DESCRIPCION = re.compile(r"^description:\s*(.+)$", re.MULTILINE)


def referencias(texto: str) -> set[str]:
    """Nombres de archivo referenciados, por link markdown Y por wikilink.

    Mirar sólo uno de los dos da falsos: la 1ª versión de este control reportó 25
    huérfanas donde había 24.
    """
    nombres = set(LINK_MD.findall(texto))
    nombres |= {f"{w}.md" for w in WIKILINK.findall(texto)}
    return nombres


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--presupuesto", type=int, default=24_000,
                    help="caracteres que el harness carga del índice antes de truncar. Medido "
                         "2026-08-01: cortó a los 24.683 chars y la línea siguiente cruzaba 25.000. "
                         "El default deja margen para crecer sin volver a truncarse")
    ap.add_argument("--umbral-duplicado", type=float, default=0.82)
    args = ap.parse_args()

    indice = MEM / "MEMORY.md"
    historia = MEM / "HISTORIA.md"
    texto_indice = indice.read_text(encoding="utf-8")
    texto_historia = historia.read_text(encoding="utf-8") if historia.exists() else ""

    refs = referencias(texto_indice) | referencias(texto_historia)

    # --- control positivo: si no parseo nada, el roto soy yo, no la memoria ---
    if len(refs) < 10:
        print(f"CONTROL NEGATIVO: sólo {len(refs)} referencias parseadas — el parser está roto")
        return 1

    topicos = sorted(f for f in MEM.glob("*.md") if f.name not in ("MEMORY.md", "HISTORIA.md"))
    fallas = []

    # --- 1. presupuesto (en CARACTERES: es lo que el harness cuenta, no bytes) ---
    peso = len(texto_indice)
    lineas = texto_indice.count("\n") + 1
    ok_peso = peso <= args.presupuesto
    print(f"[{'OK ' if ok_peso else 'MAL'}] presupuesto: {peso} / {args.presupuesto} chars  ({lineas} líneas)")
    if not ok_peso:
        sobra = peso - args.presupuesto
        fallas.append(f"el índice se pasa {sobra} chars: se trunca y esa cola no existe para la sesión")

    # --- 2. cobertura ---
    huerfanas = [f.name for f in topicos if f.name not in refs]
    print(f"[{'OK ' if not huerfanas else 'MAL'}] cobertura: {len(topicos) - len(huerfanas)}/{len(topicos)} entradas indexadas")
    for h in huerfanas:
        print(f"      huérfana (invisible para toda sesión): {h}")
    if huerfanas:
        fallas.append(f"{len(huerfanas)} entradas sin línea en MEMORY.md ni HISTORIA.md")

    # --- 3. inverso: el índice promete y no entrega ---
    existentes = {f.name for f in MEM.glob("*.md")}
    rotos = sorted(r for r in refs if r not in existentes)
    print(f"[{'OK ' if not rotos else 'MAL'}] links a archivos inexistentes: {len(rotos)}")
    for r in rotos:
        print(f"      roto: {r}")
    if rotos:
        fallas.append(f"{len(rotos)} links apuntan a archivos que no existen")

    # --- 4. duplicados por descripción ---
    descripciones: list[tuple[str, str]] = []
    for f in topicos:
        m = DESCRIPCION.search(f.read_text(encoding="utf-8"))
        if m:
            descripciones.append((f.name, m.group(1).strip().strip('"').lower()))
    parecidos = []
    for i, (na, da) in enumerate(descripciones):
        for nb, db in descripciones[i + 1:]:
            r = SequenceMatcher(None, da, db).ratio()
            if r >= args.umbral_duplicado:
                parecidos.append((round(r, 2), na, nb))
    print(f"[{'OK ' if not parecidos else '⚠️ '}] descripciones casi idénticas: {len(parecidos)}")
    for r, na, nb in sorted(parecidos, reverse=True):
        print(f"      {r}  {na}  ≈  {nb}")

    print()
    if fallas:
        for f in fallas:
            print(f"FALLA: {f}")
        return 1
    print(f"Índice sano: {len(topicos)} entradas, todas alcanzables, {peso} de {args.presupuesto} chars.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
