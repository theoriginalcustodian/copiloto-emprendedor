#!/usr/bin/env bash
# test-version-instrumento.sh — el guard que avisa que el instrumento que corre NO es el de main.
#
# EL CASO REAL (2026-10-08). Los crones invocan `vigilancia-check.sh` desde el checkout compartido,
# que tiene el HEAD viejo. `REPO_ROOT` sale de `BASH_SOURCE`, así que cada pieza se ejecuta en la
# versión de ESE checkout. Test diferencial, mismo `PLAN.md`: 14 enums "no reconocidos" vs 0, los
# «4 frentes activos» no se reportaban, el frente `arrancando` era otro y los 4 bloqueados por
# disparador externo desaparecían — **las dos corridas con rc=0**. El vigilante decía "sin
# novedades" con el tablero mal leído, y BACKEND diagnosticó los síntomas como datos rotos.
#
#   1. POSITIVO  piezas idénticas al ref        -> rc 0 y CALLADO (sin este, los negativos pasarían
#                                                  igual si la función gritara siempre).
#   2. CANARIO   una pieza divergente a propósito -> rc 1 y la NOMBRA. Un guard hacia el "no hay
#                                                  diferencia" es el que no da síntoma.
#   3. NEGATIVO  el ref no existe               -> rc 2 ("no puedo verificar"), NO un pase.
#   4. NEGATIVO  pieza ausente del working tree -> rc 1 y la nombra.
#   5. COMPLETITUD  `PIEZAS_INSTRUMENTO` cubre TODO script que vigilancia-check ejecuta/sourcea,
#                   derivado del fuente. Caza al autor que agregue una pieza y no la liste.
#   6. CONTROL   el guard, cableado, habla de verdad end-to-end sobre un repo divergente.
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
LIB="$ROOT/scripts/lib/version-instrumento.sh"
VIG="$ROOT/scripts/vigilancia-check.sh"
fallos=0
ok()   { printf '  ✅ %s\n' "$1"; }
fail() { printf '  ❌ %s\n' "$1"; fallos=$((fallos + 1)); }
echo "test-version-instrumento"

# shellcheck source=../lib/version-instrumento.sh
. "$LIB"

T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
R="$T/repo"; mkdir -p "$R/scripts/lib"
git init -q "$R"
printf 'echo pieza-a\n' > "$R/scripts/a.sh"
printf 'echo pieza-b\n' > "$R/scripts/lib/b.sh"
git -C "$R" add scripts/a.sh scripts/lib/b.sh
git -C "$R" -c user.email=t@t -c user.name=t commit -qm base
git -C "$R" branch refbase

# 1 — POSITIVO: idénticas al ref -> callado y rc 0.
out="$(INSTRUMENTO_REF=refbase instrumento_divergente "$R" scripts/a.sh scripts/lib/b.sh)"; rc=$?
[ "$rc" = "0" ] && [ -z "$out" ] \
  && ok "1 piezas idénticas -> rc 0 y callado" \
  || fail "1 gritó con todo igual (rc=$rc out='$(head -c 60 <<< "$out")')"

# 2 — CANARIO: divergencia metida a propósito. Es el control positivo del guard.
printf 'echo pieza-a MODIFICADA\n' > "$R/scripts/a.sh"
out="$(INSTRUMENTO_REF=refbase instrumento_divergente "$R" scripts/a.sh scripts/lib/b.sh)"; rc=$?
if [ "$rc" = "1" ] && grep -q 'scripts/a.sh' <<< "$out" && ! grep -q 'scripts/lib/b.sh' <<< "$out"; then
  ok "2 CANARIO: nombra la divergente y NO a la que coincide"
else
  fail "2 el canario no fue cazado (rc=$rc out='$(head -c 80 <<< "$out")')"
fi
grep -q 'ref de comparación: refbase' <<< "$out" \
  && ok "2.bis dice contra qué ref comparó (si el ref es viejo, se ve)" \
  || fail "2.bis no reportó el ref de comparación"
git -C "$R" checkout -q -- scripts/a.sh

