#!/usr/bin/env bash
# ¿El CI de un PR está REALMENTE verde? — precondición de `gh pr merge`.
#
# POR QUÉ EXISTE (2026-08-07, caso real). Miré el CI de un PR con
#     gh pr view N --jq '[.statusCheckRollup[]|"\(.name):\(.conclusion // .status)"]'
# y leí `backend:  core:SUCCESS  mobile:  web:  lint:SUCCESS  drift:SUCCESS`. Mergeé.
# Los tres jobs vacíos seguían `in_progress`: un job que todavía no reportó **no trae ni
# `conclusion` ni `status`**, así que el `//` devuelve cadena vacía — que no matchea ningún
# patrón de "pendiente" y se lee como *"ya no está corriendo"*. El instrumento no falló:
# CONFIRMÓ. Es la misma clase de trampa que la mañana anterior con `mergeStateStatus: CLEAN`
# y un `statusCheckRollup` VACÍO — "nada me bloquea" no es "todo pasó".
#
# LA REGLA QUE APLICA ACÁ, y que un rollup no puede darte solo:
#   verde = TODOS los jobs ESPERADOS están presentes **Y** cada uno con conclusion == SUCCESS.
# La lista de esperados es el aporte: sin ella, un job que ni se encoló es indistinguible de
# uno que no existe. Por eso se pasa explícita y por eso el script imprime cuántos encontró.
#
# USO
#   bash scripts/ci-verde.sh <numero-de-PR> ["job1 job2 ..."]
#   bash scripts/ci-verde.sh 311                      # los 6 jobs de tests.yml
#   bash scripts/ci-verde.sh 311 "core lint"          # sólo dos, para un PR docs-only
#   bash scripts/ci-verde.sh 311 && gh pr merge 311 --squash    # el patrón que importa
#
# SALIDA: exit 0 = verde Y mergeable · exit 1 = ROJO medido (falta alguno o alguno falló) ·
#         exit 4 = el CI está VERDE pero el PR tiene CONFLICTOS (desde 2026-09-30: antes
#         esto salía por exit 0 con el texto «se puede mergear», que era falso — medido
#         por auditoría con dos PR el mismo minuto, #765 MERGEABLE y #760 CONFLICTING,
#         misma frase en los dos) ·
#         exit 2 = NO SE PUDO MEDIR (mismo molde que `command -v uv` en graph-sync.sh: sin
#         esta guarda, `gh` ausente da un error de "comando no encontrado" indistinguible de
#         un rollup vacío, y NO-VERDE por falta de herramienta se confunde con NO-VERDE real).
#         Las DOS causas no son la misma decisión: exit 1 dice «mirá tu código», exit 2 dice
#         «no hay medición, andá a buscarla». Fundirlas mandaba a cazar un bug inexistente, y el
#         falso rojo es el que enseña a pasar por encima del gate. Desde el 2026-09-30 el exit 2
#         cubre también el caso «rollup vacío Y check-runs del commit vacíos», que antes salía
#         por 1; y un rollup vacío con check-runs presentes ya no es SIN MEDIR: se miden ellos.
#   El veredicto es EL EXIT CODE, no el texto. Si aun asi grepeas la salida: la ultima linea
#   dice VERDE o ROJO, nunca ambas, y ninguna es substring de la otra -- por eso no es
#   "NO VERDE". Un `grep -q VERDE` sobre el rechazo daba TRUE y mergeaba en rojo (28/09).
#
# SALIDA MONOTONA (invariante, con test propio en scripts/tests/test-ci-verde-veredicto-monotono.sh):
#   TODA salida imprime exactamente UNO de {VERDE, ROJO}. Nunca ninguno, nunca los dos.
#   Renombrar el rechazo (vuelta 1) cerro la lectura por token POSITIVO; faltaba la lectura
#   por token NEGATIVO (`! grep ROJO` => asumo verde), que fallaba ABIERTO en las rutas MUDAS:
#   `gh` ausente y falta de argumento imprimian un error sin veredicto. Y `gh` ausente es la
#   ruta MAS probable en un entorno nuevo, o sea la peor para fallar abierto.
#   Sigue valiendo: el veredicto es EL EXIT CODE. Esto solo hace que las dos lecturas
#   ingenuas del texto fallen CERRADAS en vez de una sola.
set -uo pipefail

