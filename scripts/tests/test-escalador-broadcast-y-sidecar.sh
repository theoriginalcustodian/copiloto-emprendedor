#!/usr/bin/env bash
# test-escalador-broadcast-y-sidecar.sh — dos defectos medidos el 2026-09-29, los dos del mismo tipo:
# un instrumento que no puede distinguir su sujeto.
#
# ── A) EL BROADCAST QUE NADIE PODÍA APAGAR ────────────────────────────────────────────────────
# `contrato_planificacion-a-todos_cierre-A-redeclarado` llevaba 429 min escalando y NINGUNA sesión
# podía sacarlo del radar: la Regla 1 mide «¿lo movieron a en-curso/?», y mover un `-a-todos_` lo
# borraría del `abierto/` de las otras tres. La única forma de obedecer al `urgente_` era romper el
# buzón. Encima el escalado salía dirigido a `todos`, o sea a nadie en particular.
#
# El costo no era el ruido: `vigilancia-check.sh` usa el exit 1 de este script para decidir si hay
# PARÁLISIS, así que mientras un broadcast escalara, el gate de parálisis de las cuatro sesiones
# sonaba por una causa irresoluble. Una alarma permanente es un instrumento apagado, no uno estricto
# — tercera reincidencia de esta forma en este mismo archivo (el watchdog #394/#400 y el ancla
# `^DISPARADOR:`). Por eso el caso 2 es el que importa: sin un control de que esto se PUEDE apagar,
# «escala bien» y «escala siempre» son indistinguibles.
#
# ── B) EL SIDECAR QUE COMPARTÍA NOMBRE CON EL MENSAJE ─────────────────────────────────────────
# El sidecar de `edad_alta_min` se guardaba con el nombre EXACTO del mensaje. Estaba protegido por
# UBICACIÓN (fuera de abierto/en-curso/cerrado) y eso protege a los escaneos que respetan el
# directorio — un `find -name '<pedido>.md'` recursivo no lo respeta y devolvía DOS hits. Un `>>` a
# la ruta equivocada no da ningún error: así se perdieron 33 líneas de una corrección de alcance del
# pedido BL-Q4 de FE2, que se cerró seis días después sin ellas. Ahora lleva sufijo `.first-seen`.
#
#   1. Broadcast `a-todos` sin reportes      → escala NOMINALMENTE a cada rol, nunca a `todos`
#   2. CONTROL DE APAGADO: todos reportaron  → exit 0, cero urgentes (el caso que faltaba)
#   3. Reporte PARCIAL                       → escala sólo a los mudos, no al que reportó
#   4. NO-REGRESIÓN: contrato a un rol real  → un solo urgente_, como siempre
#   5. El sidecar ya no lo alcanza un `find -name '*.md'` (con control positivo del propio find)
#   6. MIGRACIÓN: el sidecar legacy se mueve y la edad acumulada NO se reinicia
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
ESCALADOR="$REPO_ROOT/scripts/escaladores-buzon.sh"
# shellcheck source=../lib/buzon-roles.sh
. "$REPO_ROOT/scripts/lib/buzon-roles.sh"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

fallos=0
ok()   { printf '  ✅ %s\n' "$1"; }
fail() { printf '  ❌ %s\n' "$1"; fallos=$((fallos + 1)); }

HOY="$(date +%F)"

nuevo_buzon() {
  local d="$TMP/buzon-$1"
  rm -rf "$d"; mkdir -p "$d/abierto" "$d/en-curso" "$d/cerrado"
  printf '%s' "$d"
}

# El bloque cercado de ≥3 líneas no es decorativo: sin él, el lint de referencias alarma sobre el
# propio fixture y el exit 1 pasaría por un motivo ajeno al que se está probando.
cuerpo_fixture() {
  printf '# fixture\n\n```json\n{\n  "fixture": true,\n  "por_que": "que el lint no alarme sobre el propio test"\n}\n```\n'
}

contrato() {  # contrato <buzon> <destinatario> <slug> <minutos>
  local f="$1/abierto/2026-09-21_contrato_planificacion-a-$2_$3.md"
  cuerpo_fixture > "$f"
  touch -d "-$4 minutes" "$f"
  printf '%s' "$f"
}

reporte() {  # reporte <buzon> <frente> <minutos-de-antiguedad>
  local f="$1/abierto/${HOY}_avance_$2-a-planificacion_lo-que-hice.md"
  cuerpo_fixture > "$f"
  touch -d "-$3 minutes" "$f"
}

