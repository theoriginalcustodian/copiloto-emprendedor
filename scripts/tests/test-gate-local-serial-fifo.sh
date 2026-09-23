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
# La aserción acepta las TRES salidas legítimas de la cola. Con WAIT=1s y la máquina cargada (5
# sesiones), la primera vuelta del loop puede caer YA pasado el segundo y salir por TIMEOUT sin
# imprimir nunca «no es mi turno»: afirmar sólo esa línea medía la carga de la máquina, no la cola.
# Lo capturó FE2 el 2026-09-22 y acá no se reproducía. Lo que el caso 1 mide se mantiene entero
# —no corrió, y fue la cola— porque ambas ramas atribuyen a la cola y el caso 2 (NOFIFO) aísla que
# sea ella. Subir el WAIT haría el flake más raro, no imposible: eso sería tapar, no arreglar.
# 2026-09-22 — ahi estaba el flake que backend reportó con 3 gates simultáneos: `gate-local-serial.sh`
# parte el TIMEOUT en DOS mensajes según el candado (`:96` vs `:98`), y sólo uno tenía el patrón que
# se grepeaba acá:
#   polling         -> «no es mi turno»                                        (ya aceptado)
#   timeout, LIBRE  -> «… ticket(s) más viejo(s) delante en la cola»            (ya aceptado)
#   timeout, TOMADO -> «sigo sin turno tras Ns: lo tiene 'X'. No corro encima»  (FALTABA)
# La tercera sale cuando el script alcanza a hacer `mkdir` del candado antes de mirar la cola — orden
# que cambia bajo contención real, por eso no se reproduce aislado. NO se sube `GATE_LOCAL_WAIT`,
# que era lo que pedía el reporte: el margen no es la causa. El caso 7 la ejercita a propósito.
[ "$rc" -ne 0 ] && ! grep -q CORRIO "$T/out" \
  && grep -qE 'no es mi turno|más viejo\(s\) delante en la cola|sigo sin turno tras [0-9]+s: lo tiene' "$T/out" \
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

# 7 — la TERCERA salida de timeout, ejercitada A PROPÓSITO y no por suerte de scheduling. Ampliar el
# grep del caso 1 no alcanza: si ninguna corrida produce esa rama, la alternativa nueva del patrón
# nunca se ejercita y el test pasaría igual estando rota
# (memoria/instrumento-que-no-mira-nunca-falla.md). Acá el candado queda TOMADO por un dueño VIVO y
# sin tickets: `mi_turno` es cierto, el `mkdir` de :78 falla porque el dir ya existe, y el loop sale
# por la rama `-d "$LOCK"` de :96. Determinista — no depende de la carga de la máquina.
rm -rf "$COLA" "$LOCK"; mkdir -p "$LOCK"; echo "$VIVO otro-worktree" > "$LOCK/owner"
env GATE_LOCAL_LOCK="$LOCK" GATE_LOCAL_WAIT=1 GATE_LOCAL_POLL=1 GATE_LOCAL_TTL=3600 GATE_LOCAL_LOGDIR="$LOGDIR" GATE_LOCAL_CMD="echo CORRIO" bash "$SCRIPT" > "$T/out" 2>&1; rc=$?
if [ "$rc" -ne 0 ] && ! grep -q CORRIO "$T/out" && grep -qE "sigo sin turno tras [0-9]+s: lo tiene" "$T/out"; then
  ok "7 candado tomado por dueño vivo -> 3.ª salida de timeout, la que el caso 1 no aceptaba"
else
  fail "7 rc=$rc corrio=$(grep -c CORRIO "$T/out") out=$(tail -1 "$T/out" | cut -c1-70)"
fi

# 8 — CONTROL POSITIVO del 7: el MISMO montaje con el dueño MUERTO tiene que correr. Sin esto, el 7
# pasaría igual si el script se negara a correr por cualquier otro motivo, y no probaría que lo que
# frena es un dueño VIVO.
rm -rf "$COLA" "$LOCK"; mkdir -p "$LOCK"; echo "$MUERTO otro-worktree" > "$LOCK/owner"
env GATE_LOCAL_LOCK="$LOCK" GATE_LOCAL_WAIT=5 GATE_LOCAL_POLL=1 GATE_LOCAL_TTL=3600 GATE_LOCAL_LOGDIR="$LOGDIR" GATE_LOCAL_CMD="echo CORRIO" bash "$SCRIPT" > "$T/out" 2>&1; rc=$?
if [ "$rc" -eq 0 ] && grep -q CORRIO "$T/out"; then
  ok "8 control: mismo montaje con dueño muerto -> libera el huérfano y SÍ corre"
else
  fail "8 rc=$rc — el 7 no prueba que lo que frena sea un dueño VIVO"
fi

[ "$fallos" -eq 0 ] && echo "  OK" || { echo "  $fallos fallo(s)"; exit 1; }
