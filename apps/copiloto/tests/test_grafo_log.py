"""Hito 5 §1.1 — el log `copiloto_eventos`, contra Postgres real.

Contra la base y no contra fakes, a propósito. Lo que el §1.1 promete vive en el gancho + el índice,
no en un fake que devolvería lo que le pedimos:

- **cada mutación deja su evento** (y con los datos que el `fact_template` va a necesitar leer);
- **un replay idempotente NO duplica el evento** —cobro con misma `idem_key`, retry del upsert de
  comprobante, re-anulación, re-marcar el mismo estado—: es el guard que separa "loggeé el hecho" de
  "loggeé cada intento";
- el **de→a** de un cambio de precio/estado es correcto, y **volver a un valor anterior es un evento
  NUEVO** (id de log distinto) — el caso que la identidad de arista de estado necesita para no
  resucitar la arista invalidada (§2.3, trampa 4);
- el log respeta el **aislamiento por tenant**.

⚠️ Estos ganchos son *append best-effort* bajo autocommit (ver `evento_store`): el test verifica QUÉ
se escribe y que no se duplique, no la atomicidad —que el diseño explícitamente no da en esta etapa—.
"""
from __future__ import annotations

import os
import uuid
from decimal import Decimal

import pytest

from afip_comprobante_store import ESTADO_ANULADA, ESTADO_EMITIDA, AfipComprobanteStore
from cobro_store import CobroStore
from concepto_store import ConceptoStore
from gasto_store import GastoStore
from presupuesto_store import APROBADO, PENDIENTE, PresupuestoStore
from trabajo_store import TrabajoStore

necesita_pg = pytest.mark.skipif(not os.environ.get("DATABASE_URL"),
                                 reason="requiere Postgres del VPS (DATABASE_URL)")

_EVENTOS = "uc_factory.copiloto_eventos"

# El contrato de la ontología en un set: los (entidad_tipo, evento) que el §1.1 declara. Un typo en un
# gancho —'concepto'/'conceptos', 'creado'/'creada'— escribiría un par fuera de este set, y lo rompe
# ESTE test, no el derivador tres capas más arriba leyendo un entidad_tipo que no reconoce.
PARES_ESPERADOS = {
    ("cobro", "creado"), ("cobro", "corregido"),
    ("concepto", "creado"), ("concepto", "precio_cambiado"),
    ("gasto", "creado"), ("gasto", "imputado"), ("gasto", "desimputado"),
    ("presupuesto", "creado"), ("presupuesto", "estado_cambiado"),
    ("comprobante", "emitido"), ("comprobante", "estado_cambiado"),
}


@pytest.fixture
def conn_factory():
    import psycopg2

    def factory():
        c = psycopg2.connect(os.environ["DATABASE_URL"])
        c.autocommit = True
        return c
    return factory


@pytest.fixture
def tenants(conn_factory):
    """Dos tenants sintéticos —A y B— y el barrido de TODO lo que esta prueba escriba, acotado a sus
    `cliente_id`. Son dos porque el aislamiento no se puede afirmar con uno solo: no habría ajeno."""
    a, b = str(uuid.uuid4()), str(uuid.uuid4())
    yield a, b
    conn = conn_factory()
    with conn.cursor() as cur:
        for t in ("copiloto_eventos", "copiloto_cobros", "copiloto_conceptos", "copiloto_gastos",
                  "copiloto_presupuesto_items", "copiloto_presupuestos", "afip_comprobantes"):
            cur.execute(f"DELETE FROM uc_factory.{t} WHERE cliente_id IN (%s, %s)", (a, b))
    conn.close()


def _eventos(conn_factory, cliente_id, *, entidad_tipo=None):
    conn = conn_factory()
    with conn.cursor() as cur:
        sql = (f"SELECT id, entidad_tipo, entidad_id, evento, campo, valor_de, valor_a, datos "
               f"FROM {_EVENTOS} WHERE cliente_id = %s")
        params = [cliente_id]
        if entidad_tipo:
            sql += " AND entidad_tipo = %s"
            params.append(entidad_tipo)
        sql += " ORDER BY id"
        cur.execute(sql, params)
        cols = ("id", "entidad_tipo", "entidad_id", "evento", "campo", "valor_de", "valor_a", "datos")
        filas = [dict(zip(cols, r)) for r in cur.fetchall()]
    conn.close()
    return filas


def _comprobante_directo(conn_factory, cliente_id, total="1000.00", *, nro=1):
    """Un comprobante insertado DIRECTO (sin pasar por el store), para tener su id de fila sin que el
    gancho de `registrar` sume un evento que después habría que descontar en los conteos de cobro."""
    conn = conn_factory()
    with conn.cursor() as cur:
        cur.execute("""INSERT INTO uc_factory.afip_comprobantes
                       (cliente_id, cuit, tipo_cbte, punto_venta, nro, cae, fecha_emision, total,
                        estado, receptor_nombre)
                       VALUES (%s,'30712345678',6,1,%s,'CAE-T',CURRENT_DATE,%s,'emitida','Panadería')
                       RETURNING id""", (cliente_id, nro, total))
        cid = cur.fetchone()[0]
    conn.close()
    return cid


