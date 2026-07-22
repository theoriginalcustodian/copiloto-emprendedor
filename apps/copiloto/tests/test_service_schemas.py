"""TOOL_SCHEMAS + TOOLS + WRITE_OPS — contrato extendido del módulo de servicio (motor ReAct, Task 3+4).

Verifica: (a) gmail (referencia) declara el contrato completo con los property names EXACTOS que su build()
lee; (b) TODOS los servicios descubiertos (fan-out por directorio) exponen TOOL_SCHEMAS/TOOLS alineados y
WRITE_OPS explícito, sin excepción — un módulo que se cuele sin esto rompe el discovery test, no pasa silencioso.
"""
import sys
from pathlib import Path


import services
from services import gmail


def test_gmail_declares_schemas_and_tools():
    # Poda del hito 2: `gmail_fetch` se fue (leer correos se quitó por la auditoría de Google), así
    # que gmail queda con UNA sola tool. El test se actualiza a proposito — fijaba el inventario, y el
    # inventario cambió por decision de producto, no por un bug.
    assert gmail.TOOLS == {"gmail_send": "send"}
    names = {s["function"]["name"] for s in gmail.TOOL_SCHEMAS}
    assert names == {"gmail_send"}
    assert "gmail_fetch" not in names, "volvio a exponerse una tool podada"
    send = next(s for s in gmail.TOOL_SCHEMAS if s["function"]["name"] == "gmail_send")
    props = send["function"]["parameters"]["properties"]
    assert {"to", "subject", "body"} <= set(props)
    assert send["function"]["parameters"]["required"] == ["to", "body"]


def test_gmail_declares_write_ops():
    assert gmail.WRITE_OPS == frozenset({"send"})
    assert "fetch" not in gmail.WRITE_OPS


def test_every_discovered_service_has_schemas():
    for name, mod in services.modules().items():
        assert hasattr(mod, "TOOL_SCHEMAS"), f"{name} sin TOOL_SCHEMAS"
        assert hasattr(mod, "TOOLS"), f"{name} sin TOOLS"
        assert hasattr(mod, "WRITE_OPS"), f"{name} sin WRITE_OPS"
        # cada tool declarada mapea a un op y aparece en un schema
        schema_names = {s["function"]["name"] for s in mod.TOOL_SCHEMAS}
        assert set(mod.TOOLS) == schema_names, f"{name}: TOOLS vs TOOL_SCHEMAS desalineados"
        # cada tool_name en TOOLS respeta la convención <service>_<op>
        for tool_name, op in mod.TOOLS.items():
            assert tool_name == f"{name}_{op}", f"{name}: tool_name {tool_name!r} no sigue <service>_<op>"
        # WRITE_OPS solo referencia ops que el módulo realmente declara en TOOLS
        assert mod.WRITE_OPS <= set(mod.TOOLS.values()), f"{name}: WRITE_OPS referencia un op inexistente"


def test_every_tool_schema_is_well_formed():
    for name, mod in services.modules().items():
        for schema in mod.TOOL_SCHEMAS:
            assert schema["type"] == "function"
            fn = schema["function"]
            assert isinstance(fn.get("name"), str) and fn["name"]
            assert isinstance(fn.get("description"), str) and fn["description"]
            params = fn.get("parameters")
            assert params is not None and params.get("type") == "object"
            assert isinstance(params.get("properties"), dict)
            assert isinstance(params.get("required"), list)
            # todo required debe existir en properties
            assert set(params["required"]) <= set(params["properties"]), f"{name}.{fn['name']}: required fuera de properties"
