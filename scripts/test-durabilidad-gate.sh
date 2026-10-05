#!/usr/bin/env bash
# Controles de deploy/copiloto/durabilidad-gate.sh (BL-B1 Parte B). Bash puro, sin red ni worktree
# de deploy -- a diferencia de test-guard-deploy.sh no necesita wt-deploy.
# Uso: bash scripts/test-durabilidad-gate.sh
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
G="$ROOT/deploy/copiloto/durabilidad-gate.sh"
OUT="$(mktemp)"
fallos=0
chk() { # nombre esperado(0|1) comando...
  local n="$1" esp="$2"; shift 2
  if "$@" >"$OUT" 2>&1; then rc=0; else rc=1; fi
  if [ "$rc" = "$esp" ]; then echo "ok   $n"; else echo "FAIL $n (rc=$rc, esperado $esp)"; sed 's/^/     /' "$OUT"; fallos=$((fallos+1)); fi
}

chk "default (sin UC_SKIP_DURABILIDAD): activa (Parte B invirtió el default)" 0 \
  bash -c "source '$G'; uc_durabilidad_activa"
chk "UC_SKIP_DURABILIDAD=1: NO activa (opt-out explícito)" 1 \
  env UC_SKIP_DURABILIDAD=1 bash -c "source '$G'; uc_durabilidad_activa"

out="$(bash -c "source '$G'; uc_durabilidad_armar false")"
[ "$out" = "0" ] && echo "ok   --armar que falla -> NO_MEDIBLE (0)" || { echo "FAIL --armar que falla debería dar 0, dio '$out'"; fallos=$((fallos+1)); }

out="$(bash -c "source '$G'; uc_durabilidad_armar true")"
[ "$out" = "1" ] && echo "ok   --armar que arma -> 1" || { echo "FAIL --armar exitoso debería dar 1, dio '$out'"; fallos=$((fallos+1)); }

# El control central de la Parte B: bajo set -e (el mismo modo de deploy.sh), un --armar que
# falla NO tiene que abortar el script que lo llama.
bash -c "set -e; source '$G'; ok=\$(uc_durabilidad_armar false); echo \"siguio rc=\$ok\"" >"$OUT" 2>&1
rc=$?
if [ "$rc" = "0" ] && grep -q "siguio rc=0" "$OUT"; then
  echo "ok   set -e no aborta cuando --armar falla (NO_MEDIBLE, no bloqueante)"
else
  echo "FAIL esperaba rc=0 y 'siguio rc=0' bajo set -e (rc=$rc)"; sed 's/^/     /' "$OUT"; fallos=$((fallos+1))
fi

rm -f "$OUT"
[ "$fallos" -eq 0 ] && echo "==> ✅ durabilidad-gate: todos los controles OK" || { echo "==> ❌ $fallos fallo(s)"; exit 1; }
