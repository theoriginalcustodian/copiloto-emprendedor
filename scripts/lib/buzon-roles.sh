#!/usr/bin/env bash
# buzon-roles.sh — FUENTE ÚNICA de "qué destinatarios existen" y "qué lee cada sesión".
#
# POR QUÉ EXISTE (2026-09-07, Tarea 0 del contrato FE1): el destinatario de un mensaje sale del
# NOMBRE del archivo (`fecha_tipo_<emisor>-a-<destinatario>_slug.md`), y esa convención estaba
# reimplementada en 6 lugares independientes — `escaladores-buzon.sh:74`, `vigilancia-check.sh`
# (filtro de mail fresco, grep de contratos sin dueño, loop de roles) y `no-ocio-check.sh` (2
# loops). Cada uno asumía `[a-z]+`, que NO matchea dígitos.
#
# Medido antes de tocar nada, con el parser real:
#     -a-frontend_   -> 'frontend'   ✅
#     -a-frontend1_  -> ''           ❌  y `${para:-todos}` lo reescribe a "todos"
#     frontend1-a-…  -> ''           ❌  (el campo EMISOR tiene el mismo defecto)
#
# O sea: al desdoblar frontend en dos sesiones, un mensaje a `frontend1` no desaparecía con un
# error — se re-dirigía SOLO a `todos`. Un vacío que no protesta, disfrazado de mensaje válido.
#
# La regla vive acá y nada más que acá. Agregar una sesión nueva = tocar ROLES_BUZON y su fila en
# lee_patrones(); si hace falta tocar un script consumidor, el diseño falló.
#
# ⚠️ Y «nada más que acá» era FALSO hasta el 2026-10-12: el bloque SIN DUEÑO de
# `vigilancia-check.sh` envolvía la regex de esta lib en su PROPIO
# `([a-z0-9-]*-y-)?<rol>(-y-[a-z0-9-]*)?`, que cazaba 2 de las 3 formas compuestas. La frase de
# arriba describía la intención, no el código — y leído como estado apagó la búsqueda del próximo.
# Hoy ese consumidor llama `me_interpela()` y la envoltura no existe; el `spike.sh` de
# `spikes/buzon-destino-compuesto/` mide los dos consumidores contra los mismos 12 casos, así que
# una tercera lógica vuelve a poner el spike y `test-vigilancia-rol-ausente` caso 8 en rojo.

# Destinatarios válidos. `frontend` sobrevive como BROADCAST a frontend1+frontend2, igual que
# `todos` cubre a las cuatro — no es un rol muerto, es el "para las dos" del frente de UI.
ROLES_BUZON=(planificacion backend frontend1 frontend2 manejo-de-errores auditoria)

# Roles que existen SÓLO como broadcast: nadie firma como ellos, pero se les puede escribir.
ROLES_BROADCAST_BUZON=(frontend todos)

# es_broadcast_buzon <rol> — ¿ese destinatario es un broadcast? Salio de que ROLES_BROADCAST_BUZON
# estaba declarado arriba desde el 2026-09-07 y NINGUN consumidor lo leia (medido con grep -rn el
# 2026-09-29: 1 solo hit, su propia declaracion). Una tabla que nadie consulta no es una fuente
# unica, es documentacion: el escalador seguia tratando `a-todos` como un destinatario mas.
es_broadcast_buzon() {
  local r="$1" b
  for b in "${ROLES_BROADCAST_BUZON[@]}"; do [ "$r" = "$b" ] && return 0; done
  return 1
}

# roles_de_broadcast <broadcast> [emisor] — expande un broadcast a los roles REALES que lo heredan,
# uno por linea, excluyendo al emisor (nadie se escala a si mismo). Es la inversa de lee_patrones():
# esa contesta «¿este archivo es para mi?» y esta «¿a quienes interpela este archivo?». Las dos
# salen de la misma tabla a proposito — si divergen, un mensaje aparece en un gate y no en el otro.
roles_de_broadcast() {
  local bc="$1" emisor="${2:-}" r
  for r in "${ROLES_BUZON[@]}"; do
    [ "$r" = "$emisor" ] && continue
    case "$bc" in
      todos)    printf '%s\n' "$r" ;;
      frontend) case "$r" in frontend1|frontend2) printf '%s\n' "$r" ;; esac ;;
    esac
  done
}