urgentes()     { ls -1 "$1/abierto/" 2>/dev/null | grep -c '_urgente_' || true; }
urgente_para() { ls -1 "$1/abierto/" 2>/dev/null | grep -c "_urgente_vigilancia-a-$2_" || true; }

out=""; rc=0
correr() {
  bash "$ESCALADOR" "$1" > "$TMP/salida.txt" 2>&1
  rc=$?
  out="$(cat "$TMP/salida.txt")"
}

# Los roles a los que DEBE escalar un `-a-todos_` de planificación: todos menos el emisor.
mapfile -t ESPERADOS < <(roles_de_broadcast todos planificacion)

echo "── Caso 1: broadcast a-todos sin ningún reporte → escala nominalmente"
B="$(nuevo_buzon 1)"
contrato "$B" todos cierre-A-redeclarado 200 >/dev/null
correr "$B"
[ "$rc" = "1" ] || fail "esperaba exit 1 (hay un contrato sin atender), dio $rc"
[ "$(urgente_para "$B" todos)" = "0" ] \
  && ok "NO escribió un urgente_ dirigido a 'todos' (que es dirigirlo a nadie)" \
  || fail "escaló a 'todos': el urgente_ sigue sin dueño"
falta=""
for r in "${ESPERADOS[@]}"; do
  [ "$(urgente_para "$B" "$r")" = "1" ] || falta="$falta $r"
done
[ -z "$falta" ] \
  && ok "un urgente_ nominal por cada rol que hereda el broadcast (${#ESPERADOS[@]}: ${ESPERADOS[*]})" \
  || fail "no escaló a:$falta"
grep -q "sin reporte posterior" <<<"$out" \
  && ok "stdout dice por qué escala (sin reporte posterior), no sólo que escala" \
  || fail "stdout no explica el criterio del broadcast"
# El emisor no se escala a sí mismo: planificación bajó el contrato, no lo está ignorando.
[ "$(urgente_para "$B" planificacion)" = "0" ] \
  && ok "el EMISOR no se escala a sí mismo" \
  || fail "escaló al emisor del propio contrato"

echo "── Caso 2: CONTROL DE APAGADO — todos reportaron después del contrato"
B="$(nuevo_buzon 2)"
contrato "$B" todos cierre-A-redeclarado 200 >/dev/null
for r in "${ESPERADOS[@]}"; do reporte "$B" "$r" 5; done
correr "$B"
[ "$rc" = "0" ] \
  && ok "exit 0: el broadcast SE PUEDE apagar reportando (lo que faltaba)" \
  || fail "sigue alarmando con todos los roles reportando: exit $rc — la alarma es inapagable"
[ "$(urgentes "$B")" = "0" ] \
  && ok "cero urgente_ en el buzón" \
  || fail "escribió $(urgentes "$B") urgente_ pese a que todos reportaron"
grep -q "BROADCAST ATENDIDO" <<<"$out" \
  && ok "lo dice explícito en stdout (no se calla sin explicar)" \
  || fail "se calló sin decir por qué"

echo "── Caso 3: reporte PARCIAL — sólo backend contestó"
B="$(nuevo_buzon 3)"
contrato "$B" todos cierre-A-redeclarado 200 >/dev/null
reporte "$B" backend 5
correr "$B"
[ "$rc" = "1" ] || fail "esperaba exit 1 (quedan mudos), dio $rc"
[ "$(urgente_para "$B" backend)" = "0" ] \
  && ok "NO le escala a backend, que sí reportó" \
  || fail "le escala a quien ya reportó: el reporte no sirve de nada"
mudos_ok=1
for r in "${ESPERADOS[@]}"; do
  [ "$r" = "backend" ] && continue
  [ "$(urgente_para "$B" "$r")" = "1" ] || mudos_ok=0
done
[ "$mudos_ok" = "1" ] \
  && ok "les escala a los otros $(( ${#ESPERADOS[@]} - 1 )) que siguen mudos" \
  || fail "dejó de escalarle a algún rol mudo"
grep -q "se toman moviendolos" "$B/abierto/"*_urgente_vigilancia-a-frontend1_* 2>/dev/null \
  && ok "el urgente_ explica que un broadcast NO se toma moviéndolo" \
  || fail "el urgente_ sigue dando la instrucción imposible"

