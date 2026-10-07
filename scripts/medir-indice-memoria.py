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
import collections
import difflib
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


BLOQUE_CODIGO = re.compile(r"```.*?```", re.S)
CODIGO_INLINE = re.compile(r"`[^`\n]*`")


def sin_codigo(texto: str) -> str:
    """Saca bloques y código inline: lo que está en backticks es SINTAXIS citada, no una referencia.

    Sin esto el control reporta los ejemplos que la propia memoria usa para explicarse. Medido:
    `[[wikilink]]` y `[[links]]` en el-indice-truncado-fabrica-duplicados.md eran 2 de los 11
    «rotos» -- y un guard que grita en el caso normal se desarma solo, así que reportarlos habría
    costado más que el agujero que cierra.
    """
    return CODIGO_INLINE.sub(" ", BLOQUE_CODIGO.sub(" ", texto))


def referencias(texto: str) -> set[str]:
    """Nombres de archivo referenciados, por link markdown Y por wikilink.

    Mirar sólo uno de los dos da falsos: la 1ª versión de este control reportó 25
    huérfanas donde había 24.
    """
    limpio = sin_codigo(texto)
    nombres = set(LINK_MD.findall(limpio))
    nombres |= {f"{w}.md" for w in WIKILINK.findall(limpio)}
    return nombres


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--presupuesto", type=int, default=24_000,
                    help="BYTES que el harness carga del índice antes de truncar. Medido "
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

    # --- 0. duplicados EXACTOS de línea: el presupuesto MIENTE mientras haya copias ---
    # Va PRIMERO a propósito: el control 1 mide bytes y, si hay líneas repetidas, las cuenta como
    # contenido y manda a "bajar entradas a HISTORIA.md" — o sea a PERDER información para hacer
    # lugar a basura. Medido 2026-09-30: el medidor decía «Índice SIN MARGEN: 23810/24000, la próxima
    # entrada NO va a entrar» y 929 de esos bytes eran SEIS líneas duplicadas exactas (un bloque de 3
    # en §Estado vivo, 2 en §Cómo trabajo, y el encabezado «Órdenes del operador» repetido huérfano y
    # vacío). Borradas: 22881 bytes y el veredicto pasó a «Índice sano», con las 360 entradas intactas.
    # El control 4 existía y no podía verlo: compara DESCRIPCIONES DE ENTRADAS con umbral de
    # similitud, y estas líneas no son entradas — el append duplicado cae justo en el hueco.
    # ⚠️ Mira SOLO el indice, y no se extiende tal cual a HISTORIA.md: ahi los separadores `---`
    # se repiten legitimamente (medido 2026-09-30: 3 veces, 8 bytes) y este control gritaria en el
    # caso NORMAL, que es como un guard se desarma solo. HISTORIA se audita por OTRO criterio -- la
    # misma entrada linkeada dos veces --, y ese sale limpio: 220 links, 220 distintos, 0 repetidas.
    cuenta = collections.Counter(l for l in texto_indice.splitlines() if l.strip())
    dups = {l: n for l, n in cuenta.items() if n > 1}
    desperdicio = sum((len(l.encode("utf-8")) + 1) * (n - 1) for l, n in dups.items())
    print(f"[{'OK ' if not dups else 'MAL'}] líneas duplicadas exactas: {len(dups)}")
    for l, n in sorted(dups.items(), key=lambda kv: -len(kv[0]) * (kv[1] - 1)):
        print(f"      x{n}  desperdicia {(len(l.encode('utf-8')) + 1) * (n - 1):5d} B  |  {l[:88]}")
    if dups:
        fallas.append(f"{len(dups)} línea(s) duplicadas exactas desperdician {desperdicio} bytes: "
                      f"borrá las copias ANTES de bajar nada a HISTORIA.md — el presupuesto de abajo "
                      f"las cuenta como contenido y su recomendación te hace perder entradas")
    # Referencias de TODOS los archivos (índice, historia y topics), con QUIÉN cita a cada destino.
    # Separada de `refs` a propósito: ver el comentario del control 3.
    citas: dict[str, list[str]] = {}
    for f in [indice, historia, *topicos]:
        if not f.exists():
            continue
        for destino in referencias(f.read_text(encoding="utf-8")):
            citas.setdefault(destino, []).append(f.name)

    # --- 1. presupuesto (en BYTES) ---
    # ⚠️ Acá vivía `peso = len(texto_indice)` con el comentario «en CARACTERES: es lo que el harness
    # cuenta, no bytes». Esa afirmación nunca se verificó y es FALSA — medido 2026-09-30:
    #   MEMORY.md = 23.875 caracteres pero 25.210 BYTES (1.335 de diferencia: 167 `—`, los acentos
    #   y 43 variation-selectors de emoji, que pesan 3-4 bytes cada uno).
    # O sea: este control decía `23875/24000 [OK ] margen 125` sobre un índice que en disco pesaba
    # 1.210 bytes MÁS que el techo. Llevaba absolviendo un índice truncado.
    #
    # El corte del 2026-09-22 es el control positivo histórico y estaba MAL ATRIBUIDO: el script lo
    # adjudicó al límite de LÍNEAS (207 > 200) y construyó el control 1.bis sobre esa lectura. Pero
    # había DOS causas suficientes y eligió una — 23.930 chars con esta densidad son ~25.268 bytes,
    # ya pasados. Ver memoria/dos-causas-suficientes-el-test-no-atribuye.md. El control de líneas
    # se queda: sigue siendo un techo real e independiente. Lo que cambia es que ya no es la única
    # explicación disponible.
    #
    # La unidad exacta que cuenta el harness no está documentada. De las tres candidatas, los BYTES
    # son la única que explica LOS DOS cortes observados (2026-08-01 y 2026-09-22) y es la
    # conservadora. Si alguna vez se documenta que cuenta tokens, se cambia acá y se cita la fuente.
    peso = len(texto_indice.encode("utf-8"))
    lineas = texto_indice.count("\n") + 1
    ok_peso = peso <= args.presupuesto
    borde_peso = ok_peso and peso >= args.presupuesto * args.aviso_pct
    print(f"[{'⚠️ ' if borde_peso else ('OK ' if ok_peso else 'MAL')}] presupuesto: {peso} / {args.presupuesto} bytes  ({lineas} líneas, {len(texto_indice)} chars)")
    if borde_peso:
        margen = args.presupuesto - peso
        # La acción concreta, porque «estás cerca» no le dice a nadie qué hacer. La unidad es la
        # LÍNEA de índice, que el propio encabezado del MEMORY.md limita a 160 chars: con menos de
        # eso de margen, la próxima entrada no entra y se trunca sin avisar.
        print(f"      margen: {margen} bytes = {margen // 175} línea(s) de índice (el techo por línea es 160 chars ~= 175 bytes).")
        print(f"      ACCIÓN: bajá entradas a HISTORIA.md ANTES del próximo puntero. No se comprime,")
        print(f"      se baja: HISTORIA.md no se carga y sigue siendo buscable.")
    if not ok_peso:
        sobra = peso - args.presupuesto
        fallas.append(f"el índice se pasa {sobra} bytes: se trunca y esa cola no existe para la sesión")

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
                      f"aunque el presupuesto en bytes esté en verde")

    # --- 2. cobertura ---
    huerfanas = [f.name for f in topicos if f.name not in refs]
    print(f"[{'OK ' if not huerfanas else 'MAL'}] cobertura: {len(topicos) - len(huerfanas)}/{len(topicos)} entradas indexadas")
    for h in huerfanas:
        print(f"      huérfana (invisible para toda sesión): {h}")
    if huerfanas:
        fallas.append(f"{len(huerfanas)} entradas sin línea en MEMORY.md ni HISTORIA.md")

    # --- 3. inverso: el índice promete y no entrega ---
    existentes = {f.name for f in MEM.glob("*.md")}
    # ⚠️ El universo es `citas`, NO `refs`. Hasta 2026-09-30 esto leía `refs` -- o sea sólo lo que
    # prometían el ÍNDICE y HISTORIA-- y los topic files se citan entre sí con ~1300 referencias que
    # ningún control miraba. Medido ese día: **11 destinos rotos con el medidor en verde**, y 7 de
    # los 11 por la misma causa (el wikilink escrito con el ARTÍCULO del gancho del índice: el
    # gancho dice «Un instrumento que NO MIRA nunca falla» y el archivo es
    # `instrumento-que-no-mira-nunca-falla`). Importa más que como higiene: IDXFORMATO va a
    # renombrar ~150 archivos de memoria/, y sin este control el rename rompe los wikilinks EN
    # SILENCIO con el veredicto en verde -- que es el modo de falla que este script existe para
    # cerrar, entrando por la puerta de al lado.
    rotos = sorted(r for r in citas if r not in existentes)
    print(f"[{'OK ' if not rotos else 'MAL'}] links a archivos inexistentes: {len(rotos)} "
          f"(sobre {len(citas)} destinos citados por {len(topicos) + 2} archivos)")
    for r in rotos:
        # El candidato cercano no es un adorno: 7 de los 11 rotos del 2026-09-30 eran una variante
        # de prefijo del slug real, y sin la sugerencia cada arreglo es una búsqueda a mano.
        cerca = difflib.get_close_matches(r, existentes, n=1, cutoff=0.6)
        quien = ", ".join(sorted(citas[r])[:3])
        extra = f" — ¿quisiste decir {cerca[0]}?" if cerca else ""
        print(f"      citado por {quien}{extra}")
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
              f"{args.presupuesto} bytes y {lineas} de {args.max_lineas} líneas. Exit 0 porque "
              f"todavía entra completo, pero la próxima entrada NO va a entrar.")
        return 0
    print(f"Índice sano: {len(topicos)} entradas, todas alcanzables, {peso} de {args.presupuesto} bytes.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