# roles_declarados_en <archivo> — los roles que EL CONTRATO declara con una línea `ROLES:`,
# uno por línea, o nada si no la declara o si ninguno es válido.
#
# Por qué existe (FACTID, 2026-09-29): `roles_de_broadcast` contesta «¿a quiénes ALCANZA este
# broadcast?», que no es la misma pregunta que «¿quiénes tienen que reportar?». FACTID declaraba
# tres piezas —core, web, mobile— y el escalador exigía un reporte también a
# `manejo-de-errores`, que no tenía ninguna. La única forma de apagar ese `urgente_` era que esa
# sesión reportara sobre trabajo que no era suyo: pedirle que afirme algo que no midió.
#
# El ancla tolera el markdown real —`**ROLES:**`, `> _ROLES_:`, con backticks— porque el mismo
# archivo ya pagó ese error dos veces con `^DISPARADOR:`, que no matcheaba
# `**DISPARADOR: pendiente.**` y por eso la regla existía y no disparó NUNCA.
#
# Un rol desconocido se DESCARTA, nunca se devuelve: un `urgente_` dirigido a un rol inexistente
# no lo lee nadie. Y si la línea no deja ningún rol válido, se devuelve vacío para que el
# llamador caiga al comportamiento por defecto — un typo no puede apagar el escalador para un
# contrato. Escalar de más cuesta ruido; escalar de menos pierde el contrato.
# Prefijo `ROLES:` con su adorno de markdown. Mismo ERE que usaba el `sed -E`, en una variable
# porque `[[ =~ ]]` entre comillas compara como cadena y sin comillas lo parte el shell.
ROLES_PREFIJO_RE='^[[:space:]>*_-]*[Rr][Oo][Ll][Ee][Ss][[:space:]*_]*:?(.*)$'

roles_declarados_en() {
  local f="$1" linea crudo tok r valido
  [ -f "$f" ] || return 0
  # El adorno puede ir ANTES de los dos puntos (`_ROLES_:`) y el valor venir con backticks
  # (`` `backend` ``). El patrón de `DISPARADOR:?` no sirve tal cual: ahí los dos puntos van pegados
  # al nombre. Cuarta vuelta del mismo error en este archivo, así que el ancla se prueba, no se
  # supone -- el caso 3 del test es exactamente esta línea.
  linea="$(grep -m1 -iE '^[[:space:]>*_-]*ROLES[[:space:]*_]*:?[[:space:]*_`]*[a-z]' "$f" 2>/dev/null)" || return 0
  [ -n "$linea" ] || return 0
  # Todo lo que sigue a los dos puntos, con los adornos de markdown y los separadores a espacios.
  # Era `printf | sed | tr | tr` (5 procesos por archivo). Con un buzon de 3300 .md eso costaba
  # ~10 s de los 67 s de `vigilancia-check.sh`, que el gate de lint invoca ~20 veces (medido
  # 2026-10-16). El ERE es el MISMO que tenia el sed; los dos `tr` son clases de glob, no regex.
  # Si la linea no matchea el ancla de extraccion se usa entera, igual que el sed sin match.
  if [[ "$linea" =~ $ROLES_PREFIJO_RE ]]; then crudo="${BASH_REMATCH[1]}"; else crudo="$linea"; fi
  crudo="${crudo//[\`*_]/}"
  crudo="${crudo//[,;\/]/ }"
  for tok in $crudo; do
    valido=0
    for r in "${ROLES_BUZON[@]}"; do [ "$tok" = "$r" ] && valido=1 && break; done
    [ "$valido" = "1" ] && printf '%s\n' "$tok"
  done
}

# Charclass del campo emisor/destinatario. Incluye dígitos (frontend1) y guiones para los
# destinatarios compuestos que el buzón ya usaba (`-a-backend-y-frontend_`, `manejo-de-errores`).
BUZON_ROL_RE='[a-z0-9-]+'

