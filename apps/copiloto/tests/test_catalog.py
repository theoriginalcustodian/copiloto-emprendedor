"""catalog.py — lógica PURA (sin temporal/fastmcp/fastapi), Task 5 (handoff §7.7). Corre en la PC y en el VPS."""
import sys
from pathlib import Path


from catalog import build_catalog

_KNOWN_TOOLKITS = frozenset({
    "gmail", "googlecalendar", "googledrive", "googledocs", "googlesheets", "hubspot", "instagram",
})


def _by_key(services: list[dict], key: str) -> dict:
    for s in services:
        if s["key"] == key:
            return s
    raise AssertionError(f"{key!r} no está en el catálogo: {[s['key'] for s in services]}")


def test_estructura_por_servicio():
    services = build_catalog(valid_toolkits=_KNOWN_TOOLKITS, mp_connected=True, composio_connected=["gmail"])
    # mercadopago + los 7 toolkits conocidos, sin duplicados ni faltantes
    assert {s["key"] for s in services} == _KNOWN_TOOLKITS | {"mercadopago"}
    for s in services:
        for field in ("key", "display_name", "work_label", "category", "kind", "description",
                      "capabilities", "connected", "connect_path", "disconnect_path"):
            assert field in s, f"{s['key']!r} sin campo {field!r}"
        assert isinstance(s["capabilities"], list)
        assert isinstance(s["connected"], bool)


def test_mercadopago_connected_cruza_mp_connected():
    on = _by_key(build_catalog(valid_toolkits=(), mp_connected=True, composio_connected=[]), "mercadopago")
    off = _by_key(build_catalog(valid_toolkits=(), mp_connected=False, composio_connected=[]), "mercadopago")
    assert on["connected"] is True
    assert off["connected"] is False
    assert on["kind"] == "payments"
    assert on["connect_path"] == "/mp/connect"


def test_composio_connected_cruza_por_slug_no_por_posicion():
    services = build_catalog(valid_toolkits={"gmail", "hubspot"}, mp_connected=False,
                             composio_connected=["hubspot"])
    assert _by_key(services, "hubspot")["connected"] is True
    assert _by_key(services, "gmail")["connected"] is False


def test_composio_connected_vacio_o_none_no_rompe():
    services_none = build_catalog(valid_toolkits={"gmail"}, mp_connected=False, composio_connected=None)
    services_empty = build_catalog(valid_toolkits={"gmail"}, mp_connected=False, composio_connected=[])
    assert _by_key(services_none, "gmail")["connected"] is False
    assert _by_key(services_empty, "gmail")["connected"] is False


def test_toolkit_desconocido_aparece_con_defaults_y_no_rompe():
    services = build_catalog(valid_toolkits={"un_servicio_nuevo"}, mp_connected=False, composio_connected=[])
    entry = _by_key(services, "un_servicio_nuevo")
    assert entry["display_name"]  # no vacío
    assert entry["work_label"] == entry["display_name"]
    assert entry["category"] == "Otros"
    assert entry["description"]
    assert entry["capabilities"] == []
    assert entry["kind"] == "composio"
    assert entry["connect_path"] == "/composio/connect?service=un_servicio_nuevo"
    assert entry["connected"] is False


def test_work_label_y_display_name_es_ar_conocidos():
    services = build_catalog(valid_toolkits=_KNOWN_TOOLKITS, mp_connected=False, composio_connected=[])
    expected_work_label = {
        "gmail": "Mail",
        "googlecalendar": "Agenda",
        "mercadopago": "Cobrar",
        "hubspot": "Clientes",
        "googledrive": "Archivos",
        "googledocs": "Archivos",
        "googlesheets": "Archivos",
        "instagram": "Instagram",
    }
    expected_display_name = {
        "gmail": "Gmail",
        "googlecalendar": "Google Calendar",
        "mercadopago": "Mercado Pago",
        "hubspot": "HubSpot",
        "googledrive": "Google Drive",
        "googledocs": "Google Docs",
        "googlesheets": "Google Sheets",
        "instagram": "Instagram",
    }
    for key, label in expected_work_label.items():
        assert _by_key(services, key)["work_label"] == label, key
    for key, name in expected_display_name.items():
        assert _by_key(services, key)["display_name"] == name, key


def test_connect_path_por_kind():
    services = build_catalog(valid_toolkits={"gmail"}, mp_connected=True, composio_connected=[])
    assert _by_key(services, "mercadopago")["connect_path"] == "/mp/connect"
    assert _by_key(services, "gmail")["connect_path"] == "/composio/connect?service=gmail"


def test_disconnect_path_por_kind():
    """Pedido del frontend (addendum 2026-07-21): el path de desconexión lo emite el backend, igual
    que `connect_path`. La app lo usa TAL CUAL -- reconstruirlo desde la `key` se rompe justo en
    MercadoPago, que no va por Composio."""
    services = build_catalog(valid_toolkits={"gmail"}, mp_connected=True, composio_connected=[])
    assert _by_key(services, "mercadopago")["disconnect_path"] == "/mp/connection"
    assert _by_key(services, "gmail")["disconnect_path"] == "/composio/connection?service=gmail"


def test_disconnect_path_de_un_toolkit_nuevo_sale_solo():
    """Un servicio agregado en `services/<svc>.py` trae su `disconnect_path` sin tocar este módulo
    ni la app -- misma propiedad que ya tenía `connect_path`."""
    entry = _by_key(build_catalog(valid_toolkits={"un_servicio_nuevo"}, mp_connected=False,
                                  composio_connected=[]), "un_servicio_nuevo")
    assert entry["disconnect_path"] == "/composio/connection?service=un_servicio_nuevo"


def test_valid_toolkits_vacio_solo_mercadopago():
    services = build_catalog(valid_toolkits=(), mp_connected=False, composio_connected=[])
    assert [s["key"] for s in services] == ["mercadopago"]
