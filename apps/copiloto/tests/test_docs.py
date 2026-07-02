"""Docs — unit (ruteo) + E2E REAL (crea un documento y lee su texto de vuelta). Corre EN EL VPS."""
import os
import re
import sys
import time
import uuid
from pathlib import Path

ARCH = Path(__file__).resolve().parents[3] / "deploy/skeleton_kit/archetypes/conversational_agent/reference"
sys.path.insert(0, str(ARCH))
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest
from backend.agent.types import Intent
import dispatcher_emprendedor as de
from services.docs import CREATE_SLUG, READ_SLUG, build


class _GatewaySpy:
    def __init__(self, ret=None):
        self.calls = []
        self._ret = ret or {"successful": True, "data": {}}

    def execute(self, slug, *, user_id, arguments, confirmed):
        self.calls.append({"slug": slug, "arguments": arguments, "confirmed": confirmed})
        return self._ret


def _disp(gw):
    return de.make_dispatcher(gw, composio_user_id="u1", now_iso_provider=lambda: "2026-07-02T10:00:00-03:00")


def test_create_doc_propone():
    gw = _GatewaySpy()
    r = _disp(gw)(Intent(action="tool_action", entities={"service": "docs", "op": "create_doc",
                  "title": "T", "content": "# hola"}), {}, None)
    assert gw.calls == []
    p = r.state_patch["pending"]
    assert p["slug"] == CREATE_SLUG and p["arguments"] == {"title": "T", "markdown_text": "# hola"}


def test_read_doc_es_lectura_directa():
    gw = _GatewaySpy(ret={"successful": True, "data": {"plaintext": "hola"}})
    r = _disp(gw)(Intent(action="tool_action", entities={"service": "docs", "op": "read_doc", "document_id": "d1"}), {}, None)
    assert gw.calls[0]["slug"] == READ_SLUG and gw.calls[0]["confirmed"] is False
    assert "hola" in r.reply_text


@pytest.mark.skipif(not (os.environ.get("COMPOSIO_API_KEY") and os.environ.get("COPILOTO_COMPOSIO_USER_ID")),
                    reason="real: requiere COMPOSIO_API_KEY + COPILOTO_COMPOSIO_USER_ID (VPS)")
def test_create_doc_real_y_readback():
    sys.path.insert(0, str(ARCH / "clients/agent/providers"))
    from composio_gateway import ComposioGateway
    import services
    user = os.environ["COPILOTO_COMPOSIO_USER_ID"]
    gw = ComposioGateway(services.merged_policy())
    rid = uuid.uuid4().hex[:8]
    title = f"Copiloto Doc {rid}"

    prop = build("create_doc", {"title": title, "content": f"Documento de prueba del Copiloto. Marcador {rid}."})
    res = gw.execute(prop.slug, user_id=user, arguments=prop.arguments, confirmed=True)
    assert res.get("successful") is True, f"CREATE_DOC falló: {res}"

    m = re.search(r"[\"'](?:document_?[iI]d|documentId|id)[\"']\s*:\s*[\"']([A-Za-z0-9_\-]{15,})[\"']", str(res))
    assert m, f"no pude extraer el document_id de la respuesta: {str(res)[:400]}"
    doc_id = m.group(1)

    found = False
    for _ in range(15):
        rd = gw.execute(READ_SLUG, user_id=user, arguments={"document_id": doc_id}, confirmed=False)
        if rid in str(rd):
            found = True
            break
        time.sleep(1)
    assert found, f"no leí el marcador {rid} en el documento {doc_id}"