# DESTINATARIOS COMPUESTOS (2026-10-12). El buzon ya emitia nombres con MAS DE UN destinatario
# -- `-a-planificacion-y-backend_`, `-a-backend-y-planificacion_`,
# `-a-planificacion-backend-y-frontend2_` -- y la mitad LECTORA no los repartia. El agujero vivia
# en el PAR: `destinatario_de_nombre()` los extrae bien (su comentario de arriba los nombra) y
# `lee_patrones()` emitia solo `*-a-<rol>_*`, que no caza ninguno.
#
# Medido con `spikes/buzon-destino-compuesto/spike.sh`, 12 casos reales + negativos:
#     lee_patrones + glob            5 fallos de 12  (pierde TODOS los compuestos)
#     rol_regex + la regex inline    2 fallos de 12  (pierde el compuesto de 3, y `-a-todos_`)
# CERO falsos positivos en los dos => el defecto era puro SILENCIO, y por eso no dio sintoma.
# Efecto medido ese dia: 9 mensajes de `abierto/` invisibles para el filtro de planificacion, uno
# de ellos un `urgente_`, el mas viejo de 5 dias.
#
# Se arregla el LECTOR, no la convencion: renombrar los compuestos ya emitidos seria MAYOR y
# romperia las citas. El lector tolera lo que la convencion ya produce.
#
# EL TOKEN SE ANCLA AL SEPARADOR, no se busca como substring: `-a-frontend1_` NO es para
# `frontend`, y solo el anclaje en `-`/`_` distingue esos dos. Un `grep frontend` los confunde.

# rol_alternacion_destino <rol> -- regex del CAMPO DESTINATARIO completo que le llega a <rol>: el
# rol solo, en cualquier posicion de un compuesto, mas los broadcast que hereda. Pensada para
# usarse SIEMPRE anclada entre `-a-` y `_`; sin esas anclas el token deja de estar delimitado.
rol_alternacion_destino() {
  local s="$1" extra=""
  case "$s" in
    frontend1|frontend2) extra="|([a-z0-9-]*-)?frontend(-[a-z0-9-]*)?" ;;
  esac
  printf '(([a-z0-9-]*-)?%s(-[a-z0-9-]*)?%s|todos)' "$s" "$extra"
}

# me_interpela <rol> <ruta-o-basename> -- LA pregunta, en una sola definicion. exit 0 = es para
# <rol>. Un nombre fuera de convencion devuelve 1 y NO se asume `todos`: ese default silencioso es
# el defecto que pario esta lib el 2026-09-07.
declare -gA _ME_INTERPELA_RE=()   # patron por rol: rol_alternacion_destino() es pura

me_interpela() {
  local rol="$1" b
  # Eran 3 forks por llamada (`basename`, el pipe `printf|grep`, y el `$(rol_alternacion_destino)`)
  # y el consumidor la llama una vez por archivo del buzon. Medido 2026-10-16: ~9 s de los 67 s de
  # `vigilancia-check.sh`. Equivalencias: `${2##*/}` == `basename --` para rutas sin barra final
  # (las del buzon son archivos); `${b,,}` + ERE sin `-i` == `grep -qiE`, porque el patron solo
  # tiene las clases [0-9-] y [a-z0-9-]; `[[ =~ ]]` usa el mismo ERE que `grep -E`.
  [ -n "${_ME_INTERPELA_RE[$rol]+x}" ] || \
    _ME_INTERPELA_RE[$rol]="^[0-9-]+_[a-z]+_[a-z0-9-]+-a-$(rol_alternacion_destino "$rol")_"
  b="${2##*/}"
  [[ "${b,,}" =~ ${_ME_INTERPELA_RE[$rol]} ]]
}

# lee_patrones <sesion> -- cada patron de nombre que ESA sesion debe leer, en forma de GLOB, para
# los consumidores que usan `find -iname`. Sale de la misma tabla que rol_alternacion_destino():
# si divergen, el mensaje se pierde en el consumidor que quedo atras -- que es justo lo que paso.
#
# OJO: un glob no tiene alternacion ni anclaje de token, asi que las cuatro posiciones van por
# separado, y `find -iname` deja que `*` cruce el `_`. Esta forma es mas LAXA que me_interpela():
# puede dar un falso positivo si el SLUG contiene `-a-<rol>_`. Preferir me_interpela() donde se
# pueda; el glob existe para no reescribir los consumidores que ya filtran con find.
lee_patrones() {
  local s="$1"
  printf '%s
' "*-a-${s}_*" "*-a-${s}-*_*" "*-a-*-${s}_*" "*-a-*-${s}-*_*"
  case "$s" in
    frontend1|frontend2)                                      # el broadcast del frente de UI
      printf '%s
' '*-a-frontend_*' '*-a-frontend-*_*' '*-a-*-frontend_*' '*-a-*-frontend-*_*' ;;
  esac
  printf '%s
' '*-a-todos_*'
}

