#!/usr/bin/env bash
# scripts/device/instalar-dev-client.sh — BL-O9 / build #0 (§6): instala en el teléfono conectado el APK
# `development` EXISTENTE de EAS (no compila nada). Idempotente: si ya está instalado, no reinstala.
# Uso: bash scripts/device/instalar-dev-client.sh [--forzar]
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PKG="app.copiloto.emprendedor"
adb get-state >/dev/null 2>&1 || { echo "sin device en adb" >&2; exit 2; }
if adb shell pm list packages | grep -q "package:$PKG" && [ "${1:-}" != "--forzar" ]; then
  echo "ya instalado: $PKG"; exit 0
fi
URL="$(cd "$ROOT/apps/mobile" && npx eas-cli build:list --platform android --profile development --limit 1 --json --non-interactive | node -e 'const b=JSON.parse(require("fs").readFileSync(0,"utf8"))[0];if(!b||b.status!=="FINISHED")process.exit(3);process.stdout.write(b.artifacts.buildUrl)')"
APK="${TMPDIR:-/tmp}/copiloto-dev-client.apk"
curl -fsSL -o "$APK" "$URL"
echo "APK $(du -h "$APK" | cut -f1) de $URL"
adb install -r "$APK"
adb shell pm list packages | grep "package:$PKG"
