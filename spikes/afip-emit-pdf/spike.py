"""Spike desechable — emisión AFIP + PDF con QR, en Python, contra homologación real.

NO es código de producción. Valida los 3 supuestos críticos del handoff §8 antes de diseñar
el `AfipGateway`:

  S1. `afip.py` (SDK oficial) emite de verdad desde Python → ¿devuelve CAE?
  S2. ¿Cuál es el shape REAL de la respuesta del WS? (las docs no lo documentan)
  S3. ¿El template `invoice-c` de AfipSDK incrusta el QR, o hay que ir por modo custom?
      (el grep sobre los 18 templates dio 0 menciones de QR — hay que verlo, no asumirlo)

Doctrina aplicada: el paso 0 es un CONTROL. Si `getServerStatus` falla, lo roto es el token o
la red — NO la emisión. Sin control, un error en el paso 2 se explica mal.

Uso (en el VPS, nunca en la PC):
    AFIP_ACCESS_TOKEN=... /opt/uc-afip-spike-venv/bin/python spike.py
"""

from __future__ import annotations

import base64
import json
import os
import sys
import traceback
from datetime import datetime, timezone
from pathlib import Path

OUT = Path(__file__).parent / "out"
OUT.mkdir(exist_ok=True)

# CUIT de testing compartido de AfipSDK — no requiere certificado propio en modo dev.
CUIT_TESTING = 20409378472
PTO_VTA = 1  # en homologación AfipSDK solo acepta el 1
CBTE_TIPO_FACTURA_C = 11

resultados: dict[str, object] = {}


def paso(nombre: str):
    """Decorador chico: corre el paso, captura el error, y sigue. Snapshot, no stream."""

    def wrap(fn):
        def inner(*a, **kw):
            print(f"\n{'=' * 70}\n[{nombre}]\n{'=' * 70}")
            try:
                r = fn(*a, **kw)
                resultados[nombre] = {"ok": True, "data": r}
                return r
            except Exception as e:  # noqa: BLE001 — es un spike: queremos TODOS los fallos
                print(f"❌ FALLÓ: {type(e).__name__}: {e}")
                traceback.print_exc()
                resultados[nombre] = {"ok": False, "error": f"{type(e).__name__}: {e}"}
                return None

        return inner

    return wrap


def dump(nombre: str, obj) -> None:
    p = OUT / f"{nombre}.json"
    p.write_text(json.dumps(obj, indent=2, ensure_ascii=False, default=str), encoding="utf-8")
    print(f"   → volcado en {p.name}")


# ---------------------------------------------------------------------------
# Paso 0 — CONTROL. Si esto falla, no hay nada que interpretar más abajo.
# ---------------------------------------------------------------------------
@paso("0_control_server_status")
def control(afip):
    st = afip.ElectronicBilling.getServerStatus()
    print(f"   estado del WS: {st}")
    dump("0_server_status", st)
    return st


@paso("1_estado_previo")
def estado_previo(afip):
    puntos = afip.ElectronicBilling.getSalesPoints()
    print(f"   puntos de venta: {puntos}")
    ultimo = afip.ElectronicBilling.getLastVoucher(PTO_VTA, CBTE_TIPO_FACTURA_C)
    print(f"   último nº de Factura C en pto vta {PTO_VTA}: {ultimo}")
    dump("1_estado_previo", {"sales_points": puntos, "last_voucher": ultimo})
    return {"sales_points": puntos, "last_voucher": ultimo}


# ---------------------------------------------------------------------------
# Paso 2 — S1 + S2: emitir de verdad y ver el shape completo de la respuesta.
# ---------------------------------------------------------------------------
@paso("2_emitir_factura_c")
def emitir(afip):
    hoy = datetime.now(timezone.utc).strftime("%Y%m%d")
    importe = 1.0

    data = {
        "CantReg": 1,
        "PtoVta": PTO_VTA,
        "CbteTipo": CBTE_TIPO_FACTURA_C,
        "Concepto": 1,  # productos
        "DocTipo": 99,  # consumidor final
        "DocNro": 0,
        "CbteFch": int(hoy),
        "ImpTotal": importe,
        "ImpTotConc": 0,
        "ImpNeto": importe,  # en Factura C el neto ES el total
        "ImpOpEx": 0,
        "ImpIVA": 0,  # C no discrimina IVA
        "ImpTrib": 0,
        "MonId": "PES",
        "MonCotiz": 1,
        # Guardrail RG 5616/2024: DocTipo 99 (consumidor final) ⇒ SIEMPRE Cond=5.
        # Mandar Cond=1 acá es el error 10243 que ARCA ya pagó.
        "CondicionIVAReceptorId": 5,
        # OJO: sin 'Iva': la clave se OMITE en Factura C (no va con array vacío).
    }
    print("   payload:")
    print(json.dumps(data, indent=4))

    # createNextVoucher resuelve CbteDesde/Hasta solo (getLastVoucher + 1).
    res = afip.ElectronicBilling.createNextVoucher(data)
    print(f"\n   ✅ respuesta createNextVoucher: {res}")
    dump("2_respuesta_next_voucher", res)
    return res


