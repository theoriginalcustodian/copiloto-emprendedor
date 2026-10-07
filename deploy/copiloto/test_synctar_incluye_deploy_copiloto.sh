#!/usr/bin/env bash
# test_synctar_incluye_deploy_copiloto.sh — regresión del bug real: `sync-test-backend.sh` tarreaba
# el worktree SIN `deploy/copiloto`, mientras `scripts/ci/backend.sh:33` (PR #913,
# CONTROLESDEPLOYSINGATE) pasa `../../deploy/copiloto/test_meclaves_check.py` y
# `test_caddy_converge.py` como paths POSICIONALES de pytest. Sin el directorio en el tar, pytest
# ABORTA la invocación completa con "file or directory not found" — ni los de `tests/`, ni los del
# motor, NADA corre. Medido en vivo contra el VPS: "2225 tests collected" (fase --co) seguido de
# "no tests ran in 0.00s" + el ERROR de path — un falso silencio: parecía que había corrido algo.
#
# Método: extrae la línea real del `tar` con `grep` (no la reescribe) y verifica que declara
# `deploy/copiloto` como un ELEMENTO propio (palabra completa, no substring de `deploy/worker`).
# Control positivo contra la versión vieja (antes de este fix, viva en el propio git history de
# este archivo): tiene que FALTAR.
#
# Uso: bash deploy/copiloto/test_synctar_incluye_deploy_copiloto.sh [ruta/a/sync-test-backend.sh]
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT="${1:-$HERE/sync-test-backend.sh}"

tiene_el_path() {
  # la línea del tar, y sólo esa -- '\btar\b.*-czf' la ubica sin asumir número de línea
  grep -E '^\s*-czf - .*\bdeploy/copiloto\b' "$1" >/dev/null 2>&1
}

echo "== SYNCTARDEPLOYCOPILOTO: $SCRIPT"
fallos=0

if tiene_el_path "$SCRIPT"; then
  echo "  PASA: el tar de $SCRIPT incluye deploy/copiloto -- backend.sh:33 puede resolver sus dos .py"
else
  echo "  ROJO: el tar NO declara deploy/copiloto -- sync-test-backend.sh reproduce el bug (pytest aborta sin correr nada)"
  fallos=$((fallos+1))
fi

# Control positivo: la versión del archivo tal como vivía en el último commit (antes de este fix,
# si éste todavía no se commiteó) TIENE que fallar la misma prueba -- si no discrimina, el test miente.
if git -C "$HERE/../.." cat-file -e HEAD:deploy/copiloto/sync-test-backend.sh 2>/dev/null; then
  VIEJO="$(mktemp)"
  git -C "$HERE/../.." show HEAD:deploy/copiloto/sync-test-backend.sh > "$VIEJO"
  if tiene_el_path "$VIEJO"; then
    echo "  (el HEAD commiteado ya tiene el fix -- no hay control positivo que correr contra él, no es un fallo del test)"
  else
    echo "  ok   control positivo: el HEAD commiteado (pre-fix) NO incluye deploy/copiloto -- confirma el defecto que este test cierra"
  fi
  rm -f "$VIEJO"
fi

echo
if [ "$fallos" -eq 0 ]; then echo "OK: SYNCTARDEPLOYCOPILOTO — el tar lleva deploy/copiloto al VPS"; exit 0; fi
echo "FALLO: $fallos caso(s)"; exit 1
