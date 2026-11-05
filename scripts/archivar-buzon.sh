#!/usr/bin/env bash
# archivar-buzon.sh — Janitor determinista del buzón de coordinación.
#
# CAUSA RAÍZ que resuelve: archivar mensajes consumidos dependía de que una sesión
# "se acordara" de moverlos a cerrado/. Bajo presión de sprint eso siempre falla y
# abierto/ se apila (llegó a 136 el 2026-07-23). Peor: las difusiones `-a-todos_` no
# tienen condición de cierre (nadie las acusa) → nunca se auto-archivaban.
#
# ESTE SCRIPT reemplaza la disciplina por una regla determinista, ejecutada por el
# dueño del estado (PLANIFICACIÓN) en cada ciclo de su cadencia de monitor. Idempotente.
#
# CICLO DE VIDA (qué vive en abierto/, qué se archiva):
#   OBLIGACIONES abiertas  → contrato_ · pedido_ · urgente_ · hallazgo_  → NUNCA se auto-archivan.
#                            Se cierran a mano cuando su trabajo/incidente se resuelve
#                            (mv a cerrado/, o un `cierre_`/`listo_` del hilo lo salda).
#   TRÁFICO FRESCO         → cualquier archivo mtime < TTL      → se queda (hilo en curso).
#   HISTORIA               → todo lo demás (dato_/avance_/listo_/respuesta_/
#                            correccion_/cierre_/addendum_/regla_ más viejo que el TTL)
#                            → se archiva a cerrado/<fecha-del-nombre>/.
#
# `hallazgo_` ENTRÓ a las obligaciones el 2026-09-21, y no estaba ahí por olvido: la versión
# anterior lo listaba explícitamente como HISTORIA. Ese día el janitor archivó dos
# `hallazgo_auditoria-a-planificacion_` a los 90 min —uno de 887 líneas— y planificación se enteró
# sólo porque auditoría se lo mencionó por otro canal. El hallazgo es el PRODUCTO de la sesión más
# cara de la flota (Fable): si nadie lo acusó, no es historia, es una obligación abierta, igual que
# un `pedido_` sin respuesta. Un `dato_` que se pierde cuesta un mensaje; un hallazgo que se pierde
# cuesta la auditoría entera y nadie se entera, porque el archivado no falla — archiva.
#
# El costo de la decisión es que `abierto/` acumula hallazgos hasta que se cierran a mano. Eso es
# lo buscado: un hallazgo sin atender TIENE que doler a la vista.
#
# coordinacion/ es gitignored → mover NO toca git, es `mv` puro. Cero riesgo de race.
#
# ⚠️ EL CAMPO `CIERRE:` NO SALTEA EL TTL, y eso se lee como que no funciona. Medido el 2026-11-05:
# declaré el cierre de 11 broadcasts de octubre y el dry-run siguiente dijo «archivaría 2», porque
# escribir el campo RENUEVA el mtime y los 11 pasaron a contar como tráfico FRESCO. Por un momento
# lo leí como «el mecanismo no dispara»: el control que lo desmiente es `TTL_MIN=0 --dry-run`, que
# listó los 11 y ninguna de las 25 obligaciones sin cierre. Es deliberado — un cierre escrito hace
# un minuto no debe hacer desaparecer el archivo antes de que las otras sesiones lo lean. El efecto
# llega en el ciclo siguiente al TTL, no en el mismo.
#
# Uso:
#   scripts/archivar-buzon.sh              # archiva (default TTL 90 min)
#   scripts/archivar-buzon.sh --dry-run    # muestra qué haría, sin mover
#   TTL_MIN=120 scripts/archivar-buzon.sh  # override del TTL en minutos
#   BUZON_DIR=/ruta/a/buzon-test scripts/archivar-buzon.sh   # aislamiento para test, sin tocar el real
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# El patrón del campo `CIERRE:` y declara_su_cierre() viven en la lib: FUENTE ÚNICA. Antes estaban
# inline acá, y el 2026-11-05 eso costó el defecto #2 que la lib documenta: el janitor conocía el
# campo y el gate de vigilancia no, así que seis contratos cerrados seguían acusados como SIN DUEÑO.
# shellcheck source=lib/buzon-roles.sh
. "$REPO_ROOT/scripts/lib/buzon-roles.sh"
# `coordinacion/` NO está versionada y existe UNA sola vez: en el checkout principal. Derivarla del
# root de ESTE script hacía que el janitor no viera nada desde ningún worktree —26 vivos, el caso
# NORMAL— y como abajo salía con exit 0, el vigía lo invocaba y creía haber ordenado el buzón.
# Mismo defecto y mismo fix que cola-check.sh / vigilancia-check.sh (PR #676): el tercer gemelo.
if [ -n "${BUZON_DIR:-}" ]; then
  BUZON="$BUZON_DIR"                        # override de test (fixture): gana siempre