@paso("3_shape_respuesta_completa")
def shape_completo(afip, nro_emitido):
    """El shape Resultado/Observaciones/Errores NO está documentado. Lo miramos de frente."""
    info = afip.ElectronicBilling.getVoucherInfo(nro_emitido, PTO_VTA, CBTE_TIPO_FACTURA_C)
    print(f"   claves de getVoucherInfo: {list(info.keys()) if isinstance(info, dict) else type(info)}")
    print(json.dumps(info, indent=4, ensure_ascii=False, default=str)[:2000])
    dump("3_voucher_info", info)
    return info


# ---------------------------------------------------------------------------
# Paso 4 — S3: el QR. Texto según spec AFIP + imagen con segno.
# ---------------------------------------------------------------------------
def armar_texto_qr(*, cuit: int, pto_vta: int, cbte_tipo: int, nro: int, importe: float, cae: str, fecha: str) -> str:
    """Spec AFIP (QRespecificaciones.pdf): JSON → base64 → querystring `p` de la URL pública."""
    payload = {
        "ver": 1,
        "fecha": fecha,  # yyyy-mm-dd
        "cuit": cuit,
        "ptoVta": pto_vta,
        "tipoCmp": cbte_tipo,
        "nroCmp": nro,
        "importe": importe,
        "moneda": "PES",
        "ctz": 1,
        "tipoDocRec": 99,
        "nroDocRec": 0,
        "tipoCodAut": "E",  # E = CAE
        "codAut": int(cae),
    }
    b64 = base64.b64encode(json.dumps(payload).encode()).decode()
    return f"https://www.afip.gob.ar/fe/qr/?p={b64}"


@paso("4_pdf_template_invoice_c")
def pdf_template(afip, *, nro: int, cae: str, cae_vto: str):
    """¿El template oficial trae QR? El grep sobre los docs dio 0 — hay que MIRAR el PDF."""
    # [VERIFICADO 2026-07-21] el primer intento fue RECHAZADO con 400 y el error enumeró los
    # campos obligatorios reales del template — que son MÁS que los que documenta el handoff §3.2:
    #   · issue_date / cae_due_date en DD/MM/YYYY (NO ISO)
    #   · receiver_document_type y concept son ENTEROS (no strings legibles)
    #   · obligatorios extra: issuer_gross_income, issuer_activity_start_date, receiver_address,
    #     sale_condition, net_amount_taxed, net_amount_untaxed, exempt_amount
    def ddmmyyyy(s: str) -> str:
        """'2026-07-31' → '31/07/2026'. El WS devuelve ISO; el template exige DD/MM/YYYY."""
        return datetime.strptime(s, "%Y-%m-%d").strftime("%d/%m/%Y")

    hoy_ddmm = datetime.now(timezone.utc).strftime("%d/%m/%Y")
    data = {
        "file_name": "spike_template",
        "template": {
            "name": "invoice-c",
            "params": {
                "voucher_number": nro,
                "sales_point": PTO_VTA,
                "issue_date": hoy_ddmm,
                "cae_due_date": ddmmyyyy(cae_vto),
                "issuer_cuit": CUIT_TESTING,
                "cae": cae,
                "issuer_business_name": "SPIKE COPILOTO SRL",
                "issuer_address": "Calle Falsa 123, CABA",
                "issuer_iva_condition": "Responsable Monotributo",
                "issuer_gross_income": "20-40937847-2",
                "issuer_activity_start_date": "01/01/2020",
                "receiver_name": "Consumidor Final",
                "receiver_address": "-",
                "receiver_document_type": 99,
                "receiver_document_number": "0",
                "receiver_iva_condition": "Consumidor Final",
                "sale_condition": "Contado",
                "currency_id": "ARS",
                "currency_rate": 1,
                "concept": 1,
                "items": [
                    {"code": "001", "description": "Servicio de prueba del spike", "quantity": 1,
                     "unit_price": 1, "subtotal": 1}
                ],
                "net_amount_taxed": 0,
                "net_amount_untaxed": 1,
                "exempt_amount": 0,
                "vat_amount": 0,
                "tributes_amount": 0,
                "total_amount": 1,
            },
        },
    }
    res = afip.ElectronicBilling.createPDF(data)
    print(f"   respuesta createPDF (template): {res}")
    dump("4_pdf_template", res)
    return res


