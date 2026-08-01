"""La DLQ deduplica, transiciona y aísla — Fase 2, ítems 2.1 a 2.4.

Corre contra Postgres real (no un mock): lo que se verifica acá —`ON CONFLICT … RETURNING (xmax=0)`,
`FOR UPDATE SKIP LOCKED`, el `WITH CHECK` de la policy— **es comportamiento de la base**. Un doble no
reproduce ninguno de los tres, y el spike S2 existe precisamente porque el detalle que importaba
(la clave compuesta) no se deducía del código.

## 2026-08-01 — `tomar_un_bug_distinto()` y `hermanos_del_mismo_bug()` son CROSS-TENANT

Necesitan un `TraumaStore` construido con una conexión SIN tenant: el rol `copiloto_autosanacion`
(`BYPASSRLS`, acotado a `copiloto_traumas`), que `test-db.sh` crea al lado de `copiloto_app` — este
último sigue siendo `NOSUPERUSER NOBYPASSRLS` con `FORCE RLS` porque es el que permite verificar que
el aislamiento aplica. Dos roles, dos propósitos opuestos, los dos necesarios.

`test_tomar_un_bug_distinto_agrupa_por_fingerprint_cross_tenant` es **el control del rediseño**: con
un solo tenant, un ciclo por tenant y un ciclo global se ven idénticos, así que sólo dos dueños con
el mismo `fingerprint` distinguen uno del otro.
"""
from __future__ import annotations

import os
import uuid

import pytest

from trauma_store import (DESCARTADO, EN_PROCESO, PENDIENTE, RESUELTO, TABLA, TraumaStore,
                          flood_threshold)

necesita_pg = pytest.mark.skipif(not os.environ.get("DATABASE_URL"),
                                 reason="requiere Postgres real (DATABASE_URL)")

#: Se salta, no se degrada: con `copiloto_app` este control no daría rojo — daría "no hay traumas",
#: que es un desenlace legítimo. Un test que no puede fallar cuando lo que mide está roto no mide.
necesita_rol_dlq = pytest.mark.skipif(
    not os.environ.get("COPILOTO_AUTOSANACION_DSN"),
    reason="requiere el rol del ciclo (BYPASSRLS): levantá la base con `test-db.sh` y pasá "
           "UC_TEST_AUTOSANACION_URL a sync-test-backend.sh")


@pytest.fixture
def store_cruda():
    """Un `TraumaStore` SIN tenant (`cliente_id=""`) con conexión CRUDA del rol del ciclo — la misma
    forma que arma el composition root desde 2026-08-01 (`worker_b.py` → `conn_dlq`).

    Lee `COPILOTO_AUTOSANACION_DSN`, el MISMO nombre que en producción: darle otro haría que la
    suite ejercite un cableado inexistente. Y va cruda a propósito — envolverla con `conn_de_tenant`
    mediría lo contrario de lo que este test verifica.
    """
    import psycopg2

    def factory():
        conn = psycopg2.connect(os.environ["COPILOTO_AUTOSANACION_DSN"])
        conn.autocommit = True
        return conn

    return TraumaStore(factory)


@pytest.fixture
def tenants(conn_de_tenant):
    """Dos tenants sintéticos y el barrido de lo que esta prueba escriba.

    El DELETE va **uno por tenant, con la conexión de ese tenant**: con RLS, la conexión de A no
    puede borrar las filas de B aunque el `WHERE` las incluyera."""
    a, b = str(uuid.uuid4()), str(uuid.uuid4())
    yield a, b
    for cid in (a, b):
        conn = conn_de_tenant(cid)()
        with conn.cursor() as cur:
            cur.execute("DELETE FROM uc_factory.copiloto_traumas WHERE cliente_id = %s", (cid,))
        conn.close()


def _store(conn_de_tenant, cid):
    return TraumaStore(conn_de_tenant(cid), cid)


def _depositar(store, *, fingerprint="fp-1", workflow="emitir_factura",
               error_type="RuntimeError", **kw):
    return store.depositar(fingerprint=fingerprint, workflow=workflow,
                           error_type=error_type, **kw)


