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
CERRADO="$BUZON/cerrado"
# Sidecar de la Regla 2 (ver edad_alta_min) — fuera de abierto/en-curso/cerrado para que ningún
# otro escaneo del buzón lo confunda con un mensaje.
SIDECAR_DIR="$BUZON/.escalador-estado"

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

# extrae el destinatario del nombre: fecha_tipo_de-a-para_slug.md -> "para"
destinatario_de_nombre() {
  local b="$1"
  echo "$b" | sed -nE 's/^[0-9-]+_[a-z]+_[a-z]+-a-([a-z]+)_.*/\1/p'
}

# edad_alta_min — para pedido_/urgente_: edad desde que ENTRÓ al buzón, no desde el último touch.
# Causa raíz (medida 2026-08-06): ampliar un pedido_ con evidencia nueva (justo lo que hay que
# hacer para que el operador pueda decidir) actualiza el mtime y lo borra del radar del escalador
# — el incentivo queda invertido. `git log` no sirve (coordinacion/ está gitignoreado). La fecha
# del propio nombre es un PISO barato: un archivo con fecha de un día anterior a hoy ya es viejo,
# sin importar mtime ni sidecar. Para el caso del mismo día (donde el piso no alcanza), un sidecar
# — la primera vez que este script VE el archivo, graba cuándo; toques posteriores no lo tocan.
edad_alta_min() {
  local f="$1" b fecha_archivo fecha_hoy sidecar_file primera
  b="$(basename "$f")"
  fecha_archivo="${b:0:10}"
  fecha_hoy="$(date +%Y-%m-%d)"
  # ⚠️ `<`, NO `!=` — y la diferencia se midió el 2026-08-12 22:41 local. Las sesiones nombran los
  # archivos con la fecha UTC (`2026-08-13`) mientras `date` acá devuelve la local (`2026-08-12`):
  # con `!=`, los **13 archivos de hoy** caían en esta rama y reportaban `999999min`, o sea que
  # TODO pedido_/urgente_ nuevo escalaba en el instante de nacer. Una alarma que suena siempre es
  # la que ya se corrigió en el watchdog (#394/#400): no informa, entrena a ignorarla, y la próxima
  # real se pierde en el ruido. El comentario original ya decía «de un día ANTERIOR» — la intención
  # estaba bien, la comparación no. En ISO-8601 el orden lexicográfico ES el cronológico, así que
  # `<` dice exactamente lo que la regla quiere decir, y una fecha futura (o de otra zona horaria)
  # cae al sidecar, que es el mecanismo correcto para medirle la edad de verdad.
  if [[ "$fecha_archivo" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]] && [[ "$fecha_archivo" < "$fecha_hoy" ]]; then
    echo 999999   # de un día anterior: por encima de cualquier umbral en minutos, sin más cálculo
    return
  fi
  sidecar_file="$SIDECAR_DIR/$b"
  if [ -f "$sidecar_file" ]; then
    primera="$(cat "$sidecar_file" 2>/dev/null || echo "$now")"
  else
    # Primer avistamiento: el piso es el `mtime`, NO `now`. La razón por la que el sidecar existe es
    # que ampliar un pedido_ le refresca el mtime y lo saca del radar — pero eso sólo aplica a los
    # toques POSTERIORES, y contra ellos ya protege el sidecar (una vez grabado, no se vuelve a
    # tocar). Para el primer avistamiento el mtime nunca es más nuevo que `now`, y en el caso normal
    # (archivo creado y no editado) es la verdad exacta. Con `now` se perdía la edad ya acumulada:
    # al arreglar el atajo por fecha, un pedido_ de 40 min reales pasó a reportar 0 min — el
    # escalador dejaba de mentir hacia arriba para empezar a mentir hacia abajo, que es peor porque
    # no se nota.
    local m_archivo
    m_archivo="$(stat -c %Y "$f" 2>/dev/null || echo "$now")"
    primera="$m_archivo"
    [ "$primera" -gt "$now" ] 2>/dev/null && primera="$now"   # reloj adelantado: nunca edad negativa
    if [ "$DRY_RUN" = "0" ]; then
      mkdir -p "$SIDECAR_DIR" 2>/dev/null || true
      printf '%s\n' "$primera" > "$sidecar_file"
    fi
  fi
  echo $(( (now - primera) / 60 ))
}

