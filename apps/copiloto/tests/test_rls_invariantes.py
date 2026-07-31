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

SCHEMA = "uc_factory"
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
