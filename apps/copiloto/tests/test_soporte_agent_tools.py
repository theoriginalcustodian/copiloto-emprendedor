"""Toolset del agente de soporte (SOP4, C9+C10) -- `consultar_base_de_conocimiento`, `buscar_mis_errores`,
`crear_ticket_de_soporte`. Traumas/tickets contra Postgres real (RLS real); RAG/grafo mockeados -- ya
tienen sus propios tests de integración (`orquestador_rag_client` contra el healthz real,
`soporte_clasificador` con su propio spike documentado)."""
from __future__ import annotations

import os
import uuid

import pytest

import soporte_feedback_activities
from soporte_agent_tools import make_soporte_tool_executor
from soporte_context import SoporteCtx
from soporte_store import COMO_USO_LA_APP, SOPORTE_TECNICO
from trauma_store import TraumaStore

necesita_pg = pytest.mark.skipif(not os.environ.get("DATABASE_URL"),
                                 reason="requiere Postgres real (DATABASE_URL)")


class _RagClientFalso:
    def __init__(self, respuesta):
        self._r = respuesta

    def answer(self, pregunta, *, cliente_id=None):
        return self._r


class _RagRespuestaFalsa:
    def __init__(self, outcome, **kw):
        self.outcome = outcome
        self.answer = kw.get("answer")
        self.refusal_reason = kw.get("refusal_reason")
        self.reason = kw.get("reason")


class _GraphityFalso:
    def __init__(self, origen):
        self._origen = origen
        self.queries = []

    def resolver_origen(self, texto):
        self.queries.append(texto)
        return self._origen


def _executor(*, rag=None, trauma_factory=None, ticket_factory=None, grafo=None):
    return make_soporte_tool_executor(
        rag_client_factory=lambda: rag,
        trauma_store_factory=trauma_factory or (lambda cid: None),
        ticket_store_factory=ticket_factory or (lambda cid: None),
        graphity_code_client=grafo)


@pytest.fixture(autouse=True)
def _reset_soporte_feedback_deps():
    """`_conn_factory`/`_clasificador` de `soporte_feedback_activities` son globals de MÓDULO (D1
    los reusa desde `_run_crear_ticket`) -- sin resetear, un test contaminaría el siguiente."""
    antes = (soporte_feedback_activities._conn_factory, soporte_feedback_activities._clasificador)
    soporte_feedback_activities.set_soporte_feedback_deps(None, None)
    yield
    soporte_feedback_activities._conn_factory, soporte_feedback_activities._clasificador = antes


# ======================================================================================
# consultar_base_de_conocimiento -- discrimina por outcome, nunca por texto (C5, contrato SOP4)
# ======================================================================================
def test_kb_answered_devuelve_el_answer():
    rag = _RagClientFalso(_RagRespuestaFalsa("answered", answer="Para emitir una factura andá a..."))
    ex = _executor(rag=rag)
    r = ex("consultar_base_de_conocimiento", {"pregunta": "¿cómo facturo?"},
          SoporteCtx(cliente_id="x"), confirmed=False, idem_key="t1")
    assert r.status == "ok"
    assert r.observation == {"outcome": "answered", "answer": "Para emitir una factura andá a..."}


def test_kb_refused_NO_trae_answer_trae_refusal_reason():
    rag = _RagClientFalso(_RagRespuestaFalsa("refused", refusal_reason="low_cluster_coherence"))
    ex = _executor(rag=rag)
    r = ex("consultar_base_de_conocimiento", {"pregunta": "¿cuál es la capital de Francia?"},
          SoporteCtx(cliente_id="x"), confirmed=False, idem_key="t1")
    assert r.observation["outcome"] == "refused"
    assert "answer" not in r.observation
    assert r.observation["refusal_reason"] == "low_cluster_coherence"


def test_kb_unavailable_trae_reason():
    rag = _RagClientFalso(_RagRespuestaFalsa("unavailable", reason="timeout_o_conexion_caida"))
    ex = _executor(rag=rag)
    r = ex("consultar_base_de_conocimiento", {"pregunta": "algo"},
          SoporteCtx(cliente_id="x"), confirmed=False, idem_key="t1")
    assert r.observation == {"outcome": "unavailable", "reason": "timeout_o_conexion_caida"}


def test_kb_sin_cliente_RAG_configurado_degrada_a_unavailable_sin_lanzar():
    ex = make_soporte_tool_executor(
        rag_client_factory=lambda: None, trauma_store_factory=lambda cid: None,
        ticket_store_factory=lambda cid: None, graphity_code_client=None)
    r = ex("consultar_base_de_conocimiento", {"pregunta": "algo"},
          SoporteCtx(cliente_id="x"), confirmed=False, idem_key="t1")
    assert r.observation == {"outcome": "unavailable", "reason": "orquestador_no_configurado"}


