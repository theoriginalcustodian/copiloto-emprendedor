"""Addendum del hito 3 — IMPUTAR GASTOS AL TRABAJO y el margen, contra Postgres real.

Lo que se prueba acá no es "se guarda la referencia": es que **el mismo gasto no se cuente dos veces**
y que **el margen dé igual mires por donde mires la cadena**. Las dos son propiedades del cálculo, no
del guardado, y ninguna se ve en un fake.
"""
from __future__ import annotations

import os
import uuid
from decimal import Decimal

import pytest

from cobro_store import CobroStore
from gasto_store import GastoStore
from presupuesto_store import PresupuestoStore
from trabajo_store import TrabajoInexistente, TrabajoStore

necesita_pg = pytest.mark.skipif(not os.environ.get("DATABASE_URL"),
                                 reason="requiere Postgres del VPS (DATABASE_URL)")


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
    a, b = str(uuid.uuid4()), str(uuid.uuid4())
    yield a, b
    conn = conn_factory()
    with conn.cursor() as cur:
        for t in ("copiloto_cobros", "copiloto_gastos", "copiloto_presupuesto_items",
                  "copiloto_presupuestos", "afip_comprobantes"):
            cur.execute(f"DELETE FROM uc_factory.{t} WHERE cliente_id IN (%s, %s)", (a, b))
    conn.close()


def _trabajo_completo(conn_factory, cid, *, nro=800):
    """Un trabajo con la cadena ENTERA: presupuesto → factura → (listo para cobrar).

    El enlace se arma como en producción (`factura_id` en el presupuesto + `workflow_id` en el
    comprobante), no seteando a mano un id "equivalente": si el formato del `workflow_id` cambiara,
    este test tiene que romperse.
    """
    presupuestos = PresupuestoStore(conn_factory, cid)
    p = presupuestos.crear(concepto="Pintura", receptor={"nombre": "Panadería Los Tilos"},
                           items=[{"descripcion": "Living", "cantidad": Decimal(1),
                                   "precio_unitario": Decimal("100000"), "codigo": ""}])
    factura_id = f"presu-{p['id']}"
    presupuestos.marcar_factura(p["id"], factura_id)
    conn = conn_factory()
    with conn.cursor() as cur:
        cur.execute("""INSERT INTO uc_factory.afip_comprobantes
                       (cliente_id, cuit, tipo_cbte, punto_venta, nro, cae, fecha_emision, total,
                        estado, receptor_nombre, workflow_id)
                       VALUES (%s,'30712345678',6,1,%s,'CAE-T',CURRENT_DATE,'100000.00','emitida',
                               'Panadería', %s) RETURNING id""",
                    (cid, nro, f"factura-{cid}-{factura_id}"))
        comprobante = cur.fetchone()[0]
    return p["id"], comprobante


@necesita_pg
def test_la_cadena_se_resuelve_desde_CUALQUIER_eslabon(conn_factory, tenants):
    """Presupuesto ↔ factura: preguntar por uno tiene que traer al otro.

    Es la pieza que hace que imputar a la factura y preguntar por el presupuesto den lo mismo. Sin
    esto, el gasto quedaría en un trabajo distinto **según por dónde se mire**, y los dos márgenes se
    verían plausibles.
    """
    a, _ = tenants
    presupuesto, comprobante = _trabajo_completo(conn_factory, a)
    store = TrabajoStore(conn_factory, a)

    desde_arriba = store.resolver("presupuesto", presupuesto)
    desde_abajo = store.resolver("comprobante", comprobante)

    assert desde_arriba["comprobante"] == comprobante
    assert desde_abajo["presupuesto"] == presupuesto


@necesita_pg
def test_el_margen_da_IGUAL_imputando_al_presupuesto_o_a_la_factura(conn_factory, tenants):
    """🔴 El corazón del addendum: da igual a qué eslabón imputó el emprendedor.

    Y el gasto se cuenta **una sola vez**: si el cálculo sumara por cada eslabón que coincide, un
    trabajo con presupuesto Y factura contaría doble — y el margen quedaría peor de lo real, que es la
    dirección que hace que el emprendedor deje de tomar un trabajo que sí le convenía.
    """
    a, _ = tenants
    presupuesto, comprobante = _trabajo_completo(conn_factory, a)
    gastos = GastoStore(conn_factory, a)
    trabajos = TrabajoStore(conn_factory, a)
    CobroStore(conn_factory, a).registrar(comprobante, monto="100000.00")

    g1 = gastos.crear(monto="30000", categoria="mercaderia")
    g2 = gastos.crear(monto="10000", categoria="transporte")
    trabajos.imputar(g1["id"], "presupuesto", presupuesto)   # uno al presupuesto…
    trabajos.imputar(g2["id"], "comprobante", comprobante)   # …y el otro a la factura

    por_presupuesto = trabajos.margen("presupuesto", presupuesto)
    por_factura = trabajos.margen("comprobante", comprobante)

    assert por_presupuesto["margen"] == por_factura["margen"] == "60000.00"
    assert por_presupuesto["gastos_imputados"] == por_factura["gastos_imputados"] == 2
    assert por_presupuesto["cobrado"] == "100000.00"


