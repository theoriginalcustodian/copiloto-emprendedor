#!/usr/bin/env bash
# archivar-buzon.sh — Janitor determinista del buzón de coordinación.
#
# CAUSA RAÍZ que resuelve: archivar mensajes consumidos dependía de que una sesión
# "se acordara" de moverlos a cerrado/. Bajo presión de sprint eso siempre falla y
# abierto/ se apila (llegó a 136 el 2026-07-23). Peor: las difusiones `-a-todos_` no
# tienen condición de cierre (nadie las acusa) → nunca se auto-archivaban.
#
# ESTE SCRIPT reemplaza la disciplina por una regla determinista, ejecutada por el
# dueño del estado (PLANIFICACIÓN) en cada ciclo de su cadencia de monitor. Idempotente.
#
# CICLO DE VIDA (qué vive en abierto/, qué se archiva):
#   OBLIGACIONES abiertas  → contrato_ · pedido_ · urgente_   → NUNCA se auto-archivan.
#                            Se cierran a mano cuando su trabajo/incidente se resuelve
#                            (mv a cerrado/, o un `cierre_`/`listo_` del hilo lo salda).
#   TRÁFICO FRESCO         → cualquier archivo mtime < TTL      → se queda (hilo en curso).
#   HISTORIA               → todo lo demás (dato_/avance_/listo_/hallazgo_/respuesta_/
#                            correccion_/cierre_/addendum_/regla_ más viejo que el TTL)
#                            → se archiva a cerrado/<fecha-del-nombre>/.
#
# coordinacion/ es gitignored → mover NO toca git, es `mv` puro. Cero riesgo de race.
#
# Uso:
#   scripts/archivar-buzon.sh              # archiva (default TTL 90 min)
#   scripts/archivar-buzon.sh --dry-run    # muestra qué haría, sin mover
#   TTL_MIN=120 scripts/archivar-buzon.sh  # override del TTL en minutos
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUZON="$REPO_ROOT/coordinacion"
ABIERTO="$BUZON/abierto"
CERRADO="$BUZON/cerrado"
TTL_MIN="${TTL_MIN:-90}"
DRY_RUN=0
[ "${1:-}" = "--dry-run" ] && DRY_RUN=1

# Obligaciones que jamás se auto-archivan (se cierran a mano al resolverse).
OBLIGACIONES='^[0-9-]+_(contrato|pedido|urgente)_'

[ -d "$ABIERTO" ] || { echo "No existe $ABIERTO"; exit 0; }

moved=0; kept_obl=0; kept_fresh=0
shopt -s nullglob
for f in "$ABIERTO"/*.md; do
  b="$(basename "$f")"

  # 1) Obligación abierta → se queda (cierre manual).
  if echo "$b" | grep -qE "$OBLIGACIONES"; then
    kept_obl=$((kept_obl+1)); continue
  fi

  # 2) Tráfico fresco (dentro del TTL) → se queda (hilo en curso).
  if [ -n "$(find "$f" -mmin "-$TTL_MIN" 2>/dev/null)" ]; then
    kept_fresh=$((kept_fresh+1)); continue
  fi

  # 3) Historia → archivar a cerrado/<fecha-del-nombre>/ (fallback: hoy por mtime).
  d="$(echo "$b" | grep -oE '^[0-9]{4}-[0-9]{2}-[0-9]{2}' || true)"
  [ -n "$d" ] || d="$(date -r "$f" '+%Y-%m-%d' 2>/dev/null || date '+%Y-%m-%d')"
  if [ "$DRY_RUN" = "1" ]; then
    echo "ARCHIVARÍA → cerrado/$d/  $b"
  else
    mkdir -p "$CERRADO/$d"
    mv "$f" "$CERRADO/$d/"
  fi
  moved=$((moved+1))
done

abiertos_md=("$ABIERTO"/*.md)
abiertos_ahora=${#abiertos_md[@]}
if [ "$DRY_RUN" = "1" ]; then
  echo "[dry-run] archivaría $moved · obligaciones $kept_obl · frescos $kept_fresh · TTL ${TTL_MIN}min"
else
  echo "archivados $moved · abiertos ahora $abiertos_ahora (obligaciones $kept_obl + frescos $kept_fresh) · TTL ${TTL_MIN}min"
fi