echo "── Caso 4: NO-REGRESIÓN — contrato a un rol real se comporta igual que siempre"
B="$(nuevo_buzon 4)"
contrato "$B" backend K-07-algo 200 >/dev/null
correr "$B"
[ "$rc" = "1" ] || fail "esperaba exit 1, dio $rc"
[ "$(urgentes "$B")" = "1" ] && [ "$(urgente_para "$B" backend)" = "1" ] \
  && ok "un solo urgente_, dirigido a backend" \
  || fail "cambió el comportamiento del caso normal: $(urgentes "$B") urgente_"
grep -q "le toca a backend" <<<"$out" \
  && ok "stdout conserva la línea de siempre" \
  || fail "se perdió la línea de stdout del caso no-broadcast"
grep -q "se toman moviendolos" "$B/abierto/"*_urgente_ 2>/dev/null \
  && fail "le mete el párrafo de broadcast a un contrato que NO es broadcast" \
  || ok "CONTROL NEGATIVO: sin párrafo de broadcast donde no corresponde"

echo "── Caso 5: el sidecar ya no vive en el namespace de los mensajes"
B="$(nuevo_buzon 5)"
PED="$B/abierto/${HOY}_pedido_planificacion-a-frontend2_BL-Q4-variantes.md"
cuerpo_fixture > "$PED"
touch -d "-90 minutes" "$PED"
NOMBRE="${PED##*/}"
correr "$B"
[ -f "$B/.escalador-estado/$NOMBRE.first-seen" ] \
  && ok "el sidecar se llama <mensaje>.md.first-seen" \
  || fail "no apareció el sidecar con sufijo: $(ls -1 "$B/.escalador-estado" 2>/dev/null | tr '\n' ' ')"
hits="$(find "$B" -name "$NOMBRE" | wc -l)"
[ "$hits" = "1" ] \
  && ok "find -name '<mensaje>.md' devuelve 1 hit (era 2: el pedido y su sidecar)" \
  || fail "find devuelve $hits hits para el mismo nombre — el '>>' puede volver a caer en el sidecar"

echo "── Caso 6: MIGRACIÓN del sidecar legacy, sin reiniciar la medición"
B="$(nuevo_buzon 6)"
PED="$B/abierto/${HOY}_pedido_planificacion-a-backend_algo-viejo.md"
cuerpo_fixture > "$PED"
NOMBRE="${PED##*/}"
mkdir -p "$B/.escalador-estado"
# Un sidecar del formato viejo, con 200 min de edad acumulada. El mtime del pedido es de AHORA:
# si la migración se ignorara, la edad medida caería a ~0 y el escalador dejaría de ver un pedido
# que lleva 200 min — mentir hacia abajo, que es el modo que no se nota.
printf '%s\n' "$(( $(date +%s) - 200 * 60 ))" > "$B/.escalador-estado/$NOMBRE"
# CONTROL POSITIVO DEL PROPIO `find`: con el formato viejo TIENE que dar 2. Si diera 1 acá, el
# control del caso 5 no probaría nada — sería un find que no sabe mirar.
[ "$(find "$B" -name "$NOMBRE" | wc -l)" = "2" ] \
  && ok "control positivo: con el nombre viejo, find SÍ devuelve 2 hits" \
  || fail "el find del caso 5 no distingue nada: con el formato viejo ya daba 1"
correr "$B"
[ -f "$B/.escalador-estado/$NOMBRE.first-seen" ] && [ ! -f "$B/.escalador-estado/$NOMBRE" ] \
  && ok "migró por mv: queda el .first-seen y desaparece el legacy" \
  || fail "no migró (legacy presente: $([ -f "$B/.escalador-estado/$NOMBRE" ] && echo sí || echo no))"
# Con `if`, NO con `a || b && ok || fail`: en bash esa cadena se evalúa de izquierda a derecha y el
# `&&` se engancha al ÚLTIMO comando, así que un primer grep exitoso igual podía terminar en el
# `fail` — o peor, un grep fallido terminar en el `ok`. Un test con precedencia mal puesta es
# exactamente el falso verde que este archivo existe para cazar.
if grep -qE "(19[0-9]|20[0-9])min" <<<"$out"; then
  ok "la edad medida sigue siendo ~200min: la migración no reinició el contador"
else
  fail "la edad se reinició — el escalador pasó a mentir hacia abajo: $(grep -oE '[0-9]+min' <<<"$out" | tr '\n' ' ')"
fi

echo
if [ "$fallos" = "0" ]; then
  echo "✅ TODO VERDE — broadcast apagable + sidecar fuera del namespace de los mensajes"
  exit 0
fi
echo "❌ $fallos fallo(s)"
exit 1
