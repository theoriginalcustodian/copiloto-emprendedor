"""E2E en PRODUCCIÓN: 2 facturas reales de $1000 + sus 2 notas de crédito.

🔴 **ESTO EMITE COMPROBANTES FISCALES REALES.** Autorizado explícitamente por el operador (2026-07-21),
con su CUIT, por un máximo de 2 facturas de $1000 que se anulan con nota de crédito a continuación.

Guardas duras, porque el costo de un error acá no es un test rojo:
  · `MAX_FACTURAS = 2` — el bucle no puede pasarse aunque alguien toque el resto del script.
  · Importe fijo en constante, no parametrizable por CLI.
  · Exige `CONFIRMO_PRODUCCION=si` en el entorno: no se dispara por una corrida distraída.
  · Cada factura se anula inmediatamente después de emitirse, no al final: si algo se rompe a mitad,
    no quedan facturas vivas sin su nota de crédito.

Usa el MISMO camino que la app: los workflows de Temporal, no llamadas sueltas al gateway.
"""
from __future__ import annotations

import asyncio
import json
import os
import sys
import uuid
from datetime import date
from pathlib import Path

sys.path.insert(0, "/opt/uc-spikes/afip-wt/apps/copiloto")
from _paths import ensure_paths  # noqa: E402

ensure_paths()

MAX_FACTURAS = 1  # ya se gastó 1 de las 2 autorizadas (emitida y anulada, N° 8)
IMPORTE = "1000.00"
PUNTO_VENTA = 6
TIPO_FACTURA_C = 11
ALIAS_PROD = "copilotoemprendedorprod"
CERT_PROD_JSON = Path("/root/.secrets/afip-david-cert-prod.json")
CREDENCIALES = Path("/root/.secrets/afip-david.txt")

# Datos fiscales REALES (constancia de monotributo del operador, categoría A, locaciones de servicios).
PERFIL_REAL = {
    "razon_social": "HUCK DAVID",
    "domicilio_comercial": "Leandro N. Alem 1101 Piso 5 Dpto B, Rosario, Santa Fe",
    "condicion_iva": "monotributo",
    "ingresos_brutos": "Régimen Simplificado",
    "inicio_actividades": date(2020, 6, 1),
    "punto_venta": PUNTO_VENTA,
}


def paso(n, texto):
    print(f"\n{'=' * 72}\n[{n}] {texto}\n{'=' * 72}", flush=True)


def leer_credenciales() -> tuple[str, str]:
    usuario = clave = ""
    for linea in CREDENCIALES.read_text(encoding="utf-8").splitlines():
        if ":" not in linea:
            continue
        etiqueta, _, valor = linea.partition(":")
        if etiqueta.strip().lower().startswith("usuario"):
            usuario = valor.strip()
        elif etiqueta.strip().lower().startswith("clave"):
            clave = valor.strip()
    return usuario, clave


