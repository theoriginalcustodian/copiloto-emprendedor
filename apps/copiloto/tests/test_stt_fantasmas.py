"""SM-STT-FANTASMA: el STT devuelve frases FANTASMA conocidas cuando el mic sólo captó ruido; se cortan por TEXTO.

Filtro ESPECÍFICO (lista corta de salidas observadas, comparación por frase COMPLETA normalizada), no un
discriminador sobre la señal (el spike de `avg_logprob` lo refutó: «Sí» sale peor que el fantasma).
Camino de producción: `web._transcribir_audio` (lo usan `/chat/audio` y `/transcribir`); los tests pasan por los
endpoints reales, no por la función suelta.
"""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

import stt_fantasmas
from test_audio import (_WEBM_HEADER, _build_app, _mp_fernet_key_env,  # noqa: F401 — fixture autouse
                        _require_tenant_fixed)

FANTASMAS_OBSERVADOS = ["El El", "El El.", "  el  el  ", "Gracias por ver el video.", "¡GRACIAS por ver el video!",
                        "gracias por ver el vídeo", "El"]
HABLA_REAL = ["gracias por ver el video que te mandé", "el el perro", "Gracias", "Gracias.", "Sí", "No, cancelalo",
              "el pedido", "hacele una factura a el Pepe"]


def _post(app, ruta, transcript_audio=b"fake"):
    data = {"session_id": "s1"} if ruta == "/chat/audio" else {}     # /chat/audio exige session_id (validación previa)
    return TestClient(app).post(ruta, data=data,
                                files={"audio": ("clip.webm", _WEBM_HEADER + transcript_audio, "audio/webm")})


def _app(texto):
    return _build_app(require_tenant=_require_tenant_fixed("cid-A"), transcribe=lambda b, ct: texto)


@pytest.mark.parametrize("ruta", ["/transcribir", "/chat/audio"])
@pytest.mark.parametrize("fantasma", FANTASMAS_OBSERVADOS)
def test_CONTROL_POSITIVO_cada_fantasma_es_422_por_los_endpoints_de_produccion(ruta, fantasma):
    r = _post(_app(fantasma), ruta)
    assert r.status_code == 422 and r.json()["detail"] == "no se entendió el audio", (ruta, fantasma, r.text)


@pytest.mark.parametrize("habla", HABLA_REAL)
def test_CONTROL_NEGATIVO_el_habla_real_que_contiene_al_fantasma_PASA(habla):
    r = _post(_app(habla), "/transcribir")
    assert r.status_code == 200 and r.json() == {"transcript": habla}


def test_normalizacion_es_de_frase_completa_no_contains():
    assert stt_fantasmas.es_fantasma("Gracias por ver el video.")
    assert not stt_fantasmas.es_fantasma("gracias por ver el video que te mandé")
    assert not stt_fantasmas.es_fantasma("")          # el vacío lo maneja el 422 existente, no esta lista
    assert not stt_fantasmas.es_fantasma(None)


def test_la_lista_vive_en_un_solo_lugar_y_web_la_invoca():
    """Composition root: el helper común de web.py llama al guard (cero invocadores = control inexistente)."""
    from pathlib import Path
    import web as web_module
    fuente = Path(web_module.__file__).read_text(encoding="utf-8")
    assert fuente.count("es_fantasma(") == 1
    assert fuente.count("FANTASMAS") == 0   # la lista no se esparce fuera de stt_fantasmas.py
