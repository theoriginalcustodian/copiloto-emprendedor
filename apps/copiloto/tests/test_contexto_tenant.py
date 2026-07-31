"""El tenant llega a la base — la pieza que convierte el RLS de decorativo en efectivo.

Contexto: hasta el 2026-07-31, 72 de las 77 tablas tenían RLS **sin `FORCE`**, y la app se conecta con
el rol dueño → Postgres la eximía de sus propias policies. El aislamiento lo daban (y lo siguen dando)
los `WHERE cliente_id` de cada store; lo que no había era **segunda línea**.

Lo notable: `test_adversarial_multitenant.py` ya lo decía en su docstring —*"el worker usa el rol OWNER
(bypassa RLS)"*— desde que se escribió. Estaba **documentado y sin pagar**: sin TODO, sin dueño, sin
fecha. Una advertencia escrita no es una defensa; estos tests sí.
"""
from __future__ import annotations

import asyncio
import json
import os
import uuid

import pytest

from contexto_tenant import (GUC_CLAIMS, conexion_con_tenant, declarar_en_conexion,
                             declarar_tenant, tenant, tenant_actual)

A = "11111111-1111-1111-1111-111111111111"
B = "22222222-2222-2222-2222-222222222222"


# ======================================================================================
# Sin base: el mecanismo del contexto
# ======================================================================================
class _CursorFalso:
    def __init__(self, registro: list) -> None:
        self._registro = registro

    def __enter__(self):  # noqa: ANN204
        return self

    def __exit__(self, *_):  # noqa: ANN002
        return False

    def execute(self, sql, params=None):  # noqa: ANN001
        self._registro.append(params)


class _ConnFalsa:
    def __init__(self) -> None:
        self.ejecutado: list = []
        self.cerrada = False
        self.autocommit = False

    def cursor(self):  # noqa: ANN201
        return _CursorFalso(self.ejecutado)

    def close(self) -> None:
        self.cerrada = True


def test_la_conexion_declara_el_tenant_del_contexto():
    conn = _ConnFalsa()
    with tenant(A):
        declarar_en_conexion(conn)

    (guc, claims), = conn.ejecutado
    assert guc == GUC_CLAIMS
    assert json.loads(claims)["cliente_id"] == A


def test_SIN_tenant_la_conexion_queda_sin_claims():
    """Fail-closed: con `FORCE`, una conexión sin claims no ve NADA. Es lo correcto ante un olvido —
    lo peligroso sería que viera todo, que es exactamente lo que pasaba antes."""
    conn = _ConnFalsa()
    declarar_tenant(None)
    declarar_en_conexion(conn)

    (_, claims), = conn.ejecutado
    assert claims == ""


def test_el_scope_restaura_el_tenant_anterior_incluso_si_hay_excepcion():
    declarar_tenant(A)
    with pytest.raises(RuntimeError):
        with tenant(B):
            assert tenant_actual() == B
            raise RuntimeError("algo falló en medio de la operación")
    assert tenant_actual() == A


@pytest.mark.asyncio
async def test_el_tenant_sobrevive_a_asyncio_to_thread():
    """Los stores corren con `await asyncio.to_thread(store...)`. Si el ContextVar no cruzara ese
    borde, la conexión se abriría sin tenant y —con FORCE— la app no vería sus propios datos."""
    with tenant(A):
        visto = await asyncio.to_thread(tenant_actual)
    assert visto == A


def test_si_no_se_puede_declarar_el_tenant_la_conexion_se_CIERRA():
    """Devolver una conexión sin tenant sería peor que fallar: con FORCE daría 0 filas y el llamador
    lo leería como 'no hay datos' en vez de como un error."""
    class _ConnQueFalla(_ConnFalsa):
        def cursor(self):  # noqa: ANN201
            raise RuntimeError("no se pudo setear la GUC")

    creada = _ConnQueFalla()
    with pytest.raises(RuntimeError):
        conexion_con_tenant(lambda: creada)()
    assert creada.cerrada is True


