"""Defensa A: `verbose_json` + descarte por `no_speech_prob` (Whisper alucina «Gracias.» ante silencio — medido 2026-11-05).

Las respuestas fake reproducen la FORMA REAL medida en prod el 2026-11-05 (Groq y OpenRouter, mismo clip de silencio):
Groq → `{"text": " Gracias.", "segments": [{"no_speech_prob": 0.701, ...}]}`; voz real → `no_speech_prob` 0.003.
"""
import io
import json

import pytest

from clients.agent.providers import stt
from clients.agent.providers.stt import GroqSTT, OpenRouterSTT, _texto_si_hay_voz


class _Resp(io.BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, *a):
        self.close()


def _seg(texto, p):
    return {"text": texto, "no_speech_prob": p, "avg_logprob": -0.3, "compression_ratio": 0.5}


SILENCIO_GROQ = {"text": " Gracias.", "segments": [_seg(" Gracias.", 0.701)]}        # medido
VOZ_GROQ = {"text": " Factúrale a clientes un servicio por 5.000 pesos.", "segments": [_seg(" Factúrale…", 0.003)]}  # medido


@pytest.fixture(autouse=True)
def _env_limpio(monkeypatch):
    monkeypatch.delenv("STT_NO_SPEECH_MAX", raising=False)
    monkeypatch.setenv("GROQ_API_KEY", "k")
    monkeypatch.setenv("OPENROUTER_API_KEY", "k-or")


def test_HOSTIL_silencio_con_texto_alucinado_se_descarta():
    assert _texto_si_hay_voz(SILENCIO_GROQ) == ""


def test_CONTROL_POSITIVO_voz_real_sigue_transcribiendo():
    """Sin esto el guard podría estar fail-closed de más (rechazar todo) y ningún test lo notaría."""
    assert _texto_si_hay_voz(VOZ_GROQ) == "Factúrale a clientes un servicio por 5.000 pesos."


def test_un_segmento_con_voz_alcanza_para_conservar_el_texto():
    d = {"text": " ruido y después hablo", "segments": [_seg(" ruido", 0.9), _seg(" después hablo", 0.01)]}
    assert _texto_si_hay_voz(d) == "ruido y después hablo"


def test_sin_segments_o_sin_el_campo_decide_el_texto():
    assert _texto_si_hay_voz({"text": " hola "}) == "hola"
    assert _texto_si_hay_voz({"text": " hola ", "segments": [{"text": "hola"}]}) == "hola"


def test_umbral_por_env_y_fuera_de_rango_desactiva(monkeypatch):
    monkeypatch.setenv("STT_NO_SPEECH_MAX", "0.8")
    assert _texto_si_hay_voz(SILENCIO_GROQ) == "Gracias."          # 0.701 < 0.8: ya no se descarta
    monkeypatch.setenv("STT_NO_SPEECH_MAX", "0")
    assert _texto_si_hay_voz(SILENCIO_GROQ) == "Gracias."          # 0 = desactivado
    monkeypatch.setenv("STT_NO_SPEECH_MAX", "basura")
    assert _texto_si_hay_voz(SILENCIO_GROQ) == ""                  # env inválido → default 0.6


def test_groq_pide_verbose_json_y_descarta_el_silencio(monkeypatch):
    visto = {}

    def fake_urlopen(req, timeout=None):
        visto["body"] = req.data
        return _Resp(json.dumps(SILENCIO_GROQ).encode())

    monkeypatch.setattr(stt.urllib.request, "urlopen", fake_urlopen)
    assert GroqSTT().transcribe(b"x") == ""
    assert b'name="response_format"\r\n\r\nverbose_json' in visto["body"]


def test_openrouter_pide_verbose_json_y_descarta_el_silencio(monkeypatch):
    visto = {}

    def fake_urlopen(req, timeout=None):
        visto["body"] = json.loads(req.data.decode())
        return _Resp(json.dumps({"text": " Gracias.", "segments": [_seg(" Gracias.", 1)], "usage": {}}).encode())

    monkeypatch.setattr(stt.urllib.request, "urlopen", fake_urlopen)
    assert OpenRouterSTT().transcribe(b"x", filename="a.wav", content_type="audio/wav") == ""
    assert visto["body"]["response_format"] == "verbose_json"
