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
# `coordinacion/` NO está versionada y existe UNA sola vez: en el checkout principal. Derivarla del
# root de ESTE script lo dejaba ciego en cualquier worktree (26 vivos = el caso NORMAL). Cuarto y
# quinto gemelo del mismo par de líneas (PR #676): los encontró el grep de una línea, no la lectura.
_resolver_buzon() {
  if [ -n "${1:-}" ]; then printf '%s' "$1"; return; fi
  if [ -n "${BUZON_DIR:-}" ]; then printf '%s' "$BUZON_DIR"; return; fi
  if [ -d "$REPO_ROOT/coordinacion" ]; then printf '%s' "$REPO_ROOT/coordinacion"; return; fi
  _gc="$(git -C "$REPO_ROOT" rev-parse --path-format=absolute --git-common-dir 2>/dev/null || true)"
  if [ -n "$_gc" ]; then printf '%s' "$(dirname "$_gc")/coordinacion"
  else printf '%s' "$REPO_ROOT/coordinacion"; fi
}
BUZON="$(_resolver_buzon "${1:-}")"
ABIERTO="$BUZON/abierto"
CERRADO="$BUZON/cerrado"   # mismo layout que archivar-buzon.sh: cerrado/<fecha>/
ENCURSO="$BUZON/en-curso"
CERRADO="$BUZON/cerrado"
# Sidecar de la Regla 2 (ver edad_alta_min) — fuera de abierto/en-curso/cerrado para que ningún
# otro escaneo del buzón lo confunda con un mensaje.
#
# ⚠️ Esa proteccion es por UBICACION, y el 2026-09-29 se midio que no alcanza: proteger por
# directorio protege a los escaneos que respetan el directorio, y un `find -name '<pedido>.md'`
# recursivo no lo respeta — devolvia DOS hits para el mismo nombre, el pedido y su sidecar. Un `>>`
# a la ruta equivocada no da ningun error, y asi se perdieron 33 lineas de una correccion de alcance
# del pedido BL-Q4 de FE2: el append cayo en el sidecar, el pedido se cerro seis dias despues sin
# ellas y FE2 nunca vio la correccion. Recuperadas intactas. Por eso el sidecar ahora lleva el
# sufijo `.first-seen` (ver edad_alta_min): ningun `find -name '*.md'` puede alcanzarlo.
SIDECAR_DIR="$BUZON/.escalador-estado"
# Sufijo del sidecar. Es lo que lo saca del namespace de los mensajes: se protege por NOMBRE,
# no solo por carpeta.
SIDECAR_SUF=".first-seen"

# Fuente UNICA del nombre del `urgente_` de contratos sin tomar. Vivia dos veces —la rama que lo
# ESCRIBE y la que lo RETIRA (#740)— y auditoria midio que ese nombre **ya cambio una vez**, hace
# ocho dias: 46 archivos con la forma vieja (`_contrato-sin-tomar-<contrato>.md`, singular) del
# 2026-08-03 al 09-22, y 7 con la actual desde el 09-21. Con el nombre duplicado, el dia del proximo
# cambio la rama de escritura seguiria escribiendo y la de retiro no matchearia nada: volveria el
# `urgente_` inmortal, y `retirados_obsoletos=0` seria indistinguible de «no habia nada que retirar»
# — un silencio que ya no se puede leer. Derivar las dos del mismo par infijo/sufijo hace que la
# divergencia no pueda ocurrir, que es mejor que detectarla.
# El `:-` NO es configuracion: existe para que el control positivo de mas abajo sea EJERCITABLE.
# Sin override no hay forma de fabricar el caso «el nombre que genero no lo alcanza mi patron», y un
# guard que nunca se pudo ver fallar es indistinguible de uno ausente. Un override INCOHERENTE
# (cambiar uno solo) es exactamente lo que el control caza, que es lo que el test hace a proposito.
URGENTE_ST_INFIJO="${URGENTE_ST_INFIJO:-_urgente_vigilancia-a-}"
URGENTE_ST_SUF="${URGENTE_ST_SUF:-_contratos-sin-tomar.md}"
URGENTE_ST_GLOB_INFIJO="${URGENTE_ST_GLOB_INFIJO:-$URGENTE_ST_INFIJO}"

UMBRAL_CONTRATO_MIN="${UMBRAL_CONTRATO_MIN:-120}"          # 2h, del pendiente
UMBRAL_PEDIDO_MIN="${UMBRAL_PEDIDO_MIN:-30}"                # 30min, del pendiente
UMBRAL_SILENCIO_DEFAULT_MIN="${UMBRAL_SILENCIO_DEFAULT_MIN:-90}"   # default ya usado por Cron 2

