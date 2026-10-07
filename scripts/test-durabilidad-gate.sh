#!/usr/bin/env bash
# Controles de deploy/copiloto/durabilidad-gate.sh (BL-B1 Parte B, armado bloqueante). Bash puro, sin
# red ni worktree de deploy -- a diferencia de test-guard-deploy.sh no necesita wt-deploy.
# Uso: bash scripts/test-durabilidad-gate.sh
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
G="$ROOT/deploy/copiloto/durabilidad-gate.sh"
OUT="$(mktemp)"
TMP="$(mktemp -d)"
fallos=0
chk() { # nombre esperado(0|1) comando...
  local n="$1" esp="$2"; shift 2
  if "$@" >"$OUT" 2>&1; then rc=0; else rc=1; fi
  if [ "$rc" = "$esp" ]; then echo "ok   $n"; else echo "FAIL $n (rc=$rc, esperado $esp)"; sed 's/^/     /' "$OUT"; fallos=$((fallos+1)); fi
}
# Iguala valor esperado de un comando que imprime (stdout).
eq() { # nombre esperado comando...
  local n="$1" esp="$2"; shift 2
  local got; got="$("$@" 2>/dev/null)"; local rc=$?
  if [ "$got" = "$esp" ]; then echo "ok   $n"; else echo "FAIL $n (rc=$rc, dio '$got', esperado '$esp')"; fallos=$((fallos+1)); fi
}

# --- activación / opt-out ---
chk "default (sin UC_SKIP_DURABILIDAD): activa y bloqueante" 0 \
  env -u UC_SKIP_DURABILIDAD bash -c "source '$G'; uc_durabilidad_activa"
chk "UC_SKIP_DURABILIDAD=1: NO activa (opt-out explícito)" 1 \
  env UC_SKIP_DURABILIDAD=1 bash -c "source '$G'; uc_durabilidad_activa"
chk "el opt-out imprime aviso ruidoso (stderr)" 0 \
  bash -c "source '$G'; uc_durabilidad_aviso_opt_out 2>&1 | grep -q 'DURABILIDAD SALTEADA'"

# --- resolución de .env.e2e ---
# CONTROL POSITIVO (contrato B): sin credencial en ningún lado, la resolución falla => deploy.sh aborta en [4.95] con exit 3.
mkdir -p "$TMP/sin-env"
chk "sin .env.e2e en ningún lado: rc=1 (deploy aborta antes del restart)" 1 \
  env -u UC_ENV_E2E_PATH bash -c "source '$G'; uc_durabilidad_env_e2e '$TMP/sin-env'"

# UC_ENV_E2E_PATH explícito e inexistente: NO hay fallback silencioso.
chk "UC_ENV_E2E_PATH apuntando a nada: rc=1 (sin fallback)" 1 \
  env UC_ENV_E2E_PATH="$TMP/no-existe.env" bash -c "source '$G'; uc_durabilidad_env_e2e '$TMP/sin-env'"

# UC_ENV_E2E_PATH explícito y existente: gana sobre todo.
echo "E2E_DEVICE_EMAIL=x" > "$TMP/explicito.env"
eq "UC_ENV_E2E_PATH existente: se usa ese" "$TMP/explicito.env" \
  env UC_ENV_E2E_PATH="$TMP/explicito.env" bash -c "source '$G'; uc_durabilidad_env_e2e '$TMP/sin-env'"

# Worktree sin el archivo (gitignored) => se resuelve al checkout común. Caso real del incidente 2026-10-06.
MAIN="$TMP/repo-principal"
mkdir -p "$MAIN" && git -C "$MAIN" init -q && git -C "$MAIN" -c user.email=t@t -c user.name=t commit -q --allow-empty -m init
echo "E2E_DEVICE_EMAIL=x" > "$MAIN/.env.e2e"
git -C "$MAIN" worktree add -q "$TMP/wt" -b wt-test >/dev/null 2>&1
[ -f "$TMP/wt/.env.e2e" ] && echo "FAIL precondición: el worktree NO debería traer .env.e2e (gitignored)" && fallos=$((fallos+1))
got="$(env -u UC_ENV_E2E_PATH bash -c "source '$G'; uc_durabilidad_env_e2e '$TMP/wt'" 2>/dev/null)"
if [ -n "$got" ] && [ -f "$got" ] && [ "$(cat "$got")" = "E2E_DEVICE_EMAIL=x" ]; then
  echo "ok   worktree sin .env.e2e: resuelve al archivo del checkout común"
else
  echo "FAIL worktree sin .env.e2e: dio '$got'"; fallos=$((fallos+1))
fi

rm -rf "$TMP"; rm -f "$OUT"
[ "$fallos" -eq 0 ] && echo "==> ✅ durabilidad-gate: todos los controles OK" || { echo "==> ❌ $fallos fallo(s)"; exit 1; }