def test_kb_sin_pregunta_es_error():
    rag = _RagClientFalso(_RagRespuestaFalsa("answered", answer="x"))
    ex = _executor(rag=rag)
    r = ex("consultar_base_de_conocimiento", {}, SoporteCtx(cliente_id="x"), confirmed=False, idem_key="t1")
    assert r.status == "error"


class _TraumaStoreFalso:
    """Espía de `TraumaStore.depositar` -- I3 no necesita Postgres real para verificar QUE se llamó."""
    def __init__(self):
        self.depositados = []

    def depositar(self, *, fingerprint, workflow, error_type, costura, contexto=None):
        self.depositados.append({"fingerprint": fingerprint, "workflow": workflow,
                                 "error_type": error_type, "costura": costura, "contexto": contexto})
        return {"ok": True}


def test_kb_unavailable_deposita_trauma_I3():
    """Trauma Empaquetado: un fallo real del RAG (UNAVAILABLE) se serializa con fingerprint, no se
    pierde -- mismo mecanismo que ya usan las costuras C2/C3."""
    store = _TraumaStoreFalso()
    rag = _RagClientFalso(_RagRespuestaFalsa("unavailable", reason="timeout_o_conexion_caida"))
    ex = _executor(rag=rag, trauma_factory=lambda cid: store)
    ex("consultar_base_de_conocimiento", {"pregunta": "algo"},
      SoporteCtx(cliente_id="tenant-x"), confirmed=False, idem_key="t1")
    assert len(store.depositados) == 1
    d = store.depositados[0]
    assert d["workflow"] == "soporte_agente" and d["error_type"] == "RagUnavailable"
    assert d["costura"] == "consultar_base_de_conocimiento"
    assert d["contexto"] == {"reason": "timeout_o_conexion_caida"}


def test_kb_answered_NO_deposita_trauma_solo_UNAVAILABLE_es_fallo_real():
    """REFUSED es una respuesta legítima del sistema (el corpus no tiene la respuesta), no un fallo de
    infra -- I3 no lo trata como trauma. Sólo UNAVAILABLE es lo que hay que reintentar."""
    store = _TraumaStoreFalso()
    rag = _RagClientFalso(_RagRespuestaFalsa("refused", refusal_reason="low_cluster_coherence"))
    ex = _executor(rag=rag, trauma_factory=lambda cid: store)
    ex("consultar_base_de_conocimiento", {"pregunta": "algo"},
      SoporteCtx(cliente_id="tenant-x"), confirmed=False, idem_key="t1")
    assert store.depositados == []


def test_kb_loguea_RAG_CONSULTA_I1_sin_pregunta_ni_answer_crudos(capsys):
    """I1: se puede medir frecuencia/latencia por consulta. H3: la línea logueada NO lleva el texto de
    la pregunta ni el de la respuesta -- sólo metadata (outcome/retrieved_count/latency_ms)."""
    rag = _RagClientFalso(_RagRespuestaFalsa("answered", answer="CONTENIDO-SECRETO-DE-LA-RESPUESTA"))
    ex = _executor(rag=rag)
    ex("consultar_base_de_conocimiento", {"pregunta": "PREGUNTA-LITERAL-DEL-USUARIO"},
      SoporteCtx(cliente_id="tenant-x"), confirmed=False, idem_key="t1")
    salida = capsys.readouterr().out
    assert "RAG_CONSULTA" in salida and '"outcome": "answered"' in salida
    assert "PREGUNTA-LITERAL-DEL-USUARIO" not in salida
    assert "CONTENIDO-SECRETO-DE-LA-RESPUESTA" not in salida


# ======================================================================================
# buscar_mis_errores -- C9+C10, el TRAUMA nunca la queja del usuario (MAESTRO 10.2)
# ======================================================================================
@pytest.fixture
def tenant_con_conn(conn_de_tenant):
    cid = str(uuid.uuid4())
    yield cid
    conn = conn_de_tenant(cid)()
    with conn.cursor() as cur:
        cur.execute("DELETE FROM uc_factory.copiloto_traumas WHERE cliente_id = %s", (cid,))
    conn.commit()
    conn.close()


@necesita_pg
def test_sin_traumas_del_tenant_devuelve_vacio_sin_tocar_el_grafo(conn_de_tenant, tenant_con_conn):
    grafo = _GraphityFalso(origen={"archivo": "x.py", "linea": 1, "funcion": "f"})
    ex = _executor(trauma_factory=lambda cid: TraumaStore(conn_de_tenant(cid), cid), grafo=grafo)
    r = ex("buscar_mis_errores", {}, SoporteCtx(cliente_id=tenant_con_conn),
          confirmed=False, idem_key="t1")
    assert r.observation == {"traumas": [], "cita": None}
    assert grafo.queries == []  # sin trauma, no hay vocabulario técnico que pasarle al grafo


