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

# ── MEDICIONES QUE NO SE PUDIERON HACER ─────────────────────────────────────────
# Este script mide edades con `$(...)`, y cada una de esas es un fork. El 2026-09-21, con 16
# worktrees y 5 sesiones vivas sobre el mismo Git for Windows, los forks empezaron a fallar de a
# rachas (`dofork: child -1 ... Resource temporarily unavailable`, `cygheap read copy failed`).
#
# Lo grave NO es que falle: es COMO fallaba. Un fork fallido devuelve la medicion VACIA, y el
# `[ "$edad" -ge "$UMBRAL" ] || continue` de cada regla trata "integer expression expected" igual
# que "todavia es joven": SALTEA el archivo. Si la racha alcanzaba a todos, el script llegaba al
# final con `alarma=0`, imprimia "nada que escalar" y salia 0 — y vigilancia-check.sh reportaba
# calma. Un contrato abandonado y un escalador que no pudo mirarlo producian EL MISMO SILENCIO.
#
# Es la familia de defectos que este repo ya pago varias veces (el watchdog que solo ve al que
# llega tarde, la allowlist que no sabe lo que le falta): el instrumento no falla, se calla. La
# regla que lo cierra es una sola — **una medicion que no se pudo hacer es una ALARMA, nunca un
# cero**. Abajo se cuentan, y el bloque de cierre convierte el conteo en exit 1 con nombre propio.
medicion_fallida=0
medicion_fallida_lista=""

# Una medicion valida es un entero. Vacio, texto o negativo = el fork no volvio con un numero.
es_medicion() { [[ "${1:-}" =~ ^[0-9]+$ ]]; }

# anotar_fallo <archivo> <de-que-regla> — registra y deja constancia en stdout en el acto, para
# que se vea cual archivo quedo sin mirar aunque el script muera en el proximo fork.
anotar_fallo() {
  medicion_fallida=$(( medicion_fallida + 1 ))
  medicion_fallida_lista="${medicion_fallida_lista}  · ${1} (${2})
"
}

# `date` una sola vez y no por archivo: cada $(...) es un fork, y los forks son el recurso escaso.
FECHA_HOY="$(date +%Y-%m-%d)"

edad_min() {
  local f="$1" m
  m="$(stat -c %Y "$f" 2>/dev/null || echo "$now")"
  # NO inventar un numero. En aritmetica de bash una variable vacia vale 0, asi que un `stat` que
  # sale 0 sin imprimir nada (lo que hace un fork caido a medio camino) no da error: da
  # `(now - 0) / 60` = 29.833.587 minutos. La medicion no se pierde, se vuelve "infinitamente
  # viejo", y el escalador pasa de callarse a INUNDAR: todo cruza cualquier umbral a la vez.
  # Medido el 2026-09-21 con un `stat` de mentira, y es la otra mitad del mismo defecto: mentir
  # hacia arriba y mentir hacia abajo son los dos modos de no saber. Devolver vacio deja que el
  # llamador lo cuente como medicion fallida, que es lo unico cierto que se puede decir.
  es_medicion "$m" || { echo ""; return; }
  echo $(( (now - m) / 60 ))
}

# El parser del destinatario vive en scripts/lib/buzon-roles.sh — FUENTE ÚNICA.
# Estaba acá con `[a-z]+`, que no matchea dígitos: al desdoblar frontend en frontend1/
# frontend2 (2026-09-07) devolvía '' y el `${para:-todos}` de más abajo reescribía la
# escalación a `todos` — un mensaje MAL DIRIGIDO, no un error. Medición en el helper.
# shellcheck source=lib/buzon-roles.sh
. "$(dirname "${BASH_SOURCE[0]}")/lib/buzon-roles.sh"

