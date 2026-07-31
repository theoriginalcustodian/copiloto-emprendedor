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
from pathlib import Path
from typing import Any

from fingerprint import fingerprint_de_error

_log = logging.getLogger("copiloto")

#: Raíz del repo desplegado, derivada del propio módulo (`…/apps/copiloto/log_estructurado.py`).
#: Nunca hardcodeada: prod vive en `/opt/uc-repos/copiloto`, el stage de tests en otro path y el
#: checkout local en un tercero — los tres tienen que dar el mismo path relativo.
_RAIZ = Path(__file__).resolve().parents[2]


def origen_en_el_codigo(exc: BaseException) -> dict[str, Any] | None:
    """Dónde falló **nuestro** código: `{archivo, linea, funcion}` relativo a la raíz del repo.

    **Por qué hace falta, y por qué no estaba.** El traceback viaja por `exc_info` al canal de
    excepción —texto en journald— y nada de eso vuelve a entrar en la línea estructurada ni en el
    trauma. Para un humano alcanza: abre el journal y lee. Para el ciclo de auto-reparación no: sin
    archivo, `forjar_parche` no tiene nada que abrir, y "reparar" se convierte en adivinar el módulo
    desde el nombre del workflow. Medido el 2026-07-31 al escribir las activities de la Fase 3 — el
    trauma guardaba `workflow`, `error_type` y `categoria`, y ninguno de los tres localiza una línea.

    **Se toma el frame más profundo que sea NUESTRO**, no el más profundo a secas: ese suele estar
    dentro de `psycopg2` o `httpx`, donde no hay nada que reparar. El punto reparable es la última
    línea de código propio que se ejecutó.

    **Qué NO se emite:** el mensaje de la excepción ni el texto de la línea. Un path y un número no
    son PII; el contenido de la línea podría serlo, y la regla 2 del módulo no admite excepciones
    porque el consumidor sea un agente en vez de una persona.

    Devuelve `None` si no hay traceback o si ningún frame es propio (p. ej. una excepción construida
    a mano en un test) — un `None` explícito, nunca un dict a medias que después parezca una
    ubicación real.
    """
    tb = getattr(exc, "__traceback__", None)
    origen = None
    while tb is not None:
        crudo = tb.tb_frame.f_code.co_filename
        try:
            relativo = Path(crudo).resolve().relative_to(_RAIZ)
        except (ValueError, OSError):
            tb = tb.tb_next     # fuera del repo: stdlib, site-packages, `<string>` de un exec
            continue
        # Se pisa en cada vuelta a propósito: al salir del while queda el ÚLTIMO frame propio, que
        # es el más profundo — el más cercano al fallo real.
        origen = {"archivo": relativo.as_posix(), "linea": tb.tb_lineno,
                  "funcion": tb.tb_frame.f_code.co_name}
        tb = tb.tb_next
    return origen


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
    # Dónde falló, si se puede saber. Va como campo aparte y no dentro de `extra` para que ninguna
    # costura tenga que acordarse de agregarlo: la que olvide hacerlo dejaría traumas irreparables.
    origen = origen_en_el_codigo(exc)
    if origen:
        registro["origen"] = origen
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
