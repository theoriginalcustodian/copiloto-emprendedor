#!/usr/bin/env bash
# vigia.sh — corre un instrumento de coordinación DESDE LA VERSIÓN DE `origin/main`, nunca desde
# el working tree del que lo invocan.
#
# POR QUÉ EXISTE (medido el 2026-10-08, no es precaución teórica). Los cinco comandos de monitoreo
# decían `bash scripts/vigilancia-check.sh --quiet` con path RELATIVO, así que resolvían contra el
# cwd del cron: el checkout COMPARTIDO, cuyo HEAD está viejo. La misma orden, a minutos de
# distancia, dio dos realidades:
#
#   | | desde `origin/main` | desde el compartido (4a9f4f7c) |
#   |---|---|---|
#   | COLA        | ⏳ 4 hitos bloqueados por disparador EXTERNO | ⚠️ 15 ids «estado no reconocido» (FALSO) |
#   | escaladores | 2897 · 2045 · 2036 · 2067 min                | `999999min` en 4 de 6                    |
#
# Las dos salían rc=1 y ninguna avisaba de la diferencia. BACKEND levantó las filas falsas como
# «la lista de enums quedó vieja» y después lo retiró: el dato estaba bien, el ARCHIVO EJECUTADO
# estaba viejo.  → memoria: el-checkout-compartido-sirve-comandos-viejos
#
# LA PROPIEDAD DE DISEÑO QUE LO HACE FUNCIONAR, y es la única razón de que este archivo sea tan
# chico: el arranque no puede arreglarse con código que viva en el árbol viejo —una copia vieja del
# guard no se ejecuta nunca—. Así que este lanzador NO decide nada: ubica el pin de `main` y
# delega. Su semántica no cambia, así que **una copia vieja de ESTE archivo hace lo mismo que la
# nueva**. Toda la lógica que sí evoluciona vive en el instrumento, que se lee del pin.
# Corolario: si alguna vez hay que agregarle una decisión, va en el instrumento, no acá.
#
# USO
#   scripts/vigia.sh <instrumento.sh|.py> [args...]
#   scripts/vigia.sh vigilancia-check.sh --quiet
#   scripts/vigia.sh archivar-buzon.sh
#
# CONTRATO
#   rc        = el del instrumento, tal cual (es lo que leen los crones: 0 = sin novedades).
#   rc 2      = el nombre pedido no está en la whitelist, o no existe. No se ejecutó NADA.
#   rc 3      = no hay pin ni working tree usable. No se ejecutó nada.
#   DEGRADADO = si el pin no se pudo refrescar, corre igual y escribe un banner en stderr con la
#               antigüedad. NUNCA cae en silencio al working tree: caer callado es el defecto.
#
# ENV
#   UC_VIGIA_PIN   ruta del pin (gana siempre; es también el gancho de test, sin red ni git).
#   UC_VIGIA_REF   ref a fijar (default `origin/main`).
#   UC_VIGIA_NO_REFRESH=1  no crea/refresca/valida el pin (gancho de test).
#
# El pin es un worktree detached de instrumentos: no contiene trabajo de nadie, así que fijarlo con
# `checkout --detach` NO roza CANON 9, que protege el checkout compartido.
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REF="${UC_VIGIA_REF:-origin/main}"

# ── whitelist. Se aisla por NOMBRE PERMITIDO, no por dirname: un `..` en el argumento convierte
# cualquier dirname en el directorio que el atacante quiera.
#    → memoria: aislar-un-binario-del-path-se-hace-por-whitelist-no-por-dirname
INSTRUMENTO="${1:-}"; shift || true
case "$INSTRUMENTO" in
  vigilancia-check.sh|cola-check.sh|deuda-check.sh|no-ocio-check.sh|foco-check.sh|\
  escaladores-buzon.sh|archivar-buzon.sh|lint-contratos-referencias.sh|podar-worktrees.sh) ;;
  *)
    printf '%s\n' "vigia.sh: instrumento no permitido: '${INSTRUMENTO:-<vacío>}'" >&2
    printf '%s\n' "  permitidos: vigilancia-check.sh cola-check.sh deuda-check.sh no-ocio-check.sh" >&2
    printf '%s\n' "              foco-check.sh escaladores-buzon.sh archivar-buzon.sh" >&2
    printf '%s\n' "              lint-contratos-referencias.sh podar-worktrees.sh" >&2
    exit 2 ;;
esac

# ── dónde vive el pin. Derivado, no hardcodeado: hermano del checkout principal, uno por checkout
# que invoca, para que cinco crones no se peleen el mismo índice.
if [ -n "${UC_VIGIA_PIN:-}" ]; then
  PIN="$UC_VIGIA_PIN"
else
  _common="$(git -C "$REPO_ROOT" rev-parse --path-format=absolute --git-common-dir 2>/dev/null || true)"
  if [ -n "$_common" ]; then
    _principal="$(dirname "$_common")"
    PIN="$(dirname "$_principal")/_vigia-pins/$(basename "$REPO_ROOT")"
  else
    PIN=""
  fi
fi

