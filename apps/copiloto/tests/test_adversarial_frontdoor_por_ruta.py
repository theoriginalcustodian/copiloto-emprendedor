"""Tests adversariales del FRONT-DOOR completo, una ruta tenant-scoped por test (auditoría de seguridad
2026-11-04, SEC-A2-2 / ratchet `_DEUDA_TENANT_SCOPED_SIN_TEST` 42 -> 0).

Una sola app (los MISMOS sub-apps que `serve.py`), dos tokens (A y B) y factories ESPÍA: cada una anota
el `cliente_id` con el que la invocan y aborta. Para cada ruta el actor hostil (A) prueba dos cosas:

  1. SIN identidad (sin Authorization) -> 401/403 y NINGUNA factory se ejecuta.
  2. Con el token de A pero inyectando el `cliente_id` de B (query `cliente_id`, header `X-Cliente-Id`
     y el id de un recurso de B en el path) -> toda factory que el handler alcance recibe el
     `cliente_id` de A, JAMÁS el de B. La identidad sale del token (regla 7 del CLAUDE.md).

LÍMITE DECLARADO: un handler que corta antes de tocar una factory (422 por body faltante) no ejercita
la mitad 2 para esa ruta. `test_control_positivo_*` prueba que el espía SÍ ve a cada tenant cuando el
handler llega a la capa de datos (un espía ciego nunca falla).
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass, field

import pytest
from fastapi import HTTPException, Request
from fastapi.testclient import TestClient

import web as web_module
from actividad_web import create_actividad_app
from admin_web import create_admin_app
from afip_web import create_afip_app
from clients.agent.channels.web import WebChannelAdapter
from clients.agent.providers.crypto import FernetCrypto
from clientes_web import create_clientes_app
from contabilidad_web import create_contabilidad_app
from contexto_tenant import declarar_tenant, tenant_actual
from gastos_web import create_gastos_app
from inteligencia_web import create_inteligencia_app
from mi_dia_web import create_mi_dia_app
from mp_web import create_mp_app
from presupuestos_web import create_presupuestos_app


@dataclass
class _Tenant:
    cliente_id: str
    token: str


@dataclass
class _Espia:
    vistos: list = field(default_factory=list)   # cliente_id con el que se invocó cada factory

    def factory(self, *args, **_kw):
        self.vistos.append(args[0] if args and isinstance(args[0], str) else tenant_actual())
        raise RuntimeError("factory-espia: el handler llegó a la capa de datos")

    def conn_factory(self):
        self.vistos.append(tenant_actual())
        raise RuntimeError("conn_factory-espia: el handler llegó a la capa de datos")


class _RequireTenantPorToken:
    def __init__(self, mapa: dict) -> None:
        self._mapa = mapa

    async def __call__(self, request: Request) -> str:
        esquema, _, token = request.headers.get("Authorization", "").partition(" ")
        if esquema.lower() != "bearer" or token not in self._mapa:
            raise HTTPException(status_code=401, detail="token invalido")
        declarar_tenant(self._mapa[token])
        return self._mapa[token]


class _GoTrueEspia:
    """Hace que `/auth/cambiar-*` se registren (sin gotrue responden 404). Cualquier llamada aborta."""

    def __init__(self, espia) -> None:
        self._espia = espia

    def __getattr__(self, nombre):
        def _llamada(*a, **k):
            self._espia.vistos.append(tenant_actual())
            raise RuntimeError(f"gotrue-espia: {nombre}")
        return _llamada


def _claims_por_token(rt):
    async def _dep(request: Request) -> dict:
        cid = await rt(request)
        return {"sub": cid, "email": f"{cid}@test.invalid"}
    return _dep


@pytest.fixture
def frontdoor(monkeypatch):
    monkeypatch.setenv("COPILOTO_FERNET_KEY", FernetCrypto.generate_key())
    sfx = uuid.uuid4().hex[:8]
    a = _Tenant(cliente_id=f"cid-A-{sfx}", token=f"TOKEN-A-{sfx}")
    b = _Tenant(cliente_id=f"cid-B-{sfx}", token=f"TOKEN-B-{sfx}")
    espia = _Espia()
    rt = _RequireTenantPorToken({a.token: a.cliente_id, b.token: b.cliente_id})
    f = espia.factory
    mp_app = create_mp_app(gateway=None, crypto=FernetCrypto(), cred_store_factory=f, payment_store_factory=f)
    app = web_module.create_web_app(
        temporal_client=None, adapter=WebChannelAdapter(reply_sink=lambda *x: None),
        conn_factory=espia.conn_factory, require_tenant=rt, mp_app=mp_app, gotrue=_GoTrueEspia(espia),
        mp_gateway=None, composio_gateway=None, require_claims=_claims_por_token(rt),
        afip_app=create_afip_app(require_tenant=rt, perfil_store_factory=f, cred_store_factory=f,
                                 handoff_factory=f, start_onboarding=f),
        presupuestos_app=create_presupuestos_app(require_tenant=rt, perfil_negocio_store_factory=f,
                                                 presupuesto_store_factory=f),
        gastos_app=create_gastos_app(require_tenant=rt, gasto_store_factory=f),
        clientes_app=create_clientes_app(require_tenant=rt, cliente_store_factory=f),
        contabilidad_app=create_contabilidad_app(require_tenant=rt, cobro_store_factory=f,
                                                 gasto_store_factory=f, afip_comprobante_store_factory=f),
        actividad_app=create_actividad_app(require_tenant=rt),
        inteligencia_app=create_inteligencia_app(require_tenant=rt, queries_factory=f),
        mi_dia_app=create_mi_dia_app(require_tenant=rt, tarjeta_store_factory=f),
        admin_app=create_admin_app(require_admin=lambda: None),
    )
    yield TestClient(app, raise_server_exceptions=False), espia, a, b
    declarar_tenant(None)


def _hostil(frontdoor, llamar) -> None:
    c, espia, a, b = frontdoor
    # 1) sin identidad: se rechaza y ninguna factory corre
    r = llamar(c)
    assert r.status_code in (401, 403), f"sin token respondió {r.status_code}"
    assert espia.vistos == [], "una factory corrió SIN identidad"
    # 2) A con el cliente_id de B inyectado por todos los canales posibles
    llamar(c, headers={"Authorization": f"Bearer {a.token}", "X-Cliente-Id": b.cliente_id},
           params={"cliente_id": b.cliente_id, "tenant": b.cliente_id})
    assert b.cliente_id not in espia.vistos, "el handler operó con el cliente_id de B"
    assert set(espia.vistos) <= {a.cliente_id, None}, f"identidades vistas: {set(espia.vistos)}"
    declarar_tenant(None)


@pytest.mark.parametrize("quien", ["a", "b"])
def test_control_positivo_el_espia_ve_al_tenant_del_token(frontdoor, quien):
    """Sin esto el «B nunca aparece» no distingue aislamiento de espía ciego: con el token de CADA
    tenant, al menos una ruta alcanza la capa de datos y el espía anota ESE cliente_id."""
    c, espia, a, b = frontdoor
    yo = a if quien == "a" else b
    otro = b if quien == "a" else a
    for ruta in ("/afip/estado", "/afip/comprobantes", "/inteligencia/portada", "/mi-dia/tablero"):
        c.get(ruta, headers={"Authorization": f"Bearer {yo.token}"})
    assert yo.cliente_id in espia.vistos, f"el espía no vio a {quien}: instrumento ciego ({espia.vistos})"
    assert otro.cliente_id not in espia.vistos
    declarar_tenant(None)


def test_adversarial_afip_ajustes_post(frontdoor):
    """POST /afip/ajustes: sin identidad -> 401; con el token de A y el cliente_id/recurso de B
    inyectados por query y header -> el servidor sólo opera como A."""
    _hostil(frontdoor, lambda c, **kw: c.post("/afip/ajustes", **kw))


def test_adversarial_afip_ambiente_post(frontdoor):
    """POST /afip/ambiente: sin identidad -> 401; con el token de A y el cliente_id/recurso de B
    inyectados por query y header -> el servidor sólo opera como A."""
    _hostil(frontdoor, lambda c, **kw: c.post("/afip/ambiente", **kw))


def test_adversarial_afip_anulaciones_anulacion_id_get(frontdoor):
    """GET /afip/anulaciones/{anulacion_id}: sin identidad -> 401; con el token de A y el cliente_id/recurso de B
    inyectados por query y header -> el servidor sólo opera como A."""
    _hostil(frontdoor, lambda c, **kw: c.get("/afip/anulaciones/id-ajeno-de-b", **kw))


def test_adversarial_afip_anulaciones_anulacion_id_confirmar_post(frontdoor):
    """POST /afip/anulaciones/{anulacion_id}/confirmar: sin identidad -> 401; con el token de A y el cliente_id/recurso de B
    inyectados por query y header -> el servidor sólo opera como A."""
    _hostil(frontdoor, lambda c, **kw: c.post("/afip/anulaciones/id-ajeno-de-b/confirmar", **kw))


def test_adversarial_afip_comprobantes_get(frontdoor):
    """GET /afip/comprobantes: sin identidad -> 401; con el token de A y el cliente_id/recurso de B
    inyectados por query y header -> el servidor sólo opera como A."""
    _hostil(frontdoor, lambda c, **kw: c.get("/afip/comprobantes", **kw))


def test_adversarial_afip_comprobantes_impagos_get(frontdoor):
    """GET /afip/comprobantes/impagos: sin identidad -> 401; con el token de A y el cliente_id/recurso de B
    inyectados por query y header -> el servidor sólo opera como A."""
    _hostil(frontdoor, lambda c, **kw: c.get("/afip/comprobantes/impagos", **kw))


def test_adversarial_afip_comprobantes_comprobante_id_get(frontdoor):
    """GET /afip/comprobantes/{comprobante_id}: sin identidad -> 401; con el token de A y el cliente_id/recurso de B
    inyectados por query y header -> el servidor sólo opera como A."""
    _hostil(frontdoor, lambda c, **kw: c.get("/afip/comprobantes/id-ajeno-de-b", **kw))


def test_adversarial_afip_comprobantes_comprobante_id_cobros_get(frontdoor):
    """GET /afip/comprobantes/{comprobante_id}/cobros: sin identidad -> 401; con el token de A y el cliente_id/recurso de B
    inyectados por query y header -> el servidor sólo opera como A."""
    _hostil(frontdoor, lambda c, **kw: c.get("/afip/comprobantes/id-ajeno-de-b/cobros", **kw))


def test_adversarial_afip_comprobantes_comprobante_id_cobros_post(frontdoor):
    """POST /afip/comprobantes/{comprobante_id}/cobros: sin identidad -> 401; con el token de A y el cliente_id/recurso de B
    inyectados por query y header -> el servidor sólo opera como A."""
    _hostil(frontdoor, lambda c, **kw: c.post("/afip/comprobantes/id-ajeno-de-b/cobros", **kw))


def test_adversarial_afip_comprobantes_comprobante_id_cobros_cobro_id_delete(frontdoor):
    """DELETE /afip/comprobantes/{comprobante_id}/cobros/{cobro_id}: sin identidad -> 401; con el token de A y el cliente_id/recurso de B
    inyectados por query y header -> el servidor sólo opera como A."""
    _hostil(frontdoor, lambda c, **kw: c.delete("/afip/comprobantes/id-ajeno-de-b/cobros/id-ajeno-de-b", **kw))


def test_adversarial_afip_conectar_post(frontdoor):
    """POST /afip/conectar: sin identidad -> 401; con el token de A y el cliente_id/recurso de B
    inyectados por query y header -> el servidor sólo opera como A."""
    _hostil(frontdoor, lambda c, **kw: c.post("/afip/conectar", **kw))


def test_adversarial_afip_estado_get(frontdoor):
    """GET /afip/estado: sin identidad -> 401; con el token de A y el cliente_id/recurso de B
    inyectados por query y header -> el servidor sólo opera como A."""
    _hostil(frontdoor, lambda c, **kw: c.get("/afip/estado", **kw))


def test_adversarial_afip_facturas_factura_id_cliente_post(frontdoor):
    """POST /afip/facturas/{factura_id}/cliente: sin identidad -> 401; con el token de A y el cliente_id/recurso de B
    inyectados por query y header -> el servidor sólo opera como A."""
    _hostil(frontdoor, lambda c, **kw: c.post("/afip/facturas/id-ajeno-de-b/cliente", **kw))


def test_adversarial_afip_facturas_factura_id_confirmar_post(frontdoor):
    """POST /afip/facturas/{factura_id}/confirmar: sin identidad -> 401; con el token de A y el cliente_id/recurso de B
    inyectados por query y header -> el servidor sólo opera como A."""
    _hostil(frontdoor, lambda c, **kw: c.post("/afip/facturas/id-ajeno-de-b/confirmar", **kw))


def test_adversarial_afip_facturas_factura_id_datos_venta_post(frontdoor):
    """POST /afip/facturas/{factura_id}/datos-venta: sin identidad -> 401; con el token de A y el cliente_id/recurso de B
    inyectados por query y header -> el servidor sólo opera como A."""
    _hostil(frontdoor, lambda c, **kw: c.post("/afip/facturas/id-ajeno-de-b/datos-venta", **kw))


def test_adversarial_afip_facturas_factura_id_items_post(frontdoor):
    """POST /afip/facturas/{factura_id}/items: sin identidad -> 401; con el token de A y el cliente_id/recurso de B
    inyectados por query y header -> el servidor sólo opera como A."""
    _hostil(frontdoor, lambda c, **kw: c.post("/afip/facturas/id-ajeno-de-b/items", **kw))


def test_adversarial_afip_facturas_factura_id_items_indice_delete(frontdoor):
    """DELETE /afip/facturas/{factura_id}/items/{indice}: sin identidad -> 401; con el token de A y el cliente_id/recurso de B
    inyectados por query y header -> el servidor sólo opera como A."""
    _hostil(frontdoor, lambda c, **kw: c.delete("/afip/facturas/id-ajeno-de-b/items/id-ajeno-de-b", **kw))


def test_adversarial_afip_perfil_get(frontdoor):
    """GET /afip/perfil: sin identidad -> 401; con el token de A y el cliente_id/recurso de B
    inyectados por query y header -> el servidor sólo opera como A."""
    _hostil(frontdoor, lambda c, **kw: c.get("/afip/perfil", **kw))


def test_adversarial_afip_perfil_post(frontdoor):
    """POST /afip/perfil: sin identidad -> 401; con el token de A y el cliente_id/recurso de B
    inyectados por query y header -> el servidor sólo opera como A."""
    _hostil(frontdoor, lambda c, **kw: c.post("/afip/perfil", **kw))


def test_adversarial_auth_cambiar_contrasena_post(frontdoor):
    """POST /auth/cambiar-contrasena: sin identidad -> 401; con el token de A y el cliente_id/recurso de B
    inyectados por query y header -> el servidor sólo opera como A."""
    _hostil(frontdoor, lambda c, **kw: c.post("/auth/cambiar-contrasena", **kw))


def test_adversarial_auth_cambiar_email_post(frontdoor):
    """POST /auth/cambiar-email: sin identidad -> 401; con el token de A y el cliente_id/recurso de B
    inyectados por query y header -> el servidor sólo opera como A."""
    _hostil(frontdoor, lambda c, **kw: c.post("/auth/cambiar-email", **kw))


def test_adversarial_capacidades_get(frontdoor):
    """GET /capacidades: sin identidad -> 401; con el token de A y el cliente_id/recurso de B
    inyectados por query y header -> el servidor sólo opera como A."""
    _hostil(frontdoor, lambda c, **kw: c.get("/capacidades", **kw))


def test_adversarial_chat_post(frontdoor):
    """POST /chat: sin identidad -> 401; con el token de A y el cliente_id/recurso de B
    inyectados por query y header -> el servidor sólo opera como A."""
    _hostil(frontdoor, lambda c, **kw: c.post("/chat", **kw))


def test_adversarial_chat_audio_post(frontdoor):
    """POST /chat/audio: sin identidad -> 401; con el token de A y el cliente_id/recurso de B
    inyectados por query y header -> el servidor sólo opera como A."""
    _hostil(frontdoor, lambda c, **kw: c.post("/chat/audio", **kw))


def test_adversarial_chat_foto_post(frontdoor):
    """POST /chat/foto: sin identidad -> 401; con el token de A y el cliente_id/recurso de B
    inyectados por query y header -> el servidor sólo opera como A."""
    _hostil(frontdoor, lambda c, **kw: c.post("/chat/foto", **kw))


def test_adversarial_composio_connect_get(frontdoor):
    """GET /composio/connect: sin identidad -> 401; con el token de A y el cliente_id/recurso de B
    inyectados por query y header -> el servidor sólo opera como A."""
    _hostil(frontdoor, lambda c, **kw: c.get("/composio/connect", **kw))


def test_adversarial_composio_connection_delete(frontdoor):
    """DELETE /composio/connection: sin identidad -> 401; con el token de A y el cliente_id/recurso de B
    inyectados por query y header -> el servidor sólo opera como A."""
    _hostil(frontdoor, lambda c, **kw: c.delete("/composio/connection", **kw))


def test_adversarial_feedback_audio_post(frontdoor):
    """POST /feedback/audio: sin identidad -> 401; con el token de A y el cliente_id/recurso de B
    inyectados por query y header -> el servidor sólo opera como A."""
    _hostil(frontdoor, lambda c, **kw: c.post("/feedback/audio", **kw))


def test_adversarial_gastos_leer_foto_post(frontdoor):
    """POST /gastos/leer-foto: sin identidad -> 401; con el token de A y el cliente_id/recurso de B
    inyectados por query y header -> el servidor sólo opera como A."""
    _hostil(frontdoor, lambda c, **kw: c.post("/gastos/leer-foto", **kw))


def test_adversarial_inteligencia_graficos_categorias_get(frontdoor):
    """GET /inteligencia/graficos/categorias: sin identidad -> 401; con el token de A y el cliente_id/recurso de B
    inyectados por query y header -> el servidor sólo opera como A."""
    _hostil(frontdoor, lambda c, **kw: c.get("/inteligencia/graficos/categorias", **kw))


def test_adversarial_inteligencia_graficos_entro_vs_salio_get(frontdoor):
    """GET /inteligencia/graficos/entro-vs-salio: sin identidad -> 401; con el token de A y el cliente_id/recurso de B
    inyectados por query y header -> el servidor sólo opera como A."""
    _hostil(frontdoor, lambda c, **kw: c.get("/inteligencia/graficos/entro-vs-salio", **kw))


def test_adversarial_inteligencia_graficos_facturacion_get(frontdoor):
    """GET /inteligencia/graficos/facturacion: sin identidad -> 401; con el token de A y el cliente_id/recurso de B
    inyectados por query y header -> el servidor sólo opera como A."""
    _hostil(frontdoor, lambda c, **kw: c.get("/inteligencia/graficos/facturacion", **kw))


def test_adversarial_inteligencia_graficos_margen_trabajo_get(frontdoor):
    """GET /inteligencia/graficos/margen-trabajo: sin identidad -> 401; con el token de A y el cliente_id/recurso de B
    inyectados por query y header -> el servidor sólo opera como A."""
    _hostil(frontdoor, lambda c, **kw: c.get("/inteligencia/graficos/margen-trabajo", **kw))


def test_adversarial_inteligencia_portada_get(frontdoor):
    """GET /inteligencia/portada: sin identidad -> 401; con el token de A y el cliente_id/recurso de B
    inyectados por query y header -> el servidor sólo opera como A."""
    _hostil(frontdoor, lambda c, **kw: c.get("/inteligencia/portada", **kw))


def test_adversarial_mi_dia_tablero_get(frontdoor):
    """GET /mi-dia/tablero: sin identidad -> 401; con el token de A y el cliente_id/recurso de B
    inyectados por query y header -> el servidor sólo opera como A."""
    _hostil(frontdoor, lambda c, **kw: c.get("/mi-dia/tablero", **kw))


def test_adversarial_mi_dia_tarjetas_post(frontdoor):
    """POST /mi-dia/tarjetas: sin identidad -> 401; con el token de A y el cliente_id/recurso de B
    inyectados por query y header -> el servidor sólo opera como A."""
    _hostil(frontdoor, lambda c, **kw: c.post("/mi-dia/tarjetas", **kw))


def test_adversarial_mi_dia_tarjetas_tarjeta_id_delete(frontdoor):
    """DELETE /mi-dia/tarjetas/{tarjeta_id}: sin identidad -> 401; con el token de A y el cliente_id/recurso de B
    inyectados por query y header -> el servidor sólo opera como A."""
    _hostil(frontdoor, lambda c, **kw: c.delete("/mi-dia/tarjetas/id-ajeno-de-b", **kw))


def test_adversarial_mi_dia_tarjetas_tarjeta_id_estado_patch(frontdoor):
    """PATCH /mi-dia/tarjetas/{tarjeta_id}/estado: sin identidad -> 401; con el token de A y el cliente_id/recurso de B
    inyectados por query y header -> el servidor sólo opera como A."""
    _hostil(frontdoor, lambda c, **kw: c.patch("/mi-dia/tarjetas/id-ajeno-de-b/estado", **kw))


def test_adversarial_mp_connect_get(frontdoor):
    """GET /mp/connect: sin identidad -> 401; con el token de A y el cliente_id/recurso de B
    inyectados por query y header -> el servidor sólo opera como A."""
    _hostil(frontdoor, lambda c, **kw: c.get("/mp/connect", **kw))


def test_adversarial_salud_canario_post(frontdoor):
    """POST /salud/canario: sin identidad -> 401; con el token de A y el cliente_id/recurso de B
    inyectados por query y header -> el servidor sólo opera como A."""
    _hostil(frontdoor, lambda c, **kw: c.post("/salud/canario", **kw))


def test_adversarial_soporte_chat_post(frontdoor):
    """POST /soporte/chat: sin identidad -> 401; con el token de A y el cliente_id/recurso de B
    inyectados por query y header -> el servidor sólo opera como A."""
    _hostil(frontdoor, lambda c, **kw: c.post("/soporte/chat", **kw))


def test_adversarial_soporte_chat_audio_post(frontdoor):
    """POST /soporte/chat/audio: sin identidad -> 401; con el token de A y el cliente_id/recurso de B
    inyectados por query y header -> el servidor sólo opera como A."""
    _hostil(frontdoor, lambda c, **kw: c.post("/soporte/chat/audio", **kw))


def test_adversarial_transcribir_post(frontdoor):
    """POST /transcribir: sin identidad -> 401; con el token de A y el cliente_id/recurso de B
    inyectados por query y header -> el servidor sólo opera como A."""
    _hostil(frontdoor, lambda c, **kw: c.post("/transcribir", **kw))


def test_adversarial_warm_post(frontdoor):
    """POST /warm: sin identidad -> 401; con el token de A y el cliente_id/recurso de B
    inyectados por query y header -> el servidor sólo opera como A."""
    _hostil(frontdoor, lambda c, **kw: c.post("/warm", **kw))
