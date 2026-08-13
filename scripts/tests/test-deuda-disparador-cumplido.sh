#!/usr/bin/env bash
# test-deuda-disparador-cumplido.sh — el registro tiene que gritar cuando el disparador se cumple.
#
# Qué se ejercita (caso real del 2026-08-12): D7 —el 5º `except` mudo de D-A— se difirió a
# «junto con D-A del lote B» y luego a «lote C». Los dos lotes cerraron el mismo día, 15:40 y
# 18:12, y el ítem no se movió: un disparador escrito en prosa no avisa cuando se cumple. Backend
# cerró su ciclo declarando cola vacía de buena fe (abierto/ y en-curso/ SÍ estaban vacíos) y
# G2/G3/G8 quedaron abiertos por un fix de dos líneas que nadie sabía que estaba pendiente.
#
# El caso 2 es el que evita que este instrumento se autodestruya: una fila YA TOMADA no puede
# alarmar cada 3 min. Ese es el fallo que el watchdog de coordinación ya pagó (#394/#400) — una
# alarma que suena siempre enseña a saltearla, y entonces no queda alarma.
# El caso 5 es el que protege el juicio: un disparador en lenguaje natural NUNCA se da por
# cumplido, porque interpretarlo sería un instrumento que confirma en vez de verificar.
# El caso 6 es fail-loud: registro ilegible ≠ registro vacío.
#
#   1. CONTROL POSITIVO — fila `abierto` con `@dep` cerrado              → alarma (exit 1)
#   2. CONTROL NEGATIVO — la misma fila en `en-curso` (ya tomada)        → silencio
#   3. CONTROL NEGATIVO — `@dep` todavía `abierto`                       → silencio
#   4. CONTROL POSITIVO — `@dep` apunta a un id inexistente              → alarma (nunca se cumpliría)
#   5. CONTROL NEGATIVO — disparador en prosa, con todo lo demás cerrado → silencio
#   6. CONTROL POSITIVO — bloque DEUDA-VIVA ausente                      → alarma, no "sin deuda"
#   7. CONTROL NEGATIVO — --rol que no es el dueño del cumplido          → silencio
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
DEUDA_CHECK="$REPO_ROOT/scripts/deuda-check.sh"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

fallos=0
ok()   { printf '  ✅ %s\n' "$1"; }
fail() { printf '  ❌ %s\n' "$1"; fallos=$((fallos + 1)); }

# Escribe un registro de prueba con el bloque DEUDA-VIVA y devuelve su path.
nuevo_registro() {
  local nombre="$1"; shift
  local f="$TMP/$nombre.md"
  {
    echo "# registro de prueba"
    echo
    echo "<!-- DEUDA-VIVA:INICIO -->"
    echo '```'
    printf '%s\n' "$@"
    echo '```'
    echo "<!-- DEUDA-VIVA:FIN -->"
  } > "$f"
  printf '%s' "$f"
}

corre() {   # corre el script contra un registro; imprime salida, devuelve exit code
  DEUDA_FILE="$1" bash "$DEUDA_CHECK" "${@:2}" 2>&1
}

echo "test-deuda-disparador-cumplido"

# ── 1. POSITIVO: disparador cumplido y nadie la tomó ─────────────────────────────────────────
f="$(nuevo_registro caso1 \
  "lote-B | backend | -- | cerrado" \
  "D7 | backend | @lote-B | abierto")"
out="$(corre "$f" --quiet)"; rc=$?
if [ "$rc" -eq 1 ] && printf '%s' "$out" | grep -q 'D7'; then
  ok "1 POSITIVO · @lote-B cerrado + D7 abierta → alarma nombrando D7"
else
  fail "1 POSITIVO · esperaba exit 1 nombrando D7; rc=$rc out=<$out>"
fi

# ── 2. NEGATIVO: ya tomada — no puede sonar cada 3 min ───────────────────────────────────────
f="$(nuevo_registro caso2 \
  "lote-B | backend | -- | cerrado" \
  "D7 | backend | @lote-B | en-curso")"
out="$(corre "$f" --quiet)"; rc=$?
if [ "$rc" -eq 0 ] && [ -z "$out" ]; then
  ok "2 NEGATIVO · fila en-curso → silencio (no es la alarma que suena siempre)"