if [ ! -d "$ABIERTO" ]; then
  # Fail-CLOSED: el `exit 0` de antes reportaba calma sobre una carpeta que nunca miró.
  echo "❌ ESCALADORES: no puedo ver mi sujeto — no existe $ABIERTO" >&2
  echo "    'coordinacion/' existe UNA sola vez (checkout principal). Apuntala: BUZON_DIR=<ruta>" >&2
  exit 2
fi
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
  local f="$1" b fecha_archivo fecha_hoy sidecar_file sidecar_legacy primera
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
  # ⚠️⚠️ Y NO protegia contra la fecha ATRASADA, que es el CRUCE DE MEDIANOCHE. Medido en vivo por
  # auditoria el 2026-09-30 00:0x: un `pedido_` de TRES MINUTOS de vida reportando `999999min`,
  # porque lo nombro `2026-09-29_` — su jornada mental seguia siendo la de ayer. Las cuatro sesiones
  # venian fechando 29 toda la jornada, asi que no era un caso de borde: era todos los archivos que
  # cualquiera escribiera en las horas siguientes. Y con el escalador ya sabiendo retirar (#740) el
  # dano no es solo ruido: cada uno de esos nacia por encima de todo umbral y generaba su `urgente_`.
  #
  # El error del piso NO era la comparacion (`<` es correcto), era el SUPUESTO: «un archivo con
  # fecha de un dia anterior ya es viejo, sin importar mtime ni sidecar». La fecha del nombre es una
  # DECLARACION del autor, no una medicion — y el que cruza la medianoche no se da cuenta de que la
  # escribio mal, porque para el sigue siendo el mismo dia de trabajo.
  #
  # Por que no alcanza con quitar el piso: existia para cubrir un caso real —un archivo viejo al que
  # le tocaron el mtime y que este script nunca vio (sin sidecar)— y sin el, ese caso deja de
  # escalar. Mentir hacia abajo es el modo que no se nota, y es el que este archivo ya pago dos
  # veces. Asi que el piso no se quita: se REEMPLAZA por el dato que discrimina los dos casos, que
  # es el NACIMIENTO del archivo (`stat -c %W`). Medido en este filesystem antes de codificarlo:
  #
  #     archivo recien creado   -> %W == %Y == ahora
  #     urgente_ real de ayer   -> %W = nacio hace 2.5h · %Y = 40min despues (nacio antes, lo tocaron)
  #
  # El nacimiento es inmune a las ediciones posteriores, que es exactamente la propiedad que el
  # sidecar fue a buscar. Con el, las DOS protecciones se cumplen sin canje: el del cruce de
  # medianoche mide 3 min y no escala, y el viejo con mtime tocado mide su edad real y escala igual.
  #
  # La fecha del nombre pasa entonces de PISO a SEÑAL DE DISCREPANCIA: cuando el nombre declara un
  # dia anterior y la fisica dice que nacio hoy, gana la fisica y se avisa por stderr con la accion
  # concreta (renombrar), porque ahi el dato de control esta mal escrito y sigue mal hasta que
  # alguien lo arregle. No pone `alarma`: avisar de un nombre mal fechado no es un hallazgo del
  # buzon, y una limpieza que alarma es el defecto que #740 vino a cerrar.
  local fecha_declara_viejo=0
  if [[ "$fecha_archivo" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]] && [[ "$fecha_archivo" < "$fecha_hoy" ]]; then
    fecha_declara_viejo=1
  fi
  sidecar_file="$SIDECAR_DIR/$b$SIDECAR_SUF"
  # Migracion del namespace viejo (sidecar con el nombre EXACTO del mensaje). Es idempotente y se
  # hace por `mv`, no por copia, para que la medicion acumulada no se pierda: si se ignorara el
  # archivo viejo, cada pedido en vuelo volveria a su primer avistamiento y el escalador pasaria a
  # mentir HACIA ABAJO — el modo que no se nota, el mismo que ya se pago al arreglar el atajo por
  # fecha. En --dry-run no se mueve nada, pero se LEE el viejo: un dry-run que midiera distinto que
  # la corrida real seria un instrumento que no mide a su propio sujeto.
  sidecar_legacy="$SIDECAR_DIR/$b"
  if [ ! -f "$sidecar_file" ] && [ -f "$sidecar_legacy" ]; then
    if [ "$DRY_RUN" = "0" ]; then
      mkdir -p "$SIDECAR_DIR" 2>/dev/null || true
      mv -f "$sidecar_legacy" "$sidecar_file" 2>/dev/null || sidecar_file="$sidecar_legacy"
    else
      sidecar_file="$sidecar_legacy"
    fi
  fi
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
    # `%W` = NACIMIENTO. Es mejor piso que el mtime por la misma razon por la que existe el
    # sidecar (una edicion posterior no lo mueve), y encima cubre el caso que el sidecar no puede:
    # el archivo que este script ve por PRIMERA vez y que ya venia editado. No esta disponible en
    # todos los filesystems — `stat` devuelve `0` (o `-`) cuando no lo tiene —, asi que se valida
    # antes de usarlo y se cae al mtime, que es el comportamiento anterior.
    local m_archivo m_nacimiento
    m_archivo="$(stat -c %Y "$f" 2>/dev/null || echo "$now")"
    m_nacimiento="$(stat -c %W "$f" 2>/dev/null || echo 0)"
    primera="$m_archivo"
    if es_medicion "$m_nacimiento" && [ "$m_nacimiento" -gt 0 ] && [ "$m_nacimiento" -le "$m_archivo" ]; then
      primera="$m_nacimiento"
    fi
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
  local edad_real=$(( (now - primera) / 60 ))
  # La fisica gana, y si contradice al nombre se avisa. El umbral del aviso es el de los pedidos:
  # por debajo de el la discrepancia no cambia ninguna decision, y avisar de lo que no cambia nada
  # es el ruido que desarma al instrumento.
  if [ "$fecha_declara_viejo" = "1" ] && [ "$edad_real" -lt "$UMBRAL_PEDIDO_MIN" ]; then
    printf '   -> ⚠️ FECHA MAL ESCRITA en %s: el nombre declara %s (dia anterior) pero el archivo
