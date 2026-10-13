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
# delega. Toda la lógica que sí evoluciona vive en el instrumento, que se lee del pin.
#
# 🔴 CORRECCION 2026-10-13. Acá decía que «una copia vieja de ESTE archivo hace lo mismo que la
# nueva», y era FALSO: la whitelist —que es POLITICA, y la política evoluciona— vivía en este
# archivo. Medido: las copias de /c/gfw-src/_*-vigia rechazaban `mi-buzon.sh` con rc 2 aunque el
# instrumento existía en el pin; 5 de 6 pines estaban atrasados. Lo levantó FRONTEND2, no este
# comentario — que es el problema: un comentario que DECLARA una propiedad apaga la búsqueda del
# próximo que la mire. La afirmación ahora es verdadera por CONSTRUCCION, no por promesa: antes de
# aplicar la whitelist, el lanzador se RE-EJECUTA desde el `vigia.sh` del pin si difiere del suyo
# (converge en un salto; `UC_VIGIA_REEXEC` es el backstop). Lo prueba el caso 9 del test, con su
# control negativo y su mutante.
# Corolario que SIGUE valiendo: si hay que agregarle una decisión, va en el instrumento, no acá.
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

# ── el nombre pedido. La whitelist que lo valida NO esta aca: vive mas abajo, DESPUES de
# refrescar el pin, porque es POLITICA y la politica evoluciona.
# (whitelist historica, movida el 2026-10-13 — ver el bloque de abajo.) Se aisla por NOMBRE PERMITIDO, no por dirname: un `..` en el argumento convierte
# cualquier dirname en el directorio que el atacante quiera.
#    → memoria: aislar-un-binario-del-path-se-hace-por-whitelist-no-por-dirname
INSTRUMENTO="${1:-}"; shift || true
# mi-buzon.sh entra el 2026-10-13: el paso 1 del vigia lo invoca con path RELATIVO y el archivo
# NO existe en el checkout compartido, asi que ese paso caia al filtro `find` a mano, que medido
# el 2026-10-12 dejaba 7 de 12 mensajes invisibles. Es un LECTOR del buzon (read-only) y comparte
# `me_interpela()` con el gate: leerlo del pin es lo que lo hace COINCIDIR con el gate, no divergir.

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
      # MEDIDO el 2026-10-13: `worktree add` se niega sobre un directorio que YA EXISTE, y
      # `--force` NO ayuda (mismo `fatal: ... already exists`). Lo UNICO que recupera es sacar
      # la carcasa del camino primero. Sin esto la rama entera era INALCANZABLE: reportaba
      # DEGRADADO para siempre y el pin nunca volvia. Y el caso 7 del test pasaba IGUAL,
      # porque afirmaba el BANNER y no la RECUPERACION -- y el banner es justo lo que el
      # fallo produce. Guarda: la carcasa solo se toca si NO tiene `.git`; con `.git` presente
      # y toplevel distinto no se borra nada, se degrada. `UC_VIGIA_PIN` viene del entorno y
      # un borrado sobre un path de entorno no se hace a ciegas.
      if [ ! -e "$PIN/.git" ]; then
        rm -rf "$PIN" 2>/dev/null || mv "$PIN" "$PIN.roto-$$" 2>/dev/null || true
      fi
      git -C "$REPO_ROOT" worktree prune 2>/dev/null || true
      git -C "$REPO_ROOT" worktree add --detach "$PIN" "$REF" >/dev/null 2>&1 \
        || degradado="el pin existe como carpeta pero NO es un worktree (¿poda parcial?) y no pude recrearlo"
    fi
  fi
  if [ -d "$PIN" ] && [ -z "$degradado" ]; then
    _traer "$PIN" \
      || degradado="fetch de $_remoto/$_rama falló (¿sin red?) — el pin puede estar viejo"
    git -C "$PIN" checkout -q --detach "$REF" 2>/dev/null \
      || degradado="${degradado:-no pude fijar el pin a $REF}"
  fi
fi