degradado=""
# UC_VIGIA_NO_REFRESH=1 saltea crear/refrescar/validar el pin. Es el gancho de test y tiene UN
# solo trabajo, separado de `UC_VIGIA_PIN`: con un único flag mezclado, el fixture emitía el
# banner DEGRADADO SIEMPRE y el caso que lo verifica pasaba aunque su condición no se diera —
# un test que no discrimina. Dos flags, dos preguntas: DÓNDE está el pin, y si se TOCA.
REFRESCAR=1; [ "${UC_VIGIA_NO_REFRESH:-0}" = "1" ] && REFRESCAR=0

# De dónde se trae la ref, DERIVADO de $REF y no hardcodeado. El bug que esto arregla lo cazó
# el control positivo del caso 7: el fetch decía `origin main` fijo mientras la ref era
# parametrizable, así que con una ref LOCAL (o un repo sin remoto) el fetch fallaba y el
# lanzador se declaraba DEGRADADO **sin motivo** — un falso rojo que enseña a ignorar el banner,
# que es como un guard se desarma solo.
_remoto=""; _rama=""
case "$REF" in
  */*) _r="${REF%%/*}"
       if git -C "$REPO_ROOT" remote 2>/dev/null | grep -qx "$_r"; then _remoto="$_r"; _rama="${REF#*/}"; fi ;;
esac
# ref local (sin `/`, o cuyo prefijo no es un remoto configurado) ⇒ no hay nada que traer, y no
# traer nada NO es una degradación.
_traer() {
  [ -n "$_remoto" ] || return 0
  git -C "${1:-$REPO_ROOT}" fetch -q "$_remoto" "$_rama" 2>/dev/null
}

# ── crear / refrescar el pin. Cualquier fallo es DEGRADADO explícito, nunca un fallback mudo.
if [ -n "$PIN" ] && [ "$REFRESCAR" = "1" ]; then
  if [ ! -d "$PIN" ]; then
    mkdir -p "$(dirname "$PIN")" 2>/dev/null || true
    _traer "$REPO_ROOT" || true
    git -C "$REPO_ROOT" worktree add --detach "$PIN" "$REF" >/dev/null 2>&1 \
      || degradado="no pude crear el pin en $PIN"
  fi
  # El pin puede existir como DIRECTORIO y no ser un worktree: si el podador le hizo un
  # `worktree remove` parcial (falla en un junction de `node_modules` y desregistra igual),
  # queda la carpeta sin registro. Ahí `git -C` **no falla**: camina hacia arriba y contesta
  # por el checkout principal — el instrumento respondería sobre OTRO sujeto. Se detecta
  # comparando el toplevel contra el propio directorio, igual que la GUARDA 0 del podador.
  if [ -d "$PIN" ]; then
    _top="$(git -C "$PIN" rev-parse --show-toplevel 2>/dev/null | tr -d '
')"
    _topr="$(cd "$_top" 2>/dev/null && pwd -P || true)"
    _pinr="$(cd "$PIN" 2>/dev/null && pwd -P || true)"
    if [ -z "$_topr" ] || [ "$_topr" != "$_pinr" ]; then
      git -C "$REPO_ROOT" worktree prune 2>/dev/null || true
      git -C "$REPO_ROOT" worktree add --detach "$PIN" "$REF" >/dev/null 2>&1 \n        || degradado="el pin existe como carpeta pero NO es un worktree (¿poda parcial?) y no pude recrearlo"
    fi
  fi
  if [ -d "$PIN" ] && [ -z "$degradado" ]; then
    _traer "$PIN" \
      || degradado="fetch de $_remoto/$_rama falló (¿sin red?) — el pin puede estar viejo"
    git -C "$PIN" checkout -q --detach "$REF" 2>/dev/null \
      || degradado="${degradado:-no pude fijar el pin a $REF}"
  fi
fi

# ── elegir qué se ejecuta, y decirlo cuando no es lo pedido
EJECUTA=""
if [ -n "$PIN" ] && [ -f "$PIN/scripts/$INSTRUMENTO" ]; then
  EJECUTA="$PIN/scripts/$INSTRUMENTO"
elif [ -f "$REPO_ROOT/scripts/$INSTRUMENTO" ]; then
  EJECUTA="$REPO_ROOT/scripts/$INSTRUMENTO"
  degradado="${degradado:+$degradado · }SIN PIN: corriendo la copia del working tree"
else
  printf '%s\n' "vigia.sh: no encontré '$INSTRUMENTO' ni en el pin ni en $REPO_ROOT/scripts/" >&2
  exit 3
fi

if [ -n "$degradado" ]; then
  _edad="desconocida"
  if [ -n "$PIN" ] && [ -d "$PIN" ]; then
    _ts="$(git -C "$PIN" log -1 --format=%ct HEAD 2>/dev/null || true)"
    [ -n "$_ts" ] && _edad="$(( ( $(date +%s) - _ts ) / 3600 ))h"
  fi
  {
    printf '%s\n' "⚠️  vigia.sh DEGRADADO: $degradado"
    printf '%s\n' "    ejecutando: $EJECUTA  (antigüedad del commit: $_edad)"
    printf '%s\n' "    El resultado de abajo puede ser de una versión vieja del instrumento."
    printf '%s\n' "    Esto NO es un pase: el bloque '0.bis VERSIÓN DEL INSTRUMENTO' es el que decide."
  } >&2
fi

exec bash "$EJECUTA" "$@"