# edad_alta_min — para pedido_/urgente_: edad desde que ENTRÓ al buzón, no desde el último touch.
# Causa raíz (medida 2026-08-06): ampliar un pedido_ con evidencia nueva (justo lo que hay que
# hacer para que el operador pueda decidir) actualiza el mtime y lo borra del radar del escalador
# — el incentivo queda invertido. `git log` no sirve (coordinacion/ está gitignoreado). La fecha
# del propio nombre es un PISO barato: un archivo con fecha de un día anterior a hoy ya es viejo,
# sin importar mtime ni sidecar. Para el caso del mismo día (donde el piso no alcanza), un sidecar
# — la primera vez que este script VE el archivo, graba cuándo; toques posteriores no lo tocan.
edad_alta_min() {
  local f="$1" b fecha_archivo fecha_hoy sidecar_file primera
  b="${f##*/}"                 # builtin, no `basename`: un fork menos por archivo
  fecha_archivo="${b:0:10}"
  fecha_hoy="$FECHA_HOY"       # calculada una vez arriba, no por archivo
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
  # NO inventar un numero. En aritmetica de bash una variable vacia vale 0, asi que un `stat` que
  # sale 0 sin imprimir nada (lo que hace un fork caido a medio camino) no da error: da
  # `(now - 0) / 60` = 29.833.587 minutos. La medicion no se pierde, se vuelve "infinitamente
  # viejo", y el escalador pasa de callarse a INUNDAR: todo cruza cualquier umbral a la vez.
  # Medido el 2026-09-21 con un `stat` de mentira, y es la otra mitad del mismo defecto: mentir
  # hacia arriba y mentir hacia abajo son los dos modos de no saber. Devolver vacio deja que el
  # llamador lo cuente como medicion fallida, que es lo unico cierto que se puede decir.
  es_medicion "$primera" || { echo ""; return; }
  echo $(( (now - primera) / 60 ))
}

# epoch del avance_ MÁS RECIENTE que el frente <destinatario> mandó (patrón *_avance_<frente>-a-*),
# nacen archivados en cerrado/<fecha>/. 0 si no hay ninguno.
declare -A _avance_cache=()
avance_mas_reciente_epoch() {
  local frente="$1" mejor=0 f m
  [ -n "$frente" ] || { echo 0; return; }
  # Memoizado: la Regla 3 lo llama UNA VEZ POR ARCHIVO de en-curso/, y cada llamada re-escaneaba
  # `cerrado/*/` entero con un `stat` por match. Con 14 frentes y un cerrado/ que crece todos los
  # dias eso son cientos de forks para releer lo mismo. El resultado no cambia dentro de una
  # corrida (`now` ya esta congelado arriba), asi que cachearlo por frente es exacto, no una
  # aproximacion.
  if [ -n "${_avance_cache[$frente]:-}" ]; then echo "${_avance_cache[$frente]}"; return; fi
  shopt -s nullglob
  for f in "$CERRADO"/*/????-??-??_avance_"${frente}"-a-*.md; do   # anclado por posición, ver Regla 1
    m="$(stat -c %Y "$f" 2>/dev/null || echo 0)"
    [ "$m" -gt "$mejor" ] && mejor="$m"
  done
  _avance_cache["$frente"]="$mejor"
  echo "$mejor"
}

# ── Regla 1: contrato_ con disparador cumplido, viejo, sin tomar ───────────────
shopt -s nullglob
# Acumuladores por destinatario: el reporte a stdout sigue siendo uno por contrato, pero el
# `urgente_` que se ESCRIBE en el buzón es uno por rol (ver el bloque que cierra la regla).
declare -A sin_tomar_n=() sin_tomar_lista=() sin_tomar_edad=() sin_tomar_viejo=()
# Glob anclado por POSICIÓN (`<fecha>_<tipo>_…`), no por substring: `*_contrato_*` se comía las
# alertas que este mismo script autogenera, porque embeben el nombre del contrato huérfano en el
# suyo (`…_urgente_vigilancia-a-backend_contrato-sin-tomar-<nombre del contrato>.md`). Medido en el
# buzón real el 2026-08-12: el escalador leía su propia alerta como un contrato sin tomar y, pasado
# el umbral, generaba una alerta SOBRE su alerta — cascada autogenerada de nombres cada vez más
# largos. Mismo defecto y mismo fix que en scripts/lint-contratos-referencias.sh (#403).
for f in "$ABIERTO"/????-??-??_contrato_*.md; do
  b="${f##*/}"
  edad="$(edad_min "$f")"
  # Sin este guard, una medicion vacia cae en el `|| continue` de abajo y el contrato desaparece
  # del radar sin dejar rastro. Ver el bloque MEDICIONES QUE NO SE PUDIERON HACER, arriba.
  if ! es_medicion "$edad"; then anotar_fallo "$b" "contrato sin tomar"; continue; fi
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
  para="${para:-todos}"
  alarma=1
  echo "CONTRATO SIN TOMAR (${edad}min >= ${UMBRAL_CONTRATO_MIN}): $b -> le toca a ${para}"
  # Se ACUMULA por destinatario en vez de escribir el urgente_ acá. Ver el bloque de abajo.
  sin_tomar_n["$para"]=$(( ${sin_tomar_n["$para"]:-0} + 1 ))
  sin_tomar_lista["$para"]="${sin_tomar_lista["$para"]:-}  · ${b} (${edad}min)
