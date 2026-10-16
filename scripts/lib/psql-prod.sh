#!/usr/bin/env bash
# Lib: acceso READ-ONLY a la base de la instancia viva, por ssh, sin que la credencial se imprima.
#
# POR QUÉ EXISTE (y por qué es una lib y no una copia)
# ----------------------------------------------------
# Extraída de `scripts/evidencia/contar-filas-prod.sh` el 2026-10-16, cuando hizo falta un SEGUNDO
# script con el mismo mecanismo (diagnóstico por tenant). La alternativa era un gemelo autocontenido,
# y este repo ya pagó ese patrón: un fix llega a una de las dos copias y la otra sigue rota sin dar
# síntoma (`memoria/dos-implementaciones-del-mismo-cliente-el-fix-llega-a-una.md`). El mecanismo de
# acceso a producción es exactamente el tipo de código que no puede vivir dos veces.
#
# QUÉ VIVE ACÁ Y QUÉ **NO**
# -------------------------
# Acá vive el MECANISMO: resolver el DSN del proceso vivo, mandar SQL por ssh, y los guards.
# NO vive el ALCANCE: el host, la unidad y las tablas se quedan en cada script llamador, a propósito.
# Razón: el permiso del harness apunta al script llamador (`Bash(bash scripts/<x>.sh:*)`), así que su
# alcance tiene que ser legible EN ÉL. Si el host viviera acá, dos permisos distintos tendrían su
# alcance real en un archivo que ninguno de los dos nombra — y un alcance que no se lee donde se
# otorga el permiso no es un alcance.
#
# CÓMO SE USA
#   source "$(dirname "${BASH_SOURCE[0]}")/../lib/psql-prod.sh"
#   prod_guard_host "$HOST"                  # corta si la constante tiene forma de flag
#   prod_guard_una_linea "$VALOR"            # corta si un valor de afuera trae newline o control
#   prod_guard_readonly "$sql"               # corta si el SQL armado trae un verbo de escritura
#   prod_psql "$HOST" "$UNIT" [-v n=v]… "$sql"…
#
# Códigos de salida (los mismos que tenía el script original, para no romper a sus llamadores):
#   2 = host o valor inválido · 3 = el SQL contiene escritura · 4 = el remoto no tiene DATABASE_URL

# Guard de forma del destino. Cinturón además de tirantes: `prod_psql` ya usa `--` antes del host,
# pero esto corta ANTES y con un mensaje propio si alguien edita mal la constante en el futuro.
# Sin el `--`, un valor que empieza con `-` lo lee ssh como flag, y `-oProxyCommand=…` ejecuta un
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
# `grep -qE '^…$'` evalúa **línea por línea** y devuelve 0 si ALGUNA línea matchea. Un valor como
#   $'a@b.com\n'"' or 1=1--"
# pasa el validador con su primera línea y arrastra el payload en la segunda. Reproducido: el SQL
# emitido contenía `' or 1=1--`. Es **la misma clase de defecto** que este repo ya documentó en
# `deploy/worker/provision_tables.py` para Python («validar con re.fullmatch, NO .match: `$` matchea
# ANTES de un `\n` final»), y reapareció acá porque el ancla `^…$` *parece* anclar el valor entero.
#
# Mi propio test salía 19/19 sin verlo: probé nueve inyecciones y ninguna traía un newline. El
# control positivo cubrió la mitad que sospechaba y la otra quedó muda.
prod_guard_una_linea() {
  local valor="${1-}" etiqueta="${2-valor}"
  # `$'\n'` y `$'\r'` explícitos, más cualquier otro carácter de control.
  case "$valor" in
    *$'\n'*|*$'\r'*)
      echo "ABORTA: $etiqueta contiene un salto de línea. Un validador con ^…\$ lo aceptaría por su" >&2
      echo "        primera línea y el resto entraría al SQL." >&2
      return 2 ;;
  esac
  if printf '%s' "$valor" | LC_ALL=C grep -q '[[:cntrl:]]'; then
    echo "ABORTA: $etiqueta contiene caracteres de control" >&2; return 2
  fi
  return 0
}

