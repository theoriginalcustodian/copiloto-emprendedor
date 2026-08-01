"""LA JUNTA: las 6 activities en secuencia, con el LLM real y el sandbox real.

## Qué agujero tapa exactamente

Todo lo demás está verde **por mitades**:

- `test_autosanacion_e2e.py` ejercita `tomar → gates → soltar` contra Postgres real, **con el LLM en
  `None`**: nunca llega a forjar.
- el banco C0 ejercita `forjar → auditar → probar` contra el LLM real, pero **con un trauma de
  juguete armado a mano**, no con uno que salió de la DLQ.
- el disparo en Temporal probó que el workflow **orquesta** las activities (ejecución `COMPLETED`),
  pero con la DLQ vacía: desenlace `sin_traumas`.

Entre esas tres queda la pregunta que ninguna hace: **¿el dict que `tomar_trauma_para_reparar` saca
de la base llega en condiciones de que `forjar_parche` abra el archivo correcto y el gate lo pruebe?**
Es la junta donde ya aparecieron los dos bugs de esta tanda —el trauma sin `cliente_id` y el `origen`
que no existía—, y los dos eran invisibles desde cualquiera de los lados.

## Por qué no exige que el parche sea bueno

El criterio es que **la cadena llegue hasta el gate de tests con un veredicto**, no que el veredicto
sea "aceptado". Exigir un parche aceptado mediría al modelo; lo que está en duda es el ciclo. Un
`rechazado_por_tests` con regresiones concretas prueba lo mismo que un `pr_propuesto`: los seis pasos
corrieron y cada uno le pasó al siguiente lo que necesitaba.

## 2026-08-01 — `tomar_trauma_para_reparar()` ya no recibe `cliente_id`

Cross-tenant: `set_autosanacion_deps` recibe ahora una conexión CRUDA (`conn_dlq`, sin envolver con
tenant), y `tomar_trauma_para_reparar()` toma un bug de TODA la DLQ. Esa conexión va con el rol
`copiloto_autosanacion` (`BYPASSRLS`), que `deploy/copiloto/test-db.sh` crea en la base de tests al
lado de `copiloto_app` — este último sigue siendo `NOSUPERUSER NOBYPASSRLS` porque es el que prueba
que el aislamiento aplica. Sin el DSN del primero estos tests se SALTAN: con `copiloto_app` no darían
rojo, darían "no hay traumas", que es un desenlace legítimo.
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
                                  reason="la cadena completa necesita el LLM real (OPENAI_API_KEY)")

#: Real, chico, con tests, y **fuera** de los dominios prohibidos. El mismo del banco C0.
ARCHIVO = "apps/copiloto/fingerprint.py"

#: Ver el docstring del módulo. Se salta, no se degrada: con `copiloto_app` la conexión cruda ve 0
#: filas y `tomar_trauma_para_reparar()` daría `None` — un verde que no midió nada.
necesita_rol_dlq = pytest.mark.skipif(
    not os.environ.get("COPILOTO_AUTOSANACION_DSN"),
    reason="requiere el rol del ciclo (BYPASSRLS): levantá la base con `test-db.sh` y pasá "
           "UC_TEST_AUTOSANACION_URL a sync-test-backend.sh")


@pytest.fixture
def cadena_lista(conn_de_tenant):
    """Deja las deps como las arma el composition root, con el LLM REAL.

    `set_autosanacion_deps` recibe `conn_dlq` **crudo** (sin `conexion_con_tenant`) y con el DSN del
    rol del ciclo — el MISMO nombre de variable que usa el worker, para no ejercitar un cableado que
    no existe en producción. El depósito del trauma sigue yendo por `conn_de_tenant(cid)`: así es
    como las costuras reales escriben, con el tenant declarado.
    """
    import psycopg2
    from openai import OpenAI

    cid = str(uuid.uuid4())
    conn_dlq = lambda: psycopg2.connect(os.environ["COPILOTO_AUTOSANACION_DSN"])  # noqa: E731 — cruda
    A.set_autosanacion_deps(conn_dlq, llm_client=OpenAI())
    yield cid
    conn = conn_de_tenant(cid)()
    with conn.cursor() as cur:
        cur.execute(f"DELETE FROM {TABLA} WHERE cliente_id = %s", (cid,))
    conn.close()


@necesita_pg
@necesita_llm
@necesita_rol_dlq
@pytest.mark.asyncio
async def test_la_cadena_COMPLETA_de_la_DLQ_al_veredicto(cadena_lista, conn_de_tenant, monkeypatch):
    cid = cadena_lista
    # Sin repo de PR declarado: el ciclo tiene que terminar en artefacto y NUNCA ramificar.
    monkeypatch.delenv(A.ENV_REPO_GIT, raising=False)

    TraumaStore(conn_de_tenant(cid), cid).depositar(
        fingerprint=uuid.uuid4().hex[:8], workflow="POST /cadena-completa",
        error_type="KeyError", costura="http_handler",
        contexto={"categoria": "business_error",
                  "origen": {"archivo": ARCHIVO, "linea": 30,
                             "funcion": "fingerprint_de_error"}})

    # 1 — sale de la DLQ (cross-tenant: sin cliente_id)
    trauma = await A.tomar_trauma_para_reparar()
    assert trauma is not None
    assert trauma["cliente_id"] == cid, "sin dueño, todo lo que sigue falla en silencio"

    # 2 — los gates lo dejan pasar y resuelven el ARCHIVO
    decision = await A.evaluar_gates_de_reparacion(trauma)
    assert decision["permitido"], decision["motivo"]
    assert decision["archivo"] == ARCHIVO

    # 3 — el forjador abre ese archivo y produce un parche APLICABLE
    forja = await A.forjar_parche(trauma)
    assert forja["archivo"] == ARCHIVO
    assert forja["aplicado"], f"el forjador no produjo un parche aplicable: {forja['motivo']}"
    assert forja["contenido"], "aplicó pero no dejó contenido: el parche no viajaría al gate"
    assert forja["contenido"] != "", "contenido vacío"

    # 4 — el auditor emite un veredicto (y antes se auditó a sí mismo con los 3 parches congelados)
    veredicto = await A.auditar_parche({"trauma": trauma, "forja": forja})
    assert "degradado" not in veredicto["motivo"], \
        "el auditor aprobó un parche roto conocido: el ciclo debe apagarse, no seguir"
    assert isinstance(veredicto["aprobado"], bool)

    # 5 — el gate de tests corre la suite de verdad y devuelve un veredicto REAL.
    #     No se exige "aceptado": lo que se mide es que la cadena llegue hasta acá con un juicio.
    prueba = await A.probar_parche_en_sandbox({"trauma": trauma, "forja": forja})
    assert isinstance(prueba["aceptado"], bool)
    assert prueba["motivo"], "un veredicto sin motivo no es revisable"
    if not prueba["aceptado"]:
        # Si rechazó, tiene que decir POR QUÉ en términos accionables — ese texto es el feedback
        # que alimenta el reintento, y sin él el reintento es una tirada a ciegas.
        assert "roja" in prueba["motivo"] or "baseline" in prueba["motivo"] or prueba["regresiones"]

    # 6 — propone sin mergear, y sin repo declarado eso es SIEMPRE un artefacto
    pr = await A.proponer_pr_de_reparacion({"trauma": trauma, "forja": forja, "prueba": prueba})
    assert pr["modo"] in ("artefacto", "sin_cambios"), \
        f"modo {pr['modo']}: sin repo declarado el ciclo NO puede abrir un PR"


@necesita_pg
@necesita_llm
@necesita_rol_dlq
@pytest.mark.asyncio
async def test_CONTROL_la_cadena_se_CORTA_en_el_dominio_fiscal(cadena_lista, conn_de_tenant):
    """El control que hace que el test de arriba signifique algo.

    Con el LLM real cableado y todo listo para forjar, un trauma fiscal **no puede** llegar al
    forjador. Si llegara, el ciclo estaría gastando dos llamadas al modelo para producir un parche
    sobre el código que emite CAE ante AFIP.
    """
    cid = cadena_lista
    TraumaStore(conn_de_tenant(cid), cid).depositar(
        fingerprint=uuid.uuid4().hex[:8], workflow="POST /fiscal",
        error_type="KeyError", costura="http_handler",
        contexto={"categoria": "business_error",
                  "origen": {"archivo": "apps/copiloto/afip_gateway.py", "linea": 10,
                             "funcion": "emitir"}})

    trauma = await A.tomar_trauma_para_reparar()
    decision = await A.evaluar_gates_de_reparacion(trauma)

    assert not decision["permitido"]
    assert "DIAGNOSTIC_ONLY" in decision["motivo"]
