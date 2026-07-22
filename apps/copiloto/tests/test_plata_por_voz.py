"""HITO 3 — las cuatro tools que hacen que la plata se registre HABLANDO.

`registrar_ingreso` · `completar_ingreso` · `marcar_factura_cobrada` · `marcar_presupuesto`.

Los endpoints de las tres funciones ya viven (PRs #14/#15/#16) y tienen su E2E contra la base real.
Lo que se ejercita acá es **la decisión de cada tool**: qué guarda, qué se niega a elegir, y qué le
dice al LLM — que es lo único que el emprendedor va a escuchar.

Los stores van falsos a propósito: la SQL ya está probada contra Postgres, y lo que puede romperse
en esta capa es el criterio, no el `UPDATE`.
"""
import pytest

import tool_catalog
from cobro_store import ORIGEN_FACTURA, ORIGEN_MANUAL


class _Ctx:
    composio_user_id = "42"
    mp_gateway = None
    mp_cred_store = None
    mp_seller_user_id = None
    mp_webhook_base = None
    cliente_id = "tenant-a"


class _CobroFake:
    """Lo mínimo del `CobroStore` que estas tools tocan, con memoria para poder contar filas."""

    def __init__(self, cliente_id="tenant-a", *, impagas=None, duplicado=None):
        self.cliente_id = cliente_id
        self.ingresos = []
        self.cobros_de_factura = []
        self._impagas = impagas if impagas is not None else []
        self._duplicado = duplicado
        self.completados = []

    # — ingresos dictados —
    def posible_duplicado(self, *, monto, cliente_nombre="", dias=5):
        return self._duplicado

    def registrar_suelto(self, *, monto, medio="", fecha=None, cliente_ref=None,
                         presupuesto_ref=None, idem_key=None, cliente_nombre="", concepto=""):
        for previo in self.ingresos:                      # el índice único parcial, en memoria
            if idem_key and previo["idem_key"] == idem_key:
                return previo
        falta = [c for c, v in (("cliente", cliente_nombre), ("medio", medio),
                                ("concepto", concepto)) if not v]
        fila = {"id": len(self.ingresos) + 1, "monto": f"{monto}.00" if "." not in str(monto) else str(monto),
                "medio": medio, "fecha": str(fecha), "origen": ORIGEN_MANUAL,
                "cliente_nombre": cliente_nombre, "concepto": concepto, "idem_key": idem_key,
                "falta": falta, "borrable": True}
        self.ingresos.append(fila)
        return fila

    def listar_ingresos(self, *, limite=100):
        return {"ingresos": list(reversed(self.ingresos)), "total": "0.00"}

    def completar(self, ingreso_id, datos):
        for fila in self.ingresos:
            if fila["id"] == ingreso_id:
                self.completados.append((ingreso_id, dict(datos)))
                fila.update(datos)
                fila["falta"] = [c for c, v in (("cliente", fila["cliente_nombre"]),
                                                ("medio", fila["medio"]),
                                                ("concepto", fila["concepto"])) if not v]
                return fila
        return None

    # — cobros contra factura —
    def impagos(self):
        return {"comprobantes": list(self._impagas), "total_adeudado": "0.00"}

    def registrar(self, comprobante_id, *, monto=None, medio="", fecha=None, idem_key=None):
        factura = next(c for c in self._impagas if c["id"] == comprobante_id)
        cobrado = monto if monto is not None else factura["saldo"]
        self.cobros_de_factura.append({"comprobante_id": comprobante_id, "monto": str(cobrado),
                                       "idem_key": idem_key})
        saldo = float(factura["saldo"]) - float(cobrado)
        return ({"id": 1, "monto": str(cobrado), "origen": ORIGEN_FACTURA},
                {"estado": "cobrada" if saldo <= 0 else "parcial", "saldo": f"{saldo:.2f}"})


class _PresupuestoFake:
    def __init__(self, cliente_id="tenant-a", *, filas=None):
        self.cliente_id = cliente_id
        self._filas = filas if filas is not None else []
        self.cambios = []

    def listar(self, *, limit=50, incluir_reemplazados=False):
        return list(self._filas)

    def cambiar_estado(self, presupuesto_id, nuevo):
        for fila in self._filas:
            if fila["id"] == presupuesto_id:
                self.cambios.append((presupuesto_id, nuevo))
                return {**fila, "estado": nuevo}
        return None


def _presu(pid, numero, nombre, total="100000.00", estado="pendiente", concepto=""):
    return {"id": pid, "numero": numero, "total": total, "estado": estado, "concepto": concepto,
            "receptor": {"nombre": nombre}}


