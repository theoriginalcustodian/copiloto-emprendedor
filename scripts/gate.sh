#!/usr/bin/env bash
# scripts/gate.sh — el gate propio (ADR-001, paso 3). Corre LOS MISMOS scripts/ci/*.sh que GitHub
# Actions, repartidos por dónde pueden correr: core/web/mobile/lint en esta máquina (node/npm ya
# están, no necesitan Postgres); backend en el VPS (regla 2 del proyecto: la PC no tiene
# `temporalio`/`psycopg2`).
#
# Escribe un recibo atado al SHA que se está gateando (`.ci-recibos/<sha>.json`, paso 4). Sin esto,
# "la suite dio verde" es un texto que alguien transcribe; con esto es un archivo que el SCRIPT
# escribió, no quien reporta -- un merge cita el recibo del SHA que mergea.
#
# Uso: bash scripts/gate.sh                  # los 5 jobs
#      bash scripts/gate.sh backend          # sólo uno
#      bash scripts/gate.sh core web         # varios
#      UC_SESION=fe1 bash scripts/gate.sh    # en un worktree DETACHED (`_ctl/verify-<sha>`): la sesión
#                                            # no se infiere y sin ella el job backend se rechaza (exit 2)
# El job backend toma un candado por tríada en el VPS (scripts/ci/candado-stage.sh): un segundo gate de
# la misma sesión espera al primero en vez de pisarle el stage.
# Un argumento que no es un job (`--solo`, `backnd`) es exit 2 SIN correr nada y SIN recibo: antes
# corría 0 jobs e imprimía "TODOS los jobs OK" (falso verde, A1 §4.1).
#
# Recibo: `.ci-recibos/<sha>.json` ACUMULA por job entre corridas del mismo SHA (A1 §4.2). `jobs` = último
# resultado por job; `detalle.<job>` = último {resultado, inicio, fin, log} + `historial` con TODAS las
# corridas: un `failed` no desaparece bajo un `ok` posterior. `inicio`/`fin` en epoch (BL-B6: prueba de
# que dos gates se solaparon). Cada job vuelca su salida a `.ci-recibos/logs/<sha>-<job>-<inicio>.log`.
# Copia durable del recibo en `<git-common-dir>/ci-recibos/` (sobrevive a `git worktree remove`); un
# worktree nuevo del mismo SHA acumula desde ahí. `scripts/recibo-cubre.sh <sha>` busca en los dos.
# Overrides para test: GATE_CI_DIR (dónde están los <job>.sh), GATE_RECIBO_DIR, GATE_RECIBO_COMUN.
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SHA="$(git -C "$ROOT" rev-parse HEAD)"
# Lo que el gate prueba es un ÁRBOL, no un SHA: con squash-merge el SHA mergeado es otro, pero si la
# rama estaba al día con main su árbol es idéntico — `scripts/recibo-cubre.sh` lo compara por árbol.
# Y los jobs leen el DISCO, no git (sync-test-backend.sh tarea el worktree): un cambio sin commitear
# o un archivo nuevo entra a la corrida sin estar en ningún árbol. `sucio` lo deja escrito en el recibo.
ARBOL="$(git -C "$ROOT" rev-parse 'HEAD^{tree}')"
SUCIO_AL_INICIO="$(git -C "$ROOT" status --porcelain | grep -v '^?? \.ci-recibos/' || true)"
RECIBO_DIR="${GATE_RECIBO_DIR:-$ROOT/.ci-recibos}"
# Copia durable en el git common dir: `.ci-recibos/` muere con el worktree, y los de verificación
# (`_ctl/verify-<sha>`) se borran — el recibo 5/5 de 107fdf61 se perdió así (2026-09-22).
# Una corrida con overrides es un TEST (jobs stub): su recibo jamás va a la copia real, o un stub
# `exit 0` quedaría cubriendo un SHA que nadie probó.
if [ -n "${GATE_RECIBO_COMUN:-}" ]; then RECIBO_COMUN="$GATE_RECIBO_COMUN"
elif [ -n "${GATE_RECIBO_DIR:-}${GATE_CI_DIR:-}" ]; then RECIBO_COMUN="$RECIBO_DIR/comun"
else RECIBO_COMUN="$(git -C "$ROOT" rev-parse --path-format=absolute --git-common-dir)/ci-recibos"; fi
CI_DIR="${GATE_CI_DIR:-$ROOT/scripts/ci}"