def _estado(conn_de_tenant, cid: str, trauma_id: int) -> str:
    """El estado de una fila puntual, leído con la conexión DEL DUEÑO — el store cross-tenant no
    tiene `listar()` filtrado a un tenant, así que el control necesita esta lectura directa."""
    conn = conn_de_tenant(cid)()
    try:
        with conn.cursor() as cur:
            cur.execute(f"SELECT estado FROM {TABLA} WHERE id = %s", (trauma_id,))
            return cur.fetchone()[0]
    finally:
        conn.close()


# ======================================================================================
# 2.1 — dedupe
# ======================================================================================
@necesita_pg
def test_dos_errores_iguales_dejan_UNA_fila_con_dedupe_count_2(tenants, conn_de_tenant):
    """El cierre binario del ítem 2.1, textual en el plan."""
    a, _ = tenants
    store = _store(conn_de_tenant, a)

    primero = _depositar(store)
    segundo = _depositar(store)

    assert primero["insertado"] is True and primero["dedupe_count"] == 1
    assert segundo["insertado"] is False and segundo["dedupe_count"] == 2
    assert len(store.listar()) == 1, "el segundo error creó una fila nueva en vez de contar"


@necesita_pg
def test_dos_fingerprints_distintos_son_dos_filas(tenants, conn_de_tenant):
    """Control positivo del test de arriba: si TODO colapsara en una fila, aquel pasaría igual y
    estaría midiendo un bug, no la deduplicación."""
    a, _ = tenants
    store = _store(conn_de_tenant, a)
    _depositar(store, fingerprint="fp-1")
    _depositar(store, fingerprint="fp-2")
    assert len(store.listar()) == 2


@necesita_pg
def test_ADVERSARIAL_el_MISMO_fingerprint_en_DOS_tenants_no_colisiona(tenants, conn_de_tenant):
    """La corrección del spike S2, y la razón de que la clave única sea compuesta.

    Dos tenants sufren el mismo error → mismo `fingerprint` (se calcula de workflow + tipo, no del
    tenant). Con un índice único global, el segundo chocaría contra una fila **que su policy le impide
    ver**: un conflicto irresoluble sobre algo invisible. Cada uno tiene que tener su propia fila y su
    propio contador.
    """
    a, b = tenants
    store_a, store_b = _store(conn_de_tenant, a), _store(conn_de_tenant, b)

    _depositar(store_a, fingerprint="fp-compartido")
    _depositar(store_a, fingerprint="fp-compartido")
    de_b = _depositar(store_b, fingerprint="fp-compartido")

    assert de_b is not None, "B no pudo depositar el mismo fingerprint que A"
    assert de_b["insertado"] is True, "B actualizó la fila de A en vez de crear la suya"
    assert de_b["dedupe_count"] == 1, "B heredó el contador de A"

    (fila_a,) = store_a.listar()
    assert fila_a["dedupe_count"] == 2, "la fila de A se vio afectada por el depósito de B"


@necesita_pg
def test_ADVERSARIAL_un_tenant_no_ve_los_traumas_del_otro(tenants, conn_de_tenant):
    """Dos barreras y el test cruza las dos: el filtro por `cliente_id` del store y el RLS de la base
    —la conexión de B nace declarando B, así que la fila de A le es invisible aunque la query se
    olvidara del WHERE."""
    a, b = tenants
    _depositar(_store(conn_de_tenant, a), fingerprint="solo-de-A")
    assert _store(conn_de_tenant, b).listar() == []


# ======================================================================================
# 2.3 — umbral de inundación parametrizado
# ======================================================================================
@necesita_pg
def test_el_umbral_de_inundacion_es_PARAMETRIZABLE_no_el_10_hardcodeado(tenants, conn_de_tenant,
                                                                       monkeypatch):
    """Ítem 2.3. El `10` de ARCA no sirve igual para un tenant de 3 usuarios que para uno de 3000."""
    monkeypatch.setenv("COPILOTO_FLOOD_THRESHOLD", "3")
    a, _ = tenants
    store = _store(conn_de_tenant, a)

    marcas = [_depositar(store)["inundado"] for _ in range(3)]
    assert marcas == [False, False, True], f"el umbral inyectado no se respetó: {marcas}"


def test_un_umbral_invalido_se_degrada_al_default_en_vez_de_lanzar(monkeypatch):
    """Regla 1: nada del manejo de errores puede lanzar. Una env var mal escrita no puede ser el
    motivo de que se deje de capturar errores."""
    monkeypatch.setenv("COPILOTO_FLOOD_THRESHOLD", "no-es-un-numero")
    assert flood_threshold() == 10
    monkeypatch.setenv("COPILOTO_FLOOD_THRESHOLD", "0")
    assert flood_threshold() == 10


