#!/usr/bin/env bash
# escaladores-buzon.sh — Gancho 3: escaladores de edad en el janitor del buzón.
#
# CAUSA RAÍZ que resuelve (docs/aprendizajes/pendientes/2026-07-24_escaladores-de-edad-en-el-janitor.md):
# el protocolo detecta silencio de una SESIÓN, no abandono de una TAREA. Un contrato_ con su
# disparador cumplido que nadie movió a en-curso/ no dispara ninguna alarma: no hay excepción, no
# hay error, hay un archivo con mtime viejo. Falla en silencio, que es la clase más cara.
#
# Extiende el patrón YA establecido en scripts/archivar-buzon.sh (janitor determinista: mtime +
# ubicación = estado) y scripts/cola-check.sh (exit distinto según haya o no algo que atender). No
# reinventa nada: reusa la misma clasificación de "obligación abierta" (contrato_/pedido_/urgente_)
# que archivar-buzon.sh ya usa para decidir qué NUNCA se auto-archiva.
#
# TRES REGLAS (deterministas, script — no modelo):
#   1) contrato_ en abierto/ con disparador CUMPLIDO y edad >= UMBRAL_CONTRATO_MIN sin pasar a
#      en-curso/ → genera un urgente_ en abierto/ nombrando a quién le toca (sale del propio nombre
#      del contrato: "...-a-<para>_...").
#   2) pedido_ en abierto/ con edad >= UMBRAL_PEDIDO_MIN → alarma nombrando a la sesión deudora.
#      Por protocolo (COORDINACION.md §4.1: "respuesta_ ... mueve el pedido_ con ella a cerrado/"),
#      un pedido_ que SIGUE en abierto/ es por definición un pedido SIN respuesta_ — no hace falta
#      buscar la respuesta por separado, el propio protocolo ya lo garantiza.
#   3) en-curso/ sin actividad (mtime) dentro del umbral declarado por el propio archivo (línea
#      "UMBRAL_SILENCIO: <min>") o el default UMBRAL_SILENCIO_DEFAULT_MIN → alarma al dueño del
#      frente (sale del nombre del archivo).
#
# CONVENCIÓN "disparador cumplido" — decisión táctica de esta implementación, documentada porque
# el buzón real HOY no tiene un campo estructurado para esto (verificado: grep de "disparador" en
# coordinacion/ sólo aparece en prosa, nunca como campo). Un contrato_ se considera con disparador
# CUMPLIDO salvo que declare explícitamente una línea "DISPARADOR: pendiente" (case-insensitive) en
# el cuerpo. Así los contratos reales de hoy (sin el campo) siguen escalando cuando corresponde —
# que es el caso medido (el contrato de 13K de 47h) — y un contrato que SÍ declara que espera algo
# no genera ruido. Es el control negativo exigido por el DoD.
#
# AISLAMIENTO: acepta el buzón por parámetro/env var para poder probarse sin tocar el real —
# precondición explícita del DoD ("NO toques el buzón real. Armá un buzón de prueba...").
#
# Uso:
#   scripts/escaladores-buzon.sh                       # buzón real: <repo>/coordinacion
#   scripts/escaladores-buzon.sh /ruta/a/buzon-test     # buzón de prueba, por argumento
#   BUZON_DIR=/ruta/a/buzon-test scripts/escaladores-buzon.sh   # o por env var
#   scripts/escaladores-buzon.sh --dry-run [BUZON_DIR]  # reporta sin escribir urgente_
#
# Exit code: 0 = nada que escalar · 1 = generó o encontró >=1 alarma (el reporte va a stdout).
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DRY_RUN=0
if [ "${1:-}" = "--dry-run" ]; then DRY_RUN=1; shift; fi
BUZON="${1:-${BUZON_DIR:-$REPO_ROOT/coordinacion}}"
ABIERTO="$BUZON/abierto"
ENCURSO="$BUZON/en-curso"

UMBRAL_CONTRATO_MIN="${UMBRAL_CONTRATO_MIN:-120}"          # 2h, del pendiente
UMBRAL_PEDIDO_MIN="${UMBRAL_PEDIDO_MIN:-30}"                # 30min, del pendiente
UMBRAL_SILENCIO_DEFAULT_MIN="${UMBRAL_SILENCIO_DEFAULT_MIN:-90}"   # default ya usado por Cron 2

[ -d "$ABIERTO" ] || { echo "No existe $ABIERTO"; exit 0; }
now="$(date +%s)"
alarma=0

edad_min() {
  local f="$1" m
  m="$(stat -c %Y "$f" 2>/dev/null || echo "$now")"
  echo $(( (now - m) / 60 ))
}

# Fix (rescate de contrato_...rescatar-los-2-commits-de-monitoreo, ampliación 3): edad_min mide
# ÚLTIMA MODIFICACIÓN, no "hace cuánto está sin respuesta". Para pedido_/urgente_ eso hace que
# ampliar el archivo con más evidencia (agregar una ADENDA) BORRE la alarma en vez de sostenerla
# — exactamente al revés de lo que se quiere. Opción 4 del contrato (sidecar): la primera vez que
# ESTE escalador ve el archivo, graba su timestamp; edad se mide desde ahí, no desde el mtime.
# Combinado con la fecha del propio nombre como piso barato para el caso "de un día anterior" (no
# hace falta sidecar para saber que algo con fecha de ayer ya superó cualquier umbral en minutos).
EDAD_STATE_DIR="$BUZON/.escalador-estado"
mkdir -p "$EDAD_STATE_DIR" 2>/dev/null || true

