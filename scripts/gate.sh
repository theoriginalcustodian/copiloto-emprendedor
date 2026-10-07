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
# 🔴 GATE_CI_DIR TIENE que desviar tambien el recibo, no solo los jobs. Medido el 2026-10-06:
# con `GATE_CI_DIR` a secas (stubs `exit 0`) el recibo por SHA caia en el `.ci-recibos/` REAL, y
# `recibo-cubre.sh:32-33` busca justamente en el `.ci-recibos/` de TODOS los worktrees -> un stub
# quedaba cubriendo un SHA que nadie probo. `GATE_RECIBO_DIR` sigue teniendo precedencia.
if [ -n "${GATE_RECIBO_DIR:-}" ]; then RECIBO_DIR="$GATE_RECIBO_DIR"
elif [ -n "${GATE_CI_DIR:-}" ]; then RECIBO_DIR="$ROOT/.ci-recibos-stub"
else RECIBO_DIR="$ROOT/.ci-recibos"; fi
# Copia durable en el git common dir: `.ci-recibos/` muere con el worktree, y los de verificación
# (`_ctl/verify-<sha>`) se borran — el recibo 5/5 de 107fdf61 se perdió así (2026-09-22).
# Una corrida con overrides es un TEST (jobs stub) y su recibo no puede cubrir nada. Eso se sostiene
# en DOS lugares, y hasta el 2026-10-06 este comentario afirmaba una proteccion que ninguno daba:
#   (a) ACA: la copia durable y el recibo por SHA se desvian (ver el bloque de RECIBO_DIR arriba).
#   (b) EN EL CONSUMIDOR: el recibo se estampa `stub:true` y `recibo-cubre.sh` lo DESCARTA, igual
#       que descarta `sucio`. Hace falta (b) ademas de (a) porque alguien puede apuntar
#       `GATE_RECIBO_DIR` al dir real: el desvio es un default, el estampado es el guard.
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

# TIPOCOMP — un SUBCONJUNTO de jobs no es una medición válida cuando el árbol toca `packages/core/src`.
# Medido 2026-09-30, y el mismo día dos veces: agregar un campo REQUERIDO a un tipo de `packages/core`
# rompió 7 fixtures hand-built de `core`/`mobile`/`web`; el gate local de UN paquete salió verde y el
# rojo (`TS2741`) lo mostró recién CI. El agujero NO es el default —`gate.sh` sin argumentos ya corre
# los 5— es que `gate.sh web` MIDE MENOS de lo que el cambio afecta y no lo dice: un recibo parcial
# que después se cita como si cubriera el árbol. Tercera instancia del a-todos "el recibo local no
# garantiza CI verde", y la primera con una causa mecanizable: no es «el entorno», es QUÉ CORRIÓ.
#
# Se ENSANCHA la selección, no se rechaza: un guard que obliga a retipear el comando enseña a saltear
# el gate (memoria `el-guard-que-grita-en-el-caso-normal-se-desarma-solo`), y ensanchar hace lo
# correcto solo. Y no grita en el caso normal: sin cambios en `packages/core/src` no imprime nada.
# El escape honesto, si de verdad querés una sola suite, es `bash scripts/ci/<job>.sh` directo: eso no
# pretende ser un gate ni escribe recibo, así que no puede citarse como cobertura.
JOBS_ACOPLADOS_A_CORE=(core web mobile)
AGREGADOS_POR_CORE=()
if [ "${#SELECCION[@]}" -gt 0 ]; then
  # `GATE_BASE_REF` parametriza SÓLO la base del diff: el barrido de abajo es el mismo `git diff` que
  # corre en producción. Un override que inyectara la LISTA de cambios crearía un camino que el test
  # ejercita y la corrida real no (memoria `el-test-que-no-usa-el-camino-de-produccion-no-puede-verlo-fallar`).
  BASE_CAMBIOS="${GATE_BASE_REF:-}"
  if [ -z "$BASE_CAMBIOS" ] && git -C "$ROOT" rev-parse --verify -q origin/main >/dev/null 2>&1; then
    # `merge-base`, no `origin/main`: una rama creada hace rato no "cambió" lo que main avanzó después
    # (memoria `rama-nueva-no-significa-que-el-grafo-no-sepa-nada`).
    BASE_CAMBIOS="$(git -C "$ROOT" merge-base origin/main HEAD 2>/dev/null || true)"
  fi
  # Sin `origin/main` (fixture con `git init` en un temp dir) no hay nada que ensanchar: se saltea
  # mudo, igual que el check de `.githooks/pre-push` cuando el árbol no lo trae.
  if [ -n "$BASE_CAMBIOS" ]; then
    # Los jobs leen el DISCO, no git: un fixture nuevo SIN COMMITEAR entra a la corrida sin estar en
    # ningún árbol — que es exactamente cómo se veía el rojo de hoy. Por eso el barrido suma
    # `status --porcelain` al diff, mismo criterio que `SUCIO_AL_INICIO` de arriba.
    CAMBIOS="$( { git -C "$ROOT" diff --name-only "$BASE_CAMBIOS" HEAD 2>/dev/null; \
                  git -C "$ROOT" status --porcelain 2>/dev/null | sed 's/^...//'; } || true )"
    # `-> ` cubre los renames de `status --porcelain` (`R  viejo -> packages/core/src/x.ts`): anclar
    # sólo al principio de línea perdería el DESTINO, que es la mitad que importa.
    if grep -qE '(^|-> )packages/core/src/' <<< "$CAMBIOS"; then
      for j in "${JOBS_ACOPLADOS_A_CORE[@]}"; do
        quiere "$j" || { SELECCION+=("$j"); AGREGADOS_POR_CORE+=("$j"); }
      done
      if [ "${#AGREGADOS_POR_CORE[@]}" -gt 0 ]; then
        echo "==> gate.sh: el árbol toca packages/core/src -> ensancho la selección con: ${AGREGADOS_POR_CORE[*]}"
        echo "    (un tipo compartido rompe fixtures de los otros paquetes; medir uno solo es un recibo parcial)"
      fi
    fi
  fi