JOBS_VALIDOS=(core web mobile lint backend)
SELECCION=("$@")
for a in "${SELECCION[@]}"; do
  ok=0; for j in "${JOBS_VALIDOS[@]}"; do [ "$a" = "$j" ] && ok=1; done
  if [ "$ok" -eq 0 ]; then
    echo "gate.sh: '$a' no es un job. Válidos: ${JOBS_VALIDOS[*]} (sin argumentos = todos)." >&2
    exit 2
  fi
done
command -v jq >/dev/null || { echo "gate.sh: falta jq (necesario para el recibo)." >&2; exit 2; }
mkdir -p "$RECIBO_DIR/logs"
quiere() { [ "${#SELECCION[@]}" -eq 0 ] && return 0; local j; for j in "${SELECCION[@]}"; do [ "$j" = "$1" ] && return 0; done; return 1; }

# Triada por sesión (BL-B6): base de tests, puerto y stage propios -> dos sesiones no se pisan.
# shellcheck source=ci/sesion-env.sh
source "$ROOT/scripts/ci/sesion-env.sh"
# Sin tríada propia, el job backend NO corre (2026-09-22): en un worktree detached la sesión no se
# infiere y el stage/DB legacy es de todos. Exit 2 ANTES de correr nada y sin recibo, igual que un
# argumento inválido: un rechazo, no un rojo.
if quiere backend && [ "${UC_TRIADA_PROPIA:-0}" != 1 ]; then
  echo "gate.sh: el job backend necesita la tríada de TU sesión y acá no se infiere (¿worktree detached?)." >&2
  echo "         Corré: UC_SESION=<backend|fe1|fe2|aud> bash scripts/gate.sh $*" >&2
  exit 2
fi
# Candado por tríada: la tríada separa sesiones, el candado separa dos gates de la MISMA sesión.
# shellcheck source=ci/candado-stage.sh
source "$ROOT/scripts/ci/candado-stage.sh"

JOBS_LOCAL=(core web mobile lint)
declare -A RESULTADO INICIO_JOB FIN_JOB LOG_JOB
INICIO_TOTAL=$(date +%s)

correr() {
  local job="$1"; shift
  INICIO_JOB[$job]=$(date +%s)
  LOG_JOB[$job]="$RECIBO_DIR/logs/$SHA-$job-${INICIO_JOB[$job]}.log"
  echo "==> [$job] corriendo... (inicio ${INICIO_JOB[$job]}, log ${LOG_JOB[$job]})"
  "$@" 2>&1 | tee "${LOG_JOB[$job]}"
  if [ "${PIPESTATUS[0]}" -eq 0 ]; then RESULTADO[$job]="ok"; else RESULTADO[$job]="failed"; fi
  FIN_JOB[$job]=$(date +%s)
  echo "==> [$job] ${RESULTADO[$job]} ($(( FIN_JOB[$job] - INICIO_JOB[$job] ))s, fin ${FIN_JOB[$job]})"
}

for job in "${JOBS_LOCAL[@]}"; do
  quiere "$job" || continue
  correr "$job" bash "$CI_DIR/$job.sh"
done

if quiere backend; then
  INICIO_JOB[backend]=$(date +%s)
  if ! tomar_candado "$UC_TEST_STAGE" "$SHA"; then
    RESULTADO[backend]="failed"; FIN_JOB[backend]=$(date +%s); LOG_JOB[backend]=""
  else
    trap 'soltar_candado "$UC_TEST_STAGE"' EXIT
    echo "==> [backend] provisionando Postgres efímero en el VPS..."
    if EXPORTS="$(bash "$ROOT/deploy/copiloto/test-db.sh" --export 2>&1)"; then
      eval "$(echo "$EXPORTS" | grep '^export ')"
      # H-A3-11: GoTrue de test efímera, misma disciplina que Postgres arriba -- fail-closed (si no
      # levanta, el job backend falla) para que los 8 tests @necesita_gotrue no vuelvan a depender de
      # que alguien se acuerde de correrlos a mano (ese era exactamente el gap de BL-J11).
      echo "==> [backend] provisionando GoTrue de test efímera en el VPS (H-A3-11)..."
      if GOTRUE_EXPORTS="$(bash "$ROOT/deploy/copiloto/test-gotrue.sh" --export 2>&1)"; then
        eval "$(echo "$GOTRUE_EXPORTS" | grep '^export ')"
        # el inicio del job backend es el del provisioning: incluye ambas efímeras
        ini="${INICIO_JOB[backend]}"
        correr backend bash "$ROOT/deploy/copiloto/sync-test-backend.sh"
        INICIO_JOB[backend]="$ini"
      else
        echo "$GOTRUE_EXPORTS" >&2
        RESULTADO[backend]="failed"; FIN_JOB[backend]=$(date +%s); LOG_JOB[backend]=""
      fi
    else
      echo "$EXPORTS" >&2
      RESULTADO[backend]="failed"; FIN_JOB[backend]=$(date +%s); LOG_JOB[backend]=""
    fi
    soltar_candado "$UC_TEST_STAGE"; trap - EXIT
  fi
