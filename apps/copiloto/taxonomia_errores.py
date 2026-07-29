"""Taxonomía de errores con semántica de acción — item 1.3 de Fase 1.

Cuatro categorías, portadas de ARCA (`error-drawer.tsx:21-55` + `mot07-consulta-fe.ts:336-379`). Lo
que las hace útiles no es clasificar: es que **la categoría determina el camino de recuperación** sin
que nadie tenga que interpretar el mensaje del error.

| categoría | qué significa | qué se hace |
|---|---|---|
| `infra_error` | transitorio: red, timeout, 5xx, rate limit | reintentar automáticamente |
| `business_error` | el dato o el estado están mal | NO reintentar; hace falta un humano o un dato distinto |
| `manual_intervention` | hay un efecto externo que sólo una persona puede resolver | bloquear y avisar |
| `cascading` | falló porque su dependencia falló | revisar el padre, no éste |

Hoy el repo tiene **16 `RetryPolicy` sin categorizar**: cada sitio decide por su cuenta si reintenta,
con esa decisión dispersa e implícita. Cuando exista la DLQ (Fase 2), esta tabla es lo que le permite
decidir qué reinyectar — y reinyectar un `business_error` es un loop infinito garantizado, que es
exactamente el que ARCA vivió en su BOT-08 v1.0.

**La decisión de diseño que sostiene todo: NO hay categoría por descarte.** Un error desconocido
levanta `ErrorSinCategoria` en vez de caer en un `else`. Es incómodo a propósito: un `else:
infra_error` se traga cualquier excepción nueva y la manda a reintentar para siempre, y el "por
descarte" es el modo de fallo clásico de toda taxonomía
([[discriminar-por-ausencia-de-estructura]]). Que falle fuerte obliga a decidir una vez, en vez de
descubrirlo en producción.

Extensible **por registro** (`registrar_categoria`), no editando un `if` gigante: cada dominio trae
sus propios errores y no debería tener que tocar este módulo.
"""
from __future__ import annotations

INFRA_ERROR = "infra_error"
BUSINESS_ERROR = "business_error"
MANUAL_INTERVENTION = "manual_intervention"
CASCADING = "cascading"

CATEGORIAS = {INFRA_ERROR, BUSINESS_ERROR, MANUAL_INTERVENTION, CASCADING}

#: Sólo `infra_error` se reintenta solo. Los demás necesitan que cambie algo que un reintento no
#: cambia — más intentos sobre un dato inválido son más fallos idénticos, no una recuperación.
_REINTENTABLES = {INFRA_ERROR}


class ErrorSinCategoria(Exception):
    """Un error que nadie clasificó. Se levanta a propósito en vez de asumir una categoría."""


_REGISTRO: dict[type[BaseException], str] = {
    # Transitorios: la misma llamada, más tarde, puede andar.
    TimeoutError: INFRA_ERROR,
    ConnectionError: INFRA_ERROR,
    ConnectionResetError: INFRA_ERROR,
    ConnectionAbortedError: INFRA_ERROR,
    OSError: INFRA_ERROR,
    # De negocio: el dato o el estado están mal; reintentar da el mismo resultado.
    ValueError: BUSINESS_ERROR,
    KeyError: BUSINESS_ERROR,
    TypeError: BUSINESS_ERROR,
    ZeroDivisionError: BUSINESS_ERROR,
    # Requieren una persona: permisos, credenciales, autorizaciones externas.
    PermissionError: MANUAL_INTERVENTION,
}


def registrar_categoria(tipo: type[BaseException], categoria: str) -> None:
    """Registra la categoría de un tipo de error. Falla AL REGISTRAR si la categoría no existe —
    y no más tarde, cuando ya nadie recuerde quién la escribió."""
    if categoria not in CATEGORIAS:
        raise ValueError(f"categoría desconocida: {categoria!r}; válidas: {sorted(CATEGORIAS)}")
    _REGISTRO[tipo] = categoria


def categoria_de(exc: BaseException) -> str:
    """Categoría de `exc`. Levanta `ErrorSinCategoria` si nadie lo clasificó — **nunca** asume.

    Recorre el MRO para que una subclase herede la categoría de su padre (así `HTTPError(OSError)`
    queda como infra sin registrarla una por una), pero un tipo sin ningún ancestro registrado es un
    error genuinamente nuevo y hay que decidirlo, no adivinarlo.
    """
    for tipo in type(exc).__mro__:
        if tipo in _REGISTRO:
            return _REGISTRO[tipo]
    raise ErrorSinCategoria(
        f"{type(exc).__name__} no tiene categoría. Registrala con `registrar_categoria(...)`: "
        f"asumir una por descarte manda errores nuevos a reintentar para siempre.")


def es_reintentable(categoria: str) -> bool:
    """¿Un reintento automático tiene sentido para esta categoría?"""
    return categoria in _REINTENTABLES
