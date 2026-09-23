#!/usr/bin/env bash
# test-gate-local-serial-fifo.sh — el wrapper reparte turnos por orden de llegada y deja log propio.
#
# Antes, el candado `mkdir` serializaba pero NO repartía: al liberarse competían todos y ganaba el
# que despertara antes de su `sleep`, así que una sesión podía quedar postergada. Se saltearon 3
# turnos el 2026-09-22.
#
#   1. NEGATIVO  hay un ticket MÁS VIEJO de un proceso VIVO -> no corre, espera su turno (rc≠0 con
#                GATE_LOCAL_WAIT corto) y NO ejecuta el comando.
#   2. CONTROL   el mismo caso 1 con GATE_LOCAL_NOFIFO=1 -> SÍ corre. Aísla el efecto de la cola:
#                sin esto, el caso 1 pasaría igual si el script estuviera roto y nunca corriera.
#   3. POSITIVO  ticket más viejo de un proceso MUERTO -> lo purga y corre (un aspirante caído no
#                puede bloquear la cola para siempre).
#   4. POSITIVO  cola vacía -> corre, y su ticket NO queda tirado al salir.
#   5. POSITIVO  el log queda completo y fuera del worktree, con la salida del gate.
#   6. NEGATIVO  gate ROJO -> el rc que se devuelve es el del gate, no el del `tee` (que sale 0).
#
# ⚠️ Pareja: `test-gate-local-serial.sh` (el que ya existía) cubre la EXCLUSIÓN mutua -- dos gates
# simultáneos que no se pisan, huérfano, liberación. Este archivo se escribió sin verlo, y aquél
# cazó la regresión: una variable `LOG` del wrapper le pisaba la del gate falso. Corré los dos.
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SCRIPT="$ROOT/scripts/gate-local-serial.sh"
fallos=0
ok()   { printf '  ✅ %s\n' "$1"; }
fail() { printf '  ❌ %s\n' "$1"; fallos=$((fallos + 1)); }
echo "test-gate-local-serial-fifo"

T="$(mktemp -d)"; trap 'rm -rf "$T"; kill %1 2>/dev/null' EXIT
LOCK="$T/gate.lock"; COLA="$LOCK.cola"; LOGDIR="$T/logs"

# Proceso vivo de verdad para que `kill -0` diga que sí: un ticket sólo bloquea si su dueño respira.
sleep 300 & VIVO=$!
MUERTO=$(bash -c 'echo $$')            # pid de un proceso que ya terminó

correr() {  # correr <extra-env...> -> rc; deja la salida en $T/out
  rm -rf "$LOCK"
  env GATE_LOCAL_LOCK="$LOCK" GATE_LOCAL_WAIT=1 GATE_LOCAL_POLL=1 GATE_LOCAL_LOGDIR="$LOGDIR" \
      "$@" bash "$SCRIPT" > "$T/out" 2>&1
}
ticket_viejo() { mkdir -p "$COLA"; rm -f "$COLA"/*; echo 'otro wt' > "$COLA/1000000000000000000-$1"; }

# 1
ticket_viejo "$VIVO"
correr GATE_LOCAL_CMD="echo CORRIO"; rc=$?
[ "$rc" -ne 0 ] && ! grep -q CORRIO "$T/out" && grep -q 'no es mi turno' "$T/out" \
  && ok "1 ticket más viejo vivo -> espera su turno, no corre" \
  || fail "1 rc=$rc corrió=$(grep -c CORRIO "$T/out") out=$(tail -1 "$T/out" | cut -c1-60)"

# 2
ticket_viejo "$VIVO"
correr GATE_LOCAL_NOFIFO=1 GATE_LOCAL_CMD="echo CORRIO"; rc=$?
[ "$rc" -eq 0 ] && grep -q CORRIO "$T/out" \
  && ok "2 control: sin la cola el mismo caso SÍ corre (el 1 mide la cola)" \
  || fail "2 rc=$rc — el caso 1 no prueba que sea la cola"

# 3
ticket_viejo "$MUERTO"
correr GATE_LOCAL_CMD="echo CORRIO"; rc=$?
[ "$rc" -eq 0 ] && grep -q CORRIO "$T/out" && [ ! -e "$COLA/1000000000000000000-$MUERTO" ] \
  && ok "3 ticket de un proceso muerto -> se purga y corre" \
  || fail "3 rc=$rc — un aspirante caído bloquea la cola"

# 4
rm -rf "$COLA"
correr GATE_LOCAL_CMD="echo CORRIO"; rc=$?
quedan=$(ls "$COLA" 2>/dev/null | wc -l)
[ "$rc" -eq 0 ] && [ "$quedan" -eq 0 ] && ok "4 cola vacía -> corre y no deja su ticket tirado" \
  || fail "4 rc=$rc tickets tirados=$quedan"

# 5
rm -rf "$COLA" "$LOGDIR"
correr UC_SESION=plan GATE_LOCAL_CMD="echo SALIDA-DEL-GATE"; rc=$?
log="$(ls "$LOGDIR"/gate-plan-* 2>/dev/null | head -1)"
[ -n "$log" ] && grep -q 'SALIDA-DEL-GATE' "$log" \
  && ok "5 log propio fuera del worktree, con la salida del gate" \
  || fail "5 no encontré el log con la salida (LOGDIR=$(ls "$LOGDIR" 2>/dev/null | tr '\n' ' '))"

# 6 — el comando va en un script aparte: `$CMD` se expande en PALABRAS y las comillas simples de un
# `bash -c '…'` no se re-interpretan, así que el gate recibiría basura y el rc no mediría nada.
printf 'echo rojo\nexit 3\n' > "$T/rojo.sh"
rm -rf "$COLA"
correr GATE_LOCAL_CMD="bash $T/rojo.sh"; rc=$?
[ "$rc" -eq 3 ] && grep -q rojo "$T/out" && ok "6 gate rojo -> devuelve el rc del gate (3), no el del tee" \
  || fail "6 rc=$rc, esperaba 3 — el tee se estaría comiendo el rojo"

[ "$fallos" -eq 0 ] && echo "  OK" || { echo "  $fallos fallo(s)"; exit 1; }
