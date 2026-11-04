"""SM-N54 / SM-N55 / SM-N56: «no pude mirar» no se disfraza de un estado legítimo.

· N54 — DB caída al facturar un presupuesto respondía 409 «falta el perfil fiscal (CUIT)», igual que el
  tenant que nunca lo cargó, sin una línea de log. Ahora: 503 reintentable, con rastro y con tenant.
· N55 — Temporal UNAVAILABLE devolvía el mismo `None` que NOT_FOUND («nunca hubo alta»), y la app lo
  mostraba como «está tardando». Ahora: un valor propio, con rastro.
· N56 — el rastro de Composio caído salía con `cliente_id=null`.

Cada fix conserva su caso legítimo (control positivo): el que de verdad no tiene CUIT sigue con su 409 y
NOT_FOUND sigue en `None`. Las dos causas se ejercitan en el mismo test: con una sola el verde no atribuye.
"""
from __future__ import annotations

import asyncio

import pytest
from fastapi.testclient import TestClient

import presupuestos_web
from presupuestos_web import create_presupuestos_app
from test_presupuestos_web import (_BODY, _EspiaFactura, _FakePerfilStore, _FakePresupuestoStore,
                                   _require_tenant_fixed)

CID = "cid-N54"


class _CredStore:
    def __init__(self, cuit=None, explota: Exception | None = None):
        self._cuit, self._explota = cuit, explota

    def primer_cuit(self):
        if self._explota is not None:
            raise self._explota
        return self._cuit


def _cli(cred: _CredStore):
    perfiles, presupuestos, espia = {}, {}, _EspiaFactura()
    app = create_presupuestos_app(
        require_tenant=_require_tenant_fixed(CID),
        perfil_negocio_store_factory=lambda cid: _FakePerfilStore(perfiles, cid),
        presupuesto_store_factory=lambda cid: _FakePresupuestoStore(presupuestos, cid),
        afip_cred_store_factory=lambda cid: cred,
        abrir_borrador=espia.abrir, consultar_factura=espia.consultar,
        signal_factura=espia.signal, generar_doc=None, traumas=None)
    cli = TestClient(app)
    pid = cli.post("/presupuestos", json=_BODY).json()["presupuesto"]["id"]
    return cli, pid, espia


@pytest.fixture
def rastro(monkeypatch):
    logs, dlq = [], []
    monkeypatch.setattr(presupuestos_web, "log_error",
                        lambda exc, **kw: logs.append((exc, kw)) or "fp-test")
    monkeypatch.setattr(presupuestos_web, "depositar", lambda traumas, **kw: dlq.append(kw) or True)
    return logs, dlq


# ── N54 ──────────────────────────────────────────────────────────────────────────────────────────

def test_N54_db_caida_NO_dice_falta_el_cuit_y_deja_rastro_con_tenant(rastro):
    logs, dlq = rastro
    cli, pid, espia = _cli(_CredStore(explota=ConnectionError("db caida")))
    r = cli.post(f"/presupuestos/{pid}/facturar")
    assert r.status_code == 503
    assert "reintent" in str(r.json())
    assert "falta" not in str(r.json()).lower()          # no instruye a rehacer un perfil que ya existe
    assert espia.aperturas == []                          # no se abrió ningún borrador
    assert len(logs) == 1 and logs[0][1]["cliente_id"] == CID
    assert len(dlq) == 1 and dlq[0]["cliente_id"] == CID and dlq[0]["costura"] == "cuit_del_tenant"


def test_N54_CONTROL_el_tenant_que_de_verdad_no_tiene_CUIT_sigue_con_su_409(rastro):
    logs, dlq = rastro
    cli, pid, espia = _cli(_CredStore(cuit=None))
    r = cli.post(f"/presupuestos/{pid}/facturar")
    assert r.status_code == 409
    assert "falta el perfil fiscal" in str(r.json())
    assert logs == [] and dlq == []                       # un 409 legítimo no es un fallo: sin ruido
    assert espia.aperturas == []