# ── RE-EXEC desde el pin. El docstring de arriba afirmaba que "una copia vieja de ESTE archivo
# hace lo mismo que la nueva", y era FALSO: la whitelist —que es POLITICA— vivia en el lanzador,
# asi que una copia vieja la aplicaba vieja. Medido el 2026-10-13: las copias de
# /c/gfw-src/_*-vigia rechazan `mi-buzon.sh` con rc 2 (no esta en SU whitelist) mientras el
# instrumento SI existe en el pin; 5 de 6 pines estaban atrasados. Lo levanto FRONTEND2.
# El arreglo no es agrandar la whitelist —eso fue el parche del 2026-10-13 por la manana— sino que
# el lanzador delegue en el del pin ANTES de decidir nada. Converge en UN salto: el hijo deriva
# el MISMO pin (su REPO_ROOT pasa a ser el pin y la derivacion da el mismo path), asi que su
# `cmp` sale identico y no vuelve a saltar. UC_VIGIA_REEXEC es el backstop duro del lazo.
if [ "${UC_VIGIA_REEXEC:-0}" != "1" ] && [ -n "$PIN" ] && [ -f "$PIN/scripts/vigia.sh" ]    && ! cmp -s "$PIN/scripts/vigia.sh" "${BASH_SOURCE[0]}"; then
  export UC_VIGIA_REEXEC=1
  exec bash "$PIN/scripts/vigia.sh" "$INSTRUMENTO" "$@"
fi

# -- QUE PUEDE PASAR POR ACA, y el criterio (medido el 2026-10-13, no deducido)
#
# El lanzador hace `exec bash "$EJECUTA" "$@"` SIN `cd`: el ARCHIVO sale del pin (al dia) y el
# CWD se hereda del llamador. Eso parte los instrumentos en dos clases y solo una puede entrar:
#
#   OK  los que NO miran el arbol de trabajo. `ci-verde.sh` es el caso puro: 12 llamadas a `gh`,
#       CERO derivaciones de raiz (ni `BASH_SOURCE` ni `show-toplevel`) y CERO tests. Pregunta a
#       GitHub por numero de PR, asi que de donde salga el archivo no cambia lo que mide.
#       Entro el 2026-10-13 y el motivo es que importa MAS que los otros: el compartido tenia
#       71 lineas contra las 422 de `main` (-351), o sea las sesiones autorizaban merges con una
#       version anterior a TODOS sus fixes de fail-open (`exit 6` de PR terminal, `exit 3` de
#       «todavia no», el rollup ilegible).
#
#   NO  los que SI miran el arbol NO PUEDEN ENTRAR, y `gate.sh` es el ejemplo a no imitar:
#       deriva ROOT de `dirname "${BASH_SOURCE[0]}"/..` (`gate.sh:29`) y corre los tests de ese
#       ROOT. Ejecutado desde aca, `BASH_SOURCE` es EL PIN, asi que correria la suite sobre
#       **main** y no sobre la rama que estas por mergear: VERDE sobre codigo que no es el tuyo.
#       Eso es peor que correrlo viejo -- un gate que mide el arbol equivocado y sale verde no
#       se nota nunca.
#       => NO lo agregues por simetria. Si alguna vez tiene que entrar, primero hay que hacer
#          que derive su raiz del CWD (`git rev-parse --show-toplevel`), y ESO es el cambio,
#          no esta lista.
#
# Criterio para el proximo: cambia lo que el instrumento MIDE segun de donde salga el archivo?
# Si cambia, no entra. Grep de `BASH_SOURCE|show-toplevel|pytest|npm |jest|vitest`.
case "$INSTRUMENTO" in
  vigilancia-check.sh|cola-check.sh|deuda-check.sh|no-ocio-check.sh|foco-check.sh|\
  escaladores-buzon.sh|archivar-buzon.sh|lint-contratos-referencias.sh|podar-worktrees.sh|\
  mi-buzon.sh|ci-verde.sh) ;;
  *)
    printf '%s\n' "vigia.sh: instrumento no permitido: '${INSTRUMENTO:-<vacío>}'" >&2
    printf '%s\n' "  permitidos: vigilancia-check.sh cola-check.sh deuda-check.sh no-ocio-check.sh" >&2
    printf '%s\n' "              foco-check.sh escaladores-buzon.sh archivar-buzon.sh" >&2
    printf '%s\n' "              lint-contratos-referencias.sh podar-worktrees.sh mi-buzon.sh" >&2
    printf '%s
' "              ci-verde.sh" >&2
    exit 2 ;;
esac

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
