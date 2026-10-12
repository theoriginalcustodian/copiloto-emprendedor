#!/usr/bin/env python
"""Lista los comentarios que declaran un ESTADO TEMPORAL del sistema, para verificarlos.

## Por qué existe

El 2026-10-11, en una sola sesión, **cuatro** afirmaciones falsas entraron a documentos del sprint
por el mismo mecanismo: un comentario declaró un estado, el código cambió, nadie actualizó el
comentario, y el siguiente lector le creyó.

| comentario | lo que afirmaba | lo que medí |
|---|---|---|
| `cobro_store.py:52` | «nadie escribe el origen `mercadopago`» | lo escribía `mp_web.py` desde el 06/10 ⇒ afirmé «cero veces en Ingresos», falso |
| `PantallaRecientes.tsx:16` | «`q` da 400 hasta que backend lo mergee (`[CONNECT]`)» | `actividad_web.py:99` la declara y `:112` dice que YA está implementada ⇒ mandaba a esperar un merge inexistente |
| `_layout.tsx:160` | «`recientes` hoy queda inalcanzable» | `PantallaPrincipal.tsx:179` navega ahí con test verde ⇒ invitaba a borrar una pantalla alcanzable |
| título de `#1001` | «mobile no tiene pantalla de aceptación legal» | `PantallaLegal.tsx:31` existe y está montada ⇒ habría mandado a construirla de nuevo |

**Ninguno de los cuatro se detectó leyendo con más cuidado.** Los cuatro cayeron al medir contra el
código que ESCRIBE o que NAVEGA. Un comentario no es evidencia de nada: es la memoria de alguien
sobre un estado que ya no controla.

## Qué hace, y qué NO hace

Este script **no decide si un comentario es falso** — no puede: eso exige medir cada afirmación
contra el código. Lo que hace es **acotar el universo**: de todos los comentarios del repo, lista los
que hacen una afirmación **temporal** («todavía no», «hasta que», «hoy queda», «pendiente de»,
`[CONNECT]`), porque son exactamente los que envejecen. Un comentario que explica *por qué* algo es
así no caduca; uno que dice *todavía no está* caduca el día que se hace.

Es un **acotador de superficie, no un veredicto**. Su salida es una cola de verificación con
`path:línea`, y quien la toma mide contra el código que escribe/navega/declara — no contra otro
comentario.

## Dos propiedades conocidas, medidas al estrenarlo (2026-10-11)

1. **Un comentario YA CORREGIDO vuelve a entrar a la cola**, porque el texto de la corrección cita
   la afirmación vieja («hasta 2026-10-11 acá decía *hoy queda inalcanzable*»). Medido: la
   corrección de `_layout.tsx` aporta 4 de las 49 filas. **No lo trato con una heurística** —un
   `grep` de «Medido:» o de un ✅ para auto-absolver es exactamente el guard que se satisface con su
   propio comentario— así que queda declarado: una fila que cita su propia refutación es señal de
   comentario **sano**, y el que la lea lo ve en una línea. El costo es inflar el conteo; el
   beneficio es que la corrección sigue visible.
2. **Lo que destapó en su primera corrida** incluye `apps/copiloto-web/src/lib/api/admin.ts:301`
   («está pendiente hasta que backend publique el endpoint») y `:335` («la verificación contra el
   entorno vivo queda pendiente hasta que backend despliegue») — el patrón `[CONNECT]` otra vez.
   Están **fuera del alcance** del sprint (la consola de operador no entra), y por eso aparecen en
   la cola y no en el backlog: el instrumento lista, no decide prioridad.

## Controles

- **ceguera**: imprime cuántos archivos miró y cuántas líneas de comentario evaluó. Un instrumento
  que no mira nunca falla; si `archivos=0`, el resultado es inútil y sale 1.
- **positivo**: inyecta en memoria una línea con cada marcador y exige que los encuentre. Si un
  marcador no se caza a sí mismo, el patrón está roto y el cero que reporte es ciego.
- **negativo**: un marcador inexistente tiene que dar 0.

Exit: 0 hallazgos listados · 1 un control falló · 2 mal invocado.
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

# Windows: stdout es cp1252 y un `print` con acentos mata el proceso con UnicodeEncodeError
# --- y ese traceback sale exit 1, el mismo codigo que uso para «un control fallo». Dos causas
# con un codigo de salida hacen que el mensaje elija la equivocada, asi que lo saco de raiz.
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

AQUI = Path(__file__).resolve()
REPO = AQUI.parent.parent.parent


def morir(msg: str) -> None:
    """Exit 2 = mal invocado. Separado de exit 1 (un control falló) a propósito:
    `sys.exit("texto")` sale 1 y se vuelve indistinguible de un control en rojo."""
    print(f"ERROR: {msg}", file=sys.stderr)
    raise SystemExit(2)


# Marcadores de afirmación TEMPORAL. Cada uno dice «esto es así AHORA», que es lo que caduca.
# Deliberadamente NO incluyo «TODO»/«FIXME»: ésos ya se buscan solos y nadie les cree un estado —
# el daño lo hace el comentario que suena a hecho establecido.
MARCADORES = {
    "espera-un-merge": r"hasta que .{0,40}(mergee|merge|lo suba|lo cablee)",
    "connect": r"\[CONNECT\]",
    "todavia-no": r"\b(todav[íi]a no|a[úu]n no)\b",
    "hoy-es-asi": r"\bhoy (queda|da|no|es|sigue|est[áa])\b",
    "nadie": r"\bnadie (escribe|lo lee|lo llama|la llama|lo usa|la usa)\b",
    "inalcanzable": r"\binalcanzable\b",
    "pendiente-de": r"\bpendiente (de|hasta)\b",
    "no-existe-aun": r"\bno existe (todav[íi]a|a[úu]n)\b",
    "da-un-codigo": r"\bda (400|401|403|404|500|501)\b",
    "por-ahora": r"\bpor ahora\b",
}

# Prefijos de línea de comentario, por lenguaje. Sólo líneas de comentario: un string de producción
# que contenga «todavía no» es texto de UI, no una afirmación sobre el sistema.
COMENTARIO = re.compile(r"^\s*(#|//|\*|/\*)")

# Medido el 2026-10-11 sobre 615 archivos: `todavia-no` dio 130 hits de 181, y la mayoria son
# comentarios EXPLICATIVOS legitimos («aunque todavia no llegue ninguno»), no afirmaciones que
# caduquen. Un marcador que copa el 72% de la salida no acota: TAPA a los otros nueve. Van a un
# balde aparte, que se reporta como CIFRA y no como cola --- y se puede pedir con `--incluir-ruidosos`.
RUIDOSOS = {"todavia-no", "por-ahora"}

EXTS = {".py", ".ts", ".tsx", ".js", ".mjs", ".sh"}
EXCLUIR = {"node_modules", ".git", "dist", "build", ".venv", "venv", "__pycache__", ".expo"}


def es_test(p: Path) -> bool:
    n = p.name
    return ".test." in n or ".spec." in n or n.startswith("test_") or "tests" in p.parts


def buscar(texto: str, marcadores: dict[str, str]) -> list[tuple[int, str, str]]:
    """Devuelve (nro_linea, marcador, texto) por cada línea de COMENTARIO que matchea."""
    hits = []
    for i, linea in enumerate(texto.splitlines(), start=1):
        if not COMENTARIO.match(linea):
            continue
        for nombre, patron in marcadores.items():
            if re.search(patron, linea, re.IGNORECASE):
                hits.append((i, nombre, linea.strip()))
                break  # un marcador por línea: no inflar el conteo con sinónimos
    return hits


def control_positivo(marcadores: dict[str, str]) -> list[str]:
    """Cada marcador debe cazarse a sí mismo en una línea de comentario sintética.
    Sin esto, un patrón roto reporta 0 y el cero se lee como «no hay deuda»."""
    canarios = {
        "espera-un-merge": "// q da 400 hasta que backend lo mergee",
        "connect": "// pendiente `[CONNECT]` del otro lado",
        "todavia-no": "# todavía no hay nadie conectado",
        "hoy-es-asi": "// hoy queda inalcanzable y está reportado",
        "nadie": "# nadie escribe el origen mercadopago",
        "inalcanzable": "// la pantalla es inalcanzable",
        "pendiente-de": "// pendiente de que lo cableen",
        "no-existe-aun": "// el endpoint no existe todavía",
        "da-un-codigo": "// el filtro da 400",
        "por-ahora": "// por ahora se deja así",
    }
    fallan = []
    for nombre in marcadores:
        canario = canarios.get(nombre)
        if canario is None:
            fallan.append(f"{nombre} (sin canario definido)")
            continue
        encontrados = {m for _, m, _ in buscar(canario, {nombre: marcadores[nombre]})}
        if nombre not in encontrados:
            fallan.append(nombre)
    return fallan


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--raiz", default=None, help="subárbol a escanear (default: apps/ + packages/ + motor/)")
    ap.add_argument("--marcador", default=None, help="un solo marcador, por nombre")
    ap.add_argument("--incluir-ruidosos", action="store_true",
                    help="incluir los marcadores de baja senal (todavia-no, por-ahora) en la COLA, no solo en la cifra")
    ap.add_argument("--incluir-tests", action="store_true",
                    help="también los archivos de test (default: NO — un comentario de test describe el test)")
    args = ap.parse_args()

    marcadores = MARCADORES
    if args.marcador:
        if args.marcador not in MARCADORES:
            morir(f"marcador desconocido: {args.marcador!r}. Son: {', '.join(sorted(MARCADORES))}")
        marcadores = {args.marcador: MARCADORES[args.marcador]}

    # CONTROL POSITIVO primero: si los patrones están rotos, nada de lo que siga vale.
    fallan = control_positivo(marcadores)
    if fallan:
        print(f"CONTROL POSITIVO FALLÓ: estos marcadores no se cazan a sí mismos -> {', '.join(fallan)}",
              file=sys.stderr)
        return 1

    # CONTROL NEGATIVO: un marcador que no puede existir debe dar 0.
    if buscar("// zznomatchzz", {"neg": r"zzimposiblezz"}):
        print("CONTROL NEGATIVO FALLÓ: un patrón inexistente encontró algo", file=sys.stderr)
        return 1

    if args.raiz:
        raices = [REPO / args.raiz]
        if not raices[0].exists():
            morir(f"no existe: {raices[0]}")
    else:
        raices = [REPO / d for d in ("apps", "packages", "motor") if (REPO / d).exists()]
    if not raices:
        morir("ninguna raíz existe — ¿el script está fuera del repo?")

    archivos = 0
    lineas_comentario = 0
    hallazgos: list[tuple[str, int, str, str]] = []

    for raiz in raices:
        for p in sorted(raiz.rglob("*")):
            if not p.is_file() or p.suffix not in EXTS:
                continue
            if EXCLUIR & set(p.parts):
                continue
            if not args.incluir_tests and es_test(p):
                continue
            try:
                texto = p.read_text(encoding="utf-8", errors="replace")
            except OSError:
                continue
            archivos += 1
            lineas_comentario += sum(1 for l in texto.splitlines() if COMENTARIO.match(l))
            rel = p.relative_to(REPO).as_posix()
            for nro, marcador, linea in buscar(texto, marcadores):
                hallazgos.append((rel, nro, marcador, linea))

    # CONTROL DE CEGUERA: un instrumento que no miró nada nunca falla.
    if archivos == 0:
        print("CONTROL DE CEGUERA FALLÓ: 0 archivos escaneados -> el resultado no significa nada",
              file=sys.stderr)
        return 1

    por_marcador: dict[str, int] = {}
    for _, _, m, _ in hallazgos:
        por_marcador[m] = por_marcador.get(m, 0) + 1

    print(f"== escaneados: {archivos} archivos · {lineas_comentario} líneas de comentario ==")
    print(f"== comentarios que declaran un estado TEMPORAL: {len(hallazgos)} ==\n")
    for m, n in sorted(por_marcador.items(), key=lambda kv: -kv[1]):
        print(f"  {n:4d}  {m}")
    print()
    cola = [h for h in hallazgos if args.incluir_ruidosos or h[2] not in RUIDOSOS]
    balde = [h for h in hallazgos if not args.incluir_ruidosos and h[2] in RUIDOSOS]
    if balde:
        marcadores_balde = sorted({h[2] for h in balde})
        print(f"  (+ {len(balde)} de baja señal en {marcadores_balde} — fuera de la cola a "
              f"propósito; `--incluir-ruidosos` los trae)\n")
    print(f"── COLA DE VERIFICACIÓN: {len(cola)} ──\n")
    for rel, nro, marcador, linea in cola:
        corta = linea if len(linea) <= 120 else linea[:117] + "..."
        print(f"{rel}:{nro}  [{marcador}]  {corta}")

    print("\n".join([
        "",
        "⚠️  ESTO NO ES UNA LISTA DE COMENTARIOS FALSOS. Es la superficie a verificar.",
        "   Cada línea se mide contra el código que ESCRIBE / NAVEGA / DECLARA lo que el comentario",
        "   afirma — nunca contra otro comentario. Los 4 casos del 2026-10-11 cayeron así, no leyendo.",
    ]))
    return 0


if __name__ == "__main__":
    sys.exit(main())
