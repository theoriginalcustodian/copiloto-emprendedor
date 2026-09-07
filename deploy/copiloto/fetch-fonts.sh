#!/usr/bin/env bash
# deploy/copiloto/fetch-fonts.sh — baja los .woff2 self-hosted del cliente PWA (Task 2, plan
# 2026-07-03-copiloto-cliente-web.md) + del shell de ESCRITORIO (DESIGN-SYSTEM-EXTRACT-WEB.md,
# 2026-07-04). Self-hosted = offline/CSP-safe: la app NUNCA pega a un CDN de fuentes en runtime;
# esto corre en build-time (VPS, orquestado por sync-web.sh) o a mano en un dev-box con red.
#
# Fuentes (verificado contra el markup real de cada mock — mobile y desktop usan DOS combos
# tipográficos distintos por diseño, no por error, ver EXTRACT-WEB §1.1/§6):
#   Clash Display   600,700     -> Fontshare API      (mobile · @font-face -> parseamos el primer url() woff2)
#   General Sans    400,500,600 -> Fontshare API      (mobile · idem)
#   Plus Jakarta Sans 700 (Bold) -> CONVERSIÓN local, no CDN (desktop · rebrand Odobi v2,
#                                  2026-09-07, contrato FE1 §Tarea 2 — reemplaza a Space Grotesk.
#                                  Igual que NeueEinstellung: el equipo de diseño ya midió CON
#                                  fontTools el .ttf real que usa el monograma de marca, así que
#                                  se convierte ESE archivo, no uno servido por un CDN que puede
#                                  versionar distinto. Licencia OFL — sin la deuda de licencia que
#                                  tenía NeueEinstellung).
#   Inter          400,500,600  -> Google Fonts CSS2   (desktop · rebrand Odobi v2, reemplaza a
#                                  Manrope. Subset "latin", mismo mecanismo que Manrope antes.
#                                  600 se fetchea aunque el canon de diseño sólo cite 400/500: el
#                                  código YA lo pide en varios módulos vía `--font-mono` retirado,
#                                  ver `fonts.css`)
#   NeueEinstellung 700 (Bold)  -> CONVERSIÓN local, no CDN (mobile · fuente propia, sin
#                                  distribución pública vía Fontshare/Google) -- fuente .otf en el
#                                  repo, convertida a .woff2 con fontTools (ver ODOBI hito 3v).
#                                  Licencia: ver nota en
#                                  docs/copiloto-emprendedor/2026-08-05-DoD-sprint-odobi.md §2.6 y
#                                  el PR de este cambio -- deuda declarada, no bloqueante para la
#                                  beta. ⚠️ El canon de diseño (`Prototipo frontend/odobi-ui/
#                                  CLAUDE.md` §3) ya reemplazó esta fuente por Plus Jakarta Sans
#                                  para el shell mobile TAMBIÉN (06-07/08) — pero `fonts.css`
#                                  (mobile-shell default) NO es archivo de este contrato (sólo
#                                  `fonts-web.css`, desktop): migrarlo es una decisión de blast-
#                                  radius grande (afecta TODO módulo sin override de desktop) que
#                                  no estaba pedida explícitamente, así que queda fuera, escalada
#                                  por buzón en vez de tocada de arrastre.
#   JetBrains Mono               -> RETIRADO (2026-09-07, contrato FE1 §Tarea 2). Ya no se fetchea.
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
#   UC_GOOGLE_FONTS_API  base de la API CSS2 de Google Fonts  (default: https://fonts.googleapis.com/css2)
#   UC_NEUE_EINSTELLUNG_SRC  .otf fuente de NeueEinstellung Bold (default: <repo>/docs/Imagen de marca/Neue_Einstellung/Hanken Design Co - Neue Einstellung Bold.otf)
#   UC_PLUS_JAKARTA_SRC  .ttf fuente de Plus Jakarta Sans Bold  (default: <repo>/Prototipo frontend/odobi-ui/assets/fonts/PlusJakartaSans-Bold.ttf)
#   UC_PYTHON_BIN        intérprete con fontTools+brotli       (default: python3)
set -euo pipefail

LOCAL="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
FONTS_DIR="${UC_FONTS_DIR:-$LOCAL/apps/copiloto-web/src/design-system/fonts}"
MIN_BYTES="${UC_FONT_MIN_BYTES:-2048}"
FONTSHARE_API="${UC_FONTSHARE_API:-https://api.fontshare.com/v2/css}"
GOOGLE_FONTS_API="${UC_GOOGLE_FONTS_API:-https://fonts.googleapis.com/css2}"
NEUE_EINSTELLUNG_SRC="${UC_NEUE_EINSTELLUNG_SRC:-$LOCAL/docs/Imagen de marca/Neue_Einstellung/Hanken Design Co - Neue Einstellung Bold.otf}"
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

# --- NeueEinstellung Bold: CONVERSIÓN local (no hay CDN público para esta fuente) -----------------
# A diferencia de las 3 familias de arriba, NeueEinstellung no está en Fontshare/Google Fonts: el
# .otf vive en el repo (docs/Imagen de marca/Neue_Einstellung/) y se convierte a .woff2 con
# fontTools. Mismo criterio de idempotencia que download_url (needs_download), pero sin red.
echo "==> NeueEinstellung Bold: conversión local .otf -> .woff2 (sin CDN)"
NEUE_DEST="$FONTS_DIR/NeueEinstellung-Bold.woff2"
if needs_download "$NEUE_DEST"; then
  if [ ! -f "$NEUE_EINSTELLUNG_SRC" ]; then
    echo "  ! fuente .otf no encontrada: $NEUE_EINSTELLUNG_SRC" >&2
    echo "  ! seteá UC_NEUE_EINSTELLUNG_SRC o restaurá el archivo -- no hay fallback silencioso" >&2
    exit 1
  fi
  echo "  -> convirtiendo $(basename "$NEUE_EINSTELLUNG_SRC")"
  "$PYTHON_BIN" -c '
import sys
from fontTools.ttLib import TTFont
font = TTFont(sys.argv[1])
font.flavor = "woff2"
font.save(sys.argv[2])
' "$NEUE_EINSTELLUNG_SRC" "$NEUE_DEST.tmp"
  mv "$NEUE_DEST.tmp" "$NEUE_DEST"
else
  echo "  = $(basename "$NEUE_DEST") ya presente (idempotente, no-op)"
fi

echo "==> Fuentes en $FONTS_DIR:"
ls -la "$FONTS_DIR"/*.woff2
