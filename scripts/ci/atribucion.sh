#!/usr/bin/env bash
# Gate de ATRIBUCIÓN: ¿cada commit que se pushea corresponde a un trabajo AUTORIZADO?
#
# Por qué existe (forense 2026-10-08 sobre el transcript de 2 meses, 143.102 líneas):
# había 17 piezas en scripts/ci/ y ninguna verificaba PERTINENCIA — todas miden CALIDAD
# (tests, secretos, drift, paridad). Resultado medido: 64 PRs en un día, de los cuales 4
# citaban un id del backlog que el operador firmó, con 113 ids disponibles sin tomar.
# Un gate que no mira nunca falla, y éste es el que faltaba.
#   docs/copiloto-emprendedor/Auditorias/2026-10-08-forense-desvio-de-scope-medido-sobre-el-transcript.md
#
# Qué cuenta como autorizado:
#   - BL-*      un id del backlog con DoD firmado
#   - DEC-*     un acta/decisión del operador
#   - contrato_ un contrato bajado por planificación al buzón
#   - M-*       un id de sprint declarado en un doc de arranque versionado
#   - la línea explícita  "ATRIBUCION: libre — <motivo>"  → se CUENTA y se reporta, no se oculta
#
# MODO: reporte por defecto (exit 0 siempre). Bloquea sólo con UC_ATRIBUCION_BLOQUEA=1.
# Arranca en reporte a propósito: un guard que grita en el caso normal se desarma solo
# (memoria/el-guard-que-grita-en-el-caso-normal-se-desarma-solo.md). Primero se mide el
# ratio contra tráfico real; el umbral se fija con ese número, no con una intuición.
#
# Uso:  atribucion.sh [<rango-git>]        (default: origin/main..HEAD)
#       UC_ATRIBUCION_BLOQUEA=1 atribucion.sh
set -uo pipefail

RANGO="${1:-origin/main..HEAD}"
BLOQUEA="${UC_ATRIBUCION_BLOQUEA:-0}"
RAIZ="$(git rev-parse --show-toplevel 2>/dev/null || echo .)"

# El padrón y el patrón de id viven en UNA sola definición, compartida con goal.sh.
# La lib se busca al lado de ESTE script, no en el repo medido: el gate puede correr sobre
# un repo ajeno (así lo ejercita su propio test) y ahí `$RAIZ/scripts/` no existe. Resolverla
# por $RAIZ hacía que el padrón saliera vacío y el caso "padrón vacío" del test pasara a verde
# por la causa equivocada — dos causas distintas comparten el código de salida.
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib-padron.sh"

# GOAL activo (opcional): si existe, el gate deja de medir contra los ~150 ids del padrón y
# mide contra UNO. Eso es lo que lo vuelve seguro de poner bloqueante: con una orden de
# trabajo declarada, un commit que cite OTRO id autorizado también es desvío — cambiar de
# orden es un comando (`goal.sh set <otro>`), no un hecho consumado en el commit.
GOAL_ID=""
[ -f "$RAIZ/.goal" ] && GOAL_ID="$(grep -E '^id=' "$RAIZ/.goal" | head -1 | cut -d= -f2-)"

PADRON="$(padron_ids "$RAIZ")"
N_PADRON="$(printf '%s' "$PADRON" | grep -c . || true)"

if [ "$N_PADRON" -eq 0 ]; then
  echo "[atribucion] ⚠️  el padrón de ids autorizados salió VACÍO — no apruebo por vacío."
  echo "             (revisá los globs de padron_ids en lib-padron.sh: sin padrón, este gate no mide nada)"
  [ "$BLOQUEA" = "1" ] && exit 1
  exit 0
fi

COMMITS="$(git log --format='%H' "$RANGO" 2>/dev/null || true)"
N="$(printf '%s' "$COMMITS" | grep -c . || true)"
if [ "$N" -eq 0 ]; then
  echo "[atribucion] 0 commits en $RANGO — nada que medir."
  exit 0
fi

