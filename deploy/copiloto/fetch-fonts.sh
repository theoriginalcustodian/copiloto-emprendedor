#!/usr/bin/env bash
# deploy/copiloto/fetch-fonts.sh — baja los .woff2 self-hosted del cliente PWA (Task 2, plan
# 2026-07-03-copiloto-cliente-web.md) + del shell de ESCRITORIO (DESIGN-SYSTEM-EXTRACT-WEB.md,
# 2026-07-04). Self-hosted = offline/CSP-safe: la app NUNCA pega a un CDN de fuentes en runtime;
# esto corre en build-time (VPS, orquestado por sync-web.sh) o a mano en un dev-box con red.
#
# Fuentes (DEC-5 / BL-X6: la app usa Plus Jakarta Sans + Inter, igual que mobile):
#   Plus Jakarta Sans 700 (Bold) -> CONVERSIÓN local .ttf -> .woff2 (el .ttf que diseño midió con
#                                  fontTools; licencia OFL)
#   Inter          400,500,600  -> Google Fonts CSS2 (subset "latin")
# RETIRADAS: Clash Display, General Sans (ya no las nombra ningún token) y Neue Einstellung (licencia
# de app impaga; su archivo fuente ya no está en el árbol, así que este script fallaba al pedirla).
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
#   UC_GOOGLE_FONTS_API  base de la API CSS2 de Google Fonts  (default: https://fonts.googleapis.com/css2)
#   UC_PLUS_JAKARTA_SRC  .ttf fuente de Plus Jakarta Sans Bold  (default: <repo>/Prototipo frontend/odobi-ui/assets/fonts/PlusJakartaSans-Bold.ttf)
#   UC_PYTHON_BIN        intérprete con fontTools+brotli       (default: python3)
set -euo pipefail

LOCAL="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
FONTS_DIR="${UC_FONTS_DIR:-$LOCAL/apps/copiloto-web/src/design-system/fonts}"
MIN_BYTES="${UC_FONT_MIN_BYTES:-2048}"
GOOGLE_FONTS_API="${UC_GOOGLE_FONTS_API:-https://fonts.googleapis.com/css2}"
PLUS_JAKARTA_SRC="${UC_PLUS_JAKARTA_SRC:-$LOCAL/Prototipo frontend/odobi-ui/assets/fonts/PlusJakartaSans-Bold.ttf}"
PYTHON_BIN="${UC_PYTHON_BIN:-python3}"

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

# --- Google Fonts (Inter): shell de ESCRITORIO (rebrand Odobi v2, 2026-09-07) --------------------
# Reemplaza a Space Grotesk + Manrope (retiradas, contrato FE1 §Tarea 2). Mismo mecanismo que
# tenían ellas -> API css2, subset "latin" (1 subset, la app no necesita cirílico/vietnamita/etc).
# Google solo sirve woff2 con un User-Agent "moderno" en el request -- sin esto, cae a .woff/.ttf
# más viejo.
echo "==> Google Fonts: inter@400,500,600 (subset latin)"
GOOGLE_UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"
GOOGLE_FONTS_CSS="$(curl -fsSL -A "$GOOGLE_UA" "${GOOGLE_FONTS_API}?family=Inter:wght@400;500;600&display=swap")"

declare -A GOOGLE_MAP=(
  ["inter|400"]="Inter-Regular.woff2"
  ["inter|500"]="Inter-Medium.woff2"
  ["inter|600"]="Inter-Semibold.woff2"
)

while IFS=$'\t' read -r family weight url; do
  [ -z "$family" ] && continue
  key="$(printf '%s' "$family" | tr '[:upper:]' '[:lower:]')|$weight"
  filename="${GOOGLE_MAP[$key]:-}"
  if [ -z "$filename" ]; then
    echo "  ! bloque Google Fonts sin mapeo conocido: family='$family' weight='$weight' (ignorado)" >&2
    continue
  fi
  download_url "$url" "$FONTS_DIR/$filename"
done < <(printf '%s' "$GOOGLE_FONTS_CSS" | python3 -c '
import re, sys
css = sys.stdin.read()
for block in re.findall(r"@font-face\s*\{([^}]*)\}", css):
    # Google Fonts CSS2 devuelve un @font-face por SUBSET (cyrillic/vietnamese/latin-ext/latin/...)
    # -- nos quedamos solo con "latin" (firma: unicode-range arranca con U+0000-00FF).
    if "U+0000-00FF" not in block:
        continue
    fam = re.search(r"font-family:\s*[\x27\"]([^\x27\"]+)[\x27\"]", block)
    weight = re.search(r"font-weight:\s*([0-9]+)", block)
    url = re.search(r"url\((https://[^)\x27\"]+\.woff2)\)", block)
    if fam and weight and url:
        print(f"{fam.group(1)}\t{weight.group(1)}\t{url.group(1)}")
')

# --- Plus Jakarta Sans Bold: CONVERSIÓN local (mismo motivo que NeueEinstellung) ----------------
# A diferencia de Inter (Google Fonts arriba), el equipo de diseño ya midió con fontTools el .ttf
# real que define el glifo de la O del monograma de marca (`Prototipo frontend/odobi-ui/CLAUDE.md`
# §3) -- se convierte ESE archivo, no una copia que Google podría versionar distinto. Licencia OFL
# (`assets/fonts/PlusJakartaSans-OFL.txt`), sin la deuda de licencia que tenía NeueEinstellung.
echo "==> Plus Jakarta Sans Bold: conversión local .ttf -> .woff2 (sin CDN)"
PLUS_JAKARTA_DEST="$FONTS_DIR/PlusJakartaSans-Bold.woff2"
if needs_download "$PLUS_JAKARTA_DEST"; then
  if [ ! -f "$PLUS_JAKARTA_SRC" ]; then
    echo "  ! fuente .ttf no encontrada: $PLUS_JAKARTA_SRC" >&2
    echo "  ! seteá UC_PLUS_JAKARTA_SRC o restaurá el archivo -- no hay fallback silencioso" >&2
    exit 1
  fi
  echo "  -> convirtiendo $(basename "$PLUS_JAKARTA_SRC")"
  "$PYTHON_BIN" -c '
import sys
from fontTools.ttLib import TTFont
font = TTFont(sys.argv[1])
font.flavor = "woff2"
font.save(sys.argv[2])
' "$PLUS_JAKARTA_SRC" "$PLUS_JAKARTA_DEST.tmp"
  mv "$PLUS_JAKARTA_DEST.tmp" "$PLUS_JAKARTA_DEST"
else
  echo "  = $(basename "$PLUS_JAKARTA_DEST") ya presente (idempotente, no-op)"
fi

echo "==> Fuentes en $FONTS_DIR:"
ls -la "$FONTS_DIR"/*.woff2
