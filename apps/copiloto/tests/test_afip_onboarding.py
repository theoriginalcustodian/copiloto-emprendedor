"""Tests del alta ante ARCA (F3): endpoints, activities y workflow.

El test que manda en este archivo es `test_la_clave_fiscal_no_viaja_al_workflow`: el criterio del DoD
no es "la clave está cifrada en la DB", es que **no exista en el event history de Temporal**. Ese
historial es permanente e inmutable — si el secreto entra ahí, no se puede borrar después.
"""
from __future__ import annotations

import os
import uuid
from datetime import date

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

import afip_onboarding_activities as acts
from afip_credential_store import ClaveFiscal
from afip_web import create_afip_app

CUIT = "20409378472"
CLAVE = "mi-clave-fiscal-secreta-42"
TENANT = "tenant-de-prueba"


# ---------------------------------------------------------------------------
# Dobles
# ---------------------------------------------------------------------------


class HandoffFake:
    def __init__(self):
        self.guardados: dict[str, str] = {}

    def stash(self, clave, *, ttl_segundos=900) -> str:
        handle = f"handle-{len(self.guardados)}"
        self.guardados[handle] = clave.revelar() if isinstance(clave, ClaveFiscal) else clave
        return handle

    def consume(self, handle):
        valor = self.guardados.pop(handle, None)
        return ClaveFiscal(valor) if valor is not None else None

    def purgar_vencidos(self) -> int:
        return 0


class PerfilStoreFake:
    def __init__(self):
        self.datos = {}
        self.activo = {}

    def save(self, cuit, **kw):
        self.datos[cuit] = {"cuit": cuit, **kw}

    def get(self, cuit):
        return self.datos.get(cuit)


class CredStoreFake:
    def __init__(self):
        self.datos = {}
        self.activo = {}   # cuit -> ambiente activo (en el real lo garantiza un índice único parcial)

    def save(self, cuit, *, cert, key, ambiente="dev", ws_autorizados=None, activar=True):
        self.datos[(cuit, ambiente)] = {"cert": cert, "key": key, "ambiente": ambiente,
                                        "ws_autorizados": ws_autorizados or []}
        if activar:
            self.activo[cuit] = ambiente

    def get(self, cuit, ambiente=None):
        amb = ambiente if ambiente is not None else self.activo.get(cuit)
        return self.datos.get((cuit, amb)) if amb else None

    def ambientes_vinculados(self, cuit):
        return sorted(a for (c, a) in self.datos if c == cuit)

    def primer_cuit(self):
        return next((c for (c, _a) in self.datos), None)


class GatewayFake:
    def __init__(self, *, cert=("CERT", "KEY"), falla_cert=False, falla_auth=False, estado_ok=True):
        self._cert = cert
        self.falla_cert = falla_cert
        self.falla_auth = falla_auth
        self.estado_ok = estado_ok
        self.claves_vistas: list[str] = []

    def crear_certificado(self, *, usuario, clave, alias):
        self.claves_vistas.append(clave)
        if self.falla_cert:
            raise RuntimeError("boom")
        return {"cert": self._cert[0], "key": self._cert[1]}

    def autorizar_web_service(self, *, usuario, clave, alias, wsid="wsfe"):
        if self.falla_auth:
            raise RuntimeError("no autorizado")
        return {"status": "complete"}

    def estado_servicio(self):
        v = "OK" if self.estado_ok else "DOWN"
        return {"AppServer": v, "DbServer": v, "AuthServer": v}


@pytest.fixture
def piezas():
    handoff, perfil, cred, gateway = HandoffFake(), PerfilStoreFake(), CredStoreFake(), GatewayFake()
    acts.set_onboarding_deps(lambda cuit, ambiente="dev": gateway, lambda cid: cred, lambda cid: handoff)
    return handoff, perfil, cred, gateway


