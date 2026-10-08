#!/usr/bin/env bash
# Test del gate de atribución. Repo temporal con commits sintéticos: el test no depende
# del backlog real (que cambia todos los días) sino de un padrón que él mismo fabrica.
#
# El caso que importa es el 5: con UC_ATRIBUCION_BLOQUEA=1 y un commit sin id, el gate
# tiene que salir EXIT 1. Un mecanismo roto hacia el "NO" no da síntoma — pasa por verde
# para siempre y nadie lo nota (memoria/un-mecanismo-roto-hacia-el-no-no-da-sintoma.md).
set -uo pipefail

GATE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/ci/atribucion.sh"
[ -f "$GATE" ] || { echo "⛔ no encuentro el gate en $GATE"; exit 1; }

TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
cd "$TMP" || exit 1
git init -q .; git config user.email t@t.t; git config user.name t
mkdir -p docs/copiloto-emprendedor
# El padrón sintético: estos son los únicos ids "autorizados" para el test.
printf '| BL-J9 | algo | PENDIENTE |\n| DEC-14 | otra | FIRMADA |\n| M-00 | tercera | ABIERTA |\n' \
  > docs/copiloto-emprendedor/2026-01-01-backlog-de-prueba-con-dod.md
git add -A >/dev/null; git commit -qm "base: padron de prueba"
git branch -q -M main; git remote add origin . 2>/dev/null || true
BASE="$(git rev-parse HEAD)"

fallos=0
chk() { # chk <nombre> <esperado-en-salida> <esperado-exit> <bloquea> <rango>
  local nom="$1" pat="$2" exp_rc="$3" bl="$4" rango="$5" out rc
  out="$(UC_ATRIBUCION_BLOQUEA="$bl" bash "$GATE" "$rango" 2>&1)"; rc=$?
  local ok=1
  printf '%s' "$out" | grep -q "$pat" || ok=0
  [ "$rc" -eq "$exp_rc" ] || ok=0
  if [ "$ok" -eq 1 ]; then
    printf '  ✅ %-52s (rc=%s)\n' "$nom" "$rc"
  else
    printf '  ❌ %-52s (rc=%s, esperaba %s y /%s/)\n' "$nom" "$rc" "$exp_rc" "$pat"
    printf '%s\n' "$out" | sed 's/^/       | /'
    fallos=$((fallos + 1))
  fi
}

commitear() { printf '%s\n' "$RANDOM" >> f.txt; git add f.txt; git commit -q -F - <<< "$1"; }

# --- 1) id autorizado del padrón -> OK
commitear "fix(BL-J9): un cambio con id del padron"
chk "1· id autorizado (BL-J9) cuenta como atribuido" "autorizados=1" 0 0 "$BASE..HEAD"

# --- 2) sin ningún id -> SIN-ID, y en modo reporte NO frena
git reset -q --hard "$BASE"
commitear "docs(algo): un cambio sin ningun id"
chk "2· sin id -> SIN-ID=1" "SIN-ID=1" 0 0 "$BASE..HEAD"
chk "2b· modo reporte NO frena aunque haya SIN-ID" "modo REPORTE" 0 0 "$BASE..HEAD"

# --- 3) libre declarado -> se cuenta, no se oculta
git reset -q --hard "$BASE"
commitear "$(printf 'chore: algo deliberado\n\nATRIBUCION: libre — lo pidio el operador en el chat\n')"
chk "3· 'ATRIBUCION: libre' se cuenta aparte" "libre-declarado=1" 0 0 "$BASE..HEAD"

# --- 4) id que NO existe en el padrón -> FANTASMA (cita sin respaldo)
git reset -q --hard "$BASE"
commitear "fix(BL-ZZ999): cito un id que no existe en ningun padron"
chk "4· id inventado -> FANTASMA=1" "FANTASMA=1" 0 0 "$BASE..HEAD"

# --- 5) EL CONTROL POSITIVO DEL "NO": bloqueante + sin id -> exit 1
git reset -q --hard "$BASE"
commitear "docs(algo): otro cambio sin id"
chk "5· BLOQUEA=1 + SIN-ID -> RECHAZA (exit 1)" "RECHAZADO" 1 1 "$BASE..HEAD"

# --- 6) bloqueante pero todo atribuido -> pasa
git reset -q --hard "$BASE"
commitear "fix(DEC-14): cambio con acta del padron"
chk "6· BLOQUEA=1 + todo atribuido -> pasa (exit 0)" "autorizados=1" 0 1 "$BASE..HEAD"

# --- 7) FANTASMA también bloquea (un id inventado no es atribución)
git reset -q --hard "$BASE"
commitear "fix(M-99): id que no esta en el padron"
chk "7· BLOQUEA=1 + FANTASMA -> RECHAZA" "RECHAZADO" 1 1 "$BASE..HEAD"

# --- 8) padrón vacío -> lo DICE, no aprueba por vacío
git reset -q --hard "$BASE"
rm -f docs/copiloto-emprendedor/*backlog*.md
git add -A >/dev/null; git commit -qm "quito el padron"
chk "8· padrón vacío: avisa en vez de aprobar por vacío" "salió VACÍO" 0 0 "$BASE..HEAD"

echo
if [ "$fallos" -eq 0 ]; then
  echo "✅ test-atribucion: 9/9 — incluye el control positivo del NO (casos 5 y 7)"
  exit 0
fi
echo "❌ test-atribucion: $fallos caso(s) fallaron"
exit 1
