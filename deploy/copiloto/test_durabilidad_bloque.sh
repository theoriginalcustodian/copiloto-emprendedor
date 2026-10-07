#!/usr/bin/env bash
# Control de la RAMA DE FALLA del paso [4.95/7] de deploy.sh (DURABGATE, DoD del contrato POSTDEPLOY B).
#
# test-durabilidad-gate.sh prueba el helper (durabilidad-gate.sh). Este prueba el BLOQUE real de
# deploy.sh: lo extrae con sed (el mismo patrón que test_guard_postrestart.sh) y lo corre con
# LOCAL apuntando a un árbol sin .env.e2e, un `python` que falla en --armar, y un marcador después
# del bloque que dice "llegó al restart". Sin ssh, sin prod, sin tocar el worktree de deploy.
#
# Uso: bash deploy/copiloto/test_durabilidad_bloque.sh
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
DEPLOY_SH="$HERE/deploy.sh"
GATE="$HERE/durabilidad-gate.sh"
fallos=0
# El entorno del caller no puede colar un opt-out ni una ruta de credencial en los casos de falla.
unset UC_SKIP_DURABILIDAD UC_ENV_E2E_PATH

chk() {  # chk <nombre> <cond 0/1> [detalle]
  if [ "$2" = "1" ]; then echo "ok   $1"; else echo "FAIL $1${3:+  -- $3}"; fallos=$((fallos + 1)); fi
}

# Bloque 4.95 tal cual está en deploy.sh: desde el `if uc_durabilidad_activa; then` hasta el `fi` de columna 0.
BLOQUE="$(mktemp)"
sed -n '/^if uc_durabilidad_activa; then$/,/^fi$/p' "$DEPLOY_SH" > "$BLOQUE"
chk "el bloque 4.95 se extrae de deploy.sh (no vacío, con el aborto exit 3)" \
  "$([ -s "$BLOQUE" ] && grep -q 'exit 3' "$BLOQUE" && echo 1 || echo 0)" "bloque vacío o sin exit 3"

# Corre el bloque en un árbol de mentira. $1 = LOCAL, $2 = modo python ("ok"|"falla"), resto = env extra.
correr() {
  local local_root="$1" modo="$2"; shift 2
  local runner; runner="$(mktemp)"
  cat > "$runner" <<EOF
set -u
source "$GATE"
LOCAL="$local_root"
python() { [ "$modo" = "ok" ] && return 0 || return 1; }
$(cat "$BLOQUE")
echo "LLEGO_AL_RESTART_5_7"
EOF
  env "$@" bash "$runner" 2>&1
  local rc=$?
  rm -f "$runner"
  return $rc
}

ARBOL="$(mktemp -d)"   # sin .env.e2e, sin repo git: ni el worktree ni el checkout común lo tienen

# 1) Caso hostil: sin credencial ⇒ ABORTA con exit 3, con mensaje propio, y NO llega al restart.
out="$(correr "$ARBOL" ok 2>&1)"; rc=$?
chk "sin .env.e2e: el bloque aborta con exit 3" "$([ $rc -eq 3 ] && echo 1 || echo 0)" "rc=$rc"
chk "sin .env.e2e: el mensaje nombra el paso y la causa" \
  "$(echo "$out" | grep -q 'ABORT \[4.95/7\]: falta .env.e2e' && echo 1 || echo 0)" "$out"
chk "sin .env.e2e: NO llega al restart de [5/7]" \
  "$(echo "$out" | grep -q LLEGO_AL_RESTART_5_7 && echo 0 || echo 1)"

# 2) Caso hostil 2: credencial presente pero --armar falla ⇒ ABORTA con exit 3, no reinicia.
touch "$ARBOL/.env.e2e"
out="$(correr "$ARBOL" falla 2>&1)"; rc=$?
chk "--armar falla: el bloque aborta con exit 3" "$([ $rc -eq 3 ] && echo 1 || echo 0)" "rc=$rc"
chk "--armar falla: el mensaje dice que los servicios viejos siguen arriba" \
  "$(echo "$out" | grep -q 'ABORT \[4.95/7\]: --armar falló' && echo 1 || echo 0)" "$out"
chk "--armar falla: NO llega al restart de [5/7]" \
  "$(echo "$out" | grep -q LLEGO_AL_RESTART_5_7 && echo 0 || echo 1)"

# 3) Control positivo: armado OK ⇒ el bloque pasa y llega al restart (si esto no pasa, el caso 1 y 2
#    serían verdes por una razón equivocada: el bloque rompe siempre).
out="$(correr "$ARBOL" ok 2>&1)"; rc=$?
chk "armado OK: el bloque pasa (rc=0) y el marcador de restart aparece" \
  "$([ $rc -eq 0 ] && echo "$out" | grep -q LLEGO_AL_RESTART_5_7 && echo 1 || echo 0)" "rc=$rc $out"

# 4) Opt-out ruidoso: UC_SKIP_DURABILIDAD=1 saltea (aunque no haya .env.e2e) Y lo imprime en el log.
out="$(correr "$ARBOL" falla UC_SKIP_DURABILIDAD=1 2>&1)"; rc=$?
chk "UC_SKIP_DURABILIDAD=1: no aborta (rc=0) y llega al restart" \
  "$([ $rc -eq 0 ] && echo "$out" | grep -q LLEGO_AL_RESTART_5_7 && echo 1 || echo 0)" "rc=$rc $out"
chk "UC_SKIP_DURABILIDAD=1: el opt-out queda IMPRESO en el log" \
  "$(echo "$out" | grep -q 'DURABILIDAD SALTEADA' && echo 1 || echo 0)" "$out"

rm -rf "$ARBOL" "$BLOQUE"
if [ "$fallos" -eq 0 ]; then echo "==> OK: rama de falla del bloque 4.95 ejercitada"; exit 0; fi
echo "==> $fallos FALLO(S)"; exit 1
