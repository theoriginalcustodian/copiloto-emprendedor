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

# La consola de Windows es cp1252 y este script imprime `⚠️`. El emoji YA estaba (en el control de
# descripciones casi identicas) y nunca habia reventado porque esa rama no se habia ejecutado nunca:
# con 0 parecidos el print sale por el lado `OK `. O sea que el medidor tenia una bomba en un camino
# que solo se recorre cuando hay un hallazgo -- exactamente «un mecanismo roto hacia el NO no da
# sintoma», adentro del propio medidor. Se destapo el 2026-09-30 al agregar el aviso de borde, que
# SI se recorre. En CI (Linux/UTF-8) no daba sintoma tampoco.
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")

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
    ap.add_argument("--max-lineas", type=int, default=200,
                    help="líneas que el harness carga del índice antes de truncar. Es un límite "
                         "SEPARADO del de caracteres y se alcanza primero cuando las líneas son "
                         "cortas. Medido 2026-09-22: el índice estaba en 23.930/24.000 chars —este "
                         "control en OK— y el harness igual avisó «207 lines (limit: 200)», así que "
                         "7 líneas no existían para ninguna sesión mientras el gate decía que sí")
    ap.add_argument("--aviso-pct", type=float, default=0.98,
                    help="fraccion del presupuesto a partir de la cual se AVISA sin fallar. Un "
                         "presupuesto al 100%% con exit 0 es un guard que falla abierto justo en su "
                         "caso de activacion: el 2026-09-30 el indice llego a 24000/24000 EXACTOS y "
                         "este control dijo [OK ], o sea que la proxima linea que agregara cualquiera "
                         "se truncaba en silencio. El criterio de FALLA no cambia -- lo que cambia es "
                         "que el borde se vea antes de cruzarlo")
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
    borde_peso = ok_peso and peso >= args.presupuesto * args.aviso_pct
    print(f"[{'⚠️ ' if borde_peso else ('OK ' if ok_peso else 'MAL')}] presupuesto: {peso} / {args.presupuesto} chars  ({lineas} líneas)")
    if borde_peso:
        margen = args.presupuesto - peso
        # La acción concreta, porque «estás cerca» no le dice a nadie qué hacer. La unidad es la
        # LÍNEA de índice, que el propio encabezado del MEMORY.md limita a 160 chars: con menos de
        # eso de margen, la próxima entrada no entra y se trunca sin avisar.
        print(f"      margen: {margen} chars = {margen // 160} línea(s) de índice (el techo por línea es 160).")
        print(f"      ACCIÓN: bajá entradas a HISTORIA.md ANTES del próximo puntero. No se comprime,")
        print(f"      se baja: HISTORIA.md no se carga y sigue siendo buscable.")
    if not ok_peso:
        sobra = peso - args.presupuesto
        fallas.append(f"el índice se pasa {sobra} chars: se trunca y esa cola no existe para la sesión")

    # --- 1.bis presupuesto en LÍNEAS: el harness trunca por las DOS dimensiones ---
    # Medir sólo caracteres deja un modo de falla mudo: líneas cortas agotan el cupo de líneas con
    # el de chars todavía en verde, y el gate firma OK sobre un índice que llega cortado.
    ok_lineas = lineas <= args.max_lineas
    # El aviso va en las DOS dimensiones o el guard sigue fallando abierto por la otra: el corte del
    # 2026-09-22 fue por LÍNEAS con los chars en verde, así que avisar sólo de chars deja intacto
    # justamente el modo que ya dio síntoma.
    borde_lineas = ok_lineas and lineas >= args.max_lineas * args.aviso_pct
    print(f"[{'⚠️ ' if borde_lineas else ('OK ' if ok_lineas else 'MAL')}] líneas: {lineas} / {args.max_lineas}")
    if borde_lineas:
        print(f"      margen: {args.max_lineas - lineas} línea(s). Misma ACCIÓN: bajar a HISTORIA.md.")
    if not ok_lineas:
        fallas.append(f"el índice se pasa {lineas - args.max_lineas} líneas: la cola se trunca "
                      f"aunque el presupuesto en chars esté en verde")

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
    if borde_peso or borde_lineas:
        print(f"Índice SIN MARGEN: {len(topicos)} entradas, todas alcanzables, {peso} de "
              f"{args.presupuesto} chars y {lineas} de {args.max_lineas} líneas. Exit 0 porque "
              f"todavía entra completo, pero la próxima entrada NO va a entrar.")
        return 0
    print(f"Índice sano: {len(topicos)} entradas, todas alcanzables, {peso} de {args.presupuesto} chars.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