else
  fail "2 NEGATIVO · esperaba exit 0 y salida vacía; rc=$rc out=<$out>"
fi

# ── 3. NEGATIVO: el disparador NO se cumplió ─────────────────────────────────────────────────
f="$(nuevo_registro caso3 \
  "lote-B | backend | -- | abierto" \
  "D7 | backend | @lote-B | abierto")"
out="$(corre "$f" --quiet)"; rc=$?
if [ "$rc" -eq 0 ] && [ -z "$out" ]; then
  ok "3 NEGATIVO · @lote-B todavía abierto → silencio"
else
  fail "3 NEGATIVO · esperaba exit 0 y salida vacía; rc=$rc out=<$out>"
fi

# ── 4. POSITIVO: referencia colgada — se cumpliría NUNCA ─────────────────────────────────────
f="$(nuevo_registro caso4 \
  "lote-B | backend | -- | cerrado" \
  "D7 | backend | @lote-QUE-NO-EXISTE | abierto")"
out="$(corre "$f" --quiet)"; rc=$?
if [ "$rc" -eq 1 ] && printf '%s' "$out" | grep -qi 'no existe'; then
  ok "4 POSITIVO · @id inexistente → alarma explícita (no se ignora en silencio)"
else
  fail "4 POSITIVO · esperaba exit 1 avisando del id inexistente; rc=$rc out=<$out>"
fi

# ── 5. NEGATIVO: prosa nunca se da por cumplida ──────────────────────────────────────────────
f="$(nuevo_registro caso5 \
  "lote-B | backend | -- | cerrado" \
  "lote-C | backend | @lote-B | cerrado" \
  "D1 | backend | 1er sprint post-beta | abierto" \
  "D9 | frontend | proximo item de frontend | abierto")"
out="$(corre "$f" --quiet)"; rc=$?
if [ "$rc" -eq 0 ] && [ -z "$out" ]; then
  ok "5 NEGATIVO · disparadores en prosa → jamás se interpretan como cumplidos"
else
  fail "5 NEGATIVO · esperaba exit 0 y salida vacía; rc=$rc out=<$out>"
fi

# ── 6. POSITIVO: registro ilegible ≠ registro vacío ──────────────────────────────────────────
sin_bloque="$TMP/sin-bloque.md"
printf '# registro sin bloque\n\nnada acá.\n' > "$sin_bloque"
out="$(corre "$sin_bloque" --quiet)"; rc=$?
if [ "$rc" -eq 1 ] && printf '%s' "$out" | grep -qi 'DEUDA-VIVA'; then
  ok "6a POSITIVO · bloque ausente → grita (fail-loud), no reporta 'sin deuda'"
else
  fail "6a POSITIVO · esperaba exit 1 mencionando DEUDA-VIVA; rc=$rc out=<$out>"
fi
out="$(corre "$TMP/no-existe-este-archivo.md" --quiet)"; rc=$?
if [ "$rc" -eq 1 ]; then
  ok "6b POSITIVO · archivo ausente → grita"
else
  fail "6b POSITIVO · esperaba exit 1; rc=$rc out=<$out>"
fi

# ── 7. NEGATIVO: el filtro por rol no puede inventar alarmas ajenas ──────────────────────────
f="$(nuevo_registro caso7 \
  "lote-B | backend | -- | cerrado" \
  "D7 | backend | @lote-B | abierto")"
out="$(corre "$f" --quiet --rol frontend)"; rc=$?
if [ "$rc" -eq 0 ] && [ -z "$out" ]; then
  ok "7 NEGATIVO · --rol frontend no ve el cumplido de backend"
else
  fail "7 NEGATIVO · esperaba exit 0 y salida vacía; rc=$rc out=<$out>"
fi
# …y el control positivo del mismo filtro: con el rol correcto SÍ alarma.
out="$(corre "$f" --quiet --rol backend)"; rc=$?
if [ "$rc" -eq 1 ]; then
  ok "7b POSITIVO · --rol backend sí lo ve (el filtro filtra, no silencia)"
else
  fail "7b POSITIVO · esperaba exit 1; rc=$rc out=<$out>"
fi

echo
if [ "$fallos" -eq 0 ]; then
  echo "✅ test-deuda-disparador-cumplido: todo verde"
  exit 0
fi
echo "❌ test-deuda-disparador-cumplido: $fallos fallo(s)"
exit 1