# epoch del avance_ MÁS RECIENTE que el frente <destinatario> mandó (patrón *_avance_<frente>-a-*),
# nacen archivados en cerrado/<fecha>/. 0 si no hay ninguno.
avance_mas_reciente_epoch() {
  local frente="$1" mejor=0 f m
  [ -n "$frente" ] || { echo 0; return; }
  shopt -s nullglob
  for f in "$CERRADO"/*/????-??-??_avance_"${frente}"-a-*.md; do   # anclado por posición, ver Regla 1
    m="$(stat -c %Y "$f" 2>/dev/null || echo 0)"
    [ "$m" -gt "$mejor" ] && mejor="$m"
  done
  echo "$mejor"
}

# ── Regla 1: contrato_ con disparador cumplido, viejo, sin tomar ───────────────
shopt -s nullglob
# Glob anclado por POSICIÓN (`<fecha>_<tipo>_…`), no por substring: `*_contrato_*` se comía las
# alertas que este mismo script autogenera, porque embeben el nombre del contrato huérfano en el
# suyo (`…_urgente_vigilancia-a-backend_contrato-sin-tomar-<nombre del contrato>.md`). Medido en el
# buzón real el 2026-08-12: el escalador leía su propia alerta como un contrato sin tomar y, pasado
# el umbral, generaba una alerta SOBRE su alerta — cascada autogenerada de nombres cada vez más
# largos. Mismo defecto y mismo fix que en scripts/lint-contratos-referencias.sh (#403).
for f in "$ABIERTO"/????-??-??_contrato_*.md; do
  b="$(basename "$f")"
  edad="$(edad_min "$f")"
  [ "$edad" -ge "$UMBRAL_CONTRATO_MIN" ] || continue
  # El ancla tolera el marcado markdown de la línea porque el contrato es un .md y nadie escribe
  # `DISPARADOR: pendiente` pelado: el de lote C lo declara `**DISPARADOR: pendiente.**`, y con
  # `^DISPARADOR:` el ancla no llegaba ni a la D. La regla existía y no disparó NUNCA — el
  # escalador gritaba cada 3 min sobre una espera correcta, y ese exit 1 es el que usa
  # vigilancia-check.sh para decidir si hay parálisis: una alarma permanente por una espera sana
  # es indistinguible de la parálisis real que tiene que cazar.
  # Sigue exigiendo la palabra `pendiente`: un contrato que declara su disparador CUMPLIDO tiene
  # que escalar igual (si no, "tolerar markdown" degenera en "no escalar nunca").
  # Cubierto por scripts/tests/test-escalador-disparador-pendiente.sh (4 casos, con control
  # positivo y control de fail-open).
  if grep -qiE '^[[:space:]>*_-]*DISPARADOR:?[[:space:]*_]*pendiente' "$f" 2>/dev/null; then
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
for f in "$ABIERTO"/????-??-??_pedido_*.md; do   # anclado por posición, ver Regla 1
  b="$(basename "$f")"
  edad="$(edad_alta_min "$f")"
  [ "$edad" -ge "$UMBRAL_PEDIDO_MIN" ] || continue
  para="$(destinatario_de_nombre "$b")"
  alarma=1
  echo "PEDIDO SIN RESPUESTA (${edad}min >= ${UMBRAL_PEDIDO_MIN}): $b -> deudora: ${para:-todos}"
done

# ── Regla 3: en-curso/ sin actividad dentro del umbral declarado ───────────────
if [ -d "$ENCURSO" ]; then
  for f in "$ENCURSO"/*.md; do
    [ -e "$f" ] || continue
    b="$(basename "$f")"
    para="$(destinatario_de_nombre "$b")"
    # Edad = MÍNIMO entre el mtime del contrato y el del avance_ más reciente del mismo frente —
    # si no se mira el avance_, un frente que SÍ reportó hace 13min sigue leyéndose como "sin
    # avance" con el mtime del contrato de hace 100min (medido 2026-08-06, ver AMPLIACIÓN 2).
    m_contrato="$(stat -c %Y "$f" 2>/dev/null || echo "$now")"
    m_avance="$(avance_mas_reciente_epoch "${para:-desconocido}")"
    m_mejor="$m_contrato"
    [ "$m_avance" -gt "$m_mejor" ] && m_mejor="$m_avance"
    edad=$(( (now - m_mejor) / 60 ))
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
