#!/usr/bin/env bash
# Lib: acceso READ-ONLY a la base de la instancia viva, por ssh, sin que la credencial se imprima.
#
# POR QUÉ EXISTE (y por qué es una lib y no una copia)
# ----------------------------------------------------
# Extraída de `scripts/evidencia/contar-filas-prod.sh` el 2026-10-16, cuando hizo falta un SEGUNDO
# script con el mismo mecanismo (diagnóstico por tenant). La alternativa era un gemelo autocontenido,
# y este repo ya pagó ese patrón: un fix llega a una de las dos copias y la otra sigue rota sin dar
# síntoma (`memoria/dos-implementaciones-del-mismo-cliente-el-fix-llega-a-una.md`). El mecanismo de
# acceso a producción es exactamente el tipo de código que no puede vivir dos veces — y la prueba
# llegó el mismo día: el defecto de abajo estaba en LOS DOS scripts y se arregló una sola vez.
#
# POR QUÉ YA NO ES `psql` — y el control que faltaba (medido 2026-10-16)
# ----------------------------------------------------------------------
# Esta lib nació mandando SQL a un `psql` en el shell remoto. **En el VPS no hay psql**: no está en
# el PATH, no está el paquete `postgresql-client`, y la base tampoco es local —vive en
# `10.0.0.3:5432`, otro nodo de la red privada—, así que no hay contenedor con el cliente adentro.
#
#     bash: line 5: psql: command not found      (exit 127)
#
# O sea que `contar-filas-prod.sh`, que estrenó este mecanismo el 2026-10-11, **nunca pudo ejecutar
# su camino feliz**, y nadie lo notó: tenía 6 controles verdes y dos documentos citándolo. Los 6
# ejercitaban los RECHAZOS (host con forma de flag, fuente con un verbo de escritura, valor con un
# newline) y el ARMADO (`--dry-run`, que imprime el SQL y no sale a la red). Ninguno lo corrió una
# vez contra el host — y ése era el único control capaz de ver el 127.
#   👉 Un corpus que cubre los rechazos y el armado puede estar completo y no haber tocado nunca el
#      camino que el script existe para recorrer. Para un script de acceso remoto, el control que
#      vale es UNA corrida real; los demás miden cómo se arma, no que llegue.
#
# El cliente que sí existe es el **intérprete de la propia unidad** (psycopg2 2.9.12, el mismo que usa
# la app). Y no es un reemplazo a la fuerza: elimina dos capas de escape. Con psql el SQL cruzaba
# `bash -> ssh -> sh remoto -> psql`, y esa cadena ya había producido un defecto real —las comillas
# llegaban como `'''`, que el shell colapsa a nada, y el SQL perdía sus literales—. Acá el fuente
# Python viaja por **stdin** (ninguna capa lo reescribe) y los valores de afuera viajan como
# **parámetros de libpq** (`%s`), no como texto SQL: el contenido de un valor no puede cambiar la
# consulta ni siquiera en principio.
#
# QUÉ VIVE ACÁ Y QUÉ **NO**
# -------------------------
# Acá vive el MECANISMO: resolver el intérprete y el DSN del proceso vivo, mandar el fuente por ssh,
# y los guards. NO vive el ALCANCE: el host, la unidad y las tablas se quedan en cada script
# llamador, a propósito. Razón: el permiso del harness apunta al script llamador
# (`Bash(bash scripts/<x>.sh:*)`), así que su alcance tiene que ser legible EN ÉL. Si el host viviera
# acá, dos permisos distintos tendrían su alcance real en un archivo que ninguno de los dos nombra —
# y un alcance que no se lee donde se otorga el permiso no es un alcance.
#
# CÓMO SE USA
#   source "$(dirname "${BASH_SOURCE[0]}")/../lib/db-prod.sh"
#   prod_guard_host "$HOST"                  # corta si la constante tiene forma de flag
#   prod_guard_una_linea "$VALOR"            # corta si un valor de afuera trae newline o control
#   prod_guard_readonly "$fuente_py"         # corta si el fuente trae un verbo de escritura
#   prod_py "$HOST" "$UNIT" "$PROD_PY_PREAMBULO$mi_py" "$selector"...
#
# Códigos de salida (los mismos de siempre, para no romper a los llamadores):
#   2 = host o valor inválido · 3 = el fuente contiene escritura · 4 = el remoto no está utilizable

# Guard de forma del destino. Cinturón además de tirantes: `prod_py` ya usa `--` antes del host,
# pero esto corta ANTES y con un mensaje propio si alguien edita mal la constante en el futuro.
# Sin el `--`, un valor que empieza con `-` lo lee ssh como flag, y `-oProxyCommand=...` ejecuta un
# comando arbitrario en ESTA máquina.
prod_guard_host() {
  local host="${1-}"
  case "$host" in
    -*|*[!A-Za-z0-9.-]*|'')
      echo "ABORTA: host inválido o con forma de flag: '$host'" >&2; return 2 ;;
  esac
  return 0
}

