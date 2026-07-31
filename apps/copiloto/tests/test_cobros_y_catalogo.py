"""Hito 3 — COBROS, ESTADO DE PRESUPUESTO y CATÁLOGO, contra Postgres real.

**Contra la base y no contra fakes, a propósito.** Lo que este hito promete —idempotencia por índice
único, aislamiento por tenant, que el precio de referencia no toque presupuestos emitidos— **vive en
el motor**. Un fake que devuelve lo que le pedimos confirmaría las tres cosas sin que ninguna sea
cierta: es exactamente el instrumento que da verde porque no puede dar rojo.

Lo puro (`estado_de_cobro`, las transiciones) sí se prueba sin base: son funciones, y ahí el fake no
tiene nada que falsear.
"""
from __future__ import annotations

import os
import uuid
from decimal import Decimal

import pytest

from cobro_store import COBRADA, IMPAGA, PARCIAL, CobroInvalido, CobroStore, estado_de_cobro
from concepto_store import ConceptoDuplicado, ConceptoInvalido, ConceptoStore
from presupuesto_store import (APROBADO, DESESTIMADO, PENDIENTE, TRANSICIONES, PresupuestoStore,
                               TransicionInvalida)

necesita_pg = pytest.mark.skipif(not os.environ.get("DATABASE_URL"),
                                 reason="requiere Postgres del VPS (DATABASE_URL)")


# ── lo puro: sin base, sin fakes que puedan mentir ───────────────────────────────────────────────

@pytest.mark.parametrize("total, cobrado, esperado", [
    ("1000.00", "0",       IMPAGA),
    ("1000.00", "400.00",  PARCIAL),
    ("1000.00", "1000.00", COBRADA),
    ("1000.00", "1200.00", COBRADA),   # pagó de más (propina, redondeo): sigue cobrada, no "parcial"
    ("0.00",    "0",       IMPAGA),
])
def test_estado_de_cobro(total, cobrado, esperado):
    assert estado_de_cobro(total, cobrado) == esperado


def test_de_desestimado_no_se_vuelve_y_a_pendiente_no_se_llega_nunca():
    """Las dos transiciones prohibidas del contrato §2.2, afirmadas donde se leen.

    `desestimado → aprobado` revivría un precio y un alcance viejos con un "sí" nuevo encima.
    `→ pendiente` **borra información** que alguien declaró: volver a "no sé" no es corregir.
    """
    assert APROBADO not in TRANSICIONES[DESESTIMADO]
    assert all(PENDIENTE not in destinos for destinos in TRANSICIONES.values())
    assert set(TRANSICIONES[PENDIENTE]) == {APROBADO, DESESTIMADO}


# ── contra la base ───────────────────────────────────────────────────────────────────────────────

@pytest.fixture
def tenants(conn_de_tenant):
    """Dos tenants sintéticos —A y B— y el barrido de todo lo que esta prueba escriba.

    Son DOS porque el test adversarial necesita un ajeno real. Con uno solo, "no ve lo del otro" no
    se puede afirmar: no habría otro.
    """
    a, b = str(uuid.uuid4()), str(uuid.uuid4())
    yield a, b
    for cid in (a, b):
        conn = conn_de_tenant(cid)()
        with conn.cursor() as cur:
            for t in ("copiloto_eventos", "copiloto_cobros", "copiloto_conceptos",
                      "copiloto_presupuesto_items", "copiloto_presupuestos", "afip_comprobantes"):
                cur.execute(f"DELETE FROM uc_factory.{t} WHERE cliente_id=%s", (cid,))
        conn.close()


def _comprobante(conn_de_tenant, cliente_id: str, total: str, *, nro: int = 1, estado="emitida"):
    conn = conn_de_tenant(cliente_id)()
    with conn.cursor() as cur:
        cur.execute("""INSERT INTO uc_factory.afip_comprobantes
                       (cliente_id, cuit, tipo_cbte, punto_venta, nro, cae, fecha_emision, total,
                        estado, receptor_nombre)
                       VALUES (%s, '30712345678', 6, 1, %s, 'CAE-TEST', CURRENT_DATE, %s, %s, 'Panadería')
                       RETURNING id""", (cliente_id, nro, total, estado))
        return cur.fetchone()[0]


