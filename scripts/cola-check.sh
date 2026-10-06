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

arrancando=""; n_arrancando=0; head_id=""; head_nombre=""; head_disp=""; malformados=""; bloqueados=""
  # El estado es el ÚLTIMO campo, no el 4.º: la narrativa de un hito lleva `|` adentro (tablas,
  # alternativas), así que `read id nombre disp estado` le metía «…|arrancando» a $estado y el
  # hito quedaba INVISIBLE. Pasó dos veces el 2026-09-22: OLA3 estaba `arrancando` desde las 02:40
  # y la cola no lo veía, y una edición de A4ARR que appendeó texto al final del renglón borró su
  # enum. En ambos casos el veredicto fue «NADA arrancando» y el monitor mandaba a arrancar el
  # hito siguiente —los interruptores del operador— con un frente vivo. Silencioso las dos veces.
# 2026-10-06: y «el último campo» no alcanzó tampoco. Las notas que las sesiones appendean van
# entre 【…】 y se escriben DESPUÉS del enum — en el mismo campo, o abriendo campos nuevos
# cuando la nota trae `|` adentro. PLATCONV («arrancando 【✂️…】») y PLANTRUNCADO
# («pendiente 【🔴…】», 6 campos) salían malformados con el enum INTACTO. Por eso la
# nota se recorta ANTES de partir en campos. Medido sobre los 153 renglones del tablero: 4
# malformados → 2 (los 2 que quedan son DATOS, no notación) y cero regresiones entre los 149
# que ya se leían bien.
#
  # El disparador es lo que queda entre el nombre y el estado (puede traer `|`).
#
# El separador del normalizado es US (0x1f) y NO un tab: con `IFS=$'\t'`, `read` COLAPSA los
# tabs consecutivos porque el tab es whitespace de IFS, así que un campo vacío desaparece y
# todos los siguientes corren un lugar. Medido el 2026-10-06 con el instrumento real: los 9
# renglones de 3 campos —disparador vacío: BLQ2, FACTID, LEGAL, X10, BLQ4, B1, MIDIA, CIVERDE3,
# ALFACAN— le metían el PREFIJO del renglón a $estado y salían como 9 FALSOS malformados. US no
# es whitespace de IFS. (La simulación en awk no podía verlo: modelaba la regla de parseo, no el
# transporte — reprodujo la línea base al dígito y dijo «0 regresiones».)
SEP=$'\x1f'
# UNA sola pasada de awk normaliza el bloque a `id↹nombre↹disparador↹estado↹prefijo`. Antes la
# extracción eran ~4 subshells por renglón y el script tardaba 28,9 s MEDIDOS con 153 renglones;
# lo corren DOS crones cada 3 min, así que el gate determinista de cada tick pagaba esos 29 s
# antes de poder decidir nada. El bloque no tiene US ni tabs (verificado).
norm="$(printf '%s\n' "$bloque" | awk -v S="$SEP" '
  function quitar_notas(s,  a, b) {
    # index/substr y NO una clase negada `[^】]*`: en byte-mode esa clase son los 3 BYTES
    # de 】 (E3 80 91), así que cualquier otro carácter CJK dentro de la nota —【 incluido—
    # la cortaría por la mitad y el recorte fallaría justo en la nota anidada.
    while (1) {
      a = index(s, "【"); if (a == 0) break
      b = index(substr(s, a), "】"); if (b == 0) break   # nota sin cerrar: NO se recorta
      s = substr(s, 1, a - 1) substr(s, a + b + length("】") - 1)
    }
    return s
  }
  function trim(s) { sub(/^[ \t]+/, "", s); sub(/[ \t]+$/, "", s); return s }
  {
    n = split($0, f, "|")
    id = f[1]; gsub(/[ \t]/, "", id)
    disp = ""
    for (i = 3; i < n; i++) disp = disp (disp == "" ? "" : "|") f[i]
    m = split(quitar_notas($0), g, "|")
    estado = tolower(g[m]); gsub(/[ \t]/, "", estado)
    print id S trim(f[2]) S trim(disp) S estado S substr($0, 1, 24)
  }')"
# Si el awk perdiera o duplicara renglones, el veredicto sería sobre un tablero que NO es el del
# archivo — y saldría con la misma cara de siempre. Se verifica antes de creerle.
n_bloque=$(printf '%s\n' "$bloque" | grep -c .)
n_norm=$(printf '%s\n' "$norm" | grep -c .)
if [ "$n_bloque" -ne "$n_norm" ]; then
  echo "❌ COLA: la normalización leyó $n_norm renglones y el bloque tiene $n_bloque — no mido"
  echo "    sobre un tablero que no es el del archivo. Revisá scripts/cola-check.sh."
  exit 2