edad_desde_alta_min() {
  local f="$1" b fecha_nombre primera_vez_file primera_vez
  b="$(basename "$f")"
  fecha_nombre="$(echo "$b" | grep -oE '^[0-9]{4}-[0-9]{2}-[0-9]{2}')"
  if [ -n "$fecha_nombre" ] && [ "$fecha_nombre" != "$(date +%Y-%m-%d)" ]; then
    echo 999999
    return
  fi
  primera_vez_file="$EDAD_STATE_DIR/${b}.first-seen"
  [ -e "$primera_vez_file" ] || date +%s > "$primera_vez_file" 2>/dev/null
  primera_vez="$(cat "$primera_vez_file" 2>/dev/null || echo "$now")"
  echo $(( (now - primera_vez) / 60 ))
}

# extrae el destinatario del nombre: fecha_tipo_de-a-para_slug.md -> "para"
destinatario_de_nombre() {
  local b="$1"
  echo "$b" | sed -nE 's/^[0-9-]+_[a-z]+_[a-z]+-a-([a-z]+)_.*/\1/p'
}

# ── Regla 1: contrato_ con disparador cumplido, viejo, sin tomar ───────────────
shopt -s nullglob
for f in "$ABIERTO"/*_contrato_*.md; do
  b="$(basename "$f")"
  edad="$(edad_min "$f")"
  [ "$edad" -ge "$UMBRAL_CONTRATO_MIN" ] || continue
  if grep -qiE '^DISPARADOR:[[:space:]]*pendiente' "$f" 2>/dev/null; then
    continue   # disparador explícitamente NO cumplido -> no escala (control negativo del DoD)
  fi
  para="$(destinatario_de_nombre "$b")"
  alarma=1
  echo "CONTRATO SIN TOMAR (${edad}min >= ${UMBRAL_CONTRATO_MIN}): $b -> le toca a ${para:-todos}"
  fecha_hoy="$(date +%Y-%m-%d)"
  slug_base="${b%.md}"
  urgente="$ABIERTO/${fecha_hoy}_urgente_vigilancia-a-${para:-todos}_contrato-sin-tomar-${slug_base}.md"
  if [ "$DRY_RUN" = "0" ] && [ ! -e "$urgente" ]; then
    {
      echo "# URGENTE -> ${para:-TODOS} - contrato sin tomar"
      echo
      echo "Generado automaticamente por scripts/escaladores-buzon.sh (Gancho 3, escalador de edad)."
      echo
      echo "El contrato '$b' lleva ${edad} min en abierto/ con el disparador cumplido y nadie lo"
      echo "movio a en-curso/. Tomalo, o si en realidad espera algo, declaralo con una linea"
      echo "'DISPARADOR: pendiente' en el propio contrato para que deje de escalar."
    } > "$urgente"
    echo "   -> generado $urgente"
  fi
done

# ── Regla 2: pedido_ viejo en abierto/ (= sin respuesta_, por protocolo) ───────
for f in "$ABIERTO"/*_pedido_*.md; do
  b="$(basename "$f")"
  edad="$(edad_desde_alta_min "$f")"
  [ "$edad" -ge "$UMBRAL_PEDIDO_MIN" ] || continue
  para="$(destinatario_de_nombre "$b")"
  alarma=1
  echo "PEDIDO SIN RESPUESTA (${edad}min >= ${UMBRAL_PEDIDO_MIN}): $b -> deudora: ${para:-todos}"
done

# ── Regla 3: en-curso/ sin actividad dentro del umbral declarado ───────────────
# Fix (rescate de contrato_...rescatar-los-2-commits-de-monitoreo, ampliación 2): la edad NO
# puede ser sólo el mtime del contrato — un frente que reporta avance_ (sin re-tocar el .md de
# en-curso/, que es justamente el protocolo: "quien termina lo mueve", no "quien avanza lo toca")
# quedaba marcado como "sin avance" igual, aunque acabara de reportar. Se toma el MÍNIMO entre la
# edad del contrato y la del avance_ MÁS RECIENTE del mismo frente (patrón *_avance_<frente>-a-*.md
# en cerrado/*/, dos niveles: cerrado/<fecha>/<archivo>).
if [ -d "$ENCURSO" ]; then
  CERRADO="$BUZON/cerrado"
  for f in "$ENCURSO"/*.md; do
    [ -e "$f" ] || continue
    b="$(basename "$f")"
    edad="$(edad_min "$f")"
    para="$(destinatario_de_nombre "$b")"
    if [ -n "${para:-}" ] && [ -d "$CERRADO" ]; then
      mas_nuevo="$(find "$CERRADO" -maxdepth 2 -type f -iname "*_avance_${para}-a-*.md" -printf '%T@ %p\n' 2>/dev/null \
        | sort -rn | head -1 | cut -d' ' -f2-)"
      if [ -n "${mas_nuevo:-}" ]; then
        edad_avance="$(edad_min "$mas_nuevo")"
        [ "$edad_avance" -lt "$edad" ] && edad="$edad_avance"
      fi
    fi
    umbral="$UMBRAL_SILENCIO_DEFAULT_MIN"
    declarado="$(grep -m1 -oE 'UMBRAL_SILENCIO:[[:space:]]*[0-9]+' "$f" 2>/dev/null | grep -oE '[0-9]+' | head -1)"
    [ -n "${declarado:-}" ] && umbral="$declarado"
    [ "$edad" -ge "$umbral" ] || continue
    alarma=1
    echo "EN-CURSO SIN AVANCE (${edad}min >= ${umbral}): $b -> dueño del frente: ${para:-desconocido}"
  done
fi

if [ "$alarma" = "0" ]; then
  echo "ESCALADORES: nada que escalar."
  exit 0
fi
exit 1
