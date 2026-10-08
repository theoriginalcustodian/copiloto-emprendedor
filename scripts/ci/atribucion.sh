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

# Los padrones de ids autorizados NO se hardcodean: se descubren por glob sobre lo versionado.
# Si el glob no encuentra nada, el gate lo DICE en vez de aprobar por vacío (un instrumento
# ciego contesta "no hay" cuando la verdad es "no veo" — memoria/un-instrumento-ciego-*).
padrón_ids() {
  local f
  for f in "$RAIZ"/docs/copiloto-emprendedor/*backlog*.md \
           "$RAIZ"/docs/copiloto-emprendedor/*acta*.md \
           "$RAIZ"/docs/copiloto-emprendedor/*ARRANQUE*.md; do
    [ -f "$f" ] && cat "$f"
  done
}

# UNA sola definición del patrón de id. Vivía dos veces (padrón y commit) y el primer fix
# llegó a una sola mitad: `BL-[A-Z]?[0-9]+` no reconocía `BL-ZZ999`, así que una cita
# inexistente se reportaba como "no citó nada" en vez de "citó un id que no existe".
# memoria/dos-implementaciones-del-mismo-cliente-el-fix-llega-a-una.md
RE_ID='\b(BL-[A-Z0-9]+|DEC-[0-9]+|M-[0-9]+)\b'

PADRON="$(padrón_ids | grep -ohE "$RE_ID" | sort -u)"
N_PADRON="$(printf '%s' "$PADRON" | grep -c . || true)"

if [ "$N_PADRON" -eq 0 ]; then
  echo "[atribucion] ⚠️  el padrón de ids autorizados salió VACÍO — no apruebo por vacío."
  echo "             (revisá los globs de padrón_ids: sin padrón, este gate no mide nada)"
  [ "$BLOQUEA" = "1" ] && exit 1
  exit 0
fi

COMMITS="$(git log --format='%H' "$RANGO" 2>/dev/null || true)"
N="$(printf '%s' "$COMMITS" | grep -c . || true)"
if [ "$N" -eq 0 ]; then
  echo "[atribucion] 0 commits en $RANGO — nada que medir."
  exit 0
fi

n_ok=0; n_libre=0; n_sin=0; n_fantasma=0
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
      n_ok=$((n_ok + 1)); detalle="$detalle\n  OK       $corto  <-$vivos"
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

no_atribuidos=$((n_sin + n_fantasma))
pct=$(( no_atribuidos * 100 / N ))

echo "[atribucion] $N commits en $RANGO · padrón: $N_PADRON ids autorizados"
printf '%b\n' "${detalle# }"
echo "[atribucion] autorizados=$n_ok · libre-declarado=$n_libre · SIN-ID=$n_sin · FANTASMA=$n_fantasma"
echo "[atribucion] no atribuido: ${pct}% ($no_atribuidos de $N)"

if [ "$BLOQUEA" = "1" ] && [ "$no_atribuidos" -gt 0 ]; then
  echo "[atribucion] ⛔ RECHAZADO: $no_atribuidos commit(s) sin id autorizado."
  echo "             Citá un BL-*/DEC-*/M-*/contrato_ del padrón, o declaralo explícito"
  echo "             con una línea  'ATRIBUCION: libre — <motivo>'  en el cuerpo del commit."
  exit 1
fi
echo "[atribucion] modo REPORTE (UC_ATRIBUCION_BLOQUEA=1 para bloquear) — no freno el push."
exit 0
