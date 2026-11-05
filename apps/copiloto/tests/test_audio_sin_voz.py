"""Defensa B: descarte de audio sin voz ANTES del STT (Whisper alucina «Gracias.» ante silencio — medido 2026-11-05).

Caso HOSTIL (silencio puro / ruido estacionario → 422 y el STT NO se llama) + CONTROL POSITIVO (voz → sigue
transcribiendo: si no, el guard está fail-closed de más y rompe el dictado, el modo de falla espejo).

La «voz» de estos tests es SINTÉTICA (portadora de ruido modulada a 4 Hz con pausas, como la envolvente silábica):
prueba el criterio, no el STT. La voz real (TTS SAPI) se ejercita en el E2E contra prod
(`scripts/e2e_silencio_stt.py`). Necesita `ffmpeg` (está en el VPS); sin él se saltea, y el test de fail-open lo cubre.
"""
from __future__ import annotations

import io
import math
import random
import shutil
import struct
import wave

import pytest
from fastapi.testclient import TestClient

import audio_sin_voz
import web as web_module
from test_audio import (_WEBM_HEADER, _build_app, _mp_fernet_key_env,  # noqa: F401 — fixture autouse
                        _require_tenant_fixed)

N = 16000 * 5
requiere_ffmpeg = pytest.mark.skipif(shutil.which("ffmpeg") is None, reason="ffmpeg no está en esta máquina")


def _wav(muestra) -> bytes:
    b = io.BytesIO()
    with wave.open(b, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(16000)
        w.writeframes(b"".join(struct.pack("<h", max(-32768, min(32767, int(muestra(i))))) for i in range(N)))
    return b.getvalue()


def _silencio():
    return _wav(lambda i: 0)


def _hiss():
    r = random.Random(1)
    return _wav(lambda i: r.gauss(0, 100))


def _tono():
    return _wav(lambda i: 3000 * math.sin(2 * math.pi * 440 * i / 16000))


def _voz_sintetica():
    r = random.Random(2)
    # sílabas a 4 Hz con pausas: el 40 % de cada ciclo está en silencio de sala (σ=60) y el resto es «habla» (σ≈3000)
    def m(i):
        fase = (i / 16000 * 4) % 1.0
        return r.gauss(0, 3000 * math.sin(math.pi * fase / 0.6)) if fase < 0.6 else r.gauss(0, 60)
    return _wav(m)


# --- el criterio puro ---------------------------------------------------------------------------------------------

def _pcm(wav_bytes: bytes) -> bytes:
    with wave.open(io.BytesIO(wav_bytes)) as w:
        return w.readframes(w.getnframes())


@pytest.mark.parametrize("nombre,clip,motivo", [
    ("silencio", _silencio, "silencio"),
    ("hiss", _hiss, "ruido_estacionario"),
    ("tono", _tono, "ruido_estacionario"),
])
def test_HOSTIL_el_criterio_descarta_lo_que_no_es_voz(nombre, clip, motivo):
    assert audio_sin_voz.motivo_sin_voz(audio_sin_voz.medir_pcm(_pcm(clip()))) == motivo


def test_CONTROL_POSITIVO_el_criterio_deja_pasar_la_voz():
    m = audio_sin_voz.medir_pcm(_pcm(_voz_sintetica()))
    assert audio_sin_voz.motivo_sin_voz(m) is None, m


def test_clip_demasiado_corto_no_se_mide():
    assert audio_sin_voz.medir_pcm(b"\x00\x00" * 100) is None


# --- por el endpoint real (default de producción: `_default_transcribe`), sin red ---------------------------------

class _STTSpy:
    def __init__(self, texto="compré nafta"):
        self.texto, self.llamadas = texto, 0

    def transcribe(self, audio_bytes, *, filename="audio.ogg", content_type="audio/ogg"):
        self.llamadas += 1
        return self.texto


@pytest.fixture
def spy(monkeypatch):
    s = _STTSpy()
    monkeypatch.setattr(web_module, "build_stt", lambda: s)
    for v in ("STT_GUARD_ENERGIA", "STT_RMS_MIN", "STT_DINAMICA_MIN"):
        monkeypatch.delenv(v, raising=False)
    return s


def _post(wav: bytes):
    app = _build_app(require_tenant=_require_tenant_fixed("cid-A"))      # transcribe=None → default de producción
    return TestClient(app).post("/transcribir", data={"contexto": "factura"},
                                files={"audio": ("clip.wav", wav, "audio/wav")})


@requiere_ffmpeg
@pytest.mark.parametrize("clip", [_silencio, _hiss, _tono], ids=["silencio", "hiss", "tono"])
def test_HOSTIL_endpoint_sin_voz_da_422_y_NO_llama_al_STT(spy, clip):
    r = _post(clip())
    assert r.status_code == 422 and r.json()["detail"] == "no se entendió el audio"
    assert spy.llamadas == 0, "se pagó (y se confió en) el STT con un clip sin voz"


@requiere_ffmpeg
def test_CONTROL_POSITIVO_endpoint_con_voz_sigue_transcribiendo(spy):
    r = _post(_voz_sintetica())
    assert r.status_code == 200 and r.json() == {"transcript": "compré nafta"}
    assert spy.llamadas == 1


@requiere_ffmpeg
def test_kill_switch_por_env_deja_pasar_el_silencio(spy, monkeypatch):
    """Rollback sin deploy: `STT_GUARD_ENERGIA=0` apaga B (queda la defensa A en el proveedor)."""
    monkeypatch.setenv("STT_GUARD_ENERGIA", "0")
    assert _post(_silencio()).status_code == 200 and spy.llamadas == 1


@requiere_ffmpeg
def test_umbral_por_env_se_lee_en_cada_llamada(spy, monkeypatch):
    monkeypatch.setenv("STT_DINAMICA_MIN", "0")
    monkeypatch.setenv("STT_RMS_MIN", "0")
    assert _post(_hiss()).status_code == 200 and spy.llamadas == 1


def test_FAIL_OPEN_audio_que_no_se_puede_medir_decide_el_STT(spy):
    """Magic bytes válidos pero contenido ilegible para ffmpeg: no se rechaza (sería el modo de falla espejo)."""
    app = _build_app(require_tenant=_require_tenant_fixed("cid-A"))
    r = TestClient(app).post("/transcribir", files={"audio": ("c.webm", _WEBM_HEADER + b"fake", "audio/webm")})
    assert r.status_code == 200 and spy.llamadas == 1


def test_fail_open_no_es_silencioso(spy, caplog):
    import logging
    with caplog.at_level(logging.WARNING, logger="audio_sin_voz"):
        assert audio_sin_voz.hay_voz(_WEBM_HEADER + b"fake", "audio/webm") is True
    assert "audio_sin_voz_no_medible" in caplog.text
