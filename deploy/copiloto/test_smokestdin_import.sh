#!/usr/bin/env bash
# Regresión + control del fix SMOKESTDIN (hallazgo auditoría, 2026-10-07): el import plano
# `from meclaves_check import ...` de smoke_beta_e2e.py no resolvía por el camino con el que
# run-smoke-prod.sh lo corría (stdin puro, sys.path[0]=CWD del login ssh). 100% verificable SIN VPS,
# con los archivos reales (nada de mocks de import).
#
# Uso: bash deploy/copiloto/test_smokestdin_import.sh
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$HERE/../.." && pwd)"
ME_CONTRATO_REAL="$REPO_ROOT/apps/copiloto/me_contrato.py"
PY="${PYTHON:-python3}"
fallos=0

chk() {  # chk <nombre> <cond 0/1> [detalle]
  if [ "$2" = "1" ]; then echo "ok   $1"; else echo "FAIL $1${3:+  -- $3}"; fallos=$((fallos + 1)); fi
}

[ -f "$ME_CONTRATO_REAL" ] || { echo "FAIL no encuentro $ME_CONTRATO_REAL — ¿cambió el path?"; exit 1; }

# 1) REGRESIÓN: el patrón viejo de run-smoke-prod.sh (stdin puro, CWD ajeno) seguía roto si alguien
#    lo reintroduce. Si esto alguna vez imprime un número en vez de ModuleNotFoundError, significa
#    que el import dejó de ser plano o que algo puso deploy/copiloto en el PYTHONPATH del entorno
#    — en cualquier caso, dejó de reproducir el bug original y hay que revisar por qué.
CWD_AJENO="$(mktemp -d)"
out="$(cd "$CWD_AJENO" && printf 'from meclaves_check import cargar_claves_declaradas\nprint(len(cargar_claves_declaradas()))' | env -u PYTHONPATH "$PY" - 2>&1)"
rc=$?
chk "regresión: stdin puro desde un CWD ajeno sigue sin resolver el import hermano (documenta el bug original)" \
  "$([ $rc -ne 0 ] && echo "$out" | grep -qi ModuleNotFoundError && echo 1 || echo 0)" "$out"

# 2) MECANISMO NUEVO (el que usa run-smoke-prod.sh desde este fix): los dos archivos sueltos en un
#    tmpdir, corridos como ARCHIVO (no stdin) desde ahí, con UC_ME_CONTRATO_PATH apuntando a un
#    árbol "desplegado" DISTINTO del tmpdir — simula exactamente la separación código-local /
#    set-declarado-desplegado que decide el fix.
TMP_SMOKE="$(mktemp -d)"
cp "$HERE/smoke_beta_e2e.py" "$HERE/meclaves_check.py" "$TMP_SMOKE/"
TMP_DEPLOYED="$(mktemp -d)"
mkdir -p "$TMP_DEPLOYED/apps/copiloto"
cp "$ME_CONTRATO_REAL" "$TMP_DEPLOYED/apps/copiloto/me_contrato.py"

out="$(cd "$TMP_SMOKE" && env -u PYTHONPATH UC_ME_CONTRATO_PATH="$TMP_DEPLOYED/apps/copiloto/me_contrato.py" "$PY" -c \
  'from meclaves_check import cargar_claves_declaradas; print(len(cargar_claves_declaradas()))' 2>&1)"
rc=$?
chk "mecanismo nuevo: import como ARCHIVO desde el tmpdir + UC_ME_CONTRATO_PATH al árbol desplegado ⇒ 9 claves" \
  "$([ $rc -eq 0 ] && [ "$out" = "9" ] && echo 1 || echo 0)" "rc=$rc out=$out"

# 3) FAIL-CLOSED: sin el override y sin la estructura relativa real (../../apps/copiloto no existe
#    desde el tmpdir) tiene que FALLAR, no responder con cualquier número. Si esto no falla, el
#    guard de "ruta no resuelve" se rompió en silencio.
out="$(cd "$TMP_SMOKE" && env -u PYTHONPATH -u UC_ME_CONTRATO_PATH "$PY" -c \
  'from meclaves_check import cargar_claves_declaradas; print(len(cargar_claves_declaradas()))' 2>&1)"
rc=$?
chk "fail-closed: sin UC_ME_CONTRATO_PATH y sin árbol relativo real ⇒ falla (no inventa un número)" \
  "$([ $rc -ne 0 ] && echo 1 || echo 0)" "rc=$rc out=$out"

rm -rf "$CWD_AJENO" "$TMP_SMOKE" "$TMP_DEPLOYED"
if [ "$fallos" -eq 0 ]; then echo "==> OK: import de meclaves_check resuelve por el camino de run-smoke-prod.sh"; exit 0; fi
echo "==> $fallos FALLO(S)"; exit 1
