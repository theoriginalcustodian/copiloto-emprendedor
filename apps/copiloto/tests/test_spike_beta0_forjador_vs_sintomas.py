"""SPIKE BETA-0 — ¿`forjador_parches` sirve contra síntomas NO técnicos, sin traceback? (2026-08-04)

**Por qué existe:** de-risk antes de comprometer el diseño del agente de soporte (BETA-4a). Si el
forjador no puede actuar sobre texto libre sin traceback, el agente de soporte necesita CLASIFICAR
antes de tickear — eso cambia su diseño. Ver
`coordinacion/en-curso/2026-08-03_contrato_planificacion-a-todos_SPRINT-beta-el-mapa.md` §BETA-0.

**No es un test de regresión permanente** (spike-first, CLAUDE.md §6): documenta con evidencia real
(no supuesto) qué hace el pipeline real, no fija un contrato que deba seguir cumpliéndose. Puede
mergearse igual — no rompe nada y deja la evidencia trazable en el repo — pero su valor es el
`avance_` que resume, no el gate en sí.

## Los 3 tickets, y por qué esos 3

Dos síntomas NO técnicos reales (uno es el hallazgo real ya reportado por backend el 2026-08-03,
`hallazgo_backend-a-planificacion_llm-inventa-contacto-no-dictado-en-presupuesto.md`; el otro es el
ejemplo que da el propio contrato de BETA-0), sin exception real de por medio — exactamente el caso
que el agente de soporte va a recibir del usuario.

- **A y B — sin `origen`** (nadie localizó el síntoma en el código, que es el caso realista: un
  usuario reporta "me mintió", no un archivo:línea): control de que `evaluar_gates_de_reparacion`
  los rechaza, y con qué motivo exacto.
- **C — mismo síntoma que A, pero con `origen` HAND-CRAFTED** apuntando al lugar más plausible que un
  triager humano elegiría (`tool_catalog.py:836`, `_run_registrar_presupuesto`, que es donde
  `contacto` se relaya) — **aunque el propio hallazgo real dice que el fix probablemente vive en el
  PROMPT del motor (`motor/backend/agent/`), no acá**. Esa tensión es parte de la pregunta: ¿qué
  produce el forjador cuando el lugar señalado NO es la causa real?
"""
from __future__ import annotations

import os
import uuid

import pytest

import autosanacion_activities as A
from trauma_store import TABLA, TraumaStore

necesita_pg = pytest.mark.skipif(not os.environ.get("DATABASE_URL"),
                                 reason="requiere Postgres real (DATABASE_URL)")
necesita_llm = pytest.mark.skipif(not os.environ.get("OPENAI_API_KEY"),
                                  reason="el spike necesita el LLM real (OPENAI_API_KEY)")
necesita_rol_dlq = pytest.mark.skipif(
    not os.environ.get("COPILOTO_AUTOSANACION_DSN"),
    reason="requiere el rol del ciclo (BYPASSRLS): levantá la base con `test-db.sh` y pasá "
           "COPILOTO_AUTOSANACION_DSN")

#: Ubicación real donde el LLM completó un `contacto` no dictado — ver el hallazgo citado arriba.
ARCHIVO_PLAUSIBLE = "apps/copiloto/tool_catalog.py"
FUNCION_PLAUSIBLE = "_run_registrar_presupuesto"
LINEA_PLAUSIBLE = 836

SINTOMA_A = ("el agente completó el campo 'contacto' del presupuesto con 'juan@mail.com' sin que "
             "el usuario lo haya dictado en ningún momento de la conversación")
SINTOMA_B = ("el usuario dictó un gasto, el agente respondió que ya lo había guardado, pero el gasto "
             "no aparece en GET /gastos")


@pytest.fixture
def ciclo_listo(conn_de_tenant):
    """Mismo cableado que `test_autosanacion_cadena_completa.py::cadena_lista` — LLM real, rol del
    ciclo real. No se reinventa el patrón, se reusa (regla REUTILIZAR)."""
    import psycopg2
    from openai import OpenAI

    cid = str(uuid.uuid4())
    conn_dlq = lambda: psycopg2.connect(os.environ["COPILOTO_AUTOSANACION_DSN"])  # noqa: E731
    A.set_autosanacion_deps(conn_dlq, llm_client=OpenAI())
    yield cid
    conn = conn_de_tenant(cid)()
    with conn.cursor() as cur:
        cur.execute(f"DELETE FROM {TABLA} WHERE cliente_id = %s", (cid,))
    conn.close()