# Guard de UNA SOLA LÍNEA para cualquier valor que venga de afuera.
#
# POR QUÉ EXISTE — lo encontró una revisión de seguridad el 2026-10-16, sobre código mío del día:
# `grep -qE '^...$'` evalúa **línea por línea** y devuelve 0 si ALGUNA línea matchea. Un valor como
#   $'a@b.com\n'"' or 1=1--"
# pasaba el validador con su primera línea y arrastraba el payload en la segunda. Es **la misma clase
# de defecto** que este repo ya documentó en `deploy/worker/provision_tables.py` para Python
# («validar con re.fullmatch, NO .match: `$` matchea ANTES de un `\n` final»), y reapareció acá
# porque el ancla `^...$` *parece* anclar el valor entero.
#
# Hoy el selector además viaja como parámetro de libpq, así que su contenido ya no puede ser SQL.
# Este guard sigue porque el valor también cruza una línea de comandos remota: es la barrera de esa
# capa, no de la de SQL.
prod_guard_una_linea() {
  local valor="${1-}" etiqueta="${2-valor}"
  case "$valor" in
    *$'\n'*|*$'\r'*)
      echo "ABORTA: $etiqueta contiene un salto de línea. Un validador con ^...\$ lo aceptaría por su" >&2
      echo "        primera línea y el resto seguiría viaje." >&2
      return 2 ;;
  esac
  if printf '%s' "$valor" | LC_ALL=C grep -q '[[:cntrl:]]'; then
    echo "ABORTA: $etiqueta contiene caracteres de control" >&2; return 2
  fi
  return 0
}

# Guard de sólo-lectura sobre el fuente que se va a ejecutar. Es la MÁS DÉBIL de las tres barreras y
# la más grosera: un grep de verbos sólo caza lo que enumera, y acá corre sobre el fuente Python
# completo (comentarios incluidos), no sobre un SQL aislado. Se queda igual porque corta temprano y
# con un mensaje propio, pero la barrera que de verdad impide escribir es la del MOTOR, en
# `conectar()`: `default_transaction_read_only=on` no depende de enumerar nada.
#
# Un mecanismo roto hacia el «no» no da síntoma —en el uso normal el fuente nunca trae escrituras,
# así que el camino feliz sale verde con el guard presente o ausente—, por eso cada llamador tiene un
# control POSITIVO que lo ve disparar (`scripts/tests/test-*.sh`).
prod_guard_readonly() {
  local sql="${1-}"
  if echo "$sql" | grep -qi -E '\b(insert|update|delete|drop|truncate|alter|grant)\b'; then
    echo "ABORTA: el fuente contiene un verbo de escritura. Este acceso es read-only." >&2
    return 3
  fi
  return 0
}

# Preámbulo Python que todo llamador concatena delante de su propio fuente. Vive acá porque ES el
# mecanismo: resolver el DSN y abrir la sesión en sólo-lectura.
#
# La `DATABASE_URL` se lee del `/proc/<MainPID>/environ` del proceso systemd, DENTRO del remoto:
# nunca viaja por la línea de comandos, nunca se imprime, y no hace falta una copia de la credencial
# en esta máquina. Es el mismo patrón de los 12 scripts de `deploy/copiloto/*.py`, que corren en el
# VPS y heredan el env del proceso.
#
# Sin comillas simples a propósito: la variable se define entre comillas simples en bash, así que una
# comilla simple en el fuente la cortaría. Es un límite del transporte, no un gusto de estilo.
PROD_PY_PREAMBULO='import json
import os
import sys

import psycopg2


def _dsn():
    pid = os.environ["UC_PID"]
    with open("/proc/%s/environ" % pid, "rb") as fh:
        for ent in fh.read().split(b"\0"):
            if ent.startswith(b"DATABASE_URL="):
                return ent.split(b"=", 1)[1].decode()
    sys.exit("SIN DATABASE_URL en el proceso")


def conectar():
    return psycopg2.connect(_dsn(), options="-c default_transaction_read_only=on")


def imprimir(filas):
    for que, valor in filas:
        sys.stdout.write("%s | %s\n" % (que, valor))
'

# Ejecuta un fuente Python contra la base de la instancia viva, con el intérprete de la unidad.
#
# El fuente va por **stdin** del ssh: ninguna capa de shell lo reescribe, que es justamente lo que
# rompía el SQL cuando iba por `-c` entre comillas. Los argumentos extra llegan como `sys.argv[1:]`
# y el llamador los pasa a `cur.execute(sql, params)` — parámetros de libpq, nunca texto SQL.
#
# El intérprete NO está hardcodeado: sale del `ExecStart` de la unidad, así que si el venv cambia de
# lugar el mecanismo lo sigue. Un path fijo acá sería la próxima versión de este mismo bug.
prod_py() {
  local host="$1" unit="$2" fuente="$3"; shift 3
  local q="'" esc="'\\''" args="" a
  for a in "$@"; do
    args="$args '${a//$q/$esc}'"
  done
  local remoto='set -e
P=$(systemctl show -p MainPID --value '"$unit"')
if [ -z "$P" ] || [ "$P" = "0" ]; then echo "'"$unit"' no esta corriendo" >&2; exit 4; fi
EXEC=$(systemctl show -p ExecStart --value '"$unit"')
PY=${EXEC#*path=}
PY=${PY%% *}
if [ ! -x "$PY" ]; then echo "el interprete de la unidad no es ejecutable: [$PY]" >&2; exit 4; fi
UC_PID=$P exec "$PY" -I -'"$args"
  printf '%s' "$fuente" | ssh -o ConnectTimeout=15 -o BatchMode=yes -- "$host" "$remoto"
}
