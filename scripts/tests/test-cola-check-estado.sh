#!/usr/bin/env bash
# test-cola-check-estado.sh — cola-check.sh lee el estado del ÚLTIMO campo y no traga enums pisados.
#
# Los dos fallos reales del 2026-09-22, ambos silenciosos, ambos con el mismo veredicto erróneo
# («NADA arrancando» con un frente vivo → el monitor mandaba a arrancar los interruptores del operador):
#   · OLA3 llevaba `arrancando` desde las 02:40 en un renglón de 5 campos: `read id nombre disp estado`
#     dejaba estado = «narrativa|arrancando» y el hito era invisible.
#   · una edición de A4ARR appendeó texto al final del renglón y borró su enum.
#
#   1. POSITIVO  5 campos terminados en `arrancando` -> se ve como frente activo (caso OLA3).
#                Sin el 1, los negativos pasarían igual si el script no viera NADA nunca.
#   2. POSITIVO  4 campos terminados en `arrancando` -> sigue andando (no se rompió el caso simple).
#   3. NEGATIVO  enum pisado por narrativa al final -> MALFORMADO nombrando el id (caso A4ARR).
#   4. NEGATIVO  nada arrancando + un `pendiente` -> grita arrancable-sin-arrancar con su disparador.
#   5. NEGATIVO  `✅ cerrada …` / `❌ entregada …` -> ni cabeza de cola ni malformado.
#   6. CONTROL   el parseo viejo (4 variables) NO ve el caso 1: prueba que el test cazaría la regresión.
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SCRIPT="$ROOT/scripts/cola-check.sh"
fallos=0
ok()   { printf '  ✅ %s\n' "$1"; }
fail() { printf '  ❌ %s\n' "$1"; fallos=$((fallos + 1)); }
echo "test-cola-check-estado"

T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
plan() {  # plan <archivo> <fila>...
  local f="$1"; shift
  { echo '<!-- COLA-VIVA:INICIO -->'; echo '```'; printf '%s\n' "$@"; echo '```'
    echo '<!-- COLA-VIVA:FIN -->'; } > "$f"
}
correr() { COLA_PLAN="$1" bash "$SCRIPT" 2>&1; }

# 1 — el renglón de OLA3: la narrativa trae `|` y el enum queda al final del 5.º campo.
plan "$T/1.md" 'OLA3 | Ola 3 | reabierta 02:40 | v1 vs v2, ninguna cierra | arrancando' \
                'CIERREB | Cierre B | interruptores del operador | pendiente'
out="$(correr "$T/1.md")"
grep -q 'arrancando OLA3' <<< "$out" && ! grep -q 'NADA arrancando' <<< "$out" \
  && ok "1 5 campos -> ve OLA3 arrancando (no dispara la falsa alarma)" \
  || fail "1 no vio OLA3: $(head -1 <<< "$out" | cut -c1-70)"

# 2
plan "$T/2.md" 'A4ARR | Arreglos A4 | AUD4 entregada | arrancando'
out="$(correr "$T/2.md")"
grep -q 'arrancando A4ARR' <<< "$out" && ok "2 4 campos -> sigue viendo el caso simple" \
  || fail "2 rompió el caso de 4 campos: $(head -1 <<< "$out" | cut -c1-70)"

# 3 — enum pisado: el renglón termina en narrativa, no en el enum.
plan "$T/3.md" 'A4ARR | Arreglos A4 | AUD4 entregada | backend 6/6 cerradas y FE2 5/5, falta FE1' \
                'CIERREB | Cierre B | interruptores | pendiente'
out="$(correr "$T/3.md")"
grep -q 'estado no reconocido en: A4ARR' <<< "$out" \
  && ok "3 enum pisado -> MALFORMADO nombrando A4ARR" \
  || fail "3 tragó el enum pisado: $(head -1 <<< "$out" | cut -c1-70)"

# 4
plan "$T/4.md" 'CIERREB | Cierre B | interruptores del operador | pendiente'
out="$(correr "$T/4.md")"
grep -q 'NADA arrancando y el hito CIERREB' <<< "$out" && grep -q 'interruptores del operador' <<< "$out" \
  && ok "4 sólo pendientes -> grita arrancable con su disparador" \
  || fail "4 no gritó el arrancable: $(head -1 <<< "$out" | cut -c1-70)"

# 5
plan "$T/5.md" 'OLA3 | Ola 3 | a3 | ✅ cerrada 2026-09-21' \
                'AUD4 | Auditoría | a4 | ❌ entregada 11:54Z (#641) · veredicto: no cierra' \
                'A4ARR | Arreglos | AUD4 | arrancando'
out="$(correr "$T/5.md")"
! grep -q 'no reconocido' <<< "$out" && ! grep -q 'NADA arrancando' <<< "$out" \
  && ok "5 ✅/❌ -> ni cabeza de cola ni malformado" \
  || fail "5 clasificó mal un hito cerrado: $(head -1 <<< "$out" | cut -c1-70)"

# 6 — control: el parseo VIEJO sobre el caso 1 deja estado = «…|arrancando» y no lo reconoce.
viejo="$(while IFS='|' read -r id nombre disp estado; do
           e=$(echo "$estado" | tr -d ' ' | tr '[:upper:]' '[:lower:]')
           [ "$e" = "arrancando" ] && echo "VE:$id"
         done <<< 'OLA3 | Ola 3 | reabierta | v1 vs v2 | arrancando')"
[ -z "$viejo" ] && ok "6 control: el parseo viejo NO veía OLA3 (la regresión sería visible)" \
  || fail "6 el parseo viejo ya lo veía -> el test 1 no prueba nada"

[ "$fallos" -eq 0 ] && echo "  OK" || { echo "  $fallos fallo(s)"; exit 1; }
