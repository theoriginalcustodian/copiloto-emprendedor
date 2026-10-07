#!/usr/bin/env bash
# test_redeploy_mismo_sha.sh — REDEPLOYMISMOSHA: re-correr el deploy desde el SHA que prod ya sirve NO
# debe borrar el dist vivo durante el build.
#
# Método: simula prod (`dist` -> `dist-$SHA` con un centinela) y ejecuta el bloque REAL de build de
# deploy.sh (extraído de su texto, no reescrito) con un `npx` stub. Control positivo: la versión vieja
# (bf406abe) DEBE perder el centinela; la nueva NO. Si ambas pasan, el test no discrimina y está roto.
#
# Uso: bash deploy/copiloto/test_redeploy_mismo_sha.sh [ruta/a/deploy.sh]
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY="${1:-$HERE/deploy.sh}"
SHA="aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"

# Bloque de build: desde el `rm -rf` (versión vieja) o el `export VITE_AUTH_URL` (nueva) hasta el echo.
extraer_build() {
  sed -n '/^\(rm -rf "dist-\$SHA"\|export VITE_AUTH_URL\)/,/^echo "frontend build OK/p' "$1"
}

correr_caso() {
  local nombre="$1" deploy="$2"
  local sandbox bin bloque
  sandbox="$(mktemp -d)"
  bin="$sandbox/bin"; mkdir -p "$bin"
  # npx stub: `tsc -b` no hace nada; `vite build --outDir X` escribe X/index.html con el SHA del env.
  cat > "$bin/npx" <<'STUB'
#!/usr/bin/env bash
if [ "$1" = "vite" ]; then
  out=""; while [ $# -gt 0 ]; do [ "$1" = "--outDir" ] && { out="$2"; shift; }; shift; done
  mkdir -p "$out"; echo "<html data-build-sha=\"$VITE_BUILD_SHA\"></html>" > "$out/index.html"
fi
exit 0
STUB
  chmod +x "$bin/npx"

  # Prod simulada: dist-$SHA publicado con centinela; `dist` (symlink) apunta a él.
  mkdir -p "$sandbox/apps/copiloto-web/dist-$SHA"
  echo "<html data-build-sha=\"$SHA\"></html>" > "$sandbox/apps/copiloto-web/dist-$SHA/index.html"
  echo vivo > "$sandbox/apps/copiloto-web/dist-$SHA/CENTINELA"
  ln -sfn "dist-$SHA" "$sandbox/apps/copiloto-web/dist"

  bloque="$(extraer_build "$deploy")"
  if [ -z "$bloque" ]; then echo "  [$nombre] ERROR: no encontré el bloque de build en $deploy"; rm -rf "$sandbox"; return 2; fi

  # Variables que deploy.sh fija antes del heredoc (la nueva: STG único; la vieja no lo usa).
  local stg="dist-$SHA-run$$"
  (
    set -euo pipefail
    export PATH="$bin:$PATH"
    REMOTE="$sandbox"; AUTH_URL=""; SHA="$SHA"; STG="$stg"
    cd "$REMOTE/apps/copiloto-web"
    eval "$bloque"
  ) >/dev/null 2>&1 || true

  # Veredicto: el centinela del publicado DEBE seguir ahí, y `dist` DEBE seguir resolviendo a un shell.
  if [ -f "$sandbox/apps/copiloto-web/dist-$SHA/CENTINELA" ]; then
    echo "  [$nombre] PASA: el dist publicado conserva su contenido durante el build"
    rm -rf "$sandbox"; return 0
  else
    echo "  [$nombre] ROJO: el build BORRÓ el dist publicado (dist-$SHA/CENTINELA ya no existe)"
    rm -rf "$sandbox"; return 1
  fi
}

echo "== REDEPLOYMISMOSHA: $DEPLOY"
fallos=0
correr_caso "nueva" "$DEPLOY" || fallos=$((fallos+1))

# Control positivo: la versión vieja de deploy.sh (bf406abe) debe ROJO. Sin esto, PASA no prueba nada.
VIEJO="$(mktemp)"
git -C "$HERE" show bf406abe:deploy/copiloto/deploy.sh > "$VIEJO"
if correr_caso "vieja bf406abe (control positivo, debe ser ROJO)" "$VIEJO"; then
  echo "  CONTROL FALLIDO: la versión vieja no reproduce el bug; el test no discrimina"
  fallos=$((fallos+1))
fi
rm -f "$VIEJO"

if [ "$fallos" -eq 0 ]; then echo "OK: la versión nueva conserva el dist vivo y el control positivo reproduce el bug"; exit 0; fi
echo "FALLO: $fallos caso(s)"; exit 1