command -v gh >/dev/null 2>&1 || { echo "ROJO — no pude medir: gh no está en el PATH"; exit 2; }

# Devuelve «<mergeable>/<mergeStateStatus>» del PR. Repregunta UNA vez si vuelve UNKNOWN: GitHub
# calcula el merge commit de forma asíncrona y la primera consulta sobre un PR recién abierto (o
# recién actualizado) suele contestar UNKNOWN sin que haya nada malo. Una sola repregunta, sin
# sleep ni loop: si a la segunda tampoco informa, el veredicto es «no pude medir» y no un rojo.
estado_de_merge() {
  local pr="$1" r
  r="$(gh pr view "$pr" --json mergeable,mergeStateStatus \
        --jq '(.mergeable // "UNKNOWN")+"/"+(.mergeStateStatus // "UNKNOWN")' 2>/dev/null)"
  case "$r" in
    UNKNOWN/*|"")
      r="$(gh pr view "$pr" --json mergeable,mergeStateStatus \
            --jq '(.mergeable // "UNKNOWN")+"/"+(.mergeStateStatus // "UNKNOWN")' 2>/dev/null)"
      ;;
  esac
  printf '%s' "${r:-UNKNOWN/UNKNOWN}"
}

# Falta de argumento es "no pude medir" (exit 2), NO "el PR esta rojo" (exit 1). El `${1:?}`
# que habia aca salia por 1 y era indistinguible de un CI fallado -- el MISMO defecto que el
# guard de `gh` de arriba vino a cerrar, vivo dos lineas mas abajo.
if [ "$#" -lt 1 ]; then
  echo "ROJO — no pude medir: falta el número de PR."
  echo "   uso: ci-verde.sh <numero-de-PR> [\"job1 job2 ...\"]"
  exit 2
fi
PR="$1"
ESPERADOS="${2:-backend core web mobile lint drift}"

# exit 2, NO 1: esto es «no pude MEDIR», y el docstring (:24-27) ya le reservaba el 2 a eso. Con
# `exit 1` un número de PR equivocado era INDISTINGUIBLE de un CI en rojo — medido por auditoría:
# `ci-verde.sh 999999` daba exit 1, idéntico a un PR con jobs fallados. Es fail-closed (nunca
# mergea de más), por eso MEDIA y no ALTA; lo que rompe es el DIAGNÓSTICO: manda a mirar el CI
# cuando el problema es el número o el login de `gh`. Misma clase que
# `memoria/dos-causas-distintas-comparten-el-codigo-de-salida-y-el-mensaje-elige-una.md`.
#
# LA CLASE, enumerada (era el DoD de este fix: arreglar el caso que quemó NO alcanza — la guarda
# se escribe para el que ya dolió y los hermanos quedan con el comportamiento viejo):
#   · `scripts/ci-verde.sh` — 3 rutas no-medibles ya daban 2 (`gh` ausente :42, falta de argumento
#     :48); ÉSTA era la única que quedó en 1. Arreglada acá.
#   · `scripts/evidencia/correr-canario.sh` — NO es de la clase: sus 4 rutas no-medibles usan
#     `ABORT(9)` de forma UNIFORME (:34,:35,:41,:43). Otro código que el 2, pero sin ambigüedad
#     interna. Se revisó y se descarta; enumerar no es acusar.
#   · `scripts/deuda-check.sh:74-80` — comparte el defecto EN ESPECIE: su `exit 1` significa a la
#     vez «hay deuda impaga» y «no pude leer el registro». Pero es DELIBERADO (su comentario lo
#     argumenta como fail-LOUD) y está fijado por un test
#     (`scripts/tests/test-deuda-disparador-cumplido.sh:209` afirma exit 1 para ese mensaje), así
#     que cambiarlo es un cambio de contrato, no un fix. Queda como fila con dueño, no se toca acá.
# ── El rollup trae cada job UNA VEZ POR RUN, y el gate leia los duplicados como un valor ──────
#
# 🔴 MEDIDO el 2026-10-05 sobre el PR #778 con dos pushes: `statusCheckRollup` devolvia **12**
# entradas para **6** jobs (backend x2, core x2, ... cada una con su `startedAt`), porque el rollup
# acumula los check-runs de TODOS los runs del PR, no los del ultimo. Con duplicados,
# `jq '.[]|select(.name==$n)|.conclusion'` imprime DOS lineas y la comparacion `[ "$c" = "SUCCESS" ]`
# recibe `"SUCCESS\nSUCCESS"` -> falso. Resultado: `❌ backend: SUCCESS` (condena un job que paso) y
# el control `12 presentes / 6 esperados` cerraba en ROJO.
#
# Lo peligroso no es el rojo, es lo que ENSEÑA: un gate que se pone rojo en el caso NORMAL —dos
# pushes a un PR es lo normal— es un gate que se saltea con `--admin`
# ([[el-guard-que-grita-en-el-caso-normal-se-desarma-solo]]). Y fallaba hacia el NO, que parece
# prudencia ([[el-instrumento-tambien-CONDENA-no-solo-absuelve]]).
#
# 🔴 Y EL FIX YA EXISTIA 30 LINEAS MAS ABAJO: la rama de `/check-runs` (el fallback) ya desempata el
# mismo nombre repetido tomando el `started_at` maximo, con su comentario explicando por que. El
# defecto vivia en el otro call-site, que nadie habia tocado
# ([[el-fix-ya-existe-en-otro-call-site]] · [[dos-implementaciones-del-mismo-cliente-el-fix-llega-a-una]]).
# `max_by` sobre ISO-8601 ordena cronologicamente; una entrada sin `startedAt` (un StatusContext, no
# un CheckRun) cae a "" y pierde contra cualquiera fechada, y si esta sola se queda igual.
#
# ⚠️ ESTA EN UNA VARIABLE A PROPOSITO, no inline: los stubs de los tests de este gate reciben el
# rollup **ya filtrado** y por eso entran POR DEBAJO de este `jq` — 14 casos verdes que no podian
# ver este bug ([[el-test-que-no-usa-el-camino-de-produccion-no-puede-verlo-fallar]]). Con la
# expresion en una variable, un test puede `eval` esta linea y ejercitar LA MISMA expresion que
# produccion: `scripts/tests/test-ci-verde-rollup-duplicado.sh`.
ROLLUP_JQ='[.statusCheckRollup[]|{name,conclusion,status,startedAt}] | group_by(.name) | map(max_by(.startedAt // ""))'

json=$(gh pr view "$PR" --json statusCheckRollup --jq "$ROLLUP_JQ") || {
  echo "ROJO — no pude leer el rollup del PR $PR (¿número correcto? ¿gh autenticado?)"; exit 2; }

# ── FALLBACK: el rollup VACÍO no es el único lugar donde viven los check-runs ──────────────────
#
# POR QUÉ (2026-09-30, medido por auditoría sobre el PR #739). El commit tenía los 6 check-runs y
# todos verdes; `statusCheckRollup` devolvía length 0. Un run disparado con `workflow_dispatch`
# **no aparece en ese rollup**. Y `workflow_dispatch` es justamente lo que `tests.yml` documenta,
# desde el outage del 2026-08-06, como «la única forma real de re-pedir la corrida» — o sea que
# **el remedio que este repo recomienda producía una medición que su propio gate no podía leer**.
# El caso que lo destapa es reusar una rama para un segundo PR tras un squash-merge: el PR nuevo
# no obtiene run propio. Los dos instrumentos eran correctos por separado y el hueco vivía en el
# par, igual que janitor↔escalador con el `urgente_` inmortal.
#
# Por qué NO debilita el gate: un job fallado aparece en check-runs con su `conclusion`, así que
# el camino nuevo puede decir ROJO — y el caso 7 del test lo exige, porque un fallback que sólo
# supiera absolver sería un interruptor de apagado del gate.
#
# Las DOS trampas de la API REST, que son la razón por la que esto no es un one-liner:
#   1. **Minúsculas.** `statusCheckRollup` da `SUCCESS`; `/check-runs` da `success`. Comparar sin
#      normalizar habría dado ROJO en todo, y —peor— normalizar de más habría dado VERDE en todo.
#   2. **Re-runs.** Un commit acumula TODOS los check-runs, así que un job re-corrido aparece dos
#      veces: `failure` viejo y `success` nuevo. Sin desempatar, el veredicto depende del orden en
#      que la API los devuelva, que es lo mismo que decir que no hay veredicto. Se toma el de
#      `started_at` más reciente por nombre, explícitamente y sin confiar en el orden recibido.
via_fallback=0
if [ "$(echo "$json" | jq 'length')" -eq 0 ]; then
  sha=$(gh pr view "$PR" --json headRefOid --jq '.headRefOid' 2>/dev/null)
  if [ -n "$sha" ] && [ "$sha" != "null" ]; then
    # `group_by` exige orden previo: se ordena por nombre, se agrupa, y dentro de cada grupo se
    # toma el de `started_at` máximo. `ascii_upcase` alinea el alfabeto de la REST con el del
    # rollup; `status` se mapea a COMPLETED/lo-que-venga para que la rama "está CORRIENDO" del
    # bucle de abajo siga funcionando igual por los dos caminos.
    alt=$(gh api "repos/{owner}/{repo}/commits/$sha/check-runs" \
            --jq '[.check_runs[]|{name,conclusion,status,started_at}]
                  | sort_by(.name) | group_by(.name)
                  | map(sort_by(.started_at // "") | last)
                  | map({name, conclusion:((.conclusion//"")|ascii_upcase), status:((.status//"")|ascii_upcase)})' 2>/dev/null)
    if [ -n "$alt" ] && [ "$(echo "$alt" | jq 'length' 2>/dev/null || echo 0)" -gt 0 ]; then
      json="$alt"; via_fallback=1
      echo "ℹ️  el rollup del PR vino vacío; midiendo los check-runs del commit ${sha:0:8}"
      echo "   (pasa con runs de workflow_dispatch y con un 2º PR sobre una rama ya squash-mergeada)"
    fi
  fi
fi

# ── SIN MEDIR ≠ ROJO ───────────────────────────────────────────────────────────────────────────
# Si NI el rollup NI los check-runs del commit tienen nada, no hay medición: no se puede afirmar
# que el CI falló. Antes esto salía por exit 1, indistinguible de un job en rojo, y mandaba a
# buscar un bug inexistente — el falso rojo, que es el que enseña a pasar por encima del gate
# (`memoria/el-instrumento-tambien-CONDENA-no-solo-absuelve.md`). El exit 2 ya era, desde el
# docstring, «no pude medir»; esta ruta era la única de la clase que seguía en 1.
# Sigue diciendo el token ROJO a propósito: el invariante de salida monótona (exactamente uno de
# {VERDE, ROJO} en toda salida) es lo que hace fallar CERRADAS a las dos lecturas ingenuas del
# texto. Lo que distingue las dos causas es el EXIT CODE, que es el veredicto.
if [ "$(echo "$json" | jq 'length')" -eq 0 ]; then
  echo "--- CONTROL: 0 jobs presentes, $(echo $ESPERADOS | wc -w) esperados (rollup y check-runs, los dos vacíos) ---"
  echo "ROJO — SIN MEDIR: no es que el CI falló, es que no hay ninguna medición del PR $PR."
  echo "   destrabarlo:  gh workflow run tests.yml --ref \$(gh pr view $PR --json headRefName --jq .headRefName)"
  echo "   y si ya corrió así, este script ahora lee los check-runs del commit — revisá que el PR exista."
  exit 2
fi

falta=0
for j in $ESPERADOS; do
  # Se preguntan por separado PRESENCIA y CONCLUSIÓN, y no se usa `//` para el default.
  #
  # Por qué: en jq, `//` sustituye sólo `null` y `false` — NO la cadena vacía. Un job
  # `IN_PROGRESS` viene con `conclusion: ""` (cadena vacía, no null), así que
  # `.conclusion // "SIN-CONCLUSION"` devolvía "" y el script lo reportaba como
  # "no se encoló" cuando en realidad estaba corriendo. El veredicto salía bien por
  # accidente (los dos casos son NO-VERDE) y el diagnóstico era falso — exactamente el
  # tipo de error que este guard existe para no cometer. Cazado el 2026-08-07 en el PR #315.
  presente=$(echo "$json" | jq -r --arg n "$j" '[.[]|select(.name==$n)]|length')
  if [ "$presente" -eq 0 ]; then
    echo "❌ $j: NO ESTÁ en el rollup (no se encoló) — esto NO es 'pasó'"; falta=1; continue
  fi
  c=$(echo "$json" | jq -r --arg n "$j" '.[]|select(.name==$n)|.conclusion')
  st=$(echo "$json" | jq -r --arg n "$j" '.[]|select(.name==$n)|.status')
  if [ "$c" = "SUCCESS" ]; then
    echo "✅ $j: SUCCESS"
  elif [ -z "$c" ] || [ "$c" = "null" ]; then
    echo "❌ $j: sin conclusión todavía (status=$st) — está CORRIENDO, no pasó"; falta=1
  else
    echo "❌ $j: $c"; falta=1
  fi
done

# CONTROL POSITIVO horneado: si el rollup viniera vacío por un error de la query, los N jobs
# darían "NO ESTÁ" y el veredicto sería NO-VERDE — correcto, pero por el motivo equivocado.
# Este contador distingue "el CI no terminó" de "no estoy viendo nada".
presentes=$(echo "$json" | jq 'length')
esperados_n=$(echo $ESPERADOS | wc -w)
fuente="rollup del PR"
[ "$via_fallback" = "1" ] && fuente="check-runs del commit"
echo "--- CONTROL: $presentes jobs presentes en el $fuente, $esperados_n esperados ---"

if [ "$falta" -eq 0 ]; then
  # ── EL CI VERDE NO ES «SE PUEDE MERGEAR»: SON DOS PREGUNTAS ──────────────────────────────────
  #
  # POR QUÉ (2026-09-30, medido por auditoría con DOS PR el mismo minuto). Este script decía
  # «VERDE — se puede mergear» mirando SÓLO los jobs del CI, y esa frase salió idéntica sobre:
  #   · PR #765 → `mergeable: MERGEABLE` → se podía mergear de verdad (mergeado 4ca432f8)
  #   · PR #760 → `mergeable: CONFLICTING` / `DIRTY` → NO se podía: 5 archivos en conflicto
  # La frase era la misma y sólo una de las dos veces era verdad. El instrumento no medía mal:
  # contestaba OTRA pregunta con las palabras de ésta. Lo que frenó el merge fue que auditoría
  # consultó `mergeable` por su cuenta — o sea, el instrumento le había dado luz verde con la
  # palabra exacta que necesitaba oír. Es fail-open en el TEXTO: benigno mientras GitHub rechace
  # el merge por su lado, y NO benigno con `--admin`, que es justo lo que alguien prueba cuando
  # un merge "verde" no entra.
  #
  # El veredicto sigue siendo el EXIT CODE, y las causas NO se funden en un solo código: un
  # CONFLICTING no es «mirá tu código» (exit 1) ni «no pude medir» (exit 2) — es «resolvé el
  # merge», y merece el suyo. Fundirlos es la forma de que el falso rojo enseñe a saltear el gate.
  ms="$(estado_de_merge "$PR")"
  case "$ms" in
    MERGEABLE/*)
      # ⚠️ EL VEREDICTO DECLARA LO QUE MIDIO, y no es cosmetica: hasta hoy esta linea decia
      # solo «VERDE — se puede mergear», que es **palabra por palabra** la salida del
      # fail-open que #772 vino a matar (un `echo VERDE; exit 0` que no consultaba
      # `mergeable`). O sea que el recibo que se pega en un PR era indistinguible entre «medi
      # el merge y da MERGEABLE» y «no mire». El exit code no los separa: los dos son 0, y el
      # unico que los separa es el TEXTO — la misma leccion que el `guard NO evaluado` del
      # freeze nativo. Ahora el recibo trae el valor y el denominador.
      echo "VERDE — se puede mergear (merge=$ms · $presentes/$esperados_n jobs del $fuente)"
      exit 0
      ;;
    CONFLICTING/*)
      # Dice ROJO (no un tercer token) para no romper el invariante {VERDE, ROJO} que el test
      # test-ci-verde-veredicto-monotono.sh fija: toda salida imprime exactamente UNO, y ninguno
      # es substring del otro. Un consumidor que lea el texto mal sigue fallando CERRADO.
      #
      # ⚠️ Y NO ALCANZA CON NO USAR «VERDE» COMO VEREDICTO: tampoco puede aparecer la PALABRA en
      # una salida roja. La primera versión de esta línea decía «el CI está VERDE pero el PR tiene
      # CONFLICTOS» — descriptivamente perfecto, y el test la marcó «imprimió LOS DOS veredictos»,
      # porque `grep -cw VERDE` la cuenta igual. La escribí en la línea siguiente al comentario que
      # advierte justo eso: el invariante es sobre el TEXTO, no sobre la intención. Por eso acá se
      # dice «el CI pasó».
      echo "ROJO — no mergear: el CI pasó, pero el PR tiene CONFLICTOS ($ms) — resolvé el merge, no busques un bug"
      exit 4
      ;;
    *)
      # UNKNOWN o vacío. GitHub calcula `mergeable` de forma ASÍNCRONA, así que UNKNOWN es un
      # estado NORMAL en los primeros segundos de un PR — tratarlo como conflicto sería un guard
      # que grita en el caso normal, y ésos se desarman solos. `estado_de_merge` ya repreguntó una
      # vez. Si sigue sin informar, esto es «no pude medir» (exit 2), no un rojo.
      echo "ROJO — SIN MEDIR: el CI pasó, pero GitHub no informa si el PR es mergeable ($ms) — volvé a correrlo"
      exit 2
      ;;
  esac
fi
# 🔴 Dice ROJO y NO "NO VERDE" a proposito, y no es cosmetica: el veredicto positivo era
# SUBSTRING del negativo, asi que un consumidor que grepeara "VERDE" en la salida (en vez de
# usar el exit code) matcheaba TAMBIEN el rechazo -- y fallaba ABIERTO, hacia el merge. Cazado
# el 2026-09-28: un loop mergeo el PR #693 con el CI todavia corriendo por exactamente eso, y
# salio verde por suerte. La forma correcta ya la usaba este repo (smoke_afip_http.py:157,
# e2e_facturacion_http.py:217): VERDE / ROJO, que no son prefijo uno del otro.
# El veredicto sigue siendo EL EXIT CODE; esto solo hace que leer la salida mal no fallen abierto.
echo "ROJO — no mergear: hay al menos un job ausente o fallado (medido, no supuesto)"
exit 1
