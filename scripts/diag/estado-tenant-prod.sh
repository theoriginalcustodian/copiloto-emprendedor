#!/usr/bin/env bash
# Diagnóstico READ-ONLY de qué tiene vinculado UN tenant en la instancia viva.
#
# POR QUÉ EXISTE
# --------------
# El 2026-10-16 hizo falta responder «¿el usuario del operador ya tiene ARCA vinculado?» y no había
# forma legítima de hacerlo: el admin web (`apps/copiloto/admin_web.py`, 12 endpoints) no toca las
# tablas de ARCA, y la alternativa era autorizar `ssh <host> psql …`, que abre TODO el SQL sobre la
# base viva. Este script existe para que el permiso apunte a algo ACOTADO, AUDITABLE y read-only por
# construcción, igual que su hermano `scripts/evidencia/contar-filas-prod.sh`.
#
# QUÉ **NO** IMPRIME, NUNCA
#   - `cert_enc` / `key_enc`: son la credencial fiscal del emprendedor. No se leen ni se seleccionan.
#   - La `DATABASE_URL`: la resuelve `prod_psql` dentro del shell remoto y no vuelve nunca.
#   - El CUIT completo: va enmascarado (`***123`). Alcanza para «¿es el mío?» sin publicar el padrón.
#
# EL SELECTOR ES UN SELECTOR, NO UN ALCANCE — y la distinción es la que vuelve válido el permiso
# ------------------------------------------------------------------------------------------------
# `contar-filas-prod.sh` dice, con razón, que «un alcance que se pasa por argumento no es un
# alcance». Acá hay un argumento libre (el email o el cliente_id) y no contradice esa regla: lo que
# el argumento elige es la FILA, no el alcance. El alcance —el host, la unidad, las tablas, las
# columnas y el hecho de que sólo se cuenta— sigue fijo en el fuente y queda en el diff. Cambiar el
# selector no amplía lo que el script puede hacer; sólo cambia a quién se lo pregunta.
# Y el selector se valida por ALLOWLIST y se RECHAZA si no encaja, en vez de escaparse: escapar
# admite lo hostil y después intenta neutralizarlo; rechazar no le da entrada.
#
# RLS: SIN DECLARAR EL TENANT, EL COUNT DA 0 — Y 0 SE LEE COMO «NO TIENE ARCA»
# ----------------------------------------------------------------------------
# `uc_factory.afip_credentials` tiene `FORCE ROW LEVEL SECURITY` y su policy es
# `cliente_id = uc_factory.current_cliente_id()`, que lee la GUC `request.jwt.claims`
# (`deploy/worker/provision_tables.py:49`). Sin claims devuelve NULL ⇒ ninguna fila matchea ⇒
# **fail-closed**. O sea: una consulta que no declara el tenant devuelve 0 filas, que es
# indistinguible de «este tenant no tiene credencial ARCA» — un falso negativo que manda a revisar
# el onboarding en vez de la conexión. `e2e_facturacion_http.py:63` ya documentaba exactamente esto.
#
# Por eso el reporte abre con un CONTROL: cuenta `afip_credentials` SIN declarar tenant. Tiene que
# dar 0. Si da más, RLS no está aplicando a este rol y el dato hay que leerlo distinto — así el
# riesgo de falso negativo queda VISIBLE en la salida en vez de implícito en un número.
# Además, cada consulta del reporte filtra `cliente_id = current_cliente_id()` de forma explícita,
# aunque RLS ya lo haría: cinturón además de tirantes, igual que el `--` de ssh.
#
# Uso:
#   bash scripts/diag/estado-tenant-prod.sh --email 341lin@gmail.com --dry-run   # imprime el SQL
#   bash scripts/diag/estado-tenant-prod.sh --email 341lin@gmail.com
#   bash scripts/diag/estado-tenant-prod.sh --cliente-id 48a9d75f-124b-4f9d-af8d-a73e2311bbbd
#
# Exit: 0 ok · 2 argumento/selector inválido · 3 el SQL contiene escritura · 4 sin DATABASE_URL remota
set -euo pipefail

# El mecanismo de acceso (ssh + DSN del proceso vivo + los dos guards) vive en la lib, compartido con
# `scripts/evidencia/contar-filas-prod.sh`: código de acceso a producción no puede vivir dos veces.
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/../lib" && pwd)/psql-prod.sh"

# Fijos, a propósito: son el alcance del permiso, no parámetros.
readonly HOST='unreal-copilot'
readonly UNIT='uc-copiloto-web.service'
EMAIL=''
CID=''
DRY=0

while [ $# -gt 0 ]; do
  case "$1" in
    --email)      EMAIL="${2-}"; shift 2 ;;
    --cliente-id) CID="${2-}";   shift 2 ;;
    --dry-run)    DRY=1;         shift ;;
    *) echo "argumento no reconocido: $1" >&2
       echo "acepta: --email <e> | --cliente-id <uuid> | --dry-run" >&2
       echo "El host, las tablas y las columnas son fijos y viven en el script: son el alcance del" >&2
       echo "permiso, y un alcance que se pasa por argumento no es un alcance." >&2
       exit 2 ;;
  esac
done

