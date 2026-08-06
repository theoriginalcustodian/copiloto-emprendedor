"""Invariantes del RLS que ningún test de store puede cazar — se ven sólo mirando el esquema entero.

Los tests de cada store verifican que un tenant no vea lo de otro. Estos verifican las condiciones
**bajo las cuales ese mecanismo existe**: si alguna se rompe, todos aquellos siguen en verde y el
aislamiento igual desaparece (o, peor, la app deja de funcionar entera).
"""
from __future__ import annotations

import json
import os
from pathlib import Path

import pytest

necesita_pg = pytest.mark.skipif(not os.environ.get("DATABASE_URL"),
                                 reason="requiere Postgres real (DATABASE_URL)")
necesita_rol_consola = pytest.mark.skipif(
    not os.environ.get("COPILOTO_CONSOLA_DSN"),
    reason="requiere el rol de lectura de la Consola (BYPASSRLS): levantá la base con "
           "`test-db.sh --export` y pasá COPILOTO_CONSOLA_DSN a sync-test-backend.sh")

SCHEMA = "uc_factory"
#: Las 3 tablas que CONS0a decidió exponer cross-tenant al rol de la Consola. Sólo lectura.
TABLAS_CONSOLA = ("copiloto_metering", "copiloto_feedback", "copiloto_traumas")
#: La tabla que traduce `auth_user_id` (el `sub` del JWT) -> `cliente_id`. Ver el test de abajo.
TABLA_DE_RESOLUCION = "tenants"


def _consulta(sql: str, params: tuple = ()):
    import psycopg2

    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    conn.autocommit = True
    try:
        with conn.cursor() as cur:
            cur.execute(sql, params)
            return cur.fetchall()
    finally:
        conn.close()


@necesita_pg
def test_la_tabla_que_RESUELVE_el_tenant_no_puede_tener_FORCE():
    """`tenants` es la única tabla que se consulta ANTES de saber de quién es la operación.

    `resolve_cliente_id()` (auth.py) la lee con el `sub` del JWT para averiguar el `cliente_id`; recién
    después el borde puede declarar el tenant. Con `FORCE`, esa lectura ocurre sin claims y devuelve
    **cero filas**: `resolve_cliente_id` devuelve `None` y `require_tenant` responde
    **403 "tenant not provisioned"** — a TODOS los usuarios, incluidos los que sí existen.

    Medido el 2026-07-31 con control diferencial sobre la base de tests (mismo provisionado):

        admin (control positivo) .............. 1 fila   ← la fila existe
        tenants SIN force (como está hoy) ..... 1 fila   ← el login funciona
        tenants CON force ..................... 0 filas  ← nadie puede autenticarse
        restaurado ............................ 1 fila

    Hoy esto se sostiene por accidente: `tenants` quedó fuera de `uc_tables.json`, que es lo que el
    provisionado recorre para aplicar `FORCE`. Agregarla al manifiesto —un cambio que parecería una
    mejora de seguridad— **tumba la autenticación entera**, y ningún otro test lo notaría porque
    todos usan conexiones que ya tienen el tenant declarado.

    Su aislamiento NO depende de esto: `tenants` se consulta por `auth_user_id`, que viene firmado en
    el JWT. Nadie puede pedir la fila de otro sin falsificar el token.
    """
    filas = _consulta(
        "SELECT relforcerowsecurity FROM pg_class c "
        "JOIN pg_namespace n ON n.oid = c.relnamespace "
        "WHERE n.nspname = %s AND c.relname = %s",
        (SCHEMA, TABLA_DE_RESOLUCION))
    assert filas, f"{SCHEMA}.{TABLA_DE_RESOLUCION} no existe — el provisionado no corrió"
    assert filas[0][0] is False, (
        f"{SCHEMA}.{TABLA_DE_RESOLUCION} tiene FORCE ROW LEVEL SECURITY. Es la tabla que resuelve el "
        "tenant y se lee ANTES de declararlo: con FORCE, resolve_cliente_id() devuelve None y la app "
        "responde 403 a todos los usuarios. Revertí el FORCE en esa tabla.")


