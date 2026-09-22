#!/usr/bin/env bash
# gate-local-serial.sh — corre `scripts/gate.sh` del worktree ACTUAL, de a UN gate por máquina.
#
# Por qué existe (2026-09-22, beta Odobi): con 4 sesiones vivas la PC quedó con ~5 GB de commit libre
# sobre 39,6 GB. Dos gates a la vez → OOM de V8 en el job `mobile` y `fork: Resource temporarily
# unavailable` en los scripts. El rojo no venía del código: era la máquina. Un rojo así lava la
# próxima regresión real (memoria un-instrumento-compartido-intermitente-fabrica-una-excusa-lista).
#
# `scripts/ci/candado-stage.sh` ya serializa el stage del VPS (por SSH); no cubre lo que corre en la
# PC. Este wrapper usa la misma idea con un `mkdir` atómico en el git-common-dir, que comparten
# todos los worktrees:
#   - el dueño queda en `owner` (pid + worktree);
#   - si el pid del dueño ya no vive, o el candado pasó el TTL, se libera y se toma;
#   - si otro gate vive, se espera con tope (GATE_LOCAL_WAIT) y se sale con rc=1 si no se libera.
#
# Uso (desde TU worktree; la ruta absoluta sirve antes de que esto llegue a main):
#   UC_SESION=fe1 bash /c/gfw-src/wt-plan2/scripts/gate-local-serial.sh [jobs de gate.sh...]
# Overrides para test: GATE_LOCAL_LOCK · GATE_LOCAL_CMD · GATE_LOCAL_WAIT · GATE_LOCAL_TTL · GATE_LOCAL_POLL
set -uo pipefail

LOCK="${GATE_LOCAL_LOCK:-$(git rev-parse --path-format=absolute --git-common-dir)/gate-local.lock}"
ESPERA="${GATE_LOCAL_WAIT:-3600}"
TTL="${GATE_LOCAL_TTL:-3600}"
POLL="${GATE_LOCAL_POLL:-20}"
CMD="${GATE_LOCAL_CMD:-bash scripts/gate.sh}"

yo="$$ $(basename "$PWD")"
t0=$(date +%s)

while ! mkdir "$LOCK" 2>/dev/null; do
  dueno="$(cat "$LOCK/owner" 2>/dev/null || echo '')"
  pid="${dueno%% *}"
  edad=$(( $(date +%s) - $(stat -c %Y "$LOCK" 2>/dev/null || date +%s) ))
  # Sin owner todavía: el otro acaba de hacer mkdir y está por escribirlo. No es huérfano.
  if [ -n "$pid" ] && ! kill -0 "$pid" 2>/dev/null; then
    echo "==> candado local huérfano (dueño '$dueno' ya no corre): lo libero"
    rm -rf "$LOCK"; continue
  fi
  if [ "$edad" -ge "$TTL" ]; then
    echo "==> candado local vencido (${edad}s ≥ ${TTL}s, dueño '$dueno'): lo libero"
    rm -rf "$LOCK"; continue
  fi
  if [ $(( $(date +%s) - t0 )) -ge "$ESPERA" ]; then
    echo "==> ❌ otro gate local sigue corriendo tras ${ESPERA}s (dueño '$dueno'). No corro encima." >&2
    exit 1
  fi
  echo "==> otro gate local corre (dueño '$dueno', ${edad}s) — espero ${POLL}s"
  sleep "$POLL"
done

echo "$yo" > "$LOCK/owner"
# Sólo borra el candado si sigue siendo nuestro (otro pudo liberarlo por TTL y tomarlo).
trap '[ "$(cat "$LOCK/owner" 2>/dev/null)" = "$yo" ] && rm -rf "$LOCK"' EXIT
echo "==> candado local tomado ($yo)"

$CMD "$@"
