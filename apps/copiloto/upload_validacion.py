"""Magic bytes de los uploads (D6): el `content_type` que declara el cliente es un dato NO confiable
-- lo pone quien arma el request, no el archivo. Los 4 endpoints de upload (`chat_audio`,
`soporte_chat_audio`, `feedback_audio`, `chat_foto`) sólo validaban tamaño y, en el caso de la foto,
el `content_type` declarado -- nunca los bytes reales. Este módulo cierra esa brecha: valida la firma
binaria contra el `content_type` declarado ANTES de que el contenido llegue a Groq/OpenAI.

Los tipos aceptados son EXACTAMENTE los que los clientes reales producen hoy (`MicButton.tsx` en
copiloto-web: `audio/webm;codecs=opus`, `audio/webm`, `audio/mp4`; `useVozComando.ts` en mobile:
`audio/mp4`) más `audio/ogg` (el default del backend cuando el cliente no manda `content_type`) y
`audio/mpeg`/`audio/wav` por generosidad -- no hay razón funcional para aceptar un tipo sin firma
conocida.
"""
from __future__ import annotations

from typing import Callable

Firma = Callable[[bytes], bool]


def _ebml(b: bytes) -> bool:
    return b.startswith(b"\x1a\x45\xdf\xa3")


def _ogg(b: bytes) -> bool:
    return b.startswith(b"OggS")


def _mp4_ftyp(b: bytes) -> bool:
    return b[4:8] == b"ftyp"


def _mpeg(b: bytes) -> bool:
    return b.startswith(b"ID3") or (len(b) >= 2 and b[0] == 0xFF and (b[1] & 0xE0) == 0xE0)


def _wav(b: bytes) -> bool:
    return b.startswith(b"RIFF") and b[8:12] == b"WAVE"


def _jpeg(b: bytes) -> bool:
    return b.startswith(b"\xff\xd8\xff")


def _png(b: bytes) -> bool:
    return b.startswith(b"\x89PNG\r\n\x1a\n")


FIRMAS_AUDIO: dict[str, Firma] = {
    "audio/webm": _ebml,
    "audio/webm;codecs=opus": _ebml,
    "audio/ogg": _ogg,
    "audio/mp4": _mp4_ftyp,
    "audio/x-m4a": _mp4_ftyp,
    "audio/mpeg": _mpeg,
    "audio/mp3": _mpeg,
    "audio/wav": _wav,
    "audio/x-wav": _wav,
}

FIRMAS_IMAGEN: dict[str, Firma] = {
    "image/jpeg": _jpeg,
    "image/png": _png,
}


def magic_bytes_validos(contenido: bytes, content_type: str, firmas: dict[str, Firma]) -> bool:
    """`content_type` no reconocido -> inválido (fail-closed): no hay tipo aceptado sin firma
    definida en este módulo. Firma reconocida -> corre el chequeo real contra los bytes."""
    chequeo = firmas.get(content_type)
    if chequeo is None:
        return False
    try:
        return bool(chequeo(contenido))
    except Exception:
        # Un archivo demasiado corto para tener firma (`b[4:8]` fuera de rango, etc.) no es un error
        # del sistema -- es exactamente el caso que este chequeo existe para cazar. Fail-closed: se
        # trata igual que "firma no coincide", sin log (no hay nada roto que investigar).
        return False