# ======================================================================================
# Contra Postgres real: que el aislamiento EXISTA, no que esté configurado
# ======================================================================================
pg = pytest.mark.skipif(not os.environ.get("DATABASE_URL"),
                        reason="requiere Postgres real (DATABASE_URL)")


@pg
def test_el_rol_de_la_app_NO_es_superuser_ni_bypassrls():
    """Un rol superuser o con BYPASSRLS saltea el RLS **incluso con FORCE**, y todo este mecanismo
    queda decorativo sin que nada falle. Lo aprendimos caro: el spike S6 dio 'no funciona nada' en su
    primera corrida por exactamente esto. Si este test se pone rojo, el aislamiento de la base no
    existe aunque las 77 tablas digan `FORCE`."""
    import psycopg2

    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user")
            es_super, bypassa = cur.fetchone()
    finally:
        conn.close()

    assert not es_super, "el rol de la app es SUPERUSER: saltea RLS aunque las tablas tengan FORCE"
    assert not bypassa, "el rol de la app tiene BYPASSRLS: el RLS no lo alcanza"


@pg
def test_ADVERSARIAL_un_tenant_no_ve_ni_escribe_lo_de_otro_por_RLS(monkeypatch):
    """El caso hostil sobre una tabla creada con el MISMO provisionado que las de producción.

    No prueba "cada quien ve lo suyo" (eso ya lo cubre el filtro de los stores): prueba que **aunque
    la query no filtre**, la base no entrega datos ajenos. Esa es toda la diferencia entre tener y no
    tener segunda línea."""
    import psycopg2
    import sys
    from pathlib import Path
    sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "deploy" / "worker"))
    from provision_tables import provision  # noqa: E402

    # El flag de despliegue (ver `provision_tables._force_rls`). Acá se enciende SIEMPRE: el test mide
    # el estado FINAL del mecanismo, no la etapa intermedia de la migración. De paso, es lo único que
    # recorre esa rama — una rama que ningún test ejercita es una rama sin verificar.
    monkeypatch.setenv("UC_RLS_FORCE", "1")

    tabla = f"tmp_rls_{uuid.uuid4().hex[:8]}"
    crudo = psycopg2.connect(os.environ["DATABASE_URL"])
    crudo.autocommit = True
    try:
        provision({tabla: ["dato text"]}, crudo)
        factory = conexion_con_tenant(lambda: psycopg2.connect(os.environ["DATABASE_URL"]))

        for quien, dato in ((A, "de-A"), (B, "de-B")):
            with tenant(quien):
                c = factory()
                with c.cursor() as cur:
                    cur.execute(f'INSERT INTO uc_factory."{tabla}" (cliente_id, dato) VALUES (%s,%s)',
                                (quien, dato))
                c.close()

        # --- LECTURA sin filtro: la base tiene que recortar igual.
        with tenant(A):
            c = factory()
            with c.cursor() as cur:
                cur.execute(f'SELECT dato FROM uc_factory."{tabla}"')   # ← a propósito SIN WHERE
                visto_a = [r[0] for r in cur.fetchall()]
            c.close()
        assert visto_a == ["de-A"], f"A vio datos ajenos: {visto_a}"

        # --- ESCRITURA como otro: el WITH CHECK tiene que rechazarla.
        with tenant(B):
            c = factory()
            with pytest.raises(psycopg2.Error):
                with c.cursor() as cur:
                    cur.execute(f'INSERT INTO uc_factory."{tabla}" (cliente_id, dato) VALUES (%s,%s)',
                                (A, "robo"))
            c.close()

        # --- CONTROL: sin tenant declarado, cero filas (y no "todas", que era el bug).
        declarar_tenant(None)
        c = factory()
        with c.cursor() as cur:
            cur.execute(f'SELECT count(*) FROM uc_factory."{tabla}"')
            assert cur.fetchone()[0] == 0
        c.close()
    finally:
        with crudo.cursor() as cur:
            cur.execute(f'DROP TABLE IF EXISTS uc_factory."{tabla}"')
        crudo.close()