' "$b" "$fecha_archivo" >&2
    printf '      nacio hace %s min. Gana la medicion. Renombralo a %s_ para que el dato de control
' "$edad_real" "$fecha_hoy" >&2
    printf '      diga la verdad -- es el cruce de medianoche, no un descuido tuyo.
' >&2
  fi
  echo "$edad_real"
}

# epoch del avance_ o cierre_ MÁS RECIENTE que el frente <destinatario> mandó (patrón
# *_avance_<frente>-a-* / *_cierre_<frente>-a-*), en cerrado/<fecha>/ O en abierto/. 0 si no hay ninguno.
# El protocolo dice que el avance_ nace archivado, pero no todas las sesiones lo cumplen: el 22/09 FE2
# dejó su avance_ (06:37) y su cierre_ (06:46) en abierto/, y el escalador lo reportó «92min sin
# avance» con el PR del frente mergeado hacía 3 min. Lo que se mide es CUÁNDO reportó, no DÓNDE lo dejó.
declare -A _avance_cache=()
# Deja el resultado en la GLOBAL `AVANCE_EPOCH` (no por stdout): llamarla con `$(...)` corre en un
# subshell y el cache moría en cada llamada — la memoización nunca funcionó y cada archivo de
# en-curso/ re-escaneaba cerrado/ entero con un `stat` por match (51 s el 21/09, con cerrado/ de 22
# días). Además, un solo `stat` por lote en vez de un fork por archivo.
avance_mas_reciente_epoch() {
  local frente="$1" files
  AVANCE_EPOCH=0
  [ -n "$frente" ] || return 0
  if [ -n "${_avance_cache[$frente]:-}" ]; then AVANCE_EPOCH="${_avance_cache[$frente]}"; return 0; fi
  shopt -s nullglob
  files=("$CERRADO"/*/????-??-??_{avance,cierre}_"${frente}"-a-*.md   # anclado por posición, ver Regla 1
         "$ABIERTO"/????-??-??_{avance,cierre}_"${frente}"-a-*.md)
  if [ "${#files[@]}" -gt 0 ]; then
    AVANCE_EPOCH="$(stat -c %Y "${files[@]}" 2>/dev/null | sort -n | tail -1)"
    [[ "$AVANCE_EPOCH" =~ ^[0-9]+$ ]] || AVANCE_EPOCH=0
  fi
  _avance_cache["$frente"]="$AVANCE_EPOCH"
}

# ── Regla 1: contrato_ con disparador cumplido, viejo, sin tomar ───────────────
shopt -s nullglob
# Acumuladores por destinatario: el reporte a stdout sigue siendo uno por contrato, pero el
# `urgente_` que se ESCRIBE en el buzón es uno por rol (ver el bloque que cierra la regla).
declare -A sin_tomar_n=() sin_tomar_lista=() sin_tomar_edad=() sin_tomar_viejo=()
# sin_tomar_bc: ¿alguno de los contratos que le escalan a ESTE rol venia de un broadcast? Decide si
# el urgente_ le explica que no se toma moviendolo — la instruccion vieja era imposible de cumplir
# para un broadcast, y una instruccion imposible es lo que entrena a ignorar el canal entero.
declare -A sin_tomar_bc=()
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

  # Un BROADCAST no se puede TOMAR, y esta regla mediía «¿lo movieron a en-curso/?». Medido el
  # 2026-09-29: `contrato_planificacion-a-todos_cierre-A-redeclarado` llevaba 429 min escalando y
  # NINGUNA sesion podia apagarlo — moverlo a en-curso/ lo habria borrado del abierto/ de las otras
  # tres. O sea que la unica forma de obedecer la instruccion del urgente_ era romper el buzon.
  #
  # Y el costo no era el ruido: `vigilancia-check.sh` usa el exit 1 de este script para decidir si
  # hay PARALISIS, asi que mientras un broadcast escalaba, el gate de paralisis de las cuatro
  # sesiones estaba sonando por una causa que nadie podia resolver. Una alarma permanente es un
  # instrumento apagado, no uno estricto — es el mismo defecto del watchdog (#394/#400) y el del
  # ancla `^DISPARADOR:` de mas abajo, tercera reincidencia en este archivo.
  #
  # El fix es medir lo que la regla QUIERE decir: un broadcast se atiende REPORTANDO, no moviendo.
  # Asi que se expande a los roles que lo heredan (roles_de_broadcast, fuente unica en
  # lib/buzon-roles.sh) y escala solo a los que no reportaron nada DESPUES del contrato. Si todos
  # reportaron, no hay alarma: es el control positivo de que esto se puede apagar.
  destinos=(); es_bc=0
  if es_broadcast_buzon "$para"; then
    es_bc=1
    # El mtime del contrato, no su primera vista: si alguien lo AMPLIA, el piso avanza y se vuelve a
    # exigir un reporte mas nuevo. Es el lado conservador a proposito — ampliar un contrato es
    # cambiarlo, y un avance_ anterior a la ampliacion no puede haberla contestado.
    epoch_contrato="$(stat -c %Y "$f" 2>/dev/null || echo 0)"
    emisor="$(emisor_de_nombre "$b")"
    mudos=0
    # La lista sale del CONTRATO si la declara, y del broadcast si no. Son dos preguntas
    # distintas: `roles_de_broadcast` dice a quiénes ALCANZA `a-todos`, y `ROLES:` dice quiénes
    # tienen algo que reportar. Usar la primera como si fuera la segunda es lo que le exigía un
    # reporte a `manejo-de-errores` sobre FACTID, donde no tenía ninguna de las tres piezas.
    # Sin la línea, el comportamiento es idéntico al de antes (caso 1 del test).
    declarados="$(roles_declarados_en "$f")"
    if [ -n "$declarados" ]; then fuente_roles="ROLES: del contrato"
    else fuente_roles="broadcast '${para}'"; fi
    while IFS= read -r rol; do
      [ -n "$rol" ] || continue
      [ "$rol" = "$emisor" ] && continue   # nadie se escala a si mismo, tambien si lo declaro
      avance_mas_reciente_epoch "$rol"
      if [ "${AVANCE_EPOCH:-0}" -gt "$epoch_contrato" ] 2>/dev/null; then continue; fi
      destinos+=("$rol"); mudos=$(( mudos + 1 ))
    done < <(if [ -n "$declarados" ]; then printf '%s\n' "$declarados"
             else roles_de_broadcast "$para" "$emisor"; fi)
    if [ "$mudos" = "0" ]; then
      echo "BROADCAST ATENDIDO (${edad}min): $b -> todos los roles reportaron despues; no escala"
      continue
    fi
    echo "CONTRATO SIN TOMAR (${edad}min >= ${UMBRAL_CONTRATO_MIN}): $b -> ${fuente_roles}, sin reporte posterior: ${destinos[*]}"
  else
    destinos=("$para")
    echo "CONTRATO SIN TOMAR (${edad}min >= ${UMBRAL_CONTRATO_MIN}): $b -> le toca a ${para}"
  fi
  alarma=1
  # Se ACUMULA por destinatario en vez de escribir el urgente_ acá. Ver el bloque de abajo.
  for para_d in "${destinos[@]}"; do
    [ "$es_bc" = "1" ] && sin_tomar_bc["$para_d"]=1
    sin_tomar_n["$para_d"]=$(( ${sin_tomar_n["$para_d"]:-0} + 1 ))
    sin_tomar_lista["$para_d"]="${sin_tomar_lista["$para_d"]:-}  · ${b} (${edad}min)
"
    # `-z` PRIMERO, y no es defensivo: con `set -u`, un array que se puebla SOLO en la rama
    # comparativa deja sin valor el caso en que la comparacion nunca da verdadera. Con `edad=0`,
    # `0 -gt 0` es falso, `sin_tomar_viejo` quedaba sin setear y la linea que lo lee abajo mataba
    # el script con «unbound variable» -- a mitad, con el urgente_ ya escrito y TRUNCADO, que es
    # justo lo que el centinela `ESCALADORES: FIN-OK` existe para cazar (y lo cazo).
    #
    # En produccion no daba sintoma porque el umbral es 120 min, asi que la edad siempre es > 0. Y
    # los tests no lo veian porque TODOS corrian en `--dry-run`, que hace `continue` antes de esta
    # lectura: el camino de escritura real no estaba ejercitado por ninguno.
    if [ -z "${sin_tomar_viejo["$para_d"]:-}" ] || [ "${edad}" -gt "${sin_tomar_edad["$para_d"]:-0}" ]; then
      sin_tomar_edad["$para_d"]="$edad"
      sin_tomar_viejo["$para_d"]="$b"
    fi
  done
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
  hay_broadcast="${sin_tomar_bc[$para]:-0}"
  urgente="$ABIERTO/${fecha_hoy}${URGENTE_ST_INFIJO}${para}${URGENTE_ST_SUF}"
  # CONTROL POSITIVO HORNEADO, y corre aunque no haya nada que retirar. La fuente unica de arriba
  # impide que los dos literales diverjan, pero no impide que el GLOB del retiro deje de alcanzar
  # al nombre por otra razon (un rol con un caracter que el glob no cubra, un prefijo de fecha
  # distinto). Lo que se verifica es la propiedad que importa: **lo que este script acaba de
  # nombrar, este script tiene que poder volver a encontrarlo**. Si no, el defecto es del
  # instrumento —no del buzon— y tiene que gritar: callado reaparece como `urgente_` inmortal, que
  # es lo que #740 vino a cerrar. Mismo criterio con el que se endurecio el caso 4 del test de
  # `ROLES:`, que pasaba por la razon equivocada.
  case "${urgente##*/}" in
    ????-??-??"$URGENTE_ST_GLOB_INFIJO"*"$URGENTE_ST_SUF") ;;
    *)
      alarma=1
      echo "INSTRUMENTO ROTO: el urgente_ que genero no lo alcanza mi propio patron de retiro."
      echo "   generado: ${urgente##*/}"
      echo "   patron:   ????-??-??${URGENTE_ST_GLOB_INFIJO}*${URGENTE_ST_SUF}"
      echo "   Mientras no coincidan, cada aviso que escriba queda INMORTAL en abierto/ (ver #740)."
      ;;
  esac
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
    if [ "${hay_broadcast:-0}" = "1" ]; then
      echo
      echo "Alguno de los de arriba va dirigido a un BROADCAST (-a-todos_ / -a-frontend_), y esos NO"
      echo "se toman moviendolos: sacarlo de abierto/ lo borraria del buzon de las otras sesiones."
      echo "Se atienden REPORTANDO -- un avance_ o cierre_ tuyo posterior al contrato lo apaga para"
      echo "vos, y solo para vos. Por eso aparece con tu nombre y no como 'todos'."
    fi
    if [ "$n" -ge 4 ]; then
      echo
      echo "Si son mas de los que tu cola absorbe, eso es un dato para PLANIFICACION, no una deuda"
      echo "tuya: contestale con un pedido_ diciendo cuantos podes tomar y en que orden."
    fi
  } > "$urgente"
  echo "   -> generado $urgente (${n} contrato/s)"
