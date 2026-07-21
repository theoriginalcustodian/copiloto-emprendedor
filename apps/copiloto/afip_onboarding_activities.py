"""Activities del alta de un emprendedor ante ARCA (capa CLIENTE).

Archivo SEPARADO del workflow, como `mp_refresh_activities`: el sandbox de Temporal recarga el archivo
del workflow en cada task, y las activities corren FUERA del sandbox → pueden importar el gateway y
psycopg2 con normalidad. I/O bloqueante vía `asyncio.to_thread` para no trabar el event loop del worker.

🔴 **Acá vive el único punto del sistema donde la clave fiscal existe en memoria.** Reglas que no se
negocian:
  1. La clave NUNCA es argumento de la activity — llega un `handle` opaco y se resuelve adentro.
     Los argumentos quedan en claro en el event history de Temporal, para siempre.
  2. Se consume una sola vez (`DELETE...RETURNING`) y se usa para las DOS llamadas (cert y ws-auth),
     porque AfipSDK la pide en ambas.
  3. El valor de retorno de la activity TAMPOCO puede contener la clave (también va al history).
  4. Ningún log, ningún mensaje de error, ninguna excepción encadenada la puede reflejar.
"""
from __future__ import annotations

import asyncio

from temporalio import activity

_gateway_factory = None
_cred_store_factory = None
_handoff_factory = None

# [VERIFICADO 2026-07-21 contra AFIP real] SIN guiones: AfipSDK rechaza el alta con
# `{"alias":"El campo Alias del certificado solo puede contener letras y numeros"}`.
# El valor anterior ("copiloto-emprendedor") habría fallado en la PRIMERA alta real de un usuario.
ALIAS_CERT = "copilotoemprendedor"


def set_onboarding_deps(gateway_factory, cred_store_factory, handoff_factory) -> None:
    """Inyecta las fábricas per-tenant. SYNC, se llama en el composition root del worker.

    - `gateway_factory(cuit)` -> AfipGateway
    - `cred_store_factory(cliente_id)` -> AfipCredentialStore
    - `handoff_factory(cliente_id)` -> AfipSecretHandoff
    """
    global _gateway_factory, _cred_store_factory, _handoff_factory
    _gateway_factory, _cred_store_factory, _handoff_factory = (
        gateway_factory, cred_store_factory, handoff_factory)


def _dar_de_alta_sync(cliente_id: str, cuit: str, handle: str) -> dict:
    """Consume el secreto, genera el certificado, autoriza wsfe y guarda todo cifrado.

    Devuelve un dict SIN datos sensibles: ni la clave, ni el certificado, ni la key privada. El
    certificado ya quedó guardado cifrado; el workflow sólo necesita saber si salió bien.

    NO es reintentable por diseño: el secreto es one-shot. Si esto falla a mitad, la clave ya se
    consumió y un reintento automático encontraría el handle vacío. Es preferible que el usuario
    reingrese la clave a mantener un secreto fiscal vivo en la base esperando un reintento.
    """
    handoff = _handoff_factory(cliente_id)
    clave = handoff.consume(handle)
    if clave is None:
        # El handle venció (TTL 15 min), ya se usó, o no es de este tenant. Los tres casos se ven igual
        # desde afuera a propósito: no confirmamos la existencia de un handle ajeno.
        return {"ok": False, "motivo": "handle_invalido_o_vencido"}

    try:
        gateway = _gateway_factory(cuit)
        cert_data = gateway.crear_certificado(
            usuario=cuit, clave=clave.revelar(), alias=ALIAS_CERT)

        cert = cert_data.get("cert")
        key = cert_data.get("key")
        if not (cert and key):
            return {"ok": False, "motivo": "afipsdk_no_devolvio_certificado"}

        gateway.autorizar_web_service(
            usuario=cuit, clave=clave.revelar(), alias=ALIAS_CERT, wsid="wsfe")

        _cred_store_factory(cliente_id).save(
            cuit, cert=cert, key=key, ambiente="dev", ws_autorizados=["wsfe"])
        return {"ok": True, "motivo": None, "ws_autorizados": ["wsfe"]}
    finally:
        # Defensa en profundidad: el `consume` ya borró la fila, pero si algo cambia en el futuro esto
        # garantiza que no quede un secreto vivo por un camino de excepción.
        del clave


@activity.defn
async def dar_de_alta_afip(cliente_id: str, cuit: str, handle: str) -> dict:
    """Alta completa ante ARCA. Larga (el RPA de AfipSDK puede tardar ~2 min por llamada)."""
    return await asyncio.to_thread(_dar_de_alta_sync, cliente_id, cuit, handle)


def _verificar_habilitacion_sync(cliente_id: str, cuit: str) -> dict:
    """¿El tenant quedó realmente en condiciones de facturar? Se pregunta al sistema, no a la memoria."""
    creds = _cred_store_factory(cliente_id).get(cuit)
    if not creds:
        return {"habilitado": False, "motivo": "sin_certificado"}
    if "wsfe" not in (creds.get("ws_autorizados") or []):
        return {"habilitado": False, "motivo": "wsfe_no_autorizado"}
    try:
        estado = _gateway_factory(cuit).estado_servicio()
    except Exception as exc:  # noqa: BLE001
        return {"habilitado": False, "motivo": f"ws_inaccesible: {exc}"}
    ok = all(estado.get(k) == "OK" for k in ("AppServer", "DbServer", "AuthServer"))
    return {"habilitado": ok, "motivo": None if ok else f"ws_degradado: {estado}"}


@activity.defn
async def verificar_habilitacion_afip(cliente_id: str, cuit: str) -> dict:
    return await asyncio.to_thread(_verificar_habilitacion_sync, cliente_id, cuit)


def _purgar_secretos_sync(cliente_id: str) -> int:
    return _handoff_factory(cliente_id).purgar_vencidos()


@activity.defn
async def purgar_secretos_vencidos(cliente_id: str) -> int:
    """Higiene: un secreto que nadie consumió no puede quedar esperando en la tabla."""
    return await asyncio.to_thread(_purgar_secretos_sync, cliente_id)
