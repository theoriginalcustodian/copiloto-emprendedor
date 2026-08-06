#!/usr/bin/env bash
# Escribe en .claude/settings.local.json los permisos que el operador ya autorizó de forma
# permanente (CLAUDE.md §3 regla 8), para que ninguna sesión tenga que pedir un "SI".
#
# POR QUÉ: la autorización vivía sólo como doctrina en prosa mientras el bloqueo real era
# MECÁNICO — el clasificador de permisos lee JSON, no CLAUDE.md. Esto convierte la política en
# configuración. El 2026-08-06 dos PR de rescate quedaron parados por esa brecha.
#
# NO usa bypassPermissions: eso dejaría pasar CUALQUIER comando, incluido borrar el repo, y no es
# lo que el operador autorizó. Cada regla es un prefijo concreto y auditable, y las destructivas
# quedan en deny EXPLÍCITO para que ningún allow ancho las arrastre.
#
# IDEMPOTENTE: correlo N veces, mismo resultado. Sólo agrega lo que falta.
set -uo pipefail
cd "$(git rev-parse --show-toplevel)" || exit 1
S=".claude/settings.local.json"
command -v jq >/dev/null || { echo "falta jq"; exit 2; }

ALLOW=(
  "Bash(gh pr create:*)" "Bash(gh pr merge:*)" "Bash(gh pr view:*)" "Bash(gh pr list:*)"
  "Bash(gh pr checks:*)" "Bash(gh pr diff:*)" "Bash(gh run list:*)" "Bash(gh run view:*)"
  "Bash(gh api:*)"
  "Bash(git push:*)" "Bash(git fetch:*)" "Bash(git worktree:*)" "Bash(git branch:*)"
  "Bash(git commit:*)" "Bash(git add:*)" "Bash(git status:*)" "Bash(git log:*)"
  "Bash(git diff:*)" "Bash(git show:*)" "Bash(git ls-remote:*)" "Bash(git rev-list:*)"
  "Bash(git rev-parse:*)" "Bash(git merge-base:*)" "Bash(git cat-file:*)" "Bash(git for-each-ref:*)"
  "Bash(bash scripts/:*)" "Bash(bash deploy/copiloto/deploy.sh:*)"
  "Bash(bash deploy/copiloto/sync-web.sh:*)" "Bash(bash deploy/copiloto/sync-test-backend.sh:*)"
  "Bash(bash deploy/copiloto/verificar-rls.sh:*)" "Bash(bash test-db.sh:*)"
  "Bash(pytest:*)" "Bash(npm test:*)" "Bash(npm run:*)" "Bash(npx vitest:*)"
  "Bash(npx jest:*)" "Bash(npx tsc:*)" "Bash(npx eslint:*)"
  "Bash(ls:*)" "Bash(stat:*)" "Bash(date:*)" "Bash(find:*)" "Bash(wc:*)" "Bash(grep:*)"
)

DENY=(
  "Bash(git push --force:*)" "Bash(git push -f:*)" "Bash(git reset --hard:*)"
  "Bash(git clean:*)" "Bash(rm -rf:*)"
)

mkdir -p .claude
[ -f "$S" ] || echo '{}' > "$S"
jq empty "$S" 2>/dev/null || { echo "$S no es JSON valido — no lo toco. Arreglalo primero."; exit 2; }
cp "$S" "$S.bak-$(date +%H%M%S)"
a0=$(jq '(.permissions.allow // []) | length' "$S")

t=$(mktemp); ta=$(mktemp); td=$(mktemp)
trap 'rm -f "$t" "$ta" "$td"' EXIT
# Los valores se pasan como argumentos, nunca interpolados en el programa jq.
printf '%s\n' "${ALLOW[@]}" | jq -R . | jq -s . > "$ta"
printf '%s\n' "${DENY[@]}"  | jq -R . | jq -s . > "$td"
jq --slurpfile na "$ta" --slurpfile nd "$td" '
  .permissions //= {}
  | .permissions.allow = ((.permissions.allow // []) + $na[0] | unique)
  | .permissions.deny  = ((.permissions.deny  // []) + $nd[0] | unique)
' "$S" > "$t" && mv "$t" "$S"

# Control: "no falló" no prueba que las reglas quedaron. Se verifican una por una.
faltan=0
for r in "${ALLOW[@]}"; do
  jq -e --arg r "$r" '.permissions.allow|index($r)' "$S" >/dev/null || { echo "  NO quedo: $r"; faltan=$((faltan+1)); }
done
for r in "${DENY[@]}"; do
  jq -e --arg r "$r" '.permissions.deny|index($r)' "$S" >/dev/null || { echo "  NO quedo (deny): $r"; faltan=$((faltan+1)); }
done

echo "allow: $a0 -> $(jq '.permissions.allow|length' "$S")  ·  deny: $(jq '.permissions.deny|length' "$S")"
if [ "$faltan" != "0" ]; then echo "FALTAN $faltan reglas — revisá antes de confiar."; exit 1; fi
echo "OK: $(( ${#ALLOW[@]} + ${#DENY[@]} )) reglas aplicadas y verificadas una por una."
echo "Reinicia las sesiones abiertas: Claude Code lee la configuracion al arrancar."