# ======================================================================================
# 2.4 — máquina de 3 estados + ventana
# ======================================================================================
@necesita_pg
def test_las_tres_transiciones_pendiente_en_proceso_resuelto(tenants, conn_de_tenant):
    """Ítem 2.4: el cierre pide las tres transiciones, no sólo que la tabla tenga una columna."""
    a, _ = tenants
    store = _store(conn_de_tenant, a)
    _depositar(store)

    (recien,) = store.listar()
    assert recien["estado"] == PENDIENTE

    tomados = store.tomar()
    assert len(tomados) == 1 and tomados[0]["intentos"] == 1
    (en_curso,) = store.listar()
    assert en_curso["estado"] == EN_PROCESO

    assert store.cerrar(en_curso["id"]) is True
    (cerrado,) = store.listar()
    assert cerrado["estado"] == RESUELTO


@necesita_pg
def test_tomar_NO_devuelve_dos_veces_el_mismo_trauma(tenants, conn_de_tenant):
    """Si `tomar()` no marcara al tomar, dos recuperadores repararían el mismo error dos veces — y en
    un dominio con efectos, eso es el bug que la DLQ venía a evitar."""
    a, _ = tenants
    store = _store(conn_de_tenant, a)
    _depositar(store)

    assert len(store.tomar()) == 1
    assert store.tomar() == [], "el mismo trauma se entregó dos veces"


@necesita_pg
def test_un_trauma_que_REAPARECE_se_reabre_en_vez_de_quedar_resuelto(tenants, conn_de_tenant):
    """Un error cerrado que vuelve a ocurrir no sigue 'resuelto': si no se reabriera, quedaría
    enterrado bajo su propio cierre anterior y nadie volvería a mirarlo."""
    a, _ = tenants
    store = _store(conn_de_tenant, a)
    _depositar(store)
    (t,) = store.listar()
    store.cerrar(t["id"])

    _depositar(store)
    (reabierto,) = store.listar()
    assert reabierto["estado"] == PENDIENTE
    assert reabierto["dedupe_count"] == 2


@necesita_pg
def test_un_en_proceso_COLGADO_vuelve_a_pendiente_por_la_ventana(tenants, conn_de_tenant):
    """La ventana `updated_at < now() - N` del ítem 2.4.

    Sin ella, un proceso que muere a mitad de reparar deja su trauma en `en_proceso` **para siempre**:
    un sumidero donde los errores entran y no salen, y que encima **no da síntoma** — la cola de
    pendientes se ve vacía porque todo figura "en proceso".
    """
    a, _ = tenants
    store = _store(conn_de_tenant, a)
    _depositar(store)
    store.tomar()

    # Con la ventana por delante del reloj, nada es viejo todavía: el control de que no barre de más.
    assert store.rescatar_colgados(minutos=60) == 0
    assert store.listar()[0]["estado"] == EN_PROCESO

    # `minutos=0` hace que cualquier `updated_at` pasado califique — sin esperar de verdad.
    assert store.rescatar_colgados(minutos=0) == 1
    assert store.listar()[0]["estado"] == PENDIENTE


@necesita_pg
def test_cerrar_con_un_estado_invalido_es_un_error_del_programador(tenants, conn_de_tenant):
    """Acá SÍ se lanza, y no contradice la regla 1: la regla protege el camino de captura de errores
    (`depositar`), no una llamada mal escrita a la API de cierre."""
    a, _ = tenants
    store = _store(conn_de_tenant, a)
    with pytest.raises(ValueError):
        store.cerrar(1, estado="masomenos")
    assert store.cerrar(-1, estado=DESCARTADO) is False   # id inexistente: no rompe, devuelve False


# ======================================================================================
# 2.2 — nunca lanza
# ======================================================================================
def test_depositar_NUNCA_lanza_aunque_la_base_este_caida():
    """Ítem 2.2. Un fallo al depositar un trauma no puede tumbar el turno del usuario: sería el manejo
    de errores generando el error que venía a manejar."""
    def factory_que_falla():
        raise RuntimeError("la base no está")

    store = TraumaStore(factory_que_falla, str(uuid.uuid4()))
    assert store.depositar(fingerprint="fp", workflow="w", error_type="E") is None


