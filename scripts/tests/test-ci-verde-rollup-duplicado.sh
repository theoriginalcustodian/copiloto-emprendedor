#!/usr/bin/env bash
# test-ci-verde-rollup-duplicado.sh — el rollup trae cada job UNA VEZ POR RUN.
#
# 🔴 EL CASO (2026-10-05, PR #778 con dos pushes). `statusCheckRollup` devolvió **12** entradas para
# **6** jobs. Con duplicados, `jq '.[]|select(.name==$n)|.conclusion'` imprime dos líneas y la
# comparación recibe `"SUCCESS\nSUCCESS"`: el gate imprimía `❌ backend: SUCCESS` —condenando un job
# que pasó— y cerraba en ROJO por `12 presentes / 6 esperados`. Dos pushes a un PR es el caso
# NORMAL, así que el gate se ponía rojo casi siempre, y un gate así se saltea con `--admin`.
#
# 🔴 POR QUÉ NINGUNO DE LOS 14 CASOS EXISTENTES PODÍA VERLO: el `stub_gh` de
# `test-ci-verde-veredicto-monotono.sh` recibe el rollup **ya filtrado** (su propio parámetro se
# llama así) y lo devuelve tal cual, así que los tests entran POR DEBAJO del `jq` del script — y el
# defecto vivía EN el `jq`. Verde con el camino de producción sin ejercitar.
# [[el-test-que-no-usa-el-camino-de-produccion-no-puede-verlo-fallar]]
#
# Por eso este test NO stubea `gh`: hace `eval` de la línea `ROLLUP_JQ=` del script y aplica **la
# misma expresión que corre en producción** a rollups crudos. Si el día que alguien la cambie el
# desempate se rompe, acá se pone rojo.
#
# EL CASO DECISIVO es el 2: `FAILURE` nuevo sobre `SUCCESS` viejo tiene que dar **FAILURE**. Sin él,
# el fix de hoy podría estar tomando «cualquiera de los dos» y la corrida real no lo distinguiría
# (los dos duplicados eran SUCCESS) — un fail-open que mergea con el CI nuevo roto.
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SCRIPT="$ROOT/scripts/ci-verde.sh"
[ -f "$SCRIPT" ] || { echo "no existe $SCRIPT"; exit 1; }
command -v jq >/dev/null || { echo "no hay jq en el PATH"; exit 1; }

fallos=0
ok()  { printf '  OK   %s\n' "$1"; }
mal() { printf '  MAL  %s\n' "$1"; fallos=$((fallos+1)); }
check() { if [ "$2" = "$3" ]; then ok "$1"; else mal "$1 — esperaba [$2], obtuve [$3]"; fi; }
echo "test-ci-verde-rollup-duplicado"

# ── La expresión REAL, extraída del script. Fail-closed: sin ella no hay test. ─────────────────
linea="$(grep -m1 '^ROLLUP_JQ=' "$SCRIPT" || true)"
if [ -z "$linea" ]; then
  echo "  MAL  no encontré la línea 'ROLLUP_JQ=' en ci-verde.sh — el filtro volvió a estar inline"
  echo "       (si se movió a otro lado, este test hay que actualizarlo: mide la expresión real)"
  exit 1
fi
eval "$linea"
if [ -z "${ROLLUP_JQ:-}" ]; then
  echo "  MAL  ROLLUP_JQ quedó vacía tras el eval"; exit 1
fi
ok "extraje la expresión de producción ($(printf '%s' "$ROLLUP_JQ" | wc -c) chars)"

filtrar() { printf '%s' "$1" | jq -c "$ROLLUP_JQ"; }
entrada() { # entrada <name> <conclusion> <startedAt>
  printf '{"name":"%s","conclusion":"%s","status":"COMPLETED","startedAt":"%s"}' "$1" "$2" "$3"
}

# ── Caso 1: 12 entradas de 6 jobs -> 6. Es el caso que daba ROJO. ─────────────────────────────
dups=""
for j in backend core web mobile lint drift; do
  dups="$dups,$(entrada "$j" SUCCESS 2026-10-05T16:30:00Z),$(entrada "$j" SUCCESS 2026-10-05T16:56:00Z)"