async def main() -> int:
    if os.environ.get("CONFIRMO_PRODUCCION") != "si":
        print("❌ falta CONFIRMO_PRODUCCION=si. Esto emite comprobantes fiscales REALES.")
        return 2

    import psycopg2
    from temporalio.client import Client
    from temporalio.worker import Worker

    import afip_factura_activities as facts
    from afip_anulacion_workflow import AnulacionWorkflow
    from afip_comprobante_store import AfipComprobanteStore
    from afip_credential_store import AfipCredentialStore, AfipPerfilStore
    from afip_factura_workflow import FacturaWorkflow
    from afip_gateway import AfipGateway, ErrorAfip
    from clients.agent.providers.crypto import FernetCrypto

    usuario, clave = leer_credenciales()
    cuit = usuario

    paso(1, "certificado de PRODUCCIÓN")
    if CERT_PROD_JSON.exists():
        datos = json.loads(CERT_PROD_JSON.read_text(encoding="utf-8"))
        print("    ya existía (idempotente): se reusa")
    else:
        g = AfipGateway(cuit=cuit, production=True)
        try:
            cert_data = g.crear_certificado(usuario=usuario, clave=clave, alias=ALIAS_PROD)
        except ErrorAfip as exc:
            print(f"    ❌ {exc}")
            return 1
        if not (cert_data.get("cert") and cert_data.get("key")):
            print(f"    ❌ sin certificado: {list(cert_data)}")
            return 1
        print(f"    cert {len(cert_data['cert'])} chars · key {len(cert_data['key'])} chars")
        try:
            print(f"    ws-auth: {g.autorizar_web_service(usuario=usuario, clave=clave, alias=ALIAS_PROD, wsid='wsfe')}")
        except ErrorAfip as exc:
            print(f"    ⚠️ autorización wsfe: {exc}")
        datos = {"cuit": cuit, **cert_data}
        CERT_PROD_JSON.write_text(json.dumps(datos), encoding="utf-8")
        CERT_PROD_JSON.chmod(0o600)

    paso(2, f"verificar el punto de venta {PUNTO_VENTA} en producción")
    gprod = AfipGateway(cuit=cuit, cert=datos["cert"], key=datos["key"], production=True)
    try:
        print(f"    estado WS: {gprod.estado_servicio()}")
        ultimo = gprod.ultimo_comprobante(punto_venta=PUNTO_VENTA, tipo_cbte=TIPO_FACTURA_C)
        print(f"    último nº de Factura C en pto vta {PUNTO_VENTA}: {ultimo}")
    except ErrorAfip as exc:
        print(f"    ❌ el punto de venta no responde en producción: {exc}")
        return 1

    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    conn.autocommit = True
    conn_factory = lambda: conn  # noqa: E731
    crypto = FernetCrypto()
    cliente_id = str(uuid.uuid4())

    paso(3, "sembrar tenant con el certificado de producción y el perfil fiscal REAL")
    AfipCredentialStore(conn_factory, cliente_id, crypto).save(
        cuit, cert=datos["cert"], key=datos["key"], ambiente="prod", ws_autorizados=["wsfe"])
    AfipPerfilStore(conn_factory, cliente_id).save(cuit, **PERFIL_REAL)
    print(f"    tenant {cliente_id} · {PERFIL_REAL['razon_social']} · pto vta {PUNTO_VENTA}")

    facts.set_factura_deps(
        lambda c, cert, key: AfipGateway(cuit=c, cert=cert, key=key, production=True),
        lambda cid: AfipCredentialStore(conn_factory, cid, crypto),
        lambda cid: AfipPerfilStore(conn_factory, cid),
        lambda cid: AfipComprobanteStore(conn_factory, cid),
    )

    client = await Client.connect(os.environ.get("TEMPORAL_ADDRESS", "127.0.0.1:7233"))
    cola = f"afip-prod-{uuid.uuid4()}"
    activities = [facts.cargar_contexto_factura, facts.emitir_comprobante,
                  facts.generar_pdf_comprobante, facts.buscar_comprobante,
                  facts.listar_comprobantes, facts.marcar_comprobante_anulado]

    emitidas: list[dict] = []
    async with Worker(client, task_queue=cola,
                      workflows=[FacturaWorkflow, AnulacionWorkflow], activities=activities):
        for i in range(1, MAX_FACTURAS + 1):
            paso(f"4.{i}", f"FACTURA REAL {i}/{MAX_FACTURAS} — ${IMPORTE}")
            idem = f"prod-{uuid.uuid4()}"
            wf = await client.start_workflow(
                FacturaWorkflow.run, args=[cliente_id, cuit, idem],
                id=f"factura-{cliente_id}-{idem}", task_queue=cola)

            await wf.signal(FacturaWorkflow.cargar_datos_venta,
                            {"fecha": date.today().isoformat(), "concepto": 2,
                             "condicion_venta": "Contado",
                             "fecha_servicio_desde": date.today().isoformat(),
                             "fecha_servicio_hasta": date.today().isoformat(),
                             "fecha_vto_pago": date.today().isoformat()})
            await wf.signal(FacturaWorkflow.agregar_item,
                            {"descripcion": "Servicio de prueba de integracion", "cantidad": "1",
                             "precio_unitario": IMPORTE})
            await wf.signal(FacturaWorkflow.cargar_cliente, {"condicion_iva": 5, "tipo_doc": 99})

            estado = None
            for _ in range(40):
                estado = await wf.query(FacturaWorkflow.estado)
                if estado["estado"] == "esperando_confirmacion":
                    break
                await asyncio.sleep(0.25)
            if not estado or estado["estado"] != "esperando_confirmacion":
                print(f"    ❌ no llegó a confirmación: {estado}")
                return 1
            print(f"    resumen · total {estado['total']} · faltantes {[e['codigo'] for e in estado['faltantes']]}")

            await wf.signal(FacturaWorkflow.confirmar, estado["token_confirmacion"])
            final = await wf.result()
            if final["estado"] != "entregada":
                print(f"    ❌ {final.get('motivo')}")
                return 1
            res = final["resultado"]
            emitidas.append({**res, "pdf": (final.get("pdf") or {}).get("url")})
            print(f"    ✅ FACTURA REAL · CAE {res['cae']} · N° {PUNTO_VENTA:04d}-{int(res['nro']):08d}")
            print(f"       PDF: {(final.get('pdf') or {}).get('url')}")

            # Se anula ACÁ, no al final: si el script muere entre medio, no queda una factura viva.
            paso(f"5.{i}", f"anular la factura {i} con nota de crédito")
            idem_nc = f"prod-nc-{uuid.uuid4()}"
            wf_nc = await client.start_workflow(
                AnulacionWorkflow.run,
                args=[cliente_id, cuit, TIPO_FACTURA_C, PUNTO_VENTA, int(res["nro"]), idem_nc],
                id=f"anulacion-{cliente_id}-{idem_nc}", task_queue=cola)
            for _ in range(40):
                est = await wf_nc.query(AnulacionWorkflow.estado)
                if est["paso"] in ("esperando_confirmacion", "fallida"):
                    break
                await asyncio.sleep(0.25)
            if est["paso"] == "fallida":
                print(f"    ❌ no se puede anular: {est.get('motivo')}")
                return 1
            await wf_nc.signal(AnulacionWorkflow.confirmar)
            res_nc = await wf_nc.result()
            if res_nc["paso"] != "anulada":
                print(f"    ❌ {res_nc.get('motivo')}")
                return 1
            print(f"    ✅ NOTA DE CRÉDITO · CAE {res_nc['resultado']['cae']} · N° {res_nc['resultado']['nro']}")
            emitidas[-1]["nc"] = res_nc["resultado"]

    paso("6", "estado final — todas las facturas deben quedar anuladas")
    for c in facts._listar_sync(cliente_id, cuit, 20):
        print(f"    tipo {c['tipo_cbte']} · N° {c['nro']:>8} · {c['estado']:<13} · ${c['total']} · asoc {c['cbte_asoc_nro']}")

    vivas = [c for c in facts._listar_sync(cliente_id, cuit, 20)
             if c["tipo_cbte"] == TIPO_FACTURA_C and c["estado"] != "anulada"]
    if vivas:
        print(f"\n🔴 ATENCIÓN: quedaron {len(vivas)} facturas SIN anular: {[c['nro'] for c in vivas]}")
        return 1

    Path("/root/.secrets/afip-prod-resultado.json").write_text(
        json.dumps(emitidas, indent=2), encoding="utf-8")
    print(f"\n{'=' * 72}\n✅ PRODUCCIÓN OK — {len(emitidas)} facturas emitidas y anuladas\n{'=' * 72}")
    print(f"tenant de prueba: {cliente_id} (NO se borra: es el registro de comprobantes reales)")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