def _ex(cobro=None, presupuesto=None):
    return tool_catalog.make_tool_executor(
        None, now_iso_provider=lambda: "2026-07-22T10:00:00",
        cobro_store_factory=(lambda cid: cobro) if cobro is not None else None,
        presupuesto_store_factory=(lambda cid: presupuesto) if presupuesto is not None else None)


def _correr(nombre, args, *, cobro=None, presupuesto=None, idem_key="tc-1"):
    return _ex(cobro, presupuesto)(nombre, args, _Ctx(), confirmed=False, idem_key=idem_key)


# ── el catálogo ──────────────────────────────────────────────────────────────────────────────────

def test_las_cuatro_estan_en_el_catalogo():
    nombres = [s["function"]["name"] for s in tool_catalog.build_tool_catalog()]
    for tool in ("registrar_ingreso", "completar_ingreso", "marcar_factura_cobrada",
                 "marcar_presupuesto"):
        assert tool in nombres, f"{tool} no llegó al catálogo que ve el LLM"


def test_NINGUNA_pide_confirmacion_si_no():
    """El confirm-gate re-ejecuta los MISMOS argumentos: no protege de «¿a cuál?», que es el único
    riesgo real acá, y sí agrega la fricción que el addendum §2 prohíbe para anotar plata que entró."""
    for tool in ("registrar_ingreso", "completar_ingreso", "marcar_factura_cobrada",
                 "marcar_presupuesto"):
        assert tool not in tool_catalog.WRITE_TOOLS


def test_registrar_ingreso_pide_SOLO_el_monto():
    """El backend acepta un ingreso con sólo el monto; si el schema exigiera más, el camino por voz
    sería más estricto que el HTTP y «me pagaron 85 mil» —el caso que la función existe para cubrir—
    no se podría anotar hablando."""
    schema = next(s for s in tool_catalog.build_tool_catalog()
                  if s["function"]["name"] == "registrar_ingreso")
    assert schema["function"]["parameters"]["required"] == ["monto"]


def test_marcar_presupuesto_solo_ofrece_los_dos_estados_reales():
    """El enum sale de `presupuesto_store`, no de literales: si el estado se renombrara allá y acá
    quedara el viejo, el copiloto marcaría y no pasaría nada — sin error que mirar."""
    schema = next(s for s in tool_catalog.build_tool_catalog()
                  if s["function"]["name"] == "marcar_presupuesto")
    assert schema["function"]["parameters"]["properties"]["estado"]["enum"] == \
        ["aprobado", "desestimado"]


# ── registrar_ingreso ────────────────────────────────────────────────────────────────────────────

def test_solo_el_monto_YA_QUEDA_GUARDADO():
    """🔴 El DoD del addendum §6, del lado de la voz. Si esto propusiera en vez de guardar, el
    emprendedor dicta, no toca nada, y la plata que entró no queda en ningún lado."""
    store = _CobroFake()
    res = _correr("registrar_ingreso", {"monto": "85000"}, cobro=store)
    assert res.status == "ok"
    assert len(store.ingresos) == 1
    assert store.ingresos[0]["monto"].startswith("85000")
    assert "GUARDADO" in res.observation["result"]


def test_dice_el_monto_en_la_confirmacion():
    """Es el único punto donde un «quince mil» que el dictado entendió como «cincuenta mil» se puede
    detectar: el emprendedor lo OYE. Sin el monto en la respuesta, el error entra mudo."""
    res = _correr("registrar_ingreso", {"monto": "85000"}, cobro=_CobroFake())
    assert "$85.000" in res.observation["result"]


def test_avisa_lo_que_falto_con_palabras_de_persona():
    res = _correr("registrar_ingreso", {"monto": "85000"}, cobro=_CobroFake())
    dicho = res.observation["result"]
    assert "de quién" in dicho and "cómo te pagaron" in dicho
    assert "medio" not in dicho.split("Anotado")[-1].replace("cómo te pagaron", ""), \
        "no puede filtrarse el nombre técnico de la columna"


def test_si_no_falta_nada_NO_pide_nada():
    """Un copiloto que igual pregunta después de que le dijeron todo se vuelve ruido, y el aviso
    deja de leerse justo cuando importa."""
    res = _correr("registrar_ingreso",
                  {"monto": "85000", "cliente": "Panadería", "medio_pago": "efectivo",
                   "concepto": "torta"}, cobro=_CobroFake())
    assert "No te dijo" not in res.observation["result"]