elif [ -d "$REPO_ROOT/coordinacion" ]; then
  BUZON="$REPO_ROOT/coordinacion"           # checkout principal: el camino de siempre
else
  _gitcommon="$(git -C "$REPO_ROOT" rev-parse --path-format=absolute --git-common-dir 2>/dev/null || true)"
  if [ -n "$_gitcommon" ]; then
    BUZON="$(dirname "$_gitcommon")/coordinacion"
  else
    BUZON="$REPO_ROOT/coordinacion"         # sin git: que falle nombrando el path de siempre
  fi
fi
ABIERTO="$BUZON/abierto"
ENCURSO="$BUZON/en-curso"
CERRADO="$BUZON/cerrado"
TTL_MIN="${TTL_MIN:-90}"
DRY_RUN=0
[ "${1:-}" = "--dry-run" ] && DRY_RUN=1

# Obligaciones que jamás se auto-archivan (se cierran a mano al resolverse).
OBLIGACIONES='^[0-9-]+_(contrato|pedido|urgente|hallazgo)_'

if [ ! -d "$ABIERTO" ]; then
  # Fail-CLOSED a propósito: el exit 0 de antes reportaba «nada que archivar» sobre una carpeta que
  # ni siquiera había mirado, y el buzón se apilaba sin que nadie lo notara (11 vencidos medidos el
  # 2026-09-22). «No medí nada» NO es «está en orden».
  echo "❌ JANITOR: no puedo ver mi sujeto — no existe $ABIERTO" >&2
  echo "    'coordinacion/' no está versionada y existe UNA sola vez (el checkout principal)." >&2
  echo "    Apuntala con: BUZON_DIR=<ruta>/coordinacion $0" >&2
  exit 2
fi