done

# ── Retiro de los urgente_ que este script genero y cuya causa ya no existe ────────────────
# El escalador sabia ENCENDER y no sabia apagar, y eso lo volvia una alarma permanente: no hay
# un solo `rm` en todo el archivo, y el janitor declara `urgente_` OBLIGACION que «NUNCA se
# auto-archiva». Asi que un `urgente_` generado aca era INMORTAL — la foto de una causa que ya
# no existe quedaba en abierto/ para siempre, y `vigilancia-check.sh` la lee como deuda viva.
#
# Medido el 2026-09-29 21:42: un urgente_ a `manejo-de-errores` perseguia el contrato FACTID,
# que ya estaba en `cerrado/2026-09-29/`, por una exigencia de reporte que el fix de `ROLES:`
# eliminó ese mismo dia. Con 0 alarmas reales, el gate de las CUATRO sesiones seguia en rojo
# por ese archivo. Y es el mismo agujero que el `a-todos` un nivel mas arriba: el artefacto no
# tiene dueño. Su emisor es `vigilancia`, que no es una sesion — ninguna se reconoce dueña, y
# el que podria moverlo es el destinatario, que si lo hace afirma que lo atendio.
#
# Vigente = el rol escala EN ESTA CORRIDA **y** el archivo es el de HOY, o sea el que el bloque
# de arriba acaba de reescribir. Un urgente_ de una fecha anterior es obsoleto aunque el rol
# siga en deuda: su informacion vive en el de hoy, y dejarlo duplica la alarma.
#
# Se ARCHIVA, no se borra (el registro de que se escalo es dato), y el sidecar se va con el:
# son la misma unidad de medicion. Si la causa vuelve, el aviso es NUEVO y su edad tiene que
# empezar de nuevo — con el sidecar sobreviviente heredaria la edad del primer avistamiento y
# nacería ya por encima del umbral.
#
# ⚠️ Lo que este bloque NO puede hacer es apagar el escalador. Por eso: patron ANCLADO al
# nombre que genera este script (`urgente_vigilancia-a-<rol>_contratos-sin-tomar.md`) y nunca
# un `urgente_` escrito por una sesion; y NO toca `alarma`, porque una limpieza que pusiera
# alarma=1 seria otra alarma permanente, que es exactamente el defecto que viene a cerrar.
retirados_obsoletos=0
for f in "$ABIERTO"/????-??-??"$URGENTE_ST_GLOB_INFIJO"*"$URGENTE_ST_SUF"; do
  [ -e "$f" ] || continue
  b="${f##*/}"
  rol="${b#*"$URGENTE_ST_GLOB_INFIJO"}"; rol="${rol%"$URGENTE_ST_SUF"}"
  if [ -n "${sin_tomar_n[$rol]:-}" ] && [ "${b:0:10}" = "$fecha_hoy" ]; then continue; fi
  if [ "$DRY_RUN" != "0" ]; then
    echo "RETIRARIA urgente_ obsoleto (causa resuelta): $b"
    retirados_obsoletos=$(( retirados_obsoletos + 1 ))
    continue
  fi
  d="${b:0:10}"
  case "$d" in ????-??-??) ;; *) d="$fecha_hoy" ;; esac
  mkdir -p "$CERRADO/$d" 2>/dev/null || true
  if mv "$f" "$CERRADO/$d/" 2>/dev/null; then
    rm -f "$SIDECAR_DIR/$b$SIDECAR_SUF" "$SIDECAR_DIR/$b" 2>/dev/null || true
    echo "   -> retirado urgente_ obsoleto (causa resuelta): $b -> cerrado/$d/"
    retirados_obsoletos=$(( retirados_obsoletos + 1 ))
  else
    echo "   -> NO pude retirar $b (mv fallo): queda en abierto/ y va a seguir escalando"
  fi
