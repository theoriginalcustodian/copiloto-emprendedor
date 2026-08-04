"""La anulación que terminó bien y dejó al usuario poleando para siempre.

Dos fallos distintos vivían en el mismo tramo del `AnulacionWorkflow`, los dos **después** de que la
nota de crédito ya tiene CAE — es decir, después de que la anulación es un hecho irreversible ante
AFIP:

1. **El cliente colgado.** `marcar_comprobante_anulado` estaba fuera de todo `try`. Si agotaba sus
   reintentos —una base momentáneamente caída alcanza— el workflow moría con `paso` en
   `emitiendo_nota_credito`, que NO está en la tupla de estados terminales de `estado()`. El
   frontend, que corta el polling por `terminado`, seguía preguntando indefinidamente por una
   operación que había salido bien.

2. **La segunda nota de crédito.** Ese mismo marcado fallido deja la factura en `estado='emitida'`.
   Como `validar_anulacion` decidía "¿ya está anulada?" mirando SÓLO ese flag, una segunda anulación
   pasaba la validación y emitía otra NC: dos notas de crédito por una factura, el fisco acreditando
   el doble. Es la misma clase de fallo que la doble emisión (`test_afip_doble_emision.py`): una
   escritura que se pierde borra la evidencia que el guard necesitaba.

El fix del segundo no es reintentar más: es que la evidencia no dependa de esa escritura. La NC ahora
guarda a quién anula (`cbte_asoc_nro`) en el MISMO `registrar()` que guarda su CAE, y el guard
pregunta por esa asociación.
"""
from __future__ import annotations

import uuid

import pytest
from temporalio import activity
from temporalio.testing import WorkflowEnvironment
from temporalio.worker import Worker

from afip_anulacion_workflow import AnulacionWorkflow

CUIT = "20269996065"
COLA = "anulacion-test"

ORIGINAL = {"cuit": CUIT, "tipo_cbte": 11, "punto_venta": 1, "nro": 6, "cae": "CAE-6",
            "cae_vto": "2026-08-01", "fecha_emision": "2026-07-21", "total": "200.00",
            "estado": "emitida", "pdf_url": None, "cbte_asoc_nro": None,
            "doc_tipo": 96, "doc_nro": "20111111112", "receptor_nombre": "Juan Pérez",
            "nota_credito_nro": None}


def _actividades(*, marcar_falla: bool, marcados: list, original: dict | None = None,
                 pdfs: list | None = None, pdf_falla: bool = False):
    """Las activities que el workflow agenda, por nombre. `marcar` falla o no según el caso.

    `pdfs` (opt-in): si se pasa una lista, se registra `generar_pdf_comprobante` de verdad y cada
    llamada se apila ahí — lo usa el test del PDF de la NC. Las demás pruebas de este archivo NUNCA
    llegan a agendarla (su `ORIGINAL` no tiene `params_pdf_json`, así que
    `armar_params_pdf_nota_credito` levanta ANTES de ejecutar la activity), así que no hace falta
    registrarla para ellas.
    """

    @activity.defn(name="buscar_comprobante")
    async def buscar_comprobante(cliente_id: str, cuit: str, tipo_cbte: int, punto_venta: int,
                                 nro: int) -> dict | None:
        return dict(original if original is not None else ORIGINAL)

    @activity.defn(name="emitir_comprobante")
    async def emitir_comprobante(cliente_id: str, cuit: str, payload: dict, idem_key: str,
                                 workflow_id: str) -> dict:
        return {"ok": True, "duplicado": False, "id": 99, "cae": "CAE-NC-7", "nro": 7,
                "tipo_cbte": 13, "punto_venta": 1, "total": "200.00", "cae_vto": "2026-08-14"}

    @activity.defn(name="marcar_comprobante_anulado")
    async def marcar_comprobante_anulado(cliente_id: str, cuit: str, tipo_cbte: int,
                                         punto_venta: int, nro: int, nro_nc: int) -> dict:
        if marcar_falla:
            raise RuntimeError("la base no responde")
        marcados.append(nro)
        return {"ok": True}

    actividades = [buscar_comprobante, emitir_comprobante, marcar_comprobante_anulado]

    if pdfs is not None:
        @activity.defn(name="generar_pdf_comprobante")
        async def generar_pdf_comprobante(cliente_id: str, cuit: str, template: str, params: dict,
                                          nro: int, tipo_cbte: int, punto_venta: int) -> dict:
            if pdf_falla:
                raise RuntimeError("AfipSDK no respondió")
            pdfs.append({"template": template, "params": params, "nro": nro,
                        "tipo_cbte": tipo_cbte, "punto_venta": punto_venta})
            return {"url": "https://pdf/nc.pdf", "nombre": "nc.pdf", "expira_at": None}

        actividades.append(generar_pdf_comprobante)

    return actividades