@pytest.fixture
def cliente(piezas):
    handoff, perfil, cred, _ = piezas
    arranques: list[tuple] = []

    app_afip = create_afip_app(
        require_tenant=lambda: TENANT,
        perfil_store_factory=lambda cid: perfil,
        cred_store_factory=lambda cid: cred,
        handoff_factory=lambda cid: handoff,
        start_onboarding=lambda cid, cuit, handle, ambiente="dev": (arranques.append((cid, cuit, handle, ambiente)), "wf-1")[1],
        consultar_onboarding=lambda cid, cuit, ambiente="dev": {"paso": "habilitado", "ok": True},
    )
    app = FastAPI()
    app.include_router(app_afip.router)
    return TestClient(app), arranques


# ---------------------------------------------------------------------------
# EL test del DoD
# ---------------------------------------------------------------------------


def test_la_clave_fiscal_no_viaja_al_workflow(cliente, piezas):
    """ADVERSARIAL: lo que se le pasa al workflow debe ser un handle opaco, nunca el secreto.

    Los argumentos de un workflow quedan grabados en claro en el event history de Temporal, de forma
    permanente. Si la clave entra ahí, no hay borrado posterior que la saque.
    """
    client, arranques = cliente
    r = client.post("/afip/conectar", json={"cuit": CUIT, "usuario": CUIT, "clave_fiscal": CLAVE})
    assert r.status_code == 200

    assert len(arranques) == 1
    cid, cuit, handle, _ambiente = arranques[0]
    assert CLAVE not in str(arranques), "FUGA: la clave fiscal viajó como argumento del workflow"
    assert handle.startswith("handle-")
    assert cuit == CUIT and cid == TENANT


def test_la_clave_fiscal_no_vuelve_en_la_respuesta(cliente):
    client, _ = cliente
    r = client.post("/afip/conectar", json={"cuit": CUIT, "usuario": CUIT, "clave_fiscal": CLAVE})
    assert CLAVE not in r.text


def test_la_clave_queda_en_el_claim_check_y_se_consume_una_vez(cliente, piezas):
    handoff, *_ = piezas
    client, arranques = cliente
    client.post("/afip/conectar", json={"cuit": CUIT, "usuario": CUIT, "clave_fiscal": CLAVE})

    _, _, handle, _ambiente = arranques[0]
    assert handoff.consume(handle).revelar() == CLAVE
    assert handoff.consume(handle) is None, "el claim-check no es one-shot"


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


def test_conectar_rechaza_cuit_invalido(cliente):
    client, arranques = cliente
    r = client.post("/afip/conectar", json={"cuit": "12345678901", "usuario": "x", "clave_fiscal": CLAVE})
    assert r.status_code == 422
    assert arranques == [], "no se arranca el workflow con un CUIT inválido"


def test_conectar_rechaza_clave_vacia(cliente):
    client, _ = cliente
    r = client.post("/afip/conectar", json={"cuit": CUIT, "usuario": "x", "clave_fiscal": "   "})
    assert r.status_code == 422


def test_guardar_perfil_valida_con_las_mismas_reglas_que_la_emision(cliente):
    """Un perfil incompleto se rechaza en Ajustes, no recién al intentar facturar."""
    client, _ = cliente
    r = client.post("/afip/perfil", json={
        "cuit": CUIT, "razon_social": "", "domicilio_comercial": "Calle 1",
        "condicion_iva": "monotributo", "ingresos_brutos": "20-1-2",
        "inicio_actividades": "2020-01-01", "punto_venta": 1})
    assert r.status_code == 422
    assert any(d["codigo"] == "razon_social_vacio" for d in r.json()["detail"])


def test_guardar_perfil_valido(cliente):
    client, _ = cliente
    r = client.post("/afip/perfil", json={
        "cuit": CUIT, "razon_social": "Mi Emprendimiento", "domicilio_comercial": "Calle 1",
        "condicion_iva": "monotributo", "ingresos_brutos": "20-1-2",
        "inicio_actividades": "2020-01-01", "punto_venta": 1})
    assert r.status_code == 200
    assert client.get(f"/afip/perfil?cuit={CUIT}").json()["perfil"]["razon_social"] == "Mi Emprendimiento"


