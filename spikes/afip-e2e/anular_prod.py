"""Anulación puntual de una factura de PRODUCCIÓN por nota de crédito.

Existe porque el E2E de producción emitió una factura real y falló DESPUÉS, al generar el PDF,
dejándola viva. La factura ya tiene CAE y existe en AFIP: no se borra, se neutraliza con una NC.

Uso:
    CONFIRMO_PRODUCCION=si TENANT=<uuid> NRO=<n> python anular_prod.py
"""
from __future__ import annotations

import asyncio
import os
import sys
import uuid

sys.path.insert(0, "/opt/uc-spikes/afip-wt/apps/copiloto")
from _paths import ensure_paths  # noqa: E402

ensure_paths()

PUNTO_VENTA = 6
TIPO_FACTURA_C = 11


async def main() -> int:
    if os.environ.get("CONFIRMO_PRODUCCION") != "si":
        print("❌ falta CONFIRMO_PRODUCCION=si")
        return 2

    import psycopg2
    from temporalio.client import Client
    from temporalio.worker import Worker

    import afip_factura_activities as facts
    from afip_anulacion_workflow import AnulacionWorkflow
    from afip_comprobante_store import AfipComprobanteStore
    from afip_credential_store import AfipCredentialStore, AfipPerfilStore
    from afip_gateway import AfipGateway
    from clients.agent.providers.crypto import FernetCrypto

    cliente_id = os.environ["TENANT"]
    nro = int(os.environ["NRO"])

    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    conn.autocommit = True
    conn_factory = lambda: conn  # noqa: E731
    crypto = FernetCrypto()

    cuit = AfipCredentialStore(conn_factory, cliente_id, crypto).primer_cuit()
    print(f"tenant {cliente_id} · CUIT {cuit} · anulando N° {PUNTO_VENTA:04d}-{nro:08d}")

    facts.set_factura_deps(
        lambda c, cert, key: AfipGateway(cuit=c, cert=cert, key=key, production=True),
        lambda cid: AfipCredentialStore(conn_factory, cid, crypto),
        lambda cid: AfipPerfilStore(conn_factory, cid),
        lambda cid: AfipComprobanteStore(conn_factory, cid),
    )

    client = await Client.connect(os.environ.get("TEMPORAL_ADDRESS", "127.0.0.1:7233"))
    cola = f"afip-anular-{uuid.uuid4()}"
    async with Worker(client, task_queue=cola, workflows=[AnulacionWorkflow],
                      activities=[facts.buscar_comprobante, facts.emitir_comprobante,
                                  facts.marcar_comprobante_anulado, facts.listar_comprobantes,
                                  facts.cargar_contexto_factura, facts.generar_pdf_comprobante]):
        wf = await client.start_workflow(
            AnulacionWorkflow.run,
            args=[cliente_id, cuit, TIPO_FACTURA_C, PUNTO_VENTA, nro, f"rescate-{uuid.uuid4()}"],
            id=f"anulacion-rescate-{cliente_id}-{nro}-{uuid.uuid4()}", task_queue=cola)

        for _ in range(60):
            est = await wf.query(AnulacionWorkflow.estado)
            if est["paso"] in ("esperando_confirmacion", "fallida"):
                break
            await asyncio.sleep(0.25)
        if est["paso"] == "fallida":
            print(f"❌ {est.get('motivo')}")
            return 1
        print(f"    original: N° {est['original']['nro']} · total {est['original']['total']}")
        await wf.signal(AnulacionWorkflow.confirmar)
        res = await wf.result()

    if res["paso"] != "anulada":
        print(f"❌ no se anuló: {res.get('motivo')}")
        return 1
    print(f"✅ ANULADA · nota de crédito N° {res['resultado']['nro']} · CAE {res['resultado']['cae']}")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
