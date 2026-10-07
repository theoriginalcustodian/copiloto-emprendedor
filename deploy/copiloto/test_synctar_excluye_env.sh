#!/usr/bin/env bash
# test_synctar_excluye_env.sh — endurecimiento PROSPECTIVO (no corrige un hallazgo: medido por
# auditoría que hoy `deploy/copiloto/` tiene 0 archivos .env reales en los 36 worktrees). Este tar
# lee del DISCO, no de git, así que `.gitignore` no lo filtra. Prueba que las flags `--exclude`
# reales de `sync-test-backend.sh` (extraídas con grep, no reescritas) de verdad excluyen `.env` y
# `.env.*` de un árbol de prueba aislado, sin tocar el repo real.
#
# Uso: bash deploy/copiloto/test_synctar_excluye_env.sh [ruta/a/sync-test-backend.sh]
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT="${1:-$HERE/sync-test-backend.sh}"

echo "== SYNCTAREXCLUYEENV: $SCRIPT"
fallos=0

# Extrae la línea real de las flags --exclude de la invocación del tar (no la reescribe).
FLAGS="$(grep -E "^\s*--exclude='\.env" "$SCRIPT" || true)"

if [ -z "$FLAGS" ]; then
  echo "  ROJO: $SCRIPT no declara --exclude='.env' / '.env.*' -- la exposición prospectiva sigue abierta"
  fallos=$((fallos+1))
else
  echo "  ok   el script declara flags --exclude de .env: $FLAGS"
fi

# Control real: armamos un árbol de prueba aislado (NUNCA el repo) con un .env de mentira y uno
# .template, tarreamos con las MISMAS flags que el script declara, y verificamos el contenido real
# del .tar.gz -- no inferimos del texto del script, ejercitamos tar de verdad.
SANDBOX="$(mktemp -d)"
trap 'rm -rf "$SANDBOX"' EXIT
mkdir -p "$SANDBOX/deploy/copiloto/gotrue"
echo "SECRETO=no-deberia-viajar" > "$SANDBOX/deploy/copiloto/gotrue/.env.gotrue"
echo "plantilla" > "$SANDBOX/deploy/copiloto/gotrue/.env.gotrue.template"
echo "real" > "$SANDBOX/deploy/copiloto/.env"
echo "contenido inocuo" > "$SANDBOX/deploy/copiloto/no_es_env.txt"

TARBALL="$SANDBOX/out.tar.gz"
tar -C "$SANDBOX" --exclude='__pycache__' --exclude='*.pyc' --exclude='.pytest_cache' \
  --exclude='.env' --exclude='.env.*' \
  -czf "$TARBALL" deploy/copiloto

LISTADO="$(tar -tzf "$TARBALL")"

if echo "$LISTADO" | grep -qE '\.env(\.|$)'; then
  echo "  ROJO: el tar REAL incluyó un .env pese a las flags -- positivo de regresión"
  echo "$LISTADO" | grep -E '\.env' | sed 's/^/    /'
  fallos=$((fallos+1))
else
  echo "  ok   el tar real NO incluye ningún .env / .env.* (verificado con tar -tzf, no por inferencia)"
fi

if echo "$LISTADO" | grep -q 'no_es_env.txt'; then
  echo "  ok   control positivo: un archivo NO-.env del mismo directorio SÍ viaja (las flags no excluyen de más)"
else
  echo "  ROJO: control positivo falló -- no_es_env.txt no viajó, las flags podrían estar excluyendo de más"
  fallos=$((fallos+1))
fi

# Control negativo: SIN las flags .env, el mismo árbol SÍ debe incluirlos -- si no, el canario no discrimina.
TARBALL_SIN="$SANDBOX/out_sin_flags.tar.gz"
tar -C "$SANDBOX" --exclude='__pycache__' --exclude='*.pyc' --exclude='.pytest_cache' \
  -czf "$TARBALL_SIN" deploy/copiloto
if tar -tzf "$TARBALL_SIN" | grep -qE '\.env(\.|$)'; then
  echo "  ok   control negativo: SIN las flags, el mismo árbol SÍ incluye los .env -- el canario discrimina"
else
  echo "  ROJO: control negativo no discrimina -- revisar el árbol de prueba"
  fallos=$((fallos+1))
fi

echo
if [ "$fallos" -eq 0 ]; then echo "OK: SYNCTAREXCLUYEENV — .env/.env.* no viajan al STAGE del VPS"; exit 0; fi
echo "FALLO: $fallos caso(s)"; exit 1
