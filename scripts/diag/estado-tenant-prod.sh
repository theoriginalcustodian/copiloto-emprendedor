#!/usr/bin/env bash
# Diagnóstico READ-ONLY de qué tiene vinculado UN tenant en la instancia viva.
#
# POR QUÉ EXISTE
# --------------
# El 2026-10-16 hizo falta responder «¿el usuario del operador ya tiene ARCA vinculado?» y no había
# forma legítima de hacerlo: el admin web (`apps/copiloto/admin_web.py`, 12 endpoints) no toca las
# tablas de ARCA, y la alternativa era autorizar SQL arbitrario sobre la base viva. Este script
# existe para que el permiso apunte a algo ACOTADO, AUDITABLE y read-only por construcción, igual
# que su hermano `scripts/evidencia/contar-filas-prod.sh`.
#
# QUÉ **NO** IMPRIME, NUNCA
#   - `cert_enc` / `key_enc`: son la credencial fiscal del emprendedor. No se leen ni se seleccionan.
#   - La `DATABASE_URL`: la resuelve el preámbulo de la lib dentro del remoto y no vuelve nunca.
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
# TRES CAUSAS DISTINTAS QUE DEVOLVÍAN EL MISMO `0`
# ------------------------------------------------
# 1. **RLS fail-closed.** `uc_factory.afip_credentials` tiene `FORCE ROW LEVEL SECURITY` y su policy
#    es `cliente_id = uc_factory.current_cliente_id()`, que lee la GUC `request.jwt.claims`
#    (`deploy/worker/provision_tables.py:49`). Sin claims devuelve NULL ⇒ ninguna fila matchea ⇒ el
#    count da 0 aunque la credencial exista. `e2e_facturacion_http.py:63` ya documentaba esto.
# 2. **La tabla no existe.** Un `count(*)` sobre una tabla ausente no da 0: revienta. Pero el nombre
#    puede estar mal y nadie enterarse — de hecho la v1 de este script nombraba `uc_factory.tenants`
#    para resolver el email **sin que nadie lo hubiera ejecutado nunca**, porque el mecanismo estaba
#    roto (ver la lib). Un nombre de tabla que ningún control ejercitó es una suposición, no un dato.
# 3. **El cliente_id no existe.** Si el UUID pasado no es de ningún tenant, todas las cuentas dan 0
#    y el reporte se lee como «no tiene nada vinculado» cuando la verdad es «preguntaste por otro».
#
# Las tres se leen igual en un número y mandan a lugares distintos: la 1 a revisar la conexión, la 2
# al esquema, la 3 al selector. Por eso el reporte abre con un CONTROL —contar `afip_credentials`
# SIN declarar tenant, que tiene que dar 0; si da más, RLS no aplica a este rol— y además verifica
# contra `information_schema` qué tablas existen y si el cliente_id está en `tenants`, para que cada
# causa diga su propio nombre en la salida en vez de esconderse en un cero.
#
# Uso:
#   bash scripts/diag/estado-tenant-prod.sh --email 341lin@gmail.com --dry-run   # imprime el fuente
#   bash scripts/diag/estado-tenant-prod.sh --email 341lin@gmail.com
#   bash scripts/diag/estado-tenant-prod.sh --cliente-id 48a9d75f-124b-4f9d-af8d-a73e2311bbbd
#
# Exit: 0 ok · 2 argumento/selector inválido · 3 el fuente contiene escritura · 4 remoto no utilizable
set -euo pipefail

# El mecanismo de acceso (ssh + intérprete y DSN del proceso vivo + los guards) vive en la lib,
# compartido con `scripts/evidencia/contar-filas-prod.sh`: el código de acceso a producción no puede
# vivir dos veces — cuando el mecanismo resultó estar roto, el fix fue uno y llegó a los dos.
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/../lib" && pwd)/db-prod.sh"

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
#
# Se valida con `[[ =~ ]]` de bash y NO con `grep -qE '^…$'`. La v1 usaba grep y era INYECTABLE:
# grep evalúa **línea por línea** y sale 0 si ALGUNA línea matchea, así que
#   --email $'a@b.com\n'"' or 1=1--"
# pasaba el validador con su primera línea y metía el payload con la segunda. Reproducido el
# 2026-10-16: el SQL emitido contenía `' or 1=1--`, en los DOS selectores. Es la misma clase de
# defecto que `deploy/worker/provision_tables.py` documenta para `re.match` vs `re.fullmatch`, y
# reapareció porque el ancla `^…$` *parece* anclar el valor entero. El regex de bash no tiene
# semántica de línea, y `prod_guard_una_linea` rechaza el newline con un mensaje propio.
#
# Y aun así el valor NO se interpola en el SQL: viaja como **parámetro de libpq** (`%s`) hasta
# `cur.execute(sql, params)`. Ésa es la barrera que no depende de que el validador sea perfecto —
# y desde el 2026-10-16 es más fuerte que antes, porque antes el valor igual cruzaba una capa de
# texto (la variable de psql) y ahora no cruza ninguna.
if [ -n "$CID" ]; then
  prod_guard_una_linea "$CID" "--cliente-id" || exit $?
  if [[ ! $CID =~ ^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$ ]]; then
    echo "ABORTA: --cliente-id no tiene forma de UUID: '$CID'" >&2; exit 2
  fi
  SELECTOR_VALOR="$CID"
  MODO='uuid'
  COMO="cliente_id=${CID}"
