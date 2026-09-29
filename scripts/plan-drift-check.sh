#!/usr/bin/env bash
# plan-drift-check.sh — Una fila que dice `pendiente` mientras el trabajo YA vive en `origin/main`
# desvía trabajo hacia algo ya hecho. Este control mide cada fila contra el EFECTO en el remoto.
#
# Por qué existe (fila `PLANDRIFT`, 2026-09-28): seis filas con dueño FE2 declaraban `pendiente` con el
# contenido ya mergeado. No fue descuido: el dueño de la fila NO edita `PLAN.md` (dueña única:
# planificación), y planificación se entera por el buzón, que sólo muestra lo que alguien decide avisar.
# El agujero vive en el par, no en una sesión. Es el criterio 2 del Cierre A (acta del 2026-09-29).
#
# **NO mide contra un número de PR, a propósito:** `PLACEM` se cerró sin PR que lo reclame. El sujeto
# es el contenido de `origin/main`.
#
# Este script RECOLECTA candidatos; NO dicta veredicto. Una fila con su artefacto presente en `main`
# es un CANDIDATO a drift, no un cierre: el archivo puede existir por otra razón. El veredicto lo da
# la sesión. (memoria: los sub-agentes y los scripts traen datos; el veredicto no se delega)
#
# **La presencia del archivo sola NO es señal — MEDIDO en la v1 de este script:** las 3 filas que marcó
# eran ruido. `DOCANC` cita `LegalScreen.tsx`, que está en `main` porque la feature existe; lo pendiente
# es una corrección de documentación. Un artefacto viejo aparece PRESENTE para toda fila que lo
# mencione, así que «todo lo citado existe» marca medio tablero y se vuelve ignorable — un guard que
# grita en el caso normal se desarma solo.
# El discriminador es **la FECHA**: si `main` tocó el artefacto en o después de la fecha de evidencia de
# la fila, pasó algo después de escribirla → candidato. Si el último cambio es anterior, su presencia no
# informa nada → `PRESENCIA-VIEJA`, que NO es candidato.
#
# Uso:
#   bash scripts/plan-drift-check.sh              # informe + exit 1 si hay candidatos
#   bash scripts/plan-drift-check.sh --quiet      # sólo el resumen
#   BUZON=/otra/ruta bash scripts/plan-drift-check.sh
#
# Exit: 0 = sin candidatos · 1 = hay candidatos a drift · **2 = el instrumento no pudo medir**.
# El 2 existe separado del 1 a propósito: si «no pude medir» comparte código con «encontré algo», el
# falso rojo empuja a ignorar el rojo verdadero (memoria
# `dos-causas-distintas-comparten-el-codigo-de-salida-y-el-mensaje-elige-una`).
set -uo pipefail

QUIET=0
[ "${1:-}" = "--quiet" ] && QUIET=1

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# `coordinacion/` está GITIGNOREADA y vive en UNA carpeta física, no por worktree. Por eso el default
# es la ruta absoluta del checkout compartido y no `$REPO/coordinacion`: en un worktree ese path no
# existe. **Y por eso la ausencia es exit 2, no un skip silencioso** — un chequeo gateado con
# `-f $BUZON/PLAN.md` se salteaba solo y salía verde (caso 1 de
# `el-instrumento-respondio-sobre-otro-sujeto`, 2026-08-13).
BUZON="${BUZON:-C:/Proyectos/Claude/Claude code/copiloto-emprendedor/coordinacion}"
PLAN="$BUZON/PLAN.md"

fatal() { echo "🛑 NO PUDE MEDIR: $*" >&2; exit 2; }

[ -f "$PLAN" ] || fatal "no encuentro $PLAN. NO es 'sin drift': es que el instrumento no tiene sujeto. Pasá BUZON=<ruta absoluta>."

# ── El fetch va PRIMERO, y su ausencia es la forma en que este script mentiría ──────────────────────
# `git cat-file -e origin/main:<path>` NO consulta el remoto: lee la copia local de la ref. Sin fetch
# previo, un artefacto mergeado hace diez minutos «no existe», y el informe sale COHERENTE por estar
# ciego. El checkout compartido llegó a estar 141 commits atrás.
git -C "$REPO" fetch origin --quiet 2>/dev/null || fatal "el fetch falló; sin él mido mi propia copia vieja y el informe no vale"
BASE="$(git -C "$REPO" rev-parse origin/main 2>/dev/null)" || fatal "no resuelvo origin/main"

# ── Control POSITIVO + NEGATIVO de la función que decide «existe en main» ───────────────────────────
# Sin esto, un `cat-file` roto (ref mal armada, repo equivocado) devolvería «no existe» para todo y el
# informe entero saldría COHERENTE: verde por ceguera. memoria `instrumento-que-no-mira-nunca-falla`.
existe_en_main() { git -C "$REPO" cat-file -e "origin/main:$1" 2>/dev/null; }
# El `|| true` es a propósito: un path ausente devuelve vacío, y vacío NO puede significar «viejo» por
# defecto — ésa es exactamente la forma en que un no-medido se disfraza de medición.
tocado_en_main() { git -C "$REPO" log -1 --format=%cs "origin/main" -- "$1" 2>/dev/null || true; }