def test_depositar_NUNCA_lanza_aunque_la_query_reviente():
    """El otro lado del mismo ítem: la conexión abre bien y es la sentencia la que falla."""
    class _CursorRoto:
        def __enter__(self): return self
        def __exit__(self, *_): return False
        def execute(self, *_a, **_k): raise RuntimeError("sintaxis inválida")

    class _ConnRota:
        def cursor(self): return _CursorRoto()
        def close(self): pass

    store = TraumaStore(lambda: _ConnRota(), str(uuid.uuid4()))
    assert store.depositar(fingerprint="fp", workflow="w", error_type="E") is None


# ======================================================================================
# 2026-08-01 — el ciclo pasó a ser UNO SOLO cross-tenant: agrupa por BUG, no por ocurrencia
# ======================================================================================
@necesita_pg
@necesita_rol_dlq
def test_tomar_un_bug_distinto_agrupa_por_fingerprint_cross_tenant(tenants, conn_de_tenant,
                                                                    store_cruda):
    """EL CONTROL DEL REDISEÑO. Dos tenants distintos sufren el MISMO bug (mismo `fingerprint`):
    `tomar_un_bug_distinto()` tiene que devolver UN SOLO representante —no uno por tenant—, y
    `hermanos_del_mismo_bug(fingerprint, excepto=<el tomado>)` tiene que devolver justo el otro.

    Sin esto el ciclo forjaría el MISMO parche dos veces y abriría dos PRs idénticos para un único
    defecto de nuestro código — exactamente lo que el índice único `(cliente_id, fingerprint)` obliga
    a que pase si nadie agrupa (ver `trauma_store.tomar_un_bug_distinto`).

    Es el ÚNICO test que distingue el rediseño de la topología anterior: con un solo tenant, un ciclo
    por tenant y un ciclo global se comportan exactamente igual.
    """
    a, b = tenants
    store_a, store_b = _store(conn_de_tenant, a), _store(conn_de_tenant, b)
    #: Único por corrida: `store_cruda` ve la DLQ ENTERA, así que un fingerprint fijo podría chocar
    #: con el de otra corrida que dejó filas colgadas.
    fingerprint = f"fp-mismo-bug-{uuid.uuid4().hex[:8]}"

    # Varias veces a propósito: `tomar_un_bug_distinto` ordena por `dedupe_count DESC` (se repara
    # primero lo que más duele) y esta conexión ve los pendientes de TODA la base de tests. Con un
    # solo hit, un residuo de otro test podría ganarle el turno y el test fallaría por contaminación
    # en vez de por el comportamiento que mide.
    for _ in range(9):
        _depositar(store_a, fingerprint=fingerprint)
        _depositar(store_b, fingerprint=fingerprint)

    tomado = store_cruda.tomar_un_bug_distinto()
    assert tomado is not None, "el store cross-tenant no vio ningún trauma pendiente"
    assert tomado["fingerprint"] == fingerprint, (
        f"tomó {tomado['fingerprint']!r} en vez del bug de este test: hay pendientes viejos con "
        f"dedupe_count más alto en la base de tests (contaminación, no un fallo del agrupado)")
    # Que el representante sea de A o de B ya prueba lo cross-tenant: `store_cruda` nunca declaró
    # ningún tenant y sin embargo alcanzó la fila de uno de los dos.
    assert tomado["cliente_id"] in (a, b), "el representante tiene que ser el de A o el de B"
    assert _estado(conn_de_tenant, tomado["cliente_id"], tomado["id"]) == EN_PROCESO

    hermanos = store_cruda.hermanos_del_mismo_bug(fingerprint, excepto=tomado["id"])
    assert len(hermanos) == 1, "tiene que quedar exactamente el OTRO tenant, pendiente"
    dueno_del_otro = b if tomado["cliente_id"] == a else a
    assert hermanos[0]["cliente_id"] == dueno_del_otro
    # El hermano NO se tocó al tomar (se cierra recién al marcar `reparacion_propuesta`): sigue
    # pendiente, no en_proceso.
    assert _estado(conn_de_tenant, dueno_del_otro, hermanos[0]["id"]) == PENDIENTE