@necesita_pg
def test_con_trauma_pero_SIN_cliente_de_grafo_no_hay_cita_pero_SI_lista_el_trauma(
        conn_de_tenant, tenant_con_conn):
    TraumaStore(conn_de_tenant(tenant_con_conn), tenant_con_conn).depositar(
        fingerprint="fp1", workflow="FacturaWorkflow", error_type="Timeout", costura="afip_gateway")
    ex = _executor(trauma_factory=lambda cid: TraumaStore(conn_de_tenant(cid), cid), grafo=None)
    r = ex("buscar_mis_errores", {}, SoporteCtx(cliente_id=tenant_con_conn),
          confirmed=False, idem_key="t1")
    assert len(r.observation["traumas"]) == 1
    assert r.observation["traumas"][0]["workflow"] == "FacturaWorkflow"
    assert r.observation["cita"] is None  # grafo apagado -- no se inventa


@necesita_pg
def test_con_trauma_Y_grafo_con_match_la_cita_lleva_el_trauma_id(conn_de_tenant, tenant_con_conn):
    TraumaStore(conn_de_tenant(tenant_con_conn), tenant_con_conn).depositar(
        fingerprint="fp1", workflow="FacturaWorkflow", error_type="Timeout", costura="afip_gateway")
    grafo = _GraphityFalso(origen={"archivo": "afip_gateway.py", "linea": 42, "funcion": "conectar"})
    ex = _executor(trauma_factory=lambda cid: TraumaStore(conn_de_tenant(cid), cid), grafo=grafo)
    r = ex("buscar_mis_errores", {}, SoporteCtx(cliente_id=tenant_con_conn),
          confirmed=False, idem_key="t1")
    assert r.observation["cita"]["archivo"] == "afip_gateway.py"
    assert r.observation["cita"]["linea"] == 42
    assert r.observation["cita"]["trauma_id"] is not None
    # se le pasó vocabulario TÉCNICO (workflow/error_type/costura), nunca una queja en lenguaje natural
    assert grafo.queries and "afip_gateway" in grafo.queries[0]


@necesita_pg
def test_CONTROL_NEGATIVO_grafo_sin_match_confiable_NO_inventa_una_cita(conn_de_tenant, tenant_con_conn):
    """C9 DoD: "una queja en lenguaje natural no debe producir una cita falsa con aire de certeza"."""
    TraumaStore(conn_de_tenant(tenant_con_conn), tenant_con_conn).depositar(
        fingerprint="fp1", workflow="Algo", error_type="Raro", costura="")
    grafo = _GraphityFalso(origen=None)  # el grafo real, sin match confiable, devuelve None
    ex = _executor(trauma_factory=lambda cid: TraumaStore(conn_de_tenant(cid), cid), grafo=grafo)
    r = ex("buscar_mis_errores", {}, SoporteCtx(cliente_id=tenant_con_conn),
          confirmed=False, idem_key="t1")
    assert r.observation["cita"] is None


@necesita_pg
def test_ADVERSARIAL_no_ve_los_traumas_de_otro_tenant(conn_de_tenant, tenant_con_conn):
    otro = str(uuid.uuid4())
    TraumaStore(conn_de_tenant(otro), otro).depositar(
        fingerprint="fp-ajeno", workflow="W", error_type="E", costura="")
    ex = _executor(trauma_factory=lambda cid: TraumaStore(conn_de_tenant(cid), cid), grafo=None)
    r = ex("buscar_mis_errores", {}, SoporteCtx(cliente_id=tenant_con_conn),
          confirmed=False, idem_key="t1")
    assert r.observation["traumas"] == []
    conn = conn_de_tenant(otro)()
    with conn.cursor() as cur:
        cur.execute("DELETE FROM uc_factory.copiloto_traumas WHERE cliente_id = %s", (otro,))
    conn.commit()
    conn.close()


# ======================================================================================
# crear_ticket_de_soporte
# ======================================================================================
@pytest.fixture
def tenant_tickets(conn_de_tenant):
    cid = str(uuid.uuid4())
    yield cid
    conn = conn_de_tenant(cid)()
    with conn.cursor() as cur:
        cur.execute("DELETE FROM uc_factory.copiloto_mensajes WHERE cliente_id = %s", (cid,))
        cur.execute("DELETE FROM uc_factory.copiloto_tickets WHERE cliente_id = %s", (cid,))
        cur.execute("DELETE FROM uc_factory.copiloto_ticket_secuencia WHERE cliente_id = %s", (cid,))
    conn.commit()
    conn.close()