fi

# Triada por sesión (BL-B6): base de tests, puerto y stage propios -> dos sesiones no se pisan.
# shellcheck source=ci/sesion-env.sh
source "$ROOT/scripts/ci/sesion-env.sh"
# Sin tríada propia, el job backend NO corre (2026-09-22): en un worktree detached la sesión no se
# infiere y el stage/DB legacy es de todos. Exit 2 ANTES de correr nada y sin recibo, igual que un
# argumento inválido: un rechazo, no un rojo.
if quiere backend && [ "${UC_TRIADA_PROPIA:-0}" != 1 ]; then
  echo "gate.sh: el job backend necesita la tríada de TU sesión y acá no se infiere (¿worktree detached?)." >&2
  echo "         Corré: UC_SESION=<backend|fe1|fe2|aud|plan> bash scripts/gate.sh $*" >&2
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

# H-A4-1 (reabre H-A3-1): `core.hooksPath` es config LOCAL, compartida por TODOS los worktrees, y no
# versionada -- nada en el repo la reescribe (barrido completo, A4), pero una vez que queda absoluta
# (mutación manual, sin rastro) TODO worktree corre el pre-push de ESE árbol, no el propio, y el
# scanner de secretos (#601) deja de correr en cualquier push sin que nada lo avise. Antes esto sólo
# se arreglaba a mano (H-A3-1) y se reabrió en <24h (H-A4-1): un fix sin control fail-closed no es un
# fix, es una reincidencia programada. Este check corre ANTES de cualquier job y, si falla, marca
# TODOS los jobs seleccionados como `failed` -- ROJO real en el recibo, no un rechazo silencioso
# (distinto del guard de tríada arriba, que si rechaza NO escribe recibo a propósito).
# Se saltea bajo overrides de test (GATE_CI_DIR/GATE_RECIBO_DIR) Y cuando el árbol ni siquiera trae
# `.githooks/pre-push` -- un fixture de `scripts/tests/*.sh` hace `git init` en un temp dir para
# probar OTRA cosa (recibo-cubre, la tríada, etc.) SIN levantar el hook real; no hay nada que este
# check pueda proteger ahí (regresión propia: rompía test-recibo-cubre.sh 9a/9c, que corren gate.sh
# sin overrides A PROPÓSITO para ejercitar su comportamiento default contra un repo ajeno).
HOOKSPATH_ROTO=0
if [ -z "${GATE_CI_DIR:-}${GATE_RECIBO_DIR:-}" ] && [ -f "$ROOT/.githooks/pre-push" ]; then
  HOOKSPATH_ACTUAL="$(git -C "$ROOT" config --get core.hooksPath 2>/dev/null || echo '(sin setear)')"
  if [ "$HOOKSPATH_ACTUAL" != ".githooks" ]; then
    HOOKSPATH_ROTO=1
    echo "gate.sh: ❌ core.hooksPath='$HOOKSPATH_ACTUAL' (esperado '.githooks' relativo)." >&2
    echo "         El pre-push de secretos (#601) puede no estar corriendo en NINGÚN worktree" >&2
    echo "         (todos comparten esta config). Repo público: gate ROJO hasta que se arregle." >&2
    echo "         Fix: git config core.hooksPath .githooks" >&2
  elif ! grep -vE '^[[:space:]]*#' "$ROOT/.githooks/pre-push" | grep -q 'secretos-check'; then
    # El check de arriba (#649) verifica A DÓNDE apunta el hook; éste verifica QUÉ CONTIENE. Un árbol
    # anterior a #601 tiene `.githooks/pre-push` y `core.hooksPath=.githooks` — las dos condiciones en
    # verde — y un hook SIN escáner de secretos. Medido el 2026-09-22 (M-3, caso C): el push entró y el
    # log muestra que el hook corrió entero; simplemente no tenía nada que escanear. 4 de 26 árboles
    # vivos estaban así, el checkout compartido entre ellos. Los comentarios se descartan a propósito:
    # si no, este guard se satisfaría con la mención de `secretos-check` en un comentario del hook.
    HOOKSPATH_ROTO=1
    echo "gate.sh: ❌ .githooks/pre-push existe pero NO invoca secretos-check.sh." >&2
    echo "         core.hooksPath apunta bien; el problema es el contenido: este árbol es anterior a" >&2
    echo "         #601, así que el hook corre y no escanea nada. Repo público: gate ROJO." >&2
    echo "         Fix: traé este worktree a un main posterior a #601 (245fc3f2)." >&2
  fi
