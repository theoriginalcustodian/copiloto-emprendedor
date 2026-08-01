#!/usr/bin/env bash
# deploy/copiloto/provision-repo-autosanacion.sh — el clon donde el ciclo abre sus PRs.
#
# POR QUÉ EXISTE. `proponer_pr_de_reparacion` exige DOS condiciones para abrir un PR: `gh`
# autenticado **y** `COPILOTO_AUTOSANACION_REPO_GIT` apuntando a un repo de trabajo. Sin la segunda
# el ciclo degrada a dejar un `.patch` en `/tmp/autosanacion` — que es el default prudente para
# estrenar, pero también significa que el trabajo queda en un directorio que nadie visita.
#
# ⚠️ **NUNCA el repo desplegado.** El ciclo hace `checkout -b`, `add`, `commit` en el repo que se le
# declare. Apuntarlo a `/opt/uc-repos/copiloto` movería el código que el worker está sirviendo, en
# caliente. Hoy eso no puede pasar por accidente feliz —ese path ni siquiera es un repo git, es
# destino de `rsync`— pero "hoy no es un repo" no es un mecanismo: este clon separado sí lo es.
#
# IDEMPOTENTE: si el clon ya existe se actualiza (`fetch` + `reset --hard origin/main`) en vez de
# volver a clonar. El `reset --hard` es seguro **acá y sólo acá**: este clon no es de nadie, no tiene
# trabajo humano, y su única razón de existir es ser una base limpia de `origin/main` para ramificar.
# Las ramas viejas del ciclo se podan para que no se acumulen una por reparación.
#
# Parametrizable (cero hardcoding):
#   UC_DEPLOY_HOST     alias SSH del VPS            (default: unreal-copilot)
#   UC_ENV_DIR         dir de EnvironmentFile       (default: /etc/unreal-copilot)
#   UC_AUTOSAN_REPO    path del clon de trabajo     (default: /opt/uc-autosanacion-repo)
#   UC_AUTOSAN_ORIGIN  remoto a clonar              (default: el de este worktree)
set -euo pipefail

HOST="${UC_DEPLOY_HOST:-unreal-copilot}"
ENVDIR="${UC_ENV_DIR:-/etc/unreal-copilot}"
REPO="${UC_AUTOSAN_REPO:-/opt/uc-autosanacion-repo}"
ORIGIN="${UC_AUTOSAN_ORIGIN:-$(git -C "$(dirname "${BASH_SOURCE[0]}")/../.." remote get-url origin)}"

echo "==> Clon de trabajo del ciclo en $HOST:$REPO"

ssh "$HOST" bash -s -- "$REPO" "$ORIGIN" "$ENVDIR" <<'REMOTO'
set -euo pipefail
REPO="$1"; ORIGIN="$2"; ENVDIR="$3"
ENVFILE="$ENVDIR/copiloto.env"
VAR="COPILOTO_AUTOSANACION_REPO_GIT"

command -v gh >/dev/null || { echo "❌ falta \`gh\` en el VPS: sin él el ciclo no puede abrir PRs" >&2; exit 1; }
gh auth status >/dev/null 2>&1 || { echo "❌ \`gh\` sin credenciales: el ciclo degradaría a artefacto" >&2; exit 1; }

# `gh` autenticado NO implica que `git push` pueda autenticarse: son dos credenciales distintas.
# `gh pr create` usa el token de `gh`; `git push` usa el credential helper de git, y sin él no hay
# forma de responder al challenge de github.com — sin TTY, muere. El ciclo necesita LAS DOS, y le
# faltaba la segunda: vivía en `/root/.gitconfig` porque alguien corrió `setup-git` a mano una vez,
# no porque el provisionado la pusiera. Un reprovisionado del host la perdía en silencio.
gh auth setup-git    # idempotente: reescribe el helper por-host, no acumula

if [ -d "$REPO/.git" ]; then
  echo "    el clon ya existe: actualizando a origin/main"
  git -C "$REPO" fetch --quiet origin main
  git -C "$REPO" checkout --quiet -B main origin/main
  git -C "$REPO" reset --hard --quiet origin/main
  # Poda de ramas de reparaciones anteriores: una por intento se acumula rápido.
  podadas="$(git -C "$REPO" for-each-ref --format='%(refname:short)' refs/heads/ \
              | grep -E '^(autosanacion|reparacion)/' || true)"
  if [ -n "$podadas" ]; then
    printf '%s\n' "$podadas" | xargs -r git -C "$REPO" branch -D >/dev/null
    echo "    $(printf '%s\n' "$podadas" | wc -l) rama(s) de reparaciones viejas podadas"
  fi
else
  echo "    clonando (una sola vez)"
  git clone --quiet "$ORIGIN" "$REPO"
fi

# Identidad de los commits del ciclo. Explícita y reconocible: un commit sin autor claro en un PR
# automático es exactamente lo que hace que nadie sepa de dónde salió.
git -C "$REPO" config user.name  "Copiloto Autosanacion"
git -C "$REPO" config user.email "autosanacion@copilotoemprendedor.local"

TMP="$(mktemp)"; trap 'rm -f "$TMP"' EXIT
sudo grep -vE "^${VAR}=" "$ENVFILE" > "$TMP" || true
printf '%s=%s\n' "$VAR" "$REPO" >> "$TMP"
sudo install -m 600 -o root -g root "$TMP" "$ENVFILE"

# CONTROL, no "quedó escrito": se verifica lo que el ciclo va a mirar de verdad.
echo
echo "==> Control:"
echo "    repo git válido : $(git -C "$REPO" rev-parse --is-inside-work-tree)"
echo "    HEAD            : $(git -C "$REPO" rev-parse --short HEAD) ($(git -C "$REPO" rev-parse --abbrev-ref HEAD))"
echo "    gh autenticado  : $(gh auth status 2>&1 | grep -c 'Logged in') cuenta(s)"
echo "    $VAR      : $(sudo grep -E "^${VAR}=" "$ENVFILE" | cut -d= -f2-)"
# El control que importa: que NO sea el repo desplegado. Un `if` en un runbook se olvida; esto no.
DESPLEGADO="$(sudo grep -E '^WorkingDirectory=' /etc/systemd/system/uc-copiloto-worker.service 2>/dev/null | cut -d= -f2- || echo '')"
if [ -n "$DESPLEGADO" ] && [ "$(readlink -f "$REPO")" = "$(readlink -f "$DESPLEGADO")" ]; then
  echo "    ❌ ABORTA: el clon de trabajo ES el repo desplegado ($DESPLEGADO)." >&2
  echo "       El ciclo haría checkout sobre el código que el worker está sirviendo." >&2
  exit 1
fi
echo "    ✅ distinto del repo desplegado (${DESPLEGADO:-no declarado})"
REMOTO

echo
echo "==> El worker toma el valor en el próximo restart (EnvironmentFile se lee al arrancar)."