async def _correr_hasta_el_final(env, actividades) -> dict:
    """Arranca la anulación, confirma el gate HITL y devuelve el estado final."""
    async with Worker(env.client, task_queue=COLA, workflows=[AnulacionWorkflow],
                      activities=actividades):
        handle = await env.client.start_workflow(
            AnulacionWorkflow.run, args=["t1", CUIT, 11, 1, 6, f"idem-{uuid.uuid4()}"],
            id=f"anul-{uuid.uuid4()}", task_queue=COLA)

        # Cota explícita: si el workflow no llega al gate, esto FALLA diciendo dónde quedó en vez de
        # colgar el runner hasta el timeout.
        for _ in range(300):
            estado = await handle.query(AnulacionWorkflow.estado)
            if estado["paso"] == "esperando_confirmacion":
                break
        else:
            raise AssertionError(f"la anulación no llegó al gate HITL: paso={estado['paso']}")
        await handle.signal(AnulacionWorkflow.confirmar)
        return await handle.result()


@pytest.mark.asyncio
async def test_si_falla_el_marcado_la_anulacion_TERMINA_igual_y_lo_dice():
    """EL TEST QUE IMPORTA. Mide el daño real: ¿el cliente se entera de que terminó?

    No se afirma `fallida`: sería negar un efecto fiscal que ya ocurrió (hay una NC con CAE ante
    AFIP). Se afirma la verdad —anulada— y se expone que el libro propio quedó desalineado.
    """
    marcados: list = []
    async with await WorkflowEnvironment.start_time_skipping() as env:
        estado = await _correr_hasta_el_final(env, _actividades(marcar_falla=True,
                                                                marcados=marcados))

    assert estado["terminado"] is True, "el cliente quedaba poleando para siempre una anulación OK"
    assert estado["paso"] == "anulada", "la NC tiene CAE: decir 'fallida' negaría un hecho fiscal"
    assert estado["marcada"] is False, "la inconsistencia del libro propio tiene que ser visible"
    assert estado["resultado"]["nro"] == 7, "el usuario necesita el número de su nota de crédito"
    assert "7" in (estado["motivo"] or ""), "el motivo tiene que nombrar la NC que sí se emitió"
    assert marcados == []


@pytest.mark.asyncio
async def test_control_con_el_marcado_OK_no_hay_advertencia():
    """Control positivo: si el marcado funciona, nada cambia respecto de antes del fix."""
    marcados: list = []
    async with await WorkflowEnvironment.start_time_skipping() as env:
        estado = await _correr_hasta_el_final(env, _actividades(marcar_falla=False,
                                                                marcados=marcados))

    assert estado["paso"] == "anulada" and estado["terminado"] is True
    assert estado["marcada"] is True
    assert estado["motivo"] is None
    assert marcados == [6], "la factura original tiene que quedar marcada"