@necesita_pg
def test_cobro_registrar_loggea_una_vez_y_el_replay_no_duplica(conn_factory, tenants):
    a, _ = tenants
    comp_id = _comprobante_directo(conn_factory, a, "1000.00")
    store = CobroStore(conn_factory, a)
    store.registrar(comp_id, monto="400.00", medio="efectivo", idem_key="k1")
    ev = _eventos(conn_factory, a, entidad_tipo="cobro")
    assert len(ev) == 1 and ev[0]["evento"] == "creado"
    assert ev[0]["datos"]["origen"] == "factura"
    assert Decimal(ev[0]["datos"]["monto"]) == Decimal("400.00")
    # Replay con la MISMA idem_key: devuelve el cobro que ya estaba y NO escribe un segundo evento.
    store.registrar(comp_id, monto="400.00", medio="efectivo", idem_key="k1")
    assert len(_eventos(conn_factory, a, entidad_tipo="cobro")) == 1


@necesita_pg
def test_cobro_suelto_y_correccion(conn_factory, tenants):
    a, _ = tenants
    store = CobroStore(conn_factory, a)
    cobro = store.registrar_suelto(monto="85000", medio="efectivo", cliente_nombre="Panadería",
                                   concepto="flete")
    ev = _eventos(conn_factory, a, entidad_tipo="cobro")
    assert len(ev) == 1 and ev[0]["evento"] == "creado" and ev[0]["datos"]["origen"] == "manual"
    # Corregir el monto mal oído deja un evento 'corregido' con el nuevo snapshot: re-derivar del log
    # tiene que dar el valor corregido, no el del alta (§3/§5).
    store.completar(cobro["id"], {"monto": "50000"})
    ev = _eventos(conn_factory, a, entidad_tipo="cobro")
    assert [e["evento"] for e in ev] == ["creado", "corregido"]
    assert Decimal(ev[1]["datos"]["monto"]) == Decimal("50000.00")


@necesita_pg
def test_concepto_precio_de_a_y_volver_al_anterior_es_evento_nuevo(conn_factory, tenants):
    a, _ = tenants
    store = ConceptoStore(conn_factory, a)
    c = store.crear("Tablero", precio_referencia="85000")
    ev = _eventos(conn_factory, a, entidad_tipo="concepto")
    assert len(ev) == 1 and ev[0]["evento"] == "creado"
    assert ev[0]["valor_de"] is None and ev[0]["valor_a"] == "85000.00"
    # Sube.
    store.editar(c["id"], {"precio_referencia": "95000"})
    ev = _eventos(conn_factory, a, entidad_tipo="concepto")
    assert ev[1]["evento"] == "precio_cambiado"
    assert ev[1]["valor_de"] == "85000.00" and ev[1]["valor_a"] == "95000.00"
    # Editar SÓLO el nombre no ensucia la serie de precios.
    store.editar(c["id"], {"nombre": "Tablero eléctrico"})
    assert len(_eventos(conn_factory, a, entidad_tipo="concepto")) == 2
    # Vuelve a $85.000: es un evento NUEVO (id de log distinto), no el mismo par (concepto, precio).
    # Es exactamente lo que la identidad de arista de estado necesita para no resucitar la invalidada.
    store.editar(c["id"], {"precio_referencia": "85000"})
    ev = _eventos(conn_factory, a, entidad_tipo="concepto")
    assert len(ev) == 3 and ev[2]["valor_a"] == "85000.00"
    assert len({e["id"] for e in ev}) == 3


@necesita_pg
def test_gasto_crear_e_imputacion(conn_factory, tenants):
    a, _ = tenants
    gasto = GastoStore(conn_factory, a).crear(monto=Decimal("8500"), categoria="transporte",
                                              proveedor="YPF", medio_pago="efectivo", origen="voz")
    ev = _eventos(conn_factory, a, entidad_tipo="gasto")
    assert len(ev) == 1 and ev[0]["evento"] == "creado"
    assert ev[0]["datos"]["categoria"] == "transporte" and ev[0]["datos"]["proveedor"] == "YPF"
    # Imputar a un presupuesto real y después desimputar → dos eventos de estado de imputación.
    presu = PresupuestoStore(conn_factory, a).crear(
        concepto="Flete", receptor={"nombre": "Panadería"},
        items=[{"descripcion": "flete", "cantidad": 1, "precio_unitario": 5000}])
    trabajo = TrabajoStore(conn_factory, a)
    trabajo.imputar(gasto["id"], "presupuesto", presu["id"])
    trabajo.imputar(gasto["id"], None, None)
    ev = _eventos(conn_factory, a, entidad_tipo="gasto")
    assert [e["evento"] for e in ev] == ["creado", "imputado", "desimputado"]
    assert ev[1]["valor_a"]["eslabon"] == "presupuesto" and ev[1]["valor_a"]["ref"] == presu["id"]
    assert ev[2]["valor_a"] is None


