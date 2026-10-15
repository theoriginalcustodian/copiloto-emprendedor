"""Aislamiento cross-tenant de `PresupuestoStore` contra Postgres real (hallazgo 2026-08-04, M-WEB RLS).

Los únicos `test_ADVERSARIAL_*` de presupuestos (`test_presupuestos_web.py`) corren contra
`_FakePresupuestoStore`, un dict en memoria — prueban que `presupuestos_web.py` pasa bien el tenant,
no que el SQL real de `PresupuestoStore` (`WHERE cliente_id=%s`) aísla contra Postgres/RLS. Mismo
patrón que `test_actividad_store.py`/`test_cliente_store.py`: conexiones reales por tenant
(`conn_de_tenant`, RLS `FORCE`), un actor A intentando activamente el recurso de B.
"""
from __future__ import annotations

import os
import uuid

import pytest

from presupuesto_store import PresupuestoStore

necesita_pg = pytest.mark.skipif(not os.environ.get("DATABASE_URL"),
                                 reason="requiere Postgres del VPS (DATABASE_URL)")


@pytest.fixture
def tenants(conn_de_tenant):
    a, b = str(uuid.uuid4()), str(uuid.uuid4())
    yield a, b
    for cid in (a, b):
        conn = conn_de_tenant(cid)()
        with conn.cursor() as cur:
            cur.execute("DELETE FROM uc_factory.copiloto_presupuesto_items WHERE cliente_id = %s",
                        (cid,))
            cur.execute("DELETE FROM uc_factory.copiloto_presupuestos WHERE cliente_id = %s", (cid,))
            cur.execute("DELETE FROM uc_factory.copiloto_eventos WHERE cliente_id = %s", (cid,))
        conn.close()


def _presu_de_b(conn_de_tenant, b):
    return PresupuestoStore(conn_de_tenant(b), b).crear(
        concepto="Secreto de B", receptor={"nombre": "Cliente de B"},
        items=[{"descripcion": "Trabajo", "cantidad": 1, "precio_unitario": "999999.00"}])


@necesita_pg
def test_aislamiento_A_no_ve_el_listado_de_B(conn_de_tenant, tenants):
    a, b = tenants
    _presu_de_b(conn_de_tenant, b)
    assert PresupuestoStore(conn_de_tenant(a), a).listar() == []


@necesita_pg
def test_aislamiento_A_no_lee_el_detalle_de_B(conn_de_tenant, tenants):
    a, b = tenants
    creado = _presu_de_b(conn_de_tenant, b)
    assert PresupuestoStore(conn_de_tenant(a), a).detalle(creado["id"]) is None


@necesita_pg
def test_aislamiento_A_no_puede_adjuntar_doc_al_presupuesto_de_B(conn_de_tenant, tenants):
    a, b = tenants
    creado = _presu_de_b(conn_de_tenant, b)
    PresupuestoStore(conn_de_tenant(a), a).adjuntar_doc(
        creado["id"], doc_id="doc-de-a", doc_link="https://a.example/doc")
    # UPDATE con WHERE cliente_id=%s: si A lograra tocarlo, esto lo detecta leyendo como B
    assert PresupuestoStore(conn_de_tenant(b), b).detalle(creado["id"])["doc_id"] is None


@necesita_pg
def test_aislamiento_A_no_puede_marcar_factura_en_el_presupuesto_de_B(conn_de_tenant, tenants):
    a, b = tenants
    creado = _presu_de_b(conn_de_tenant, b)
    tocado = PresupuestoStore(conn_de_tenant(a), a).marcar_factura(creado["id"], "factura-de-a")
    assert tocado is False
    assert PresupuestoStore(conn_de_tenant(b), b).detalle(creado["id"])["factura_id"] is None


@necesita_pg
def test_aislamiento_A_no_puede_cambiar_el_estado_del_presupuesto_de_B(conn_de_tenant, tenants):
    a, b = tenants
    creado = _presu_de_b(conn_de_tenant, b)
    resultado = PresupuestoStore(conn_de_tenant(a), a).cambiar_estado(creado["id"], "aprobado")
    assert resultado is None
    assert PresupuestoStore(conn_de_tenant(b), b).detalle(creado["id"])["estado"] == "pendiente"


# --- K-01 (BL-D1/BL-J1): idempotencia del alta, contra Postgres real ---------------------------

def _crear(store, **kw):
    return store.crear_idem(concepto="Reparación", receptor={"nombre": "Los Tilos"},
                            items=[{"descripcion": "Mano de obra", "cantidad": 1,
                                    "precio_unitario": "8000.00"}], **kw)


def _cuantos(conn_de_tenant, cid):
    conn = conn_de_tenant(cid)()
    with conn.cursor() as cur:
        cur.execute("SELECT count(*) FROM uc_factory.copiloto_presupuestos WHERE cliente_id = %s",
                    (cid,))
        return cur.fetchone()[0]


@necesita_pg
def test_K01_dos_crear_con_la_misma_idem_key_dejan_UN_registro(conn_de_tenant, tenants):
    a, _ = tenants
    store = PresupuestoStore(conn_de_tenant(a), a)
    p1, rep1 = _crear(store, idem_key="clave-k01-1")
    p2, rep2 = _crear(store, idem_key="clave-k01-1")
    assert (rep1, rep2) == (False, True)
    assert p1["id"] == p2["id"] and p1["numero"] == p2["numero"]
    assert _cuantos(conn_de_tenant, a) == 1          # conteo CON claims (la conexión ya las lleva)