n_ok=0; n_libre=0; n_sin=0; n_fantasma=0; n_fuera=0
detalle=""
while IFS= read -r sha; do
  [ -z "$sha" ] && continue
  msg="$(git log -1 --format='%B' "$sha")"
  corto="$(git log -1 --format='%h %s' "$sha" | cut -c1-72)"
  # El id vale SÓLO en el asunto (1ª línea) o en una línea dedicada `ATRIBUCION: <ids>`.
  # Medido el 08/10: leer el cuerpo COMPLETO daba 8% no atribuido contra 62,5% real, porque
  # mis mensajes MENCIONAN ids de pasada — un commit sobre «mi propio grep» citaba 7 BL-*
  # en su prosa y el gate lo aprobaba. Mencionar un id no es trabajar en ese id: un gate que
  # se satisface con una mención se absuelve solo.
  ids="$( { printf '%s\n' "$msg" | head -1
            printf '%s\n' "$msg" | grep -iE '^ATRIBUCION:' ; } | grep -ohE "$RE_ID" | sort -u)"
  if printf '%s' "$msg" | grep -qE '^ATRIBUCION:[[:space:]]*libre'; then
    n_libre=$((n_libre + 1)); detalle="$detalle\n  LIBRE     $corto"
  elif [ -n "$ids" ]; then
    # Un id citado que NO existe en el padrón es un id INVENTADO: cita sin respaldo.
    vivos=""
    while IFS= read -r id; do
      [ -z "$id" ] && continue
      printf '%s\n' "$PADRON" | grep -qx "$id" && vivos="$vivos $id"
    done <<< "$ids"
    if [ -n "$vivos" ]; then
      # Con GOAL activo, citar otro id autorizado TAMBIÉN es desvío: es trabajo legítimo y
      # ajeno a la orden declarada, que es exactamente lo que el forense midió (64 PRs / 4
      # del backlog). Cambiar de orden es un comando, no un hecho consumado en el commit.
      if [ -n "$GOAL_ID" ] && ! printf '%s' " $vivos " | grep -q " $GOAL_ID "; then
        n_fuera=$((n_fuera + 1))
        detalle="$detalle
  FUERA-GOAL $corto  <-$vivos (el goal es $GOAL_ID)"
      else
        n_ok=$((n_ok + 1)); detalle="$detalle
  OK       $corto  <-$vivos"
      fi
    else
      n_fantasma=$((n_fantasma + 1))
      detalle="$detalle\n  FANTASMA  $corto  <- $(printf '%s' "$ids" | tr '\n' ' ')(no está en el padrón)"
    fi
  elif printf '%s' "$msg" | grep -qE 'contrato_[a-z0-9._-]+'; then
    n_ok=$((n_ok + 1)); detalle="$detalle\n  OK        $corto  <- contrato_"
  else
    n_sin=$((n_sin + 1)); detalle="$detalle\n  SIN-ID    $corto"
  fi
done <<< "$COMMITS"

no_atribuidos=$((n_sin + n_fantasma + n_fuera))
pct=$(( no_atribuidos * 100 / N ))

echo "[atribucion] $N commits en $RANGO · padrón: $N_PADRON ids autorizados${GOAL_ID:+ · 🎯 GOAL=$GOAL_ID}"
printf '%b\n' "${detalle# }"
echo "[atribucion] autorizados=$n_ok · libre-declarado=$n_libre · SIN-ID=$n_sin · FANTASMA=$n_fantasma · FUERA-GOAL=$n_fuera"
echo "[atribucion] no atribuido: ${pct}% ($no_atribuidos de $N)"

if [ "$BLOQUEA" = "1" ] && [ "$no_atribuidos" -gt 0 ]; then
  echo "[atribucion] ⛔ RECHAZADO: $no_atribuidos commit(s) sin id autorizado."
  if [ -n "$GOAL_ID" ]; then
    echo "             El goal activo es $GOAL_ID. Citalo en el asunto, cambiá de goal con"
    echo "             'scripts/goal.sh set <OTRO>', o declaralo explícito"
  else
    echo "             Citá un BL-*/DEC-*/M-*/contrato_ del padrón, o declaralo explícito"
  fi
  echo "             con una línea  'ATRIBUCION: libre — <motivo>'  en el cuerpo del commit."
  exit 1
fi
echo "[atribucion] modo REPORTE (UC_ATRIBUCION_BLOQUEA=1 para bloquear) — no freno el push."
exit 0
