import os
import sys
from pathlib import Path

import pytest


from clients.agent.providers import composio_gateway as cg
import calendar_policy as cp

CALENDAR_POLICY = cp.CALENDAR_POLICY
CREATE_EVENT_SLUG = cp.CREATE_EVENT_SLUG
FIND_EVENT_SLUG = cp.FIND_EVENT_SLUG


class _FakeTools:
    def __init__(self, sink): self.sink = sink
    def execute(self, slug, *, user_id, arguments, version):
        self.sink.append({"slug": slug, "user_id": user_id, "arguments": arguments, "version": version})
        return {"successful": True, "data": {"id": "evt_123"}}


class _FakeClient:
    def __init__(self, sink): self.tools = _FakeTools(sink)


def _gw(sink):
    return cg.ComposioGateway(CALENDAR_POLICY, client_factory=lambda: _FakeClient(sink))


def test_write_sin_confirmed_rechaza():
    with pytest.raises(cg.ConfirmationRequired):
        _gw([]).execute(CREATE_EVENT_SLUG, user_id="u1", arguments={}, confirmed=False)


def test_write_con_confirmed_llega_al_sdk():
    sink = []
    out = _gw(sink).execute(CREATE_EVENT_SLUG, user_id="u1", arguments={"summary": "X"}, confirmed=True)
    assert out["successful"] is True
    assert sink[0]["version"] == CALENDAR_POLICY["googlecalendar"].version   # version pineada llega
    assert sink[0]["slug"] == CREATE_EVENT_SLUG


def test_slug_fuera_de_policy_rechaza():
    with pytest.raises(cg.ToolNotAllowed):
        _gw([]).execute("GOOGLECALENDAR_DELETE_EVENT", user_id="u1", arguments={}, confirmed=True)


def test_denylist_gana():
    with pytest.raises(cg.MetaToolBlocked):
        _gw([]).execute("COMPOSIO_REMOTE_BASH_TOOL", user_id="u1", arguments={}, confirmed=True)


@pytest.mark.skipif(not os.environ.get("COMPOSIO_API_KEY"), reason="sin COMPOSIO_API_KEY")
def test_slugs_existen_en_composio_real():
    """De-risk REAL del slug: consulta el CATÁLOGO de Composio. `allowed_tools` NO sirve para esto (solo
    refleja la policy local — sería circular). `get_raw_composio_tool_by_slug` devuelve None / lanza si el
    slug no existe en Composio. No requiere conexión de usuario (es el catálogo, no una cuenta conectada)."""
    from composio import Composio
    c = Composio()                                   # toma COMPOSIO_API_KEY del env
    for slug in (CREATE_EVENT_SLUG, FIND_EVENT_SLUG):
        tool = c.tools.get_raw_composio_tool_by_slug(slug)
        assert tool is not None, f"slug {slug} no existe en el catálogo de Composio"


@pytest.mark.skipif(not os.environ.get("COMPOSIO_API_KEY"), reason="sin COMPOSIO_API_KEY")
def test_version_pineada_existe_real():
    """De-risk REAL de la VERSION (no solo del slug). La version pineada DEBE estar en available_versions del
    toolkit; una version inexistente NO falla el de-risk del slug pero da 404 Tool_ToolNotFound al EJECUTAR
    (es lo que rompió el primer E2E). Cierra ese gap: una version inventada se caza acá, no en runtime."""
    from composio import Composio
    c = Composio()
    tk = c.toolkits.get("googlecalendar")
    available = list(getattr(tk.meta, "available_versions", []) or [])
    assert cp.CALENDAR_VERSION in available, (
        f"CALENDAR_VERSION={cp.CALENDAR_VERSION} no está en available_versions "
        f"(actual del toolkit={getattr(tk.meta, 'version', '?')}); primeras disponibles: {available[:5]}")

# Nota: la regresión del plano de conexión (toolkit como objeto, endpoint link, unwrap de items vacío) vive
# en deploy/skeleton_kit/tests/test_composio_gateway.py — es comportamiento del gateway-plantilla, no de la
# policy de Calendar. Acá solo lo específico de Calendar: slugs y version pineada contra Composio real.