done

# ── Regla 2: pedido_ viejo que SIGUE EN abierto/ ──────────────────────────────
# ⚠️ Lo que mide es la UBICACION, no la respuesta: un pedido contestado con un `cierre_` que
# nadie movio de `abierto/` escala igual. El comentario decia «(= sin respuesta_, por
# protocolo)», que es una equivalencia SUPUESTA -- vale solo si quien responde ademas mueve el
# archivo. Dio sintoma el 2026-09-29: dos `pedido_` de auditoria escalaron 94 y 96 min con la
# respuesta ya escrita en el buzon, y es el mismo patron que esos dos pedidos denunciaban un
# nivel mas abajo (el `urgente_` que perseguia trabajo hecho).
#
# Aca la disciplina PUEDE funcionar, a diferencia del `a-todos`: un `pedido_` tiene destinatario
# unico y ese destinatario puede moverlo sin afirmar nada sobre nadie. Si esta regla deberia
# ademas LEER un `cierre_`/`respuesta_` dirigido al emisor es una decision de mecanismo abierta
# (fila en PLAN.md, dueño planificacion). Mientras no se decida, el comentario dice lo que el
# codigo hace y no lo que uno querria que hiciera.
for f in "$ABIERTO"/????-??-??_pedido_*.md; do   # anclado por posición, ver Regla 1
  b="${f##*/}"
  edad="$(edad_alta_min "$f")"
  if ! es_medicion "$edad"; then anotar_fallo "$b" "pedido sin respuesta"; continue; fi
  [ "$edad" -ge "$UMBRAL_PEDIDO_MIN" ] || continue
  para="$(destinatario_de_nombre "$b")"
  alarma=1
  regla2_hubo=1
  echo "PEDIDO SIN RESPUESTA (${edad}min >= ${UMBRAL_PEDIDO_MIN}): $b -> deudora: ${para:-todos}"
