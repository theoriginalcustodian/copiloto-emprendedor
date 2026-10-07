#!/usr/bin/env bash
# test_guard_postrestart.sh — CANARIOPOSTRESTART: el guard de /healthz de deploy.sh [5/7] (línea ~434)
# tiene que DISPARAR de verdad cuando el restart no deja al proceso en el SHA desplegado.
#
# Método: extrae el bloque real del guard de deploy.sh (no lo reescribe) y lo ejecuta con un `curl`
# stub que devuelve el SHA vivo. Control positivo: sin inyección y con healthz == SHA, el guard PASA.
# Caso hostil: UC_CANARIO_FALLA_TRAS_RESTART=1 con el mismo healthz, el guard DEBE abortar (exit != 0).
# Si el caso hostil pasa, el guard no discrimina y el test está roto.
#
# Uso: bash deploy/copiloto/test_guard_postrestart.sh [ruta/a/deploy.sh]
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY="${1:-$HERE/deploy.sh}"
SHA="aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"

# Bloque del guard: desde `SHA_GUARDA=` hasta la línea del ABORT [5/7] (incluye la inyección).
extraer_guard() {
  sed -n '/^SHA_GUARDA="\$SHA"$/,/^\[ "\$got" = "\$SHA_GUARDA" \]/p' "$1"
}

correr_caso() {
  local nombre="$1" falla="$2" esperado="$3"
  local sandbox bin bloque rc
  sandbox="$(mktemp -d)"; bin="$sandbox/bin"; mkdir -p "$bin"
  # curl stub: /healthz devuelve el SHA desplegado (el proceso SÍ quedó en el SHA nuevo).
  cat > "$bin/curl" <<STUB
#!/usr/bin/env bash
echo '{"status":"ok","sha":"$SHA"}'
STUB
  chmod +x "$bin/curl"
  bloque="$(extraer_guard "$DEPLOY")"
  if [ -z "$bloque" ]; then echo "  [$nombre] ERROR: no encontré el guard en $DEPLOY"; rm -rf "$sandbox"; return 2; fi
  rc=0
  (
    export PATH="$bin:$PATH"
    SHA="$SHA"; PORT=8099; CANARIO_FALLA="$falla"; sleep() { :; }
    eval "$bloque"
  ) >"$sandbox/out" 2>&1 || rc=$?
  local motivo
  motivo="$(grep -c 'ABORT \[5/7\]' "$sandbox/out" || true)"
  rm -rf "$sandbox"
  # El aborto tiene que venir del guard (mensaje ABORT [5/7]), no de un error cualquiera.
  if { [ "$rc" -eq 0 ] && [ "$esperado" = "pasa" ]; } || { [ "$rc" -ne 0 ] && [ "$motivo" -ge 1 ] && [ "$esperado" = "aborta" ]; }; then
    echo "  [$nombre] OK (rc=$rc, esperado $esperado)"; return 0
  fi
  echo "  [$nombre] ROJO (rc=$rc, esperado $esperado)"; return 1
}

echo "== CANARIOPOSTRESTART guard: $DEPLOY"
fallos=0
correr_caso "control positivo: sin inyección, healthz==SHA" "" pasa || fallos=$((fallos+1))
correr_caso "caso hostil: inyección tras restart" "1" aborta || fallos=$((fallos+1))

if [ "$fallos" -eq 0 ]; then echo "OK: el guard pasa en el caso sano y aborta con la inyección"; exit 0; fi
echo "FALLO: $fallos caso(s)"; exit 1
