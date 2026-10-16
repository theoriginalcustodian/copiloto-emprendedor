#!/usr/bin/env bash
# Cuenta filas de un conjunto FIJO de tablas en la instancia viva, para dimensionar hallazgos.
#
# POR QUÉ EXISTE Y POR QUÉ ES UN SCRIPT Y NO UN COMANDO SUELTO
# ------------------------------------------------------------
# El 2026-10-11, al armar el backlog del sprint «app lista para un usuario», hizo falta saber si el
# defecto de MercadoPago (el mismo cobro contado cero veces en Ingresos y dos en «Entró») estaba
# dañando dinero HOY o era latente. La respuesta es un COUNT. El clasificador de permisos negó la
# lectura, con razón: autorizar SQL arbitrario abre TODO sobre la instancia viva.
#
# Este script existe para que el permiso apunte a algo ACOTADO y AUDITABLE en vez de a SSH libre:
#   - La lista de tablas es fija y vive acá (`CONTEOS`, dentro del fuente), no se toma de la línea
#     de comandos.
#   - El único SQL que emite es `select count(*)` y, cuando se pide, `count(*) where <col> = %s` con
#     el valor como parámetro. No hay interpolación de nada que venga de afuera.
#   - El HOST es fijo en el fuente. No hay flag ni env var para cambiarlo (ver abajo).
#   - No acepta argumentos libres: sólo `--dry-run`. Cualquier otro ⇒ exit 2.
#   - No imprime nunca la `DATABASE_URL` (la lee del environ del proceso vivo, dentro del remoto).
#
# POR QUÉ EL HOST ES FIJO — la v1 se contradecía, y lo cazó una revisión de seguridad
# ------------------------------------------------------------------------------------
# La v1 aceptaba `--host <h>`, y eso anulaba la razón de existir del script. El patrón del permiso es
# `Bash(bash scripts/evidencia/contar-filas-prod.sh:*)`, y el `:*` cubre CUALQUIER argumento: un
# `--host` libre convertía «contar filas en nuestra instancia» en «SSH a cualquier destino». Peor
# todavía: `ssh -o… "$HOST"` sin `--` delante hace que un valor que empieza con `-` lo lea ssh como
# flag, y `-oProxyCommand=…` ejecuta un comando arbitrario en ESTA máquina.
#
# La lección es la del propio script aplicada a sí mismo: **un sujeto de permiso cuyo alcance depende
# de un argumento no es un sujeto acotado.** Acoté el SQL y dejé abierto el destino, que es la mitad
# que no estaba mirando. Si algún día hay que apuntar a otro host se edita la constante y queda en el
# diff — igual que la lista de tablas.
#
# DOS DEFECTOS QUE VIVIERON ACÁ 5 DÍAS SIN DAR SÍNTOMA (medidos el 2026-10-16)
# ----------------------------------------------------------------------------
# 1. **El script nunca pudo correr.** Mandaba el SQL a un `psql` en el remoto, y en el VPS no hay
#    psql: ni binario, ni paquete, ni contenedor con el cliente (la base vive en otro nodo,
#    `10.0.0.3:5432`). `exit 127`. Tenía 6 controles verdes y dos documentos citándolo, pero los 6
#    ejercitaban los RECHAZOS y el ARMADO (`--dry-run`): ninguno lo corrió una vez contra el host, y
#    ése era el único control capaz de verlo. Hoy usa el intérprete de la propia unidad, vía
#    `scripts/lib/db-prod.sh`.
# 2. **Sus conteos habrían sido 0, y 0 habría pasado por evidencia.** Las tablas tienen RLS y el rol
#    de la conexión NO tiene `BYPASSRLS` (medido: contar `afip_credentials` sin declarar tenant da 0
#    mientras el mismo filtro con tenant declarado devuelve filas en las tablas hermanas). Un script
#    de EVIDENCIA que cuenta sin declarar tenant no devuelve «no hay filas»: devuelve «no te dejan
#    verlas», con el mismo byte. Y un 0 así contesta «el defecto es latente, no urge» — la conclusión
#    más cómoda, que es justo la que hay que desconfiar.
#    Por eso ahora el reporte abre diciendo **el rol y si bypasea RLS**, y marca `[RLS activo]` en
#    cada tabla donde el número está sujeto al control. El riesgo queda en la salida, no en la cabeza
#    de quien la lea.
#
# ES READ-ONLY POR CONSTRUCCIÓN, y eso se verifica en tres capas: el guard de verbos rechaza la
# corrida si el fuente trae una escritura, la sesión abre con `default_transaction_read_only=on` del
# lado del motor, y ningún valor de afuera llega como texto SQL.
#
# Uso:
#   bash scripts/evidencia/contar-filas-prod.sh --dry-run     # imprime el fuente y NO se conecta
#   bash scripts/evidencia/contar-filas-prod.sh               # cuenta contra el host fijo
set -euo pipefail

# El mecanismo de acceso (ssh + intérprete y DSN del proceso vivo + los guards) vive en la lib: es el
# mismo que usa `scripts/diag/estado-tenant-prod.sh`, y código de acceso a producción no puede vivir
# dos veces — cuando resultó estar roto, el fix fue uno y llegó a los dos. Lo que NO está en la lib,
# a propósito, es el ALCANCE: el host, la unidad y la lista de tablas se quedan acá, porque el
# permiso del harness apunta a ESTE archivo y un alcance que no se lee donde se otorga el permiso no
# es un alcance.
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/../lib" && pwd)/db-prod.sh"

