#!/usr/bin/env bash
# Control del contrato «NO PUDE MEDIR» (rc=2) del agregador `scripts/ci/tests-coordinacion.sh`.
#
# Por qué existe (2026-10-13, fila `TSCNOMIDE`). `test-tsc-mira-los-tests.sh` salía **1** cuando el
# árbol no tiene `node_modules`, y el agregador cuenta cualquier rc!=0 como fallo: en toda PC y en
# todo worktree recién creado la pata `lint` de `gate.sh` quedaba ROJA acusando a ese test de un
# defecto que no existía. Dos causas distintas compartiendo el código de salida es lo que hace que
# el mensaje elija una, y el falso rojo es el que enseña a saltear el gate con `--no-verify`.
#
# Lo que se mide acá son las DOS mitades, porque un degradado prudente hacia el caso benigno
# envenena la medición: que el rc=2 declarado NO cuente como fallo (1, 2) y que un rc=2 que NO
# declara la marca SÍ cuente (3) — fail-closed, para que un script que se rompe y casualmente sale 2
# no se cuele. Más el borde: si NINGUNO pudo medir, el verde no acreditaría nada (4).
set -uo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
AGREG="$RAIZ/scripts/ci/tests-coordinacion.sh"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
fallos=0
ok()   { echo "  ✅ $1"; }
malo() { echo "  ❌ $1"; fallos=$((fallos+1)); }

# $1=nombre del caso  $2=dir fixture  $3=rc esperado  $4=patrón que la salida debe contener
caso() {
  local nombre="$1" dir="$2" rc_esp="$3" patron="$4" salida rc
  salida="$(bash "$AGREG" "$dir" 'test-*.sh' 'fixture' 2>&1)"; rc=$?
  if [ "$rc" -ne "$rc_esp" ]; then
    malo "$nombre: rc=$rc (esperado $rc_esp)"; printf '%s\n' "$salida" | sed 's/^/        /'; return
  fi
  if ! printf '%s' "$salida" | grep -qF "$patron"; then
    malo "$nombre: rc correcto pero la salida no dice «$patron»"; printf '%s\n' "$salida" | sed 's/^/        /'; return
  fi
  ok "$nombre (rc=$rc y nombra «$patron»)"
}

mk() { printf '%s' "$2" > "$1/$3"; }

echo "== 1-2. rc=2 + la marca: no es fallo, pero se CUENTA y se NOMBRA =="
D1="$TMP/d1"; mkdir -p "$D1"
mk "$D1" '#!/usr/bin/env bash
echo "todo bien"; exit 0' 'test-ok.sh'
mk "$D1" '#!/usr/bin/env bash
echo "NO PUDE MEDIR: falta la dependencia" >&2; exit 2' 'test-nomide.sh'
caso "1 rc=2 declarado -> el agregador sale VERDE"        "$D1" 0 "✅ 2/2"
caso "2 ...y el no medido aparece en la línea de CONTROL" "$D1" 0 "1 no medido(s)"

echo "== 3. FAIL-CLOSED: rc=2 SIN la marca es un FALLO (si no, el caso benigno absuelve al roto) =="
D3="$TMP/d3"; mkdir -p "$D3"
mk "$D3" '#!/usr/bin/env bash
echo "todo bien"; exit 0' 'test-ok.sh'
mk "$D3" '#!/usr/bin/env bash
echo "me rompi de una forma rara"; exit 2' 'test-rc2-mudo.sh'
caso "3 rc=2 sin marca -> FALLO y lo nombra" "$D3" 1 "test-rc2-mudo.sh"

echo "== 4. BORDE: si NINGUNO pudo medir, el verde no acreditaría nada =="
D4="$TMP/d4"; mkdir -p "$D4"
mk "$D4" '#!/usr/bin/env bash
echo "NO PUDE MEDIR: nada" >&2; exit 2' 'test-nomide.sh'
caso "4 todos no medidos -> ROJO" "$D4" 1 "NINGUNO"

echo "== 5. CONTROL NEGATIVO: un rc=1 sigue siendo fallo (el cambio no amnistió a nadie) =="
D5="$TMP/d5"; mkdir -p "$D5"
mk "$D5" '#!/usr/bin/env bash
echo "todo bien"; exit 0' 'test-ok.sh'
mk "$D5" '#!/usr/bin/env bash
echo "NO PUDE MEDIR"; exit 1' 'test-falla-con-la-frase.sh'
caso "5 rc=1 aunque imprima la frase -> FALLO" "$D5" 1 "test-falla-con-la-frase.sh"

echo "== 6. el instrumento real: sin node_modules sale 2 con la marca, y mide el árbol del CWD =="
D6="$TMP/arbol-sin-node-modules"; mkdir -p "$D6"
salida="$(TSC_RAIZ="$D6" bash "$RAIZ/scripts/tests/test-tsc-mira-los-tests.sh" 2>&1)"; rc=$?
if [ "$rc" -eq 2 ] && printf '%s' "$salida" | grep -qF 'NO PUDE MEDIR'; then
  ok "6a test-tsc sin node_modules: rc=2 y declara la marca"
else
  malo "6a test-tsc sin node_modules: rc=$rc / marca ausente"; printf '%s\n' "$salida" | sed 's/^/        /'
fi
if printf '%s' "$salida" | grep -qF "ARBOL MEDIDO: $D6"; then
  ok "6b imprime el árbol que midió, y es el que se le pasó (no el del archivo)"
else
  malo "6b no imprime «ARBOL MEDIDO: $D6» — una cifra sin árbol se cita para cualquier árbol"
fi

echo "== 7. bajo CI un no-medido es ROJO (si no, este cambio apagaria un control sin decirlo) =="
# El mismo fixture del caso 1 (que sale VERDE sin CI) con CI=true tiene que salir ROJO: eso prueba
# que lo que cambia el veredicto es el entorno declarado y NO otra diferencia del fixture.
salida="$(CI=true bash "$AGREG" "$D1" 'test-*.sh' 'fixture' 2>&1)"; rc=$?
if [ "$rc" -eq 1 ] && printf '%s' "$salida" | grep -qF 'REGRESION del entorno del job'; then
  ok "7 CI=true + 1 no medido -> rojo (el mismo fixture que en el caso 1 salia verde)"
else
  malo "7 CI=true no puso rojo al no-medido (rc=$rc)"; printf '%s
' "$salida" | sed 's/^/        /'
fi

if [ "$fallos" -ne 0 ]; then echo "❌ $fallos control(es) fallaron"; exit 1; fi
echo "✅ OK (8/8): «no pude medir» y «falló» ya no comparten el código de salida"
