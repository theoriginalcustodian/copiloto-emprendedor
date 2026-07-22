"""CLIENTES hito 5 — las dos tools de voz: `registrar_cliente` (propone) y `consultar_cliente` (lee).

Contrato `clientes` §6. Ninguna de las dos escribe: la primera devuelve una card editable que el
emprendedor guarda con el `POST /clientes` (mismo patrón que gastos) y la segunda es read puro.

El store va falso a propósito — lo que se ejercita acá es la **decisión** de cada tool, y la SQL real
tiene su propio E2E contra la base viva.
"""
import pytest

import tool_catalog
from backend.agent.types import ToolResult


class _Ctx:
    composio_user_id = "42"
    mp_gateway = None
    mp_cred_store = None
    mp_seller_user_id = None
    mp_webhook_base = None
    cliente_id = "tenant-a"


def _ex(**kw):
    return tool_catalog.make_tool_executor(None, now_iso_provider=lambda: "2026-07-22T10:00:00", **kw)


# ── el catálogo ──────────────────────────────────────────────────────────────────────────────────

def test_registrar_cliente_esta_en_el_catalogo_y_NO_pide_confirmacion():
    """Si entrara en WRITE_TOOLS caería en el confirm-gate de sí/no, que es justo el mecanismo que el
    patrón de la card existe para evitar: confirmar sí/no re-ejecuta los MISMOS argumentos, y un
    nombre que el dictado transcribió mal sólo se podría aceptar o repetir entero.

    🔴 Antes este test también exigía `consultar_cliente`. **La poda del hito 2 la sacó** —«el copiloto
    ejecuta, Inteligencia de Negocio explica»— y Clientes ya es una pantalla propia. Lo que el test
    protege sigue intacto: que la tool que ESCRIBE no caiga en el confirm-gate.
    """
    nombres = [s["function"]["name"] for s in tool_catalog.build_tool_catalog()]
    assert "registrar_cliente" in nombres
    assert "registrar_cliente" not in tool_catalog.WRITE_TOOLS
    assert "consultar_cliente" not in nombres, "volvio a exponerse una tool consultiva podada"


def test_registrar_cliente_pide_SOLO_el_nombre():
    """El DoD del contrato lo mide del lado del formulario; acá se fija del lado de la voz. Si el
    schema exigiera el documento, «anotá a la panadería de la esquina» —el caso más común— no se
    podría guardar por voz, y el camino dictado sería más estricto que el manual."""
    schema = next(s for s in tool_catalog.build_tool_catalog()
                  if s["function"]["name"] == "registrar_cliente")
    assert schema["function"]["parameters"]["required"] == ["nombre"]


# ── registrar_cliente: la propuesta ──────────────────────────────────────────────────────────────

def test_el_nombre_solo_alcanza_para_proponer():
    tr = _ex()("registrar_cliente", {"nombre": "  Panadería Los Tilos "}, _Ctx(),
               confirmed=False, idem_key="k")
    assert tr.status == "ok" and tr.is_write is False
    assert tr.artifact.kind == "cliente_propuesto"
    assert tr.artifact.data["nombre"] == "Panadería Los Tilos"
    assert tr.artifact.data["doc_nro"] is None and tr.artifact.data["doc_tipo"] is None
    assert tr.artifact.data["origen"] == "voz"


def test_el_cuit_dictado_con_guiones_llega_normalizado_y_con_su_tipo():
    """El emprendedor dicta el CUIT como está en el papel. Sin normalizar, el mismo CUIT escrito de
    dos maneras son dos filas distintas para el índice único y el duplicado entra por la puerta de
    al lado."""
    tr = _ex()("registrar_cliente", {"nombre": "Los Tilos", "doc_nro": "30-71234567-8"}, _Ctx(),
               confirmed=False, idem_key="k")
    assert tr.artifact.data["doc_nro"] == "30712345678"
    assert tr.artifact.data["doc_tipo"] == 80          # CUIT, derivado del largo


def test_un_documento_con_forma_rara_VIAJA_igual_y_avisa():
    """🔴 No se descarta en silencio. Whisper transcribe mal los números largos, y ése es justamente
    el que hay que mostrarle. Borrarlo haría desaparecer el error junto con el dato: el alta saldría
    «bien», con un cliente sin CUIT que él creyó haber cargado."""
    # 9 dígitos: no es CUIT (11) ni DNI (7 u 8). La primera versión de este test usaba `3071234`
    # —siete— y falló: eso ES un DNI válido. El test se equivocaba, no el código.
    tr = _ex()("registrar_cliente", {"nombre": "Los Tilos", "doc_nro": "307123456"}, _Ctx(),
               confirmed=False, idem_key="k")
    assert tr.artifact.data["doc_nro"] == "307123456"    # no se perdió
    assert tr.artifact.data["doc_tipo"] is None
    assert "confirme" in tr.observation["result"].lower()


