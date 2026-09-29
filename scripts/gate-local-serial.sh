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
# FIFO por ticket (2026-09-22, 2.ª vuelta): el `mkdir` solo NO reparte turnos. Al liberarse el
# candado, todos los que esperaban competían y ganaba el que despertara antes de su `sleep`, así que
# una sesión podía quedar postergada mientras las otras se turnaban: se saltearon 3 turnos en un día.
# Ahora cada aspirante deja un ticket `<epoch-ns>-<pid>` en la cola y sólo intenta tomar el candado
# cuando su ticket es el más viejo de los que siguen vivos; los tickets de procesos muertos se
# purgan. Sin esto, el wrapper serializa (que era su objetivo) pero reparte por sorteo.
#
# Log propio: todo lo que imprime el gate va COMPLETO a `<git-common-dir>/ci-recibos/logs/`, que
# viven fuera de los worktrees y sobreviven al scratchpad efímero de cada sesión. El rc que se
# devuelve es el del gate, no el del `tee` (memoria: pipear un proceso largo borra la evidencia).
#
# Uso (desde TU worktree; la ruta absoluta sirve antes de que esto llegue a main):
#   UC_SESION=fe1 bash /c/gfw-src/wt-plan2/scripts/gate-local-serial.sh [jobs de gate.sh...]
# Overrides para test: GATE_LOCAL_LOCK · GATE_LOCAL_CMD · GATE_LOCAL_WAIT · GATE_LOCAL_TTL ·
#                      GATE_LOCAL_POLL · GATE_LOCAL_LOGDIR · GATE_LOCAL_NOFIFO=1 (desactiva la cola)
set -uo pipefail

LOCK="${GATE_LOCAL_LOCK:-$(git rev-parse --path-format=absolute --git-common-dir)/gate-local.lock}"
ESPERA="${GATE_LOCAL_WAIT:-3600}"
TTL="${GATE_LOCAL_TTL:-3600}"
POLL="${GATE_LOCAL_POLL:-20}"
CMD="${GATE_LOCAL_CMD:-bash scripts/gate.sh}"

yo="$$ $(basename "$PWD")"
t0=$(date +%s)

# ── Cola FIFO ────────────────────────────────────────────────────────────────
# Carpeta HERMANA del candado: si viviera adentro, el `rm -rf "$LOCK"` del dueño al salir se
# llevaría los tickets de todos los que esperan y volveríamos al sorteo.
COLA="$LOCK.cola"
TICKET=""
if [ "${GATE_LOCAL_NOFIFO:-0}" != "1" ]; then
  mkdir -p "$COLA" 2>/dev/null || true
  # epoch en nanosegundos: 19 dígitos de ancho fijo, así el orden lexicográfico ES el cronológico.
  TICKET="$COLA/$(date +%s%N)-$$"
  echo "$yo" > "$TICKET"
fi

# Borra el ticket propio pase lo que pase; el candado sólo si sigue siendo nuestro (otro pudo
# liberarlo por TTL y tomarlo).
limpiar() {
  [ -n "$TICKET" ] && rm -f "$TICKET"
  [ "$(cat "$LOCK/owner" 2>/dev/null)" = "$yo" ] && rm -rf "$LOCK"
  return 0
}
trap limpiar EXIT

# ¿Soy el primero de la cola? Purga los tickets de procesos que ya no viven antes de decidir.
mi_turno() {
  [ -z "$TICKET" ] && return 0
  local t pid primero=""
  for t in "$COLA"/*; do
    [ -e "$t" ] || continue
    pid="${t##*-}"
    if [ "$t" != "$TICKET" ] && ! kill -0 "$pid" 2>/dev/null; then
      rm -f "$t"; continue                       # aspirante muerto: no bloquea la cola
    fi
    [ -z "$primero" ] && primero="$t"            # el glob ya viene ordenado
  done
  [ "$primero" = "$TICKET" ]
}

while ! { mi_turno && mkdir "$LOCK" 2>/dev/null; }; do
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
    # Las dos razones para no tener turno son distintas y el mensaje tiene que distinguirlas: con
    # el candado LIBRE, «dueño del candado: ''» mandaba a buscar un dueño que no existe, cuando lo
    # que posterga es la cola de tickets. El discriminante es el candado en sí, no `$dueno`: quien
    # acaba de hacer `mkdir` todavía no escribió su owner.
    if [ -d "$LOCK" ]; then
      echo "==> ❌ sigo sin turno tras ${ESPERA}s: lo tiene '${dueno:-(dueño aún sin escribir)}'. No corro encima." >&2
    else
      echo "==> ❌ sigo sin turno tras ${ESPERA}s: el candado está LIBRE, pero hay $(ls "$COLA" 2>/dev/null | wc -l) ticket(s) más viejo(s) delante en la cola. No corro encima." >&2
    fi
    exit 1
  fi
  # Dos esperas distintas, y conviene poder distinguirlas en el log: el candado está tomado, o
  # está libre pero hay tickets más viejos que el mío todavía vivos.
  if [ -n "$dueno" ]; then
    echo "==> otro gate local corre (dueño '$dueno', ${edad}s) — espero ${POLL}s"
  else
    echo "==> candado libre pero no es mi turno ($(ls "$COLA" 2>/dev/null | wc -l) en cola) — espero ${POLL}s"
  fi
  sleep "$POLL"
done

echo "$yo" > "$LOCK/owner"
[ -n "$TICKET" ] && rm -f "$TICKET"   # ya tengo el candado: libero mi lugar en la cola
echo "==> candado local tomado ($yo)"

# ── Log completo, fuera de los worktrees ─────────────────────────────────────
# Nombres con guión bajo A PROPÓSITO: este wrapper le presta su entorno al gate y a todo lo que el
# gate lance. Una variable `LOG` acá le pisa la suya a quien corra abajo — pasó con el gate falso de
# `test-gate-local-serial.sh`, que registra sus tiempos en `$LOG`: quedó escribiendo en el log del
# wrapper, el test leyó su archivo vacío y reportó «se solaparon» cuando la serialización estaba bien.
_LOGDIR="${GATE_LOCAL_LOGDIR:-$(git rev-parse --path-format=absolute --git-common-dir)/ci-recibos/logs}"
mkdir -p "$_LOGDIR" 2>/dev/null || true
# La sesión se infiere con la MISMA lógica que usa el gate (sesion-env.sh), en un subshell para no
# heredar la tríada de puertos: si acá pusiéramos otra heurística, el nombre del log podría decir una
# sesión y el recibo otra.
_SES="${UC_SESION:-$(bash -c 'source "$0" >/dev/null 2>&1; printf "%s" "${UC_SESION:-}"' "$(dirname "${BASH_SOURCE[0]}")/ci/sesion-env.sh")}"
_LOG="$_LOGDIR/gate-${_SES:-sin-sesion}-$(git rev-parse --short HEAD 2>/dev/null || echo nohead)-$(date +%Y%m%dT%H%M%S).log"
echo "==> log: $_LOG"

# `tee` para no perder la salida en pantalla, y PIPESTATUS para devolver el rc del GATE y no el del
# tee: un gate rojo que sale 0 porque el pipe salió 0 es la peor clase de instrumento.
set -o pipefail
$CMD "$@" 2>&1 | tee "$_LOG"
rc=${PIPESTATUS[0]}
echo "==> gate rc=$rc · log completo en $_LOG"
exit "$rc"