def _depositar_ticket(conn_de_tenant, cid: str, *, workflow: str, sintoma: str,
                      origen: dict | None) -> None:
    contexto = {"categoria": "business_error", "sintoma_no_tecnico": sintoma}
    if origen is not None:
        contexto["origen"] = origen
    TraumaStore(conn_de_tenant(cid), cid).depositar(
        fingerprint=uuid.uuid4().hex[:8], workflow=workflow, error_type="ComportamientoInesperado",
        costura="http_handler", contexto=contexto)


@necesita_pg
@necesita_llm
@necesita_rol_dlq
@pytest.mark.asyncio
async def test_SPIKE_beta0_tickets_A_B_sin_origen_son_rechazados_por_el_gate(ciclo_listo, conn_de_tenant):
    """A y B: síntomas no técnicos SIN localización — el caso realista de un feedback de usuario."""
    cid = ciclo_listo
    _depositar_ticket(conn_de_tenant, cid, workflow="chat_registrar_presupuesto",
                      sintoma=SINTOMA_A, origen=None)
    _depositar_ticket(conn_de_tenant, cid, workflow="chat_registrar_gasto",
                      sintoma=SINTOMA_B, origen=None)

    resultados = []
    for _ in range(2):
        trauma = await A.tomar_trauma_para_reparar()
        assert trauma is not None
        decision = await A.evaluar_gates_de_reparacion(trauma)
        resultados.append((trauma["workflow"], decision))
        print(f"\n[TICKET sin origen] workflow={trauma['workflow']!r}\n"
              f"  permitido={decision['permitido']}  necesita_humano={decision['necesita_humano']}\n"
              f"  motivo={decision['motivo']!r}")

    for workflow, decision in resultados:
        assert decision["permitido"] is False, \
            f"{workflow}: un síntoma sin origen NUNCA debería pasar el gate — pasó igual"
        assert decision["necesita_humano"] is True, \
            f"{workflow}: sin archivo:línea, el ciclo tiene que marcar necesita_humano=True"
        assert decision["motivo"] == ("el trauma no registró archivo:línea — "
                                      "no es reparable automáticamente")


@necesita_pg
@necesita_llm
@necesita_rol_dlq
@pytest.mark.asyncio
async def test_SPIKE_beta0_ticket_C_con_origen_hand_crafted_que_produce_el_forjador(
        ciclo_listo, conn_de_tenant):
    """C: mismo síntoma que A, pero con `origen` adivinado por un triager humano.

    No se afirma nada sobre si el resultado es 'bueno' — el spike es exploratorio (DoD: documentar,
    no aprobar). Se registra CUALQUIER desenlace con evidencia completa para el `avance_`.
    """
    cid = ciclo_listo
    _depositar_ticket(conn_de_tenant, cid, workflow="chat_registrar_presupuesto",
                      sintoma=SINTOMA_A,
                      origen={"archivo": ARCHIVO_PLAUSIBLE, "linea": LINEA_PLAUSIBLE,
                              "funcion": FUNCION_PLAUSIBLE})

    trauma = await A.tomar_trauma_para_reparar()
    assert trauma is not None

    decision = await A.evaluar_gates_de_reparacion(trauma)
    print(f"\n[TICKET C — con origen] gate: permitido={decision['permitido']} "
          f"motivo={decision['motivo']!r}")

    if not decision["permitido"]:
        # Resultado válido igual — lo documentamos y no seguimos al forjador.
        print(f"[TICKET C] el gate NO dejó pasar el ticket: {decision['motivo']!r} — "
              "no hay forja que evaluar, y ESO también es evidencia (el gate por dominio/tope "
              "puede frenar un síntoma no-técnico incluso con origen adivinado).")
        return

    forja = await A.forjar_parche(trauma)
    print(f"\n[TICKET C] forjador — aplicado={forja['aplicado']}  motivo={forja.get('motivo')!r}")
    if forja.get("parche"):
        print(f"[TICKET C] parche crudo del modelo:\n{forja['parche']}")
    if forja.get("contenido") and forja["aplicado"]:
        print("[TICKET C] el archivo QUEDÓ MODIFICADO en memoria (nunca se escribió a disco: "
              "forjar_parche no toca el repo, sólo lo aplica sobre el texto leído).")

    # No hay assert de "tiene que arreglar" ni "tiene que rechazar" — el spike mide qué pasa, no
    # exige un veredicto. El único assert real es que la activity responda con la forma esperada,
    # para que un cambio futuro en el contrato de `forjar_parche` rompa ACÁ y no en silencio.
    assert "aplicado" in forja and "motivo" in forja