def test_dijo_CUIT_y_el_numero_no_puede_serlo__no_lo_guarda_como_DNI():
    """🔴 El caso que salió de medir el vivo, no de imaginarlo.

    «CUIT 30-71234» normaliza a `3071234`: **siete dígitos, un DNI perfectamente válido**. Antes el
    derivador decía 96, la card se veía impecable y el cliente entraba con el tipo equivocado — sin
    error, sin aviso, sin nada raro que mirar. La única señal de que algo estaba mal era la palabra
    que la persona había usado, y no había dónde guardarla.
    """
    tr = _ex()("registrar_cliente", {"nombre": "X", "doc_nro": "30-71234", "tipo_doc": "CUIT"},
               _Ctx(), confirmed=False, idem_key="k")
    assert tr.artifact.data["doc_nro"] == "3071234"     # el número queda, para que lo corrija
    assert tr.artifact.data["doc_tipo"] is None         # y NO se lo anota como DNI
    assert "CUIT" in tr.observation["result"]
    assert "11 dígitos" in tr.observation["result"]     # el aviso nombra la contradicción


def test_si_lo_dicho_y_el_largo_coinciden__gana_lo_dicho_sin_re_derivar():
    tr = _ex()("registrar_cliente", {"nombre": "X", "doc_nro": "30-71234567-8", "tipo_doc": "CUIT"},
               _Ctx(), confirmed=False, idem_key="k")
    assert tr.artifact.data["doc_tipo"] == 80
    assert "OJO" not in tr.observation["result"]


def test_si_no_dijo_el_tipo__se_sigue_derivando_del_largo():
    """La derivación no se toca: exigir el tipo cada vez que viene un número trabaría al que dicta
    sólo el CUIT. El chequeo nuevo aplica **sólo** cuando hay una palabra que pueda contradecirlo."""
    tr = _ex()("registrar_cliente", {"nombre": "X", "doc_nro": "12345678"}, _Ctx(),
               confirmed=False, idem_key="k")
    assert tr.artifact.data["doc_tipo"] == 96
    assert "OJO" not in tr.observation["result"]


def test_sin_nombre_repregunta_en_vez_de_fallar():
    tr = _ex()("registrar_cliente", {"nombre": "   "}, _Ctx(), confirmed=False, idem_key="k")
    assert tr.status == "ok"       # no es un error: falta un dato
    assert tr.artifact is None
    assert "nombre" in tr.observation["result"].lower()


def test_la_propuesta_dice_que_TODAVIA_no_esta_guardado():
    """Si el LLM cierra el turno con «listo, ya lo anoté», el emprendedor lee eso, no toca Guardar, y
    el cliente se pierde creyendo los dos que estaba hecho."""
    tr = _ex()("registrar_cliente", {"nombre": "Los Tilos"}, _Ctx(), confirmed=False, idem_key="k")
    assert "TODAVÍA NO" in tr.observation["result"]


# ── consultar_cliente ────────────────────────────────────────────────────────────────────────────

class _FakeStore:
    """Cartera en memoria. El bucket es COMPARTIDO entre tenants a propósito: si el filtro por
    `cliente_id` no existiera, este falso no lo taparía — un doble que aísla por construcción hace
    pasar el test adversarial sin que el código aísle nada."""

    bucket: dict = {}

    def __init__(self, cliente_id):
        self.cliente_id = cliente_id

    def listar(self, *, q="", limit=50):
        propios = [c for c in _FakeStore.bucket.values() if c["_tenant"] == self.cliente_id]
        hits = [c for c in propios if q.lower() in c["nombre"].lower()]
        return hits[:limit], len(propios)

    def resumen_operaciones(self, cliente, *, ultimas=5):
        ficha = _FakeStore.bucket.get(cliente)
        if ficha is None or ficha["_tenant"] != self.cliente_id:
            return None
        return {"cliente": ficha, **ficha["_resumen"]}


@pytest.fixture(autouse=True)
def _cartera():
    _FakeStore.bucket = {}
    yield
    _FakeStore.bucket = {}


def _cliente(id_, nombre, *, tenant="tenant-a", doc="30712345678", **resumen):
    base = {"facturas_atribuibles": bool(doc), "facturas": 0, "notas_credito": 0,
            "facturado": "0.00", "presupuestos": 0, "presupuestado": "0.00", "operaciones": []}
    _FakeStore.bucket[id_] = {"id": id_, "nombre": nombre, "doc_nro": doc, "doc_tipo": 80 if doc else None,
                              "_tenant": tenant, "_resumen": {**base, **resumen}}


