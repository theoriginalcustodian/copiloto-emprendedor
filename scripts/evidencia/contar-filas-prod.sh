#!/usr/bin/env bash
# Cuenta filas de un conjunto FIJO de tablas en la instancia viva, para dimensionar hallazgos.
#
# POR QUÉ EXISTE Y POR QUÉ ES UN SCRIPT Y NO UN COMANDO SUELTO
# ------------------------------------------------------------
# El 2026-10-11, al armar el backlog del sprint «app lista para un usuario», hizo falta saber si el
# defecto de MercadoPago (el mismo cobro contado cero veces en Ingresos y dos en «Entró») estaba
# dañando dinero HOY o era latente. La respuesta es un COUNT. El clasificador de permisos negó la
# lectura, con razón: autorizar `ssh <host> psql ...` abre TODO el SQL sobre la instancia viva.
#
# Este script existe para que el permiso apunte a algo ACOTADO y AUDITABLE en vez de a SSH libre:
#   - La lista de tablas es fija y vive acá (`TABLAS`), no se toma de la línea de comandos.
#   - El único SQL que emite es `select count(*)` y, cuando se pide, `count(*) where <predicado fijo>`.
#     No hay interpolación de nada que venga de afuera.
#   - El HOST es fijo en el fuente. No hay flag ni env var para cambiarlo (ver abajo).
#   - No acepta argumentos libres: sólo `--dry-run`. Cualquier otro ⇒ exit 2.
#   - No imprime nunca la `DATABASE_URL` (la lee del environ del proceso y la pasa a psql sin echo).
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
# ES READ-ONLY POR CONSTRUCCIÓN, y eso se verifica: el guard de abajo rechaza la corrida si el SQL
# armado contiene cualquier verbo de escritura. No es decoración — es el control que hace que este
# script merezca un permiso que `psql` suelto no merece.
#
# Uso:
#   bash scripts/evidencia/contar-filas-prod.sh --dry-run     # imprime el SQL y NO se conecta
#   bash scripts/evidencia/contar-filas-prod.sh               # cuenta contra el host fijo
set -euo pipefail

# El mecanismo de acceso (ssh + DSN del proceso vivo + los dos guards) vive en la lib: es el mismo
# que usa `scripts/diag/estado-tenant-prod.sh`, y código de acceso a producción no puede vivir dos
# veces. Lo que NO está en la lib, a propósito, es el ALCANCE: el host, la unidad y la lista de
# tablas se quedan acá, porque el permiso del harness apunta a ESTE archivo y un alcance que no se
# lee donde se otorga el permiso no es un alcance.
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/../lib" && pwd)/psql-prod.sh"

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

# Cada entrada: etiqueta | tabla | predicado (vacío = todas las filas).
# Para agregar una fila, se edita ACÁ — es la única superficie de cambio, y queda en el diff.
TABLAS=(
  "mp_payments                  | mp_payments        | "
  "copiloto_cobros              | copiloto_cobros    | "
  "cobros origen=mercadopago    | copiloto_cobros    | origen = 'mercadopago'"
  "comprobantes                 | afip_comprobantes  | "
  "comprobantes estado=NC       | afip_comprobantes  | estado = 'nota_credito'"
  "gastos                       | copiloto_gastos    | "
)

sql=""
for fila in "${TABLAS[@]}"; do
  IFS='|' read -r etiqueta tabla predicado <<< "$fila"
  etiqueta="$(echo "$etiqueta" | sed -e 's/^ *//' -e 's/ *$//')"
  tabla="$(echo "$tabla" | sed -e 's/^ *//' -e 's/ *$//')"
  predicado="$(echo "$predicado" | sed -e 's/^ *//' -e 's/ *$//')"
  donde=""
  [ -n "$predicado" ] && donde=" where ${predicado}"
  [ -n "$sql" ] && sql="${sql} union all "
  sql="${sql}select '${etiqueta}' as que, count(*) as n from ${tabla}${donde}"
done
sql="${sql};"

# Guard de sólo-lectura. Si alguna edición futura mete un verbo de escritura, esto corta ANTES de
# conectarse. Control positivo de este guard: `scripts/tests/test-contar-filas-readonly.sh`.
prod_guard_readonly "$sql" || exit $?

if [ "$DRY" = "1" ]; then
  echo "[dry-run] host=${HOST} unit=${UNIT}"
  echo "[dry-run] SQL que se enviaría:"
  echo "$sql"
  exit 0
fi

# La URL se lee del environ del proceso vivo DENTRO del shell remoto y NUNCA se imprime ni viaja
# por la línea de comandos local. El detalle del mecanismo está en la lib.
prod_psql "$HOST" "$UNIT" "$sql"
