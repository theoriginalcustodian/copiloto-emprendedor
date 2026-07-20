#!/usr/bin/env bash
# S6 — Vigía del build de EAS. Corre en background y termina cuando el build resuelve.
#
# Por qué existe: el build tarda 10-40 min en la cola de EAS. Esperarlo con un sleep-loop en
# primer plano bloquea la sesión; preguntarle cada tanto "a ver si terminó" es el anti-patrón.
# Esto corre suelto y avisa al salir.
#
# 🔴 La versión anterior de este vigía usaba `build:view <id> --json` y devolvía `UNKNOWN` en
# cada iteración: fallaba en silencio y habría reportado "sigue en cola" para siempre. Un vigía
# que no distingue "en cola" de "no pude preguntar" es peor que no tener vigía — da una
# sensación de vigilancia que no existe. Por eso ahora: `build:list --json` (verificado contra
# la API real) y un error explícito si el parseo no cierra.
#
# Uso: S6-watch-build.sh [build_id] [intervalo_seg]
set -euo pipefail

BUILD_ID="${1:-}"
INTERVALO="${2:-60}"
MAX_MIN="${MAX_ESPERA_MIN:-60}"
log() { printf '[S6 %s] %s\n' "$(date +%H:%M:%S)" "$*"; }
fail() { printf '[S6] ERROR: %s\n' "$*" >&2; exit 1; }

# 🔴 `EVID` se resuelve a ABSOLUTO antes del `cd`, y no es un detalle de estilo.
# La versión anterior lo dejaba relativo (`_evidencia`): el `mkdir` lo creaba en el cwd de
# invocación y, tras el `cd` a `apps/mobile`, el `>` de la línea final apuntaba a
# `apps/mobile/_evidencia/` — que no existe. Resultado: el build terminó BIEN, el vigía imprimió
# la URL del APK en su log... y murió con "No such file or directory" al persistirla, dejando el
# task en `failed`. El peor sabor de fallo: éxito reportado como fracaso, con el dato valioso
# visible sólo en el log de un proceso que ya terminó mal.
RAIZ="$(cd "$(dirname "$0")/../.." && pwd)"
EVID="${EVIDENCIA_DIR:-$RAIZ/_evidencia}"
mkdir -p "$EVID"

cd "$RAIZ/apps/mobile"

consultar() {
  npx --yes eas-cli@latest build:list --platform android --limit 5 --json --non-interactive 2>/dev/null \
    | node -e "
let d='';
process.stdin.on('data', c => d += c).on('end', () => {
  let arr;
  try { arr = JSON.parse(d); } catch { console.log('PARSE_ERROR||'); return; }
  if (!Array.isArray(arr) || !arr.length) { console.log('SIN_BUILDS||'); return; }
  const id = process.argv[1];
  const b = id ? arr.find(x => x.id === id) : arr[0];
  if (!b) { console.log('NO_ENCONTRADO||'); return; }
  const url = b.artifacts?.applicationArchiveUrl ?? b.artifacts?.buildUrl ?? '';
  console.log([b.status, b.id, url].join('|'));
});
" "$BUILD_ID"
}

intentos=$(( MAX_MIN * 60 / INTERVALO ))
for ((i = 1; i <= intentos; i++)); do
  linea="$(consultar)"
  estado="${linea%%|*}"; resto="${linea#*|}"; id="${resto%%|*}"; url="${resto#*|}"

  case "$estado" in
    FINISHED)
      log "BUILD LISTO — $id"
      log "APK: $url"
      printf '%s\n' "$url" > "$EVID/apk-url.txt"
      exit 0 ;;
    ERRORED|CANCELED)
      log "BUILD $estado — $id"
      log "logs: https://expo.dev/accounts/341lin/projects/copiloto-emprendedor/builds/$id"
      exit 1 ;;
    NEW|IN_QUEUE|IN_PROGRESS|PENDING_CANCEL)
      log "$estado (intento $i/$intentos)" ;;
    # Cualquier otra cosa es "no pude preguntar", NO "sigue esperando". Se dice y se corta:
    # un vigía que confunde ambas cosas reporta calma mientras no está mirando nada.
    *)
      fail "no pude leer el estado del build (respuesta: '$linea'). Revisá auth/red." ;;
  esac
  sleep "$INTERVALO"
done

fail "el build no resolvió en $MAX_MIN min — sigue en cola o algo se colgó. No asumo nada."
