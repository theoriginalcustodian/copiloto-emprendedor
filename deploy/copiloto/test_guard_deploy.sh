#!/usr/bin/env bash
# Controles de deploy/copiloto/guard-deploy.sh (BL-B7): árbol limpio, HEAD == origin/main, candado
# con TTL y escape explícito. HERMÉTICO: un `origin` bare local + un clon, todo en un temp.
#
# 🔴 HISTORIA (2026-10-13). Vivía en `scripts/test-guard-deploy.sh` con CERO invocadores y con un
# worktree `C:/gfw-src/wt-deploy` de default. Peor que la ruta hardcodeada: el candado vive en el
# `git-common-dir` del repo del worktree, así que ese test hacía `rm -rf` del `uc-deploy.lock` REAL
# del repo —el que protege un deploy en curso— al arrancar y al terminar, y dependía de que otra
# sesión hubiera dejado `wt-deploy` limpio y en `origin/main`. Con el origin local el candado cae en
# el temp y el test no puede pisar el de nadie.
#
# Va en `deploy/copiloto/test_*.sh` porque `scripts/ci/lint.sh` recorre ese glob con denominador
# (`tests-coordinacion.sh`): un test sin invocador no falla nunca, se pudre en silencio.
#
# Casos (cada «negativo» tiene su «positivo» contraparte, para que un guard que rechaza TODO no pase):
#   1. negativo  HEAD en rama con un commit que origin/main no tiene      -> rechazado
#   2. positivo  limpio y en origin/main                                  -> pasa
#   3. positivo  el trap libera el candado al salir
#   4. negativo  candado tomado y fresco                                  -> rechazado
#   5. positivo  candado vencido (TTL)                                    -> se toma
#   6. negativo  árbol sucio                                              -> rechazado
#   7. positivo  escape UC_DEPLOY_FUERA_DE_MAIN=1 en rama                 -> pasa (con aviso)
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
G="$ROOT/deploy/copiloto/guard-deploy.sh"
T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
# Git for Windows no entiende `/tmp/...` (forma MSYS) en todos los subcomandos: la forma mixta sí.
command -v cygpath >/dev/null 2>&1 && T="$(cygpath -m "$T")"
fallos=0
ok()  { echo "  ✅ $1"; }
mal() { echo "  ❌ $1"; fallos=$((fallos+1)); }
echo "test_guard_deploy"
[ -f "$G" ] || { echo "  ❌ no existe $G — no mido nada"; exit 2; }

# --- fixture: origin bare + clon en main (limpio, HEAD == origin/main) ---------------------------
git init -q --bare -b main "$T/origin.git" || { echo "SETUP FALLO: origin"; exit 1; }
git -c init.defaultBranch=main init -q "$T/wt" || { echo "SETUP FALLO: clon"; exit 1; }
W="$T/wt"
g() { git -C "$W" -c user.name=t -c user.email=t@t -c core.autocrlf=false "$@"; }
echo base > "$W/f"; g add f; g commit -qm base
g remote add origin "$T/origin.git"; g push -q origin main 2>/dev/null || { echo "SETUP FALLO: push"; exit 1; }
g fetch -q origin main
LOCK="$(git -C "$W" rev-parse --path-format=absolute --git-common-dir)/uc-deploy.lock"
# El candado del fixture tiene que estar DENTRO del temp: si no, este test pisaría uno real.
case "$LOCK" in "$T"/*) ;; *) echo "  ❌ el candado del fixture ($LOCK) cae fuera de $T — no corro"; exit 2 ;; esac
rm -rf "$LOCK"

run() { bash -c "source '$G'; guard_deploy '$1' t"; }       # run <worktree>
chk() {  # chk <nombre> <rc esperado 0|1> <comando...>
  local n="$1" esp="$2" rc; shift 2
  if "$@" >"$T/out" 2>&1; then rc=0; else rc=1; fi
  if [ "$rc" = "$esp" ]; then ok "$n"; else mal "$n (rc=$rc, esperado $esp) · $(tail -2 "$T/out" | tr '\n' '|' | cut -c1-160)"; fi
}

# 1 — negativo: una rama con un commit que origin/main no tiene
g switch -q -c rama; echo x > "$W/g"; g add g; g commit -qm "solo en la rama"
chk "1 negativo: HEAD en rama (≠ origin/main) → rechazado" 1 run "$W"
g switch -q main; g branch -q -D rama

# 2 y 3 — positivo + el trap libera el candado
chk "2 positivo: limpio y en origin/main → pasa" 0 run "$W"
if [ -d "$LOCK" ]; then mal "3 el candado quedó tomado tras salir"; else ok "3 el trap libera el candado"; fi

# 4 — negativo: candado fresco de otro
mkdir "$LOCK"; echo "otro" > "$LOCK/dueno"
chk "4 negativo: candado tomado y fresco → rechazado" 1 run "$W"

# 5 — positivo: el mismo candado, vencido
touch -d '2 hours ago' "$LOCK"
chk "5 positivo: candado vencido (TTL) → se toma" 0 run "$W"
rm -rf "$LOCK"

# 6 — negativo: árbol sucio (archivo trackeado modificado)
echo sucio >> "$W/f"
chk "6 negativo: árbol sucio → rechazado" 1 run "$W"
g checkout -q -- f

# 7 — escape explícito, en una rama que NO está en origin/main
g switch -q -c rama2; echo y > "$W/h"; g add h; g commit -qm "otra"
chk "7 positivo: UC_DEPLOY_FUERA_DE_MAIN=1 en rama → pasa (con aviso)" 0 \
    env UC_DEPLOY_FUERA_DE_MAIN=1 bash -c "source '$G'; guard_deploy '$W' t"
grep -q "UC_DEPLOY_FUERA_DE_MAIN=1" "$T/out" && ok "7b el escape avisa por stderr" || mal "7b el escape no avisó"
rm -rf "$LOCK"

[ "$fallos" -eq 0 ] && { echo "==> ✅ guard-deploy: todos los controles OK"; exit 0; } \
                    || { echo "==> ❌ $fallos fallo(s)"; exit 1; }