@necesita_pg
def test_marcar_cobrada_DOS_VECES_deja_UN_cobro(conn_de_tenant, tenants):
    """El DoD del contrato, medido **sobre el efecto en la base** — no sobre lo que responde el store.

    Un endpoint puede contestar 201 dos veces y haber creado dos filas: la respuesta no es la prueba.
    """
    a, _ = tenants
    comp = _comprobante(conn_de_tenant, a, "1000.00")
    store = CobroStore(conn_de_tenant(a), a)
    clave = str(uuid.uuid4())

    primero, r1 = store.registrar(comp, monto="1000.00", idem_key=clave)
    segundo, r2 = store.registrar(comp, monto="1000.00", idem_key=clave)

    conn = conn_de_tenant(a)()
    with conn.cursor() as cur:
        cur.execute("SELECT count(*) FROM uc_factory.copiloto_cobros "
                    "WHERE cliente_id=%s AND comprobante_id=%s", (a, comp))
        filas = cur.fetchone()[0]
    assert filas == 1, "dos requests con la misma idem_key dejaron dos cobros"
    assert primero["id"] == segundo["id"]
    assert r2["estado_cobro"] == COBRADA and r2["saldo"] == "0.00"


@necesita_pg
def test_dos_requests_SIMULTANEAS_con_la_misma_clave_dejan_UN_cobro(conn_de_tenant, tenants):
    """🔴 La carrera de verdad — el caso que el test de arriba **no** prueba.

    Con las dos llamadas en secuencia, el atajo por `idem_key` alcanza y el índice único nunca se
    ejercita: el test pasaría igual con el índice borrado. O sea que "es idempotente" quedaría
    afirmado sin evidencia justo para el escenario donde el `if` falla — dos toques simultáneos, dos
    dispositivos — que es el que costó dos CAE en facturación.

    Acá las dos entran a la vez desde hilos distintos con conexiones distintas: ninguna ve a la otra
    en su `SELECT`, y lo único que puede impedir la segunda fila es el motor.
    """
    import threading

    a, _ = tenants
    comp = _comprobante(conn_de_tenant, a, "1000.00", nro=5)
    clave = str(uuid.uuid4())
    listos, resultados = threading.Barrier(2), []

    def cobrar():
        listos.wait()                        # las dos arrancan juntas, no una después de la otra
        try:
            resultados.append(CobroStore(conn_de_tenant(a), a).registrar(
                comp, monto="1000.00", idem_key=clave))
        except Exception as exc:             # noqa: BLE001 — se inspecciona abajo
            resultados.append(exc)

    hilos = [threading.Thread(target=cobrar) for _ in range(2)]
    for h in hilos:
        h.start()
    for h in hilos:
        h.join()

    conn = conn_de_tenant(a)()
    with conn.cursor() as cur:
        cur.execute("SELECT count(*) FROM uc_factory.copiloto_cobros "
                    "WHERE cliente_id=%s AND comprobante_id=%s", (a, comp))
        filas = cur.fetchone()[0]
    assert filas == 1, f"la carrera dejó {filas} cobros: el índice único no está cerrando la ventana"
    assert not any(isinstance(r, Exception) for r in resultados), \
        f"una de las dos requests explotó en vez de devolver el cobro existente: {resultados}"


@necesita_pg
def test_CONTROL_sin_idem_key_los_dos_cobros_entran_y_es_correcto(conn_de_tenant, tenants):
    """El control que le da sentido al test de arriba.

    Si sin clave también dedupara, el test anterior pasaría aunque la idempotencia no existiera —
    bastaría con que el store rechazara todo segundo cobro. Y además sería un bug: **dos cobros
    parciales del mismo monto son un caso real**.
    """
    a, _ = tenants
    comp = _comprobante(conn_de_tenant, a, "1000.00", nro=2)
    store = CobroStore(conn_de_tenant(a), a)

    store.registrar(comp, monto="400.00")
    _, resumen = store.registrar(comp, monto="400.00")

    assert resumen["cobrado"] == "800.00"
    assert resumen["estado_cobro"] == PARCIAL


@necesita_pg
def test_no_se_puede_cobrar_mas_que_el_saldo(conn_de_tenant, tenants):
    a, _ = tenants
    comp = _comprobante(conn_de_tenant, a, "500.00", nro=3)
    store = CobroStore(conn_de_tenant(a), a)
    store.registrar(comp, monto="300.00")
    with pytest.raises(CobroInvalido):
        store.registrar(comp, monto="300.00")