def _consultar(nombre, ctx=None):
    return _ex(cliente_store_factory=_FakeStore)("consultar_cliente", {"nombre": nombre},
                                                 ctx or _Ctx(), confirmed=False, idem_key="k")


def test_sin_coincidencias_no_inventa_y_ofrece_una_salida():
    tr = _consultar("panadería")
    assert tr.status == "ok"
    assert "no encontré" in tr.observation["result"].lower()


def test_con_VARIOS_que_coinciden_NO_elige_uno():
    """🔴 El punto del contrato §6. Un total plausible del cliente equivocado se parece exactamente a
    la respuesta correcta — el emprendedor no tiene cómo notarlo."""
    _cliente(1, "Panadería Los Tilos")
    _cliente(2, "Panadería del Centro")
    tr = _consultar("panadería")
    assert "NO elijas vos" in tr.observation["result"]
    assert {c["nombre"] for c in tr.observation["candidatos"]} == {"Panadería Los Tilos",
                                                                   "Panadería del Centro"}
    assert "resumen" not in tr.observation      # no llegó a mirar los números de ninguno


def test_con_UNO_solo_responde_el_total():
    _cliente(1, "Panadería Los Tilos", facturas=3, facturado="145000.00",
             presupuestos=2, presupuestado="90000.50",
             operaciones=[{"fecha": "2026-07-20", "detalle": "Factura 6-18", "monto": "50000.00",
                           "tipo": "factura", "signo": "entra"}])
    tr = _consultar("tilos")
    texto = tr.observation["result"]
    assert "$145.000,00" in texto            # miles con punto, decimales con coma
    assert "$90.000,50" in texto
    assert "Factura 6-18" in texto


def test_las_notas_de_credito_se_declaran_YA_descontadas():
    """El total neto sin decirlo se lee como «facturado bruto» y el emprendedor lo suma dos veces
    mentalmente. Ya pasó en la pantalla de actividad, donde una NC se mostró como plata que entra."""
    _cliente(1, "Los Tilos", facturas=3, notas_credito=1, facturado="95000.00")
    assert "DESCONTADAS" in _consultar("tilos").observation["result"]


def test_sin_documento_dice_que_NO_PUEDE_SABERLO__no_que_no_compro():
    """🔴 Lo más importante de la tool. Las facturas se atan por documento; un cliente que entró por
    nombre no tiene con qué atarse. Decir «facturado $0» sería afirmar un hecho falso con la forma de
    un dato — y el emprendedor lo creería, porque un cero no se ve como un error."""
    _cliente(1, "Marta Sin Documento", doc="", presupuestos=1, presupuestado="12000.00")
    texto = _consultar("marta").observation["result"]
    assert "NO tengo cómo saberlo" in texto
    assert "NO digas que no compró" in texto
    assert "$0,00" not in texto              # el cero de facturado NO aparece en el texto


def test_la_cartera_de_OTRO_tenant_no_existe_para_esta_conversacion():
    """Test adversarial (regla dura del repo). El control está abajo: el MISMO cliente, pedido desde
    su propio tenant, sí aparece — si no, este test pasaría aunque la búsqueda estuviera rota."""
    _cliente(1, "Panadería Los Tilos", tenant="tenant-b", facturado="999999.00", facturas=9)

    class _Otro(_Ctx):
        cliente_id = "tenant-a"

    ajeno = _consultar("tilos", _Otro())
    assert "no encontré" in ajeno.observation["result"].lower()
    assert "999" not in ajeno.observation["result"]

    class _Duenio(_Ctx):
        cliente_id = "tenant-b"

    propio = _consultar("tilos", _Duenio())         # el control
    assert "$999.999,00" in propio.observation["result"]


def test_sin_factory_no_revienta_la_sesion():
    """El executor promete no propagar excepciones: un raise acá dispararía los 5 reintentos del loop
    contra la misma excepción determinística y tumbaría la conversación entera (PR #114)."""
    tr = _ex()("consultar_cliente", {"nombre": "x"}, _Ctx(), confirmed=False, idem_key="k")
    assert tr.status == "error" and isinstance(tr, ToolResult)


# ── el formateador de plata ──────────────────────────────────────────────────────────────────────

@pytest.mark.parametrize("crudo,esperado", [
    ("0.00", "$0,00"),
    ("1500.00", "$1.500,00"),
    ("145000.50", "$145.000,50"),
    ("1234567.89", "$1.234.567,89"),
    ("-3000.00", "-$3.000,00"),        # neto negativo: se devolvió más de lo que se facturó
])
def test_plata_se_escribe_como_se_escribe_aca(crudo, esperado):
    assert tool_catalog._plata(crudo) == esperado
