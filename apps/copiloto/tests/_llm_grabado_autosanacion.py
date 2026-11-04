"""LLM GRABADO para la junta de autosanación (SM-N58, clase COSTURA-NUESTRA).

La pregunta de `test_autosanacion_cadena_completa.py` es sobre NUESTRO código: ¿el dict que sale de la
DLQ llega a cada paso en condiciones? No mide al modelo (el docstring de ese test lo dice: un
`rechazado_por_tests` prueba lo mismo que un `pr_propuesto`). Por eso no hace falta una credencial de
tercero para responderla: alcanza con un cliente que conteste con la FORMA real del proveedor.

Qué contesta, y por qué así:

- **forjador** → un bloque SEARCH/REPLACE contra una línea literal y ÚNICA de `fingerprint.py`. Si
  ese archivo cambia y la línea desaparece, el forjador devuelve `aplicado=False` y el test da ROJO:
  la grabación vencida se ve, no se degrada a verde.
- **auditor** (`response_format=json_object`) → rechaza los tres parches de control de
  `verificar_auditor` (su contexto dice «conocido-malo») y aprueba el resto. Un grabado que aprobara
  todo dejaría al kill switch apagando el ciclo, y el test lo cazaría por el assert de «degradado».

Con `OPENAI_API_KEY` en el env, los tests usan el cliente real (la corrida original sigue posible).
"""
from __future__ import annotations

import json
import os
from types import SimpleNamespace

#: Línea literal de `apps/copiloto/fingerprint.py`. Única en el archivo (lo verifica el test del grabado).
ANCLA = "_LARGO_MENSAJE = 200"

RESPUESTA_FORJADOR = (
    "<<<<<<< SEARCH\n"
    f"{ANCLA}\n"
    "=======\n"
    f"{ANCLA}  # tope del mensaje que entra al fingerprint\n"
    ">>>>>>> REPLACE"
)


def _respuesta(texto: str) -> SimpleNamespace:
    return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=texto))])


class _Completions:
    def __init__(self) -> None:
        self.llamadas: list[str] = []

    def create(self, *, model, messages, **kwargs):  # noqa: ANN001, ANN003, ARG002 — firma del SDK
        contenido = messages[-1]["content"]
        if "response_format" in kwargs:  # el auditor pide JSON
            self.llamadas.append("auditor")
            malo = "conocido-malo" in contenido
            return _respuesta(json.dumps({"aprobado": not malo,
                                          "motivo": "control conocido-malo" if malo else "grabado"}))
        self.llamadas.append("forjador")
        return _respuesta(RESPUESTA_FORJADOR)


class LLMGrabado:
    def __init__(self) -> None:
        self.chat = SimpleNamespace(completions=_Completions())


def cliente_llm():
    """El real si hay credencial; si no, el grabado. Nunca un skip: la junta es nuestra."""
    if os.environ.get("OPENAI_API_KEY"):
        from openai import OpenAI
        return OpenAI()
    return LLMGrabado()