@necesita_pg
def test_impagos_trae_el_saldo_y_el_total__y_la_anulada_queda_afuera(conn_de_tenant, tenants):
    """Una factura anulada NO es una deuda. Si entrara, «me deben» mostraría plata que nadie va a
    pagar nunca — y ese número mal una vez quema la pantalla para siempre."""
    a, _ = tenants
    viva = _comprobante(conn_de_tenant, a, "1000.00", nro=10)
    _comprobante(conn_de_tenant, a, "9999.00", nro=11, estado="anulada")
    CobroStore(conn_de_tenant(a), a).registrar(viva, monto="250.00")

    salida = CobroStore(conn_de_tenant(a), a).impagos()

    assert [c["id"] for c in salida["comprobantes"]] == [viva]
    assert salida["total_adeudado"] == "750.00"


@necesita_pg
def test_ADVERSARIAL_A_no_puede_cobrar_ni_ver_lo_de_B(conn_de_tenant, tenants):
    """Regla dura del repo: un control de acceso **sin test adversarial es un control no verificado**.

    El happy-path ("cada uno ve lo suyo") pasa igual si el aislamiento no existe. Sólo el caso hostil
    —A pidiendo explícitamente el recurso de B— distingue un guard real de uno ausente.

    Ahora hay DOS barreras y el test las cruza las dos: el filtro `cliente_id` explícito del store, y
    el RLS de la base — la conexión de A nace declarando A, así que la fila de B le es invisible
    incluso si la query se olvidara del WHERE.
    """
    a, b = tenants
    de_b = _comprobante(conn_de_tenant, b, "1000.00", nro=20)
    CobroStore(conn_de_tenant(b), b).registrar(de_b, monto="1000.00")
    ConceptoStore(conn_de_tenant(b), b).crear("Pintura de living", "50000")

    de_a = CobroStore(conn_de_tenant(a), a)
    cobro, resumen = de_a.registrar(de_b, monto="100.00")
    assert cobro is None and resumen is None, "A pudo registrar un cobro sobre la factura de B"
    assert de_a.resumen(de_b) is None
    assert de_a.impagos()["comprobantes"] == []
    assert ConceptoStore(conn_de_tenant(a), a).listar() == []

    # y el de B sigue intacto: el intento de A no pudo ni siquiera ensuciarlo
    assert CobroStore(conn_de_tenant(b), b).resumen(de_b)["estado_cobro"] == COBRADA


# ── catálogo ─────────────────────────────────────────────────────────────────────────────────────

@necesita_pg
def test_el_catalogo_dedupa_por_nombre_normalizado(conn_de_tenant, tenants):
    """`"Pintura de Living"` y `"pintura  de living."` son el mismo concepto.

    Si entraran los dos, la serie de precios del grafo quedaría partida — que es exactamente el
    problema que el catálogo viene a resolver.
    """
    a, _ = tenants
    store = ConceptoStore(conn_de_tenant(a), a)
    creado = store.crear("Pintura de Living", "50000")
    with pytest.raises(ConceptoDuplicado) as exc:
        store.crear("pintura  de living.", "60000")
    assert exc.value.existente["id"] == creado["id"]   # el 409 trae con qué chocaste


@necesita_pg
def test_desactivar_no_borra__y_el_nombre_sigue_ocupado(conn_de_tenant, tenants):
    """Desactivar y recrear el mismo nombre **reactiva el existente**, no crea un gemelo: si no
    chocara, la historia de precios de ese concepto quedaría partida en dos filas."""
    a, _ = tenants
    store = ConceptoStore(conn_de_tenant(a), a)
    creado = store.crear("Instalación eléctrica", "80000")
    store.desactivar(creado["id"])

    assert store.listar() == []
    assert [c["id"] for c in store.listar(incluir_inactivos=True)] == [creado["id"]]
    with pytest.raises(ConceptoDuplicado):
        store.crear("Instalación eléctrica")