def test_sin_monto_repregunta_y_NO_guarda():
    store = _CobroFake()
    res = _correr("registrar_ingreso", {"cliente": "Panadería"}, cobro=store)
    assert res.status == "ok", "no falló nada: falta un dato, y con `error` el loop se disculpa"
    assert store.ingresos == []
    assert "monto" in res.observation["result"].lower()


def test_el_duplicado_probable_NO_guarda_y_pregunta_antes():
    """🔴 Al revés que un dato faltante, y por eso: un dato que falta se ve y se completa cuando
    aparezca; un ingreso de más infla la caja y no se ve nunca."""
    store = _CobroFake(duplicado={"id": 7, "monto": "85000.00", "fecha": "2026-07-20",
                                  "origen": "mercadopago", "cliente_nombre": "Panadería"})
    res = _correr("registrar_ingreso", {"monto": "85000", "cliente": "Panadería"}, cobro=store)
    assert store.ingresos == [], "preguntó y guardó igual: la caja se infla"
    assert "todavía NO lo anoté" in res.observation["result"]
    assert "confirmar_duplicado" in res.observation["result"], \
        "el LLM tiene que saber CÓMO insistir, no adivinarlo"


def test_confirmando_el_duplicado_SI_guarda():
    """Avisa, no prohíbe: dos cobros iguales del mismo cliente son un caso real y él lo sabe mejor."""
    store = _CobroFake(duplicado={"id": 7, "monto": "85000.00", "fecha": "2026-07-20",
                                  "origen": "mercadopago", "cliente_nombre": "Panadería"})
    _correr("registrar_ingreso",
            {"monto": "85000", "cliente": "Panadería", "confirmar_duplicado": True}, cobro=store)
    assert len(store.ingresos) == 1


def test_el_mismo_turno_reintentado_NO_anota_dos_veces():
    """La activity es at-least-once. Sin `idem_key`, un reintento de Temporal duplica el ingreso —y
    a diferencia de un fallo, esto no deja rastro: son dos filas plausibles."""
    store = _CobroFake()
    for _ in range(3):
        _correr("registrar_ingreso", {"monto": "85000"}, cobro=store, idem_key="tc-mismo")
    assert len(store.ingresos) == 1


def test_ayer_se_resuelve_contra_el_reloj_inyectado():
    store = _CobroFake()
    _correr("registrar_ingreso", {"monto": "1000", "fecha_raw": "ayer"}, cobro=store)
    assert store.ingresos[0]["fecha"] == "2026-07-21"


def test_quince_mil_dictado_con_punto_no_se_vuelve_quince_pesos():
    store = _CobroFake()
    _correr("registrar_ingreso", {"monto": "$ 15.000"}, cobro=store)
    assert store.ingresos[0]["monto"].startswith("15000")


# ── completar_ingreso ────────────────────────────────────────────────────────────────────────────

def test_completar_toca_EL_MISMO_ingreso_y_no_crea_otro():
    """🔴 El DoD: contestar el aviso completa, no duplica. Si creara otro, el mecanismo que existe
    para mejorar la calidad del dato sería el que infla la caja."""
    store = _CobroFake()
    _correr("registrar_ingreso", {"monto": "85000"}, cobro=store)
    res = _correr("completar_ingreso", {"cliente": "Panadería", "medio_pago": "efectivo"},
                  cobro=store)
    assert len(store.ingresos) == 1
    assert store.ingresos[0]["cliente_nombre"] == "Panadería"
    assert "MISMO" in res.observation["result"]


def test_completar_sin_id_toma_el_ULTIMO_dictado():
    """El id viaja en la observación del turno anterior y el historial no garantiza conservarlo. Si
    esta tool dependiera de que el modelo lo recuerde, fallaría justo en el caso que el DoD mide."""
    store = _CobroFake()
    _correr("registrar_ingreso", {"monto": "1000"}, cobro=store, idem_key="a")
    _correr("registrar_ingreso", {"monto": "2000"}, cobro=store, idem_key="b")
    _correr("completar_ingreso", {"medio_pago": "efectivo"}, cobro=store)
    assert store.completados == [(2, {"medio": "efectivo"})]


def test_completar_NO_pisa_lo_que_ya_estaba():
    """Parcial de verdad: aclarar sólo el medio no puede borrar el cliente que ya se había puesto."""
    store = _CobroFake()
    _correr("registrar_ingreso", {"monto": "1000", "cliente": "Panadería"}, cobro=store)
    _correr("completar_ingreso", {"medio_pago": "efectivo"}, cobro=store)
    assert store.ingresos[0]["cliente_nombre"] == "Panadería"


