"""Log estructurado de errores — item 1.2 de Fase 1.

Convierte un error en una línea JSON **consultable**: se puede contar, agrupar por `fingerprint`,
filtrar por tenant y buscar en journald con un `grep`. Hoy el backend tiene **6 loggers reales en 32k
LOC** y sus 147 handlers `except` mayormente deciden bien, pero no dejan nada que se pueda medir —
esa es la diferencia entre *"hay un problema"* y *"este problema, en este tenant, 40 veces desde el
martes"*.

Es la mitad de la captura (A-4 paso 1). La otra mitad —depositar en la DLQ— es Fase 2, y por eso
`fingerprint` ya viaja acá: cuando exista `copiloto_traumas`, el `ON CONFLICT (fingerprint)` va a
encontrar la clave ya calculada y estable.

**Tres decisiones que salen de mediciones, no de gusto:**

1. **Nivel `warning`, nunca `info`.** Medido en el VPS: el unit tiene `StandardOutput=journal` y, sin
   `basicConfig`, `logging.lastResort` sólo emite `warning+` a stderr. Un error logueado en `.info`
   **no llega a journald** — es un log que no existe.
2. **El `error_message` NO se emite.** Puede traer CUIT, montos o nombres. ARCA excluye
   explícitamente `errorMessage` de su audit log por PII/datos fiscales
   (`err00-handle-global-error.ts:403-413`); el `fingerprint` identifica el error sin exponer su
   contenido. Si hace falta el mensaje para debuggear, está en el traceback del `exc_info`, que va a
   otro canal y no a la línea estructurada.
3. **Nunca lanza.** Un fallo al registrar un error no puede tumbar el turno del usuario. Es el mismo
   principio que ARCA dejó escrito: *"un error al loguear un error no debe generar un error nuevo"*.
   Por eso el `default=str` del `json.dumps` y el `try` de último recurso.
"""
from __future__ import annotations

import json
import logging
from typing import Any

from fingerprint import fingerprint_de_error

_log = logging.getLogger("copiloto")


def log_error(
    exc: BaseException,
    *,
    workflow: str,
    cliente_id: str | None = None,
    duration_ms: int | None = None,
    extra: dict[str, Any] | None = None,
) -> str:
    """Registra `exc` como una línea JSON y devuelve su `fingerprint`.

    Devolver el fingerprint no es cosmético: permite que el llamador lo use en la respuesta al
    usuario ("mencioná este código si volvés a escribir") y, en Fase 2, como clave del depósito.
    """
    fp = fingerprint_de_error(workflow=workflow, exc=exc)
    registro: dict[str, Any] = {
        "evento": "error",
        "fingerprint": fp,
        "workflow": workflow,
        "error_type": type(exc).__name__,
        # NO va `error_message`: PII / datos fiscales. El fingerprint ya identifica el error.
        "cliente_id": cliente_id,
        "duration_ms": duration_ms,
    }
    if extra:
        registro.update(extra)

    try:
        # `default=str` para que un objeto raro en `extra` se degrade a su repr en vez de reventar.
        linea = json.dumps(registro, ensure_ascii=False, default=str)
    except Exception:  # noqa: BLE001 — serializar no puede ser la causa de perder el error entero
        linea = json.dumps({"evento": "error", "fingerprint": fp, "workflow": workflow,
                            "error_type": type(exc).__name__,
                            "aviso": "contexto no serializable, se descartó"}, ensure_ascii=False)

    # `warning` y no `info`: ver §1 del docstring del módulo. `exc_info` manda el traceback por el
    # canal de excepción (útil para debug) sin meterlo en la línea estructurada.
    _log.warning(linea, exc_info=exc)
    return fp
