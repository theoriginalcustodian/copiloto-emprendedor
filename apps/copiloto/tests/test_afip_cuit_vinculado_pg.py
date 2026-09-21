"""K-02 (BL-C6) — adversarial contra Postgres REAL y RLS `FORCE`: el tenant A no puede «tomar prestado»
el vínculo AFIP del tenant B sólo por conocer su CUIT. Endpoint real + stores reales por tenant."""
from __future__ import annotations

import os
import uuid

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from afip_credential_store import AfipCredentialStore, AfipPerfilStore
from afip_web import create_afip_app

necesita_pg = pytest.mark.skipif(not os.environ.get("DATABASE_URL"),
                                 reason="requiere Postgres del VPS (DATABASE_URL)")

CUIT_A, CUIT_B = "20111111112", "27222222228"   # dígito verificador válido (422 si no)
PERFIL = {"razon_social": "Mi Emprendimiento", "domicilio_comercial": "Calle 1",
          "condicion_iva": "monotributo", "ingresos_brutos": "20-1-2",
          "inicio_actividades": "2020-01-01", "punto_venta": 1}


class _SinCifrar:
    def encrypt(self, s): return s
    def decrypt(self, s): return s


@pytest.fixture
def tenants(conn_de_tenant):
    a, b = str(uuid.uuid4()), str(uuid.uuid4())
    yield a, b
    for cid in (a, b):
        conn = conn_de_tenant(cid)()
        with conn.cursor() as cur:
            for t in ("afip_perfil", "afip_credentials"):
                cur.execute(f"DELETE FROM uc_factory.{t} WHERE cliente_id = %s", (cid,))
        conn.close()


def _cliente_de(tenant, conn_de_tenant):
    conn = conn_de_tenant(tenant)
    app_afip = create_afip_app(
        require_tenant=lambda: tenant,
        perfil_store_factory=lambda cid: AfipPerfilStore(conn, cid),
        cred_store_factory=lambda cid: AfipCredentialStore(conn, cid, _SinCifrar()),
        handoff_factory=lambda cid: None,
        start_onboarding=lambda *a, **k: "wf", consultar_onboarding=lambda *a, **k: {})
    app = FastAPI(); app.include_router(app_afip.router)
    return TestClient(app), AfipCredentialStore(conn, tenant, _SinCifrar())


@necesita_pg
def test_ADVERSARIAL_A_no_toma_prestado_el_CUIT_vinculado_de_B(conn_de_tenant, tenants):
    a, b = tenants
    _, cred_b = _cliente_de(b, conn_de_tenant)
    cli_a, cred_a = _cliente_de(a, conn_de_tenant)
    cred_b.save(CUIT_B, cert="cert-b", key="key-b")          # SÓLO B vinculó CUIT_B
    cred_a.save(CUIT_A, cert="cert-a", key="key-a")          # A tiene el suyo (CUIT activo)
    r = cli_a.post("/afip/perfil", json={**PERFIL, "cuit": CUIT_B})
    assert r.status_code == 409 and r.json()["detail"]["codigo"] == "cuit_no_vinculado"
    # control positivo: con su propio CUIT, A sí guarda (la denegación no es un 409 para todo)
    assert cli_a.post("/afip/perfil", json={**PERFIL, "cuit": CUIT_A}).status_code == 200
