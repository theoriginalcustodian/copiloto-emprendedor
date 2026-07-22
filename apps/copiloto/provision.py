"""apps/copiloto/provision.py — provisioning idempotente ÚNICO del Copiloto del Emprendedor (Task 1).

Pliega en UN script (paga la deuda M2 documentada en mp_indexes.sql — "provisioná y aparte aplicá el SQL"):

  1. Las tablas "estándar" declaradas en uc_tables.json (mp_credentials, mp_payments,
     copiloto_web_replies, copiloto_metering) vía el mecanismo genérico ya validado de la fábrica
     (deploy/worker/provision_tables.py): id bigserial PK + cliente_id uuid NOT NULL + columnas
     declaradas + RLS `tenant_isolation` + grants. Reuso puro (regla de oro #2), cero duplicación.

  2. `uc_factory.tenants` — registry `auth_user_id -> cliente_id` (spec §4). DDL BESPOKE, a propósito
     fuera del mecanismo genérico: su PK es `auth_user_id` (no `id bigserial`) y `cliente_id` es
     UNIQUE + DEFAULT gen_random_uuid() (no un simple filtro de partición NOT NULL). El mecanismo
     genérico no soporta esa forma, así que `tenants` NO vive en uc_tables.json (evita el landmine de
     que `seed.py` la cree con el schema genérico equivocado sobre una DB fresca) y su DDL bespoke acá
     es la ÚNICA fuente de verdad. El filtro `!= TENANTS_TABLE` del pase estándar queda como defensa.

  3. **TODOS** los `.sql` de esta carpeta, por descubrimiento (`_apply_sql_files`): índices únicos
     que los `ON CONFLICT` exigen, índices de listado, y migraciones aditivas. Sin ellos hay fallos
     en runtime ("no unique or exclusion constraint matching ON CONFLICT") y, peor, deduplicaciones
     que dejan de existir sin protestar. Se pliegan acá para que UN solo comando deje todo listo.

Idempotente: corrible N veces sin side effects (CREATE TABLE/INDEX IF NOT EXISTS, ENABLE RLS repetible,
policy con DROP+CREATE, GRANT repetible). Uso (VPS, venv con psycopg2, env fusion-pg.env cargado):

  set -a; . /etc/unreal-copilot/fusion-pg.env; set +a
  /opt/uc-copiloto-venv/bin/python provision.py
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

APP_DIR = Path(__file__).resolve().parent
WORKER_DIR = APP_DIR.parents[1] / "deploy" / "worker"
from _paths import ensure_paths
ensure_paths()
from provision_tables import provision as _provision_standard  # noqa: E402  (mecanismo genérico, reuso)

SCHEMA = "uc_factory"
TENANTS_TABLE = "tenants"
UC_TABLES_JSON = APP_DIR / "uc_tables.json"
# Los `.sql` NO se listan acá a propósito — se descubren con un glob. Ver `_apply_sql_files`.


def _provision_tenants(conn) -> None:
    """DDL bespoke de uc_factory.tenants (spec §4 / Task 1). Fuera del mecanismo genérico a propósito:
    PK = auth_user_id (no id bigserial) y cliente_id UNIQUE + DEFAULT gen_random_uuid() (no un simple
    filtro de partición). Idempotente: CREATE TABLE/ENABLE RLS repetibles, policy con DROP+CREATE."""
    cur = conn.cursor()
    cur.execute(f"""
        CREATE TABLE IF NOT EXISTS {SCHEMA}.{TENANTS_TABLE} (
            auth_user_id uuid PRIMARY KEY,
            cliente_id uuid UNIQUE NOT NULL DEFAULT gen_random_uuid(),
            email text,
            composio_user_id text NOT NULL,
            status text NOT NULL DEFAULT 'active',
            created_at timestamptz DEFAULT now()
        );
    """)
    cur.execute(f"ALTER TABLE {SCHEMA}.{TENANTS_TABLE} ENABLE ROW LEVEL SECURITY;")
    cur.execute(f"DROP POLICY IF EXISTS tenant_isolation ON {SCHEMA}.{TENANTS_TABLE};")
    cur.execute(
        f"CREATE POLICY tenant_isolation ON {SCHEMA}.{TENANTS_TABLE} "
        f"FOR ALL USING (cliente_id = ((auth.jwt() ->> 'cliente_id')::uuid));"
    )
    for grantee in ("anon", "authenticated", "service_role"):
        cur.execute(f"GRANT SELECT, INSERT, UPDATE, DELETE ON {SCHEMA}.{TENANTS_TABLE} TO {grantee};")
    print(f"OK {SCHEMA}.{TENANTS_TABLE} (auth_user_id PK, cliente_id UNIQUE, RLS+policy+grants)", flush=True)


def _ensure_reply_card_column(conn) -> None:
    """Migración aditiva de `copiloto_web_replies.card jsonb` (metadata de presentación del reply, ej HITL
    {'service','label'} → el frontend muestra el ícono+nombre de la app real). Va SEPARADA del pase estándar:
    `provision_tables` hace CREATE TABLE IF NOT EXISTS (no ALTER) y su guard anti-colisión ABORTA si una columna
    declarada falta en la tabla viva. Corre ANTES del pase estándar → sobre DB existente agrega la columna (el
    guard pasa); sobre DB fresca `IF EXISTS` la vuelve no-op y el CREATE TABLE ya la incluye (declarada en
    uc_tables.json). `ADD COLUMN IF NOT EXISTS` → idempotente, corrible N veces."""
    cur = conn.cursor()
    cur.execute(f"ALTER TABLE IF EXISTS {SCHEMA}.copiloto_web_replies ADD COLUMN IF NOT EXISTS card jsonb;")
    print(f"OK {SCHEMA}.copiloto_web_replies.card (columna aditiva jsonb, idempotente)", flush=True)


def _ensure_afip_activo_column(conn) -> None:
    """Migración aditiva de `afip_credentials.activo boolean` (ambiente homologación ↔ producción).

    Mismo criterio y misma razón que `_ensure_reply_card_column`: el pase estándar hace CREATE TABLE IF
    NOT EXISTS —nunca ALTER— y su guard anti-colisión ABORTA si una columna declarada falta en la tabla
    viva. Corre ANTES del pase estándar: sobre una DB existente agrega la columna y el guard pasa; sobre
    una DB fresca `IF EXISTS` la vuelve no-op y el CREATE TABLE ya la trae.

    `DEFAULT true` es el valor correcto para las filas que ya existían: eran la única credencial del
    tenant, así que eran la activa.
    """
    cur = conn.cursor()
    cur.execute(f"ALTER TABLE IF EXISTS {SCHEMA}.afip_credentials "
                f"ADD COLUMN IF NOT EXISTS activo boolean NOT NULL DEFAULT true;")
    print(f"OK {SCHEMA}.afip_credentials.activo (columna aditiva boolean, idempotente)", flush=True)


def _ensure_presupuestos_cliente_ref_column(conn) -> None:
    """Migración aditiva de `copiloto_presupuestos.cliente_ref bigint` (contrato clientes §5).

    Mismo criterio y misma razón que las dos de arriba: corre ANTES del pase estándar porque su guard
    anti-colisión aborta si una columna declarada en `uc_tables.json` falta en la tabla viva.

    🔴 **Y lo que NO hace, que es el punto de la §5:** los seis campos `receptor_*` de esta tabla se
    siguen escribiendo exactamente igual. `cliente_ref` es para NAVEGAR (la ficha del cliente muestra
    sus presupuestos); la copia desnormalizada es el REGISTRO. **No son datos duplicados.** El
    `receptor_domicilio` de una factura emitida no es una copia perezosa del domicilio del cliente:
    es el domicilio que se declaró ante ARCA ese día, y si el cliente se muda, la factura de hace un
    año no puede cambiar. Queda escrito acá —y no sólo en el contrato, que se archiva— porque el
    próximo refactor va a ver seis campos repetidos y va a querer «normalizarlos»; ahí se perdería el
    domicilio declarado de todas las facturas viejas.
    """
    cur = conn.cursor()
    cur.execute(f"ALTER TABLE IF EXISTS {SCHEMA}.copiloto_presupuestos "
                f"ADD COLUMN IF NOT EXISTS cliente_ref bigint;")
    print(f"OK {SCHEMA}.copiloto_presupuestos.cliente_ref (columna aditiva bigint, idempotente)",
          flush=True)


def _ensure_clientes_homonimo_column(conn) -> None:
    """Migración aditiva de `copiloto_clientes.homonimo integer NOT NULL DEFAULT 0`.

    Es el discriminador que le da salida al humano sin aflojarle nada al backfill: entra en el índice
    único por nombre, el backfill inserta siempre con `0` (así sigue colapsando los cinco presupuestos
    de la misma panadería) y un alta que el emprendedor confirmó como *«es otro Juan Pérez»* entra con
    `1`, `2`, `3`… Ver `clientes_migrations.sql`.

    `DEFAULT 0` es el valor correcto para las filas que ya existían: eran la única con ese nombre.
    Corre ANTES del pase estándar, por la misma razón que las otras `_ensure_*`.
    """
    cur = conn.cursor()
    cur.execute(f"ALTER TABLE IF EXISTS {SCHEMA}.copiloto_clientes "
                f"ADD COLUMN IF NOT EXISTS homonimo integer NOT NULL DEFAULT 0;")
    print(f"OK {SCHEMA}.copiloto_clientes.homonimo (columna aditiva integer, idempotente)",
          flush=True)


def _ensure_clientes_email_telefono(conn) -> None:
    """`copiloto_clientes.email` y `.telefono`, **y la migración del `contacto` que ya existía**.

    Dos campos y no uno de texto libre porque **el destino los usa distinto**: el PDF de la factura
    sale por WhatsApp y el presupuesto por mail. Con un campo único, cada envío tendría que adivinar
    qué guardó el emprendedor — y adivinar justo al mandar es el peor momento: o no se manda, o se
    manda a un destino que no existe.

    **La migración es determinista** y usa la misma regla que `cliente_store.partir_contacto`: el
    token con `@` va a `email`, el resto a `telefono`; sin `@`, todo a `telefono`. Se aplica **sólo
    a las filas que todavía no se migraron** (`email = '' AND telefono = ''`), así que es idempotente
    y no pisa lo que el emprendedor haya editado después.

    ⚠️ **DEUDA DELIBERADA Y VISIBLE, paso 1 de 2 PAGADO:** la columna `contacto` **no se borra acá**.
    Su condición de pago —*el primer deploy posterior a que FRONTEND cierre su hito 9*— se cumplió
    (hito 9 verificado en device el 2026-07-22), pero el `DROP COLUMN` **no es una línea**: esta misma
    función lo rompería. Por eso va en dos pasos y en este orden:

    1. ✅ **hecho acá** — la migración se **saltea sola** cuando la columna ya no está (el bloque de
       abajo). Sin esto, el `DROP` dejaría el deploy siguiente en rojo.
    2. ⏳ **pendiente** — `ALTER TABLE … DROP COLUMN contacto`, **irreversible sobre una base viva**:
       requiere el OK del operador, aunque hoy no haya **ni una** fila con dato adentro (medido:
       `contacto <> ''` → 0 en todos los tenants). **Propietario: BACKEND.**

    Mientras tanto `contacto` queda **huérfana**: nadie la lee ni la escribe — `_COLS` del store ya no
    la incluye—, así que no puede divergir en silencio.
    """
    cur = conn.cursor()
    cur.execute(f"ALTER TABLE IF EXISTS {SCHEMA}.copiloto_clientes "
                f"ADD COLUMN IF NOT EXISTS email text NOT NULL DEFAULT '';")
    cur.execute(f"ALTER TABLE IF EXISTS {SCHEMA}.copiloto_clientes "
                f"ADD COLUMN IF NOT EXISTS telefono text NOT NULL DEFAULT '';")

    # 🔴 El guard que hace posible el paso 2. Las consultas de abajo nombran `contacto` en el `WHERE`,
    # y para eso **no existe** un `IF EXISTS` que las salve: contra una columna borrada tiran
    # `UndefinedColumn`, y dentro de una transacción eso aborta todo lo que venga después — el deploy
    # entero, no sólo esta migración. Preguntar por el catálogo primero es la única forma de que el
    # `DROP` sea una decisión y no una bomba de tiempo.
    cur.execute("SELECT 1 FROM information_schema.columns "
                "WHERE table_schema = %s AND table_name = 'copiloto_clientes' "
                "AND column_name = 'contacto'", (SCHEMA,))
    if cur.fetchone() is None:
        print(f"OK {SCHEMA}.copiloto_clientes.email/.telefono "
              f"(la columna `contacto` ya no existe — migración retirada, nada que migrar)",
              flush=True)
        return

    cur.execute(f"SELECT count(*) FROM {SCHEMA}.copiloto_clientes "
                f"WHERE contacto <> '' AND email = '' AND telefono = ''")
    pendientes = int(cur.fetchone()[0])
    cur.execute(f"""
        UPDATE {SCHEMA}.copiloto_clientes SET
            email    = coalesce((SELECT t FROM regexp_split_to_table(contacto, '\\s+') AS t
                                  WHERE t LIKE '%@%' LIMIT 1), ''),
            telefono = coalesce((SELECT string_agg(t, ' ')
                                   FROM regexp_split_to_table(contacto, '\\s+') AS t
                                  WHERE t NOT LIKE '%@%'), '')
         WHERE contacto <> '' AND email = '' AND telefono = ''
    """)
    migradas = cur.rowcount

    # El control que la propia migración pide: si había filas con contacto y después NINGUNA tiene
    # email ni telefono, la migración perdió datos. Se ve acá o no se ve nunca.
    cur.execute(f"SELECT count(*) FROM {SCHEMA}.copiloto_clientes "
                f"WHERE contacto <> '' AND email = '' AND telefono = ''")
    huerfanas = int(cur.fetchone()[0])
    if huerfanas:
        raise RuntimeError(f"migración de contacto→email/telefono: {huerfanas} filas quedaron con "
                           f"contacto y sin ninguno de los dos campos nuevos — se perdió el dato")
    print(f"OK {SCHEMA}.copiloto_clientes.email/.telefono "
          f"(pendientes={pendientes} migradas={migradas} huérfanas=0)", flush=True)


def _ensure_presupuesto_estado(conn) -> None:
    """`copiloto_presupuestos.estado text NOT NULL DEFAULT 'pendiente'` — el hueco 2 del hito 3.

    Hoy el presupuesto sólo tiene derivados: `facturado` (existe un comprobante con CAE cuyo
    `workflow_id` es su `factura_id`) y `reemplazado_por`. **Un presupuesto aceptado de palabra y
    todavía no facturado es indistinguible de uno que el cliente rechazó** — y esa diferencia es
    justamente la que el emprendedor quiere ver.

    Tres valores escribibles y nada más: `pendiente` · `aprobado` · `desestimado`.

    ⚠️ **`sin_respuesta` NO es un cuarto valor: se CALCULA** (`pendiente` + N días sin desenlace). Si
    se guardara, habría que correr algo todas las noches para mantenerlo al día — y un estado que
    depende de que alguien se acuerde de actualizarlo miente apenas nadie lo corre. Derivarlo del
    tiempo no puede desincronizarse.

    Y la razón por la que son TRES y no dos: **ganado / perdido / no sé.** Si los no-marcados contaran
    como rechazos, la tasa de conversión diría que se pierde el 80% cuando en realidad no se sabe qué
    pasó — y un número mal una sola vez hace que el emprendedor no vuelva a mirar la pantalla.

    `DEFAULT 'pendiente'` es el valor correcto para las filas que ya existían: de ninguna se declaró
    nunca un desenlace. Corre ANTES del pase estándar, por la misma razón que las otras `_ensure_*`.
    """
    cur = conn.cursor()
    cur.execute(f"ALTER TABLE IF EXISTS {SCHEMA}.copiloto_presupuestos "
                f"ADD COLUMN IF NOT EXISTS estado text NOT NULL DEFAULT 'pendiente';")
    cur.execute(f"ALTER TABLE IF EXISTS {SCHEMA}.copiloto_presupuestos "
                f"ADD COLUMN IF NOT EXISTS estado_actualizado_en timestamptz;")
    print(f"OK {SCHEMA}.copiloto_presupuestos.estado (+estado_actualizado_en, idempotente)", flush=True)


def _ensure_modo_ceremonia(conn) -> None:
    """`copiloto_perfil_negocio.modo_ceremonia text NOT NULL DEFAULT 'confirmacion'` — contrato de modos.

    Cuánta ceremonia pide el copiloto antes de anotar: `confirmacion` (card editable) o `automatico`
    (guarda y avisa). Vive en el perfil del negocio y **por emprendedor**, nunca en la app: si viviera
    en el teléfono, la app podría mandar `automatico` sobre algo sensible y el backend no tendría con
    qué contradecirla.

    `DEFAULT 'confirmacion'` es lo correcto para las filas que ya existen **y** para las nuevas, y no
    es sólo prudencia: el emprendedor que recién llega no descubre el producto viendo cosas guardarse
    solas. El que ya confía lo cambia en un toque.

    ⚠️ El default de la columna es la SEGUNDA red, no la primera. La primera es `modo_de()`, que
    devuelve `confirmacion` ante cualquier cosa que no sea exactamente `automatico` — incluido el
    caso de que esta columna todavía no exista porque el provision no corrió.
    """
    cur = conn.cursor()
    cur.execute(f"ALTER TABLE IF EXISTS {SCHEMA}.copiloto_perfil_negocio "
                f"ADD COLUMN IF NOT EXISTS modo_ceremonia text NOT NULL DEFAULT 'confirmacion';")
    print(f"OK {SCHEMA}.copiloto_perfil_negocio.modo_ceremonia (idempotente)", flush=True)


def _ensure_imputacion_de_gastos(conn) -> None:
    """El addendum del hito 3: **imputar gastos al trabajo**, y el cobro que se registra a mano.

    Dos cambios que van juntos porque cierran el mismo círculo:

    **1. Tres referencias EXCLUYENTES en `copiloto_gastos`** (presupuesto / comprobante / cobro). No
    hay una entidad "trabajo": el trabajo **es la cadena** `presupuesto → factura → cobro`, cuyos
    enlaces ya existían. El gasto se imputa al eslabón que el usuario indicó y la cadena se resuelve
    al calcular — nunca se reescribe la referencia, o dos pantallas contarían distinto el mismo gasto.

    **2. `copiloto_cobros.comprobante_id` deja de ser NOT NULL.** Hoy un cobro sólo existe si pasó por
    MercadoPago: si le pagaron en efectivo, **no hay registro de ninguna clase** — y eso no es un
    hueco de imputación, es que **la caja miente**. `origen` distingue lo que el sistema vio de lo que
    alguien tipeó, porque no valen lo mismo como evidencia.

    Corre ANTES del pase estándar: el guard anti-colisión aborta si una columna declarada en
    `uc_tables.json` falta en la tabla viva.
    """
    cur = conn.cursor()
    for col, tipo in (("presupuesto_ref", "bigint"), ("comprobante_ref", "bigint"),
                      ("cobro_ref", "bigint")):
        cur.execute(f"ALTER TABLE IF EXISTS {SCHEMA}.copiloto_gastos "
                    f"ADD COLUMN IF NOT EXISTS {col} {tipo};")
    for col, tipo in (("origen", "text NOT NULL DEFAULT 'manual'"), ("cliente_ref", "bigint"),
                      ("presupuesto_ref", "bigint"),
                      # El ingreso DICTADO: «me pagaron 85 mil de la panadería». El cliente puede no
                      # estar en la cartera todavía, así que va como texto libre además del `_ref` —
                      # exigir que exista primero es la validación de más que hace que no se anote.
                      ("cliente_nombre", "text NOT NULL DEFAULT ''"),
                      ("concepto", "text NOT NULL DEFAULT ''")):
        cur.execute(f"ALTER TABLE IF EXISTS {SCHEMA}.copiloto_cobros "
                    f"ADD COLUMN IF NOT EXISTS {col} {tipo};")
    # `DROP NOT NULL` es idempotente en Postgres (no falla si ya está sin la restricción).
    cur.execute(f"ALTER TABLE IF EXISTS {SCHEMA}.copiloto_cobros "
                f"ALTER COLUMN comprobante_id DROP NOT NULL;")
    print(f"OK {SCHEMA}.copiloto_gastos.*_ref + copiloto_cobros.origen/cliente_ref "
          f"(imputación al trabajo, idempotente)", flush=True)


def _apply_sql_files(conn) -> list[str]:
    """🔴 Aplica **TODOS** los `.sql` de esta carpeta, por descubrimiento y en orden alfabético.

    Acá había dos funciones con dos nombres de archivo hardcodeados (`mp_indexes.sql` y
    `afip_indexes.sql`). Para cuando lo encontré había **siete** `.sql` en la carpeta y **cinco no los
    aplicaba nadie**: `gastos_migrations`, `presupuestos_migrations`, `clientes_migrations`,
    `actividad_indexes` y `afip_migrations` estaban puestos a mano, uno por uno, desde una sesión.

    **Por qué era grave y no cosmético.** En la base viva los índices están —los apliqué yo—, así que
    nada fallaba ni iba a fallar: el agujero sólo aparece en una base **nueva** (otro entorno, un
    restore, el día que este producto se instale en otro lado). Y ahí no aparece como un error. Sin
    `copiloto_clientes_tenant_doc_ux`, el `except pgcode 23505` de `ClienteStore.crear` **nunca se
    dispara**: el alta duplicada entra, devuelve `201`, y toda la deduplicación del contrato §3.3 deja
    de existir en silencio. El instrumento no falla — confirma.

    Por descubrimiento y no con una lista, para que el archivo número ocho no vuelva a quedarse
    afuera: la lista hay que acordarse de actualizarla, el `glob` no.

    **Van DESPUÉS del pase estándar** porque un `CREATE INDEX` necesita su tabla creada. Una columna
    aditiva sobre una tabla que YA existe no se puede resolver acá —el guard anti-colisión aborta
    antes—: para eso están los `_ensure_*_column`, que corren antes.

    Idempotente: todas las sentencias son `IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS`.
    """
    aplicados = []
    cur = conn.cursor()
    for archivo in sorted(APP_DIR.glob("*.sql")):
        cur.execute(archivo.read_text(encoding="utf-8"))
        aplicados.append(archivo.name)
        print(f"OK SQL aplicado: {archivo.name}", flush=True)
    if not aplicados:
        # Un vacío del propio instrumento no es un hallazgo: si el glob no encuentra nada, lo roto es
        # la ruta, no el repo. Sin este grito, «0 archivos» se lee como «no había nada que aplicar».
        raise RuntimeError(f"ningún .sql en {APP_DIR} — la ruta está mal, "
                           f"no es que no haya migraciones")
    return aplicados


def provision(conn) -> dict:
    """Provisiona TODO lo que el Copiloto necesita en uc_factory (idempotente, corrible N veces).
    `conn` con autocommit=True (cada DDL es su propia transacción, igual que provision_tables.py)."""
    manifest = json.load(open(UC_TABLES_JSON, encoding="utf-8"))
    standard_spec = {k: v for k, v in manifest.items() if k != TENANTS_TABLE}
    _ensure_reply_card_column(conn)   # ANTES del pase estándar: su guard anti-colisión aborta si `card` (ya
    #                                   declarada en uc_tables.json) falta en la tabla viva. Ver la función.
    _ensure_afip_activo_column(conn)  # ídem para `afip_credentials.activo`.
    _ensure_presupuestos_cliente_ref_column(conn)   # ídem para `copiloto_presupuestos.cliente_ref`.
    _ensure_clientes_homonimo_column(conn)          # ídem para `copiloto_clientes.homonimo`.
    _ensure_clientes_email_telefono(conn)           # ídem + migra el `contacto` viejo.
    _ensure_presupuesto_estado(conn)                # ídem para `copiloto_presupuestos.estado`.
    _ensure_modo_ceremonia(conn)                    # ídem para `copiloto_perfil_negocio.modo_ceremonia`.
    _ensure_imputacion_de_gastos(conn)              # ídem para los `*_ref` y el cobro a mano.
    standard_done = _provision_standard(standard_spec, conn)
    _provision_tenants(conn)
    sql_aplicados = _apply_sql_files(conn)
    return {"standard_tables": standard_done, "tenants": TENANTS_TABLE,
            "sql_aplicados": sql_aplicados}


def main() -> None:
    import psycopg2
    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    conn.autocommit = True
    result = provision(conn)
    print(f"provision OK: {result}", flush=True)


if __name__ == "__main__":
    main()
