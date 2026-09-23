#!/usr/bin/env bash
# deploy/copiloto/guard-deploy.sh — todo deploy sale de origin/main, con candado (BL-B7). Se hace
# `source` desde deploy.sh y sync-web.sh; NO se ejecuta suelto.
#
# Por qué: `deploy.sh` y `sync-web.sh` suben el árbol LOCAL. Si una sesión despliega desde su rama,
# revierte en prod lo que otra mergeó un minuto antes (memoria/un-rebuild-desde-otra-base-revierte-
# un-fix-ya-cerrado.md). Tres reglas, las tres abortan:
#   1. el árbol está limpio (nada sin commitear entra al deploy sin que nadie lo vea);
#   2. HEAD == origin/main recién traído (se despliega lo mergeado, no lo que hay en una rama);
#   3. nadie más está desplegando: candado `mkdir` atómico con TTL, compartido por todos los
#      worktrees (vive en el git-common-dir) y liberado por `trap` al salir.
#
# Escape explícito y ruidoso, sólo para una rama de feature aislada A PROPÓSITO:
#   UC_DEPLOY_FUERA_DE_MAIN=1   (saltea 1 y 2; el candado sigue aplicando)
# Parámetros: UC_DEPLOY_LOCK_TTL_SEG (default 1800).
#
# Uso desde el script que lo sourcea:  guard_deploy "$LOCAL" "<nombre>"
guard_deploy() {
  local root="$1" quien="${2:-deploy}" ttl="${UC_DEPLOY_LOCK_TTL_SEG:-1800}"
  local rc=0

  if [ -n "${UC_DEPLOY_FUERA_DE_MAIN:-}" ]; then
    echo "⚠️  guard-deploy: UC_DEPLOY_FUERA_DE_MAIN=1 — se despliega SIN exigir HEAD==origin/main ni árbol limpio." >&2
  else
    git -C "$root" fetch origin main --quiet || { echo "ABORT [$quien]: no pude traer origin/main." >&2; return 1; }
    local sucio head main
    sucio="$(git -C "$root" status --porcelain | grep -v '^?? \.ci-recibos/' || true)"
    if [ -n "$sucio" ]; then
      echo "ABORT [$quien]: el árbol de $root no está limpio (el deploy subiría cambios sin commitear):" >&2
      echo "$sucio" | head -10 | sed 's/^/   /' >&2
      return 1
    fi
    head="$(git -C "$root" rev-parse HEAD)"; main="$(git -C "$root" rev-parse origin/main)"
    if [ "$head" != "$main" ]; then
      echo "ABORT [$quien]: HEAD ($head) ≠ origin/main ($main)." >&2
      echo "   Se despliega desde C:/gfw-src/wt-deploy en detached sobre origin/main (git switch --detach origin/main)." >&2
      return 1
    fi
  fi

  local lock
  lock="$(git -C "$root" rev-parse --path-format=absolute --git-common-dir)/uc-deploy.lock"
  if ! mkdir "$lock" 2>/dev/null; then
    local edad
    edad=$(( $(date +%s) - $(stat -c %Y "$lock" 2>/dev/null || echo 0) ))
    if [ "$edad" -gt "$ttl" ]; then
      echo "guard-deploy: candado vencido (${edad}s > ${ttl}s) — lo tomo. Dueño previo: $(cat "$lock/dueno" 2>/dev/null || echo ?)" >&2
      rm -rf "$lock"; mkdir "$lock" || { echo "ABORT [$quien]: no pude tomar el candado." >&2; return 1; }
    else
      echo "ABORT [$quien]: otro deploy en curso (candado de ${edad}s, TTL ${ttl}s): $(cat "$lock/dueno" 2>/dev/null || echo ?)" >&2
      return 1
    fi
  fi
  echo "$quien pid=$$ host=$(hostname) $(date -u +%FT%TZ)" > "$lock/dueno"
  # shellcheck disable=SC2064
  trap "rm -rf '$lock'" EXIT
  echo "==> guard-deploy [$quien]: ok (HEAD==origin/main, árbol limpio, candado tomado)"
  return $rc
}