if [ -n "$EMAIL" ] && [ -n "$CID" ]; then
  echo "ABORTA: --email y --cliente-id son excluyentes. Dos selectores que pudieran no coincidir" >&2
  echo "dejarían la duda de cuál respondió el reporte." >&2
  exit 2
fi
if [ -z "$EMAIL" ] && [ -z "$CID" ]; then
  echo "ABORTA: falta el selector. Usá --email <e> o --cliente-id <uuid>." >&2
  exit 2
fi

# Allowlist ESTRICTA. Se rechaza lo que no encaja; no se escapa. Un selector con comilla simple, con
# espacio o con punto y coma no se neutraliza: no entra.
if [ -n "$CID" ]; then
  if ! echo "$CID" | grep -qiE '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'; then
    echo "ABORTA: --cliente-id no tiene forma de UUID: '$CID'" >&2; exit 2
  fi
  SELECTOR_SQL="'${CID}'"
  COMO="cliente_id=${CID}"
else
  # Sin comillas, sin espacios, sin metacaracteres: sólo lo que un email realmente necesita.
  if ! echo "$EMAIL" | grep -qE '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'; then
    echo "ABORTA: --email no tiene forma de email o trae caracteres no permitidos: '$EMAIL'" >&2
    exit 2
  fi
  if [ "${#EMAIL}" -gt 254 ]; then
    echo "ABORTA: --email demasiado largo (${#EMAIL} caracteres)" >&2; exit 2
  fi
  SELECTOR_SQL="(select cliente_id::text from uc_factory.tenants where email = '${EMAIL}')"
  COMO="email=${EMAIL}"
fi

prod_guard_host "$HOST" || exit $?

# ---------------------------------------------------------------------------------------------
# Los tres fragmentos. Van como `-c` separados, en UNA transacción (lo garantiza `prod_psql`), para
# que el `set_config` del fragmento 2 siga vigente en el 3. Separados y no en un solo statement a
# propósito: dentro de un mismo statement el orden de evaluación no está garantizado y una función
# STABLE puede leer la GUC vieja — el reporte saldría con 0 filas y el motivo sería invisible.
# `as materialized` fuerza que el CTE del `set_config` corra antes que el select que lo usa.
# ---------------------------------------------------------------------------------------------

# 1. CONTROL de RLS: sin tenant declarado tiene que ver 0 filas. Es el control positivo del
#    aislamiento, y a la vez el que impide leer un 0 del reporte como «no tiene ARCA».
SQL_CONTROL="with d as materialized (select set_config('request.jwt.claims', '', false)) \
select 'CONTROL RLS: afip_credentials visibles SIN declarar tenant (debe ser 0)' as que, \
       (select count(*)::text from uc_factory.afip_credentials) as v from d"

# 2. Declarar el tenant. El cliente_id se resuelve DEL LADO DEL SERVIDOR y el JSON lo arma
#    `json_build_object`, así no viaja ninguna comilla doble por las capas de shell.
SQL_DECLARAR="with d as materialized (select set_config('request.jwt.claims', \
       json_build_object('cliente_id', ${SELECTOR_SQL})::text, false)) \
select 'paso 2: claim del tenant declarado' as que, '' as v from d"

# 3. El reporte. Filtro explícito además de RLS. Nunca `cert_enc`/`key_enc`; CUIT enmascarado.
SQL_REPORTE="select 'tenant resuelto' as que, \
       case when uc_factory.current_cliente_id() is null \
            then 'NO -- todo lo de abajo da 0 por fail-closed, NO por ausencia de datos' \
            else 'si (verificado con la MISMA funcion que usa la policy)' end as v \
union all select 'afip_credentials: filas', count(*)::text from uc_factory.afip_credentials \
       where cliente_id = uc_factory.current_cliente_id() \
union all select 'afip_credentials: ACTIVAS', count(*)::text from uc_factory.afip_credentials \
       where cliente_id = uc_factory.current_cliente_id() and activo \
union all select 'ARCA detalle (ambiente:cuit enmascarado)', \
       coalesce(string_agg(ambiente || ':***' || right(cuit, 3) || \
                case when activo then ' [activa]' else ' [inactiva]' end, ', ' order by ambiente), \
                '(ninguna)') \
       from uc_factory.afip_credentials where cliente_id = uc_factory.current_cliente_id() \
union all select 'afip_perfil: filas', count(*)::text from uc_factory.afip_perfil \
       where cliente_id = uc_factory.current_cliente_id() \
union all select 'mp_credentials: filas', count(*)::text from uc_factory.mp_credentials \
       where cliente_id = uc_factory.current_cliente_id()"

prod_guard_readonly "${SQL_CONTROL} ${SQL_DECLARAR} ${SQL_REPORTE}" || exit $?

if [ "$DRY" = "1" ]; then
  echo "[dry-run] host=${HOST} unit=${UNIT} selector=${COMO}"
  echo "[dry-run] 1/3 control de RLS:"; echo "  ${SQL_CONTROL}"
  echo "[dry-run] 2/3 declarar tenant:"; echo "  ${SQL_DECLARAR}"
  echo "[dry-run] 3/3 reporte:";         echo "  ${SQL_REPORTE}"
  exit 0
fi

echo "== estado del tenant en la instancia viva (${COMO}) =="
prod_psql "$HOST" "$UNIT" "$SQL_CONTROL" "$SQL_DECLARAR" "$SQL_REPORTE"
