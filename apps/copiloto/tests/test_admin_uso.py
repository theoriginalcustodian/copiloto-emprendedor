"""CONS2 · A3 — `admin_uso.resumen_uso`, contra Postgres real vía el rol `copiloto_consola`.

Las 3 queries son las de `queries/metering_dashboard.sql` (BETA-1b) sin reescribir -- este test
verifica que corren igual desde `copiloto_consola` (rol acotado) que desde el superuser que el
.sql documenta como único camino hasta CONS0a.
"""
from __future__ import annotations

import os
import uuid

import psycopg2
import pytest

from admin_uso import resumen_uso

necesita_pg = pytest.mark.skipif(not os.environ.get("DATABASE_URL"),
                                 reason="requiere Postgres real (DATABASE_URL)")
necesita_rol_consola = pytest.mark.skipif(
    not os.environ.get("COPILOTO_CONSOLA_DSN"),
    reason="requiere el rol de lectura de la Consola (BYPASSRLS): levantá la base con "
           "`test-db.sh --export` y pasá COPILOTO_CONSOLA_DSN a sync-test-backend.sh")


def _sembrar(conn_de_tenant, cliente_id: str, marca: str, *, tokens: int, tool_error: bool):
    conn = conn_de_tenant(cliente_id)()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO uc_factory.copiloto_metering (cliente_id, session_id, model, tokens, evento) "
                "VALUES (%s, %s, %s, %s, 'llm_turno')", (cliente_id, marca, "gpt-4o-mini", tokens))
            cur.execute(
                "INSERT INTO uc_factory.copiloto_metering (cliente_id, session_id, model, tokens, evento) "
                "VALUES (%s, %s, %s, NULL, %s)",
                (cliente_id, marca, "tool:facturar", "tool_call:error" if tool_error else "tool_call:ok"))
    finally:
        conn.close()


@necesita_pg
@necesita_rol_consola
def test_resumen_uso_agrega_cross_tenant(conn_de_tenant):
    tenant_a, tenant_b = str(uuid.uuid4()), str(uuid.uuid4())
    marca = f"test-uso-{uuid.uuid4().hex[:8]}"
    _sembrar(conn_de_tenant, tenant_a, marca, tokens=100, tool_error=True)
    _sembrar(conn_de_tenant, tenant_b, marca, tokens=50, tool_error=False)

    def factory_consola():
        return psycopg2.connect(os.environ["COPILOTO_CONSOLA_DSN"])

    r = resumen_uso(factory_consola, horas=24)

    gasto_por_tenant = {f["cliente_id"]: f for f in r["gasto_llm"]}
    assert gasto_por_tenant[tenant_a]["turnos_llm"] == 1
    assert gasto_por_tenant[tenant_a]["tokens_totales"] == 100
    assert gasto_por_tenant[tenant_b]["tokens_totales"] == 50

    tools_a = [f for f in r["uso_tools"] if f["cliente_id"] == tenant_a]
    assert any(f["tool"] == "facturar" and f["llamadas"] == 1 for f in tools_a)

    error_rate = {f["cliente_id"]: f for f in r["error_rate_tools"]}
    assert error_rate[tenant_a]["errores"] == 1
    assert error_rate[tenant_a]["error_rate_pct"] == 100.0
    assert error_rate[tenant_b]["errores"] == 0


@necesita_pg
def test_resumen_uso_con_conexion_de_tenant_NO_ve_cross_tenant(conn_de_tenant):
    """ADVERSARIAL -- si alguien llama `resumen_uso` con la conexión normal de un tenant (RLS
    `FORCE`, sin `BYPASSRLS`), tiene que ver A LO SUMO lo suyo, nunca lo de otro tenant."""
    tenant_a, tenant_b = str(uuid.uuid4()), str(uuid.uuid4())
    marca = f"test-aisl-uso-{uuid.uuid4().hex[:8]}"
    _sembrar(conn_de_tenant, tenant_a, marca, tokens=10, tool_error=False)
    _sembrar(conn_de_tenant, tenant_b, marca, tokens=10, tool_error=False)

    r = resumen_uso(conn_de_tenant(tenant_a), horas=24)
    clientes_vistos = {f["cliente_id"] for f in r["gasto_llm"]}
    assert tenant_b not in clientes_vistos