# Guard de sólo-lectura sobre el SQL ya armado. Es UNA de las tres barreras, y la más débil de las
# tres: es un grep de verbos, así que sólo caza lo que enumera. Las otras dos son estructurales y no
# dependen de enumerar nada: el selector viaja como VARIABLE de psql (`-v` + `:'var'`), nunca como
# texto SQL, y la sesión remota abre con `default_transaction_read_only=on`, que hace que el motor
# rechace la escritura aunque el grep no la haya visto.
# Un mecanismo roto hacia el «no» no da síntoma —en el uso normal el SQL nunca trae escrituras, así
# que el camino feliz sale verde con el guard presente o ausente—, por eso cada llamador tiene un
# control POSITIVO que lo ve disparar (`scripts/tests/test-*.sh`).
prod_guard_readonly() {
  local sql="${1-}"
  if echo "$sql" | grep -qi -E '\b(insert|update|delete|drop|truncate|alter|create|grant|copy)\b'; then
    echo "ABORTA: el SQL armado contiene un verbo de escritura. Este acceso es read-only." >&2
    return 3
  fi
  return 0
}

# Ejecuta SQL contra la base de la instancia viva.
#
# La `DATABASE_URL` se lee del `/proc/<MainPID>/environ` del proceso systemd y se usa DENTRO del
# shell remoto: nunca viaja por la línea de comandos local, nunca se imprime, y no hace falta tener
# una copia de la credencial en esta máquina. Es el mismo patrón que usan los 12 scripts de
# `deploy/copiloto/*.py`, que corren en el VPS y heredan el env del proceso.
#
# Acepta `-v nombre=valor` (repetible) antes del SQL: ésa es la vía para todo lo que venga de afuera.
# En el SQL se referencia como `:'nombre'`, y psql lo interpola como literal correctamente escapado,
# así que el valor **nunca es parte del texto SQL** y no hay inyección posible por su contenido.
# Un selector interpolado a mano en la cadena sí la tendría — es lo que había acá antes del fix.
#
# `PGOPTIONS=-c default_transaction_read_only=on` abre la sesión en sólo-lectura del lado del MOTOR.
# Es la barrera que no depende de enumerar verbos: `set_config()` y los `select` siguen funcionando
# (no escriben datos), y cualquier escritura la rechaza Postgres.
#
# Los SQL van como `-c` separados pero en UNA transacción, así un `set_config(...)` del primero sigue
# vigente en los siguientes — que es lo que exige RLS para ver las filas de un tenant.
prod_psql() {
  local host="$1" unit="$2"; shift 2
  local q="'" esc="'\\''"
  local vars=""
  while [ "${1-}" = "-v" ]; do
    vars="$vars -v '${2//$q/$esc}'"
    shift 2
  done
  local remoto='P=$(systemctl show -p MainPID --value '"$unit"'); \
   if [ -z "$P" ] || [ "$P" = "0" ]; then echo "'"$unit"' no está corriendo" >&2; exit 4; fi; \
   DB=$(tr "\0" "\n" < /proc/$P/environ | grep "^DATABASE_URL=" | cut -d= -f2-); \
   if [ -z "$DB" ]; then echo "SIN DATABASE_URL en el proceso" >&2; exit 4; fi; \
   PGOPTIONS="-c default_transaction_read_only=on" \
   psql "$DB" -v ON_ERROR_STOP=1 --single-transaction -t -A -F" | "'"$vars"
  # El SQL va entre comillas simples en el shell remoto, así que una comilla simple embebida se
  # cierra con el truco POSIX  '\''  . Se hace con expansión de bash y NO con sed a propósito: la
  # v1 usaba `sed` y la capa extra de escapes se comía el backslash, así que cada comilla llegaba
  # como ''' — que el shell colapsa a NADA y dejaba el SQL sin sus literales:
  # `set_config(request.jwt.claims, json_build_object(cliente_id,…))`, identificadores que no
  # existen. Lo cazó el control de armado con un ssh y un psql falsos, no la lectura del código.
  # Patrón: `memoria/un-escape-que-pasa-por-una-capa-extra-llega-como-byte-invisible.md`.
  local frag
  for frag in "$@"; do
    remoto="$remoto -c '${frag//$q/$esc}'"
  done
  ssh -o ConnectTimeout=15 -o BatchMode=yes -- "$host" "$remoto"
}
