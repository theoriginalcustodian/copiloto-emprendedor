"""BETA-4a — el clasificador de feedback (graphity-code real) enganchado a la cadena de autosanación
REAL (DoD del `contrato_BETA4a-agente-soporte-v1`).

Continúa BETA-0 (`PR#230`, `test_spike_beta0_forjador_vs_sintomas.py`): ahí `origen` era hand-crafted
por un humano. Acá lo resuelve `SoporteClasificador.resolver_origen` de verdad, contra el grafo de
código real (`graphitymt.duckdns.org`, `group_id=code-copiloto-emprendedor`) — el umbral de confianza
que se calibró en esta sesión (ver el docstring de `soporte_clasificador.py`).

**Reusa el criterio de `test_autosanacion_cadena_completa.py`** para el ticket con símbolo: no se
exige que el parche sea "bueno" — se exige que la cadena completa (clasificar → DLQ → gates → forjar →
auditar → sandbox → proponer) LLEGUE con un veredicto en cada paso. `ARCHIVO` es el MISMO archivo
"conocido bueno" que usa esa junta (chico, con tests, fuera de dominios prohibidos), para no confundir
"el ciclo no llega" con "el ciclo llega pero este archivo en particular es difícil".

El ticket no-técnico reusa el síntoma A de BETA-0 tal cual — mismo texto, ahora resuelto vía
graphity-code real en vez de `origen=None` puesto a mano.
"""
from __future__ import annotations

import os
import uuid

import pytest

import autosanacion_activities as A
from soporte_feedback_activities import clasificar_y_encolar_feedback, set_soporte_feedback_deps
from trauma_store import TABLA, TraumaStore

necesita_pg = pytest.mark.skipif(not os.environ.get("DATABASE_URL"),
                                 reason="requiere Postgres real (DATABASE_URL)")
necesita_llm = pytest.mark.skipif(not os.environ.get("OPENAI_API_KEY"),
                                  reason="la cadena completa necesita el LLM real (OPENAI_API_KEY)")
necesita_rol_dlq = pytest.mark.skipif(
    not os.environ.get("COPILOTO_AUTOSANACION_DSN"),
    reason="requiere el rol del ciclo (BYPASSRLS): levantá la base con `test-db.sh`")
necesita_graphity_code = pytest.mark.skipif(
    not os.environ.get("GRAPHITY_CODE_API_KEY"),
    reason="requiere GRAPHITY_CODE_BASE_URL/API_KEY (grafo de código) en el env")

#: El mismo archivo "conocido bueno" de `test_autosanacion_cadena_completa.py` — chico, con tests,
#: fuera de dominios prohibidos. Así un fallo de la cadena se atribuye al CICLO, no al archivo elegido.
ARCHIVO_ESPERADO = "apps/copiloto/fingerprint.py"
FUNCION_ESPERADA = "fingerprint_de_error"

#: Menciona el símbolo LITERALMENTE — como lo escribiría un beta tester técnico que ya vio el nombre
#: en un log o en la consola del navegador. Es el caso que el umbral de confianza SÍ debe resolver.
TICKET_CON_SIMBOLO = ("el fingerprint que arma fingerprint_de_error me da distinto para el mismo "
                      "error dos veces seguidas, y eso rompe la deduplicación de la cola de errores")

#: Mismo síntoma A de BETA-0 (`test_spike_beta0_forjador_vs_sintomas.py`), tal cual — sin mención de
#: ningún símbolo, el caso realista de un usuario sin conocimiento de código.
TICKET_NO_TECNICO = ("el agente completó el campo 'contacto' del presupuesto con 'juan@mail.com' sin "
                     "que el usuario lo haya dictado en ningún momento de la conversación")


@pytest.fixture
def ciclo_y_clasificador_listos(conn_de_tenant):
    """Cablea el ciclo de autosanación (mismo patrón que `test_autosanacion_cadena_completa.py`) MÁS
    el clasificador de feedback, con un `conn_factory` CRUDO (sin envolver) — `clasificar_y_encolar_
    feedback` hace su propio `tenant(cid)` + `conexion_con_tenant` internamente, igual que en
    producción (`worker_b.py` pasa un factory ya envuelto una vez; acá no hace falta duplicar el
    envoltorio para que el mecanismo se ejercite igual)."""
    import psycopg2
    from openai import OpenAI

    cid = str(uuid.uuid4())
    conn_dlq = lambda: psycopg2.connect(os.environ["COPILOTO_AUTOSANACION_DSN"])  # noqa: E731
    A.set_autosanacion_deps(conn_dlq, llm_client=OpenAI())
    conn_crudo = lambda: psycopg2.connect(os.environ["DATABASE_URL"])  # noqa: E731
    set_soporte_feedback_deps(conn_crudo)  # clasificador real: se construye lazy vía from_env()
    yield cid
    conn = conn_de_tenant(cid)()
    with conn.cursor() as cur:
        cur.execute(f"DELETE FROM {TABLA} WHERE cliente_id = %s", (cid,))
    conn.close()