def test_condicion_iva_invalida_se_rechaza(cliente):
    client, _ = cliente
    r = client.post("/afip/perfil", json={
        "cuit": CUIT, "razon_social": "X", "domicilio_comercial": "Y",
        "condicion_iva": "inventada", "ingresos_brutos": "1",
        "inicio_actividades": "2020-01-01", "punto_venta": 1})
    assert r.status_code == 422


def test_estado_sin_conectar(cliente):
    client, _ = cliente
    estado = client.get(f"/afip/estado?cuit={CUIT}").json()
    assert estado["conectado"] is False
    assert estado["puede_facturar"] is False


def test_puede_facturar_exige_certificado_Y_perfil(cliente, piezas):
    """Fail-closed: con certificado pero sin perfil fiscal, todavía no se puede emitir (regla R7)."""
    _, perfil, cred, _ = piezas
    client, _ = cliente
    cred.save(CUIT, cert="c", key="k", ws_autorizados=["wsfe"])

    assert client.get(f"/afip/estado?cuit={CUIT}").json()["puede_facturar"] is False

    perfil.save(CUIT, razon_social="X", domicilio_comercial="Y", condicion_iva="monotributo",
                ingresos_brutos="1", inicio_actividades=date(2020, 1, 1), punto_venta=1)
    assert client.get(f"/afip/estado?cuit={CUIT}").json()["puede_facturar"] is True


# ---------------------------------------------------------------------------
# Activities
# ---------------------------------------------------------------------------


def test_alta_guarda_el_certificado_cifrado_y_no_devuelve_secretos(piezas):
    handoff, _, cred, _ = piezas
    handle = handoff.stash(ClaveFiscal(CLAVE))

    res = acts._dar_de_alta_sync(TENANT, CUIT, handle)

    assert res == {"ok": True, "motivo": None, "ambiente": "dev", "ws_autorizados": ["wsfe"]}
    assert CLAVE not in str(res), "el retorno de la activity va al history: no puede traer la clave"
    assert "CERT" not in str(res) and "KEY" not in str(res), "el certificado tampoco va al history"
    assert cred.get(CUIT)["cert"] == "CERT"


def test_alta_con_handle_vencido_no_explota_y_reporta_el_motivo(piezas):
    res = acts._dar_de_alta_sync(TENANT, CUIT, "handle-que-no-existe")
    assert res["ok"] is False
    assert res["motivo"] == "handle_invalido_o_vencido"


def test_el_alta_usa_la_clave_para_ambas_llamadas_de_afipsdk(piezas):
    """AfipSDK pide la clave tanto para el certificado como para autorizar el WS: un solo consume."""
    handoff, _, _, gateway = piezas
    handle = handoff.stash(ClaveFiscal(CLAVE))
    acts._dar_de_alta_sync(TENANT, CUIT, handle)
    assert gateway.claves_vistas == [CLAVE]


def test_verificacion_falla_si_no_hay_certificado(piezas):
    res = acts._verificar_habilitacion_sync(TENANT, CUIT)
    assert res == {"habilitado": False, "motivo": "sin_certificado"}


def test_verificacion_falla_si_wsfe_no_esta_autorizado(piezas):
    _, _, cred, _ = piezas
    cred.save(CUIT, cert="c", key="k", ws_autorizados=[])
    assert acts._verificar_habilitacion_sync(TENANT, CUIT)["motivo"] == "wsfe_no_autorizado"


def test_verificacion_ok(piezas):
    _, _, cred, _ = piezas
    cred.save(CUIT, cert="c", key="k", ws_autorizados=["wsfe"])
    assert acts._verificar_habilitacion_sync(TENANT, CUIT)["habilitado"] is True


