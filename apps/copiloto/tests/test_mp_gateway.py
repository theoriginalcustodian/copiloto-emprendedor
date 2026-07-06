import sys, time, hmac, hashlib
from pathlib import Path
import pytest

from clients.agent.providers.mercadopago_gateway import (  # noqa: E402
    MercadoPagoGateway, MercadoPagoAuthError, TOKEN_URL, API)


class _Resp:
    def __init__(self, status_code, payload): self.status_code = status_code; self._p = payload
    def json(self): return self._p


class _FakeHttp:
    def __init__(self, posts=None, gets=None): self._posts = posts or {}; self._gets = gets or {}
    def post(self, url, json=None, headers=None): return self._posts[url]
    def get(self, url, headers=None, params=None): return self._gets[url]


@pytest.fixture(autouse=True)
def _env(monkeypatch):
    monkeypatch.setenv("MP_CLIENT_ID", "8344"); monkeypatch.setenv("MP_CLIENT_SECRET", "sec")
    monkeypatch.setenv("MP_REDIRECT_URI", "https://mp.example/callback")
    monkeypatch.setenv("MP_WEBHOOK_SECRET", "whsec")


def test_connect_url_has_client_id_and_state():
    gw = MercadoPagoGateway(http_factory=lambda: _FakeHttp())
    url = gw.connect_url("st8")
    assert "client_id=8344" in url and "state=st8" in url and "response_type=code" in url


def test_exchange_code_normalizes_tokens():
    fake = _FakeHttp(posts={TOKEN_URL: _Resp(200, {
        "access_token": "AT", "refresh_token": "RT", "expires_in": 15552000, "user_id": 146, "live_mode": True})})
    gw = MercadoPagoGateway(http_factory=lambda: fake)
    tok = gw.exchange_code("code-1")
    assert tok["access_token"] == "AT" and tok["refresh_token"] == "RT" and tok["expires_in"] == 15552000


def test_exchange_code_fails_closed_on_error():
    gw = MercadoPagoGateway(http_factory=lambda: _FakeHttp(posts={TOKEN_URL: _Resp(400, {"error": "invalid"})}))
    with pytest.raises(MercadoPagoAuthError):
        gw.exchange_code("bad")


def test_create_payment_link_returns_init_point():
    url = f"{API}/checkout/preferences"
    fake = _FakeHttp(posts={url: _Resp(201, {"id": "pref-1", "init_point": "https://mp/redirect?pref_id=pref-1"})})
    gw = MercadoPagoGateway(http_factory=lambda: fake)
    out = gw.create_payment_link("AT", amount=150, external_reference="ext-1",
                                 notification_url="https://mp.example/mp/webhook")
    assert out["init_point"].endswith("pref-1") and out["external_reference"] == "ext-1"


def test_verify_webhook_accepts_valid_rejects_tampered():
    """Firma real vía SDK: firmamos con hmac stdlib (formato leído del SDK) y el gateway valida con el SDK."""
    gw = MercadoPagoGateway(http_factory=lambda: _FakeHttp())
    data_id, rid, ts = "123456", "req-1", str(int(time.time() * 1000))
    manifest = f"id:{data_id};request-id:{rid};ts:{ts};"
    v1 = hmac.new(b"whsec", manifest.encode(), hashlib.sha256).hexdigest()
    assert gw.verify_webhook(f"ts={ts},v1={v1}", rid, data_id) is True
    assert gw.verify_webhook(f"ts={ts},v1={'0'*64}", rid, data_id) is False
