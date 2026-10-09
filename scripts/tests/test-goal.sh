#!/usr/bin/env bash
# Test del mecanismo GOAL. Repo temporal con padrón sintético: no depende del backlog real.
#
# El caso que importa es el 5: con un goal activo y modo bloqueante, un commit que cita OTRO
# id AUTORIZADO tiene que salir EXIT 1. Eso es el desvío que el forense midió — trabajo real,
# legítimo, y ajeno a la orden declarada. Si ese caso pasa en verde, el mecanismo no existe.
# Y el 6 es el diferencial: el MISMO commit, sin goal, vuelve a estar bien. Mueve UNA variable.
set -uo pipefail
SDIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
GATE="$SDIR/ci/atribucion.sh"; GOAL="$SDIR/goal.sh"
for f in "$GATE" "$GOAL"; do [ -f "$f" ] || { echo "⛔ falta $f"; exit 1; }; done

TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
cd "$TMP" || exit 1
git init -q .; git config user.email t@t.t; git config user.name t
mkdir -p docs/copiloto-emprendedor
printf '| BL-J9 | tarea uno | PENDIENTE |\n| DEC-14 | tarea dos | FIRMADA |\n| M-00 | tarea tres | ABIERTA |\n' \
  > docs/copiloto-emprendedor/2026-01-01-backlog-de-prueba-con-dod.md
git add -A >/dev/null; git commit -qm "base: padron de prueba"; git branch -q -M main
BASE="$(git rev-parse HEAD)"

fallos=0
chk() { local nom="$1" pat="$2" exp="$3" bl="$4" out rc ok=1
  out="$(UC_ATRIBUCION_BLOQUEA="$bl" bash "$GATE" "$BASE..HEAD" 2>&1)"; rc=$?
  printf '%s' "$out" | grep -q "$pat" || ok=0; [ "$rc" -eq "$exp" ] || ok=0
  if [ "$ok" = 1 ]; then printf '  ✅ %-54s (rc=%s)\n' "$nom" "$rc"
  else printf '  ❌ %-54s (rc=%s, esperaba %s y /%s/)\n' "$nom" "$rc" "$exp" "$pat"
       printf '%s\n' "$out" | sed 's/^/       | /'; fallos=$((fallos+1)); fi; }
chkrc() { local nom="$1" exp="$2"; shift 2; local out rc
  out="$("$@" 2>&1)"; rc=$?
  if [ "$rc" -eq "$exp" ]; then printf '  ✅ %-54s (rc=%s)\n' "$nom" "$rc"
  else printf '  ❌ %-54s (rc=%s, esperaba %s)\n' "$nom" "$rc" "$exp"
       printf '%s\n' "$out" | sed 's/^/       | /'; fallos=$((fallos+1)); fi; }
commitear() { printf '%s\n' "$RANDOM" >> f.txt; git add f.txt; git commit -q -F - <<< "$1"; }

# --- 1) FAIL-CLOSED: un goal que no está en el padrón se RECHAZA
chkrc "1· goal inventado -> RECHAZA (exit 1)" 1 bash "$GOAL" set BL-ZZ999
[ -f .goal ] && { echo "  ❌ 1b· escribió .goal igual"; fallos=$((fallos+1)); } || echo "  ✅ 1b· no dejó .goal escrito                            (rc=0)"

# --- 2) un id real del padrón sí se toma
chkrc "2· goal del padrón (BL-J9) -> lo toma" 0 bash "$GOAL" set BL-J9
grep -q '^id=BL-J9' .goal && echo "  ✅ 2b· .goal guarda el id y su DoD del doc              (rc=0)" \
  || { echo "  ❌ 2b· .goal no tiene el id"; fallos=$((fallos+1)); }

# --- 3) commit que cita el goal -> atribuido
commitear "fix(BL-J9): trabajo sobre la orden declarada"
chk "3· commit que cita el goal -> autorizados=1" "autorizados=1" 0 0

# --- 4) EL CASO NUEVO: cita otro id AUTORIZADO -> es desvío
git reset -q --hard "$BASE"
commitear "fix(DEC-14): trabajo autorizado pero AJENO a la orden"
chk "4· otro id autorizado -> FUERA-GOAL=1" "FUERA-GOAL=1" 0 0

# --- 5) CONTROL POSITIVO DEL NO: bloqueante + fuera de goal -> exit 1
chk "5· BLOQUEA=1 + FUERA-GOAL -> RECHAZA (exit 1)" "RECHAZADO" 1 1

# --- 6) DIFERENCIAL: el MISMO commit, sin goal, está bien. Mueve UNA variable.
bash "$GOAL" clear >/dev/null
chk "6· sin goal, el MISMO commit -> autorizados=1" "autorizados=1" 0 1

# --- 7) show sin goal no explota
chkrc "7· show sin goal activo no falla" 0 bash "$GOAL" show

echo
if [ "$fallos" -eq 0 ]; then echo "✅ test-goal: 9/9 — incluye el control positivo del NO (5) y el diferencial (6)"; exit 0; fi
echo "❌ test-goal: $fallos caso(s) fallaron"; exit 1
