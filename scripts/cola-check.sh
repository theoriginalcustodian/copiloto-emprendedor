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
# COLA_PLAN: el PLAN del buzón que se vigila. Sin él, corrido desde un worktree (donde
# `coordinacion/` no existe: es carpeta física única, no versionada) gritaba «No existe PLAN.md»
# en CADA ciclo y el vigilante daba exit 1 permanente: una alarma fija tapa las reales (21/09).
PLAN="${COLA_PLAN:-$REPO_ROOT/coordinacion/PLAN.md}"
QUIET=0
[ "${1:-}" = "--quiet" ] && QUIET=1

# NO PUEDO VER MI SUJETO ≠ LA COLA ESTÁ EN ORDEN. Acá había un `exit 0`: este script —que existe
# para cazar una fábrica parada en silencio— se paraba en silencio él mismo cuando no encontraba el
# PLAN. Peor, el vigilante lo componía detrás de un `if [ -f "$BUZON/PLAN.md" ]`, así que desde
# cualquier worktree la dimensión COLA no se medía Y no se decía. El fix del 21/09 (no gritar en
# cada ciclo) NO se revierte: sigue en pie por su causa raíz, que era otra — el vigilante ahora
# RESUELVE el buzón físico desde cualquier worktree, así que este camino sólo se toma cuando de
# verdad no hay PLAN que leer. Y entonces hay que enterarse, no que lo tape un rc=0.
if [ ! -f "$PLAN" ]; then
  echo "❌ COLA: no puedo ver mi sujeto — no existe $PLAN"
  echo "    Esto NO es «cola en orden»: es «no medí nada». 'coordinacion/' no está versionada y"
  echo "    existe UNA sola vez (el checkout principal). Apuntala: COLA_PLAN=<ruta>/PLAN.md"
  exit 2
fi

# `|| true` NO es cosmético: con `set -euo pipefail` (línea 24) un `grep` sin match mata el
# script ACÁ, y el guard de abajo —escrito justo para «marcadores movidos»— era CÓDIGO
# INALCANZABLE: su `echo` nunca se imprimió. El síntoma era un exit 1 MUDO que el vigilante
# mezcla con una alarma real. Medido con control positivo el 2026-09-28.
# Extraer sólo las líneas del bloque COLA-VIVA (entre los marcadores, sin las fences ```).
bloque="$(awk '/COLA-VIVA:INICIO/{on=1;next} /COLA-VIVA:FIN/{on=0} on' "$PLAN" \
          | grep -vE '^\s*```' | grep -E '\|' || true)"

if [ -z "$bloque" ]; then
  echo "⚠️  COLA: no encuentro el bloque COLA-VIVA en PLAN.md (¿marcadores movidos?). Verificá a mano."
  exit 0
fi

arrancando=""; head_id=""; head_nombre=""; head_disp=""; malformados=""; bloqueados=""
while IFS= read -r linea; do
  id=$(echo "${linea%%|*}" | tr -d ' ')
  # Un `continue` mudo acá borraba la fila entera: una línea escrita como tabla markdown (con `|`
  # inicial) deja el id vacío y se descartaba EN SILENCIO — la cola salía «✅ vacía» con hitos
  # vivos adentro. Medido el 2026-09-28 con un fixture en formato tabla: 5 filas, 0 leídas, exit 0.
  if [ -z "$id" ]; then malformados="$malformados <id-vacio:${linea:0:24}…>"; continue; fi
  resto="${linea#*|}"
  nombre=$(echo "${resto%%|*}" | sed -E 's/^ +| +$//g')
  # El estado es el ÚLTIMO campo, no el 4.º: la narrativa de un hito lleva `|` adentro (tablas,
  # alternativas), así que `read id nombre disp estado` le metía «…|arrancando» a $estado y el
  # hito quedaba INVISIBLE. Pasó dos veces el 2026-09-22: OLA3 estaba `arrancando` desde las 02:40
  # y la cola no lo veía, y una edición de A4ARR que appendeó texto al final del renglón borró su
  # enum. En ambos casos el veredicto fue «NADA arrancando» y el monitor mandaba a arrancar el
  # hito siguiente —los interruptores del operador— con un frente vivo. Silencioso las dos veces.
  estado=$(echo "${linea##*|}" | tr -d ' ' | tr '[:upper:]' '[:lower:]')
  # El disparador es lo que queda entre el nombre y el estado (puede traer `|`).
  disp=$(echo "$resto" | sed -E 's/^[^|]*\|//; s/\|[^|]*$//; s/^ +| +$//g')
  case "$estado" in
    arrancando) arrancando="$id ($nombre)" ;;
    pendiente)  [ -z "$head_id" ] && { head_id="$id"; head_nombre="$nombre"; head_disp="$disp"; } ;;  # primer PENDIENTE = cabeza
    ✅*|❌*)     : ;;  # cerrado / entregado: tiene su propio seguimiento, no es cabeza de cola
    # ⏳ = hecho pero trabado por un disparador EXTERNO a la cola (hoy: el push del grafo, que
    # sólo el operador destraba). No es `pendiente` — nadie tiene que arrancarlo— ni ✅ — no cerró.
    # Sin este caso la fila caía en `malformados` y el warning se volvía rutina: dos sesiones lo
    # reportaron el 2026-09-28 en sus ticks, y un guard que grita en el caso normal se desarma solo.
    ⏳*)         bloqueados="$bloqueados $id" ;;
    # Cualquier otra cosa NO se traga en silencio: un enum pisado es indistinguible de un hito
    # legítimamente cerrado, y el precio de confundirlos es no ver un frente activo.
    *)          malformados="$malformados $id" ;;
  esac
done <<< "$bloque"

if [ -n "$bloqueados" ]; then
  echo "⏳ COLA: bloqueados por disparador externo:$bloqueados — hechos, sin poder avanzar. No son"
  echo "    cabeza de cola ni cierres: no los re-asignes ni los cuentes como pendientes."
fi

if [ -n "$malformados" ]; then
  echo "⚠️  COLA: estado no reconocido en:$malformados — el último campo del renglón debe ser"
  echo "    exactamente 'pendiente', 'arrancando', '⏳ …' o empezar con ✅/❌. Un hito así es INVISIBLE"
  echo "    para la cola: arreglá el renglón antes de creerle al veredicto de abajo."
fi

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
