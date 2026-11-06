"""Frases FANTASMA del STT: salidas CONOCIDAS de Whisper cuando el micrófono sólo captó ruido/silencio.

Un único lugar para la lista. Es un filtro ESPECÍFICO (frase completa normalizada), no un discriminador sobre
la señal: el spike del 2026-11-06 refutó `avg_logprob` («Sí» -0,327 sale peor que el fantasma «Gracias» -0,21)
y `no_speech_prob` no pasa a guard sin voz humana real. Consecuencia ACEPTADA: un fantasma nuevo pasa hasta que
se observe y se agregue acá.

Reglas de la lista:
- Entrada = frase COMPLETA ya normalizada (minúsculas, sin acentos ni puntuación, espacios colapsados).
- La comparación es por IGUALDAD, nunca `contains`: «gracias por ver el video que te mandé» es habla legítima.
- «Gracias» a secas NO va: es una palabra legítima y frecuente (el spike mostró que el silencio digital da
  «Gracias.», pero no se puede cortar por texto sin comerse al usuario real).
- Cada entrada dice quién la observó y cuándo.
"""
from __future__ import annotations

import re
import unicodedata

#: frase normalizada -> procedencia
FANTASMAS_STT: dict[str, str] = {
    # frontend1, canario de silencio de 5 s en device RF8T318RN9T, 2026-11-06 ~08:25 (chat «Por voz · 0:07»)
    "el el": "chat general, canario de silencio, 2026-11-06",
    # frontend1, mismo canario, dock de Facturación, 2026-11-06 (también «Gracias por ver el video.» clásico de Whisper)
    "gracias por ver el video": "dock de Facturación, canario de silencio, 2026-11-06",
    # frontend1, ítem «El» (1x0) que entró al formulario de factura, 2026-11-05 12:55
    "el": "ítem de factura por dictado, 2026-11-05",
}


def normalizar(texto: str) -> str:
    sin_acentos = "".join(c for c in unicodedata.normalize("NFKD", texto) if not unicodedata.combining(c))
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9\s]", " ", sin_acentos.lower())).strip()


def es_fantasma(texto: str | None) -> bool:
    """True si la transcripción COMPLETA, normalizada, es exactamente una frase fantasma conocida."""
    if not texto:
        return False
    return normalizar(texto) in FANTASMAS_STT