@necesita_pg
def test_editar_el_nombre_NO_borra_el_precio(conn_de_tenant, tenants):
    """Edición parcial de verdad: la clave ausente no se toca.

    Si el store armara el UPDATE con todas las columnas, guardar el nombre pondría el precio en NULL
    — el bug clásico de "guardé una cosa y se borró otra", que además nadie mira hasta que factura.
    """
    a, _ = tenants
    store = ConceptoStore(conn_de_tenant(a), a)
    creado = store.crear("Chapa y pintura", "120000")
    editado = store.editar(creado["id"], {"nombre": "Chapa y pintura completa"})
    assert editado["precio_referencia"] == "120000.00"

    borrado = store.editar(creado["id"], {"precio_referencia": None})   # el null EXPLÍCITO sí borra
    assert borrado["precio_referencia"] is None


@necesita_pg
def test_cambiar_el_precio_de_referencia_NO_altera_un_presupuesto_ya_emitido(conn_de_tenant, tenants):
    """El DoD del contrato §5, y la razón por la que el hito 5 puede apoyarse en la historia.

    Si el presupuesto tomara el precio del catálogo al leerse en vez de congelarlo al emitirse,
    cambiar una tarifa **reescribiría el pasado** — y la serie de precios del grafo mostraría que
    siempre se cobró lo de hoy.
    """
    a, _ = tenants
    conceptos = ConceptoStore(conn_de_tenant(a), a)
    concepto = conceptos.crear("Pintura de living", "50000")

    presupuestos = PresupuestoStore(conn_de_tenant(a), a)
    presupuesto = presupuestos.crear(
        concepto="Pintura", receptor={"nombre": "Panadería Los Tilos"},
        items=[{"descripcion": "Pintura de living", "cantidad": Decimal(1),
                "precio_unitario": Decimal("50000"), "codigo": ""}])
    total_antes = presupuestos.detalle(presupuesto["id"])["total"]

    conceptos.editar(concepto["id"], {"precio_referencia": "99999"})

    despues = presupuestos.detalle(presupuesto["id"])
    assert despues["total"] == total_antes
    assert despues["items"][0]["precio_unitario"] == "50000.00"


# ── estado del presupuesto ───────────────────────────────────────────────────────────────────────

@necesita_pg
def test_las_tres_categorias_no_se_mezclan(conn_de_tenant, tenants):
    """Ganado / perdido / **no sé**. Un presupuesto nuevo nace en "no sé", no en "perdido"."""
    a, _ = tenants
    store = PresupuestoStore(conn_de_tenant(a), a)
    p = store.crear(concepto="Techo", receptor={"nombre": "Kiosco La Esquina"},
                    items=[{"descripcion": "Membrana", "cantidad": Decimal(1),
                            "precio_unitario": Decimal("30000"), "codigo": ""}])
    assert store.detalle(p["id"])["estado"] == PENDIENTE
    assert store.detalle(p["id"])["sin_respuesta"] is False   # recién emitido: todavía no es tarde

    assert store.cambiar_estado(p["id"], DESESTIMADO)["estado"] == DESESTIMADO
    with pytest.raises(TransicionInvalida):
        store.cambiar_estado(p["id"], APROBADO)


@necesita_pg
def test_remarcar_el_mismo_estado_no_es_un_conflicto(conn_de_tenant, tenants):
    """Repetir la misma orden no es un error: la app tiene que poder reintentar si se cortó la red."""
    a, _ = tenants
    store = PresupuestoStore(conn_de_tenant(a), a)
    p = store.crear(concepto="Vereda", receptor={"nombre": "Taller Don José"},
                    items=[{"descripcion": "Cemento", "cantidad": Decimal(2),
                            "precio_unitario": Decimal("15000"), "codigo": ""}])
    store.cambiar_estado(p["id"], APROBADO)
    assert store.cambiar_estado(p["id"], APROBADO)["estado"] == APROBADO


@necesita_pg
def test_sin_respuesta_se_DERIVA_del_tiempo__no_se_guarda(conn_de_tenant, tenants):
    """Se envejece la fila en la base, no un flag: si `sin_respuesta` estuviera guardado, mover la
    fecha no lo cambiaría — y ahí se vería que hace falta un cron para mantenerlo al día."""
    a, _ = tenants
    store = PresupuestoStore(conn_de_tenant(a), a)
    p = store.crear(concepto="Portón", receptor={"nombre": "Corralón Norte"},
                    items=[{"descripcion": "Chapa", "cantidad": Decimal(1),
                            "precio_unitario": Decimal("90000"), "codigo": ""}])
    conn = conn_de_tenant(a)()
    with conn.cursor() as cur:
        cur.execute("UPDATE uc_factory.copiloto_presupuestos SET fecha = now() - interval '90 days' "
                    "WHERE cliente_id=%s AND id=%s", (a, p["id"]))

    viejo = store.detalle(p["id"])
    assert viejo["sin_respuesta"] is True
    assert viejo["estado"] == PENDIENTE, "sin_respuesta es un MATIZ de pendiente, no un cuarto estado"

    # y en cuanto hay desenlace deja de contar como "sin respuesta", aunque siga siendo viejo
    assert store.cambiar_estado(p["id"], DESESTIMADO)["sin_respuesta"] is False


