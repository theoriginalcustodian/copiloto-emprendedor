"""La activity de archivado y el endpoint de ajustes.

El eje: **una factura emitida nunca se convierte en un fallo por el archivado**. La activity absorbe
todo y devuelve el motivo; el workflow lee ese motivo, no una excepción.
"""
from __future__ import annotations

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

import afip_factura_activities as act
from afip_web import create_afip_app

CUIT = "20269996065"
PDF = "https://afipsdk.s3.amazonaws.com/f8.pdf"


class PerfilFake:
    def __init__(self, perfil: dict | None) -> None:
        self._perfil = perfil
        self.seteos: list[tuple[str, bool]] = []

    def get(self, cuit):
        return self._perfil

    def set_guardar_en_drive(self, cuit, activado):
        self.seteos.append((cuit, activado))
        return self._perfil is not None


class ComprobanteFake:
    def __init__(self) -> None:
        self.adjuntos: list[dict] = []

    def adjuntar_drive(self, **kw):
        self.adjuntos.append(kw)


class GatewayOk:
    def execute(self, slug, *, user_id, arguments, confirmed=False):
        if "FIND_FOLDER" in slug:
            return {"data": {"files": [{"id": "carpeta"}]}}
        if "UPLOAD_FROM_URL" in slug:
            return {"data": {"id": "file-9", "webContentLink": "https://drive/uc?id=file-9"}}
        return {"data": {"id": "perm"}}


class GatewayExplota:
    def execute(self, slug, *, user_id, arguments, confirmed=False):
        raise RuntimeError("composio caído")


def _cablear(monkeypatch, *, perfil, gateway, comprobantes=None):
    comprobantes = comprobantes or ComprobanteFake()
    monkeypatch.setattr(act, "_perfil_store_factory", lambda cid: perfil)
    monkeypatch.setattr(act, "_comprobante_store_factory", lambda cid: comprobantes)
    monkeypatch.setattr(act, "_composio_gateway", gateway)
    return comprobantes


PERFIL_ON = {"cuit": CUIT, "guardar_en_drive": True}
PERFIL_OFF = {"cuit": CUIT, "guardar_en_drive": False}


@pytest.mark.asyncio
async def test_con_el_ajuste_apagado_no_toca_drive(monkeypatch):
    """El default es OFF. Archivar sin que el usuario lo haya pedido sería subir sus datos fiscales a
    una cuenta de terceros por decisión nuestra."""
    perfil = PerfilFake(PERFIL_OFF)
    comps = _cablear(monkeypatch, perfil=perfil, gateway=GatewayExplota())

    res = await act.archivar_factura_en_drive("t1", CUIT, 11, 1, 8, PDF)

    assert res == {"guardado": False, "motivo": "desactivado"}
    assert comps.adjuntos == []


@pytest.mark.asyncio
async def test_con_el_ajuste_prendido_archiva_y_persiste(monkeypatch):
    perfil = PerfilFake(PERFIL_ON)
    comps = _cablear(monkeypatch, perfil=perfil, gateway=GatewayOk())

    res = await act.archivar_factura_en_drive("t1", CUIT, 11, 1, 8, PDF)

    assert res["guardado"] is True and res["compartido"] is True
    assert comps.adjuntos == [{"cuit": CUIT, "tipo_cbte": 11, "punto_venta": 1, "nro": 8,
                               "drive_file_id": "file-9", "drive_link": "https://drive/uc?id=file-9"}]


@pytest.mark.asyncio
async def test_si_drive_explota_la_activity_NO_levanta(monkeypatch):
    """Si levantara, Temporal la reintentaría y —si la falla ocurrió después de subir— el usuario
    tendría dos copias de la misma factura. Y una excepción acá dejaría la factura marcada como
    problemática cuando ya tiene CAE."""
    perfil = PerfilFake(PERFIL_ON)
    comps = _cablear(monkeypatch, perfil=perfil, gateway=GatewayExplota())

    res = await act.archivar_factura_en_drive("t1", CUIT, 11, 1, 8, PDF)

    assert res["guardado"] is False
    assert "error_drive" in res["motivo"]
    assert comps.adjuntos == []


@pytest.mark.asyncio
async def test_sin_composio_cableado_no_rompe(monkeypatch):
    """Un worker sin Composio sigue emitiendo facturas: sólo no archiva."""
    perfil = PerfilFake(PERFIL_ON)
    _cablear(monkeypatch, perfil=perfil, gateway=None)

    res = await act.archivar_factura_en_drive("t1", CUIT, 11, 1, 8, PDF)
    assert res == {"guardado": False, "motivo": "composio_no_disponible"}


@pytest.mark.asyncio
async def test_sin_perfil_no_archiva(monkeypatch):
    _cablear(monkeypatch, perfil=PerfilFake(None), gateway=GatewayOk())
    res = await act.archivar_factura_en_drive("t1", CUIT, 11, 1, 8, PDF)
    assert res["guardado"] is False


# ── endpoint de ajustes ────────────────────────────────────────────────────────────────────────

def _app(perfil: PerfilFake) -> TestClient:
    app = create_afip_app(
        require_tenant=lambda: "t1",
        perfil_store_factory=lambda cid: perfil,
        cred_store_factory=lambda cid: None,
        handoff_factory=lambda cid: None,
        start_onboarding=lambda *a, **k: None,
    )
    return TestClient(app)


def test_ajustes_guarda_el_flag():
    perfil = PerfilFake(PERFIL_OFF)
    r = _app(perfil).post("/afip/ajustes", json={"cuit": CUIT, "guardar_en_drive": True})
    assert r.status_code == 200
    assert r.json() == {"ok": True, "guardar_en_drive": True}
    assert perfil.seteos == [(CUIT, True)]


def test_ajustes_sin_perfil_responde_409_y_no_miente():
    """Un UPDATE que no matchea ninguna fila devuelve "ok" en SQL. Si el endpoint también dijera ok,
    el usuario vería el toggle prendido en pantalla y la base sin nada guardado — y descubriría el
    problema recién cuando su primera factura no aparezca en Drive."""
    r = _app(PerfilFake(None)).post("/afip/ajustes", json={"cuit": CUIT, "guardar_en_drive": True})
    assert r.status_code == 409
    # `detail` pasó de string a `{codigo, mensaje}`. Este test cazó el cambio de forma justo como lo
    # cazaría un cliente que leyera el string — que es el motivo de que el paso a `codigo` se avise
    # por el buzón y no se deploye a secas.
    assert r.json()["detail"]["codigo"] == "sin_perfil_fiscal"
    assert "datos fiscales" in r.json()["detail"]["mensaje"]