else
  prod_guard_una_linea "$EMAIL" "--email" || exit $?
  # Sin comillas, sin espacios, sin metacaracteres: sólo lo que un email realmente necesita.
  if [[ ! $EMAIL =~ ^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$ ]]; then
    echo "ABORTA: --email no tiene forma de email o trae caracteres no permitidos: '$EMAIL'" >&2
    exit 2
  fi
  if [ "${#EMAIL}" -gt 254 ]; then
    echo "ABORTA: --email demasiado largo (${#EMAIL} caracteres)" >&2; exit 2
  fi
  SELECTOR_VALOR="$EMAIL"
  MODO='email'
  COMO="email=${EMAIL}"
fi

prod_guard_host "$HOST" || exit $?

# ---------------------------------------------------------------------------------------------
# El fuente que corre en el remoto. Va entre comillas DOBLES de bash, así que dentro usa sólo
# comillas simples y no lleva `$`, backtick ni backslash: cada uno de esos caracteres sería una capa
# de escape más, y la cadena de capas es exactamente lo que ya rompió este mecanismo una vez (las
# comillas llegaban como `'''` y el SQL perdía sus literales).
#
# Ningún literal va incrustado en el SQL: hasta `request.jwt.claims` viaja como parámetro. No es
# ceremonia — es lo que hace que no exista un lugar donde «meter un valor en el texto» sea posible.
# ---------------------------------------------------------------------------------------------
PY_DIAG="
sel = sys.argv[1]
modo = sys.argv[2]

con = conectar()
cur = con.cursor()
filas = []

# CONTROL de RLS: sin declarar tenant tiene que ver 0 filas. Es el control positivo del aislamiento
# y, a la vez, el que impide leer un 0 del reporte como 'no tiene ARCA'.
cur.execute('select count(*) from uc_factory.afip_credentials')
filas.append(('CONTROL RLS: afip_credentials visibles SIN declarar tenant (debe ser 0)',
              str(cur.fetchone()[0])))

# Qué tablas existen DE VERDAD. Un nombre de tabla equivocado no da 0: revienta, y el mensaje de
# Postgres se confunde con cualquier otro fallo. Preguntarlo primero deja que cada causa se nombre.
cur.execute('select table_name from information_schema.tables where table_schema = %s',
            ('uc_factory',))
hay = set(r[0] for r in cur.fetchall())

if modo == 'uuid':
    cid = sel
elif 'tenants' not in hay:
    filas.append(('cliente_id resuelto desde el email',
                  'NO SE PUEDE: uc_factory.tenants no existe en el schema'))
    cid = None
else:
    cur.execute('select cliente_id::text from uc_factory.tenants where email = %s', (sel,))
    f = cur.fetchone()
    cid = f[0] if f else None
    filas.append(('cliente_id resuelto desde el email',
                  cid if cid else 'NINGUN tenant con ese email'))

if cid is None:
    imprimir(filas)
    sys.exit(0)

# Que el cliente_id exista es la tercera causa del 0 ambiguo: preguntar por un UUID ajeno devuelve
# todo en cero y se lee como 'no tiene nada vinculado'.
if 'tenants' in hay:
    cur.execute('select count(*), min(email) from uc_factory.tenants where cliente_id = %s', (cid,))
    n, mail = cur.fetchone()
    filas.append(('tenant existe en uc_factory.tenants',
                  (str(n) + ' fila(s), email=' + str(mail)) if n
                  else 'NO EXISTE ese cliente_id -- por eso dara 0 todo lo de abajo'))

# Declarar el tenant, que es lo que RLS exige para ver sus filas.
cur.execute('select set_config(%s, %s, false)',
            ('request.jwt.claims', json.dumps({'cliente_id': cid})))

