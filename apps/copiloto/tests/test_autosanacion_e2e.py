"""El ciclo de punta a punta contra Postgres REAL — las costuras entre activities.

`test_autosanacion_gates.py` prueba que los gates deciden bien. `test_sandbox_tests.py` prueba que
el gate de tests juzga bien. Entre ellos queda la pregunta que ninguno hace: **¿el trauma que sale
de la DLQ llega entero a la activity siguiente, y vuelve a la DLQ cuando lo rechazan?**

Es la misma clase de falla que este repo ya pagó cuatro veces: cada lado verifica su mitad y la
costura no es de nadie ([[verificar-que-el-camino-recomendado-existe]]).

Sin Temporal a propósito: el workflow ya está probado como código determinista, y levantar un
worker acá mediría el arranque de Temporal, no las costuras. Lo que se ejercita es la cadena real de
activities contra la base real, con RLS forzado.
"""
from __future__ import annotations

import json
import os
import uuid

import pytest

import autosanacion_activities as A
from trauma_store import EN_PROCESO, PENDIENTE, TABLA, TraumaStore

necesita_pg = pytest.mark.skipif(not os.environ.get("DATABASE_URL"),
                                 reason="requiere Postgres real (DATABASE_URL)")


@pytest.fixture
def factory_de_produccion():
    """La `conn_factory` **tal como la arma el composition root**: envuelta con
    `conexion_con_tenant`, que lee el `ContextVar` en el momento de abrir la conexión.

    NO se usa `conn_de_tenant` para inyectarla en las activities: esa fixture está **pre-ligada** a
    un tenant (abre su propio `with tenant(cid)` adentro) y pisa el `ContextVar` que la activity
    declara. Con ella, un `marcar_trauma` apuntando al tenant equivocado igual encuentra la fila —
    el test pasaría y sería ciego justo al fallo que viene a cazar
    ([[el-test-que-no-usa-el-camino-de-produccion-no-puede-verlo-fallar]]).
    """
    import psycopg2

    from contexto_tenant import conexion_con_tenant
    return conexion_con_tenant(lambda: psycopg2.connect(os.environ["DATABASE_URL"]))


@pytest.fixture
def tenant_de_prueba(conn_de_tenant, factory_de_produccion):
    cid = str(uuid.uuid4())
    A.set_autosanacion_deps(factory_de_produccion, llm_client=None)
    yield cid
    conn = conn_de_tenant(cid)()
    with conn.cursor() as cur:
        cur.execute(f"DELETE FROM {TABLA} WHERE cliente_id = %s", (cid,))
    conn.close()


def _depositar(conn_de_tenant, cid: str, *, archivo: str, categoria: str) -> dict:
    """Deja un trauma con la forma EXACTA que dejan las costuras — incluido el `origen`."""
    store = TraumaStore(conn_de_tenant(cid), cid)
    store.depositar(fingerprint=uuid.uuid4().hex[:8], workflow="POST /prueba",
                    error_type="KeyError", costura="http_handler",
                    contexto={"categoria": categoria,
                              "origen": {"archivo": archivo, "linea": 42, "funcion": "cobrar"}})
    return store.listar()[0]


def _estado(conn_de_tenant, cid: str, trauma_id: int) -> str:
    conn = conn_de_tenant(cid)()
    try:
        with conn.cursor() as cur:
            cur.execute(f"SELECT estado FROM {TABLA} WHERE id = %s", (trauma_id,))
            return cur.fetchone()[0]
    finally:
        conn.close()


# ======================================================================================
# C1 — el trauma sale de la DLQ y llega entero al gate
# ======================================================================================
@necesita_pg
@pytest.mark.asyncio
async def test_un_trauma_reparable_pasa_los_gates(tenant_de_prueba, conn_de_tenant):
    cid = tenant_de_prueba
    _depositar(conn_de_tenant, cid, archivo="apps/copiloto/cobro_store.py",
               categoria="business_error")

    tomado = await A.tomar_trauma_para_reparar(cid)
    assert tomado is not None, "el trauma no salió de la DLQ"
    assert _estado(conn_de_tenant, cid, tomado["id"]) == EN_PROCESO

    decision = await A.evaluar_gates_de_reparacion(tomado)
    assert decision["permitido"], decision["motivo"]
    # Y el gate resolvió el ARCHIVO, no el nombre del workflow: es lo que después se le abre al
    # forjador, y confundirlos mandaría a parchear el módulo equivocado.
    assert decision["archivo"] == "apps/copiloto/cobro_store.py"


# ======================================================================================
# C2 — el control negativo que más importa
# ======================================================================================
@necesita_pg
@pytest.mark.asyncio
async def test_CONTROL_un_trauma_del_dominio_FISCAL_no_pasa(tenant_de_prueba, conn_de_tenant):
    """Equivocarse hacia el permiso acá emite una factura con CAE real ante AFIP. El trauma llega
    con `business_error` —categoría reparable— justamente para que el único motivo posible del
    rechazo sea el dominio."""
    cid = tenant_de_prueba
    _depositar(conn_de_tenant, cid, archivo="apps/copiloto/afip_gateway.py",
               categoria="business_error")

    tomado = await A.tomar_trauma_para_reparar(cid)
    decision = await A.evaluar_gates_de_reparacion(tomado)

    assert not decision["permitido"]
    assert "DIAGNOSTIC_ONLY" in decision["motivo"]