# 3 — el ref no existe: rc 2, y NO puede parecer un pase.
out="$(INSTRUMENTO_REF=no/existe instrumento_divergente "$R" scripts/a.sh)"; rc=$?
[ "$rc" = "2" ] && grep -q 'no puedo verificar' <<< "$out" \
  && ok "3 ref inexistente -> rc 2 'no puedo verificar' (vacío ≠ hallazgo)" \
  || fail "3 absolvió sin poder medir (rc=$rc out='$(head -c 60 <<< "$out")')"

# 4 — pieza que no está en el working tree.
out="$(INSTRUMENTO_REF=refbase instrumento_divergente "$R" scripts/fantasma.sh)"; rc=$?
[ "$rc" = "1" ] && grep -q 'NO EXISTE' <<< "$out" \
  && ok "4 pieza ausente -> rc 1 y la nombra" \
  || fail "4 tragó una pieza ausente (rc=$rc)"

# 4.bis — pieza que EXISTE en el disco pero NO en el ref (nueva, sin commitear). `git diff` sola
#         decía «sin diferencia»: absolución falsa. Caso real, hallado por el guard sobre sí mismo.
printf 'echo pieza-nueva
' > "$R/scripts/nueva.sh"
out="$(INSTRUMENTO_REF=refbase instrumento_divergente "$R" scripts/nueva.sh)"; rc=$?
[ "$rc" = "1" ] && grep -q 'NO EXISTE en refbase' <<< "$out"   && ok "4.bis pieza nueva sin mergear -> rc 1 (git diff sola la absolvía)"   || fail "4.bis absolvió una pieza que no está en el ref (rc=$rc)"
rm -f "$R/scripts/nueva.sh"

# 5 — COMPLETITUD: la lista declarada vs la derivada del propio fuente.
declaradas="$(sed -n '/^PIEZAS_INSTRUMENTO=(/,/^)/p' "$VIG" | grep -oE 'scripts/[A-Za-z0-9_./-]+\.sh' | sort -u)"
derivadas="$(grep -oE '\$REPO_ROOT/scripts/[A-Za-z0-9_./-]+\.sh' "$VIG" | sed 's|\$REPO_ROOT/||' | sort -u)"
[ -n "$derivadas" ] || fail "5 CONTROL DE CEGUERA: 0 piezas derivadas del fuente — el grep no mide"
faltan="$(comm -23 <(printf '%s\n' "$derivadas") <(printf '%s\n' "$declaradas"))"
[ -z "$faltan" ] \
  && ok "5 PIEZAS_INSTRUMENTO cubre las $(wc -l <<< "$derivadas" | tr -d ' ') piezas que el script usa" \
  || fail "5 piezas que el script ejecuta y el guard NO vigila: $(tr '\n' ' ' <<< "$faltan")"
grep -qE '^\s*scripts/vigilancia-check\.sh\s*$' <<< "$declaradas" \
  && ok "5.bis se vigila a sí mismo (su propio parser también puede ser viejo)" \
  || fail "5.bis no se incluye en su propia lista"

# 6 — CONTROL end-to-end: el guard cableado habla sobre un repo divergente de verdad.
E="$T/e2e"; mkdir -p "$E"
cp -r "$ROOT/scripts" "$E/scripts"
git init -q "$E"; git -C "$E" add scripts >/dev/null 2>&1
git -C "$E" -c user.email=t@t -c user.name=t commit -qm base >/dev/null 2>&1
git -C "$E" branch refbase
printf '\n# divergencia a propósito\n' >> "$E/scripts/cola-check.sh"
mkdir -p "$T/buzon" "$T/tr"
out="$(BUZON_DIR="$T/buzon" TRANSCRIPTS_DIR="$T/tr" VERIFICAR_VERSION=1 INSTRUMENTO_REF=refbase \
       bash "$E/scripts/vigilancia-check.sh" 2>&1)"; rc=$?
if grep -q 'INSTRUMENTO VIEJO' <<< "$out" && grep -q 'scripts/cola-check.sh' <<< "$out" && [ "$rc" = "1" ]; then
  ok "6 cableado: con una pieza divergente da exit 1 y la nombra"
else
  fail "6 el guard cableado NO habló (rc=$rc out='$(head -c 120 <<< "$out")')"
fi

echo
[ "$fallos" = "0" ] && { echo "test-version-instrumento: ✅ todo verde"; exit 0; }
echo "test-version-instrumento: ❌ $fallos fallo(s)"; exit 1
