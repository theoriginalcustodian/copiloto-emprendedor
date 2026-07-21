"""Spike de onboarding — genera un certificado REAL de homologación con las credenciales del operador.

Cierra el hueco que quedó abierto en F3: todo lo probado hasta ahora usaba el CUIT de testing
compartido de AfipSDK, que **ya viene con certificado**. Un emprendedor real llega sin nada y el alta
tiene que generarlo por RPA contra el portal de ARCA. Ese tramo nunca se había ejercitado.

Ejercita el código REAL de F3 (`AfipGateway.crear_certificado` / `autorizar_web_service`), no un
script paralelo: si esto anda, anda lo que se va a deployar.

⚠️ **Ambiente: `dev` (homologación).** Un certificado de homologación no tiene efecto fiscal.
⚠️ Nunca imprime la clave ni el contenido del certificado: sólo si existen y su longitud.

Uso (VPS):
    AFIP_ACCESS_TOKEN=$(cat /root/.secrets/afip-spike.token) \
    /opt/uc-afip-spike-venv/bin/python spike_onboarding.py
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

CREDENCIALES = Path("/root/.secrets/afip-david.txt")
ALIAS = "copilotoemprendedor"  # sin guiones: AfipSDK sólo acepta letras y números
OUT = Path(__file__).parent / "out"


def leer_credenciales() -> tuple[str, str]:
    usuario = clave = ""
    for linea in CREDENCIALES.read_text(encoding="utf-8").splitlines():
        if ":" not in linea:
            continue
        etiqueta, _, valor = linea.partition(":")
        etiqueta = etiqueta.strip().lower()
        if etiqueta.startswith("usuario"):
            usuario = valor.strip()
        elif etiqueta.startswith("clave"):
            clave = valor.strip()
    if not (usuario and clave):
        raise SystemExit("no se pudieron leer usuario/clave del archivo")
    return usuario, clave


def main() -> int:
    OUT.mkdir(exist_ok=True)
    usuario, clave = leer_credenciales()
    cuit = usuario  # en AFIP el usuario de la clave fiscal ES el CUIT
    print(f"CUIT: {cuit} · clave: {'*' * len(clave)} (longitud {len(clave)})")

    from afip_gateway import AfipGateway, ErrorAfip

    gateway = AfipGateway(cuit=cuit)

    print("\n[1] control — estado del web service")
    try:
        print(f"    {gateway.estado_servicio()}")
    except ErrorAfip as exc:
        print(f"    ❌ el CONTROL falló: {exc}")
        print("    → lo roto es el token o la red, no el onboarding. Se aborta.")
        return 1

    print("\n[2] generar certificado (RPA de AfipSDK — puede tardar ~2 min)")
    try:
        data = gateway.crear_certificado(usuario=usuario, clave=clave, alias=ALIAS)
    except ErrorAfip as exc:
        print(f"    ❌ {exc}")
        return 1

    cert, key = data.get("cert"), data.get("key")
    print(f"    cert recibido: {bool(cert)} (largo {len(cert or '')})")
    print(f"    key recibida:  {bool(key)} (largo {len(key or '')})")
    if not (cert and key):
        print(f"    ❌ respuesta sin certificado: claves={list(data)}")
        return 1
    print(f"    cert empieza con: {(cert or '')[:27]}...")

    print("\n[3] autorizar wsfe")
    try:
        auth = gateway.autorizar_web_service(usuario=usuario, clave=clave, alias=ALIAS, wsid="wsfe")
        print(f"    ok: {json.dumps(auth)[:200]}")
    except ErrorAfip as exc:
        print(f"    ❌ {exc}")
        return 1

    print("\n[4] ¿el certificado puede facturar? — último comprobante con el cert nuevo")
    g2 = AfipGateway(cuit=cuit, cert=cert, key=key)
    try:
        ultimo = g2.ultimo_comprobante(punto_venta=1, tipo_cbte=11)
        print(f"    último nº de Factura C en pto vta 1: {ultimo}")
    except ErrorAfip as exc:
        print(f"    ⚠️ no se pudo consultar: {exc}")
        ultimo = None

    # El certificado se guarda para el E2E siguiente. chmod 600, fuera del repo.
    destino = Path("/root/.secrets/afip-david-cert.json")
    destino.write_text(json.dumps({"cuit": cuit, "cert": cert, "key": key}), encoding="utf-8")
    destino.chmod(0o600)
    print(f"\n✅ ONBOARDING OK — certificado guardado en {destino} (chmod 600, fuera del repo)")
    print(f"   último comprobante: {ultimo}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
