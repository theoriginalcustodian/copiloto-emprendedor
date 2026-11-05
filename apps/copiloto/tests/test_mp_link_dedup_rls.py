"""SEC-A2-2: `uc_factory.mp_link_dedup` con RLS + policy + FORCE. Contra Postgres REAL (@necesita_pg).

El control es adversarial: A guarda un link; B (otro tenant) NO lo ve, NO puede escribir una fila con el
cliente_id de A (WITH CHECK) y una conexión SIN tenant declarado ve cero filas — incluido el owner, que
antes bypasseaba por falta de FORCE. Control positivo: A sí ve lo suyo con el mismo armado."""
from __future__ import annotations

import os
import uuid
from pathlib import Path

import psycopg2
import pytest

from contexto_tenant import conexion_con_tenant, tenant
from mp_dedup_store import MpLinkDedupStore

necesita_pg = pytest.mark.skipif(not os.environ.get("DATABASE_URL"), reason="requiere Postgres real (DATABASE_URL)")
_TABLA = "uc_factory.mp_link_dedup"


def _cruda():
    c = psycopg2.connect(os.environ["DATABASE_URL"])
    c.autocommit = True
    return c


@pytest.fixture
def rls_aplicado():
    """Aplica el bloque RLS de mp_indexes.sql (idempotente), igual que provision.py en el deploy."""
    sql = (Path(__file__).resolve().parent.parent / "mp_indexes.sql").read_text(encoding="utf-8")
    c = _cruda()
    with c.cursor() as cur:
        cur.execute(sql)
    c.close()


@pytest.fixture
def dos_tenants(rls_aplicado):
    sfx = uuid.uuid4().hex[:8]
    a, b = str(uuid.uuid4()), str(uuid.uuid4())
    yield a, b
    for cid in (a, b):
        with tenant(cid):
            c = conexion_con_tenant(_cruda)()
            with c.cursor() as cur:
                cur.execute(f"DELETE FROM {_TABLA} WHERE cliente_id=%s", (cid,))
            c.close()


@necesita_pg
def test_adversarial_dedup_b_no_ve_ni_escribe_lo_de_a(dos_tenants):
    a, b = dos_tenants
    fabrica = conexion_con_tenant(_cruda)
    with tenant(a):
        MpLinkDedupStore(fabrica, a).save("k1", preference_id="pref-A", init_point="https://mp/a",
                                          external_reference="ref-A")
        assert MpLinkDedupStore(fabrica, a).get("k1")["preference_id"] == "pref-A"   # control positivo
    with tenant(b):
        # B consulta la MISMA clave con SU cliente_id y con el de A: ninguna devuelve la fila de A
        assert MpLinkDedupStore(fabrica, b).get("k1") is None
        assert MpLinkDedupStore(fabrica, a).get("k1") is None, "RLS debe ocultarla aunque el filtro diga A"
        # B intenta ESCRIBIR una fila a nombre de A: WITH CHECK lo rechaza
        with pytest.raises(psycopg2.Error):
            MpLinkDedupStore(fabrica, a).save("k2", preference_id="pref-X", init_point="https://x",
                                              external_reference="x")


@necesita_pg
def test_adversarial_dedup_sin_tenant_declarado_ve_cero_filas(dos_tenants):
    a, _b = dos_tenants
    with tenant(a):
        MpLinkDedupStore(conexion_con_tenant(_cruda), a).save(
            "k1", preference_id="pref-A", init_point="https://mp/a", external_reference="ref-A")
    c = _cruda()   # conexión del owner SIN tenant: con FORCE + policy no ve nada
    with c.cursor() as cur:
        cur.execute(f"SELECT count(*) FROM {_TABLA} WHERE cliente_id=%s", (a,))
        assert cur.fetchone()[0] == 0
    c.close()
