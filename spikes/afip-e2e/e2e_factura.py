"""E2E de facturación: emitir → PDF → anular con nota de crédito → consultar. Contra AFIP REAL.

Ejercita el camino completo por donde va a pasar la app: los workflows de Temporal, las activities
reales, el gateway real, el certificado real del emprendedor y la base real. Sin mocks en ningún tramo.

⚠️ **Ambiente: homologación.** Los comprobantes que emite no tienen efecto fiscal.

Uso (VPS):
    set -a; . /etc/unreal-copilot/fusion-pg.env; . /etc/unreal-copilot/copiloto.env; set +a
    AFIP_ACCESS_TOKEN=$(cat /root/.secrets/afip-spike.token) \
    /opt/uc-copiloto-venv/bin/python e2e_factura.py
"""
from __future__ import annotations

import asyncio
import json
import os
import sys
import uuid
from datetime import date, timedelta
from pathlib import Path

sys.path.insert(0, "/opt/uc-spikes/afip-wt/apps/copiloto")
# El motor vendorizado se monta por el mecanismo único del repo (`_paths.MOTOR_REF`), nunca con
# sys.path.insert sueltos — es la regla que la Fase 1 de la graduación dejó asentada.
from _paths import ensure_paths  # noqa: E402

ensure_paths()

CERT_JSON = Path("/root/.secrets/afip-david-cert.json")
PUNTO_VENTA = 1
TIPO_FACTURA_C = 11
IMPORTE = "1000.00"

# Perfil fiscal de PRUEBA. En homologación el PDF no tiene valor fiscal, así que estos datos son
# ilustrativos — en producción salen de lo que el emprendedor cargó en Ajustes.
PERFIL_PRUEBA = {
    "razon_social": "PRUEBA COPILOTO EMPRENDEDOR",
    "domicilio_comercial": "Av. Siempreviva 742, CABA",
    "condicion_iva": "monotributo",
    "ingresos_brutos": "20-26999606-5",
    "inicio_actividades": date(2020, 1, 1),
    "punto_venta": PUNTO_VENTA,
}


def paso(n, texto):
    print(f"\n{'=' * 72}\n[{n}] {texto}\n{'=' * 72}", flush=True)


