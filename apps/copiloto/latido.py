"""`con_latido` — que una activity larga reporte que sigue viva. Item #12 de Fase 1.

**El problema que resuelve.** Sin `heartbeat_timeout`, Temporal sólo detecta que un worker murió
cuando vence el `start_to_close_timeout`. En `dar_de_alta_afip` eso son **10 minutos** de un
emprendedor esperando sin que nadie sepa si su alta se está procesando o si el proceso está muerto.
Con latido, la caída se detecta en segundos y el reintento arranca solo.

**Por qué hacía falta un mecanismo y no una línea de config.** Poner `heartbeat_timeout` sin que la
activity lata **la mata** apenas supera el umbral: es peor que no ponerlo. Y las tres activities
largas del repo —`dar_de_alta_afip` (10 min), `emitir_comprobante` (3 min),
`archivar_factura_en_drive` (2 min)— son todas `await asyncio.to_thread(algo_bloqueante)`: **una sola
llamada, sin punto intermedio** donde reportar progreso. No hay dónde meter el latido sin partir la
operación en pedazos.

De ahí este helper: una tarea concurrente late mientras el hilo bloqueado trabaja. Las tres comparten
el mismo obstáculo, así que es **un mecanismo aplicado tres veces**, no tres diseños.

**Qué NO hace, a propósito:** no reporta progreso real (`heartbeat(detalle)`), sólo presencia. El
progreso exigiría partir la operación, que es justo lo que no se puede. "Sigo vivo" es toda la
información que Temporal necesita para distinguir *lento* de *muerto*, que es la distinción que hoy
no existe.
"""
from __future__ import annotations

import asyncio
from typing import Awaitable, TypeVar

from temporalio import activity

T = TypeVar("T")

#: Regla práctica de Temporal: latir a ~1/3 del `heartbeat_timeout` deja margen para dos latidos
#: perdidos antes de que el server declare muerta la activity. Con `heartbeat_timeout=60s`, 20 s.
INTERVALO_LATIDO_S = 20.0


async def con_latido(operacion: Awaitable[T], *, intervalo_s: float = INTERVALO_LATIDO_S) -> T:
    """Ejecuta `operacion` mientras late en segundo plano. Devuelve su resultado; propaga su error.

    El `finally` con `cancel()` no es higiene opcional: sin él, cada activity dejaría una tarea viva
    latiendo para siempre. En un worker que atiende miles de turnos eso se acumula en silencio hasta
    que el proceso se degrada — y nadie lo relacionaría con esto.
    """
    async def latir() -> None:
        while True:
            await asyncio.sleep(intervalo_s)
            activity.heartbeat()

    tarea = asyncio.create_task(latir())
    try:
        return await operacion
    finally:
        tarea.cancel()
        # Esperar la cancelación —y tragar el `CancelledError` que ella misma provoca— evita el
        # "Task was destroyed but it is pending!" que ensucia los logs y esconde errores de verdad.
        try:
            await tarea
        except asyncio.CancelledError:
            pass
