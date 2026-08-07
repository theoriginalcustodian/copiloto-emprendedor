"""CONS4 · A4 — `admin_soporte.resumen_soporte`, contra Postgres real vía `copiloto_consola`.

Reusa `FeedbackStore` (crear) y `TraumaStore` (depositar, para simular que un ticket derivó en
autosanación) -- no reimplementa ningún INSERT. Limpieza por tenant al final: aunque
`copiloto_feedback` no es cross-tenant en su lectura (a diferencia de `copiloto_traumas`, que
`tomar_trauma_para_reparar()` sí recorre), se limpia igual por higiene entre corridas.
"""
from __future__ import annotations

import os
import uuid

import psycopg2
import pytest

from admin_soporte import resumen_soporte
from feedback_store import FeedbackStore
from trauma_store import TraumaStore

necesita_pg = pytest.mark.skipif(not os.environ.get("DATABASE_URL"),
                                 reason="requiere Postgres real (DATABASE_URL)")
necesita_rol_consola = pytest.mark.skipif(
    not os.environ.get("COPILOTO_CONSOLA_DSN"),
    reason="requiere el rol de lectura de la Consola (BYPASSRLS): levantá la base con "
           "`test-db.sh --export` y pasá COPILOTO_CONSOLA_DSN a sync-test-backend.sh")


def _factory_consola():
    return psycopg2.connect(os.environ["COPILOTO_CONSOLA_DSN"])


@pytest.fixture
def nuevo_tenant(conn_de_tenant):
    creados: list[str] = []

    def _nuevo() -> str:
        cid = str(uuid.uuid4())
        creados.append(cid)
        return cid

    yield _nuevo

    for cid in creados:
        conn = conn_de_tenant(cid)()
        try:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM uc_factory.copiloto_feedback WHERE cliente_id = %s", (cid,))
                cur.execute("DELETE FROM uc_factory.copiloto_traumas WHERE cliente_id = %s", (cid,))
            conn.commit()
        finally:
            conn.close()


@necesita_pg
@necesita_rol_consola
def test_resumen_soporte_trae_el_texto_del_ticket(conn_de_tenant, nuevo_tenant):
    """A diferencia de A5 (DLQ), acá el texto SÍ va -- es "Feedback y su clasificación", declarado
    DENTRO del boundary (SPECS §2)."""
    tenant = nuevo_tenant()
    FeedbackStore(conn_de_tenant(tenant), tenant).crear(
        tipo="texto", texto="no puedo emitir la factura de hoy", contexto=None)

    filas = resumen_soporte(_factory_consola)
    fila = next(f for f in filas if f["cliente_id"] == tenant)
    assert fila["texto"] == "no puedo emitir la factura de hoy"
    assert fila["tipo"] == "texto"
    assert fila["derivo_en_autosanacion"] is False
    assert fila["estado_reparacion"] is None


@necesita_pg
@necesita_rol_consola
def test_resumen_soporte_marca_derivo_en_autosanacion_por_convencion_de_fingerprint(
        conn_de_tenant, nuevo_tenant):
    """La convención es `fingerprint = 'feedback:' + id` -- la MISMA que usa
    `clasificar_y_encolar_feedback` (`soporte_feedback_activities.py:91`). Sin FK: se reconstruye
    por JOIN, no se inventa una relación nueva."""
    tenant = nuevo_tenant()
    factory = conn_de_tenant(tenant)
    fid = FeedbackStore(factory, tenant).crear(
        tipo="voz", texto="se cae la app al cargar un gasto", contexto=None)

    TraumaStore(factory, tenant).depositar(
        fingerprint=f"feedback:{fid}", workflow="soporte_feedback", error_type="TicketDeSoporte",
        costura="feedback_intake",
        contexto={"categoria": "business_error",
                  "origen": {"archivo": "apps/copiloto/gasto_store.py", "linea": 42, "funcion": "crear"},
                  "sintoma_no_tecnico": "se cae la app al cargar un gasto", "feedback_id": fid})

    filas = resumen_soporte(_factory_consola)
    fila = next(f for f in filas if f["cliente_id"] == tenant)
    assert fila["derivo_en_autosanacion"] is True
    assert fila["estado_reparacion"] == "pendiente"
    assert fila["origen"] == {"archivo": "apps/copiloto/gasto_store.py", "linea": 42, "funcion": "crear"}


@necesita_pg
def test_resumen_soporte_con_conexion_de_tenant_NO_ve_cross_tenant(conn_de_tenant, nuevo_tenant):
    """ADVERSARIAL -- conexión normal (RLS `FORCE`) sólo ve su propio tenant."""
    tenant_a, tenant_b = nuevo_tenant(), nuevo_tenant()
    FeedbackStore(conn_de_tenant(tenant_a), tenant_a).crear(tipo="texto", texto="ticket A", contexto=None)
    FeedbackStore(conn_de_tenant(tenant_b), tenant_b).crear(tipo="texto", texto="ticket B", contexto=None)

    filas = resumen_soporte(conn_de_tenant(tenant_a))
    assert all(f["cliente_id"] == tenant_a for f in filas)
    assert any(f["texto"] == "ticket A" for f in filas)
    assert not any(f["texto"] == "ticket B" for f in filas)
