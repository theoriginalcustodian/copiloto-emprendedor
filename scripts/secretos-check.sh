#!/usr/bin/env bash
# secretos-check.sh (BL-B3) — gitleaks fijado, fail-closed. El repo es PÚBLICO.
#   --arbol               el ÁRBOL DE TRABAJO actual, sin git (lint.sh / CI): huellas sin SHA
#                         (`archivo:regla:línea`), estables sea cual sea la profundidad del checkout
#                         -- un checkout superficial (actions/checkout, depth=1) no tiene historia:
#                         un escaneo por commits ahí re-detecta el MISMO contenido bajo un SHA nuevo
#                         que ninguna allowlist por-commit puede prever (medido: CI real, 2026-09-21).
#   --historia            toda la historia alcanzable (auditoría manual, one-off; NO la corre CI)
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

# gitleaks devuelve rc=1 por DOS causas distintas — «encontré un secreto» y «no pude cargar la
# config» — y este script las mapeaba al mismo mensaje. Medido el 2026-09-22 (test M-3): con
# `MSYS_NO_PATHCONV=1` heredada del entorno, gitleaks (binario nativo) recibe $ROOT en formato MSYS,
# no puede cargar .gitleaks.toml y sale 1. Dos casos de un test adversarial se anunciaron
# «ABORTA · hallazgo» habiendo abortado SIN ESCANEAR NADA — el veredicto era falso y parecía correcto.
# Sigue siendo fail-closed, pero mandaba a buscar un secreto inexistente, y eso empuja al `--no-verify`,
# que apaga el hook ENTERO. El discriminante es la línea FTL de gitleaks, no su código de salida.
reportar_rc() {   # $1 = rc · $2 = archivo con la salida capturada (opcional)
  if [ "$1" = "1" ] && [ -n "${2:-}" ] && [ -f "$2" ] \
     && grep -qE '(^|[[:space:]])FTL([[:space:]]|$)|unable to load|failed to load|error parsing' "$2"; then
    fatal "gitleaks NO pudo cargar su configuración: el escaneo NUNCA CORRIÓ (ver el FTL arriba).
         NO es un hallazgo. Causa típica: MSYS_NO_PATHCONV=1 exportada — gitleaks es un binario
         nativo y recibe '$ROOT' en formato MSYS. Corré el escaneo sin esa variable exportada."
  fi
  case "$1" in 0) return 0 ;; 1) echo "[secretos] ❌ gitleaks encontró posibles secretos (ver arriba). Repo PÚBLICO: no lo pushees." >&2; return 1 ;;
    *) fatal "gitleaks falló con rc=$1" ;; esac
}

# La salida se captura para poder LEERLA (el discriminante FTL de arriba) y se reemite íntegra a
# stderr: sin capturarla, la única señal disponible es el rc, que es justamente el que no distingue.
GL_TMPS=""
correr_gitleaks() {   # "$@" = args de gitleaks; deja la salida en $SALIDA_GL, devuelve el rc real
  local rc=0
  SALIDA_GL="$(mktemp)"; GL_TMPS="$GL_TMPS $SALIDA_GL"
  "$BIN" "$@" > "$SALIDA_GL" 2>&1 || rc=$?
  cat "$SALIDA_GL" >&2
  return "$rc"
}
trap '[ -n "${GL_TMPS:-}" ] && rm -f $GL_TMPS' EXIT

escanear() {   # $1 = log-opts opcional (modo `git`, historia)
  local rc=0
  if [ -n "${1:-}" ]; then correr_gitleaks git "${COMUN[@]}" --log-opts="$1" . || rc=$?
  else correr_gitleaks git "${COMUN[@]}" . || rc=$?
  fi
  reportar_rc "$rc" "${SALIDA_GL:-}"
}

escanear_arbol() {   # modo `detect --no-git`: el checkout actual, sin depender de cuánta historia haya
  local rc=0
  # -s . (relativo, con cwd=ROOT ya seteado arriba), NO -s "$ROOT": una ruta absoluta hace que el
  # fingerprint incluya el path absoluto (`C:/gfw-src/wt-a16/docs/...`), que nunca matchea un
  # .gitleaksignore escrito en rutas relativas -- medido corriendo el script tal cual esta línea decía.
  correr_gitleaks detect --no-git -s . "${COMUN[@]}" || rc=$?
  reportar_rc "$rc" "${SALIDA_GL:-}"
}

modo="${1:-}"
case "$modo" in
  --bin) echo "$BIN" ;;
  --arbol) escanear_arbol ;;
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
  *) echo "uso: $0 --arbol | --historia | --rango <a>..<b> | --refs-stdin" >&2; exit 2 ;;
esac