def test_completar_sin_datos_no_borra_nada():
    store = _CobroFake()
    _correr("registrar_ingreso", {"monto": "1000", "cliente": "Panadería"}, cobro=store)
    _correr("completar_ingreso", {"cliente": "   "}, cobro=store)
    assert store.completados == []
    assert store.ingresos[0]["cliente_nombre"] == "Panadería"


# ── marcar_factura_cobrada ───────────────────────────────────────────────────────────────────────

_UNA_IMPAGA = [{"id": 10, "nro": "0001-00000042", "receptor_nombre": "Panadería Los Tilos",
                "saldo": "50000.00", "total": "50000.00"}]


def test_marcar_cobrada_por_nombre_parcial():
    store = _CobroFake(impagas=list(_UNA_IMPAGA))
    res = _correr("marcar_factura_cobrada", {"factura": "panadería"}, cobro=store)
    assert store.cobros_de_factura[0]["comprobante_id"] == 10
    assert "0001-00000042" in res.observation["result"]


def test_marcar_cobrada_por_numero_corto():
    """Dice «la 42», no `0001-00000042`. Si sólo matcheara el número completo, la tool existiría
    para una forma de hablar que nadie usa."""
    store = _CobroFake(impagas=list(_UNA_IMPAGA))
    _correr("marcar_factura_cobrada", {"factura": "42"}, cobro=store)
    assert store.cobros_de_factura[0]["comprobante_id"] == 10


def test_con_UNA_sola_impaga_no_hace_falta_nombrarla():
    store = _CobroFake(impagas=list(_UNA_IMPAGA))
    _correr("marcar_factura_cobrada", {}, cobro=store)
    assert len(store.cobros_de_factura) == 1


def test_si_hay_VARIAS_no_elige_y_devuelve_la_lista():
    """🔴 Marcar cobrada la factura equivocada se parece exactamente a haber hecho lo correcto: no
    hay síntoma. Preguntar es más barato que un «te deben» que miente."""
    store = _CobroFake(impagas=[
        {"id": 10, "nro": "0001-00000042", "receptor_nombre": "Panadería", "saldo": "50000.00"},
        {"id": 11, "nro": "0001-00000043", "receptor_nombre": "Panadería", "saldo": "70000.00"}])
    res = _correr("marcar_factura_cobrada", {"factura": "panadería"}, cobro=store)
    assert store.cobros_de_factura == []
    assert "NO elijas vos" in res.observation["result"]
    assert len(res.observation["candidatos"]) == 2


def test_sin_impagas_no_inventa():
    store = _CobroFake(impagas=[])
    res = _correr("marcar_factura_cobrada", {"factura": "panadería"}, cobro=store)
    assert store.cobros_de_factura == []
    assert "No encontré" in res.observation["result"]


def test_pago_parcial_avisa_lo_que_queda():
    store = _CobroFake(impagas=list(_UNA_IMPAGA))
    res = _correr("marcar_factura_cobrada", {"factura": "42", "monto": "20000"}, cobro=store)
    assert "$30.000" in res.observation["result"]


def test_reintento_del_mismo_turno_no_cobra_dos_veces_la_factura():
    store = _CobroFake(impagas=list(_UNA_IMPAGA))
    _correr("marcar_factura_cobrada", {"factura": "42"}, cobro=store, idem_key="tc-x")
    assert store.cobros_de_factura[0]["idem_key"] == "tc-x", \
        "sin idem_key el retry at-least-once registra el cobro dos veces"


# ── marcar_presupuesto ───────────────────────────────────────────────────────────────────────────

def test_aprobar_por_nombre_del_cliente():
    store = _PresupuestoFake(filas=[_presu(1, "P-0001", "Panadería Los Tilos")])
    res = _correr("marcar_presupuesto", {"presupuesto": "panadería", "estado": "aprobado"},
                  presupuesto=store)
    assert store.cambios == [(1, "aprobado")]
    assert "aprobado" in res.observation["result"]


def test_desestimar_dice_descartado_no_desestimado():
    """«Desestimado» es la palabra del schema, no la del emprendedor."""
    store = _PresupuestoFake(filas=[_presu(1, "P-0001", "Panadería")])
    res = _correr("marcar_presupuesto", {"presupuesto": "panadería", "estado": "desestimado"},
                  presupuesto=store)
    assert "descartado" in res.observation["result"]


