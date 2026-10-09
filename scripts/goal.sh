#!/usr/bin/env bash
# GOAL — la orden de trabajo activa de esta sesión, en UN archivo de tres líneas.
#
# Por qué existe (forense 2026-10-08, docs/.../Auditorias/2026-10-08-forense-desvio-de-scope-*.md):
# había 17 gates midiendo CALIDAD y ninguno PERTINENCIA. Resultado medido: 64 PRs en un día,
# 4 citando un id del backlog firmado, con 113 ids disponibles sin tomar. El fallo NO fue
# ignorancia de la cola (los ids se citaban de pasada): fue que nada comparaba el trabajo
# contra UNA orden declarada. Por eso esto no es un recordatorio — es un ancla:
#   · `set` sólo acepta un id que EXISTE en el padrón (fail-closed, nada de goals inventados)
#   · el DoD sale del doc, no de mi resumen: el criterio de cierre no lo escribo yo
#   · el hook lo inyecta en cada turno (1 línea) y `atribucion.sh` compara los commits contra él
#
# Un cron que "me obligue a leer el plan" fue descartado con medición: el día del desvío los
# crones estaban PRENDIDOS inyectando turnos. Repetir texto protege del olvido, no de la
# racionalización (2026-07-24: dos reglas violadas horas después de canonizarse, en contexto).
#
# Uso:  goal.sh set <ID> [nota]   ·   goal.sh show   ·   goal.sh clear   ·   goal.sh ids
set -uo pipefail

RAIZ="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
# Misma regla que el gate: la lib se resuelve al lado de ESTE script (así el test puede
# ejercitarlo contra un repo sintético), y $RAIZ es el repo medido.
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/ci/lib-padron.sh"
GOAL="$RAIZ/.goal"

leer() { [ -f "$GOAL" ] && cat "$GOAL" || return 1; }
campo() { leer | grep -E "^$1=" | head -1 | cut -d= -f2-; }

case "${1:-show}" in
  set)
    ID="${2:-}"
    [ -n "$ID" ] || { echo "uso: goal.sh set <ID> [nota]"; exit 2; }
    ID="$(printf '%s' "$ID" | tr '[:lower:]' '[:upper:]')"
    donde="$(padron_donde "$ID" "$RAIZ" || true)"
    if [ -z "$donde" ]; then
      echo "⛔ '$ID' NO está en el padrón de ids autorizados — no lo tomo."
      echo "   El padrón son los docs versionados de backlog/acta/ARRANQUE (working tree + origin/main)."
      echo "   Un goal que yo me invento no es una orden de trabajo. Candidatos parecidos:"
      padron_ids "$RAIZ" | grep -iE "^${ID%%[0-9]*}" | head -8 | sed 's/^/     /'
      exit 1
    fi
    fuente="${donde%%|*}"; fila="${donde#*|}"
    { echo "id=$ID"
      echo "fuente=$fuente"
      echo "dod=$(printf '%s' "$fila" | tr '\n' ' ' | cut -c1-400)"
      [ -n "${3:-}" ] && echo "nota=$3"
      echo "desde=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    } > "$GOAL.tmp" && mv -f "$GOAL.tmp" "$GOAL"
    echo "🎯 GOAL = $ID   ($fuente)"
    echo "   DoD: $(campo dod | cut -c1-200)"
    echo "   Todo commit de esta sesión cita $ID o declara 'ATRIBUCION: libre — <motivo>'."
    ;;
  show)
    leer >/dev/null 2>&1 || { echo "(sin goal activo — goal.sh set <ID>)"; exit 0; }
    echo "🎯 GOAL $(campo id) · desde $(campo desde) · $(campo fuente)"
    echo "   DoD: $(campo dod | cut -c1-240)"
    [ -n "$(campo nota)" ] && echo "   nota: $(campo nota)"
    ;;
  id)    campo id ;;
  clear) rm -f "$GOAL" && echo "🎯 goal limpiado (cola vacía: cerrar con el estado ES el cierre — CANON 8a)" ;;
  ids)   padron_ids "$RAIZ" ;;
  *)     echo "uso: goal.sh {set <ID> [nota]|show|id|clear|ids}"; exit 2 ;;
esac
