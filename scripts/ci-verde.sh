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
# SALIDA: exit 0 = verde (mergeable) · exit 1 = NO verde (falta alguno o alguno falló).
set -uo pipefail

PR="${1:?uso: ci-verde.sh <numero-de-PR> [\"job1 job2 ...\"]}"
ESPERADOS="${2:-backend core web mobile lint drift}"

json=$(gh pr view "$PR" --json statusCheckRollup --jq '[.statusCheckRollup[]|{name,conclusion,status}]') || {
  echo "❌ no pude leer el rollup del PR $PR (¿número correcto? ¿gh autenticado?)"; exit 1; }

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
echo "--- CONTROL: $presentes jobs presentes en el rollup, $esperados_n esperados ---"
[ "$presentes" -eq 0 ] && echo "⚠️  el rollup vino VACÍO: no es que el CI falló, es que no estás midiendo nada"

if [ "$falta" -eq 0 ]; then
  echo "VERDE — se puede mergear"
  exit 0
fi
echo "NO VERDE — no mergear"
exit 1