moved=0; kept_obl=0; kept_fresh=0
shopt -s nullglob
for f in "$ABIERTO"/*.md; do
  b="$(basename "$f")"

  # 1) Obligación abierta → se queda (cierre manual)… SALVO que el archivo declare su PROPIO cierre.
  #
  # El campo `CIERRE:` lo propuso el hallazgo del 2026-10-16 («19 broadcasts nunca se cierran»), que
  # midió por qué ningún otro criterio sirve y por eso NO se implementó entonces sin su test hostil:
  #   · ANTIGÜEDAD mide la edad del archivo, no el estado de la norma: una norma vigente envejece
  #     igual que una cumplida. Por eso las obligaciones están exentas y eso está bien.
  #   · LA PALABRA `cerrado`/`vencido` EN EL CUERPO caza PROSA. Marcó 5 archivos, y uno era la frase
  #     «un hallazgo nuevo NO reabre un punto cerrado».
  #   · EL BANNER `⛔` tiene DOS referentes: en «…_REFUTADO-mi-propio-hallazgo…» dice que el archivo
  #     refuta a OTRO, o sea que es el artefacto VIGENTE. Archivarlo mata la corrección y deja
  #     circulando lo refutado.
  #
  # Por eso el criterio es un campo DEDICADO y AUTO-REFERENCIAL: sólo se escribe cuando el archivo
  # MISMO queda cerrado, nunca para marcar una prohibición ni el estado de otro. El janitor no
  # juzga: el criterio es la presencia del campo, y la decisión queda en quien escribe el archivo,
  # que es el único que sabe si su norma sigue viva.
  #
  #   CIERRE: VENCIDO|REFUTADO|CUMPLIDO — <motivo en una línea>
  #
  # Tres exigencias del patrón, cada una contra un falso positivo MEDIDO:
  #   · `^` ancla a inicio de línea  → el banner `⛔ REFUTADO` y cualquier cita indentada (`> ` o
  #     dentro de un bloque de código del propio protocolo) NO matchean.
  #   · uno de los TRES valores, exacto → no caza prosa que use la palabra «cierre».
  #   · separador + motivo NO VACÍO    → la PLANTILLA del protocolo
  #     (`CIERRE: VENCIDO|REFUTADO|CUMPLIDO — <motivo…>`) NO matchea, porque tras `VENCIDO` viene un
  #     `|` y no el guión. Ese es el caso hostil que el documento que PROPONE el campo contiene
  #     literalmente, y el que un patrón laxo archivaría primero.
  #
  # ⚠️ EL SEPARADOR ACEPTA `—`, `–`, `-` y `--` DESDE EL 2026-11-05, y la razón es un falso verde
  # MEDIDO en el PRIMER uso en serio del campo. El patrón exigía el em dash `—`; la línea que
  # planificación escribió ese día en el hallazgo del ratchet salió con guión ASCII (el canal de
  # escritura de Windows/PowerShell no tipea el em dash con fiabilidad), así que el cierre quedó
  # **inerte**: escrito, visible, citado como hecho — y el janitor nunca lo vio. Un separador que
  # el entorno no puede producir de forma confiable no es un guard, es un éxito falso: el autor
  # declara el cierre, lee su propia línea en el archivo y nadie mide que el lector la reconozca.
  # Lo que PROTEGE del caso hostil no es el glifo, es el `|` que sigue a `VENCIDO` en la plantilla,
  # y eso vale igual para los cuatro separadores.
  # El test hostil de los cuatro casos vive en scripts/tests/test-archivar-buzon-campo-cierre.sh.
  # El patrón y la función vienen de lib/buzon-roles.sh (sourceada arriba): UNA definición para los
  # dos consumidores — este janitor, que archiva, y vigilancia-check.sh, que deja de acusar.
  if echo "$b" | grep -qE "$OBLIGACIONES"; then
    if declara_su_cierre "$f"; then
      : # declara su propio cierre → cae a los pasos 2 y 3 como cualquier tráfico
    else
      kept_obl=$((kept_obl+1)); continue
    fi
  fi

  # 2) Tráfico fresco (dentro del TTL) → se queda (hilo en curso).
  if [ -n "$(find "$f" -mmin "-$TTL_MIN" 2>/dev/null)" ]; then
    kept_fresh=$((kept_fresh+1)); continue
  fi

  # 3) Historia → archivar a cerrado/<fecha-del-nombre>/ (fallback: hoy por mtime).
  d="$(echo "$b" | grep -oE '^[0-9]{4}-[0-9]{2}-[0-9]{2}' || true)"
  [ -n "$d" ] || d="$(date -r "$f" '+%Y-%m-%d' 2>/dev/null || date '+%Y-%m-%d')"
  if [ "$DRY_RUN" = "1" ]; then
    echo "ARCHIVARÍA → cerrado/$d/  $b"
  else
    mkdir -p "$CERRADO/$d"
    mv "$f" "$CERRADO/$d/"
  fi
  moved=$((moved+1))
done

# ── en-curso/: sólo ARTEFACTOS (todo lo que no sea .md) más viejo que el TTL. ──────────────────
# Los .md de en-curso/ son trabajos VIVOS (protocolo: "quien termina lo mueve") — archivarlos por
# antigüedad haría desaparecer frentes en curso, el error opuesto al que este script arregla. La
# evidencia adjunta (capturas de un hito ya cerrado) sí se acumula sin dueño que la mueva — medido
# 2026-08-06: 10 archivos, 0 trabajos, el más viejo con 10h ahí.
moved_artefactos=0
if [ -d "$ENCURSO" ]; then
  for f in "$ENCURSO"/*; do
    [ -f "$f" ] || continue
    b="$(basename "$f")"
    case "$b" in *.md) continue ;; esac   # trabajo vivo, nunca por antigüedad
    [ -n "$(find "$f" -mmin "-$TTL_MIN" 2>/dev/null)" ] && continue   # fresco, se queda

    d="$(echo "$b" | grep -oE '^[0-9]{4}-[0-9]{2}-[0-9]{2}' || true)"
    [ -n "$d" ] || d="$(date -r "$f" '+%Y-%m-%d' 2>/dev/null || date '+%Y-%m-%d')"
    if [ "$DRY_RUN" = "1" ]; then
      echo "ARCHIVARÍA (en-curso, artefacto) → cerrado/$d/  $b"
    else
      mkdir -p "$CERRADO/$d"
      mv "$f" "$CERRADO/$d/"
    fi
    moved_artefactos=$((moved_artefactos+1))
  done
fi

abiertos_md=("$ABIERTO"/*.md)
abiertos_ahora=${#abiertos_md[@]}
if [ "$DRY_RUN" = "1" ]; then
  echo "[dry-run] archivaría $moved · obligaciones $kept_obl · frescos $kept_fresh · TTL ${TTL_MIN}min · en-curso/ artefactos $moved_artefactos"
else
  echo "archivados $moved · abiertos ahora $abiertos_ahora (obligaciones $kept_obl + frescos $kept_fresh) · TTL ${TTL_MIN}min · en-curso/ artefactos archivados $moved_artefactos"
fi
