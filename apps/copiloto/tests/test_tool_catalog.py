"""Catálogo de tools del motor ReAct (Task 5): build_tool_catalog / TOOL_INDEX / WRITE_TOOLS.

Verifica que el catálogo une los TOOL_SCHEMAS de los servicios descubiertos + las 2 tools de 1ra clase
(calendar_book, mp_charge), que el índice resuelve cada tool a su destino, y que WRITE_TOOLS distingue
EXACTO write de read (via el WRITE_OPS explícito de cada módulo — test_service_schemas.py ya cubre que
todos los módulos lo declaran; acá se verifica el consumo en tool_catalog)."""
import tool_catalog
from services import drive


def test_catalog_has_services_calendar_and_mp():
    names = {s["function"]["name"] for s in tool_catalog.build_tool_catalog()}
    assert {"gmail_send", "calendar_book", "mp_charge"} <= names
    # Poda del hito 2: lo que se fue NO puede volver por la puerta de atrás.
    assert not ({"gmail_fetch", "sheets_read_range", "sheets_update_range"} & names)


def test_write_tools_flags_writes_not_reads():
    assert "mp_charge" in tool_catalog.WRITE_TOOLS
    assert "calendar_book" in tool_catalog.WRITE_TOOLS
    assert "gmail_send" in tool_catalog.WRITE_TOOLS
    assert "gmail_fetch" not in tool_catalog.WRITE_TOOLS   # read


def test_index_resolves_service_tool():
    kind, *rest = tool_catalog.TOOL_INDEX["gmail_send"]
    assert kind == "service"


def test_index_resolves_first_class_tools():
    assert tool_catalog.TOOL_INDEX["calendar_book"] == ("calendar",)
    assert tool_catalog.TOOL_INDEX["mp_charge"] == ("mp",)


def test_required_of_returns_schema_required_fields():
    assert tool_catalog._required_of("gmail_send") == ["to", "body"]
    assert tool_catalog._required_of("tool_inexistente") == []


# A7 (poda de Drive, `800a56a0`): el control que de verdad lo sostiene es TOOL_INDEX (vía
# `drive.TOOLS`, que `_service_index()` recorre), no `/catalog` (`test_catalog_route.py:125` prueba
# la superficie de UI, nunca este índice). Hallazgo `H-A7SINTEST`: hasta este test, nada fallaba si
# alguien le agregaba un `TOOLS` a Drive de nuevo.
def test_drive_no_resuelve_en_tool_index():
    assert drive.TOOLS == {}
    idx = tool_catalog._service_index()
    assert not any(mod is drive for _kind, mod, _op in idx.values())


def test_drive_no_resuelve_en_tool_index_control_positivo(monkeypatch):
    """Control positivo del test de arriba: si `drive.TOOLS` deja de estar vacío, `_service_index()`
    tiene que exponerlo — si esto no detectara la regresión, el test anterior sería un cero sin
    control (canon 5)."""
    monkeypatch.setitem(drive.TOOLS, "drive_create_file", "create_file")
    idx = tool_catalog._service_index()
    assert idx["drive_create_file"] == ("service", drive, "create_file")


# SM-Z1 — CONTROL NEGATIVO del veto que se conserva. Drive vuelve a ser CONECTABLE (`connectable_policy`), pero
# eso NO le devuelve al agente conversacional la capacidad de subir archivos ni repartir permisos: sin este
# test, «Drive volvió» no se distingue de «se le devolvió todo». Los slugs de archivado ESTÁN en la policy del
# gateway (la activity los necesita), así que lo que los frena es que el agente no tiene cómo nombrarlos.
class _GatewayEspia:
    def __init__(self):
        self.llamadas = []

    def __getattr__(self, nombre):
        def _registrar(*args, **kwargs):
            self.llamadas.append((nombre, args, kwargs))
            raise AssertionError(f"el agente llegó al gateway: {nombre}")
        return _registrar


_INTENTOS_DE_SUBIR = ("drive_upload", "drive_upload_from_url", "drive_create_file", "drive_create_permission",
                      "GOOGLEDRIVE_UPLOAD_FROM_URL", "GOOGLEDRIVE_CREATE_PERMISSION",
                      "GOOGLEDRIVE_CREATE_FOLDER", "GOOGLEDRIVE_CREATE_FILE_FROM_TEXT")


def test_agente_no_puede_subir_a_drive_aunque_drive_sea_conectable():
    gw = _GatewayEspia()
    ejecutar = tool_catalog.make_tool_executor(gw, now_iso_provider=lambda: "2026-11-03T12:00:00+00:00")
    ofrecidas = {s["function"]["name"] for s in tool_catalog.build_tool_catalog()}
    for intento in _INTENTOS_DE_SUBIR:
        assert intento not in ofrecidas and intento not in tool_catalog.TOOL_INDEX
        res = ejecutar(intento, {"file_name": "x.pdf", "url": "https://x/y.pdf"}, object(),
                       confirmed=True, idem_key="k")
        assert res.status == "error" and "desconocida" in str(res.observation)
    assert gw.llamadas == []


def test_agente_no_puede_subir_a_drive_control_positivo(monkeypatch):
    """Si el veto se rompiera (el índice de tools expusiera una acción de Drive) el executor ya no contestaría
    «tool desconocida»: el test de arriba tiene que poder FALLAR, no pasar por vacío."""
    monkeypatch.setitem(tool_catalog.TOOL_INDEX, "drive_upload", ("service", drive, "create_file"))
    ejecutar = tool_catalog.make_tool_executor(_GatewayEspia(), now_iso_provider=lambda: "2026-11-03T12:00:00+00:00")
    try:
        res = ejecutar("drive_upload", {"name": "x"}, object(), confirmed=True, idem_key="k")
        llego = "desconocida" not in str(res.observation)
    except Exception:   # noqa: BLE001 — llegó a algo más profundo que el índice
        llego = True
    assert llego
