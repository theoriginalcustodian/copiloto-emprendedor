"""`drive_conectado` en `GET /afip/estado`.

Lo pidió la sesión frontend con el consumidor ya escrito: hoy su pantalla advierte "necesitás Drive
conectado" como condicional genérico porque no tiene el dato. Con el campo, dice el hecho.

**El eje del test son los TRES estados.** `None` ("no pude averiguarlo") no es `False` ("no está
conectado"). Colapsarlos haría que una caída de Composio se muestre como "conectá tu Drive" sobre una
cuenta que sí está vinculada — la misma forma del bug del alta fallida, donde un rastro pisaba el
hecho de que la credencial estaba sana.
"""
from __future__ import annotations

from fastapi.testclient import TestClient

from afip_web import create_afip_app

CUIT = "20269996065"


class CredsFake:
    def primer_cuit(self):
        return CUIT

    def get(self, cuit):
        return {"ws_autorizados": ["wsfe"], "ambiente": "dev"}

    def ambientes_vinculados(self, cuit):
        return ["dev"]


class PerfilFake:
    def get(self, cuit):
        return {"cuit": CUIT, "razon_social": "X"}


class GatewayConectado:
    def __init__(self, estado="ACTIVE"):
        self.estado = estado
        self.consultas = []

    def connection_status(self, user_id, toolkit):
        self.consultas.append((user_id, toolkit))
        return self.estado


class GatewayCaido:
    def connection_status(self, user_id, toolkit):
        raise RuntimeError("composio no responde")


def _cliente(gateway):
    app = create_afip_app(
        require_tenant=lambda: "tenant-1",
        perfil_store_factory=lambda cid: PerfilFake(),
        cred_store_factory=lambda cid: CredsFake(),
        handoff_factory=lambda cid: None,
        start_onboarding=lambda *a, **k: None,
        composio_gateway=gateway,
    )
    return TestClient(app)


def test_drive_vinculado_dice_true():
    gw = GatewayConectado("ACTIVE")
    r = _cliente(gw).get("/afip/estado")

    assert r.status_code == 200
    assert r.json()["drive_conectado"] is True
    # Se pregunta por el tenant del request, nunca por uno de env: `composio_user_id == cliente_id`.
    assert gw.consultas == [("tenant-1", "googledrive")]


def test_conexion_expirada_no_cuenta_como_conectada():
    """Una conexión EXPIRED existe pero no sirve para subir nada. Reportarla como conectada haría que
    la app prometa un archivado que va a fallar."""
    assert _cliente(GatewayConectado("EXPIRED")).get("/afip/estado").json()["drive_conectado"] is False


def test_sin_conexion_dice_false():
    assert _cliente(GatewayConectado(None)).get("/afip/estado").json()["drive_conectado"] is False


def test_composio_caido_dice_None_y_NO_false():
    """El caso que justifica los tres estados. `False` afirmaría algo que no sabemos."""
    cuerpo = _cliente(GatewayCaido()).get("/afip/estado").json()

    assert cuerpo["drive_conectado"] is None
    # Y —lo que más importa— el resto de Ajustes sigue respondiendo: que Composio se caiga no puede
    # dejar al usuario sin saber si puede facturar.
    assert cuerpo["puede_facturar"] is True
    assert cuerpo["cuit"] == CUIT


def test_sin_gateway_cableado_dice_None():
    """Un front-door sin Composio (tests, entorno mínimo) no puede afirmar que Drive está desconectado."""
    assert _cliente(None).get("/afip/estado").json()["drive_conectado"] is None


def test_tenant_nuevo_tambien_trae_el_campo():
    """La rama temprana de `estado` (tenant sin nada vinculado) devuelve un dict aparte: si se olvida
    el campo ahí, la app lo lee como `undefined` justo en la pantalla del usuario nuevo — que es
    exactamente donde el aviso de conectar Drive tiene que aparecer."""

    class SinNada:
        def primer_cuit(self):
            return None

    app = create_afip_app(
        require_tenant=lambda: "tenant-1",
        perfil_store_factory=lambda cid: PerfilFake(),
        cred_store_factory=lambda cid: SinNada(),
        handoff_factory=lambda cid: None,
        start_onboarding=lambda *a, **k: None,
        composio_gateway=GatewayConectado("ACTIVE"),
    )
    cuerpo = TestClient(app).get("/afip/estado").json()

    assert "drive_conectado" in cuerpo
    assert cuerpo["drive_conectado"] is True