@necesita_pg
def test_presupuesto_crear_y_estado_idempotente(conn_factory, tenants):
    a, _ = tenants
    store = PresupuestoStore(conn_factory, a)
    p = store.crear(concepto="Instalación", receptor={"nombre": "Panadería"},
                    items=[{"descripcion": "tablero", "cantidad": 1, "precio_unitario": 85000}])
    ev = _eventos(conn_factory, a, entidad_tipo="presupuesto")
    assert len(ev) == 1 and ev[0]["evento"] == "creado" and ev[0]["valor_a"] == PENDIENTE
    assert ev[0]["datos"]["items"][0]["descripcion"] == "tablero"
    store.cambiar_estado(p["id"], APROBADO)
    ev = _eventos(conn_factory, a, entidad_tipo="presupuesto")
    assert len(ev) == 2 and ev[1]["evento"] == "estado_cambiado"
    assert ev[1]["valor_de"] == PENDIENTE and ev[1]["valor_a"] == APROBADO
    # Re-marcar el MISMO estado es idempotente (no es un cambio) y NO agrega evento.
    store.cambiar_estado(p["id"], APROBADO)
    assert len(_eventos(conn_factory, a, entidad_tipo="presupuesto")) == 2


@necesita_pg
def test_afip_emitir_dedup_por_upsert_y_anular(conn_factory, tenants):
    a, _ = tenants
    store = AfipComprobanteStore(conn_factory, a)
    kw = dict(cuit="30712345678", tipo_cbte=6, punto_venta=1, nro=7, cae="CAE-1", cae_vto=None,
              fecha_emision=None, doc_tipo=80, doc_nro="30712345678", total=Decimal("1000"),
              receptor_nombre="Panadería")
    store.registrar(**kw)
    ev = _eventos(conn_factory, a, entidad_tipo="comprobante")
    assert len(ev) == 1 and ev[0]["evento"] == "emitido" and ev[0]["valor_a"] == "emitida"
    assert ev[0]["entidad_id"] == "30712345678|6|1|7"
    # Retry del MISMO registrar: el upsert toma el camino ON CONFLICT (xmax != 0) y NO re-loggea.
    store.registrar(**kw)
    assert len(_eventos(conn_factory, a, entidad_tipo="comprobante")) == 1
    # Anular: estado_cambiado emitida→anulada. El 'emitido' sobrevive — anular NO borra que se emitió.
    store.marcar_anulada(cuit="30712345678", tipo_cbte=6, punto_venta=1, nro=7, nro_nota_credito=8)
    ev = _eventos(conn_factory, a, entidad_tipo="comprobante")
    assert [e["evento"] for e in ev] == ["emitido", "estado_cambiado"]
    assert ev[1]["valor_de"] == ESTADO_EMITIDA and ev[1]["valor_a"] == ESTADO_ANULADA
    # Retry de la anulación (estado previo ya 'anulada') → NO re-loggea.
    store.marcar_anulada(cuit="30712345678", tipo_cbte=6, punto_venta=1, nro=7, nro_nota_credito=8)
    assert len(_eventos(conn_factory, a, entidad_tipo="comprobante")) == 2


@necesita_pg
def test_aislamiento_cross_tenant_y_pares_de_ontologia(conn_factory, tenants):
    a, b = tenants
    GastoStore(conn_factory, a).crear(monto=Decimal("100"), categoria="otros")
    GastoStore(conn_factory, b).crear(monto=Decimal("200"), categoria="otros")
    ev_a = _eventos(conn_factory, a)
    ev_b = _eventos(conn_factory, b)
    # Cada uno ve UN evento, el suyo: si el gancho escribiera con el cliente_id equivocado, A vería el
    # de B (dos) o el monto de B. El filtro por cliente_id es la barrera efectiva (el rol owner
    # bypassa RLS), igual que en el resto de los stores — y acá se ejercita el caso hostil.
    assert len(ev_a) == 1 and ev_a[0]["datos"]["monto"] == "100.00"
    assert len(ev_b) == 1 and ev_b[0]["datos"]["monto"] == "200.00"
    assert {e["id"] for e in ev_a}.isdisjoint({e["id"] for e in ev_b})
    # Todo par (entidad_tipo, evento) escrito está en el contrato de la ontología — sin sorpresas.
    pares = {(e["entidad_tipo"], e["evento"]) for e in ev_a + ev_b}
    assert pares <= PARES_ESPERADOS