done
roll="{\"statusCheckRollup\":[${dups#,}]}"
out="$(filtrar "$roll")"
check "1 doce entradas de seis jobs -> 6" "6" "$(printf '%s' "$out" | jq 'length')"
check "1 y ninguna conclusion queda duplicada" "6" \
  "$(printf '%s' "$out" | jq '[.[]|select(.conclusion=="SUCCESS")]|length')"

# ── Caso 2: EL DECISIVO. El run NUEVO falló: no puede quedar tapado por el viejo verde. ───────
roll2="{\"statusCheckRollup\":[$(entrada backend SUCCESS 2026-10-05T16:30:00Z),$(entrada backend FAILURE 2026-10-05T16:56:00Z)]}"
out2="$(filtrar "$roll2")"
check "2 DECISIVO: FAILURE nuevo sobre SUCCESS viejo -> FAILURE" "FAILURE" \
  "$(printf '%s' "$out2" | jq -r '.[0].conclusion')"
check "2 y queda una sola entrada" "1" "$(printf '%s' "$out2" | jq 'length')"
# El orden en el array no debe cambiar el veredicto: mismo par, invertido.
roll2b="{\"statusCheckRollup\":[$(entrada backend FAILURE 2026-10-05T16:56:00Z),$(entrada backend SUCCESS 2026-10-05T16:30:00Z)]}"
check "2 y no depende del ORDEN en que vengan" "FAILURE" \
  "$(filtrar "$roll2b" | jq -r '.[0].conclusion')"

# ── Caso 3: el inverso — el re-run arregló el rojo. Es el falso ROJO que esto vino a matar. ───
roll3="{\"statusCheckRollup\":[$(entrada mobile FAILURE 2026-10-05T14:00:00Z),$(entrada mobile SUCCESS 2026-10-05T16:56:00Z)]}"
check "3 SUCCESS nuevo sobre FAILURE viejo -> SUCCESS" "SUCCESS" \
  "$(filtrar "$roll3" | jq -r '.[0].conclusion')"

# ── Caso 4: un job sin duplicar no se pierde, ni aunque no traiga startedAt (StatusContext). ──
roll4='{"statusCheckRollup":[{"name":"solo","conclusion":"SUCCESS","status":"COMPLETED"}]}'
check "4 entrada unica sin startedAt sobrevive" "1" "$(filtrar "$roll4" | jq 'length')"
check "4 y conserva su conclusion" "SUCCESS" "$(filtrar "$roll4" | jq -r '.[0].conclusion')"
# Y el fechado le gana al no fechado, no al revés: un CheckRun real pesa más que un contexto mudo.
roll4b="{\"statusCheckRollup\":[{\"name\":\"x\",\"conclusion\":\"FAILURE\",\"status\":\"COMPLETED\"},$(entrada x SUCCESS 2026-10-05T16:56:00Z)]}"
check "4 el fechado gana al no fechado" "SUCCESS" "$(filtrar "$roll4b" | jq -r '.[0].conclusion')"

# ── Caso 5: empate exacto de startedAt. No puede devolver dos. ────────────────────────────────
roll5="{\"statusCheckRollup\":[$(entrada emp SUCCESS 2026-10-05T16:56:00Z),$(entrada emp SUCCESS 2026-10-05T16:56:00Z)]}"
check "5 empate de startedAt -> una sola entrada" "1" "$(filtrar "$roll5" | jq 'length')"

# ── Caso 6: rollup vacío sigue siendo vacío (el fallback a /check-runs depende de eso). ───────
check "6 rollup vacio -> 0 (el fallback lo necesita asi)" "0" \
  "$(filtrar '{"statusCheckRollup":[]}' | jq 'length')"

# ── Caso 7: CONTROL POSITIVO DEL TEST — sin dedupe, el caso 1 daría 12. Si esto no se cumple, ──
# el fixture no tiene duplicados de verdad y los casos de arriba no prueban nada.
check "7 CONTROL: el fixture SI trae duplicados (sin dedupe daria 12)" "12" \
  "$(printf '%s' "$roll" | jq '[.statusCheckRollup[]|{name,conclusion,status}]|length')"

echo
if [ "$fallos" = 0 ]; then
  echo "TODO VERDE -- el rollup se deduplica por job tomando el run MAS RECIENTE (7 casos)"
  exit 0
fi
echo "$fallos check(s) fallaron"
exit 1