# Verificado con la MISMA funcion que usa la policy, no con una reimplementacion: si la policy
# cambia de criterio, este chequeo cambia con ella.
cur.execute('select uc_factory.current_cliente_id() is not null')
filas.append(('tenant resuelto',
              'si (verificado con la MISMA funcion que usa la policy)' if cur.fetchone()[0]
              else 'NO -- todo lo de abajo da 0 por fail-closed, NO por ausencia de datos'))

# CONTROL ADVERSARIAL del aislamiento: con MI claim declarado, contar la tabla SIN filtro.
#
# El control de arriba (sin claim) prueba el fail-closed, que es la mitad facil: cero filas con cero
# credenciales declaradas no distingue 'RLS aisla' de 'la tabla esta vacia'. Este mide la otra mitad
# y es el que exige la regla dura del repo (ADR-013 / BOLA, OWASP API1:2023): un control de
# aislamiento que nadie ejercito con un caso hostil es indistinguible de uno ausente.
#
# Y aca el caso hostil tiene dato real detras: el tenant canonico e2e-device TIENE una credencial
# ARCA activa (medido 2026-10-16). Asi que si con el claim del operador este total diera 1 mientras
# su propio conteo filtrado da 0, eso es fuga cross-tenant -- la fila de otro. Sin una fila ajena
# existiendo, el control saldria verde igual estando roto.
if 'afip_credentials' in hay:
    cur.execute('select count(*) from uc_factory.afip_credentials')
    total_visible = cur.fetchone()[0]
    cur.execute('select count(*) from uc_factory.afip_credentials'
                ' where cliente_id = uc_factory.current_cliente_id()')
    propias = cur.fetchone()[0]
    if total_visible == propias:
        veredicto = ('OK: ' + str(total_visible) + ' = las propias. Ninguna fila de otro tenant'
                     ' es visible con este claim')
    else:
        veredicto = ('FUGA CROSS-TENANT: veo ' + str(total_visible) + ' filas en total pero solo '
                     + str(propias) + ' son mias -- RLS no esta aislando')
    filas.append(('CONTROL adversarial: filas visibles CON mi claim vs. las mias', veredicto))

# El filtro explicito por current_cliente_id() va ademas de RLS: cinturon y tirantes, igual que el
# -- de ssh. Los nombres de tabla salen de esta tupla literal del fuente y estan verificados contra
# information_schema, asi que la concatenacion no toca nada que venga de afuera.
for tabla in ('afip_credentials', 'afip_perfil', 'mp_credentials'):
    if tabla not in hay:
        filas.append((tabla + ': filas', 'LA TABLA NO EXISTE en el schema (no es 0 filas)'))
        continue
    cur.execute('select count(*) from uc_factory.' + tabla +
                ' where cliente_id = uc_factory.current_cliente_id()')
    filas.append((tabla + ': filas', str(cur.fetchone()[0])))
    if tabla != 'afip_credentials':
        continue
    cur.execute('select count(*) filter (where activo) from uc_factory.afip_credentials'
                ' where cliente_id = uc_factory.current_cliente_id()')
    filas.append(('afip_credentials: ACTIVAS', str(cur.fetchone()[0])))
    # Nunca cert_enc ni key_enc, y el CUIT enmascarado: alcanza para 'es el mio' sin publicarlo.
    cur.execute('select ambiente, right(cuit, 3), activo from uc_factory.afip_credentials'
                ' where cliente_id = uc_factory.current_cliente_id() order by ambiente')
    det = []
    for amb, ult, act in cur.fetchall():
        det.append(str(amb) + ':***' + str(ult) + (' [activa]' if act else ' [inactiva]'))
    filas.append(('ARCA detalle (ambiente:cuit enmascarado)', ', '.join(det) if det else '(ninguna)'))

imprimir(filas)
"

FUENTE="${PROD_PY_PREAMBULO}${PY_DIAG}"
prod_guard_readonly "$FUENTE" || exit $?

if [ "$DRY" = "1" ]; then
  echo "[dry-run] host=${HOST} unit=${UNIT} selector=${COMO}"
  # El selector se imprime APARTE y el fuente muestra `%s`, que es exactamente lo que se envía: el
  # valor no es parte del texto SQL. Si alguna vez el dry-run vuelve a mostrar el valor INCRUSTADO
  # en una consulta, eso significa que alguien deshizo el fix de inyección.
  echo "[dry-run] argv remoto: 1=<${SELECTOR_VALOR}> 2=<${MODO}>  (parámetros de libpq, no texto SQL)"
  echo "[dry-run] fuente python que corre en el remoto:"
  printf '%s\n' "$FUENTE"
  exit 0
fi

echo "== estado del tenant en la instancia viva (${COMO}) =="
prod_py "$HOST" "$UNIT" "$FUENTE" "$SELECTOR_VALOR" "$MODO"
