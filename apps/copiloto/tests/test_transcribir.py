"""K-10 (BL-J7): `POST /transcribir` — transcribe SIN despachar al agente (voz dentro de las funciones).

Mismo montaje que `test_audio.py`. El punto de la junta: el endpoint no toca Temporal ni el historial del chat
(`route_inbound` explota si se lo llama), y comparte la validación con `/chat/audio` (una sola definición).
"""
from __future__ import annotations

import urllib.error

import pytest
from fastapi.testclient import TestClient

import web as web_module
from test_audio import (_WEBM_HEADER, _build_app, _mp_fernet_key_env,  # noqa: F401 — fixture autouse
                        _require_tenant_401, _require_tenant_fixed)


@pytest.fixture(autouse=True)
def _sin_workflow(monkeypatch):
    async def _boom(*a, **k):
        raise AssertionError("/transcribir no puede despachar al agente (route_inbound)")
    monkeypatch.setattr(web_module, "route_inbound", _boom)


def _post(app, *, audio_bytes=_WEBM_HEADER + b"fake", content_type="audio/webm", data=None):
    return TestClient(app).post("/transcribir", data=data or {},
                                files={"audio": ("clip.webm", audio_bytes, content_type)})


def test_200_devuelve_solo_el_transcript_sin_workflow():
    app = _build_app(require_tenant=_require_tenant_fixed("cid-A"),
                     transcribe=lambda b, ct: "  compré cuarenta litros de nafta  ")
    r = _post(app, data={"contexto": "gasto"})
    assert r.status_code == 200 and r.json() == {"transcript": "compré cuarenta litros de nafta"}


def test_contexto_es_opcional_y_uno_desconocido_se_ignora_sin_422():
    app = _build_app(require_tenant=_require_tenant_fixed("cid-A"), transcribe=lambda b, ct: "hola")
    assert _post(app).status_code == 200
    assert _post(app, data={"contexto": "cualquier-cosa"}).json() == {"transcript": "hola"}


def test_sin_token_401_y_no_transcribe():
    llamadas = []
    app = _build_app(require_tenant=_require_tenant_401(), transcribe=lambda b, ct: llamadas.append(1) or "x")
    assert _post(app).status_code == 401 and llamadas == []


def test_ADVERSARIAL_cada_token_transcribe_lo_suyo_y_nada_del_tenant_viaja_al_stt():
    """Sin sesión ni estado: el resultado depende SÓLO del audio del request; el tenant no entra al STT ni
    al cuerpo, así que un token no puede leer/afectar nada de otro."""
    vistos = []
    def _t(b, ct):
        vistos.append((b, ct))
        return "texto:" + b.decode("latin-1")[-3:]
    ra = _post(_build_app(require_tenant=_require_tenant_fixed("cid-A"), transcribe=_t), audio_bytes=_WEBM_HEADER + b"AAA")
    rb = _post(_build_app(require_tenant=_require_tenant_fixed("cid-B"), transcribe=_t), audio_bytes=_WEBM_HEADER + b"BBB")
    assert ra.json() == {"transcript": "texto:AAA"} and rb.json() == {"transcript": "texto:BBB"}
    assert all(set(v) == {"transcript"} for v in (ra.json(), rb.json()))
    assert [ct for _, ct in vistos] == ["audio/webm", "audio/webm"]


def test_413_audio_demasiado_grande(monkeypatch):
    monkeypatch.setattr(web_module, "MAX_AUDIO_BYTES", 5)
    llamadas = []
    app = _build_app(require_tenant=_require_tenant_fixed("cid-A"), transcribe=lambda b, ct: llamadas.append(1) or "x")
    assert _post(app, audio_bytes=b"esto-supera-los-cinco-bytes").status_code == 413 and llamadas == []


def test_415_magic_bytes_no_coinciden():
    llamadas = []
    app = _build_app(require_tenant=_require_tenant_fixed("cid-A"), transcribe=lambda b, ct: llamadas.append(1) or "x")
    assert _post(app, audio_bytes=b"\xff\xd8\xffno-es-un-webm").status_code == 415 and llamadas == []


@pytest.mark.parametrize("vacio", ["", "   "])
def test_422_audio_valido_pero_mudo(vacio):
    app = _build_app(require_tenant=_require_tenant_fixed("cid-A"), transcribe=lambda b, ct: vacio)
    r = _post(app)
    assert r.status_code == 422 and r.json()["detail"] == "no se entendió el audio"


def test_502_falla_el_servicio_de_transcripcion():
    def _falla(b, ct):
        raise urllib.error.URLError("caído")
    assert _post(_build_app(require_tenant=_require_tenant_fixed("cid-A"), transcribe=_falla)).status_code == 502


def test_503_voz_no_configurada(monkeypatch):
    monkeypatch.delenv("GROQ_API_KEY", raising=False)
    assert _post(_build_app(require_tenant=_require_tenant_fixed("cid-A"))).status_code == 503


def test_una_sola_definicion_de_la_validacion_de_audio():
    """Control del DoD 4: los dos endpoints llaman al mismo helper (no hay una segunda copia del tope/magic bytes
    en /chat/audio ni en /transcribir)."""
    from pathlib import Path
    fuente = Path(web_module.__file__).read_text(encoding="utf-8")
    assert fuente.count("await _transcribir_audio(audio)") == 2
    assert fuente.count("async def _transcribir_audio") == 1