fi

DURACION=$(( $(date +%s) - INICIO_TOTAL ))

# --- recibo, atado al SHA, escrito por ESTE script; ACUMULA con corridas previas del mismo SHA ------
# `sucio` va POR JOB (en su entrada y en su historial): el recibo acumula corridas, y una corrida
# sucia de ayer no puede quedar tapada por el `sucio:false` de la corrida limpia de hoy de otro job.
SUCIO_AL_FIN="$(git -C "$ROOT" status --porcelain | grep -v '^?? \.ci-recibos/' || true)"
SUCIO=false; [ -n "$SUCIO_AL_INICIO$SUCIO_AL_FIN" ] && SUCIO=true
[ "$SUCIO" = true ] && echo "==> ⚠️  árbol SUCIO durante la corrida: estos jobs no cubren ningún SHA (recibo-cubre.sh los descarta)" >&2
RECIBO="$RECIBO_DIR/$SHA.json"
PREVIO='{}'
if [ -f "$RECIBO" ]; then PREVIO="$(cat "$RECIBO")"
elif [ -f "$RECIBO_COMUN/$SHA.json" ]; then PREVIO="$(cat "$RECIBO_COMUN/$SHA.json")"; fi  # mismo SHA, otro worktree
NUEVO="$PREVIO"
for job in "${!RESULTADO[@]}"; do
  NUEVO="$(printf '%s' "$NUEVO" | jq -c --arg job "$job" --arg r "${RESULTADO[$job]}"     --argjson ini "${INICIO_JOB[$job]}" --argjson fin "${FIN_JOB[$job]}" --arg log "${LOG_JOB[$job]}" --argjson sucio "$SUCIO" '
      ($job) as $j | {resultado:$r, inicio:$ini, fin:$fin, log:$log, sucio:$sucio} as $c
      | .jobs[$j] = $r
      | .detalle[$j] = ($c + {historial: (((.detalle[$j].historial) // []) + [$c])})')"
done
printf '%s' "$NUEVO" | jq -c --arg sha "$SHA" --arg arbol "$ARBOL" --arg ses "${UC_SESION:-}" --arg f "$(date -u +%Y-%m-%dT%H:%M:%SZ)"   --arg host "$(hostname)" --argjson dur "$DURACION"   '. + {sha:$sha, arbol:$arbol, sesion:$ses, fecha:$f, host:$host, duracion_seg:$dur} | .sucio = ([.detalle[]? | .sucio == true] | any)' > "$RECIBO.tmp.$$" && mv "$RECIBO.tmp.$$" "$RECIBO"
mkdir -p "$RECIBO_COMUN" && cp "$RECIBO" "$RECIBO_COMUN/$SHA.json.tmp.$$" && mv "$RECIBO_COMUN/$SHA.json.tmp.$$" "$RECIBO_COMUN/$SHA.json" \
  || echo "==> ⚠️  no pude copiar el recibo a $RECIBO_COMUN: si borrás este worktree, se pierde" >&2
echo "==> recibo: $RECIBO (copia durable: $RECIBO_COMUN/$SHA.json)"
cat "$RECIBO"; echo

# veredicto de ESTA corrida (no del acumulado): un job fallido de otra corrida no la contamina, pero
# queda en `historial` para quien lee el recibo.
TODO_OK=1
for job in "${!RESULTADO[@]}"; do [ "${RESULTADO[$job]}" != "ok" ] && TODO_OK=0; done
if [ "${#RESULTADO[@]}" -eq 0 ]; then echo "==> ❌ no corrió ningún job" >&2; exit 2; fi

if [ "$TODO_OK" -eq 1 ]; then
  echo "==> ✅ jobs de esta corrida OK: ${!RESULTADO[*]}"
  exit 0
else
  echo "==> ❌ al menos un job falló -- ver arriba"
  exit 1
fi