@necesita_pg
def test_la_tabla_de_resolucion_NO_esta_en_el_manifiesto_que_aplica_FORCE():
    """El guard de arriba mide el efecto; éste mide la causa, y es el que avisa en el PR.

    `provision_tables.provision()` aplica `FORCE` a cada tabla de `uc_tables.json`. Si alguien agrega
    `tenants` ahí, el de arriba se pondría rojo recién después de provisionar; éste se pone rojo al
    correr los tests, que es cuando todavía se puede leer el diff.
    """
    manifiesto = json.loads(
        (Path(__file__).resolve().parents[1] / "uc_tables.json").read_text(encoding="utf-8"))
    assert TABLA_DE_RESOLUCION not in manifiesto, (
        f"'{TABLA_DE_RESOLUCION}' entró a uc_tables.json. El provisionado le aplicaría FORCE y la "
        "autenticación dejaría de funcionar para todos — ver el test de arriba.")


@necesita_pg
def test_toda_tabla_con_RLS_forzado_tiene_politica_de_LECTURA_y_de_ESCRITURA():
    """`USING` sin `WITH CHECK` filtra lo que se LEE y deja escribir con el `cliente_id` de otro.

    Es el modo de fallo más silencioso de los tres que pisamos el 2026-07-31: la tabla se ve
    protegida (RLS activo, lecturas correctas) y aun así acepta que un tenant inserte una fila a
    nombre de otro. En producción había **65 de 70** policies así.
    """
    sin_check = _consulta(
        "SELECT c.relname, p.polname FROM pg_policy p "
        "JOIN pg_class c ON c.oid = p.polrelid "
        "JOIN pg_namespace n ON n.oid = c.relnamespace "
        "WHERE n.nspname = %s AND c.relforcerowsecurity "
        "  AND p.polcmd = '*' AND p.polwithcheck IS NULL",
        (SCHEMA,))
    assert not sin_check, (
        "estas policies FOR ALL no tienen WITH CHECK — dejan escribir con el cliente_id de otro "
        "tenant: " + ", ".join(f"{t}.{p}" for t, p in sin_check))


@necesita_pg
def test_rol_consola_tiene_EXACTAMENTE_SELECT_en_sus_3_tablas_ni_uno_mas():
    """CONS0a: el rol `copiloto_consola` (BYPASSRLS, `deploy/copiloto/provision-rol-consola.sh`) sólo
    puede LEER, y sólo esas 3 tablas. `aclexplode(relacl)` lee el catálogo directo — no depende de que
    quien corre el test tenga permisos sobre `copiloto_consola` (a diferencia de
    `information_schema.role_table_grants`, que sólo muestra grants donde sos parte), así que esto
    corre con el rol normal de la app, sin necesitar `COPILOTO_CONSOLA_DSN`.

    Si alguien amplía este rol a mano en la base (otra tabla, o INSERT/UPDATE) sin pasar por el
    script de provisioning, este test lo caza sin necesitar reproducir la conexión del rol.
    """
    filas = _consulta(
        "SELECT c.relname, a.privilege_type "
        "FROM pg_class c "
        "JOIN pg_namespace n ON n.oid = c.relnamespace "
        "CROSS JOIN LATERAL aclexplode(c.relacl) AS a "
        "JOIN pg_roles r ON r.oid = a.grantee "
        "WHERE n.nspname = %s AND r.rolname = 'copiloto_consola'",
        (SCHEMA,))
    if not filas:
        pytest.skip("rol copiloto_consola no provisionado en esta base (ver test-db.sh)")
    por_tabla: dict[str, set[str]] = {}
    for tabla, permiso in filas:
        por_tabla.setdefault(tabla, set()).add(permiso)
    esperado = {t: {"SELECT"} for t in TABLAS_CONSOLA}
    assert por_tabla == esperado, (
        f"grants de copiloto_consola = {por_tabla}, se esperaba exactamente SELECT en {sorted(TABLAS_CONSOLA)}")


