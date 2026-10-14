#!/usr/bin/env bash
# test_syncweb_argv_vacio.sh — ARGVSSHVACIO en sync-web.sh: `UC_AUTH_URL=""` (uso documentado: botón
# Google oculto) NO puede correr los índices del argv remoto.
#
# El defecto (medido 2026-10-14 contra el VPS): `ssh host bash -s -- A "" B` entrega 2 argumentos al
# remoto -- el vacío desaparece y `$2` pasa a ser B. En sync-web.sh eso dejaba `BUILD_SHA` unbound (con
# `set -u` aborta; sin él habría construido con el sha en el lugar de la URL).
#
# Método: extrae el bloque REAL de `sync-web.sh` ([3/3], desde el `ssh … bash -s --` hasta el cierre
# REMOTE_BUILD) y lo corre con un `ssh` stub que REPRODUCE el defecto (descarta los argumentos vacíos
# antes de ejecutar `bash -s -- …` con el heredoc) y un `npm` stub que registra el entorno. Nunca toca el VPS.
#
#   1. vacío explícito  -> el build corre, VITE_AUTH_URL=="" y VITE_BUILD_SHA==sha (el índice NO se corrió)
#   2. URL no vacía      -> pasa tal cual
#   3. CONTROL NEGATIVO  -> el mismo bloque SIN sentinel (la forma vieja) aborta por aridad: prueba que el
#                           stub reproduce el defecto y que el guard lo detecta (un test que no puede
#                           fallar no mide nada).
#
# Uso: bash deploy/copiloto/test_syncweb_argv_vacio.sh [ruta/a/sync-web.sh]
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SYNC="${1:-$HERE/sync-web.sh}"
SHA="0123456789abcdef0123456789abcdef01234567"

extraer_bloque() {
  sed -n '/^ssh "\$HOST" bash -s -- "\$REMOTE\/\$WEB_SUBDIR"/,/^REMOTE_BUILD$/p' "$1"
}

# correr_caso <auth_url> <sin_sentinel:0|1>   -> imprime "rc|VITE_AUTH_URL|VITE_BUILD_SHA|stderr"
correr_caso() {
  local auth_url="$1" sin_sentinel="$2"
  local sandbox bin out rc bloque
  sandbox="$(mktemp -d)"; bin="$sandbox/bin"; mkdir -p "$bin" "$sandbox/remote/apps/copiloto-web/dist"
  : > "$sandbox/npm.log"

  # ssh stub: descarta los argumentos VACÍOS (como el real) y corre el resto con el heredoc.
  cat > "$bin/ssh" <<'STUB'
#!/usr/bin/env bash
shift                       # el host
args=()
for a in "$@"; do [ -n "$a" ] && args+=("$a"); done
exec "${args[@]}"
STUB
  # npm stub: sólo registra lo que el build hornearía.
  cat > "$bin/npm" <<STUB
#!/usr/bin/env bash
if [ "\$1" = run ]; then echo "VITE_AUTH_URL=[\${VITE_AUTH_URL-<unset>}] VITE_BUILD_SHA=[\${VITE_BUILD_SHA-<unset>}]" >> "$sandbox/npm.log"; fi
exit 0
STUB
  chmod +x "$bin/ssh" "$bin/npm"

  bloque="$(extraer_bloque "$SYNC")"
  [ -n "$bloque" ] || { echo "FALLA: no se encontró el bloque REMOTE_BUILD en $SYNC" >&2; exit 2; }
  if [ "$sin_sentinel" -eq 1 ]; then
    # La forma VIEJA: el argumento vacío viaja crudo.
    bloque="${bloque//\"\$\{AUTH_URL:-__UC_VACIO__\}\"/\"\$AUTH_URL\"}"
  fi

  set +e
  out="$(HOST=h REMOTE="$sandbox/remote" WEB_SUBDIR="apps/copiloto-web" AUTH_URL="$auth_url" \
         _build_sha="$SHA" PATH="$bin:$PATH" bash -c "$bloque" 2>&1 >/dev/null)"
  rc=$?
  set -e
  local linea
  linea="$(tail -n 1 "$sandbox/npm.log" 2>/dev/null || true)"
  echo "$rc|$linea|$out"
  rm -rf "$sandbox"
}

fallo=0
ok()  { echo "OK    $1"; }
mal() { echo "FALLA $1" >&2; fallo=1; }

# 1. vacío explícito: el índice NO se corre.
r="$(correr_caso "" 0)"
[ "${r%%|*}" = 0 ] && ok "1. UC_AUTH_URL vacío: el bloque termina rc=0" || mal "1. rc=${r%%|*} ($r)"
case "$r" in *"VITE_AUTH_URL=[] VITE_BUILD_SHA=[$SHA]"*) ok "1b. VITE_AUTH_URL vacío y VITE_BUILD_SHA es el sha (índices intactos)";;
  *) mal "1b. el build recibió otra cosa: $r";; esac

# 2. URL no vacía: pasa tal cual.
r="$(correr_caso "https://x.example" 0)"
case "$r" in *"VITE_AUTH_URL=[https://x.example] VITE_BUILD_SHA=[$SHA]"*) ok "2. URL no vacía intacta";;
  *) mal "2. $r";; esac

# 3. control negativo: la forma vieja (sin sentinel) tiene que ABORTAR por aridad, no construir con basura.
r="$(correr_caso "" 1)"
if [ "${r%%|*}" != 0 ] && [[ "$r" == *ARGVSSHVACIO* ]]; then ok "3. sin sentinel el guard de aridad aborta (el stub reproduce el defecto)"
else mal "3. la forma vieja NO abortó como se esperaba: $r"; fi

# 4. el bloque real declara el guard y el sentinel (no sólo el comportamiento: que nadie los quite).
grep -q 'ARGVSSHVACIO' "$SYNC" && grep -q '__UC_VACIO__' "$SYNC" && ok "4. sync-web.sh declara sentinel + guard" || mal "4. faltan sentinel/guard en $SYNC"

exit "$fallo"
