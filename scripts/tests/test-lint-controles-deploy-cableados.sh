#!/usr/bin/env bash
# test-lint-controles-deploy-cableados.sh — fila `CONTROLESDEPLOYSINGATE` (hallazgo de auditoría,
# 2026-10-07): los 6 controles locales de `deploy/copiloto/` tenían CERO invocadores en todo el árbol.
# Se cablearon en `scripts/ci/lint.sh` vía `tests-coordinacion.sh` (que ya traía el denominador).
#
# ESTE test existe porque un cableado sin control positivo se descablea sin dar síntoma: borrar la
# línea de lint.sh dejaría todo VERDE con seis controles sin correr, que es exactamente el estado que
# el hallazgo encontró. Caso 2 es el control positivo: sobre un lint.sh SIN la línea, el caso 1 DEBE
# dar rojo. Y el caso 3 es el que no envejece: cada `test[-_]*` de `deploy/copiloto/` tiene que estar
# cubierto por los globs DECLARADOS EN lint.sh (no por una copia de ellos acá), o figurar en la
# exención — y la exención se verifica sola, exigiendo que el exento tenga invocador en otra parte.
#
# Uso: bash scripts/tests/test-lint-controles-deploy-cableados.sh
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
LINT="$ROOT/scripts/ci/lint.sh"
T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
fallos=0
ok()  { printf '  ✅ %s\n' "$1"; }
mal() { printf '  ❌ %s\n' "$1"; fallos=$((fallos+1)); }
echo "test-lint-controles-deploy-cableados"
[ -f "$LINT" ] || { echo "  ❌ no existe $LINT — no mido nada"; exit 2; }

# La línea declarativa: una sola fuente para el caso 1 y para los globs del caso 3.
linea_de() { grep -E 'tests-coordinacion\.sh" +"\$ROOT/deploy/copiloto"' "$1" | head -1; }

# --- Caso 1: lint.sh invoca el corredor sobre deploy/copiloto -------------------------------------
LINEA="$(linea_de "$LINT")"
[ -n "$LINEA" ] && ok "1 lint.sh cablea los controles de deploy/copiloto" \
                || mal "1 lint.sh NO invoca tests-coordinacion.sh sobre deploy/copiloto: los 6 controles no corren en ningún gate"

# --- Caso 2: CONTROL POSITIVO — sin la línea, el caso 1 tiene que dar rojo ------------------------
grep -v -E 'tests-coordinacion\.sh" +"\$ROOT/deploy/copiloto"' "$LINT" > "$T/lint-sin.sh"
[ -z "$(linea_de "$T/lint-sin.sh")" ] && ok "2 CONTROL: sobre un lint.sh sin la línea, el chequeo da rojo (discrimina)" \
                                      || mal "2 el chequeo encontró la línea en un archivo donde la borré: no discrimina"

# --- Caso 3: DENOMINADOR — ningún test[-_]* de deploy/copiloto queda fuera sin exención ----------
# Exentos POR MEDICIÓN, no por conveniencia: son harness de DB/GoTrue que invoca gate.sh y
# sync-test-backend.sh, no controles sueltos. Cada uno debe probar que tiene invocador.
# `test-db.sh`/`test-gotrue.sh`: harness de DB/GoTrue que invocan gate.sh y sync-test-backend.sh.
# Los dos `.py`: necesitan pytest (uno estilo pytest, el otro unittest) y van en la suite de
# `scripts/ci/backend.sh` — `lint` corre python stdlib. La exención se verifica igual: cada uno
# tiene que PROBAR que alguien lo invoca.
EXENTOS="test-db.sh test-gotrue.sh test_meclaves_check.py test_caddy_converge.py"
GLOBS="$(printf '%s' "$LINEA" | grep -oE "'[^']*'" | head -1 | tr -d "'")"
[ -n "$GLOBS" ] || GLOBS='test_*.sh test_*.py'
# La lógica va en una función para poder correrla sobre un DIRECTORIO FIXTURE: el caso 3 es una
# pieza distinta del caso 1 y necesita su propio mutante, y un mutante que escriba en
# `deploy/copiloto/` sería el anti-patrón que este mismo sprint documentó (mutar y revertir deja el
# mutante). El fixture vive en el mktemp y se va con el trap.
sin_cubrir_en() {
  local dir="$1" acc="" b cubierto g n
  for f in "$dir"/test[-_]*; do
    [ -e "$f" ] || continue
    b="$(basename "$f")"; cubierto=0
    for g in $GLOBS; do case "$b" in $g) cubierto=1 ;; esac; done
    [ "$cubierto" = 1 ] && continue
    case " $EXENTOS " in
      *" $b "*)
        n=$(cd "$ROOT" && git grep -l -I -- "$b" -- scripts deploy .github 2>/dev/null | grep -v "deploy/copiloto/$b$" | wc -l)
        [ "$n" -ge 1 ] || acc="$acc $b(exención-sin-invocador)"
        ;;
      *) acc="$acc $b" ;;
    esac
  done
  printf '%s' "$acc"
}

sin_cubrir="$(sin_cubrir_en "$ROOT/deploy/copiloto")"
[ -z "$sin_cubrir" ] && ok "3 DENOMINADOR: todo test[-_]* de deploy/copiloto está cubierto o exento con invocador probado" \
                     || mal "3 fuera de los globs y sin exención:$sin_cubrir — se agregó un control que ningún gate corre"

# --- Caso 4: MUTANTE del caso 3 — un control huérfano en un dir fixture DEBE salir listado --------
mkdir -p "$T/fix"; printf '#!/usr/bin/env bash
exit 0
' > "$T/fix/test-huerfano.sh"
[ -n "$(sin_cubrir_en "$T/fix")" ] && ok "4 MUTANTE: un test[-_]* fuera de los globs y sin exención SÍ se detecta"                                    || mal "4 el caso 3 no detectó un huérfano inyectado: su verde no vale"

# --- Caso 5: MUTANTE del fail-closed — un pytest sin __main__ DEBE salir rojo, no verde ----------
# Reproduce el defecto exacto que CI cazó el 2026-10-07: `python archivo.py` sobre un test de pytest
# importa, define las funciones y sale 0 SIN EJECUTAR NADA. Sin el guard, este caso saldría verde.
mkdir -p "$T/pyt"
printf 'import pytest


def test_siempre_falla():
    assert False
' > "$T/pyt/test_falso_verde.py"
out="$T/o5"; bash "$ROOT/scripts/ci/tests-coordinacion.sh" "$T/pyt" 'test_*.py' 'fixture' >"$out" 2>&1; rc=$?
if [ "$rc" -ne 0 ] && grep -q 'sin bloque __main__' "$out"; then
  ok "5 MUTANTE: un .py estilo pytest corrido como script sale ROJO y nombra por qué (no falso verde)"
else
  mal "5 el pytest sin __main__ dio rc=$rc: $(tr '
' '|' <"$out" | cut -c1-160)"
fi

[ "$fallos" = 0 ] && { echo "OK"; exit 0; } || { echo "$fallos check(s) fallaron"; exit 1; }
