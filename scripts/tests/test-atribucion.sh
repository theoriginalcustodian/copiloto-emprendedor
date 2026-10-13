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
# El total del resumen NO se escribe a mano: `ok` cuenta y el cierre COMPARA. Medido el
# 2026-10-13 en el test hermano: el resumen decia `14/14` literal mientras corrian 18
# aserciones. Un veredicto que no cuenta lo que miro absuelve a un bloque que no se ejecuto.
ASERCIONES_ESPERADAS=11
oks=0
chk() { # chk <nombre> <esperado-en-salida> <esperado-exit> <bloquea> <rango>
  local nom="$1" pat="$2" exp_rc="$3" bl="$4" rango="$5" out rc
  out="$(UC_ATRIBUCION_BLOQUEA="$bl" bash "$GATE" "$rango" 2>&1)"; rc=$?
  local ok=1
  printf '%s' "$out" | grep -q "$pat" || ok=0
  [ "$rc" -eq "$exp_rc" ] || ok=0
  if [ "$ok" -eq 1 ]; then
    printf '  ✅ %-52s (rc=%s)\n' "$nom" "$rc"; oks=$((oks + 1))
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

# --- 9/10) EL TABLERO VIVO como tercera fuente (2026-10-13). Los dos casos van juntos porque el
# positivo solo no prueba nada: `FILAVIVA` adentro del bloque COLA-VIVA tiene que entrar, y
# `OTROFUERA` -- misma FORMA de id, pero FUERA del bloque-- tiene que seguir siendo FANTASMA. Si
# el segundo pasara, el padron no leeria el tablero: leeria cualquier palabra en mayuscula del
# archivo, y un padron inflado aprueba cualquier cosa.
mkdir -p "$TMP/tab"
printf 'blabla\nCOLA-VIVA:INICIO\nFILAVIVA | una fila del tablero vigente | pendiente\nminuscula | no tiene forma de id\nCOLA-VIVA:FIN\nOTROFUERA | fila fuera del bloque\n' > "$TMP/tab/PLAN.md"

git reset -q --hard "$BASE"
commitear "fix(FILAVIVA): trabajo sobre una fila del tablero"
out9="$(UC_PADRON_TABLERO="$TMP/tab/PLAN.md" bash "$GATE" "$BASE..HEAD" 2>&1)"
if printf '%s' "$out9" | grep -q 'autorizados=1'; then
  printf '  ✅ %-52s\n' '9· id del TABLERO (FILAVIVA) cuenta como atribuido'; oks=$((oks + 1))
else
  printf '  ❌ %-52s\n' '9· el id del TABLERO no se leyo como atribucion'; printf '%s\n' "$out9" | sed 's/^/       | /'; fallos=$((fallos + 1))
fi

git reset -q --hard "$BASE"
commitear "fix(OTROFUERA): cito una fila que esta FUERA del bloque COLA-VIVA"
out10="$(UC_PADRON_TABLERO="$TMP/tab/PLAN.md" bash "$GATE" "$BASE..HEAD" 2>&1)"
# OJO: el esperado correcto es SIN-ID, no FANTASMA, y lo aprendi al revés (puse FANTASMA y el
# caso salio rojo acusando al codigo). `ids_citados_en` solo emite ids de la LISTA CERRADA, asi
# que `OTROFUERA` no se extrae: el commit no cita NADA. FANTASMA es 'cito un id sin respaldo' y
# exigiria un patron laxo que lea cualquier mayuscula -- justo lo que no queremos. Se piden las
# dos mitades: SIN-ID=1 Y FANTASMA=0.
if printf '%s' "$out10" | grep -q 'SIN-ID=1' && printf '%s' "$out10" | grep -q 'FANTASMA=0'; then
  printf '  ✅ %-52s\n' '10· fuera del bloque: no se extrae (SIN-ID, FANTASMA=0)'; oks=$((oks + 1))
else
  printf '  ❌ %-52s\n' '10· el padron leyo una fila FUERA del bloque ⇒ se inflo'; printf '%s\n' "$out10" | sed 's/^/       | /'; fallos=$((fallos + 1))
fi
# --- 8) padrón vacío -> lo DICE, no aprueba por vacío
git reset -q --hard "$BASE"
rm -f docs/copiloto-emprendedor/*backlog*.md
git add -A >/dev/null; git commit -qm "quito el padron"
chk "8· padrón vacío: avisa en vez de aprobar por vacío" "salió VACÍO" 0 0 "$BASE..HEAD"

echo
if [ "$fallos" -eq 0 ]; then
  corridas=$((oks + fallos))
  if [ "$corridas" -ne "$ASERCIONES_ESPERADAS" ]; then
    echo "❌ test-atribucion: corrieron $corridas de $ASERCIONES_ESPERADAS — faltaron aserciones (un caso que no se ejecuta NO da sintoma)"
    exit 1
  fi
  echo "✅ test-atribucion: $oks/$ASERCIONES_ESPERADAS — incluye el control positivo del NO (casos 5 y 7) y el id del TABLERO (10, 11)"
  exit 0
fi
echo "❌ test-atribucion: $fallos caso(s) fallaron"
exit 1