@necesita_pg
@necesita_llm
@necesita_rol_dlq
@necesita_graphity_code
@pytest.mark.asyncio
async def test_BETA4a_ticket_con_simbolo_real_dispara_la_cadena_completa_hasta_veredicto(
        ciclo_y_clasificador_listos, monkeypatch):
    cid = ciclo_y_clasificador_listos
    monkeypatch.delenv(A.ENV_REPO_GIT, raising=False)  # sin repo declarado: SIEMPRE artefacto, no PR real

    # 1 — el clasificador resuelve `origen` vía graphity-code REAL (no hand-crafted) y deposita.
    clasificacion = await clasificar_y_encolar_feedback(
        {"id": 900001, "cliente_id": cid, "tipo": "texto", "texto": TICKET_CON_SIMBOLO})
    print(f"\n[BETA4a ticket-símbolo] clasificación={clasificacion}")
    assert clasificacion["resultado"] == "encolado_para_reparacion", clasificacion
    assert clasificacion["origen"]["archivo"] == ARCHIVO_ESPERADO, \
        f"graphity-code resolvió a un archivo distinto del esperado: {clasificacion['origen']}"
    assert clasificacion["origen"]["funcion"] == FUNCION_ESPERADA

    # 2 — sale de la DLQ (cross-tenant)
    trauma = await A.tomar_trauma_para_reparar()
    assert trauma is not None
    assert trauma["cliente_id"] == cid

    # 3 — los gates lo dejan pasar
    decision = await A.evaluar_gates_de_reparacion(trauma)
    assert decision["permitido"], decision["motivo"]
    assert decision["archivo"] == ARCHIVO_ESPERADO

    # 4 — el forjador produce un parche aplicable
    forja = await A.forjar_parche(trauma)
    print(f"[BETA4a ticket-símbolo] forja: aplicado={forja['aplicado']} motivo={forja.get('motivo')!r}")
    assert forja["archivo"] == ARCHIVO_ESPERADO
    assert forja["aplicado"], f"el forjador no produjo un parche aplicable: {forja['motivo']}"

    # 5 — el auditor emite un veredicto
    veredicto = await A.auditar_parche({"trauma": trauma, "forja": forja})
    assert "degradado" not in veredicto["motivo"]
    assert isinstance(veredicto["aprobado"], bool)

    # 6 — el gate de tests corre la suite real y devuelve un veredicto REAL (no se exige "aceptado")
    prueba = await A.probar_parche_en_sandbox({"trauma": trauma, "forja": forja})
    print(f"[BETA4a ticket-símbolo] prueba: aceptado={prueba['aceptado']} motivo={prueba.get('motivo')!r}")
    assert isinstance(prueba["aceptado"], bool)
    assert prueba["motivo"]

    # 7 — propone (o produce artefacto, sin repo declarado) — NUNCA mergea, Zero-Mutation intacto
    pr = await A.proponer_pr_de_reparacion({"trauma": trauma, "forja": forja, "prueba": prueba})
    print(f"[BETA4a ticket-símbolo] pr: modo={pr['modo']} url={pr.get('url')!r}")
    assert pr["modo"] in ("artefacto", "sin_cambios", "pr")


@necesita_pg
@necesita_llm
@necesita_rol_dlq
@necesita_graphity_code
@pytest.mark.asyncio
async def test_BETA4a_ticket_no_tecnico_queda_necesita_humano_sin_tocar_el_forjador(
        ciclo_y_clasificador_listos):
    cid = ciclo_y_clasificador_listos

    clasificacion = await clasificar_y_encolar_feedback(
        {"id": 900002, "cliente_id": cid, "tipo": "texto", "texto": TICKET_NO_TECNICO})
    print(f"\n[BETA4a ticket-no-técnico] clasificación={clasificacion}")
    assert clasificacion["resultado"] == "necesita_humano", \
        f"un síntoma sin mención de símbolo NUNCA debería resolver origen — resolvió: {clasificacion}"
    assert clasificacion["respuesta"], "necesita_humano sin respuesta honesta al usuario"
    assert "arregl" not in clasificacion["respuesta"].lower(), \
        "la respuesta no puede sonar a 'ya lo arreglé' (Decisión 2 del contrato)"

    # control: nada se depositó para este cid — el forjador nunca se llamó, ni siquiera se evaluó.
    trauma = await A.tomar_trauma_para_reparar()
    assert trauma is None or trauma["cliente_id"] != cid, \
        "un ticket no-técnico depositó un trauma — no debería haber tocado la DLQ"
