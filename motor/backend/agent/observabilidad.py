"""Log estructurado de EVENTOS (no errores) — telemetría del turno, lote B (higiene, 2026-08-12).

Reemplaza 3 `print("NOMBRE " + json.dumps(...), flush=True)` idénticos que vivían sueltos en
`agent_activities.py` (STT_TRANSCRIPT, LLM_TURNO) y `soporte_agent_tools.py` (RAG_CONSULTA) — cada
uno con el mismo comentario a mano justificando por qué no usaban `activity.logger`/`logging.info`
(sin `logging.basicConfig()` en ningún entrypoint, `.info()` sin handler propio se pierde:
`logging.lastResort` sólo emite `warning+` a stderr). El fix de raíz no es cambiar EL mecanismo
—`print` a stdout ya es exactamente lo que el unit systemd (`StandardOutput=journal`) necesita— sino
juntar el `json.dumps` + la regla de "nunca contenido libre del usuario" en un solo lugar en vez de
tres copias idénticas. **A propósito NO se envuelve en `logging`:** un `StreamHandler` capturaría
`sys.stdout` una sola vez, en el primer uso, y quedaría atado a esa referencia — rompe `capsys` en
tests que corren después del primero (pytest reemplaza `sys.stdout` por test; `print()` lo resuelve
en cada llamada, un handler cacheado no). Ver `test_agent_activities_react.py::test_call_llm_tools_
loguea_finish_reason_para_medir_cortes_por_length`, que ya dependía de este comportamiento.

**Por qué acá y no en `apps/copiloto/log_estructurado.py`.** Ese módulo vive en la capa CLIENTE
(`CLAUDE.md §2`: "`apps/copiloto/**` importa el motor... nunca al revés"); `agent_activities.py` es
capa PLATAFORMA (motor/). Si `log_evento` viviera del lado cliente, la activity del motor tendría que
importar hacia arriba — invierte el boundary que `_paths.py` documenta como explícito. Este módulo
es agnóstico de dominio (no sabe qué es un tenant, un CUIT o un trauma): sólo formatea `NOMBRE {json}`
a stdout. `log_error` (fingerprint, exclusión de PII fiscal, integración con la futura DLQ) se queda
donde está — es lógica de cliente, no de plataforma.
"""
from __future__ import annotations

import json
from typing import Any


def log_evento(nombre: str, campos: dict[str, Any]) -> None:
    """Registra un evento de telemetría como línea `NOMBRE {json}` a stdout — mismo formato de wire
    que los `print()` que reemplaza (`journalctl | grep STT_TRANSCRIPT` sigue funcionando igual).

    **Regla dura, la misma que ya aplicaban a mano los 3 call-sites migrados:** `campos` NUNCA lleva
    contenido libre del usuario (mensaje, transcript, respuesta) — sólo metadata (ids, conteos,
    duraciones, outcomes). Es responsabilidad de quien llama, no de esta función, decidir qué es
    metadata: acá no hay forma genérica de saber si un campo es sensible.
    """
    try:
        linea = json.dumps(campos, ensure_ascii=False, default=str)
    except Exception:  # noqa: BLE001 — serializar no puede tirar el evento entero
        linea = json.dumps({"aviso": "contexto no serializable, se descartó"}, ensure_ascii=False)
    print(f"{nombre} {linea}", flush=True)


_LARGO_MENSAJE_FINGERPRINT = 200


def _djb2_hash(texto: str) -> str:
    """djb2 de 32 bits → hex de 8 chars.

    **Duplicado a propósito de `apps/copiloto/fingerprint.py::djb2_hash`, no importado** — ese
    módulo vive en la capa CLIENTE (`log_error`, con fingerprint + exclusión de PII fiscal, es
    lógica de cliente; ver el docstring de este archivo). Un boundary uso PLATAFORMA→CLIENTE
    invertiría la dirección que `_paths.py` documenta como explícita. El algoritmo en sí es
    agnóstico de dominio (no tenant, no PII), así que duplicarlo acá no repite lógica de negocio —
    sólo la fórmula de hash. **Mismo contrato que la copia de cliente: DEBE ser byte-idéntico** (un
    cambio en la fórmula rompería el dedupe de fingerprints entre capas).
    """
    h = 5381
    for ch in texto:
        h = ((h << 5) + h + ord(ch)) & 0xFFFFFFFF
    return format(h, "08x")


def log_error_evento(exc: BaseException, *, workflow: str, extra: dict[str, Any] | None = None) -> str:
    """Registra `exc` como línea `ERROR {json}` a stdout, con `fingerprint` — la variante PLATAFORMA
    de `apps/copiloto/log_estructurado.py::log_error` (mismo propósito: agrupar ocurrencias del
    MISMO fallo), para call-sites de `motor/` que no pueden importar la versión cliente.

    Igual que `log_evento`: nunca lanza (un fallo acá no puede tapar el error que se está
    registrando) y nunca incluye el mensaje crudo de la excepción en el campo logueado — sólo
    entra al hash del fingerprint, no al JSON emitido.
    """
    error_type = type(exc).__name__
    fp = _djb2_hash("|".join((workflow, error_type, str(exc)[:_LARGO_MENSAJE_FINGERPRINT])))
    campos: dict[str, Any] = {"evento": "error", "fingerprint": fp, "workflow": workflow,
                              "error_type": error_type}
    if extra:
        campos.update(extra)
    log_evento("ERROR", campos)
    return fp
