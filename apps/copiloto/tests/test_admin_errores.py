"""CONS3 · A5 — `admin_errores.resumen_errores`, contra Postgres real vía `copiloto_consola`.

Reusa `TraumaStore` para sembrar (no reimplementa el INSERT) -- mismo patrón que
`test_admin_uso.py`.

## Por qué cada tenant se limpia al final (`nuevo_tenant`)

`tomar_trauma_para_reparar()` -- que usa `test_autosanacion_e2e.py` -- es CROSS-TENANT
(`BYPASSRLS`): un trauma `pendiente` que este archivo deja sembrado, sin cerrar, queda visible para
CUALQUIER otro test de la suite que pida "el próximo trauma a reparar", sea de qué tenant sea.
Contaminó esa suite la primera vez que se escribió esto (5 tests de `test_autosanacion_e2e.py`
rotos, detectado corriendo la suite completa antes de abrir el PR). Mismo patrón de limpieza que ya
usa la fixture `tenant_de_prueba` de ese archivo (`DELETE FROM ... WHERE cliente_id = %s`), acá vía
la conexión del propio tenant (no hace falta BYPASSRLS para que un tenant borre sus propias filas).
"""
from __future__ import annotations

import os
import uuid

import psycopg2
import pytest

from admin_errores import resumen_errores
from trauma_store import RESUELTO, TraumaStore

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
                cur.execute("DELETE FROM uc_factory.copiloto_traumas WHERE cliente_id = %s", (cid,))
            conn.commit()
        finally:
            conn.close()


@necesita_pg
@necesita_rol_consola
def test_resumen_errores_agrupa_por_fingerprint_cross_tenant(conn_de_tenant, nuevo_tenant):
    tenant_a, tenant_b = nuevo_tenant(), nuevo_tenant()
    fp = f"test-fp-{uuid.uuid4().hex[:8]}"

    store_a = TraumaStore(conn_de_tenant(tenant_a), tenant_a)
    store_a.depositar(fingerprint=fp, workflow="AfipFacturaWorkflow", error_type="TimeoutError",
                       costura="activity_interceptor")
    store_a.depositar(fingerprint=fp, workflow="AfipFacturaWorkflow", error_type="TimeoutError",
                       costura="activity_interceptor")  # 2da ocurrencia -> dedupe_count=2
    TraumaStore(conn_de_tenant(tenant_b), tenant_b).depositar(
        fingerprint=fp, workflow="AfipFacturaWorkflow", error_type="TimeoutError",
        costura="activity_interceptor")

    filas = resumen_errores(_factory_consola, estado="pendiente")
    fila = next(f for f in filas if f["fingerprint"] == fp)
    assert fila["tenants_afectados"] == 2
    assert fila["dedupe_count"] == 2  # el representante es el tenant con más ocurrencias
    assert fila["workflow"] == "AfipFacturaWorkflow"
    assert fila["estado"] == "pendiente"


@necesita_pg
@necesita_rol_consola
def test_resumen_errores_NO_expone_contexto_completo_ni_sintoma_no_tecnico(conn_de_tenant, nuevo_tenant):
    """ADVERSARIAL de boundary -- SPECS §2 "telemetría sí, contenido no". Un trauma de origen
    `feedback_intake` guarda `sintoma_no_tecnico` en `contexto` (texto libre del emprendedor,
    `soporte_feedback_activities.py:93`). La consola NO puede filtrarlo."""
    tenant = nuevo_tenant()
    fp = f"feedback:{uuid.uuid4().hex[:8]}"
    secreto = "mi CUIT es 20-12345678-9 y no puedo facturar"
    TraumaStore(conn_de_tenant(tenant), tenant).depositar(
        fingerprint=fp, workflow="soporte_feedback", error_type="TicketDeSoporte",
        costura="feedback_intake",
        contexto={"categoria": "business_error", "sintoma_no_tecnico": secreto, "origen": "x"})

    filas = resumen_errores(_factory_consola, estado="pendiente")
    fila = next(f for f in filas if f["fingerprint"] == fp)
    assert "contexto" not in fila
    assert "sintoma_no_tecnico" not in fila
    assert secreto not in "".join(str(v) for v in fila.values())