"
  if [ "${edad}" -gt "${sin_tomar_edad["$para"]:-0}" ]; then
    sin_tomar_edad["$para"]="$edad"
    sin_tomar_viejo["$para"]="$b"
  fi
done

# UN urgente_ por DESTINATARIO, no uno por contrato. El 2026-09-21 14:52 backend tenía 6 contratos
# (K-07/08/11/12/14/15) cruzando el umbral en el mismo ciclo, porque planificación los bajó en
# lote: la versión anterior iba a escribir SEIS archivos `urgente_` en abierto/ —de una, y otros
# tantos por cada destinatario compuesto— convirtiendo el canal en su propio ruido. El buzón ya
# pagó esto una vez con la cascada de alertas-sobre-alertas de agosto (ver el comentario del glob
# anclado, arriba): el escalador NO tiene que poder inundar el buzón que vigila.
#
# El CRITERIO no cambia y la alarma tampoco: cada contrato sigue saliendo por stdout con su edad, y
# `alarma=1` ya quedó puesto arriba. Lo que se agrupa es el efecto colateral en el canal. Y el
# mensaje agrupado dice algo que el individual no podía decir —"son N, el más viejo es éste"—, que
# es justo el dato que necesita quien lo recibe para ordenar su cola.
fecha_hoy="$FECHA_HOY"
for para in "${!sin_tomar_n[@]}"; do
  n="${sin_tomar_n[$para]}"
  urgente="$ABIERTO/${fecha_hoy}_urgente_vigilancia-a-${para}_contratos-sin-tomar.md"
  [ "$DRY_RUN" = "0" ] || continue
  # Idempotente por DÍA y destinatario: si ya existe, se REESCRIBE con la lista actual en vez de
  # saltearse. Saltear dejaba el aviso congelado en la foto del primer ciclo — un contrato que
  # entrara después nunca aparecía en el archivo que el destinatario abre.
  {
    echo "# URGENTE -> ${para^^} - ${n} contrato(s) sin tomar"
    echo
    echo "Generado automaticamente por scripts/escaladores-buzon.sh (Gancho 3, escalador de edad)."
    echo "Se reescribe en cada corrida: la lista de abajo es la foto de $(date '+%H:%M')."
    echo
    echo "Llevan mas de ${UMBRAL_CONTRATO_MIN} min en abierto/ con el disparador cumplido y nadie"
    echo "los movio a en-curso/:"
    echo
    printf '%s' "${sin_tomar_lista[$para]}"
    echo
    echo "El mas viejo es ${sin_tomar_viejo[$para]} (${sin_tomar_edad[$para]} min)."
    echo
    echo "Tomalos en orden. Si alguno en realidad espera algo, declaralo con una linea"
    echo "'DISPARADOR: pendiente' en el propio contrato para que deje de escalar."
    if [ "$n" -ge 4 ]; then
      echo
      echo "Si son mas de los que tu cola absorbe, eso es un dato para PLANIFICACION, no una deuda"
      echo "tuya: contestale con un pedido_ diciendo cuantos podes tomar y en que orden."
    fi
  } > "$urgente"
  echo "   -> generado $urgente (${n} contrato/s)"
