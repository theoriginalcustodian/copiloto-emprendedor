"""El LLM grabado de la junta de autosanación (SM-N58) — sin Postgres, sin credencial.

Si la grabación se venciera en silencio, la junta daría verde midiendo otra cosa. Estos controles
fijan las dos propiedades de las que depende: el parche del forjador APLICA sobre el archivo real
(ancla única y presente), y el auditor grabado RECHAZA los tres parches de control.
"""
from __future__ import annotations

from pathlib import Path

from _llm_grabado_autosanacion import ANCLA, RESPUESTA_FORJADOR, LLMGrabado
from auditor_parches import auditar, verificar_auditor
from forjador_parches import aplicar_bloques

FINGERPRINT = Path(__file__).resolve().parents[1] / "fingerprint.py"


def test_el_parche_grabado_APLICA_sobre_el_fingerprint_real():
    contenido = FINGERPRINT.read_text(encoding="utf-8")
    assert contenido.count(ANCLA) == 1, "el ancla del grabado tiene que existir UNA vez: regrabar"
    aplicacion = aplicar_bloques(RESPUESTA_FORJADOR, contenido)
    assert aplicacion.ok, aplicacion.detalle
    assert aplicacion.contenido != contenido


def test_CONTROL_el_auditor_grabado_rechaza_los_tres_parches_rotos():
    sano, fallos = verificar_auditor(LLMGrabado())
    assert sano, fallos


def test_el_auditor_grabado_aprueba_un_parche_normal():
    assert auditar(LLMGrabado(), RESPUESTA_FORJADOR, contexto="archivo fingerprint.py").aprobado
