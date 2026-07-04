#!/usr/bin/env bash
# deploy/copiloto/fetch-fonts.sh — baja los .woff2 self-hosted del cliente PWA (Task 2, plan
# 2026-07-03-copiloto-cliente-web.md). Self-hosted = offline/CSP-safe: la app NUNCA pega a un
# CDN de fuentes en runtime; esto corre en build-time (VPS, orquestado por sync-web.sh) o a mano
# en un dev-box con red.
#
# Fuentes (EXTRACT §1.1 — verificado contra el markup real, NO Space Grotesk/Manrope como asumía
# el brief original):
#   Clash Display  600,700     -> Fontshare API (CSS con @font-face -> parseamos el primer url() woff2)
#   General Sans   400,500,600 -> Fontshare API (idem)
#   JetBrains Mono 400,500,700 -> mirror jsdelivr/fontsource (archivo woff2 directo, sin parseo)
#
# IDEMPOTENTE: si el archivo destino YA existe y pesa más que UC_FONT_MIN_BYTES (real woff2 ronda
# los 15-40KB; un stub/placeholder committeado al repo pesa unos pocos bytes) NO vuelve a bajarlo.
# Esto es deliberado: permite versionar placeholders livianos en git (para que `vite build` no
# rompa por url() no resuelta antes del primer fetch real) sin que ese placeholder "engañe" al
# check de idempotencia y bloquee el reemplazo por el archivo real.
#
# Parametrizable (cero hardcoding):
#   UC_FONTS_DIR        destino de los .woff2                (default: <repo>/apps/copiloto-web/src/design-system/fonts)
#   UC_FONT_MIN_BYTES    umbral placeholder-vs-real, bytes    (default: 2048)
#   UC_FONTSHARE_API     base de la API CSS de Fontshare      (default: https://api.fontshare.com/v2/css)
#   UC_JETBRAINS_MIRROR  base del mirror woff2 de JetBrains Mono (default: https://cdn.jsdelivr.net/fontsource/fonts/jetbrains-mono@latest)
set -euo pipefail

LOCAL="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
FONTS_DIR="${UC_FONTS_DIR:-$LOCAL/apps/copiloto-web/src/design-system/fonts}"
MIN_BYTES="${UC_FONT_MIN_BYTES:-2048}"
FONTSHARE_API="${UC_FONTSHARE_API:-https://api.fontshare.com/v2/css}"
JETBRAINS_MIRROR="${UC_JETBRAINS_MIRROR:-https://cdn.jsdelivr.net/fontsource/fonts/jetbrains-mono@latest}"

mkdir -p "$FONTS_DIR"

# needs_download <path> -> 0 (sí, bajar) | 1 (no, ya está y es real)
needs_download() {
  local path="$1"
  if [ ! -f "$path" ]; then
    return 0
  fi
  local size
  size=$(wc -c < "$path" | tr -d ' ')
  [ "$size" -lt "$MIN_BYTES" ]
}

download_url() {
  local url="$1" dest="$2"
  if needs_download "$dest"; then
    echo "  -> bajando $(basename "$dest")"
    curl -fsSL "$url" -o "$dest.tmp"
    mv "$dest.tmp" "$dest"
  else
    echo "  = $(basename "$dest") ya presente (idempotente, no-op)"
  fi
}

# --- Fontshare (Clash Display + General Sans): 1 request de CSS, parseo de @font-face -------------
# Parseo en python3 (no awk/mawk): el `awk` default de Debian/Ubuntu suele ser `mawk`, que NO
# soporta la forma de 3 argumentos de match() (extensión gawk) -- usar awk portable hubiera sido
# frágil. python3 ya es una dependencia asumida por el resto de deploy/ (ver el paso Caddy de
# deploy/copiloto/deploy.sh, que hace exactamente lo mismo: parseo estructurado vía heredoc python3).
echo "==> Fontshare: clash-display@600,700 + general-sans@400,500,600"
FONTSHARE_CSS="$(curl -fsSL "${FONTSHARE_API}?f[]=clash-display@600,700&f[]=general-sans@400,500,600&display=swap")"

# map "familia|peso" -> nombre de archivo local esperado por fonts.css
declare -A FONTSHARE_MAP=(
  ["clash display|600"]="ClashDisplay-Semibold.woff2"
  ["clash display|700"]="ClashDisplay-Bold.woff2"
  ["general sans|400"]="GeneralSans-Regular.woff2"
  ["general sans|500"]="GeneralSans-Medium.woff2"
  ["general sans|600"]="GeneralSans-Semibold.woff2"
)

while IFS=$'\t' read -r family weight url; do
  [ -z "$family" ] && continue
  key="$(printf '%s' "$family" | tr '[:upper:]' '[:lower:]')|$weight"
  filename="${FONTSHARE_MAP[$key]:-}"
  if [ -z "$filename" ]; then
    echo "  ! bloque Fontshare sin mapeo conocido: family='$family' weight='$weight' (ignorado)" >&2
    continue
  fi
  download_url "https:$url" "$FONTS_DIR/$filename"
done < <(printf '%s' "$FONTSHARE_CSS" | python3 -c '
import re, sys
css = sys.stdin.read()
for block in re.findall(r"@font-face\s*\{([^}]*)\}", css):
    fam = re.search(r"font-family:\s*[\x27\"]([^\x27\"]+)[\x27\"]", block)
    weight = re.search(r"font-weight:\s*([0-9]+)", block)
    url = re.search(r"url\((?:\x27|\")(//[^)\x27\"]+\.woff2)(?:\x27|\")\)", block)
    if fam and weight and url:
        print(f"{fam.group(1)}\t{weight.group(1)}\t{url.group(1)}")
')

# --- JetBrains Mono: mirror jsdelivr/fontsource, un archivo woff2 por peso, sin parseo -------------
echo "==> JetBrains Mono (mirror fontsource/jsdelivr): 400,500,700"
declare -A JETBRAINS_MAP=(
  ["400"]="JetBrainsMono-Regular.woff2"
  ["500"]="JetBrainsMono-Medium.woff2"
  ["700"]="JetBrainsMono-Bold.woff2"
)
for weight in 400 500 700; do
  download_url "$JETBRAINS_MIRROR/latin-$weight-normal.woff2" "$FONTS_DIR/${JETBRAINS_MAP[$weight]}"
done

echo "==> Fuentes en $FONTS_DIR:"
ls -la "$FONTS_DIR"/*.woff2