@necesita_pg
def test_K01_sin_idem_key_o_con_None_repetido_sigue_creando_una_fila_nueva(conn_de_tenant, tenants):
    a, _ = tenants
    store = PresupuestoStore(conn_de_tenant(a), a)
    _crear(store); _crear(store, idem_key=None); _crear(store, idem_key="   ")
    assert _cuantos(conn_de_tenant, a) == 3


@necesita_pg
def test_K01_carrera_dos_altas_concurrentes_misma_clave_dejan_UN_registro(conn_de_tenant, tenants):
    """La ventana SELECT→INSERT: sin el índice único parcial, las dos pasarían el SELECT vacío."""
    from concurrent.futures import ThreadPoolExecutor
    a, _ = tenants
    def alta(_):
        return _crear(PresupuestoStore(conn_de_tenant(a), a), idem_key="clave-carrera")
    with ThreadPoolExecutor(max_workers=2) as ex:
        resultados = list(ex.map(alta, range(2)))
    assert _cuantos(conn_de_tenant, a) == 1
    assert len({r[0]["id"] for r in resultados}) == 1
    assert sorted(r[1] for r in resultados) == [False, True]


@necesita_pg
def test_K01_la_misma_clave_en_otro_tenant_NO_colisiona_ni_devuelve_lo_ajeno(conn_de_tenant, tenants):
    """Adversarial barato: la clave es única POR tenant; B con la clave de A crea el suyo."""
    a, b = tenants
    pa, _ = _crear(PresupuestoStore(conn_de_tenant(a), a), idem_key="clave-compartida")
    pb, rep = _crear(PresupuestoStore(conn_de_tenant(b), b), idem_key="clave-compartida")
    assert rep is False and pb["id"] != pa["id"]
    assert PresupuestoStore(conn_de_tenant(b), b).detalle(pa["id"]) is None


# --- SM-D2/3 (trabajos.ts) + detector: un listado con tope no puede cortar EN SILENCIO ----------------

def _alta(store, n):
    return store.crear(concepto=f"Trabajo {n}", receptor={"nombre": "Cliente"},
                       items=[{"descripcion": "Mano de obra", "cantidad": 1,
                               "precio_unitario": "1000.00"}])


@necesita_pg
def test_contar_es_del_TENANT_ignora_el_limit_y_comparte_el_filtro_con_listar(conn_de_tenant, tenants):
    a, b = tenants
    sa = PresupuestoStore(conn_de_tenant(a), a)
    for n in range(5):
        _alta(sa, n)
    for n in range(3):                       # el tenant B NO suma al total de A
        _alta(PresupuestoStore(conn_de_tenant(b), b), n)
    assert len(sa.listar(limit=2)) == 2 and sa.contar() == 5
    # mismo filtro: el reemplazado no cuenta en `contar` igual que no aparece en `listar`
    p = _alta(sa, 99)
    sa.crear(concepto="Corrección", receptor={"nombre": "Cliente"}, reemplaza_a=p["id"],
             items=[{"descripcion": "Mano de obra", "cantidad": 1, "precio_unitario": "1100.00"}])
    assert sa.contar() == len(sa.listar(limit=None)) == 6
    assert sa.contar(incluir_reemplazados=True) == len(sa.listar(limit=None, incluir_reemplazados=True)) == 7


@necesita_pg
def test_listar_con_tope_corta_los_MAS_VIEJOS_y_estado_pendiente_no_pierde_ninguno(conn_de_tenant, tenants):
    """El defecto del detector: `listar(limit=N)` ordena por `fecha DESC`, así que con más de N filas
    se pierde el pendiente MÁS VIEJO — justo el que lleva más tiempo sin respuesta. Acá el viejo queda
    pendiente y los 2 nuevos se aprueban: el tope de 2 devuelve sólo aprobados (control positivo del
    defecto) y `estado=pendiente` sin tope lo encuentra."""
    a, _ = tenants
    s = PresupuestoStore(conn_de_tenant(a), a)
    viejo = _alta(s, 0)
    for n in (1, 2):
        s.cambiar_estado(_alta(s, n)["id"], "aprobado")
    con_tope = s.listar(limit=2)
    assert viejo["id"] not in {p["id"] for p in con_tope}, "el tope corta al más viejo (defecto)"
    pendientes = s.listar(limit=None, estado="pendiente")
    assert [p["id"] for p in pendientes] == [viejo["id"]]
    assert {p["estado"] for p in pendientes} == {"pendiente"}


@necesita_pg
def test_el_detector_ve_el_pendiente_mas_viejo_aunque_haya_mas_de_200(conn_de_tenant, tenants):
    """Control positivo del detector contra el camino real: 205 presupuestos pendientes; con el
    `listar(limit=200)` previo los 5 más viejos no llegaban a `_evaluar_presupuestos_enfriandose` y su
    alerta «se enfría» no se emitía, sin error."""
    import mi_dia_detector as detector
    a, _ = tenants
    s = PresupuestoStore(conn_de_tenant(a), a)
    ids = [_alta(s, n)["id"] for n in range(205)]
    vistos = {p["id"] for p in detector._candidatos_presupuestos_enfriandose(conn_de_tenant(a), a)}
    assert vistos == set(ids), f"faltan {len(set(ids) - vistos)} (los más viejos)"