def test_verificacion_detecta_ws_degradado(piezas):
    _, _, cred, gateway = piezas
    cred.save(CUIT, cert="c", key="k", ws_autorizados=["wsfe"])
    gateway.estado_ok = False
    assert acts._verificar_habilitacion_sync(TENANT, CUIT)["habilitado"] is False


# ---------------------------------------------------------------------------
# Workflow contra Temporal REAL
# ---------------------------------------------------------------------------

TEMPORAL = os.environ.get("TEMPORAL_ADDRESS", "127.0.0.1:7233")


@pytest.mark.asyncio
async def test_el_history_del_workflow_no_contiene_la_clave_fiscal():
    """El criterio duro del DoD, verificado contra el event history REAL de Temporal.

    Se corre el workflow completo con activities falsas y después se lee su historial entero,
    serializado, buscando el secreto. Si aparece, el claim-check no sirvió de nada.
    """
    temporalio = pytest.importorskip("temporalio")
    from temporalio.client import Client
    from temporalio.worker import Worker
    from temporalio import activity as act_api

    from afip_onboarding_workflow import AfipOnboardingWorkflow

    try:
        client = await Client.connect(TEMPORAL)
    except Exception as exc:  # noqa: BLE001
        pytest.skip(f"Temporal no accesible en {TEMPORAL}: {exc}")

    handle_opaco = f"handle-{uuid.uuid4()}"

    @act_api.defn(name="dar_de_alta_afip")
    async def alta_fake(cliente_id: str, cuit: str, handle: str,
                        ambiente: str = "dev") -> dict:
        return {"ok": True, "motivo": None, "ws_autorizados": ["wsfe"]}

    @act_api.defn(name="verificar_habilitacion_afip")
    async def verif_fake(cliente_id: str, cuit: str, ambiente: str = "dev") -> dict:
        return {"habilitado": True, "motivo": None}

    cola = f"afip-test-{uuid.uuid4()}"
    async with Worker(client, task_queue=cola, workflows=[AfipOnboardingWorkflow],
                      activities=[alta_fake, verif_fake]):
        wf_id = f"afip-onboarding-test-{uuid.uuid4()}"
        resultado = await client.execute_workflow(
            AfipOnboardingWorkflow.run,
            args=[TENANT, CUIT, handle_opaco],
            id=wf_id, task_queue=cola,
        )
        assert resultado["ok"] is True
        assert resultado["paso"] == "habilitado"

        historial = await client.get_workflow_handle(wf_id).fetch_history()
        texto = str(historial)

    assert CLAVE not in texto, "FUGA CRÍTICA: la clave fiscal quedó en el event history de Temporal"
    assert handle_opaco in texto, "el handle sí debe estar: es lo que reemplaza al secreto"


@pytest.mark.asyncio
async def test_el_workflow_termina_en_fallido_si_el_alta_falla():
    from temporalio import activity as act_api
    from temporalio.client import Client
    from temporalio.worker import Worker

    from afip_onboarding_workflow import AfipOnboardingWorkflow

    try:
        client = await Client.connect(TEMPORAL)
    except Exception as exc:  # noqa: BLE001
        pytest.skip(f"Temporal no accesible: {exc}")

    @act_api.defn(name="dar_de_alta_afip")
    async def alta_fake(cliente_id: str, cuit: str, handle: str,
                        ambiente: str = "dev") -> dict:
        return {"ok": False, "motivo": "handle_invalido_o_vencido"}

    @act_api.defn(name="verificar_habilitacion_afip")
    async def verif_fake(cliente_id: str, cuit: str, ambiente: str = "dev") -> dict:
        raise AssertionError("no se debe verificar si el alta falló")

    cola = f"afip-test-{uuid.uuid4()}"
    async with Worker(client, task_queue=cola, workflows=[AfipOnboardingWorkflow],
                      activities=[alta_fake, verif_fake]):
        res = await client.execute_workflow(
            AfipOnboardingWorkflow.run, args=[TENANT, CUIT, "h"],
            id=f"afip-fail-{uuid.uuid4()}", task_queue=cola)

    assert res["ok"] is False
    assert res["paso"] == "fallido"
    # ⚠️ Antes esto afirmaba `motivo == "handle_invalido_o_vencido"`, o sea que el CÓDIGO crudo de la
    # activity llegaba tal cual a `progreso()["motivo"]` — que la pantalla de Ajustes pinta sin
    # traducir. Eso no era el contrato, era el defecto: el emprendedor leía un identificador de
    # máquina que no le dice qué hacer. Ahora se traduce con la MISMA tabla que los errores por
    # excepción, y lo que se vigila es que el texto sea accionable.
    assert res["motivo"] == ("La sesión de vinculación venció. Volvé a ingresar tu clave fiscal.")
    assert "handle_invalido" not in res["motivo"], "el código crudo no puede llegar al usuario"