done

# La accion que APAGA esto, dicha por el instrumento. Es el punto 2 del veredicto de auditoria del
# 2026-09-30, y la razon por la que no se implementa el punto que uno querria (que la regla LEA la
# respuesta): auditoria midio la cobertura de la convencion de citar el `pedido_` en el cuerpo sobre
# el buzon entero -- **82 de 313 (26%)**, y no la cumple nadie (planificacion 22%, auditoria 24%,
# frontend1 8%). Emparejando por cita, el 74% de las respuestas CORRECTAS no apagaria nada y la
# alarma sonaria encima de trabajo terminado; emparejando por heuristica («cualquier cierre_
# posterior del destinatario al emisor») se apagarian pedidos que nadie contesto, que es fail-open y
# en un gate de parálisis no da sintoma nunca. Entre gritar de mas y callar de menos, el segundo es
# el que no se descubre. Si algun dia se lee de verdad, el orden es al revés del intuitivo: primero
# se EXIGE la declaracion al escribir, despues se la LEE -- el 26% mide la consecuencia pasada, no
# la voluntad futura.
#
# Mientras tanto, lo barato y lo que faltaba de verdad: **decirlo**. Los dos —auditoria y yo—
# respondimos sin mover el archivo y la alarma siguio 94 y 96 min, y no fue falta de disciplina: el
# instrumento mide la ubicacion y nunca le dijo a nadie que la ubicacion ES el acto. Cuando el
# mecanismo caza a su propio autor, «falta disciplina» queda descartada por la evidencia.
if [ "${regla2_hubo:-0}" = "1" ]; then
  echo "   -> lo que APAGA estas alarmas es MOVER el pedido_ a cerrado/<fecha>/ (o a en-curso/ si lo"
  echo "      estas trabajando). Una respuesta ESCRITA no las apaga: esta regla mide la UBICACION del"
  echo "      archivo, no si alguien contesto. Responder y no mover deja el aviso sonando sobre"
  echo "      trabajo ya hecho -- paso el 2026-09-29 entre planificacion y auditoria, en los dos"
  echo "      sentidos. El pedido_ tiene destinatario unico, asi que moverlo no afirma nada sobre"
  echo "      nadie mas: es el unico caso del buzon donde el cierre SI tiene una sola mano."