@necesita_pg
@pytest.mark.asyncio
async def test_CONTROL_un_transitorio_no_se_repara(tenant_de_prueba, conn_de_tenant):
    """El gate que recorta la superficie en producción: un 503 no tiene código que reparar."""
    cid = tenant_de_prueba
    _depositar(conn_de_tenant, cid, archivo="apps/copiloto/cobro_store.py",
               categoria="infra_error")

    tomado = await A.tomar_trauma_para_reparar(cid)
    decision = await A.evaluar_gates_de_reparacion(tomado)

    assert not decision["permitido"]
    assert "infra_error" in decision["motivo"]


@necesita_pg
@pytest.mark.asyncio
async def test_un_trauma_SIN_origen_se_rechaza_por_no_localizable(tenant_de_prueba, conn_de_tenant):
    """Todo trauma depositado antes de que las costuras guardaran `origen`. No es un error: es un
    trauma que no se puede reparar, y decirlo es mejor que adivinar el módulo desde el workflow."""
    cid = tenant_de_prueba
    store = TraumaStore(conn_de_tenant(cid), cid)
    store.depositar(fingerprint=uuid.uuid4().hex[:8], workflow="POST /viejo",
                    error_type="KeyError", costura="http_handler",
                    contexto={"categoria": "business_error"})     # sin `origen`

    tomado = await A.tomar_trauma_para_reparar(cid)
    decision = await A.evaluar_gates_de_reparacion(tomado)

    assert not decision["permitido"]
    assert "archivo" in decision["motivo"] and decision["archivo"] is None


# ======================================================================================
# C4 — el rechazo SUELTA el trauma (el que evita el trauma colgado para siempre)
# ======================================================================================
@necesita_pg
@pytest.mark.asyncio
async def test_marcar_trauma_lo_devuelve_a_PENDIENTE_de_verdad(tenant_de_prueba, conn_de_tenant):
    """Se verifica **en la base**, no por el valor de retorno. Con RLS forzado, un UPDATE sin tenant
    declarado afecta 0 filas y devuelve éxito: el ciclo reportaría "lo solté" y el trauma quedaría
    `en_proceso` para siempre, invisible para el próximo disparo."""
    cid = tenant_de_prueba
    _depositar(conn_de_tenant, cid, archivo="apps/copiloto/cobro_store.py",
               categoria="business_error")
    tomado = await A.tomar_trauma_para_reparar(cid)
    assert _estado(conn_de_tenant, cid, tomado["id"]) == EN_PROCESO

    await A.marcar_trauma({"id": tomado["id"], "estado": PENDIENTE,
                           "nota": "rechazado por el gate", "cliente_id": cid})

    assert _estado(conn_de_tenant, cid, tomado["id"]) == PENDIENTE
    # Y la nota quedó, que es lo que hace revisable al ciclo: sin el porqué, un trauma que rebota
    # tres veces es indistinguible de uno que nadie miró.
    conn = conn_de_tenant(cid)()
    try:
        with conn.cursor() as cur:
            cur.execute(f"SELECT contexto FROM {TABLA} WHERE id = %s", (tomado["id"],))
            contexto = cur.fetchone()[0]
    finally:
        conn.close()
    if isinstance(contexto, str):
        contexto = json.loads(contexto)
    assert contexto["ultima_nota"] == "rechazado por el gate"
    # Y no pisó lo que ya estaba: el `||` fusiona, no reemplaza.
    assert contexto["origen"]["archivo"] == "apps/copiloto/cobro_store.py"


@necesita_pg
@pytest.mark.asyncio
async def test_marcar_trauma_con_el_tenant_EQUIVOCADO_falla_fuerte(tenant_de_prueba,
                                                                   conn_de_tenant):
    """El caso adversarial. Sin el chequeo de `rowcount`, este UPDATE no encontraría la fila y
    devolvería éxito igual — el fallo silencioso que deja traumas colgados. Que grite es el punto."""
    cid = tenant_de_prueba
    _depositar(conn_de_tenant, cid, archivo="apps/copiloto/cobro_store.py",
               categoria="business_error")
    tomado = await A.tomar_trauma_para_reparar(cid)

    ajeno = str(uuid.uuid4())
    with pytest.raises(RuntimeError, match="colgado"):
        await A.marcar_trauma({"id": tomado["id"], "estado": PENDIENTE, "nota": "x",
                               "cliente_id": ajeno})

    # Y el trauma del dueño quedó intacto: el intento ajeno no lo movió.
    assert _estado(conn_de_tenant, cid, tomado["id"]) == EN_PROCESO


# ======================================================================================
# Zero-Mutation — no se abre nada si el parche no cambió nada
# ======================================================================================
@necesita_pg
@pytest.mark.asyncio
async def test_no_se_propone_NADA_si_el_parche_no_muta(tenant_de_prueba, conn_de_tenant, tmp_path):
    """Un PR vacío que dice "reparé X" es peor que no reparar: le enseña al revisor a aprobar sin
    mirar, y esa costumbre después se aplica a los PR que sí cambian algo."""
    cid = tenant_de_prueba
    archivo = tmp_path / "modulo.py"
    archivo.write_text("x = 1\n", encoding="utf-8")
    A.set_autosanacion_deps(conn_de_tenant(cid), llm_client=None, raiz_repo=tmp_path)

    resultado = await A.proponer_pr_de_reparacion({
        "trauma": {"id": 1, "fingerprint": "abc", "error_type": "KeyError"},
        "forja": {"archivo": "modulo.py", "contenido": "x = 1\n", "parche": "…"},
        "prueba": {"aceptado": True}})

    assert resultado["modo"] == "sin_cambios"
    assert resultado["url"] == ""
