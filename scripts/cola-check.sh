#!/usr/bin/env bash
# cola-check.sh — Chequeo determinista de la cola de hitos (anti "fábrica parada en silencio").
#
# CAUSA RAÍZ que resuelve: el 2026-07-23 la fábrica quedó ~4 h ociosa. narra (precondición
# de los hitos 7/8/9) cerró verde a las 18:46 y el hito 7 quedó con su disparador cumplido,
# pero NADIE lo arrancó: planificación clasificó el ocio como "esperando decisión de scope"
# y lo reportó 40 veces sin correr nunca el control (leer los disparadores del PLAN).
# Arrancar el próximo hito de una cola YA acordada y contratada es EJECUCIÓN, no una
# decisión MAYOR — tratarlo como decisión frena la fábrica esperando un "dale" que no hace falta.
#
# ESTE SCRIPT reemplaza esa clasificación-a-mano por una regla determinista. Lee el bloque
# COLA-VIVA del PLAN (sólo los hitos que FALTAN, sin ruido histórico) y:
#   - si hay un hito `arrancando`   → hay frente activo (el idle-monitor mide si avanza);
#   - si NADA arranca y hay `pendiente` → grita "arrancable sin arrancar" con su disparador,
#     para que planificación corra el control y lo arranque (ejecución, NO scope).
# Corrido por PLANIFICACIÓN (dueña de la cola) en cada ciclo de monitor, junto al janitor.
#
# El bloque vive entre  <!-- COLA-VIVA:INICIO -->  y  <!-- COLA-VIVA:FIN -->  en PLAN.md,
# una línea por hito:   id | nombre | disparador | estado(pendiente|arrancando)
# Cuando un hito cierra, planificación borra su línea y pasa el siguiente a `arrancando`.
#
# Uso:  scripts/cola-check.sh            # imprime el estado de la cola
#       scripts/cola-check.sh --quiet    # sólo imprime si hay un arrancable sin arrancar (para crones)
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PLAN="$REPO_ROOT/coordinacion/PLAN.md"
QUIET=0
[ "${1:-}" = "--quiet" ] && QUIET=1
[ -f "$PLAN" ] || { echo "No existe $PLAN"; exit 0; }

# Extraer sólo las líneas del bloque COLA-VIVA (entre los marcadores, sin las fences ```).
bloque="$(awk '/COLA-VIVA:INICIO/{on=1;next} /COLA-VIVA:FIN/{on=0} on' "$PLAN" \
          | grep -vE '^\s*```' | grep -E '\|')"

if [ -z "$bloque" ]; then
  echo "⚠️  COLA: no encuentro el bloque COLA-VIVA en PLAN.md (¿marcadores movidos?). Verificá a mano."
  exit 0
fi

arrancando=""; head_id=""; head_nombre=""; head_disp=""
while IFS='|' read -r id nombre disp estado; do
  id=$(echo "$id" | tr -d ' '); [ -z "$id" ] && continue
  nombre=$(echo "$nombre" | sed -E 's/^ +| +$//g')
  disp=$(echo "$disp"     | sed -E 's/^ +| +$//g')
  estado=$(echo "$estado" | tr -d ' ' | tr '[:upper:]' '[:lower:]')
  if [ "$estado" = "arrancando" ]; then
    arrancando="$id ($nombre)"
  elif [ "$estado" = "pendiente" ] && [ -z "$head_id" ]; then   # primer PENDIENTE = cabeza de la cola
    head_id="$id"; head_nombre="$nombre"; head_disp="$disp"
  fi
  # estados que NO son cabeza de cola: done (✅…), bloqueado, o cualquier otro texto libre —
  # sólo "pendiente" literal es arrancable-sin-arrancar; el resto ya tiene su propio seguimiento.
done <<< "$bloque"

# ── Veredicto ────────────────────────────────────────────────────────────────
if [ -n "$arrancando" ]; then
  [ "$QUIET" = "1" ] && exit 0
  echo "COLA: 🔥 arrancando $arrancando · siguiente: ${head_id:-— (cola casi vacía)}${head_nombre:+ ($head_nombre)}"
  exit 0
fi

if [ -n "$head_id" ]; then
  # NADA arrancando + hay pendiente = EXACTAMENTE el patrón del freno de 4 h.
  echo "⚠️  COLA: NADA arrancando y el hito $head_id está PENDIENTE — «$head_nombre»"
  echo "    disparador declarado: $head_disp"
  echo "    → CORRÉ EL CONTROL: ¿el disparador está cumplido? Si sí, ARRANCALO YA (es ejecución de"
  echo "      una cola acordada, NO una decisión de scope). No lo reportes como «operator-side»."
  exit 0
fi

[ "$QUIET" = "1" ] && exit 0
echo "COLA: ✅ vacía — no quedan hitos pendientes en COLA-VIVA."