fi

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
    # Un broadcast en en-curso/ tenia el defecto ENTERO, y peor que en abierto/: esta rama
    # pedia el avance del rol literal `todos`, que NADIE firma, asi que `AVANCE_EPOCH` volvia 0
    # siempre y la edad no bajaba nunca. Medido el 2026-09-29 sobre el buzon real: tres
    # contratos `-a-todos_` en alarma permanente, uno de **2137 min** (35 h), con reportes de
    # las cuatro sesiones en el buzon. Esa es la version literal de «ninguna sesion podia
    # apagarlo»: no habia reporte posible que lo bajara.
    #
    # Y el costo es el de siempre, amplificado: `vigilancia-check.sh` usa el exit 1 de este
    # script para decidir si hay PARALISIS, asi que estos tres tenian el gate de las cuatro
    # sesiones sonando por una causa inapagable. Una alarma permanente es un instrumento
    # apagado, no uno estricto.
    #
    # El fix es el mismo que en abierto/ y por eso se lee igual: se expande a los roles que el
    # CONTRATO declara (`ROLES:`) o, si no los declara, a los que el broadcast alcanza; se toma
    # el avance MAS RECIENTE de entre ellos para la edad (si alguien esta trabajando, no se
    # grita) y se nombra a los MUDOS. Si no hay mudos, no hay alarma: ese es el control
    # positivo de que se puede apagar.
    mudos_ec=(); m_avance=0
    if es_broadcast_buzon "${para:-}"; then
      declarados_ec="$(roles_declarados_en "$f")"
      emisor_ec="$(emisor_de_nombre "$b")"
      while IFS= read -r rol; do
        [ -n "$rol" ] || continue
        [ "$rol" = "$emisor_ec" ] && continue
        avance_mas_reciente_epoch "$rol"
        [ "${AVANCE_EPOCH:-0}" -gt "$m_avance" ] 2>/dev/null && m_avance="$AVANCE_EPOCH"
        if [ "${AVANCE_EPOCH:-0}" -gt "$m_contrato" ] 2>/dev/null; then continue; fi
        mudos_ec+=("$rol")
      done < <(if [ -n "$declarados_ec" ]; then printf '%s\n' "$declarados_ec"
               else roles_de_broadcast "${para}" "$emisor_ec"; fi)
      if [ "${#mudos_ec[@]}" = "0" ]; then
        echo "BROADCAST EN CURSO ATENDIDO: $b -> todos los roles reportaron despues; no escala"
        continue
      fi
      para_reporte="sin reporte posterior: ${mudos_ec[*]}"
    else
      avance_mas_reciente_epoch "${para:-desconocido}"; m_avance="$AVANCE_EPOCH"
      para_reporte="dueño del frente: ${para:-desconocido}"
    fi
    m_mejor="$m_contrato"
    [ "$m_avance" -gt "$m_mejor" ] && m_mejor="$m_avance"
    edad=$(( (now - m_mejor) / 60 ))
    umbral="$UMBRAL_SILENCIO_DEFAULT_MIN"
    declarado="$(grep -m1 -oE 'UMBRAL_SILENCIO:[[:space:]]*[0-9]+' "$f" 2>/dev/null | grep -oE '[0-9]+' | head -1)"
    [ -n "${declarado:-}" ] && umbral="$declarado"
    [ "$edad" -ge "$umbral" ] || continue
    alarma=1
    echo "EN-CURSO SIN AVANCE (${edad}min >= ${umbral}): $b -> ${para_reporte}"
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

