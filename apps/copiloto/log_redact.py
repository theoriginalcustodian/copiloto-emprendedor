"""Redacción de datos sensibles en el access log de uvicorn (SEC-C5-1, auditoría 2026-11-05).

El CUIT viaja en la querystring (`/afip/estado?cuit=...`) y uvicorn lo escribía en el journal.
Es un dato personal/fiscal del contribuyente: no debe quedar en logs. Se enmascara el VALOR de
los parámetros sensibles; el path y el resto de la query se conservan (la traza sigue siendo útil).
"""
from __future__ import annotations

import logging
import re

_SENSIBLES = ("cuit", "cuil", "cuit_emisor", "token", "access_token", "refresh_token", "password", "api_key")
_RE = re.compile(r"(?i)([?&](?:%s)=)[^&\s\"]*" % "|".join(_SENSIBLES))


def redactar(texto: str) -> str:
    return _RE.sub(r"\1***", texto)


class RedactarQueryFilter(logging.Filter):
    """Reescribe los args del registro (uvicorn.access pasa el path como arg) sin tocar el resto."""

    def filter(self, record: logging.LogRecord) -> bool:
        if isinstance(record.args, tuple):
            record.args = tuple(redactar(a) if isinstance(a, str) else a for a in record.args)
        if isinstance(record.msg, str):
            record.msg = redactar(record.msg)
        return True


def instalar() -> None:
    """Idempotente: no duplica el filtro si se llama dos veces."""
    lg = logging.getLogger("uvicorn.access")
    if not any(isinstance(f, RedactarQueryFilter) for f in lg.filters):
        lg.addFilter(RedactarQueryFilter())