fi
while IFS="$SEP" read -r id nombre disp estado prefijo; do
  # Un `continue` mudo acá borraba la fila entera: una línea escrita como tabla markdown (con `|`
  # inicial) deja el id vacío y se descartaba EN SILENCIO — la cola salía «✅ vacía» con hitos
  # vivos adentro. Medido el 2026-09-28 con un fixture en formato tabla: 5 filas, 0 leídas, exit 0.
  if [ -z "$id" ]; then malformados="$malformados <id-vacio:${prefijo}…>"; continue; fi
  case "$estado" in
    # ACUMULA, no sobreescribe: con 3-4 sesiones en paralelo hay varios frentes activos a la vez, y
    # un `arrancando="$id"` reportaba SÓLO EL ÚLTIMO del archivo — el resto quedaba invisible aunque
    # el enum estuviera perfecto. Medido el 2026-09-28: B1 (auditoría) desapareció del veredicto al
    # insertar Q3R debajo. Un frente activo que no se ve es exactamente lo que este script existe
    # para cazar.
    arrancando) arrancando="${arrancando:+$arrancando · }$id ($nombre)"; n_arrancando=$((n_arrancando+1)) ;;
    pendiente)  [ -z "$head_id" ] && { head_id="$id"; head_nombre="$nombre"; head_disp="$disp"; } ;;  # primer PENDIENTE = cabeza
    ✅*|❌*)     : ;;  # cerrado / entregado: tiene su propio seguimiento, no es cabeza de cola
    # CONGELADO es un cuarto estado REAL, no un renglon roto: el operador congelo los
    # instrumentos el 2026-10-05 y esos hitos no hay que arrancarlos (no son `pendiente`) ni
    # estan hechos (no son ✅/❌). Sin esta rama, 31 renglones salian como "estado no
    # reconocido" en CADA corrida del monitor -- un warning permanente que ensena a ignorar
    # el warning, que es justo lo que despues tapa un enum de verdad pisado.
    ⏸*)         : ;;  # congelado / diferido con condicion de entrada declarada
    # ⏳ = trabado por un disparador EXTERNO a la cola — el criterio es «nadie de las sesiones
    # puede moverlo», NO «ya está hecho». Dos instancias, y la segunda ensanchó la definición:
    #   · el push del grafo (hecho, esperando al operador) — el caso original, 2026-09-28;
    #   · CIERREB (2026-10-06): NO está hecho y aun así nadie puede arrancarlo, porque los 4
    #     interruptores que faltan son acciones del operador. Estaba marcado `arrancando`, así que
    #     este script la reportaba como frente ACTIVO y cabeza de cola: mandaba a las 3 sesiones a
    #     lo único que no podían tomar, mientras su propio cuerpo decía «no lo listen como bloqueo
    #     propio». El enum y la prosa se contradecían y el instrumento lee el enum.
    # Test de categoría: ⏳ si el disparador es de alguien FUERA de las sesiones; `pendiente` si
    # alguna puede empezar hoy. «Hecho o no» no entra en la decisión.
    # No es `pendiente` — nadie tiene que arrancarlo— ni ✅ — no cerró.
    # Sin este caso la fila caía en `malformados` y el warning se volvía rutina: dos sesiones lo
    # reportaron el 2026-09-28 en sus ticks, y un guard que grita en el caso normal se desarma solo.
    ⏳*)         bloqueados="$bloqueados $id" ;;
    # Una NORMA no es un hito: no tiene estado terminal porque nadie la TERMINA — rige hasta que
    # se derogue. CONGELAINSTR («🚦 regla vigente», dueno «operador (alcance) +
    # planificación (ejecución)») vive en el tablero porque lo que no está en la tabla no existe,
    # y salía malformado en CADA corrida. Test de categoría antes de usar este estado: si alguien
    # puede CERRARLA, no es una norma — es un hito, y le toca un enum de verdad.
    🚦*)         : ;;  # norma vigente: no es trabajo, no es cabeza de cola, no se cierra
    # Cualquier otra cosa NO se traga en silencio: un enum pisado es indistinguible de un hito
    # legítimamente cerrado, y el precio de confundirlos es no ver un frente activo.
    *)          malformados="$malformados $id" ;;
  esac
done <<< "$norm"

if [ -n "$bloqueados" ]; then
  echo "⏳ COLA: bloqueados por disparador externo:$bloqueados — nadie de las sesiones puede"
  echo "    moverlos (el disparador es de afuera). Pueden estar hechos o ni empezados: eso no decide."
  echo "    NO son cabeza de cola ni cierres: no los re-asignes ni los cuentes como pendientes."
fi

if [ -n "$malformados" ]; then
  echo "⚠️  COLA: estado no reconocido en:$malformados — el último campo del renglón debe ser"
  echo "    exactamente 'pendiente', 'arrancando', '⏳ …', '⏸ …', '🚦 …' o empezar con ✅/❌ — una"
  echo "    nota entre 【…】 DESPUÉS del enum sí se tolera. Un hito así es INVISIBLE"
  echo "    para la cola: arreglá el renglón antes de creerle al veredicto de abajo."
fi

# ── Veredicto ────────────────────────────────────────────────────────────────
if [ -n "$arrancando" ]; then
  [ "$QUIET" = "1" ] && exit 0
  [ "$n_arrancando" -gt 1 ] && echo "COLA: 🔥 $n_arrancando frentes activos en paralelo"
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