# destinatario_de_nombre <basename> — extrae el destinatario. Devuelve '' si el nombre no sigue la
# convención (caso legítimo: hay que reportarlo, NUNCA sustituirlo por un default silencioso).
destinatario_de_nombre() {
  local b="${1%.md}"
  printf '%s' "$b" | sed -nE "s/^[0-9-]+_[a-z]+_${BUZON_ROL_RE}-a-(${BUZON_ROL_RE})_.*/\1/p"
}

# emisor_de_nombre <basename> — la mitad simétrica, la que faltaba por completo.
emisor_de_nombre() {
  local b="${1%.md}"
  printf '%s' "$b" | sed -nE "s/^[0-9-]+_[a-z]+_(${BUZON_ROL_RE})-a-${BUZON_ROL_RE}_.*/\1/p"
}

# firma_patrones <rol> — patrones de nombre que cuentan como FIRMA (señal de vida) de <rol>.
# Simétrico a lee_patrones(), pero del lado del EMISOR, y por la misma razón: si frontend1 sólo
# reconociera `frontend1-a-*`, todo el buzón histórico firmado `frontend-a-*` dejaría de contar y
# las dos sesiones aparecerían muertas. El bloque "SIN DUEÑO" nació justamente para no acusar en
# falso (ver su comentario: "frontend estaba trabajando y el script lo dio por ausente"), así que
# ante la ambigüedad de una firma vieja se cuenta para las dos — un falso negativo acá es callarse,
# un falso positivo es acusar, y sólo el segundo desarma el gate.
firma_patrones() {
  local s="$1"
  # `frontend` es BROADCAST, no un emisor: NADIE firma `frontend-a-`. Medido 2026-09-23 sobre 353
  # mensajes del buzón: `frontend1-a-` 64 · `frontend2-a-` 56 · `frontend-a-` **0**. Pedirle la
  # firma devolvía un patrón que no matchea a nadie, el `find` daba 0 archivos y `no-ocio-check.sh`
  # lo leía como "buzón mudo" -> centinela -> DEAD-MAN falso sobre frontend1 mientras tenía 11
  # archivos commiteados. El desdoble frontend1/frontend2 arregló el lado DESTINATARIO
  # (lee_patrones) y dejó el lado EMISOR contestando por un rol que no escribe nunca.
  if [ "$s" = "frontend" ]; then
    printf '%s
' '*_frontend1-a-*' '*_frontend2-a-*' '*_frontend-a-*'
    return
  fi
  printf '%s
' "*_${s}-a-*"
  case "$s" in
    frontend1|frontend2) printf '%s
' '*_frontend-a-*' ;;   # firmas previas al desdoble
  esac
}

# rama_patrones <rol> — prefijos de rama git que SÓLO puede haber creado <rol>. Tercera vista de la
# misma tabla, para la señal de vida que el buzón no ve.
#
# POR QUÉ (2026-09-21): las tres sesiones comparten UN slug de transcripts
# (`c--Proyectos-Claude-…-copiloto-emprendedor`), así que la sonda de `vigilancia-check.sh`
# que busca el rol en el PATH del `.jsonl` no puede matchear jamás — le queda sólo el buzón. A las
# 14:40 el gate acusó "BACKEND no da señal desde las 13:40" mientras backend tenía un merge de 9
# min y un commit de 51 segundos: escribía código en vez de escribir mensajes, que es exactamente
# lo que se le pidió. Las ramas sí nombran el rol y viven en el `.git` COMPARTIDO por los 14
# worktrees, así que un `for-each-ref` local las ve todas, sin red.
#
# ⚠️ El sentido del riesgo se INVIERTE respecto de firma_patrones(): esa señal, al encontrarse,
# CALLA la alarma. Un patrón laxo no acusa en falso — ciega el gate, que es peor y además
# silencioso. Por eso acá sólo van prefijos inequívocos: ante ambigüedad NO se cuenta (se sigue
# alarmando, que es el lado recuperable). En particular quedan afuera `main`, los `fix/…`/`chore/…`
# sin rol, y el `frontend/` heredado, que no distingue frontend1 de frontend2.
rama_patrones() {
  case "$1" in
    backend)   printf '%s\n' 'backend/' ;;
    frontend1) printf '%s\n' 'fe1/' 'feat/fe1-' 'fix/fe1-' 'frontend1/' ;;
    frontend2) printf '%s\n' 'fe2/' 'feat/fe2-' 'fix/fe2-' 'frontend2/' ;;
    auditoria) printf '%s\n' 'aud/' 'auditoria/' ;;
    *)         : ;;   # planificacion y manejo-de-errores no tienen prefijo propio: sin señal
  esac
}