@necesita_pg
def test_el_conteo_de_gastos_imputados_viaja_SIEMPRE__aunque_sea_cero(conn_factory, tenants):
    """Un margen incompleto se ve igual que uno bueno.

    Sin el conteo, un trabajo con 0 gastos imputados muestra margen 100% y parece una gran noticia.
    Por eso el campo va aunque valga 0: es lo único con lo que la pantalla puede avisar.
    """
    a, _ = tenants
    presupuesto, comprobante = _trabajo_completo(conn_factory, a, nro=801)
    CobroStore(conn_factory, a).registrar(comprobante, monto="100000.00")

    resultado = TrabajoStore(conn_factory, a).margen("presupuesto", presupuesto)

    assert resultado["gastos_imputados"] == 0
    assert resultado["margen"] == "100000.00"      # ← plausible y engañoso: por eso va el conteo


@necesita_pg
def test_no_se_puede_imputar_a_DOS_eslabones_a_la_vez(conn_factory, tenants):
    """El check vive en la TABLA, no en el endpoint.

    Un chequeo sólo en Python dejaría entrar cualquier otra vía —la tool del copiloto, un backfill,
    una corrección a mano— y el síntoma no sería un error: sería **el mismo gasto contado dos veces**
    en el margen, que se ve exactamente igual que un margen malo.
    """
    a, _ = tenants
    presupuesto, comprobante = _trabajo_completo(conn_factory, a, nro=802)
    gasto = GastoStore(conn_factory, a).crear(monto="5000", categoria="otros")

    conn = conn_factory()
    with pytest.raises(Exception) as exc:      # el motor, no la app
        with conn.cursor() as cur:
            cur.execute("UPDATE uc_factory.copiloto_gastos "
                        "SET presupuesto_ref=%s, comprobante_ref=%s WHERE cliente_id=%s AND id=%s",
                        (presupuesto, comprobante, a, gasto["id"]))
    assert getattr(exc.value, "pgcode", None) == "23514"     # check_violation


@necesita_pg
def test_reimputar_LIMPIA_la_referencia_anterior(conn_factory, tenants):
    """Mover un gasto de un trabajo a otro no puede dejar puesta la referencia vieja: el check lo
    atraparía, pero fallar es peor que no ensuciar."""
    a, _ = tenants
    presupuesto, comprobante = _trabajo_completo(conn_factory, a, nro=803)
    gastos, trabajos = GastoStore(conn_factory, a), TrabajoStore(conn_factory, a)
    g = gastos.crear(monto="7000", categoria="otros")

    trabajos.imputar(g["id"], "presupuesto", presupuesto)
    despues = trabajos.imputar(g["id"], "comprobante", comprobante)

    assert despues["presupuesto_ref"] is None and despues["comprobante_ref"] == comprobante
    assert trabajos.imputar(g["id"], None, None)["comprobante_ref"] is None      # desimputar


@necesita_pg
def test_un_gasto_SIN_imputar_entra_a_la_caja_igual(conn_factory, tenants):
    """Lo que no se negocia del addendum §3: imputar nunca es obligatorio.

    Si lo fuera, el emprendedor dejaría de cargar gastos — y perderíamos el dato bueno por exigir el
    perfecto.
    """
    a, _ = tenants
    gastos = GastoStore(conn_factory, a)
    g = gastos.crear(monto="9000", categoria="otros")
    assert gastos.detalle(g["id"]) is not None
    assert g["monto"] == "9000.00"


@necesita_pg
def test_el_cobro_DICTADO_existe_sin_factura__y_se_distingue_del_de_mercadopago(conn_factory, tenants):
    """Sin esto la caja miente: el efectivo no dejaba rastro de ninguna clase."""
    a, _ = tenants
    presupuesto, _ = _trabajo_completo(conn_factory, a, nro=804)
    store = CobroStore(conn_factory, a)

    suelto = store.registrar_suelto(monto="85000", medio="efectivo", presupuesto_ref=presupuesto)

    assert suelto["comprobante_id"] is None
    assert suelto["origen"] == "manual"
    # y entra al margen del trabajo aunque nunca se haya facturado
    assert TrabajoStore(conn_factory, a).margen("presupuesto", presupuesto)["cobrado"] == "85000.00"


@necesita_pg
def test_ADVERSARIAL_A_no_imputa_un_gasto_a_un_trabajo_de_B(conn_factory, tenants):
    """Regla dura: el control se ejercita con el caso hostil, no con el happy-path."""
    a, b = tenants
    presupuesto_de_b, _ = _trabajo_completo(conn_factory, b, nro=805)
    gasto_de_a = GastoStore(conn_factory, a).crear(monto="1000", categoria="otros")
    trabajos_de_a = TrabajoStore(conn_factory, a)

    with pytest.raises(TrabajoInexistente):
        trabajos_de_a.imputar(gasto_de_a["id"], "presupuesto", presupuesto_de_b)
    with pytest.raises(TrabajoInexistente):
        trabajos_de_a.margen("presupuesto", presupuesto_de_b)

    # CONTROL: si A tampoco pudiera con lo SUYO, lo roto sería el test y no habría guard que probar
    propio, _ = _trabajo_completo(conn_factory, a, nro=806)
    assert trabajos_de_a.imputar(gasto_de_a["id"], "presupuesto", propio)["presupuesto_ref"] == propio
