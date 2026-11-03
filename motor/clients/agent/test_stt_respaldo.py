"""OpenRouterSTT + STTConRespaldo + build_stt: el respaldo entra SÓLO ante fallas recuperables del primario."""
import base64
import io
import json
import urllib.error

import pytest

from clients.agent.providers import stt
from clients.agent.providers.stt import GroqSTT, OpenRouterSTT, STTConRespaldo, build_stt


class _Resp(io.BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, *a):
        self.close()


def _http(code):
    return urllib.error.HTTPError("http://x", code, "err", {}, io.BytesIO(b"{}"))


class _Fake:
    def __init__(self, resultado):
        self.resultado, self.llamadas = resultado, 0

    def transcribe(self, audio_bytes, *, filename="audio.ogg", content_type="audio/ogg"):
        self.llamadas += 1
        if isinstance(self.resultado, Exception):
            raise self.resultado
        return self.resultado


@pytest.mark.parametrize("err", [_http(429), _http(500), _http(503), urllib.error.URLError("dns"), TimeoutError(), ConnectionError()])
def test_falla_recuperable_del_primario_usa_el_respaldo(err):
    p, r = _Fake(err), _Fake("del respaldo")
    assert STTConRespaldo(p, r).transcribe(b"x") == "del respaldo"
    assert (p.llamadas, r.llamadas) == (1, 1)


@pytest.mark.parametrize("err", [_http(400), _http(401), _http(413), RuntimeError("falta GROQ_API_KEY"), ValueError("x")])
def test_ADVERSARIAL_error_no_recuperable_NO_activa_el_respaldo(err):
    """Audio inválido, key rechazada o config rota: el respaldo no lo arregla y taparlo esconde el bug."""
    p, r = _Fake(err), _Fake("no debería llegar")
    with pytest.raises(type(err)):
        STTConRespaldo(p, r).transcribe(b"x")
    assert r.llamadas == 0


def test_si_el_respaldo_tambien_falla_propaga_el_error_del_respaldo():
    p, r = _Fake(_http(429)), _Fake(_http(503))
    with pytest.raises(urllib.error.HTTPError) as ei:
        STTConRespaldo(p, r).transcribe(b"x")
    assert ei.value.code == 503


def test_primario_ok_no_toca_el_respaldo():
    p, r = _Fake("ok"), _Fake("no")
    assert STTConRespaldo(p, r).transcribe(b"x") == "ok" and r.llamadas == 0


def test_openrouter_arma_el_request_json_base64(monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", "k-or")
    visto = {}

    def fake(req, timeout=None):
        visto["url"], visto["auth"], visto["ct"] = req.full_url, req.get_header("Authorization"), req.get_header("Content-type")
        visto["body"] = json.loads(req.data.decode())
        return _Resp(json.dumps({"text": " hola ", "usage": {"seconds": 2}}).encode())

    monkeypatch.setattr(stt.urllib.request, "urlopen", fake)
    assert OpenRouterSTT().transcribe(b"AUDIO", filename="audio.ogg", content_type="audio/ogg") == "hola"
    assert visto["url"] == stt.OPENROUTER_STT_URL and visto["auth"] == "Bearer k-or" and visto["ct"] == "application/json"
    b = visto["body"]
    assert b["model"] == "openai/whisper-large-v3-turbo" and b["language"] == "es"
    assert b["input_audio"] == {"data": base64.b64encode(b"AUDIO").decode(), "format": "ogg"}   # base64 CRUDO, sin data-URI


def test_openrouter_sin_key_o_formato_raro_lanza(monkeypatch):
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)
    with pytest.raises(RuntimeError):
        OpenRouterSTT().transcribe(b"x")
    monkeypatch.setenv("OPENROUTER_API_KEY", "k")
    with pytest.raises(ValueError):
        OpenRouterSTT().transcribe(b"x", filename="a.xyz", content_type="application/octet-stream")


def test_build_stt_orden_segun_env(monkeypatch):
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)
    assert isinstance(build_stt(), GroqSTT)                      # sin key de OpenRouter: sólo Groq (con su reintento de 429)
    monkeypatch.setenv("OPENROUTER_API_KEY", "k")
    monkeypatch.delenv("STT_PRIMARIO", raising=False)
    s = build_stt()                                              # default con las dos keys: OpenRouter primario
    assert isinstance(s.primario, OpenRouterSTT) and isinstance(s.respaldo, GroqSTT)
    assert s.respaldo._reintentos_429 == 0                       # el primario no espera: cae al otro en el acto
    monkeypatch.setenv("STT_PRIMARIO", "groq")
    s = build_stt()
    assert isinstance(s.primario, GroqSTT) and isinstance(s.respaldo, OpenRouterSTT) and s.primario._reintentos_429 == 0