existe_en_main "README.md" || fatal "control POSITIVO falló: 'README.md' no aparece en origin/main. El instrumento está ciego, no el repo limpio."
if existe_en_main "no-existe-jamas-canario-$$.md"; then fatal "control NEGATIVO falló: un path inventado dio PRESENTE. La prueba de existencia no discrimina."; fi
[ -n "$(tocado_en_main README.md)" ] || fatal "control POSITIVO de fechas falló: 'README.md' no tiene fecha de último cambio en origin/main."

# Índice de nombres de archivo de `main`, para las filas que citan sólo el basename.
INDICE="$(mktemp)"; trap 'rm -f "$INDICE"' EXIT
git -C "$REPO" ls-tree -r --name-only origin/main > "$INDICE" || fatal "no pude listar el árbol de origin/main"
TOTAL_ARCHIVOS=$(wc -l < "$INDICE")
[ "$TOTAL_ARCHIVOS" -gt 100 ] || fatal "el árbol de origin/main trajo $TOTAL_ARCHIVOS archivos: eso no es este repo"

# ── Las filas ──────────────────────────────────────────────────────────────────────────────────────
# El estado vive en el ÚLTIMO campo del renglón, y ahí se lee: ponerlo en otra posición es cómo se
# perdieron dos frentes (memoria `un-enum-al-final-del-renglon-lo-borra-el-que-appendea`).
FILAS_TOTAL=0; FILAS_PEND=0; EXAMINADAS=0
N_DRIFT=0; N_COHER=0; N_VIEJA=0; N_NOMED=0
DRIFT=""; VIEJA=""; NOMED=""

while IFS= read -r linea; do
  case "$linea" in [A-Z][A-Z0-9]*"|"*) : ;; *) continue ;; esac
  FILAS_TOTAL=$((FILAS_TOTAL+1))
  id="${linea%%|*}"; id="$(echo "$id" | tr -d ' ')"
  estado="${linea##*|}"; estado="$(echo "$estado" | tr -d ' ')"
  [ "$estado" = "pendiente" ] || continue
  FILAS_PEND=$((FILAS_PEND+1))

  # Artefactos citados: tokens con extensión de código o path con barra. Los backticks los delimitan.
  arts="$(echo "$linea" | grep -oE '[A-Za-z0-9_./-]+\.(tsx|ts|jsx|js|mjs|py|sh|sql|json|md|yml|yaml)' | sort -u)"
  if [ -z "$arts" ]; then
    N_NOMED=$((N_NOMED+1)); EXAMINADAS=$((EXAMINADAS+1))
    NOMED="$NOMED$id "
    continue
  fi

  EXAMINADAS=$((EXAMINADAS+1))
  # Fecha de evidencia de la fila: la MAYOR que aparezca en el renglón.
  fecha_fila="$(echo "$linea" | grep -oE '20[0-9]{2}-[0-1][0-9]-[0-3][0-9]' | sort | tail -1)"
  falta=0; frescos=""
  for a in $arts; do
    ruta="$a"
    if ! existe_en_main "$ruta"; then
      ruta="$(grep -m1 -F -- "/$(basename "$a")" "$INDICE" || true)"
    fi
    if [ -z "$ruta" ]; then falta=1; continue; fi
    t="$(tocado_en_main "$ruta")"
    if [ -n "$fecha_fila" ] && [ -n "$t" ] && [[ "$t" > "$fecha_fila" || "$t" == "$fecha_fila" ]]; then
      frescos="$frescos$ruta($t) "
    fi
  done
  if [ "$falta" = "1" ]; then
    N_COHER=$((N_COHER+1))
  elif [ -n "$frescos" ]; then
    N_DRIFT=$((N_DRIFT+1))
    DRIFT="$DRIFT$id :: fila $fecha_fila · main tocó $frescos"$'\n'
  else
    N_VIEJA=$((N_VIEJA+1)); VIEJA="$VIEJA$id "
  fi
done < "$PLAN"

[ "$FILAS_TOTAL" -gt 0 ] || fatal "0 filas reconocidas en $PLAN. El parser no entendió el formato; no concluyas 'sin drift'."

if [ "$QUIET" = "0" ]; then
  echo "── PLAN-DRIFT · sujeto: origin/main @ ${BASE:0:8} · $PLAN"
  if [ -n "$DRIFT" ]; then
    echo
    echo "🟠 CANDIDATOS a drift — dicen \`pendiente\` y \`main\` tocó lo que citan DESPUÉS de escribirse la fila:"
    printf '%s' "$DRIFT" | sed 's/^/   /'
    echo "   ⚠️  Candidato ≠ cerrado. El veredicto es de la sesión: abrí el archivo y fijate si el cambio es el de la fila."
  fi
  [ -n "$VIEJA" ] && { echo; echo "⚪ PRESENCIA-VIEJA — citan artefactos que \`main\` NO tocó desde la fila: $VIEJA"; echo "   NO son candidatos: su presencia no informa nada sobre la fila."; }
  [ -n "$NOMED" ] && { echo; echo "⚪ NO-MEDIBLE por efecto — no citan ningún artefacto: $NOMED"; echo "   NO son 'coherentes': son filas que este control no puede juzgar."; }
fi

echo "── CONTROL: $EXAMINADAS de $FILAS_PEND filas \`pendiente\` examinadas (de $FILAS_TOTAL filas en total) · árbol de main: $TOTAL_ARCHIVOS archivos"
echo "── $N_DRIFT candidato(s) · $N_COHER coherente(s) · $N_VIEJA presencia-vieja · $N_NOMED no-medible(s)"

[ "$N_DRIFT" -gt 0 ] && exit 1
exit 0