@necesita_pg
@necesita_rol_consola
def test_resumen_errores_expone_la_ultima_nota_de_autosanacion(conn_de_tenant, nuevo_tenant):
    """`ultima_nota` SÍ se expone -- es la nota de la autosanación sobre SU PROPIO intento
    (motivo de gate/auditor/tests, o URL del PR), no contenido del emprendedor."""
    tenant = nuevo_tenant()
    fp = f"test-fp-{uuid.uuid4().hex[:8]}"
    factory = conn_de_tenant(tenant)
    TraumaStore(factory, tenant).depositar(
        fingerprint=fp, workflow="AfipFacturaWorkflow", error_type="TimeoutError",
        costura="activity_interceptor")

    conn = factory()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE uc_factory.copiloto_traumas SET contexto = coalesce(contexto, '{}'::jsonb) "
                "|| %s::jsonb WHERE cliente_id = %s AND fingerprint = %s",
                ('{"ultima_nota": "rechazado_por_gate: dominio prohibido"}', tenant, fp))
        conn.commit()
    finally:
        conn.close()

    filas = resumen_errores(_factory_consola, estado="pendiente")
    fila = next(f for f in filas if f["fingerprint"] == fp)
    assert fila["ultima_nota"] == "rechazado_por_gate: dominio prohibido"


@necesita_pg
@necesita_rol_consola
def test_resumen_errores_filtra_por_estado(conn_de_tenant, nuevo_tenant):
    tenant = nuevo_tenant()
    fp_pendiente = f"test-fp-{uuid.uuid4().hex[:8]}"
    fp_resuelto = f"test-fp-{uuid.uuid4().hex[:8]}"
    store = TraumaStore(conn_de_tenant(tenant), tenant)
    store.depositar(fingerprint=fp_pendiente, workflow="w", error_type="E", costura="c")
    store.depositar(fingerprint=fp_resuelto, workflow="w", error_type="E", costura="c")

    fila_resuelta = next(f for f in store.listar() if f["fingerprint"] == fp_resuelto)
    assert store.cerrar(fila_resuelta["id"], estado=RESUELTO)

    filas_pendientes = resumen_errores(_factory_consola, estado="pendiente")
    assert any(f["fingerprint"] == fp_pendiente for f in filas_pendientes)
    assert not any(f["fingerprint"] == fp_resuelto for f in filas_pendientes)

    filas_resueltas = resumen_errores(_factory_consola, estado="resuelto")
    assert any(f["fingerprint"] == fp_resuelto for f in filas_resueltas)


@necesita_pg
def test_resumen_errores_con_conexion_de_tenant_NO_ve_cross_tenant(conn_de_tenant, nuevo_tenant):
    """ADVERSARIAL -- conexión normal (RLS `FORCE`, sin `BYPASSRLS`) sólo ve su propio tenant, aunque
    el mismo fingerprint tenga ocurrencias de otro."""
    tenant_a, tenant_b = nuevo_tenant(), nuevo_tenant()
    fp = f"test-fp-{uuid.uuid4().hex[:8]}"
    TraumaStore(conn_de_tenant(tenant_a), tenant_a).depositar(
        fingerprint=fp, workflow="w", error_type="E", costura="c")
    TraumaStore(conn_de_tenant(tenant_b), tenant_b).depositar(
        fingerprint=fp, workflow="w", error_type="E", costura="c")

    filas = resumen_errores(conn_de_tenant(tenant_a), estado="pendiente")
    fila = next(f for f in filas if f["fingerprint"] == fp)
    assert fila["tenants_afectados"] == 1