def test_los_YA_resueltos_no_entran_en_la_busqueda():
    """Si entraran, «la panadería» podría resolverse al que aprobó el mes pasado y el copiloto
    devolvería un error de transición en vez de trabajar sobre el que espera respuesta."""
    store = _PresupuestoFake(filas=[
        _presu(1, "P-0001", "Panadería", estado="aprobado"),
        _presu(2, "P-0002", "Panadería", estado="pendiente")])
    _correr("marcar_presupuesto", {"presupuesto": "panadería", "estado": "aprobado"},
            presupuesto=store)
    assert store.cambios == [(2, "aprobado")]


def test_desestimar_alcanza_tambien_a_los_aprobados():
    """`TRANSICIONES` permite aprobado→desestimado: un trabajo aprobado que después se cae es un
    caso real, y si la tool lo excluyera habría que ir a la pantalla justo para la peor noticia."""
    store = _PresupuestoFake(filas=[_presu(1, "P-0001", "Panadería", estado="aprobado")])
    _correr("marcar_presupuesto", {"presupuesto": "panadería", "estado": "desestimado"},
            presupuesto=store)
    assert store.cambios == [(1, "desestimado")]


def test_varios_pendientes_no_elige():
    store = _PresupuestoFake(filas=[_presu(1, "P-0001", "Panadería"), _presu(2, "P-0002", "Panadería")])
    res = _correr("marcar_presupuesto", {"presupuesto": "panadería", "estado": "aprobado"},
                  presupuesto=store)
    assert store.cambios == []
    assert "NO elijas vos" in res.observation["result"]


def test_sin_estado_claro_pregunta():
    store = _PresupuestoFake(filas=[_presu(1, "P-0001", "Panadería")])
    res = _correr("marcar_presupuesto", {"presupuesto": "panadería", "estado": "quizás"},
                  presupuesto=store)
    assert store.cambios == []
    assert "aprobaron" in res.observation["result"]


def test_la_transicion_invalida_NO_explota_el_loop():
    """Una excepción acá dispara los retries del loop contra algo que reintentar no arregla — y sin
    try/except que la contenga se lleva puesta la sesión entera (PR #114)."""
    class _Carrera(_PresupuestoFake):
        def cambiar_estado(self, presupuesto_id, nuevo):
            # La firma REAL: `(desde, hacia)`. La primera versión de este test la levantó con un
            # solo argumento y lo que viajó fue un `TypeError` — que el `except Exception` del
            # executor atrapa igual, así que el test daba rojo por el motivo equivocado y habría
            # dado verde sin probar el `except` que dice probar.
            from presupuesto_store import TransicionInvalida
            raise TransicionInvalida("aprobado", nuevo)

    store = _Carrera(filas=[_presu(1, "P-0001", "Panadería")])
    res = _correr("marcar_presupuesto", {"presupuesto": "panadería", "estado": "aprobado"},
                  presupuesto=store)
    assert res.status == "ok"
    assert "movió recién" in res.observation["result"]


# ── el aislamiento, con control ──────────────────────────────────────────────────────────────────

def test_el_store_se_construye_con_el_tenant_del_turno():
    """La barrera de aislamiento de este repo es el `cliente_id` fijado en el constructor. Un store
    compartido entre turnos anotaría el ingreso de un emprendedor en la caja de otro."""
    vistos = []

    def factory(cid):
        vistos.append(cid)
        return _CobroFake(cid)

    ex = tool_catalog.make_tool_executor(None, now_iso_provider=lambda: "2026-07-22T10:00:00",
                                         cobro_store_factory=factory)

    class _Otro(_Ctx):
        cliente_id = "tenant-b"

    ex("registrar_ingreso", {"monto": "1"}, _Ctx(), confirmed=False, idem_key="a")
    ex("registrar_ingreso", {"monto": "1"}, _Otro(), confirmed=False, idem_key="b")
    assert vistos == ["tenant-a", "tenant-b"]


@pytest.mark.parametrize("tool,args", [
    ("registrar_ingreso", {"monto": "1000"}),
    ("completar_ingreso", {"medio_pago": "efectivo"}),
    ("marcar_factura_cobrada", {}),
    ("marcar_presupuesto", {"presupuesto": "x", "estado": "aprobado"}),
])
def test_sin_store_cableado_degrada_a_error_y_no_explota(tool, args):
    """El control del control: si el composition root no inyecta la factory, la tool tiene que decir
    que no puede — nunca reventar el turno con un `AttributeError` sobre `None`."""
    res = _correr(tool, args)
    assert res.status == "error"
