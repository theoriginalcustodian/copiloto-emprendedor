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
#   - No acepta argumentos libres: sólo `--dry-run` y `--host <h>`. Cualquier otro ⇒ exit 2.
#   - No imprime nunca la `DATABASE_URL` (la lee del environ del proceso y la pasa a psql sin echo).
#
# ES READ-ONLY POR CONSTRUCCIÓN, y eso se verifica: el guard de abajo rechaza la corrida si el SQL
# armado contiene cualquier verbo de escritura. No es decoración — es el control que hace que este
# script merezca un permiso que `psql` suelto no merece.
#
# Uso:
#   bash scripts/evidencia/contar-filas-prod.sh --dry-run     # imprime el SQL y NO se conecta
#   bash scripts/evidencia/contar-filas-prod.sh               # cuenta contra el host por defecto
set -euo pipefail

HOST="${UC_DEPLOY_HOST:-unreal-copilot}"
UNIT="uc-copiloto-web.service"
DRY=0

while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run) DRY=1; shift ;;
    --host) HOST="${2:?--host necesita un valor}"; shift 2 ;;
    *) echo "argumento no reconocido: $1" >&2
       echo "sólo acepta --dry-run y --host <h>; la lista de tablas es fija y vive en el script" >&2
       exit 2 ;;
  esac
done

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
if echo "$sql" | grep -qi -E '\b(insert|update|delete|drop|truncate|alter|create|grant|copy)\b'; then
  echo "ABORTA: el SQL armado contiene un verbo de escritura. Este script es read-only." >&2
  exit 3
fi

if [ "$DRY" = "1" ]; then
  echo "[dry-run] host=${HOST} unit=${UNIT}"
  echo "[dry-run] SQL que se enviaría:"
  echo "$sql"
  exit 0
fi

# La URL se lee del environ del proceso vivo y NUNCA se imprime: va por stdin del psql remoto.
ssh -o ConnectTimeout=15 -o BatchMode=yes "$HOST" \
  "P=\$(systemctl show -p MainPID --value ${UNIT}); \
   DB=\$(tr '\\0' '\\n' < /proc/\$P/environ | grep '^DATABASE_URL=' | cut -d= -f2-); \
   if [ -z \"\$DB\" ]; then echo 'SIN DATABASE_URL en el proceso' >&2; exit 4; fi; \
   psql \"\$DB\" -v ON_ERROR_STOP=1 --single-transaction -t -A -F' | ' -c \"$sql\""
