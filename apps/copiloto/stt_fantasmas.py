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
    # ⚠️ LA ENTRADA MÁS DISCUTIBLE de las tres (y la de más chance de dispararse por accidente): «el» es una
    # palabra legítima. Entró porque una transcripción que es SOLO «el» no tiene contenido utilizable en ningún
    # flujo (ni ítem, ni mensaje, ni nombre de cliente), y dejarla pasar fabricó una línea basura «El» (1x0) en
    # el formulario de factura (frontend1, 2026-11-05 12:55). Entre descartar un dictado sin contenido y fabricar
    # un ítem falso en una factura, el daño está del lado de dejarla pasar (decisión de planificación 2026-11-06).
    # CONDICIÓN: el rechazo tiene que ser VISIBLE (422 -> «No se entendió el audio. Probá de nuevo.»). Si algún
    # camino devuelve ese 422 sin aviso al usuario, el defecto es ese camino, no esta línea.
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