# ── nacio_completo: el insumo de la oferta del modo automático ────────────────────────────────────

@necesita_pg
def test_nacio_completo_distingue_lo_que_FALTA_no_puede(conn_de_tenant, tenants):
    """🔴 La razón de existir de la columna, medida antes de agregarla.

    `falta` se calcula del estado ACTUAL: un ingreso que entró sin cliente ni medio y se completó
    después queda con `falta = []`, **idéntico a uno que nació completo**. Contando con `falta`, quien
    dicta a medias y corrige contaría como buen dictador — y es exactamente a quien la oferta del modo
    automático NO le tiene que llegar, porque en automático no hay card que corrija.
    """
    a, _ = tenants
    store = CobroStore(conn_de_tenant(a), a)
    store.registrar_suelto(monto=1000, cliente_nombre="Panadería", medio="efectivo",
                           concepto="torta", idem_key="nc-a")
    b = store.registrar_suelto(monto=2000, idem_key="nc-b")
    completado = store.completar(b["id"], {"cliente_nombre": "Panadería", "medio": "efectivo",
                                           "concepto": "torta"})

    assert completado["falta"] == [], "el control: `falta` los vuelve indistinguibles"

    c = store.completitud_dictada()
    assert c["completos"] == 1 and c["incompletos"] == 1, \
        "…y `nacio_completo` sí los distingue, que es todo el punto"
    assert c["porcentaje"] == 50


@necesita_pg
def test_completar_NO_reescribe_como_nacio(conn_de_tenant, tenants):
    """Es un hecho del momento, no un estado. Si `completar` lo actualizara, la columna volvería a ser
    `falta` con otro nombre y el problema entero regresaría."""
    a, _ = tenants
    store = CobroStore(conn_de_tenant(a), a)
    b = store.registrar_suelto(monto=2000, idem_key="nc-c")
    store.completar(b["id"], {"cliente_nombre": "X", "medio": "efectivo", "concepto": "y"})
    assert store.completitud_dictada()["incompletos"] == 1


@necesita_pg
def test_sin_ingresos_medidos_el_porcentaje_es_None_y_no_cero(conn_de_tenant, tenants):
    """`0%` diría «dicta mal»; lo cierto es «todavía no sé». De acá sale una oferta, así que la
    diferencia no es cosmética."""
    a, _ = tenants
    c = CobroStore(conn_de_tenant(a), a).completitud_dictada()
    assert c["porcentaje"] is None
    assert c["total_medido"] == 0


@necesita_pg
def test_los_cobros_de_FACTURA_no_entran_en_la_cuenta(conn_de_tenant, tenants):
    """La oferta mide cómo DICTA el emprendedor. Un cobro que salió de tocar «Ya me la pagaron» no
    dice nada de eso, y contarlo como completo inflaría el porcentaje con algo que no es dictado."""
    a, _ = tenants
    store = CobroStore(conn_de_tenant(a), a)
    store.registrar(_comprobante(conn_de_tenant, a, "500.00"), idem_key="nc-fact")
    assert store.completitud_dictada()["total_medido"] == 0


# ── la fecha del ingreso se corrige DESPUÉS, en la card `ingreso_anotado` ──────────────────────