done

# ── Regla 2: pedido_ viejo en abierto/ (= sin respuesta_, por protocolo) ───────
for f in "$ABIERTO"/????-??-??_pedido_*.md; do   # anclado por posición, ver Regla 1
  b="${f##*/}"
  edad="$(edad_alta_min "$f")"
  if ! es_medicion "$edad"; then anotar_fallo "$b" "pedido sin respuesta"; continue; fi
  [ "$edad" -ge "$UMBRAL_PEDIDO_MIN" ] || continue
  para="$(destinatario_de_nombre "$b")"
  alarma=1
  echo "PEDIDO SIN RESPUESTA (${edad}min >= ${UMBRAL_PEDIDO_MIN}): $b -> deudora: ${para:-todos}"
done

# ── Regla 3: en-curso/ sin actividad dentro del umbral declarado ───────────────
if [ -d "$ENCURSO" ]; then
  for f in "$ENCURSO"/*.md; do
    [ -e "$f" ] || continue
    b="${f##*/}"
    para="$(destinatario_de_nombre "$b")"
    # Edad = MÍNIMO entre el mtime del contrato y el del avance_ más reciente del mismo frente —
    # si no se mira el avance_, un frente que SÍ reportó hace 13min sigue leyéndose como "sin
    # avance" con el mtime del contrato de hace 100min (medido 2026-08-06, ver AMPLIACIÓN 2).
    # El `mv` de abierto/ a en-curso/ NO cambia el mtime, así que un contrato recién TOMADO nacía
    # marcado con la edad de cuando se escribió: el 21/09 K-03 se movió a en-curso a las 14:27 y el
    # escalador lo reportó como «104min sin avance» dos minutos después. Una alarma que dispara
    # sobre trabajo recién tomado entrena a ignorar el escalador, y la próxima real se pierde.
    # El ctime SÍ cambia con el `mv` (verificado: mismo mtime 12:43 y ctimes 13:07 / 14:22 / 14:27,
    # que son las tres tomas). Como el estado ES la ubicación del archivo, lo que hay que medir es
    # desde que LLEGÓ acá: el más nuevo de los dos.
    m_contrato="$(stat -c %Y "$f" 2>/dev/null || echo "$now")"
    m_movido="$(stat -c %Z "$f" 2>/dev/null || echo 0)"
    # El `|| echo` de arriba cubre que `stat` FALLE, no que el fork no vuelva: en ese caso la
    # sustitucion sale vacia, el `||` nunca dispara y la aritmetica de abajo se rompe en silencio.
    if ! es_medicion "$m_contrato" || ! es_medicion "$m_movido"; then
      anotar_fallo "$b" "en-curso sin avance"; continue
    fi
    [ "$m_movido" -gt "$m_contrato" ] && m_contrato="$m_movido"
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

# Una medicion que no se pudo hacer NO es un cero: es una alarma. Va antes del resumen para que
# quede arriba en el reporte del gate, donde se lee primero.
if [ "$medicion_fallida" -gt 0 ]; then
  alarma=1
  echo "MEDICION INCOMPLETA: ${medicion_fallida} archivo(s) no se pudieron medir (fork/stat no volvio con un numero)."
  printf '%s' "$medicion_fallida_lista"
  echo "   -> el silencio de este reporte NO es dato: esos archivos quedaron sin mirar."
fi

if [ "$alarma" = "0" ]; then
  echo "ESCALADORES: nada que escalar."
fi

# CENTINELA DE TERMINACION — ultima linea SIEMPRE, en los dos caminos.
# El guard de arriba cubre la medicion que vuelve vacia; esto cubre el caso en que el proceso
# MUERE a mitad (el fork que falla es el del propio subshell y bash aborta el pipeline). Ahi no
# hay contador que salvar: lo unico que distingue "termine y no habia nada" de "me morto antes de
# llegar" es que la frase final este o no este. vigilancia-check.sh la exige; si falta, alarma.
echo "ESCALADORES: FIN-OK"
[ "$alarma" = "0" ] && exit 0
exit 1
