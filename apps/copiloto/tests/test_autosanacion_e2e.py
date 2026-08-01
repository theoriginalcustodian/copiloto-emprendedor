"""El ciclo de punta a punta contra Postgres REAL — las costuras entre activities.

`test_autosanacion_gates.py` prueba que los gates deciden bien. `test_sandbox_tests.py` prueba que
el gate de tests juzga bien. Entre ellos queda la pregunta que ninguno hace: **¿el trauma que sale
de la DLQ llega entero a la activity siguiente, y vuelve a la DLQ cuando lo rechazan?**

Es la misma clase de falla que este repo ya pagó cuatro veces: cada lado verifica su mitad y la
costura no es de nadie ([[verificar-que-el-camino-recomendado-existe]]).

Sin Temporal a propósito: el workflow ya está probado como código determinista, y levantar un
worker acá mediría el arranque de Temporal, no las costuras. Lo que se ejercita es la cadena real de
activities contra la base real, con RLS forzado.

## 2026-08-01 — el ciclo pasó a ser UNO SOLO para toda la app (cross-tenant)

`tomar_trauma_para_reparar` ya no recibe `cliente_id`: toma **un bug distinto** de TODA la DLQ, con
una conexión cruda del rol `copiloto_autosanacion` (`BYPASSRLS`) que ve todos los tenants.

Ese rol **también existe en la base de tests**: `deploy/copiloto/test-db.sh` lo crea al lado de
`copiloto_app` (que sigue siendo `NOSUPERUSER NOBYPASSRLS` con `FORCE RLS`, porque es el que permite
verificar que el aislamiento aplica). Son dos roles con dos propósitos opuestos y los dos hacen
falta: uno prueba que RLS filtra, el otro prueba el camino que a propósito lo saltea.

**El error que esto evita:** correr estos tests con `copiloto_app` no los pondría rojos — una
conexión suya sin tenant ve 0 filas, así que `tomar_trauma_para_reparar()` devolvería `None` y el
test leería *"no hay traumas"*, que es el desenlace legítimo de un ciclo sano. Verde o rojo daría
igual: el instrumento no estaría mirando. Por eso el skip es explícito y su motivo dice qué correr.
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

#: El ciclo NO puede probarse con el rol de la app: `copiloto_app` es `NOSUPERUSER NOBYPASSRLS` con
#: `FORCE RLS` a propósito, y una conexión suya sin tenant ve **0 filas de todos los tenants**. Un
#: test así no daría rojo: daría "no hay traumas", que es el desenlace legítimo de un ciclo sano.
#: Por eso se salta en vez de correr degradado — y el motivo dice qué hacer, no sólo que faltó.
necesita_rol_dlq = pytest.mark.skipif(
    not os.environ.get("COPILOTO_AUTOSANACION_DSN"),
    reason="requiere el rol del ciclo (BYPASSRLS): levantá la base con `test-db.sh` y pasá "
           "UC_TEST_AUTOSANACION_URL a sync-test-backend.sh")


@pytest.fixture
def conn_dlq_cruda():
    """Conexión **sin tenant declarado** con el rol del ciclo — el mismo cableado que producción.

    Desde 2026-08-01 el composition root hace `set_autosanacion_deps(_conn_dlq, ...)` con el rol
    dedicado `copiloto_autosanacion` (`BYPASSRLS`, permisos sobre UNA tabla), que
    `deploy/copiloto/provision-rol-autosanacion.sh` provisiona en producción y `test-db.sh` replica
    en la base de tests. La fixture lee `COPILOTO_AUTOSANACION_DSN`, **el mismo nombre de variable
    que el worker**: si se le diera otro, la suite estaría ejercitando un cableado que no existe en
    ningún lado (ver `memoria/el-test-que-no-usa-el-camino-de-produccion-no-puede-verlo-fallar.md`).

    Cruda a propósito: sin `conexion_con_tenant`, porque el ciclo es cross-tenant por diseño y ese
    envoltorio cierra la conexión si no hay tenant que declarar.
    """
    import psycopg2

    def factory():
        conn = psycopg2.connect(os.environ["COPILOTO_AUTOSANACION_DSN"])
        conn.autocommit = True
        return conn

    return factory


@pytest.fixture
def tenant_de_prueba(conn_de_tenant, conn_dlq_cruda):
    """El trauma se deposita con el tenant declarado (así lo hacen las costuras reales), pero el
    ciclo (`set_autosanacion_deps`) recibe la conexión CRUDA — es el mismo desacople que hay en
    producción entre quien escribe (por tenant) y quien repara (cross-tenant, `conn_dlq`)."""
    cid = str(uuid.uuid4())
    A.set_autosanacion_deps(conn_dlq_cruda, llm_client=None)
    yield cid
    conn = conn_de_tenant(cid)()
    with conn.cursor() as cur:
        cur.execute(f"DELETE FROM {TABLA} WHERE cliente_id = %s", (cid,))
    conn.close()


def _depositar(conn_de_tenant, cid: str, *, archivo: str, categoria: str,
               fingerprint: str | None = None) -> dict:
    """Deja un trauma con la forma EXACTA que dejan las costuras — incluido el `origen`.

    `fingerprint` explícito para el caso cross-tenant: dos emprendedores que sufren EL MISMO bug
    tienen la misma huella (se calcula de workflow + tipo de error, no del dueño). Se devuelve la
    fila buscándola por huella y no `listar()[0]`, porque con más de un trauma por tenant el índice
    fijo devolvería cualquiera.
    """
    fp = fingerprint or uuid.uuid4().hex[:8]
    store = TraumaStore(conn_de_tenant(cid), cid)
    store.depositar(fingerprint=fp, workflow="POST /prueba",
                    error_type="KeyError", costura="http_handler",
                    contexto={"categoria": categoria,
                              "origen": {"archivo": archivo, "linea": 42, "funcion": "cobrar"}})
    return next(t for t in store.listar() if t["fingerprint"] == fp)


@pytest.fixture
def dos_tenants(conn_de_tenant, conn_dlq_cruda):
    """Dos emprendedores sintéticos, con el ciclo cableado como en producción, y barrido al final.

    El DELETE va **uno por tenant con su propia conexión**: con RLS, la de A no puede borrar las
    filas de B aunque el `WHERE` las incluyera — y un barrido que cree haber limpiado y no lo hizo
    deja traumas fabricados en la cola real.
    """
    a, b = str(uuid.uuid4()), str(uuid.uuid4())
    A.set_autosanacion_deps(conn_dlq_cruda, llm_client=None)
    yield a, b
    for cid in (a, b):
        conn = conn_de_tenant(cid)()
        with conn.cursor() as cur:
            cur.execute(f"DELETE FROM {TABLA} WHERE cliente_id = %s", (cid,))
        conn.close()


def _estado(conn_de_tenant, cid: str, trauma_id: int) -> str:
    conn = conn_de_tenant(cid)()
    try:
        with conn.cursor() as cur:
            cur.execute(f"SELECT estado FROM {TABLA} WHERE id = %s", (trauma_id,))
            return cur.fetchone()[0]
    finally:
        conn.close()


def _nota(conn_de_tenant, cid: str, trauma_id: int) -> str | None:
    """La `ultima_nota` del contexto, o `None` si nadie escribió una.

    Existe porque el ESTADO no siempre alcanza para distinguir "no lo tocaron" de "lo tocaron y
    escribieron lo mismo que ya tenía" — y esa diferencia es justo la que separa el camino de
    rechazo del de propuesta cuando los dos escriben `pendiente`.
    """
    conn = conn_de_tenant(cid)()
    try:
        with conn.cursor() as cur:
            cur.execute(f"SELECT contexto FROM {TABLA} WHERE id = %s", (trauma_id,))
            contexto = cur.fetchone()[0] or {}
            if isinstance(contexto, str):
                contexto = json.loads(contexto)
            return contexto.get("ultima_nota")
    finally:
        conn.close()


# ======================================================================================
# C1 — el trauma sale de la DLQ y llega entero al gate
# ======================================================================================
@necesita_pg
@necesita_rol_dlq
@pytest.mark.asyncio
async def test_un_trauma_reparable_pasa_los_gates(tenant_de_prueba, conn_de_tenant):
    cid = tenant_de_prueba
    _depositar(conn_de_tenant, cid, archivo="apps/copiloto/cobro_store.py",
               categoria="business_error")

    tomado = await A.tomar_trauma_para_reparar()
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
@necesita_rol_dlq
@pytest.mark.asyncio
async def test_CONTROL_un_trauma_del_dominio_FISCAL_no_pasa(tenant_de_prueba, conn_de_tenant):
    """Equivocarse hacia el permiso acá emite una factura con CAE real ante AFIP. El trauma llega
    con `business_error` —categoría reparable— justamente para que el único motivo posible del
    rechazo sea el dominio."""
    cid = tenant_de_prueba
    _depositar(conn_de_tenant, cid, archivo="apps/copiloto/afip_gateway.py",
               categoria="business_error")

    tomado = await A.tomar_trauma_para_reparar()
    decision = await A.evaluar_gates_de_reparacion(tomado)

    assert not decision["permitido"]
    assert "DIAGNOSTIC_ONLY" in decision["motivo"]


@necesita_pg
@necesita_rol_dlq
@pytest.mark.asyncio
async def test_CONTROL_un_transitorio_no_se_repara(tenant_de_prueba, conn_de_tenant):
    """El gate que recorta la superficie en producción: un 503 no tiene código que reparar."""
    cid = tenant_de_prueba
    _depositar(conn_de_tenant, cid, archivo="apps/copiloto/cobro_store.py",
               categoria="infra_error")

    tomado = await A.tomar_trauma_para_reparar()
    decision = await A.evaluar_gates_de_reparacion(tomado)

    assert not decision["permitido"]
    assert "infra_error" in decision["motivo"]


@necesita_pg
@necesita_rol_dlq
@pytest.mark.asyncio
async def test_un_trauma_SIN_origen_se_rechaza_por_no_localizable(tenant_de_prueba, conn_de_tenant):
    """Todo trauma depositado antes de que las costuras guardaran `origen`. No es un error: es un
    trauma que no se puede reparar, y decirlo es mejor que adivinar el módulo desde el workflow."""
    cid = tenant_de_prueba
    store = TraumaStore(conn_de_tenant(cid), cid)
    store.depositar(fingerprint=uuid.uuid4().hex[:8], workflow="POST /viejo",
                    error_type="KeyError", costura="http_handler",
                    contexto={"categoria": "business_error"})     # sin `origen`

    tomado = await A.tomar_trauma_para_reparar()
    decision = await A.evaluar_gates_de_reparacion(tomado)

    assert not decision["permitido"]
    assert "archivo" in decision["motivo"] and decision["archivo"] is None


# ======================================================================================
# C4 — el rechazo SUELTA el trauma (el que evita el trauma colgado para siempre)
# ======================================================================================
@necesita_pg
@necesita_rol_dlq
@pytest.mark.asyncio
async def test_marcar_trauma_lo_devuelve_a_PENDIENTE_de_verdad(tenant_de_prueba, conn_de_tenant):
    """Se verifica **en la base**, no por el valor de retorno. Con RLS forzado, un UPDATE sin tenant
    declarado afecta 0 filas y devuelve éxito: el ciclo reportaría "lo solté" y el trauma quedaría
    `en_proceso` para siempre, invisible para el próximo disparo."""
    cid = tenant_de_prueba
    _depositar(conn_de_tenant, cid, archivo="apps/copiloto/cobro_store.py",
               categoria="business_error")
    tomado = await A.tomar_trauma_para_reparar()
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
@necesita_rol_dlq
@pytest.mark.asyncio
async def test_marcar_trauma_con_un_ID_INEXISTENTE_falla_fuerte(tenant_de_prueba, conn_de_tenant):
    """El caso adversarial, reescrito el 2026-08-01 junto con la topología.

    **Antes** este test pasaba un `cliente_id` ajeno y esperaba el grito: con RLS forzado y una
    conexión por tenant, el UPDATE no veía la fila, tocaba 0 filas y **devolvía éxito** — el trauma
    quedaba colgado en `en_proceso` con el ciclo informando que lo había soltado.

    Ese modo de fallo **ya no existe**: el ciclo corre con `BYPASSRLS` y encuentra la fila por `id`
    sea de quien sea, que es exactamente lo que necesita un ciclo cross-tenant. El `cliente_id` del
    payload pasó a ser informativo (va en el mensaje de error, no en el `WHERE`).

    Lo que **sigue** existiendo es el fallo silencioso por `id` inexistente — un UPDATE que no
    matchea nada tampoco protesta solo. Ese es el que el guard de `rowcount` cubre hoy, y es el que
    este test ejercita. Se reescribió en vez de borrarse: el guard sigue vivo, cambió cuál es el
    error que puede llegar a él.
    """
    cid = tenant_de_prueba
    _depositar(conn_de_tenant, cid, archivo="apps/copiloto/cobro_store.py",
               categoria="business_error")
    tomado = await A.tomar_trauma_para_reparar()

    with pytest.raises(RuntimeError, match="colgado"):
        await A.marcar_trauma({"id": -1, "estado": PENDIENTE, "nota": "x", "cliente_id": cid})

    # El trauma real quedó intacto: el intento contra un id inexistente no movió nada.
    assert _estado(conn_de_tenant, cid, tomado["id"]) == EN_PROCESO

    # Control positivo del mismo guard: con el id REAL sí marca, aunque el `cliente_id` del payload
    # sea de otro. Sin esta mitad, el test de arriba pasaría también con un `marcar_trauma` que
    # fallara SIEMPRE — que es el instrumento que condena sin mirar.
    await A.marcar_trauma({"id": tomado["id"], "estado": PENDIENTE, "nota": "ok",
                           "cliente_id": str(uuid.uuid4())})
    assert _estado(conn_de_tenant, cid, tomado["id"]) == PENDIENTE


# ======================================================================================
# C7 — al proponer el PR se cierran los HERMANOS: el mismo bug en otros tenants
# ======================================================================================
@necesita_pg
@necesita_rol_dlq
@pytest.mark.asyncio
async def test_proponer_el_PR_cierra_tambien_a_los_hermanos_del_mismo_bug(dos_tenants,
                                                                          conn_de_tenant):
    """La pieza más nueva del rediseño, y la única que escribe filas de OTROS tenants.

    Sin esto la deduplicación duraría un solo disparo: `tomar_un_bug_distinto` elige un
    representante por `fingerprint`, pero los hermanos siguen `pendiente` — y mañana el ciclo toma
    uno, forja el MISMO parche y abre el MISMO PR. Un día por tenant afectado, hasta agotarlos.

    El fallo sería **silencioso**: nada rompe, nadie recibe un error. Aparece recién como PRs
    repetidos que alguien tiene que notar a ojo.
    """
    a, b = dos_tenants
    fp = f"mismo-bug-{uuid.uuid4().hex[:8]}"
    trauma_a = _depositar(conn_de_tenant, a, archivo="apps/copiloto/cobro_store.py",
                          categoria="business_error", fingerprint=fp)
    trauma_b = _depositar(conn_de_tenant, b, archivo="apps/copiloto/cobro_store.py",
                          categoria="business_error", fingerprint=fp)
    # EL CONTROL NEGATIVO, y es lo que hace que el test signifique algo: un trauma de OTRO bug, del
    # mismo tenant. Sin él, un `marcar_trauma` que marcara todo lo pendiente pasaría igual —
    # e imposible de distinguir de uno que agrupa bien.
    otro_bug = _depositar(conn_de_tenant, b, archivo="apps/copiloto/cobro_store.py",
                          categoria="business_error")

    await A.marcar_trauma({"id": trauma_a["id"], "estado": "reparacion_propuesta",
                           "nota": "https://github.com/x/y/pull/1",
                           "cliente_id": a, "fingerprint": fp})

    assert _estado(conn_de_tenant, a, trauma_a["id"]) == "reparacion_propuesta"
    assert _estado(conn_de_tenant, b, trauma_b["id"]) == "reparacion_propuesta", \
        "el hermano quedó pendiente: mañana el ciclo propone el mismo parche otra vez"
    assert _estado(conn_de_tenant, b, otro_bug["id"]) == PENDIENTE, \
        "se cerró un trauma de OTRO bug: el UPDATE de hermanos no está filtrando por fingerprint"


@necesita_pg
@necesita_rol_dlq
@pytest.mark.asyncio
async def test_un_RECHAZO_no_toca_a_los_hermanos(dos_tenants, conn_de_tenant):
    """La cara opuesta, y no es simétrica: soltar el representante NO cierra a nadie más.

    Un rechazo dice "este intento no salió", no "este bug está resuelto". Si el rechazo cerrara a
    los hermanos, un gate demasiado estricto enterraría el bug para todos los tenants de una vez —
    y sin dejar rastro de que había N ocurrencias esperando.

    **Qué prueba exactamente, y qué no.** Prueba el contrato de la ACTIVITY: un payload sin
    `fingerprint` no toca a nadie más. La otra mitad —que el workflow no mande `fingerprint` en sus
    caminos de rechazo— este test no la puede violar, porque él mismo escribe el payload. Esa mitad
    la cubre `test_los_caminos_de_RECHAZO_del_workflow_no_mandan_fingerprint`, abajo; son dos
    invariantes distintos y un solo test que pretendiera cubrir los dos no fallaría por ninguno.
    """
    a, b = dos_tenants
    fp = f"mismo-bug-{uuid.uuid4().hex[:8]}"
    trauma_a = _depositar(conn_de_tenant, a, archivo="apps/copiloto/cobro_store.py",
                          categoria="business_error", fingerprint=fp)
    trauma_b = _depositar(conn_de_tenant, b, archivo="apps/copiloto/cobro_store.py",
                          categoria="business_error", fingerprint=fp)

    # Los caminos de rechazo NO mandan `fingerprint` — es lo que los distingue del que propone PR.
    await A.marcar_trauma({"id": trauma_a["id"], "estado": PENDIENTE,
                           "nota": "rechazado por el gate", "cliente_id": a})

    assert _estado(conn_de_tenant, a, trauma_a["id"]) == PENDIENTE
    assert _nota(conn_de_tenant, a, trauma_a["id"]) == "rechazado por el gate"

    # ⚠️ Mirar el ESTADO del hermano acá no probaría nada: el rechazo escribe `pendiente`, que es lo
    # que el hermano YA tenía — el test pasaría igual con y sin la guarda del `fingerprint`. Lo que
    # sí distingue las dos realidades es la NOTA: si el UPDATE de hermanos hubiera corrido, le
    # habría dejado un "mismo bug que el trauma N" encima.
    assert _estado(conn_de_tenant, b, trauma_b["id"]) == PENDIENTE
    assert _nota(conn_de_tenant, b, trauma_b["id"]) is None, \
        "el rechazo tocó al hermano: un intento fallido no puede cerrar el bug de los otros tenants"


# ======================================================================================
# Zero-Mutation — no se abre nada si el parche no cambió nada
# ======================================================================================
@necesita_pg
@pytest.mark.asyncio
async def test_no_se_propone_NADA_si_el_parche_no_muta(tenant_de_prueba, conn_dlq_cruda, tmp_path):
    """Un PR vacío que dice "reparé X" es peor que no reparar: le enseña al revisor a aprobar sin
    mirar, y esa costumbre después se aplica a los PR que sí cambian algo.

    `proponer_pr_de_reparacion` no toca `_conn_dlq` (sólo lee/escribe archivos), así que este test no
    lleva `@necesita_rol_dlq`: corre igual sin el rol del ciclo. Se le pasa `conn_dlq_cruda` de todos
    modos por ser la forma real que arma el composition root desde 2026-08-01."""
    cid = tenant_de_prueba
    archivo = tmp_path / "modulo.py"
    archivo.write_text("x = 1\n", encoding="utf-8")
    A.set_autosanacion_deps(conn_dlq_cruda, llm_client=None, raiz_repo=tmp_path)

    resultado = await A.proponer_pr_de_reparacion({
        "trauma": {"id": 1, "fingerprint": "abc", "error_type": "KeyError"},
        "forja": {"archivo": "modulo.py", "contenido": "x = 1\n", "parche": "…"},
        "prueba": {"aceptado": True}})

    assert resultado["modo"] == "sin_cambios"
    assert resultado["url"] == ""


# ======================================================================================
# El ciclo NUNCA ramifica sobre el repo desplegado.
# El VPS del worker tiene `gh` autenticado (verificado con `gh auth status`, 2026-07-31).
# Sin este guard, `_abrir_pr` corría `git checkout -b` sobre el repo del que corre el
# servicio vivo. Hoy no explotaba sólo porque ese path no es un repo git — depender de eso
# es depender de que nadie cambie la forma de desplegar.
# ======================================================================================
def test_sin_repo_declarado_NO_se_abre_PR_aunque_haya_gh(monkeypatch, tmp_path):
    monkeypatch.delenv(A.ENV_REPO_GIT, raising=False)
    A.set_autosanacion_deps(lambda: None, raiz_repo=tmp_path)
    assert A._repo_para_pr() is None, "sin repo declarado el modo PR tiene que estar apagado"


def test_el_repo_del_PR_NO_puede_ser_el_DESPLEGADO(monkeypatch, tmp_path):
    """El caso hostil concreto: alguien apunta la variable al repo de producción."""
    (tmp_path / ".git").mkdir()
    monkeypatch.setenv(A.ENV_REPO_GIT, str(tmp_path))
    A.set_autosanacion_deps(lambda: None, raiz_repo=tmp_path)   # el MISMO path
    assert A._repo_para_pr() is None, "ramificar sobre el repo desplegado tiene que ser imposible"


def test_CONTROL_un_repo_distinto_y_valido_SI_habilita_el_PR(monkeypatch, tmp_path):
    """El control positivo. Sin él, un `_repo_para_pr` que devolviera siempre `None` haría pasar los
    dos tests de arriba dejando el modo PR muerto para siempre, sin que nadie se entere."""
    desplegado, clon = tmp_path / "prod", tmp_path / "clon"
    desplegado.mkdir()
    (clon / ".git").mkdir(parents=True)
    monkeypatch.setenv(A.ENV_REPO_GIT, str(clon))
    A.set_autosanacion_deps(lambda: None, raiz_repo=desplegado)
    assert A._repo_para_pr() == clon


def test_un_repo_declarado_que_NO_es_git_no_habilita_nada(monkeypatch, tmp_path):
    desplegado, otro = tmp_path / "prod", tmp_path / "otro"
    desplegado.mkdir()
    otro.mkdir()          # existe pero no tiene .git
    monkeypatch.setenv(A.ENV_REPO_GIT, str(otro))
    A.set_autosanacion_deps(lambda: None, raiz_repo=desplegado)
    assert A._repo_para_pr() is None


# ======================================================================================
# El intérprete del sandbox — la causa de que el gate nunca corriera un test en producción
# ======================================================================================
def test_el_sandbox_usa_el_interprete_del_PROCESO_no_un_python3_del_PATH(monkeypatch):
    """El gate de no-regresión **nunca corrió un solo test en producción**, y no dio síntoma.

    Medido en el primer E2E real (2026-08-01): el default era el literal `"python3"`, el worker corre
    bajo systemd con `PATH=/usr/local/sbin:…:/usr/bin` —**sin el venv**—, así que resolvía a
    `/usr/bin/python3`, que no tiene pytest. El subproceso moría con `No module named pytest`, no
    dejaba ninguna línea de conteo, y el veredicto salía `NO_EVALUABLE`.

    Que fallara hacia RECHAZAR es lo que lo hizo invisible: nunca propuso un parche malo, sólo era
    incapaz de aceptar ninguno. Un mecanismo de seguridad roto hacia el "no" no protesta.

    `sys.executable` es correcto **por construcción** —es el intérprete que ya está corriendo el
    worker, con su venv— y no puede driftear con el `PATH`."""
    import sys

    monkeypatch.delenv("COPILOTO_SANDBOX_PYTHON", raising=False)
    elegido = os.environ.get("COPILOTO_SANDBOX_PYTHON") or sys.executable
    assert elegido == sys.executable
    assert elegido != "python3", "un nombre suelto depende del PATH; el del proceso no"


def test_CONTROL_la_env_var_sigue_pudiendo_forzar_otro_interprete(monkeypatch):
    """El control del de arriba: si `sys.executable` ganara SIEMPRE, el override no existiría y no se
    podría apuntar el sandbox a otro venv sin tocar código."""
    import sys

    monkeypatch.setenv("COPILOTO_SANDBOX_PYTHON", "/otro/venv/bin/python")
    elegido = os.environ.get("COPILOTO_SANDBOX_PYTHON") or sys.executable
    assert elegido == "/otro/venv/bin/python" != sys.executable


# ======================================================================================
# C8 — la otra mitad del invariante: qué manda el WORKFLOW en los caminos de rechazo
# ======================================================================================
@pytest.mark.asyncio
async def test_los_caminos_de_RECHAZO_del_workflow_no_mandan_fingerprint(monkeypatch):
    """`_soltar` NO puede llevar `fingerprint` en el payload: si lo llevara, cada rechazo cerraría
    el bug para todos los tenants que lo sufren, sin haberlo reparado para ninguno.

    Sin Temporal: `_soltar` es un método async común y `workflow.execute_activity` es una función
    del módulo. Se la reemplaza por un registrador y se lee lo que el workflow QUISO mandar — que es
    exactamente el invariante, y el único lugar donde se puede romper. Levantar un `WorkflowEnvironment`
    mediría el arranque de Temporal, no esto.
    """
    from autosanacion_workflow import AutosanacionWorkflow

    enviados = []

    async def _registrar(nombre, payload=None, **kw):
        enviados.append((nombre, payload))
        return None

    monkeypatch.setattr("autosanacion_workflow.workflow.execute_activity", _registrar)

    trauma = {"id": 7, "cliente_id": "dueño-de-la-ocurrencia", "fingerprint": "fp-del-bug"}
    await AutosanacionWorkflow()._soltar(trauma, "rechazado por el gate")

    assert len(enviados) == 1
    nombre, payload = enviados[0]
    assert nombre == "marcar_trauma"
    assert payload["estado"] == "pendiente"
    assert "fingerprint" not in payload, (
        "el camino de rechazo manda fingerprint: `marcar_trauma` cerraría a los hermanos y el bug "
        "quedaría enterrado para los otros tenants sin haberse reparado para ninguno")
    # Control positivo del mismo instrumento: si el registrador no viera nada, el assert de arriba
    # pasaría vacío. El dueño SÍ tiene que viajar — es lo que la activity necesita para el mensaje.
    assert payload["cliente_id"] == "dueño-de-la-ocurrencia"


# ======================================================================================
# C9 — el camino de PR contra un repo git REAL (el que nunca se había ejercitado)
# ======================================================================================
@pytest.mark.asyncio
async def test_abrir_pr_ESCRIBE_el_parche_en_el_clon_y_lo_commitea(tmp_path):
    """El bug del 2026-08-01: `_abrir_pr` hacía `git add <archivo>` sobre un clon PRÍSTINO.

    Nunca escribía `forja["contenido"]` en el árbol, así que no había nada staged, `git commit`
    fallaba y el ciclo degradaba a artefacto — con el `stderr` real tragado por el `except`. Vivió
    roto sin dar síntoma porque `COPILOTO_AUTOSANACION_REPO_GIT` no estaba seteada en producción:
    el ciclo salía por el artefacto **antes** de llegar a esta función. Un camino muerto no se
    rompe, espera.

    Este test lo ejercita contra un repo git de verdad. `gh` y el `push` van a fallar (no hay
    remoto), y eso está bien: lo que se verifica es el ESTADO DEL REPO —que el parche llegó al
    árbol y quedó commiteado—, que es exactamente lo que estaba roto. Verificar el desenlace
    devuelto no serviría: `artefacto` es lo que devolvía cuando estaba roto Y cuando no hay remoto.
    """
    import subprocess

    repo = tmp_path / "clon"
    repo.mkdir()
    def git(*a, **kw):
        return subprocess.run(["git", "-C", str(repo), *a], capture_output=True, text=True,
                              check=kw.pop("check", True))
    git("init", "--quiet", "--initial-branch=main")
    git("config", "user.email", "t@t.local")
    git("config", "user.name", "t")
    (repo / "modulo.py").write_text("def f():\n    return 1\n", encoding="utf-8")
    git("add", "modulo.py")
    git("commit", "--quiet", "-m", "base")
    # `origin` apuntando a sí mismo: el fetch/reset del arranque necesitan un remoto que resuelva.
    git("remote", "add", "origin", str(repo))
    git("fetch", "--quiet", "origin")

    reparado = "def f():\n    return 2  # reparado\n"
    A._abrir_pr(repo, tmp_path / "x.patch",
                {"archivo": "modulo.py", "contenido": reparado, "parche": "..."},
                {"id": 42, "error_type": "KeyError", "workflow": "POST /x", "dedupe_count": 3})

    # LO QUE ESTABA ROTO: el contenido reparado tiene que estar EN EL COMMIT de la rama.
    rama = "autosanacion/trauma-42"
    ramas = git("branch", "--list", rama).stdout
    assert rama in ramas, f"no se creó la rama {rama}"
    commiteado = git("show", f"{rama}:modulo.py").stdout
    assert commiteado == reparado, (
        "el parche NO llegó al commit: es exactamente el bug que hacía que el ciclo no pudiera "
        "abrir un PR ni una vez")
    # Y el commit existe de verdad, no es sólo el árbol sucio.
    assert git("log", "-1", "--format=%s", rama).stdout.strip().startswith("fix(autosanacion):")


@pytest.mark.asyncio
async def test_abrir_pr_NO_commitea_si_el_parche_no_cambia_nada(tmp_path):
    """Control negativo, y no es simétrico del anterior: si el "parche" es idéntico a lo que ya
    hay, no se abre nada. Un PR vacío que dice "reparé X" es peor que no reparar — le enseña al
    revisor a aprobar sin mirar, y esa costumbre después se aplica a los PR que sí cambian algo.

    Sin este control, el test de arriba pasaría también con un `_abrir_pr` que commiteara SIEMPRE.
    """
    import subprocess

    repo = tmp_path / "clon"
    repo.mkdir()
    def git(*a):
        return subprocess.run(["git", "-C", str(repo), *a], capture_output=True, text=True,
                              check=True)
    git("init", "--quiet", "--initial-branch=main")
    git("config", "user.email", "t@t.local")
    git("config", "user.name", "t")
    igual = "def f():\n    return 1\n"
    (repo / "modulo.py").write_text(igual, encoding="utf-8")
    git("add", "modulo.py")
    git("commit", "--quiet", "-m", "base")
    git("remote", "add", "origin", str(repo))
    git("fetch", "--quiet", "origin")

    resultado = A._abrir_pr(repo, tmp_path / "x.patch",
                            {"archivo": "modulo.py", "contenido": igual, "parche": "..."},
                            {"id": 43, "error_type": "KeyError", "workflow": "POST /x",
                             "dedupe_count": 1})

    assert resultado["modo"] == "sin_cambios", resultado
    assert "ninguna diferencia" in resultado["motivo"]