async def main() -> int:
    import psycopg2
    from temporalio.client import Client
    from temporalio.worker import Worker

    import afip_factura_activities as facts
    from afip_anulacion_workflow import AnulacionWorkflow
    from afip_comprobante_store import AfipComprobanteStore
    from afip_credential_store import AfipCredentialStore, AfipPerfilStore
    from afip_factura_workflow import FacturaWorkflow
    from afip_gateway import AfipGateway
    from clients.agent.providers.crypto import FernetCrypto

    if not CERT_JSON.exists():
        print(f"❌ falta {CERT_JSON}: corré antes el spike de onboarding")
        return 2
    datos = json.loads(CERT_JSON.read_text(encoding="utf-8"))
    cuit = str(datos["cuit"])

    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    conn.autocommit = True
    conn_factory = lambda: conn  # noqa: E731
    crypto = FernetCrypto()
    cliente_id = str(uuid.uuid4())
    print(f"tenant de prueba: {cliente_id} · CUIT {cuit} · homologación")

    paso(1, "sembrar certificado y perfil fiscal del tenant")
    AfipCredentialStore(conn_factory, cliente_id, crypto).save(
        cuit, cert=datos["cert"], key=datos["key"], ambiente="dev", ws_autorizados=["wsfe"])
    AfipPerfilStore(conn_factory, cliente_id).save(cuit, **PERFIL_PRUEBA)
    print("    certificado cifrado + perfil guardados")

    facts.set_factura_deps(
        lambda c, cert, key: AfipGateway(cuit=c, cert=cert, key=key),
        lambda cid: AfipCredentialStore(conn_factory, cid, crypto),
        lambda cid: AfipPerfilStore(conn_factory, cid),
        lambda cid: AfipComprobanteStore(conn_factory, cid),
    )

    client = await Client.connect(os.environ.get("TEMPORAL_ADDRESS", "127.0.0.1:7233"))
    cola = f"afip-e2e-{uuid.uuid4()}"
    activities = [facts.cargar_contexto_factura, facts.emitir_comprobante,
                  facts.generar_pdf_comprobante, facts.buscar_comprobante,
                  facts.listar_comprobantes, facts.marcar_comprobante_anulado]

    resultado_final = 1
    async with Worker(client, task_queue=cola,
                      workflows=[FacturaWorkflow, AnulacionWorkflow], activities=activities):
        paso(2, "arrancar FacturaWorkflow y cargar los datos por signals")
        idem = f"e2e-{uuid.uuid4()}"
        wf = await client.start_workflow(
            FacturaWorkflow.run, args=[cliente_id, cuit, idem],
            id=f"factura-{cliente_id}-{idem}", task_queue=cola)

        await wf.signal(FacturaWorkflow.cargar_datos_venta,
                        {"fecha": date.today().isoformat(), "concepto": 1,
                         "condicion_venta": "Contado"})
        await wf.signal(FacturaWorkflow.agregar_item,
                        {"descripcion": "Servicio de prueba E2E", "cantidad": "1",
                         "precio_unitario": IMPORTE})
        await wf.signal(FacturaWorkflow.cargar_cliente, {"condicion_iva": 5, "tipo_doc": 99})

        # Los signals pueden llegar ANTES de que termine `cargar_contexto_factura` (el perfil todavía
        # es None y el validador reporta `perfil_ausente`). El workflow recalcula solo al asignarlo, así
        # que se espera a que converja en vez de leer el primer estado que aparezca.
        for _ in range(40):
            estado = await wf.query(FacturaWorkflow.estado)
            if estado["estado"] == "esperando_confirmacion":
                break
            await asyncio.sleep(0.25)
        print(f"    estado: {estado['estado']} · total: {estado['total']}")
        print(f"    faltantes: {[e['codigo'] for e in estado['faltantes']]}")
        if estado["estado"] != "esperando_confirmacion":
            print(f"    ❌ no llegó a esperar confirmación: {estado}")
            return 1

        paso(3, "gate HITL — primero un token INVÁLIDO (debe ser no-op)")
        await wf.signal(FacturaWorkflow.confirmar, "token-falso")
        est = await wf.query(FacturaWorkflow.estado)
        if est["estado"] != "esperando_confirmacion":
            print("    ❌ un token inválido hizo avanzar el workflow")
            return 1
        print(f"    ✅ rechazado, sigue esperando · motivo: {est['motivo']}")

        paso(4, "confirmar con el token correcto → EMITIR EN AFIP")
        await wf.signal(FacturaWorkflow.confirmar, estado["token_confirmacion"])
        final = await wf.result()
        print(f"    estado final: {final['estado']}")
        print(f"    resultado: {json.dumps(final.get('resultado'), indent=6)}")
        print(f"    pdf: {json.dumps(final.get('pdf'), indent=6)}")
        if final["estado"] != "entregada":
            print(f"    ❌ no llegó a ENTREGADA · motivo: {final.get('motivo')}")
            return 1

        emitida = final["resultado"]
        nro_factura = int(emitida["nro"])
        print(f"    ✅ FACTURA EMITIDA · CAE {emitida['cae']} · N° {PUNTO_VENTA:04d}-{nro_factura:08d}")

        paso(5, "anular con nota de crédito")
        idem_nc = f"e2e-nc-{uuid.uuid4()}"
        wf_nc = await client.start_workflow(
            AnulacionWorkflow.run,
            args=[cliente_id, cuit, TIPO_FACTURA_C, PUNTO_VENTA, nro_factura, idem_nc],
            id=f"anulacion-{cliente_id}-{idem_nc}", task_queue=cola)

        for _ in range(30):
            est_nc = await wf_nc.query(AnulacionWorkflow.estado)
            if est_nc["paso"] == "esperando_confirmacion":
                break
            await asyncio.sleep(0.5)
        print(f"    paso: {est_nc['paso']} · original: N° {est_nc['original']['nro']} "
              f"total {est_nc['original']['total']}")

        await wf_nc.signal(AnulacionWorkflow.confirmar)
        res_nc = await wf_nc.result()
        print(f"    paso final: {res_nc['paso']}")
        if res_nc["paso"] != "anulada":
            print(f"    ❌ no se anuló · motivo: {res_nc.get('motivo')}")
            return 1
        nro_nc = int(res_nc["resultado"]["nro"])
        print(f"    ✅ NOTA DE CRÉDITO EMITIDA · CAE {res_nc['resultado']['cae']} · N° {nro_nc}")

        paso(6, "consultar comprobantes — deben estar ambos, y la factura marcada anulada")
        listado = facts._listar_sync(cliente_id, cuit, 10)  # sync: es la función interna, no la activity
        for c in listado:
            print(f"    tipo {c['tipo_cbte']} · N° {c['nro']:>8} · {c['estado']:<13} "
                  f"· total {c['total']} · asoc {c['cbte_asoc_nro']}")
        original = [c for c in listado if c["nro"] == nro_factura]
        if not original or original[0]["estado"] != "anulada":
            print("    ❌ la factura original no quedó marcada como anulada")
            return 1
        if original[0]["cbte_asoc_nro"] != nro_nc:
            print("    ❌ la factura no apunta a la NC que la anuló")
            return 1

        paso(7, "adversarial — intentar anular DE NUEVO la misma factura")
        wf_nc2 = await client.start_workflow(
            AnulacionWorkflow.run,
            args=[cliente_id, cuit, TIPO_FACTURA_C, PUNTO_VENTA, nro_factura,
                  f"e2e-nc2-{uuid.uuid4()}"],
            id=f"anulacion2-{cliente_id}-{uuid.uuid4()}", task_queue=cola)
        res2 = await wf_nc2.result()
        if res2["paso"] != "fallida":
            print(f"    ❌ dejó anular dos veces la misma factura: {res2}")
            return 1
        print(f"    ✅ rechazado · {res2['errores'][0]['mensaje']}")

        resultado_final = 0

    paso("✔", "limpieza del tenant de prueba")
    with conn.cursor() as cur:
        for tabla in ("afip_credentials", "afip_perfil", "afip_comprobantes"):
            cur.execute(f"DELETE FROM uc_factory.{tabla} WHERE cliente_id=%s::uuid", (cliente_id,))
    print("    tenant de prueba borrado (los comprobantes en AFIP homologación quedan, es normal)")
    print(f"\n{'=' * 72}\n{'✅ E2E COMPLETO EN VERDE' if resultado_final == 0 else '❌ E2E FALLÓ'}\n{'=' * 72}")
    return resultado_final


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
