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
        for t in ("copiloto_eventos", "copiloto_cobros", "copiloto_gastos",
                  "copiloto_presupuesto_items", "copiloto_presupuestos", "afip_comprobantes"):
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


# ── INGRESOS: la función propia (addendum del escritorio) ────────────────────────────────────────

@necesita_pg
def test_un_ingreso_SOLO_CON_MONTO_se_guarda__y_dice_que_falto(conn_factory, tenants):
    """La especificación textual del operador: *«igual que si se lo dictara a la secretaria»*.

    A una secretaria le decís «me pagaron 85 mil» y lo anota. No te pide la fecha, ni el medio, ni el
    número de comprobante. Lo que sí hace es avisarte después de qué le falta — por eso `falta` sale
    calculado del backend y no de la app: el aviso y el dato tienen que salir del mismo lugar o van a
    divergir.
    """
    a, _ = tenants
    ingreso = CobroStore(conn_factory, a).registrar_suelto(monto="85000")

    assert ingreso["monto"] == "85000.00"
    assert ingreso["fecha"] is not None                  # hoy, sin que nadie lo pida
    assert set(ingreso["falta"]) == {"cliente", "medio", "concepto"}


@necesita_pg
def test_contestar_el_aviso_completa_el_MISMO_ingreso__no_crea_otro(conn_factory, tenants):
    """DoD del addendum. Si contestar creara un registro nuevo, el aviso duplicaría la caja — que es
    exactamente el daño que la función viene a evitar."""
    a, _ = tenants
    store = CobroStore(conn_factory, a)
    ingreso = store.registrar_suelto(monto="85000")

    completo = store.completar(ingreso["id"], {"cliente_nombre": "Panadería", "medio": "efectivo"})

    assert completo["id"] == ingreso["id"]
    assert completo["falta"] == ["concepto"]             # lo que sigue faltando, y nada más
    assert len(store.listar_ingresos()["ingresos"]) == 1


@necesita_pg
def test_el_duplicado_probable_se_DETECTA__y_no_bloquea(conn_factory, tenants):
    """Un dato faltante se ve; un ingreso de más **no se ve nunca**. Por eso éste se pregunta antes.

    Pero avisa y no prohíbe: dos cobros iguales del mismo cliente en la misma semana son un caso real,
    y el emprendedor sabe mejor que el sistema cuál de los dos es.
    """
    a, _ = tenants
    store = CobroStore(conn_factory, a)
    store.registrar_suelto(monto="85000", cliente_nombre="Panadería", medio="mercadopago")

    candidato = store.posible_duplicado(monto="85000", cliente_nombre="panadería")
    assert candidato is not None and candidato["monto"] == "85000.00"

    # CONTROL: un monto distinto NO dispara la alarma — si saltara con todo, sería ruido y la app
    # aprendería a ignorarlo, que es la peor forma de perder una advertencia.
    assert store.posible_duplicado(monto="12000", cliente_nombre="Panadería") is None

    # y el segundo cobro entra igual: el store nunca bloqueó, la decisión es del endpoint
    store.registrar_suelto(monto="85000", cliente_nombre="Panadería", medio="efectivo")
    assert len(store.listar_ingresos()["ingresos"]) == 2


@necesita_pg
def test_los_de_mercadopago_y_los_dictados_conviven_pero_se_DISTINGUEN(conn_factory, tenants):
    """Si se mezclaran sin marca, en tres meses nadie sabría qué dato es duro y cuál es de memoria."""
    a, _ = tenants
    presupuesto, comprobante = _trabajo_completo(conn_factory, a, nro=810)
    store = CobroStore(conn_factory, a)
    store.registrar(comprobante, monto="100000.00")      # el de la factura
    store.registrar_suelto(monto="85000", medio="efectivo")

    ingresos = store.listar_ingresos()

    assert ingresos["total"] == "185000.00"

    # 🔴 Este assert nació MAL y lo dejo anotado porque es la lección: escribí
    # `origenes == {"manual"}` y pasó — o sea que **afirmé como correcto que los dos ingresos fueran
    # indistinguibles**, que es exactamente lo contrario de lo que el addendum pide. El test estaba
    # verde y tapaba el bug: `registrar()` insertaba sin `origen` y tomaba el DEFAULT.
    origenes = {i["origen"] for i in ingresos["ingresos"]}
    assert origenes == {"factura", "manual"}, "el cobro de una factura NO se distingue del dictado"

    # y sólo el dictado se puede borrar: borrar acá el rastro de un cobro que salió de una factura
    # sería inventar que esa factura no se cobró
    assert [i["borrable"] for i in ingresos["ingresos"]].count(True) == 1
    # el de la factura trae su número: la pantalla puede decir «Factura B 810» sin otra consulta
    assert any(i["comprobante_nro"] == 810 for i in ingresos["ingresos"])


@necesita_pg
def test_ADVERSARIAL_A_no_ve_ni_borra_los_ingresos_de_B(conn_factory, tenants):
    a, b = tenants
    de_b = CobroStore(conn_factory, b).registrar_suelto(monto="99000", cliente_nombre="Kiosco")
    de_a = CobroStore(conn_factory, a)

    assert de_a.listar_ingresos()["ingresos"] == []
    assert de_a.borrar_ingreso(de_b["id"]) is False
    assert de_a.completar(de_b["id"], {"medio": "hackeado"}) is None
    # CONTROL: B sigue intacto — el intento de A no pudo ni siquiera ensuciarlo
    assert CobroStore(conn_factory, b).listar_ingresos()["ingresos"][0]["medio"] == ""


@necesita_pg
def test_corregir_el_monto_de_un_ingreso_RECALCULA_el_margen(conn_factory, tenants):
    """🔴 El riesgo que PLANIFICACION nombro al habilitar la edicion del monto (2026-07-22 §3).

    Editar el monto de un ingreso imputado a un trabajo **cambia el margen de ese trabajo**, y eso es
    correcto: el margen debe reflejar la plata real. Lo que no puede pasar es que quede **cacheado**
    — un ingreso corregido dejando un margen viejo que nadie va a sospechar, porque un numero
    coherente y falso no protesta. Es la misma familia que la caja que contaba solo MercadoPago.

    Hoy `margen()` lo **deriva** (`SELECT sum(monto)` en vivo, y no hay ninguna columna `margen` en el
    manifiesto). Este test lo fija: si alguien lo cachea para acelerar una pantalla, se pone rojo.
    """
    a, _ = tenants
    presupuesto, comprobante = _trabajo_completo(conn_factory, a)
    cobros = CobroStore(conn_factory, a)
    gastos = GastoStore(conn_factory, a)
    trabajos = TrabajoStore(conn_factory, a)

    cobro, _resumen = cobros.registrar(comprobante, monto="100000.00")
    g = gastos.crear(monto="30000", categoria="mercaderia")
    trabajos.imputar(g["id"], "comprobante", comprobante)

    antes = trabajos.margen("comprobante", comprobante)
    assert antes["margen"] == "70000.00", "control: el escenario no da lo esperado, el test no probaria nada"

    cobros.completar(cobro["id"], {"monto": "60000"})

    despues = trabajos.margen("comprobante", comprobante)
    assert despues["cobrado"] == "60000.00", "el cobrado no siguio al monto corregido"
    assert despues["margen"] == "30000.00", "el margen quedo viejo: se esta cacheando en algun lado"