fi

for job in "${JOBS_LOCAL[@]}"; do
  quiere "$job" || continue
  if [ "$HOOKSPATH_ROTO" -eq 1 ]; then
    INICIO_JOB[$job]=$(date +%s); FIN_JOB[$job]="${INICIO_JOB[$job]}"; LOG_JOB[$job]=""
    RESULTADO[$job]="failed"
    continue
  fi
  correr "$job" bash "$CI_DIR/$job.sh"
done

if quiere backend; then
  INICIO_JOB[backend]=$(date +%s)
  if [ "$HOOKSPATH_ROTO" -eq 1 ]; then
    RESULTADO[backend]="failed"; FIN_JOB[backend]="${INICIO_JOB[backend]}"; LOG_JOB[backend]=""
  elif ! tomar_candado "$UC_TEST_STAGE" "$SHA"; then
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
# Estampa de corrida-con-overrides: los tres son overrides DE TEST (ver cabecera), asi que cualquiera
# de ellos invalida el recibo como evidencia. `recibo-cubre.sh` lo descarta por este campo.
STUB=false; [ -n "${GATE_CI_DIR:-}${GATE_RECIBO_DIR:-}${GATE_RECIBO_COMUN:-}" ] && STUB=true
[ "$STUB" = true ] && echo "==> ⚠️  corrida con overrides de TEST: el recibo sale estampado stub=true y no cubre ningun SHA" >&2
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
printf '%s' "$NUEVO" | jq -c --arg sha "$SHA" --arg arbol "$ARBOL" --arg ses "${UC_SESION:-}" --arg f "$(date -u +%Y-%m-%dT%H:%M:%SZ)"   --arg host "$(hostname)" --argjson dur "$DURACION" --argjson stub "$STUB"   '. + {sha:$sha, arbol:$arbol, sesion:$ses, fecha:$f, host:$host, duracion_seg:$dur, stub:$stub} | .sucio = ([.detalle[]? | .sucio == true] | any)' > "$RECIBO.tmp.$$" && mv "$RECIBO.tmp.$$" "$RECIBO"
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