@necesita_pg
def test_crear_ticket_devuelve_codigo_SOP(conn_de_tenant, tenant_tickets):
    from soporte_store import TicketStore
    ex = _executor(ticket_factory=lambda cid: TicketStore(conn_de_tenant(cid), cid))
    r = ex("crear_ticket_de_soporte",
          {"canal": SOPORTE_TECNICO, "asunto": "no puedo facturar",
           "resumen_para_el_operador": "el usuario dice que AFIP tira error"},
          SoporteCtx(cliente_id=tenant_tickets), confirmed=False, idem_key="t1")
    assert r.status == "ok"
    assert r.observation["codigo"].startswith("SOP-")


@necesita_pg
def test_crear_ticket_canal_invalido_es_error_no_excepcion(conn_de_tenant, tenant_tickets):
    from soporte_store import TicketStore
    ex = _executor(ticket_factory=lambda cid: TicketStore(conn_de_tenant(cid), cid))
    r = ex("crear_ticket_de_soporte",
          {"canal": "feedback", "asunto": "x", "resumen_para_el_operador": "y"},
          SoporteCtx(cliente_id=tenant_tickets), confirmed=False, idem_key="t1")
    assert r.status == "error"


class _ClasificadorFalso:
    def __init__(self, origen):
        self._origen = origen
        self.llamado_con = []

    def resolver_origen(self, texto):
        self.llamado_con.append(texto)
        return self._origen


@necesita_pg
def test_D1_ticket_de_SOPORTE_TECNICO_encola_a_autosanacion_si_el_clasificador_resuelve(
        conn_de_tenant, tenant_tickets):
    """D1: "un ticket técnico entra primero en la cola de autosanación". El clasificador acá está
    mockeado (su propio spike/tests ya cubren `resolver_origen` real) -- lo que se prueba es que
    `_run_crear_ticket` lo INVOCA y deposita el trauma, no la calidad del match."""
    from soporte_store import TicketStore

    falso = _ClasificadorFalso(origen={"archivo": "afip_gateway.py", "linea": 10, "funcion": "x"})
    soporte_feedback_activities.set_soporte_feedback_deps(conn_de_tenant(tenant_tickets), falso)
    ex = _executor(ticket_factory=lambda cid: TicketStore(conn_de_tenant(cid), cid))
    r = ex("crear_ticket_de_soporte",
          {"canal": SOPORTE_TECNICO, "asunto": "no puedo facturar",
           "resumen_para_el_operador": "afip_gateway tira timeout"},
          SoporteCtx(cliente_id=tenant_tickets), confirmed=False, idem_key="t1")
    assert r.observation["autosanacion"] == "encolado_para_reparacion"
    assert falso.llamado_con == ["afip_gateway tira timeout"]

    conn = conn_de_tenant(tenant_tickets)()
    with conn.cursor() as cur:
        cur.execute("SELECT fingerprint, workflow FROM uc_factory.copiloto_traumas "
                    "WHERE cliente_id = %s", (tenant_tickets,))
        filas = cur.fetchall()
    conn.close()
    assert filas and filas[0][0].startswith("soporte_ticket:") and filas[0][1] == "soporte_agente"
    with conn_de_tenant(tenant_tickets)() as c2:
        with c2.cursor() as cur:
            cur.execute("DELETE FROM uc_factory.copiloto_traumas WHERE cliente_id = %s", (tenant_tickets,))
        c2.commit()


@necesita_pg
def test_D1_ticket_de_COMO_USO_LA_APP_NUNCA_encola_a_autosanacion(conn_de_tenant, tenant_tickets):
    """D1, nota 1 del MAESTRO: "¿cómo cargo un gasto?" no es un bug -- sólo falla TÉCNICA entra a la
    cola. Un duda de uso no debe gastar presupuesto del forjador buscando un bug que no existe."""
    from soporte_store import TicketStore

    falso = _ClasificadorFalso(origen={"archivo": "x.py", "linea": 1, "funcion": "f"})
    soporte_feedback_activities.set_soporte_feedback_deps(conn_de_tenant(tenant_tickets), falso)
    ex = _executor(ticket_factory=lambda cid: TicketStore(conn_de_tenant(cid), cid))
    r = ex("crear_ticket_de_soporte",
          {"canal": COMO_USO_LA_APP, "asunto": "cómo cargo un gasto", "resumen_para_el_operador": "x"},
          SoporteCtx(cliente_id=tenant_tickets), confirmed=False, idem_key="t1")
    assert "autosanacion" not in r.observation
    assert falso.llamado_con == []


def test_tool_desconocida_es_error_no_excepcion():
    ex = _executor()
    r = ex("tool_que_no_existe", {}, SoporteCtx(cliente_id="x"), confirmed=False, idem_key="t1")
    assert r.status == "error"


def test_ctx_None_lanza_ValueError():
    ex = _executor()
    with pytest.raises(ValueError):
        ex("consultar_base_de_conocimiento", {}, None, confirmed=False, idem_key="t1")