def test_N54_las_dos_causas_responden_distinto(rastro):
    cli_db, pid_db, _ = _cli(_CredStore(explota=ConnectionError("db caida")))
    cli_sin, pid_sin, _ = _cli(_CredStore(cuit=None))
    a = cli_db.post(f"/presupuestos/{pid_db}/facturar")
    b = cli_sin.post(f"/presupuestos/{pid_sin}/facturar")
    assert (a.status_code, b.status_code) == (503, 409)
    assert a.json() != b.json()


def test_N54_CONTROL_con_CUIT_y_db_sana_factura(rastro):
    cli, pid, espia = _cli(_CredStore(cuit="20111111112"))
    assert cli.post(f"/presupuestos/{pid}/facturar").status_code == 200
    assert len(espia.aperturas) == 1


# ── N55 ──────────────────────────────────────────────────────────────────────────────────────────

class _Handle:
    def __init__(self, exc):
        self._exc = exc

    async def describe(self):
        raise self._exc


class _Client:
    def __init__(self, exc):
        self._exc = exc

    def get_workflow_handle(self, _id):
        return _Handle(self._exc)


def _rpc(status):
    from temporalio.service import RPCError
    return RPCError("simulado", status, b"")


def _consultar(exc, cliente_id="t-n55"):
    import web
    return asyncio.run(web.make_consultar_onboarding(_Client(exc))(cliente_id, "20111111112", "dev"))


def test_N55_UNAVAILABLE_se_distingue_de_NOT_FOUND_y_deja_rastro_con_tenant(monkeypatch):
    import log_estructurado
    logs = []
    monkeypatch.setattr(log_estructurado, "log_error", lambda exc, **kw: logs.append(kw) or "fp")
    from temporalio.service import RPCStatusCode
    caido = _consultar(_rpc(RPCStatusCode.UNAVAILABLE))
    nunca = _consultar(_rpc(RPCStatusCode.NOT_FOUND))
    assert nunca is None                                   # CONTROL: «nunca hubo alta» sigue su camino
    assert caido is not None and caido != nunca            # DoD 1: el valor los distingue
    import web
    assert caido["paso"] == web.PASO_CONSULTA_NO_DISPONIBLE and caido["terminado"] is False
    assert caido["paso"] != "dando_de_alta"                # y NO es el «está tardando» legítimo
    assert len(logs) == 1 and logs[0]["cliente_id"] == "t-n55"   # DoD 2: una línea, con el tenant


def test_N55_CONTROL_NOT_FOUND_no_deja_ruido(monkeypatch):
    import log_estructurado
    logs = []
    monkeypatch.setattr(log_estructurado, "log_error", lambda exc, **kw: logs.append(kw) or "fp")
    from temporalio.service import RPCStatusCode
    assert _consultar(_rpc(RPCStatusCode.NOT_FOUND)) is None
    assert logs == []


# ── N56 ──────────────────────────────────────────────────────────────────────────────────────────

def test_N56_el_rastro_de_composio_caido_lleva_el_tenant_del_llamador(monkeypatch):
    import log_estructurado
    from conexiones_salud import diagnostico_conexiones
    vistos = []
    monkeypatch.setattr(log_estructurado, "log_error", lambda exc, **kw: vistos.append(kw))

    class _Mp:
        def salud(self): return "conectado"

    def _roto():
        raise RuntimeError("composio 500")

    diagnostico_conexiones(_Mp(), _roto, cliente_id="tenant-uuid-1")
    assert len(vistos) == 1 and vistos[0]["cliente_id"] == "tenant-uuid-1"     # el VALOR, no que exista


def test_N56_el_detector_pasa_el_tenant_al_diagnostico(monkeypatch):
    """El eslabón que faltaba: `_diagnostico_conexion_caida` tenía el tenant y no lo pasaba."""
    import conexiones_salud
    import mi_dia_detector
    capturado = {}

    def _espia(mp, composio, cliente_id=None):
        capturado["cid"] = cliente_id
        return [], False

    monkeypatch.setattr(conexiones_salud, "diagnostico_conexiones", _espia)
    monkeypatch.setattr(mi_dia_detector, "MpCredentialStore", lambda *a, **k: object())
    mi_dia_detector._diagnostico_conexion_caida(lambda: None, "tenant-uuid-2", lambda: [])
    assert capturado["cid"] == "tenant-uuid-2"
