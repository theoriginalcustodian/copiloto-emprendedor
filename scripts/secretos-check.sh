#!/usr/bin/env bash
# secretos-check.sh (BL-B3) — gitleaks fijado, fail-closed. El repo es PÚBLICO.
#   --historia           toda la historia alcanzable (lint.sh / CI)
#   --rango <a>..<b>     sólo esos commits (pre-push)
#   --bin                imprime la ruta del gitleaks fijado (lo usan los tests)
#   --refs-stdin         líneas de pre-push: "<local_ref> <local_sha> <remote_ref> <remote_sha>"
# Exit 0 limpio · 1 hallazgos · 2 no se pudo correr el escáner (NUNCA se trata como limpio).
# El binario se baja UNA vez a .tools/ (gitignored) y se verifica contra el sha256 fijado abajo;
# si ya hay un gitleaks de esa versión exacta en el PATH, se usa ése.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

GL_VERSION="8.30.1"
SHA_LINUX="551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb"
SHA_WINDOWS="d29144deff3a68aa93ced33dddf84b7fdc26070add4aa0f4513094c8332afc4e"
ZERO="0000000000000000000000000000000000000000"

fatal() { echo "[secretos] ❌ $*" >&2; exit 2; }

resolver_binario() {
  local exe="${GITLEAKS_BIN:-}"
  if [ -n "$exe" ]; then echo "$exe"; return; fi
  if command -v gitleaks >/dev/null 2>&1 && [ "$(gitleaks version 2>/dev/null)" = "$GL_VERSION" ]; then
    command -v gitleaks; return
  fi
  local dir="$ROOT/.tools/gitleaks-$GL_VERSION" ext="" url sha arch
  case "$(uname -s)" in
    MINGW*|MSYS*|CYGWIN*) ext=".exe"; arch="windows_x64.zip"; sha="$SHA_WINDOWS" ;;
    Linux) arch="linux_x64.tar.gz"; sha="$SHA_LINUX" ;;
    *) fatal "SO no soportado para bajar gitleaks ($(uname -s)); instalá gitleaks $GL_VERSION y ponelo en el PATH" ;;
  esac
  if [ ! -x "$dir/gitleaks$ext" ]; then
    mkdir -p "$dir"
    url="https://github.com/gitleaks/gitleaks/releases/download/v$GL_VERSION/gitleaks_${GL_VERSION}_$arch"
    curl -fsSL "$url" -o "$dir/pkg" || fatal "no pude bajar $url"
    [ "$(sha256sum "$dir/pkg" | cut -d' ' -f1)" = "$sha" ] || { rm -f "$dir/pkg"; fatal "sha256 de gitleaks NO coincide con el fijado (¿release adulterado?)"; }
    case "$arch" in
      *.zip) (cd "$dir" && unzip -oq pkg gitleaks.exe) ;;
      *) tar -xzf "$dir/pkg" -C "$dir" gitleaks ;;
    esac
    rm -f "$dir/pkg"
  fi
  echo "$dir/gitleaks$ext"
}

BIN="$(resolver_binario)"
[ "$("$BIN" version 2>/dev/null)" = "$GL_VERSION" ] || fatal "el binario '$BIN' no es gitleaks $GL_VERSION"
COMUN=(--redact --no-banner --config "$ROOT/.gitleaks.toml" --gitleaks-ignore-path "$ROOT/.gitleaksignore")

escanear() {   # $1 = log-opts opcional
  local rc=0
  if [ -n "${1:-}" ]; then "$BIN" git "${COMUN[@]}" --log-opts="$1" . || rc=$?
  else "$BIN" git "${COMUN[@]}" . || rc=$?
  fi
  # gitleaks: 1 = hallazgos (exit-code por defecto); cualquier otro rc≠0 es fallo del escáner.
  case "$rc" in 0) return 0 ;; 1) echo "[secretos] ❌ gitleaks encontró posibles secretos (ver arriba). Repo PÚBLICO: no lo pushees." >&2; return 1 ;;
    *) fatal "gitleaks falló con rc=$rc" ;; esac
}

modo="${1:-}"
case "$modo" in
  --bin) echo "$BIN" ;;
  --historia) escanear "" ;;
  --rango) [ -n "${2:-}" ] || fatal "--rango necesita <a>..<b>"; escanear "$2" ;;
  --refs-stdin)
    rc=0
    while read -r _lref lsha _rref rsha; do
      [ -n "${lsha:-}" ] || continue
      [ "$lsha" = "$ZERO" ] && continue                       # borrado de rama: nada que escanear
      if [ "$rsha" = "$ZERO" ]; then rango="$lsha --not --remotes"   # rama nueva: lo que ningún remoto tiene
      else rango="$rsha..$lsha"; fi
      echo "[secretos] escaneando $rango"
      escanear "$rango" || rc=1
    done
    exit "$rc" ;;
  *) echo "uso: $0 --historia | --rango <a>..<b> | --refs-stdin" >&2; exit 2 ;;
esac
