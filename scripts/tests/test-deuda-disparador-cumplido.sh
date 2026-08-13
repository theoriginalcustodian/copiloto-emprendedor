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
#   8. CONTROL POSITIVO — sin el documento en disco                      → lo lee de origin/main
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

# ── 8. POSITIVO: el registro se lee de origin/main cuando no está en el working tree ─────────
# Por qué existe este caso (2026-08-12 21:15): el chequeo se probó 9/9 en el worktree donde se lo
# escribió, y los crones corren desde el CHECKOUT COMPARTIDO — otro working tree, con su HEAD en otra
# rama y SIN este documento. Ahí el script alarmaba «no pude leer el registro» cada 3 minutos, en el
# único lugar donde tenía que servir. El fallback a `git show origin/main:<path>` lo arregla, y además
# es la autoridad correcta: el registro vive en `main`, no en el checkout que casualmente lo corra.
#
# Cómo se simula sin tocar el disco del repo: se copia el script a un REPO_ROOT falso *dentro* del
# repo (git descubre el repositorio caminando hacia arriba, así que `git show` sigue funcionando) y se
# apunta DEUDA_FILE al path canónico bajo esa raíz — que no existe en disco. Si el fallback funciona,
# el script lee el documento real de origin/main; si no, dice «no pude leer el registro».
#
# La aserción NO mira si hay alarma o no: eso depende del contenido vivo del registro y volvería este
# test rojo el día que alguien cumpla un disparador. Lo único que se afirma es que LEYÓ.
fake_root="$REPO_ROOT/scripts/tests/.tmp-fallback-$$"
if ! git -C "$REPO_ROOT" rev-parse --verify -q origin/main >/dev/null; then
  # Skip RUIDOSO a propósito: un salteo silencioso sería verde-por-ausencia, que es justo la falla
  # que este archivo documenta. Pasa en checkouts sin la ref (p. ej. fetch-depth=1 en Actions).
  printf '  ⚠️  8 SALTEADO · no hay ref origin/main en este checkout — el fallback NO se verificó\n'
else
  mkdir -p "$fake_root/scripts"
  cp "$DEUDA_CHECK" "$fake_root/scripts/deuda-check.sh"
  out="$(DEUDA_FILE="$fake_root/docs/copiloto-emprendedor/Auditorias/2026-08-12-DEUDA-diferidos-con-dueno-y-fecha.md" \
         bash "$fake_root/scripts/deuda-check.sh" 2>&1)"
  rm -rf "$fake_root"
  if printf '%s' "$out" | grep -qi 'no pude leer el registro'; then
    fail "8 POSITIVO · el fallback a origin/main no leyó nada; out=<$out>"
  elif printf '%s' "$out" | grep -q 'DEUDA'; then
    ok "8 POSITIVO · sin el archivo en disco, lee el registro de origin/main"
  else
    fail "8 POSITIVO · salida inesperada, no se puede afirmar que leyó; out=<$out>"
  fi
fi

echo
if [ "$fallos" -eq 0 ]; then
  echo "✅ test-deuda-disparador-cumplido: todo verde"
  exit 0
fi
echo "❌ test-deuda-disparador-cumplido: $fallos fallo(s)"
exit 1