# ── El certificado huérfano: el peor desenlace del alta ──────────────────────────────────────────

def test_el_certificado_se_guarda_ANTES_de_autorizar_el_web_service(monkeypatch):
    """EL TEST QUE IMPORTA. Mide el daño: si falla la autorización, ¿nos quedamos con el certificado?

    El certificado ya existe EN AFIP —efecto externo, irreversible— y la clave fiscal ya se consumió
    (es one-shot). Con el `save` después de autorizar, un timeout del RPA dejaba un certificado
    huérfano que este sistema no conocía y obligaba al usuario a gastar OTRA clave fiscal, contra un
    alias que además ya estaba tomado.
    """
    import afip_onboarding_activities as act

    guardados: list = []

    class Gateway:
        def crear_certificado(self, **kw):
            return {"cert": "CERT", "key": "KEY"}

        def autorizar_web_service(self, **kw):
            raise RuntimeError("timeout del RPA de AfipSDK")

    class Cred:
        def save(self, cuit, **kw):
            guardados.append(kw.get("ws_autorizados"))

    class Clave:
        def revelar(self):
            return "clave"

    monkeypatch.setattr(act, "_gateway_factory", lambda *a, **k: Gateway())
    monkeypatch.setattr(act, "_cred_store_factory", lambda cid: Cred())
    monkeypatch.setattr(act, "_handoff_factory",
                        lambda cid: type("H", (), {"consume": lambda self, h: Clave()})())

    res = act._dar_de_alta_sync("t1", CUIT, "handle-1")

    assert guardados == [[]], "el certificado se perdió: quedó huérfano en AFIP"
    assert res["ok"] is False
    assert res["motivo"] == "certificado_ok_falta_autorizar_wsfe", (
        "el motivo tiene que distinguirse de 'no pasó nada': reintentar NO necesita otra clave fiscal")


def test_control_el_camino_feliz_guarda_wsfe_autorizado(monkeypatch):
    """Control diferencial: si el `save` previo fuera el único, la credencial quedaría para siempre
    con `ws_autorizados=[]` y el tenant no podría facturar nunca."""
    import afip_onboarding_activities as act

    guardados: list = []

    class Gateway:
        def crear_certificado(self, **kw):
            return {"cert": "CERT", "key": "KEY"}

        def autorizar_web_service(self, **kw):
            return {"ok": True}

    class Cred:
        def save(self, cuit, **kw):
            guardados.append(kw.get("ws_autorizados"))

    monkeypatch.setattr(act, "_gateway_factory", lambda *a, **k: Gateway())
    monkeypatch.setattr(act, "_cred_store_factory", lambda cid: Cred())
    monkeypatch.setattr(act, "_handoff_factory",
                        lambda cid: type("H", (), {
                            "consume": lambda self, h: type("C", (), {"revelar": lambda s: "x"})()})())

    res = act._dar_de_alta_sync("t1", CUIT, "handle-1")

    assert guardados == [[], ["wsfe"]], "el segundo save (con wsfe) es el que habilita a facturar"
    assert res["ok"] is True