@pytest.mark.asyncio
async def test_la_nota_de_credito_genera_su_pdf_cuando_el_original_tiene_params_pdf_json():
    """Residuo AFIP (Bandeja 2026-08-04): con `params_pdf_json` disponible, la anulación agenda
    `generar_pdf_comprobante` con el template `credit-note-c` y el número/CAE/fechas de la NC, no
    los de la factura original."""
    original_con_params = {**ORIGINAL, "params_pdf_json": {
        "voucher_number": 6, "cae": "CAE-6", "items": [{"code": "001", "description": "x",
        "quantity": 1.0, "unit_price": 200.0, "subtotal": 200.0}], "total_amount": 200.0}}
    marcados: list = []
    pdfs: list = []
    async with await WorkflowEnvironment.start_time_skipping() as env:
        estado = await _correr_hasta_el_final(env, _actividades(
            marcar_falla=False, marcados=marcados, original=original_con_params, pdfs=pdfs))

    assert estado["paso"] == "anulada"
    assert len(pdfs) == 1, "tiene que agendar generar_pdf_comprobante exactamente una vez"
    pdf = pdfs[0]
    assert pdf["template"] == "credit-note-c"
    assert pdf["nro"] == 7 and pdf["tipo_cbte"] == 13, "el PDF es el de la NC, no el de la factura"
    assert pdf["params"]["voucher_number"] == 7, "no puede quedar el número de la factura original"
    assert pdf["params"]["cae"] == "CAE-NC-7"
    assert pdf["params"]["items"] == original_con_params["params_pdf_json"]["items"], \
        "los ítems se clonan del original — es la NC neutralizando el importe TOTAL"


@pytest.mark.asyncio
async def test_si_falla_el_pdf_de_la_nota_de_credito_la_anulacion_TERMINA_igual():
    """El PDF es un adjunto, no el comprobante fiscal: la NC ya tiene CAE ante AFIP cuando se intenta
    generar el PDF, así que un fallo ahí no puede convertir una anulación exitosa en una fallida."""
    original_con_params = {**ORIGINAL, "params_pdf_json": {"voucher_number": 6, "items": []}}
    marcados: list = []
    pdfs: list = []
    async with await WorkflowEnvironment.start_time_skipping() as env:
        estado = await _correr_hasta_el_final(env, _actividades(
            marcar_falla=False, marcados=marcados, original=original_con_params,
            pdfs=pdfs, pdf_falla=True))

    assert estado["paso"] == "anulada", "el fallo del PDF NO puede tumbar una anulación con CAE"
    assert estado["marcada"] is True, "el resto del flujo sigue intacto"
    assert pdfs == [], "la activity se intentó pero falló antes de apilar nada"


@pytest.mark.asyncio
async def test_una_factura_con_NC_asociada_no_se_puede_volver_a_anular():
    """La segunda anulación, con el marcado perdido: `estado` sigue diciendo 'emitida', pero la NC
    existe y apunta al original. Sin este guard se emitía una SEGUNDA nota de crédito."""
    con_nc = {**ORIGINAL, "estado": "emitida", "nota_credito_nro": 7}
    marcados: list = []
    async with await WorkflowEnvironment.start_time_skipping() as env:
        async with Worker(env.client, task_queue=COLA, workflows=[AnulacionWorkflow],
                          activities=_actividades(marcar_falla=False, marcados=marcados,
                                                  original=con_nc)):
            estado = await env.client.execute_workflow(
                AnulacionWorkflow.run, args=["t1", CUIT, 11, 1, 6, f"idem-{uuid.uuid4()}"],
                id=f"anul-{uuid.uuid4()}", task_queue=COLA)

    assert estado["paso"] == "fallida", "emitió una segunda nota de crédito sobre la misma factura"
    assert [e["codigo"] for e in estado["errores"]] == ["ya_anulada"]
    assert "7" in estado["motivo"], "hay que decirle con qué NC ya se anuló"


# ---------------------------------------------------------------------------
# De dónde sale la evidencia: el puntero se escribe junto con el CAE de la NC.
# ---------------------------------------------------------------------------