@necesita_pg
@necesita_rol_consola
def test_rol_consola_es_BYPASSRLS_pero_NO_superuser():
    """Espejo vivo de `provision-rol-consola.sh`: BYPASSRLS es necesario para leer cross-tenant,
    superuser sería mucho más radio de daño del necesario (podría escribir cualquier tabla del
    schema, apagar RLS, crear roles)."""
    import psycopg2

    with psycopg2.connect(os.environ["COPILOTO_CONSOLA_DSN"]) as conn, conn.cursor() as cur:
        cur.execute("SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user")
        es_super, bypassa = cur.fetchone()
    assert not es_super, "el rol de la Consola es SUPERUSER — radio de daño mucho mayor al necesario"
    assert bypassa, "el rol de la Consola NO tiene BYPASSRLS — no podría leer cross-tenant"


@necesita_pg
@necesita_rol_consola
def test_rol_consola_CONTROL_POSITIVO_ve_dos_tenants_en_la_misma_query():
    """Sin este control, "0 filas" en el resto de la suite no probaría aislamiento — probaría que el
    rol ni siquiera puede leer. Sembramos 2 tenants con el rol de la app (declarando cada uno como lo
    haría la app real) y confirmamos que la Consola los ve juntos, en la MISMA query."""
    import uuid

    import psycopg2

    tenant_a, tenant_b = str(uuid.uuid4()), str(uuid.uuid4())
    marca = f"test-cons0a-{uuid.uuid4().hex[:8]}"

    for tenant in (tenant_a, tenant_b):
        conn = psycopg2.connect(os.environ["DATABASE_URL"])
        conn.autocommit = True
        try:
            with conn.cursor() as cur:
                cur.execute("SELECT set_config('request.jwt.claims', %s, false)",
                            (json.dumps({"cliente_id": tenant}),))
                cur.execute(
                    "INSERT INTO uc_factory.copiloto_metering "
                    "(cliente_id, session_id, evento, model, tokens) VALUES (%s, %s, 'llm_turno', %s, 1)",
                    (tenant, marca, marca))
        finally:
            conn.close()

    try:
        with psycopg2.connect(os.environ["COPILOTO_CONSOLA_DSN"]) as conn, conn.cursor() as cur:
            cur.execute(
                "SELECT count(DISTINCT cliente_id) FROM uc_factory.copiloto_metering "
                "WHERE session_id = %s", (marca,))
            vistos = cur.fetchone()[0]
        assert vistos == 2, (
            f"el rol de la Consola vio {vistos}/2 tenants sembrados — no está leyendo cross-tenant")

        conn_control = psycopg2.connect(os.environ["DATABASE_URL"])
        conn_control.autocommit = True
        try:
            with conn_control.cursor() as cur:
                cur.execute("SELECT set_config('request.jwt.claims', '', false)")
                cur.execute(
                    "SELECT count(*) FROM uc_factory.copiloto_metering WHERE session_id = %s", (marca,))
                ve_app_sin_tenant = cur.fetchone()[0]
        finally:
            conn_control.close()
        assert ve_app_sin_tenant == 0, (
            "el rol normal de la app, SIN declarar tenant, vio la sonda — el RLS no aplica y el "
            "verde de arriba no prueba nada del rol de la Consola")
    finally:
        limpieza = psycopg2.connect(os.environ["DATABASE_URL"])
        limpieza.autocommit = True
        try:
            with limpieza.cursor() as cur:
                for tenant in (tenant_a, tenant_b):
                    cur.execute("SELECT set_config('request.jwt.claims', %s, false)",
                                (json.dumps({"cliente_id": tenant}),))
                    cur.execute(
                        "DELETE FROM uc_factory.copiloto_metering WHERE session_id = %s", (marca,))
        finally:
            limpieza.close()


@necesita_pg
@necesita_rol_consola
def test_rol_consola_ADVERSARIAL_no_puede_escribir():
    """BYPASSRLS saltea las POLICIES, no los GRANT. El rol sólo tiene SELECT — un DELETE (sin filtro,
    el caso más amplio posible) tiene que fallar por permisos en las 3 tablas."""
    import psycopg2

    for tabla in TABLAS_CONSOLA:
        conn = psycopg2.connect(os.environ["COPILOTO_CONSOLA_DSN"])
        try:
            with pytest.raises(psycopg2.errors.InsufficientPrivilege):
                with conn.cursor() as cur:
                    cur.execute(f"DELETE FROM uc_factory.{tabla} WHERE false")
        finally:
            conn.close()