@paso("5_pdf_custom_con_qr")
def pdf_custom(afip, *, nro: int, cae: str, cae_vto: str):
    """Modo custom: HTML propio + QR embebido como data-URI. Es el plan B si el template no trae QR."""
    import segno  # noqa: PLC0415 — import local a propósito: si falta, el paso falla solo

    hoy_iso = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    texto_qr = armar_texto_qr(
        cuit=CUIT_TESTING, pto_vta=PTO_VTA, cbte_tipo=CBTE_TIPO_FACTURA_C,
        nro=nro, importe=1.0, cae=cae, fecha=hoy_iso,
    )
    print(f"   texto del QR: {texto_qr[:120]}...")
    (OUT / "5_qr_texto.txt").write_text(texto_qr, encoding="utf-8")

    import io
    buf = io.BytesIO()
    segno.make(texto_qr, error="m").save(buf, kind="png", scale=4)
    qr_b64 = base64.b64encode(buf.getvalue()).decode()

    html = f"""<html><head><meta charset="utf-8"><style>
      body {{ font-family: Helvetica, Arial, sans-serif; font-size: 12px; }}
      .caja {{ border: 1px solid #000; padding: 12px; }}
      .pie {{ margin-top: 24px; display: flex; align-items: center; gap: 16px; }}
    </style></head><body>
      <h2>FACTURA C — Nº {PTO_VTA:04d}-{nro:08d}</h2>
      <div class="caja">
        <p><b>CUIT emisor:</b> {CUIT_TESTING} · <b>Fecha:</b> {hoy_iso}</p>
        <p><b>Receptor:</b> Consumidor Final</p>
        <p><b>Total:</b> $1,00</p>
      </div>
      <div class="pie">
        <img src="data:image/png;base64,{qr_b64}" width="120" height="120" />
        <div><b>CAE:</b> {cae}<br/><b>Vto. CAE:</b> {cae_vto}</div>
      </div>
    </body></html>"""

    res = afip.ElectronicBilling.createPDF({
        "html": html,
        "file_name": "spike_custom",
        "options": {"width": 8, "marginLeft": 0.4, "marginRight": 0.4,
                    "marginTop": 0.4, "marginBottom": 0.4},
    })
    print(f"   respuesta createPDF (custom): {res}")
    dump("5_pdf_custom", res)
    return res


def main() -> int:
    token = os.environ.get("AFIP_ACCESS_TOKEN", "").strip()
    if not token:
        print("❌ falta AFIP_ACCESS_TOKEN en el entorno. Abortado (no hay nada que interpretar sin él).")
        return 2

    from afip import Afip

    afip = Afip({"CUIT": CUIT_TESTING, "access_token": token})
    print(f"instancia Afip creada · CUIT {CUIT_TESTING} · modo dev/homologación")

    if control(afip) is None:
        print("\n🛑 EL CONTROL FALLÓ → lo roto es el token o la conectividad, NO la emisión.")
        print("   No se interpretan los pasos siguientes. Se aborta.")
        dump("_resultados", resultados)
        return 1

    estado_previo(afip)

    res = emitir(afip)
    if not res:
        print("\n🛑 la emisión falló — S1 NO validado. Ver el traceback de arriba.")
        dump("_resultados", resultados)
        return 1

    cae = str(res.get("CAE") or res.get("cae") or "")
    cae_vto = str(res.get("CAEFchVto") or res.get("cae_vto") or "")
    # [VERIFICADO 2026-07-21 contra la respuesta real] la clave es camelCase `voucherNumber`.
    # La doc del SDK la nombra `voucher_number` — no le creas a la doc, esto salió del WS.
    nro = int(res.get("voucherNumber") or res.get("voucher_number") or 0)
    print(f"\n   → CAE={cae} · vto={cae_vto} · nº={nro}")

    if nro:
        shape_completo(afip, nro)
    if cae and nro:
        pdf_template(afip, nro=nro, cae=cae, cae_vto=cae_vto)
        pdf_custom(afip, nro=nro, cae=cae, cae_vto=cae_vto)

    dump("_resultados", resultados)
    print(f"\n{'=' * 70}\nRESUMEN\n{'=' * 70}")
    for k, v in resultados.items():
        print(f"  {'✅' if v.get('ok') else '❌'}  {k}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