def test_la_nota_de_credito_registra_a_QUIEN_anula(monkeypatch):
    """Sin esto el guard de arriba no tiene de dónde salir: `cbte_asoc_nro` viaja en `CbtesAsoc` del
    payload y hasta ahora se perdía al registrar. Va en el MISMO `registrar()` que el CAE."""
    import afip_factura_activities as act

    registros: list[dict] = []

    class Store:
        def por_idem_key(self, k):
            return None

        def registrar(self, **kw):
            registros.append(kw)
            return 1

    class Gateway:
        def ultimo_comprobante(self, **kw):
            return 6

        def existe_comprobante(self, **kw):
            return False

        def emitir(self, payload):
            return type("R", (), {"cae": "CAE-NC-7", "numero": 7, "resultado": "A",
                                  "cae_vto": type("F", (), {"isoformat": staticmethod(
                                      lambda: "2026-08-01")})()})()

    monkeypatch.setattr(act, "_comprobante_store_factory", lambda cid: Store())
    monkeypatch.setattr(act, "_cred_store_factory",
                        lambda cid: type("C", (), {"get": lambda self, c: {"cert": "x", "key": "y"}})())
    monkeypatch.setattr(act, "_gateway_factory", lambda *a, **k: Gateway())

    payload_nc = {"PtoVta": 1, "CbteTipo": 13, "DocTipo": 96, "DocNro": 20111111112,
                  "ImpTotal": 200.0, "CbteFch": 20260721,
                  "CbtesAsoc": [{"Tipo": 11, "PtoVta": 1, "Nro": 6}]}
    act._emitir_sync("t1", CUIT, payload_nc, "idem-nc", "wf-nc", "Juan Pérez", nro_reservado=7)

    assert registros[0]["cbte_asoc_nro"] == 6, "la NC no dejó rastro de a quién anula"


def test_control_una_factura_comun_no_queda_asociada_a_nada(monkeypatch):
    """Control diferencial: sin `CbtesAsoc` el puntero tiene que ser `None`. Si esto trajera un
    número, TODA factura se leería como nota de crédito de otra y ninguna se podría anular."""
    import afip_factura_activities as act

    registros: list[dict] = []

    class Store:
        def por_idem_key(self, k):
            return None

        def registrar(self, **kw):
            registros.append(kw)
            return 1

    class Gateway:
        def ultimo_comprobante(self, **kw):
            return 10

        def existe_comprobante(self, **kw):
            return False

        def emitir(self, payload):
            return type("R", (), {"cae": "CAE-11", "numero": 11, "resultado": "A",
                                  "cae_vto": type("F", (), {"isoformat": staticmethod(
                                      lambda: "2026-08-01")})()})()

    monkeypatch.setattr(act, "_comprobante_store_factory", lambda cid: Store())
    monkeypatch.setattr(act, "_cred_store_factory",
                        lambda cid: type("C", (), {"get": lambda self, c: {"cert": "x", "key": "y"}})())
    monkeypatch.setattr(act, "_gateway_factory", lambda *a, **k: Gateway())

    act._emitir_sync("t1", CUIT, {"PtoVta": 1, "CbteTipo": 11, "DocTipo": 96, "DocNro": 0,
                                  "ImpTotal": 100.0, "CbteFch": 20260721},
                     "idem-f", "wf-f", "Juan Pérez", nro_reservado=11)

    assert registros[0]["cbte_asoc_nro"] is None


def test_buscar_comprobante_viaja_con_la_respuesta_sobre_su_nota_de_credito(monkeypatch):
    """El dato va pegado al comprobante y NO en una activity nueva: sumar un paso al workflow
    cambiaría su secuencia de comandos y rompería por no-determinismo toda anulación en vuelo."""
    import afip_factura_activities as act

    class Store:
        def get(self, **kw):
            return dict(ORIGINAL)

        def nota_credito_de(self, **kw):
            return 7

    monkeypatch.setattr(act, "_comprobante_store_factory", lambda cid: Store())

    assert act._buscar_comprobante_sync("t1", CUIT, 11, 1, 6)["nota_credito_nro"] == 7


def test_buscar_comprobante_inexistente_sigue_siendo_None(monkeypatch):
    """Control: enriquecer no puede convertir un `None` en un dict — el workflow distingue
    'no existe' de 'existe y está limpio' justamente por eso."""
    import afip_factura_activities as act

    class Store:
        def get(self, **kw):
            return None

        def nota_credito_de(self, **kw):
            raise AssertionError("no hay que consultar la NC de un comprobante que no existe")

    monkeypatch.setattr(act, "_comprobante_store_factory", lambda cid: Store())

    assert act._buscar_comprobante_sync("t1", CUIT, 11, 1, 999) is None