@necesita_pg
def test_completar_corrige_la_FECHA__el_unico_camino_que_existe(conn_de_tenant, tenants):
    """🔴 Sin esto, una fecha dictada mal NO se podia arreglar por ningun lado.

    El ingreso se guarda de una (§2.bis: un ingreso que espera confirmacion reintroduce la caja que
    miente), asi que cuando el resolvedor no entiende «el lunes» el registro YA existe con fecha de
    hoy. Y contestar por chat no sirve: la respuesta vuelve **al mismo resolvedor que acaba de
    fallar**. La unica salida es tocarla en la card — y para eso el PATCH tiene que aceptarla.

    Lo midio FRONTEND leyendo el handler vivo en vez de su propio cliente, que es donde habria
    confirmado lo que ya creia.
    """
    a, _ = tenants
    store = CobroStore(conn_de_tenant(a), a)
    ingreso = store.registrar_suelto(monto=40000, idem_key="fecha-uno")
    hoy = ingreso["fecha"]

    corregido = store.completar(ingreso["id"], {"fecha": "2026-07-20"})

    assert corregido["fecha"] == "2026-07-20", "la fecha corregida no viajo al UPDATE"
    assert hoy != "2026-07-20", "control: el alta ya habia puesto esa fecha, el test no probaria nada"


@necesita_pg
def test_corregir_la_fecha_NO_toca_el_monto_ni_lo_demas(conn_de_tenant, tenants):
    """Parcial de verdad: la clave ausente no se toca. Un PATCH de fecha que pisara el monto seria
    peor que no tener el campo — moveria plata sin que nadie lo pidiera."""
    a, _ = tenants
    store = CobroStore(conn_de_tenant(a), a)
    ingreso = store.registrar_suelto(monto=40000, cliente_nombre="Panaderia", medio="efectivo",
                                     concepto="torta", idem_key="fecha-dos")

    corregido = store.completar(ingreso["id"], {"fecha": "2026-07-19"})

    assert corregido["monto"] == ingreso["monto"]
    assert corregido["cliente_nombre"] == "Panaderia"
    assert corregido["medio"] == "efectivo"
    assert corregido["concepto"] == "torta"


@necesita_pg
def test_una_fecha_ilegible_es_400_del_usuario__no_500_del_servidor(conn_de_tenant, tenants):
    """El `except` de la capa web llego CON este campo, y por eso hay test.

    Hasta que el body acepto `fecha`, `completar` solo tocaba texto y no podia levantar
    `CobroInvalido`. Agregar el campo sin el `except` dejaba una fecha ilegible saliendo como **500**:
    un error del servidor por un dato del usuario, que ademas la app no sabe leer.
    """
    a, _ = tenants
    store = CobroStore(conn_de_tenant(a), a)
    ingreso = store.registrar_suelto(monto=1000, idem_key="fecha-tres")

    with pytest.raises(CobroInvalido):
        store.completar(ingreso["id"], {"fecha": "el lunes pasado"})


@necesita_pg
def test_el_monto_se_corrige__es_el_campo_por_el_que_la_card_existe(conn_de_tenant, tenants):
    """PLANIFICACION lo decidio el 2026-07-22, despues de que este test fijara la decision pendiente.

    La card existe porque un «quince mil» que Whisper oyo «cincuenta mil» **solo se detecta viendolo**.
    Una card que muestra el monto y no deja tocarlo no cubre el caso que motivo tener cards: **ensena
    que el numero esta bien**. Y la alternativa —Deshacer y redictar— son dos pasos, y el segundo
    vuelve a pasar por el reconocimiento que acaba de fallar.
    """
    a, _ = tenants
    store = CobroStore(conn_de_tenant(a), a)
    ingreso = store.registrar_suelto(monto=50000, idem_key="monto-uno")

    corregido = store.completar(ingreso["id"], {"monto": "15000"})

    assert corregido["monto"] == "15000.00"
    # Se mide el EFECTO en la base, no la respuesta: la leccion de la doble factura, donde el `if`
    # respondia bien y el efecto era doble.
    ingresos = store.listar_ingresos(limite=50)["ingresos"]
    de_nuevo = [k for k in ingresos if k["id"] == ingreso["id"]][0]
    assert de_nuevo["monto"] == "15000.00"


@necesita_pg
def test_corregir_el_monto_a_cero_o_negativo_NO_se_acepta(conn_de_tenant, tenants):
    """Misma cota que el alta, y por el mismo motivo: si el monto entrara por acá con otra validacion
    habria **dos definiciones de «monto valido»**, y la mas laxa seria la verdadera."""
    a, _ = tenants
    store = CobroStore(conn_de_tenant(a), a)
    ingreso = store.registrar_suelto(monto=15000, idem_key="monto-cero")

    for invalido in (0, -1, "0"):
        with pytest.raises(CobroInvalido):
            store.completar(ingreso["id"], {"monto": invalido})
