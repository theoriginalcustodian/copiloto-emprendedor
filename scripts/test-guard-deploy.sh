#!/usr/bin/env bash
# Controles de deploy/copiloto/guard-deploy.sh (BL-B7). Sólo lectura + un candado efímero: no despliega nada.
# Uso: bash scripts/test-guard-deploy.sh [<worktree-detached-sobre-origin/main>]   (default C:/gfw-src/wt-deploy)
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEPLOY_WT="${1:-C:/gfw-src/wt-deploy}"
G="$ROOT/deploy/copiloto/guard-deploy.sh"
fallos=0
chk() { # nombre esperado(0|1) comando...
  local n="$1" esp="$2"; shift 2
  if "$@" >/tmp/guard-test.out 2>&1; then rc=0; else rc=1; fi
  if [ "$rc" = "$esp" ]; then echo "ok   $n"; else echo "FAIL $n (rc=$rc, esperado $esp)"; sed 's/^/     /' /tmp/guard-test.out; fallos=$((fallos+1)); fi
}
run() { bash -c "source '$G'; guard_deploy '$1' t"; }
LOCK="$(git -C "$DEPLOY_WT" rev-parse --path-format=absolute --git-common-dir)/uc-deploy.lock"
rm -rf "$LOCK"

chk "negativo: worktree en RAMA (HEAD≠origin/main) → rechazado" 1 run "$ROOT"
chk "positivo: wt-deploy detached limpio en origin/main → pasa" 0 run "$DEPLOY_WT"
[ -d "$LOCK" ] && { echo "FAIL el candado quedó tomado tras salir"; fallos=$((fallos+1)); } || echo "ok   el trap libera el candado"
mkdir "$LOCK"; echo "otro" > "$LOCK/dueno"
chk "negativo: candado tomado y fresco → rechazado" 1 run "$DEPLOY_WT"
touch -d '2 hours ago' "$LOCK"
chk "positivo: candado vencido (TTL) → se toma" 0 run "$DEPLOY_WT"
rm -rf "$LOCK"
echo x > "$DEPLOY_WT/_sucio.tmp"
chk "negativo: árbol sucio → rechazado" 1 run "$DEPLOY_WT"
rm -f "$DEPLOY_WT/_sucio.tmp"
chk "escape explícito UC_DEPLOY_FUERA_DE_MAIN=1 en rama → pasa (con aviso)" 0 env UC_DEPLOY_FUERA_DE_MAIN=1 bash -c "source '$G'; guard_deploy '$ROOT' t"
rm -rf "$LOCK"
[ "$fallos" -eq 0 ] && echo "==> ✅ guard-deploy: todos los controles OK" || { echo "==> ❌ $fallos fallo(s)"; exit 1; }