# ── GC DE SIDECARS HUÉRFANOS ───────────────────────────────────────────────────────────────────
# El sidecar vive y muere CON su mensaje (`test-escalador-retira-urgente-obsoleto.sh:20`: «se va
# con el archivo → si la causa vuelve, edad nueva»). Pero sólo se migra o se borra cuando el
# escalador TODAVÍA VE el mensaje: el que se archivó se lleva el mensaje y deja el sidecar. Medido
# el 2026-10-08 en el buzón real: **150 archivos de estado, 60 de ellos con la forma legacy** (sin
# el sufijo `.first-seen`), y el mensaje de 58 ya no existe en ninguna parte.
#
# POR QUÉ NO ES BASURA INOCUA: el nombre del sidecar es el del mensaje, así que **un nombre reusado
# HEREDA la sombra**. La rama de migración (`:224`) lo adopta con su timestamp viejo ⇒ el mensaje
# nuevo **nace ya escalado**, con una edad de hasta dos meses que nadie escribió. Y la forma legacy
# además colisiona por nombre con el mensaje: ése es exactamente el accidente que costó 33 líneas
# de una corrección de alcance del `pedido_` BL-Q4 (ver :68-74) — un `>>` a la ruta equivocada no
# da ningún error.
#
# ⚠️ LA DISCRIMINACIÓN QUE IMPORTA, y el primer diseño la tenía mal: un conjunto vivo **vacío** es
# un estado LEGÍTIMO (todo archivado) y entonces purgar todo es CORRECTO. Lo que hay que distinguir
# no es «vacío» de «no vacío», es **«no pude mirar» de «miré y no hay»** — y eso se contesta por la
# EXISTENCIA de los directorios, no por el conteo. Si falta alguno, el GC se omite y lo dice.
gc_examinados=0; gc_purgados=0; gc_omitido=""
if [ -d "$SIDECAR_DIR" ]; then
  if [ -d "$ABIERTO" ] && [ -d "$ENCURSO" ]; then
    _gc_vivos="$SIDECAR_DIR/.gc-vivos.$$"
    _gc_lista="$SIDECAR_DIR/.gc-lista.$$"
    find "$ABIERTO" "$ENCURSO" -maxdepth 1 -type f -name '*.md' 2>/dev/null \
      | while IFS= read -r _m; do basename "$_m"; done | sort -u > "$_gc_vivos" 2>/dev/null || : > "$_gc_vivos"
    # `-maxdepth 1` y el filtro por nombre dejan afuera los propios temporales del GC.
    find "$SIDECAR_DIR" -maxdepth 1 -type f ! -name '.gc-*' 2>/dev/null > "$_gc_lista" || : > "$_gc_lista"
    # El `while` lee por REDIRECCIÓN, no por pipe: en un pipe el cuerpo corre en un subshell y los
    # contadores se pierden al volver — el mismo defecto que este archivo ya documenta en otra parte.
    while IFS= read -r _s; do
      [ -n "$_s" ] || continue
      gc_examinados=$(( gc_examinados + 1 ))
      _b="$(basename "$_s")"
      case "$_b" in *"$SIDECAR_SUF") _b="${_b%$SIDECAR_SUF}" ;; esac
      if grep -qxF "$_b" "$_gc_vivos" 2>/dev/null; then continue; fi
      if [ "$DRY_RUN" != "0" ]; then
        gc_purgados=$(( gc_purgados + 1 )); continue
      fi
      rm -f "$_s" 2>/dev/null && gc_purgados=$(( gc_purgados + 1 ))
    done < "$_gc_lista"
    rm -f "$_gc_vivos" "$_gc_lista" 2>/dev/null || true
  else
    gc_omitido="no existe $ABIERTO o $ENCURSO: no pude saber que mensajes siguen vivos"
  fi
fi
# Se imprime SIEMPRE que haya algo que examinar, incluso con 0 purgados: el denominador es lo que
# distingue "mire 150 y ninguno estaba huerfano" de "no mire nada". Un instrumento que no mira
# nunca falla.
if [ -n "$gc_omitido" ]; then
  echo "GC de sidecars OMITIDO (no es un cero): $gc_omitido"
elif [ "$gc_examinados" -gt 0 ]; then
  if [ "$DRY_RUN" != "0" ]; then
    echo "GC de sidecars (DRY-RUN): $gc_examinados examinado(s), PURGARIA $gc_purgados huerfano(s)."
  else
    echo "GC de sidecars: $gc_examinados examinado(s), $gc_purgados huerfano(s) purgado(s)."
  fi
  if [ "$gc_purgados" -gt 0 ]; then
    echo "   -> no es alarma: su mensaje ya no existe. Se borran para que un nombre REUSADO no"
    echo "      herede la edad vieja y nazca escalado."
  fi
fi

if [ "${retirados_obsoletos:-0}" -gt 0 ] 2>/dev/null; then
  echo "LIMPIEZA: ${retirados_obsoletos} urgente_ obsoleto(s) del propio escalador. No es alarma:"
  echo "   su causa ya no existe, y mientras seguian en abierto/ mantenian el gate en rojo."
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
