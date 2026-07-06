"""Instagram — unit (ruteo + chain 2-pasos con spy) + E2E REAL de LECTURA (cuenta + posts). Corre EN EL VPS.

El PUBLISH real NO se dispara: la API no tiene delete-post (post permanente en la cuenta de marca). El publish
queda validado a nivel unit (arma bien el contenedor + el chain de publish); el fire real es decisión del operador."""
import os
import sys
import uuid
from pathlib import Path


import pytest
from backend.agent.types import Intent
from _ctx_helper import make_ctx as _ctx
import dispatcher_emprendedor as de
from services.instagram import ACCOUNT_SLUG, MEDIA_SLUG, CREATE_MEDIA_SLUG, PUBLISH_SLUG, build


class _GatewaySpy:
    def __init__(self, rets=None):
        self.calls = []
        self._rets = list(rets) if rets else None

    def execute(self, slug, *, user_id, arguments, confirmed):
        self.calls.append({"slug": slug, "arguments": arguments, "confirmed": confirmed})
        if self._rets:
            return self._rets.pop(0)
        return {"successful": True, "data": {"id": "cid_123"}}


def _disp(gw):
    return de.make_dispatcher(gw, now_iso_provider=lambda: "2026-07-02T10:00:00-03:00")


def test_account_es_lectura_directa():
    gw = _GatewaySpy(rets=[{"successful": True, "data": {"username": "acme", "id": "9"}}])
    r = _disp(gw)(Intent(action="tool_action", entities={"service": "instagram", "op": "account"}), {}, _ctx(composio_user_id="u1"))
    assert gw.calls[0]["slug"] == ACCOUNT_SLUG and gw.calls[0]["confirmed"] is False
    assert "acme" in r.reply_text


def test_publish_propone_con_chain():
    gw = _GatewaySpy()
    r = _disp(gw)(Intent(action="tool_action", entities={"service": "instagram", "op": "publish",
                  "ig_user_id": "9", "image_url": "https://x/y.jpg", "caption": "hola"}), {}, _ctx(composio_user_id="u1"))
    assert gw.calls == []                                              # HITL: no publica todavía
    p = r.state_patch["pending"]
    assert p["slug"] == CREATE_MEDIA_SLUG
    assert p["arguments"] == {"ig_user_id": "9", "image_url": "https://x/y.jpg", "caption": "hola"}
    assert p["then"]["slug"] == PUBLISH_SLUG and p["then"]["id_arg"] == "creation_id"


def test_confirm_ejecuta_chain_2pasos():
    # paso1 (contenedor) -> {id: cid_123}; paso2 (publish) recibe creation_id=cid_123
    gw = _GatewaySpy(rets=[{"successful": True, "data": {"id": "cid_123"}}, {"successful": True, "data": {}}])
    pending = {"slug": CREATE_MEDIA_SLUG, "arguments": {"ig_user_id": "9", "image_url": "u", "caption": "c"},
               "then": {"slug": PUBLISH_SLUG, "id_key": "id", "id_arg": "creation_id", "arguments": {"ig_user_id": "9"}},
               "ok_text": "Listo, lo publiqué en Instagram ✅"}
    r = _disp(gw)(Intent(action="callback", entities={"value": "confirm"}), {"pending": pending}, _ctx(composio_user_id="u1"))
    assert len(gw.calls) == 2
    assert gw.calls[0]["slug"] == CREATE_MEDIA_SLUG and gw.calls[0]["confirmed"] is True
    assert gw.calls[1]["slug"] == PUBLISH_SLUG and gw.calls[1]["arguments"]["creation_id"] == "cid_123"
    assert r.done is True and "✅" in r.reply_text


def test_publish_sin_image_url_pide_mas():
    gw = _GatewaySpy()
    r = _disp(gw)(Intent(action="tool_action", entities={"service": "instagram", "op": "publish", "ig_user_id": "9"}), {}, _ctx(composio_user_id="u1"))
    assert gw.calls == [] and not r.state_patch.get("pending")          # falta image_url -> no propone


@pytest.mark.skipif(not (os.environ.get("COMPOSIO_API_KEY") and os.environ.get("COPILOTO_COMPOSIO_USER_ID")),
                    reason="real: requiere COMPOSIO_API_KEY + COPILOTO_COMPOSIO_USER_ID (VPS)")
def test_read_account_y_media_real():
    """E2E REAL de LECTURA: cuenta (GET_USER_INFO) + posts (GET_IG_USER_MEDIA). NO publica (post permanente)."""
    from composio_gateway import ComposioGateway
    import services
    user = os.environ["COPILOTO_COMPOSIO_USER_ID"]
    gw = ComposioGateway(services.merged_policy())

    acc = gw.execute(ACCOUNT_SLUG, user_id=user, arguments={}, confirmed=False)
    assert acc.get("successful") is True, f"GET_USER_INFO falló: {acc}"
    ig_id = (acc.get("data") or {}).get("id")
    assert ig_id, f"sin ig_user_id en la respuesta: {acc}"

    media = gw.execute(MEDIA_SLUG, user_id=user, arguments={"ig_user_id": ig_id, "limit": 3}, confirmed=False)
    assert media.get("successful") is True, f"GET_IG_USER_MEDIA falló: {media}"
