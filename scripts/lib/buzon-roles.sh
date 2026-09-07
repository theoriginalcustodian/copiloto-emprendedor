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

# Destinatarios válidos. `frontend` sobrevive como BROADCAST a frontend1+frontend2, igual que
# `todos` cubre a las cuatro — no es un rol muerto, es el "para las dos" del frente de UI.
ROLES_BUZON=(planificacion backend frontend1 frontend2 manejo-de-errores auditoria)

# Roles que existen SÓLO como broadcast: nadie firma como ellos, pero se les puede escribir.
ROLES_BROADCAST_BUZON=(frontend todos)

# Charclass del campo emisor/destinatario. Incluye dígitos (frontend1) y guiones para los
# destinatarios compuestos que el buzón ya usaba (`-a-backend-y-frontend_`, `manejo-de-errores`).
BUZON_ROL_RE='[a-z0-9-]+'

# lee_patrones <sesion> — imprime, uno por línea, cada patrón de nombre que ESA sesión debe leer.
# Es la respuesta a "¿este archivo es para mí?" y la única definición de la herencia de broadcast.
lee_patrones() {
  local s="$1"
  printf '%s\n' "*-a-${s}_*"
  case "$s" in
    frontend1|frontend2) printf '%s\n' '*-a-frontend_*' ;;   # el broadcast del frente de UI
  esac
  printf '%s\n' '*-a-todos_*'
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

# rol_regex_buzon <rol> — alternación regex de los destinatarios que le llegan a <rol>, incluyendo
# los broadcast que hereda. Es lee_patrones() en forma de regex, para los consumidores que grepean
# nombres en vez de glob-matchear. Las dos vistas salen de la misma tabla: si divergen, el mensaje
# aparece en un gate y no en el otro, que es peor que no tener gate.
rol_regex_buzon() {
  case "$1" in
    frontend1|frontend2) printf '(%s|frontend)' "$1" ;;
    *)                   printf '%s' "$1" ;;
  esac
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
  printf '%s\n' "*_${s}-a-*"
  case "$s" in
    frontend1|frontend2) printf '%s\n' '*_frontend-a-*' ;;   # firmas previas al desdoble
  esac
}
