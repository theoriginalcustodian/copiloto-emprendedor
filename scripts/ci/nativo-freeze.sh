#!/usr/bin/env bash
# scripts/ci/nativo-freeze.sh — congelamiento nativo (plan beta-odobi §6, BL-B6).
#
# Desde la Ola 0 hasta el build EAS #2 ningún PR agrega ni sube de versión una dependencia con
# código nativo. Se hace cumplir mirando los dos archivos por los que entra: si `apps/mobile/package.json`
# o `apps/mobile/app.json` cambian respecto de `origin/main`, falla salvo que exista
# `NATIVO-APROBADO: <contrato>` en alguno de: la variable de entorno NATIVO_APROBADO, el body del PR
# (GitHub Actions: GITHUB_EVENT_PATH) o un mensaje de commit del rango.
#
# Sin `origin/main` resoluble (clon superficial) avisa y NO bloquea: fail-open explícito, no silencioso.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BASE_REF="${NATIVO_BASE_REF:-origin/main}"
ARCHIVOS=(apps/mobile/package.json apps/mobile/app.json)

if ! BASE="$(git -C "$ROOT" merge-base HEAD "$BASE_REF" 2>/dev/null)"; then
  echo "nativo-freeze: ⚠️ sin merge-base con $BASE_REF — guard NO evaluado" >&2
  exit 0
fi

CAMBIADOS="$(git -C "$ROOT" diff --name-only "$BASE" HEAD -- "${ARCHIVOS[@]}")"
if [ -z "$CAMBIADOS" ]; then
  echo "nativo-freeze: ok (sin cambios en ${ARCHIVOS[*]})"
  exit 0
fi

PATRON='NATIVO-APROBADO:[[:space:]]*[^[:space:]]+'
CUERPO_PR=""
if [ -n "${GITHUB_EVENT_PATH:-}" ] && [ -f "$GITHUB_EVENT_PATH" ]; then
  CUERPO_PR="$(node -e 'try{const e=require(process.argv[1]);process.stdout.write((e.pull_request&&e.pull_request.body)||"")}catch(_){}' "$GITHUB_EVENT_PATH")"
fi
MENSAJES="$(git -C "$ROOT" log --format=%B "$BASE..HEAD")"

if printf '%s\n%s\n%s\n' "${NATIVO_APROBADO:+NATIVO-APROBADO: $NATIVO_APROBADO}" "$CUERPO_PR" "$MENSAJES" | grep -Eq "$PATRON"; then
  echo "nativo-freeze: cambios en [$(echo $CAMBIADOS)] con NATIVO-APROBADO — permitido"
  exit 0
fi

echo "nativo-freeze: ❌ cambian archivos que pueden traer código nativo y no hay 'NATIVO-APROBADO: <contrato>':" >&2
echo "$CAMBIADOS" | sed 's/^/   - /' >&2
echo "   Congelamiento hasta el build #2 (plan §6). Excepción: la aprueba planificación con el operador." >&2
exit 1
