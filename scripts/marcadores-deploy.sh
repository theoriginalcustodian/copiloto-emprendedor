#!/usr/bin/env bash
# marcadores-deploy.sh — ¿el front que sirve prod es el SHA que digo, y se reinició de verdad?
#
# POR QUÉ EXISTE (fila BUNDLEMARCADOR, 2026-10-13). El criterio de «desplegado» de las filas de
# deploy del front sólo lo podía ejercitar **quien tiene SSH**: la sonda que #886 agregó para probar
# que el deploy converge es la directiva `log` de Caddy, y su propio comentario dice «sin cambio de
# respuestas» — o sea, por diseño es INVISIBLE desde afuera. Un criterio de cierre que una sola
# sesión puede correr no es un criterio: es un privilegio, y el resto tiene que creerle al reporte.
#   → memoria: un-gate-cuyo-corpus-vive-fuera-del-repo-mide-al-equipo-no-al-commit
#
# Y existían tres marcadores que CUALQUIERA lee con un `curl`, sin credenciales:
#   1. `/healthz` → `{"sha": …, "arrancado": …}`  — el SHA que el PROCESO tiene en su env.
#   2. `data-build-sha="…"` en el `index.html`     — el SHA del SHELL publicado (symlink `dist`).
#   3. el hash del bundle Vite (`/assets/index-XXXX.js`) — cambia con el CONTENIDO.
#
# LOS TRES, NO UNO, y cada uno cubre un modo de falla que los otros dos no ven:
#   · sólo (1): el proceso nuevo con el shell viejo sin publicar pasa — es exactamente el estado
#     intermedio que deja un abort entre [5/7] y [5.5/7].
#   · sólo (2): el shell nuevo con el worker/API sin reiniciar pasa.
#   · sin `arrancado`: un proceso que NUNCA se reinició pero ya tenía el SHA correcto pasa igual.
#     La frescura es lo que distingue «desplegado» de «ya estaba».
#   · sin (3): un re-deploy del MISMO sha es indistinguible de no haber desplegado.
#
# Uso:
#   scripts/marcadores-deploy.sh <host> <sha-esperado> [minutos-max-de-arranque]
#   scripts/marcadores-deploy.sh copilotoemprendedor.duckdns.org 316923ef…      # sin frescura
#   scripts/marcadores-deploy.sh copilotoemprendedor.duckdns.org 316923ef… 20   # y arrancó hace <20m
#
# rc=0 todo coincide · rc=1 discrepancia (lo dice y la nombra) · rc=2 no pude medir (NO es un pase).
set -uo pipefail   # SIN -e: un curl que falle no debe abortar antes de reportar

HOST="${1:-}"; ESPERADO="${2:-}"; MAXMIN="${3:-}"
if [ -z "$HOST" ] || [ -z "$ESPERADO" ]; then
  echo "uso: $0 <host> <sha-esperado> [minutos-max-de-arranque]" >&2
  exit 2
fi
TO="${CURL_TIMEOUT:-15}"

# Costura de testeabilidad: con MARCADORES_FIXTURE_DIR el script lee dos archivos en vez de la red.
# Existe para que el test corra OFFLINE y DETERMINISTA en CI — un test que pega al host vivo mide la
# red del runner, no el parseo, y su rojo no es atribuible.
#   -> memoria: un-instrumento-compartido-intermitente-fabrica-una-excusa-lista
traer() {  # traer <ruta-url> <nombre-fixture>
  if [ -n "${MARCADORES_FIXTURE_DIR:-}" ]; then
    cat "$MARCADORES_FIXTURE_DIR/$2" 2>/dev/null
  else
    curl -sS --max-time "$TO" "https://$HOST$1" 2>&1
  fi
}

# ── 1) /healthz ────────────────────────────────────────────────────────────────────────────────
hz="$(traer /healthz healthz)"
if [ -z "$hz" ] || ! printf '%s' "$hz" | grep -q '"sha"'; then
  echo "🕶️ NO PUDE MEDIR: /healthz no respondió un JSON con \"sha\" — y eso NO es un pase." >&2
  echo "   respuesta: $(printf '%s' "$hz" | head -c 200)" >&2
  exit 2
fi
sha_proc="$(printf '%s' "$hz" | grep -o '"sha":"[^"]*"' | head -1 | cut -d'"' -f4)"
arrancado="$(printf '%s' "$hz" | grep -o '"arrancado":"[^"]*"' | head -1 | cut -d'"' -f4)"

# ── 2) y 3) el shell publicado ─────────────────────────────────────────────────────────────────
html="$(traer / index.html)"
if [ -z "$html" ]; then
  echo "🕶️ NO PUDE MEDIR: el host no devolvió el index.html — y eso NO es un pase." >&2
  exit 2
fi
sha_shell="$(printf '%s' "$html" | grep -o 'data-build-sha="[^"]*"' | head -1 | cut -d'"' -f2)"
bundle="$(printf '%s' "$html" | grep -oE '/assets/index-[A-Za-z0-9._-]+\.js' | head -1)"

if [ -z "$sha_shell" ]; then
  echo "🕶️ NO PUDE MEDIR: el shell no declara data-build-sha — y eso NO es un pase." >&2
  exit 2
fi

# Comparación por PREFIJO para tolerar sha corto en el argumento, nunca al revés.
coincide() { case "$1" in "$2"*) return 0 ;; *) return 1 ;; esac; }

fallos=0
coincide "$sha_proc"  "$ESPERADO" || { echo "🔴 /healthz sha=$sha_proc  != esperado=$ESPERADO"; fallos=1; }
coincide "$sha_shell" "$ESPERADO" || { echo "🔴 data-build-sha=$sha_shell != esperado=$ESPERADO"; fallos=1; }
[ "$sha_proc" = "$sha_shell" ] || {
  echo "🔴 PROCESO y SHELL difieren ($sha_proc vs $sha_shell): es el estado intermedio de un abort"
  echo "   entre [5/7] (restart) y [5.5/7] (publish). Ninguno de los dos solo lo habría visto."
  fallos=1; }

# ── frescura: distingue «desplegado» de «ya estaba» ────────────────────────────────────────────
if [ -n "$MAXMIN" ]; then
  if [ -z "$arrancado" ]; then
    echo "🕶️ NO PUDE MEDIR la frescura: /healthz no trae \"arrancado\"." >&2
    exit 2
  fi
  t_arr="$(date -u -d "$arrancado" +%s 2>/dev/null)"
  t_now="$(date -u +%s)"
  if [ -z "$t_arr" ]; then
    echo "🕶️ NO PUDE MEDIR la frescura: no pude parsear '$arrancado'." >&2
    exit 2
  fi
  mins=$(( (t_now - t_arr) / 60 ))
  if [ "$mins" -gt "$MAXMIN" ]; then
    echo "🔴 el proceso arrancó hace ${mins}min (> ${MAXMIN}): sirve el SHA correcto pero NO se"
    echo "   reinició en esta ventana — «ya estaba» no es «desplegado»."
    fallos=1
  else
    echo "   frescura: arrancó hace ${mins}min (<= ${MAXMIN})"
  fi
fi

echo "   /healthz sha : $sha_proc"
echo "   shell        : $sha_shell"
echo "   bundle Vite  : ${bundle:-<sin assets/index-*.js>}"
echo "   arrancado    : ${arrancado:-<no declarado>}"

if [ "$fallos" = "0" ]; then
  echo "✅ los 3 marcadores concuerdan con $ESPERADO — leíble por cualquiera, sin SSH."
  exit 0
fi
exit 1
