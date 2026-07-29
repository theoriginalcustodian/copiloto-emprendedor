"""Fingerprint de errores — la clave que agrupa ocurrencias del MISMO fallo. Item 1.1 de Fase 1.

Sin esto, dos ocurrencias del mismo error son dos líneas de log sin relación entre sí: no se puede
contar "esto pasó 40 veces", ni deduplicar, ni decidir si algo es un incidente o ruido. Es la
precondición de la DLQ (Fase 2, `ON CONFLICT (fingerprint) DO UPDATE … RETURNING dedupe_count`) y por
lo tanto de la autosanación (Fase 3): un agente reparador necesita saber *qué* falla y *cuánto*, no
leer 32k líneas de journal.

**Portado de ARCA**, no inventado: `aplicacion-arca-fe/lib/shared/temporal/err00-djb2-hash.ts:28-36`.
La doc del original advierte, y vale igual acá:

    "CRÍTICO: el algoritmo DEBE ser byte-idéntico […] Un cambio en la fórmula rompería la
     compatibilidad."

Es djb2 clásico de 32 bits → hex de 8 caracteres. `test_fingerprint.py` fija vectores conocidos para
que un "esto se puede optimizar" no parta el dedupe en silencio.

**Por qué djb2 y no `hashlib`:** no es un hash criptográfico ni pretende serlo. Se busca una clave
corta, estable, barata y **legible en un log** — 8 chars que un humano puede grepear y comparar de
un vistazo. Un sha256 sería más largo, más lento y no aportaría nada para agrupar.

**Por qué el truncado a 200 chars** (mismo criterio que ARCA): los mensajes de error suelen terminar
en un id, un timestamp o un uuid distinto en cada ocurrencia. Sin cortar, cada instancia del mismo
fallo generaría un fingerprint nuevo y el dedupe no deduplicaría nada — el defecto se disfrazaría de
40 problemas distintos, que es exactamente lo que hace imposible priorizar.
"""
from __future__ import annotations

_LARGO_MENSAJE = 200


def djb2_hash(texto: str) -> str:
    """djb2 de 32 bits → hex de 8 chars. Byte-idéntico al de ARCA (`err00-djb2-hash.ts:28-36`)."""
    h = 5381
    for ch in texto:
        # `& 0xFFFFFFFF` es el equivalente del `>>> 0` de JS: fuerza unsigned de 32 bits. Sin esto
        # Python crecería a enteros arbitrarios y el hash divergiría del de la otra plataforma.
        h = ((h << 5) + h + ord(ch)) & 0xFFFFFFFF
    return format(h, "08x")


def fingerprint_de_error(
    *,
    workflow: str,
    error_type: str | None = None,
    error_message: str | None = None,
    exc: BaseException | None = None,
) -> str:
    """Fingerprint estable de `workflow|error_type|error_message[:200]`.

    Se puede pasar la excepción (`exc`) o los campos sueltos; `exc` tiene prioridad porque es el uso
    real desde un `except`. Nunca lanza: un fallo acá dejaría sin registrar el error que se está
    intentando registrar, y ese es el peor momento posible para fallar.
    """
    if exc is not None:
        error_type = type(exc).__name__
        error_message = str(exc)
    partes = (workflow or "", error_type or "", (error_message or "")[:_LARGO_MENSAJE])
    return djb2_hash("|".join(partes))
