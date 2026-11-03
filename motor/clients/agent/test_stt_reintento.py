"""GroqSTT: reintento SÓLO ante 429 (rate limit de Groq), con `retry-after` y tope; el resto de errores propaga."""
import io
import json
import urllib.error

import pytest

from clients.agent.providers import stt
from clients.agent.providers.stt import GroqSTT


class _Resp(io.BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, *a):
        self.close()


def _http(code, retry_after=None):
    h = {"retry-after": retry_after} if retry_after is not None else {}
    return urllib.error.HTTPError("http://x", code, "err", h, io.BytesIO(b"{}"))


def _stt(monkeypatch, secuencia):
    """`secuencia`: lista de respuestas — un dict (200) o una HTTPError que se lanza. Devuelve (stt, esperas, llamadas)."""
    monkeypatch.setenv("GROQ_API_KEY", "k")
    esperas, llamadas = [], []

    def fake_urlopen(req, timeout=None):
        llamadas.append(1)
        r = secuencia[len(llamadas) - 1]
        if isinstance(r, Exception):
            raise r
        return _Resp(json.dumps(r).encode())

    monkeypatch.setattr(stt.urllib.request, "urlopen", fake_urlopen)
    monkeypatch.setattr(stt.time, "sleep", lambda s: esperas.append(s))
    return GroqSTT(), esperas, llamadas


def test_429_y_despues_ok_reintenta_respetando_retry_after(monkeypatch):
    g, esperas, llamadas = _stt(monkeypatch, [_http(429, "3"), {"text": " hola "}])
    assert g.transcribe(b"x") == "hola"
    assert len(llamadas) == 2 and len(esperas) == 1 and 3 <= esperas[0] <= 3.5


def test_429_persistente_agota_los_reintentos_y_propaga(monkeypatch):
    g, esperas, llamadas = _stt(monkeypatch, [_http(429, "1")] * 3)
    with pytest.raises(urllib.error.HTTPError) as ei:
        g.transcribe(b"x")
    assert ei.value.code == 429 and len(llamadas) == 3 and len(esperas) == 2     # 1 intento + 2 reintentos


def test_retry_after_enorme_se_acota(monkeypatch):
    g, esperas, _ = _stt(monkeypatch, [_http(429, "900"), {"text": "ok"}])
    g.transcribe(b"x")
    assert esperas[0] <= 5.5


def test_otros_errores_NO_se_reintentan(monkeypatch):
    g, esperas, llamadas = _stt(monkeypatch, [_http(500), {"text": "no debería llegar"}])
    with pytest.raises(urllib.error.HTTPError) as ei:
        g.transcribe(b"x")
    assert ei.value.code == 500 and len(llamadas) == 1 and esperas == []
