#!/usr/bin/env bash
# Runner del generador de la matriz del criterio 3.
#
# Por qué existe: el generador necesita CUATRO precondiciones (server del prototipo, `.env.e2e`,
# `NODE_PATH` con playwright-core, `CHROME_PATH`) y ninguna es deducible. Estaban escritas en el
# header del script y en `pwa-lib.mjs:2` — y aun así las perdí corriéndolo, que es el dato: una
# precondición que se resuelve a mano en cada corrida se pierde en la corrida en que uno tiene apuro.
#
# Cada resolución falla con el comando exacto que la arregla. No adivina: si no puede, para.
#
# Uso:  ./scripts/evidencia/correr-criterio3.sh [id,id,...]     (sin ids = los del default)
set -uo pipefail

REPO_PPAL="C:/Proyectos/Claude/Claude code/copiloto-emprendedor"
AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
falta=0
aviso() { echo "✗ $1"; echo "  → $2"; falta=1; }

# 1. NODE_PATH — playwright-core no está instalado en el repo; en esta máquina sale del cache de npx.
if [ -z "${NODE_PATH:-}" ] || [ ! -d "${NODE_PATH:-/nada}/playwright-core" ]; then
  NODE_PATH="$(ls -d "$HOME/AppData/Local/npm-cache/_npx"/*/node_modules 2>/dev/null |
    while read -r d; do [ -d "$d/playwright-core" ] && echo "$d"; done | head -1)"
fi
[ -n "$NODE_PATH" ] && export NODE_PATH ||
  aviso "NODE_PATH sin playwright-core" "npx playwright@1.x --version  (deja el modulo en el cache de npx)"

# 2. CHROME_PATH — el chromium COMPLETO; el chrome-headless-shell suele faltar para la version pedida.
if [ -z "${CHROME_PATH:-}" ] || [ ! -f "${CHROME_PATH:-/nada}" ]; then
  CHROME_PATH="$(ls -d "$HOME/AppData/Local/ms-playwright"/chromium-*/chrome-win64/chrome.exe 2>/dev/null |
    sort -V | tail -1)"
fi
[ -n "$CHROME_PATH" ] && export CHROME_PATH ||
  aviso "CHROME_PATH sin chromium completo" "npx playwright install chromium"

# 3. .env.e2e — NO se copia al worktree: es un secreto y el repo es publico. Se apunta.
if [ -z "${ENV_E2E:-}" ] || [ ! -f "${ENV_E2E:-/nada}" ]; then
  [ -f "$AQUI/.env.e2e" ] && ENV_E2E="$AQUI/.env.e2e" || ENV_E2E="$REPO_PPAL/.env.e2e"
fi
[ -f "$ENV_E2E" ] && export ENV_E2E ||
  aviso ".env.e2e no encontrado" "ENV_E2E=<ruta al .env.e2e del checkout principal> $0"

# 4. El server del prototipo. Se levanta solo si no esta: es efimero y read-only.
#
# La sonda pide LA MISMA URL que el generador (`criterio3-matriz.mjs:50`, PROTO_BASE + '/prototipo'),
# no la raiz. Y distingue los dos fallos, que piden arreglos opuestos:
#   - sin conexion  -> el server no esta: hay que levantarlo.
#   - HTTP != 200   -> el server ESTA y el path no existe: se sirvio el directorio equivocado.
# La primera version de esta sonda pedia `/index.html`, cobraba el 404 con `curl -f` y reportaba
# «el prototipo no responde» — mandando a depurar un server que andaba perfecto. Un control que
# comprueba un recurso distinto del que usa el sistema vigilado no vigila ese sistema.
PROTO_PORT="${PROTO_PORT:-8123}"
export PROTO_PORT
PROTO_DIR="$REPO_PPAL/Prototipo frontend/odobi-ui"   # se sirve la RAIZ: el HTML pide `../assets/fonts/`
PROTO_URL="http://localhost:$PROTO_PORT/prototipo/"

sonda() { curl -s -o /dev/null -w '%{http_code}' --max-time 3 "$PROTO_URL" 2>/dev/null; }

codigo="$(sonda)"
if [ "$codigo" != "200" ]; then
  if [ "$codigo" != "000" ]; then
    # Hay alguien escuchando y contesta otra cosa: casi siempre es el directorio equivocado.
    aviso "el server de :$PROTO_PORT contesta HTTP $codigo en /prototipo/ (esta vivo, el path no existe)"       "esta sirviendo otro directorio; matalo y levantalo desde: '$PROTO_DIR'"
  elif [ -d "$PROTO_DIR/prototipo" ]; then
    echo "· levantando el prototipo en :$PROTO_PORT"
    (cd "$PROTO_DIR" && exec python -m http.server "$PROTO_PORT" >/dev/null 2>&1) &
    for _ in $(seq 1 20); do [ "$(sonda)" = "200" ] && break; sleep 0.5; done
    [ "$(sonda)" = "200" ] ||
      aviso "el prototipo no levanta en :$PROTO_PORT" "cd '$PROTO_DIR' && python -m http.server $PROTO_PORT"
  else
    aviso "no existe '$PROTO_DIR/prototipo'" "verifica la ruta del prototipo en el checkout principal"
  fi
fi

[ "$falta" -eq 0 ] || { echo; echo "ABORTO: faltan precondiciones. No se mide nada."; exit 2; }

echo "✓ NODE_PATH   $NODE_PATH"
echo "✓ CHROME_PATH $CHROME_PATH"
echo "✓ ENV_E2E     $ENV_E2E   (no se imprime su contenido)"
echo "✓ prototipo   $PROTO_URL  (HTTP 200)"
echo

# La variable del generador es SOLO_IDS. Se acepta como argumento para no tener que recordarlo:
# pasarle `IDS=` (que no existe) hace que mida los 7 del default creyendo que mide los que pediste.
[ $# -ge 1 ] && export SOLO_IDS="$1"
[ -n "${SOLO_IDS:-}" ] && echo "· midiendo SOLO: $SOLO_IDS" || echo "· midiendo los ids del default"

cd "$AQUI" && node scripts/evidencia/criterio3-matriz.mjs
salida=$?
echo
echo "EXIT REAL DEL GENERADOR: $salida"   # nunca detrás de un pipe ni de otro comando
exit $salida