# Fijos, a propósito: son el alcance del permiso, no parámetros.
readonly HOST='unreal-copilot'
readonly UNIT='uc-copiloto-web.service'
DRY=0

while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run) DRY=1; shift ;;
    *) echo "argumento no reconocido: $1" >&2
       echo "sólo acepta --dry-run. El host y la lista de tablas son fijos y viven en el script:" >&2
       echo "son el alcance del permiso, y un alcance que se pasa por argumento no es un alcance." >&2
       exit 2 ;;
  esac
done

# Cinturón además de tirantes: aunque HOST sea una constante, el destino nunca puede empezar con `-`
# ni traer metacaracteres. Si esta constante se edita mal en el futuro, corta acá y no en ssh.
prod_guard_host "$HOST" || exit $?

# ---------------------------------------------------------------------------------------------
# El fuente que corre en el remoto. Entre comillas DOBLES de bash, así que dentro usa sólo comillas
# simples y no lleva `$`, backtick ni backslash: cada uno sería una capa de escape más, y la cadena
# de capas es lo que ya rompió este mecanismo una vez (las comillas llegaban como `'''`).
#
# `CONTEOS` es el manifiesto y ES el alcance: cada entrada es
#   (etiqueta, tabla, columna_del_predicado | None, valor_del_predicado | None)
# El valor viaja como parámetro de libpq, nunca como literal en el texto. Para agregar una fila se
# edita acá — única superficie de cambio, y queda en el diff.
# ---------------------------------------------------------------------------------------------
PY_CONTAR="
CONTEOS = (
    ('mp_payments', 'mp_payments', None, None),
    ('copiloto_cobros', 'copiloto_cobros', None, None),
    ('cobros origen=mercadopago', 'copiloto_cobros', 'origen', 'mercadopago'),
    ('comprobantes', 'afip_comprobantes', None, None),
    ('comprobantes estado=NC', 'afip_comprobantes', 'estado', 'nota_credito'),
    ('gastos', 'copiloto_gastos', None, None),
)

ESQUEMA = 'uc_factory'

con = conectar()
cur = con.cursor()
filas = []

# Quien cuenta y si RLS lo limita. Sin esto, un 0 por fail-closed se lee como tabla vacia: el mismo
# byte para 'no hay filas' y 'no te dejan verlas', y la segunda lectura nunca es la que uno elige.
cur.execute('select current_user, (select rolbypassrls from pg_roles where rolname = current_user)')
rol, bypass = cur.fetchone()
if bypass:
    filas.append(('rol de la conexion', str(rol) + ' -- BYPASSRLS: cuenta TODOS los tenants'))
else:
    filas.append(('rol de la conexion', str(rol) + ' -- SIN bypassrls: en las tablas marcadas [RLS'
                  ' activo] el numero esta limitado por la policy y, sin tenant declarado, es 0 por'
                  ' fail-closed, NO por tabla vacia'))

# Que tablas existen y cuales tienen RLS. Un nombre equivocado no da 0: revienta, y el mensaje se
# confunde con cualquier otro fallo.
cur.execute('select table_name from information_schema.tables where table_schema = %s', (ESQUEMA,))
hay = set(r[0] for r in cur.fetchall())

cur.execute('select c.relname, c.relrowsecurity from pg_class c'
            ' join pg_namespace n on n.oid = c.relnamespace where n.nspname = %s', (ESQUEMA,))
con_rls = dict((r[0], r[1]) for r in cur.fetchall())

for etiqueta, tabla, columna, valor in CONTEOS:
    if tabla not in hay:
        filas.append((etiqueta, 'LA TABLA NO EXISTE en el schema ' + ESQUEMA + ' (no es 0 filas)'))
        continue
    # tabla y columna salen del manifiesto literal de arriba y la tabla esta verificada contra
    # information_schema: la concatenacion no toca nada que venga de afuera. El VALOR si podria
    # llevar cualquier cosa, y por eso va como parametro.
    sql = 'select count(*) from ' + ESQUEMA + '.' + tabla
    params = ()
    if columna is not None:
        sql = sql + ' where ' + columna + ' = %s'
        params = (valor,)
    cur.execute(sql, params)
    n = cur.fetchone()[0]
    marca = ' [RLS activo]' if (con_rls.get(tabla) and not bypass) else ''
    filas.append((etiqueta, str(n) + marca))

imprimir(filas)
"

FUENTE="${PROD_PY_PREAMBULO}${PY_CONTAR}"

# Guard de sólo-lectura. Si alguna edición futura mete un verbo de escritura, esto corta ANTES de
# conectarse. Control positivo de este guard: `scripts/tests/test-contar-filas-readonly.sh`.
prod_guard_readonly "$FUENTE" || exit $?

if [ "$DRY" = "1" ]; then
  echo "[dry-run] host=${HOST} unit=${UNIT}"
  echo "[dry-run] fuente python que se enviaría:"
  printf '%s\n' "$FUENTE"
  exit 0
fi

# La URL se lee del environ del proceso vivo DENTRO del remoto y NUNCA se imprime ni viaja por la
# línea de comandos local. El detalle del mecanismo está en la lib.
prod_py "$HOST" "$UNIT" "$FUENTE"
