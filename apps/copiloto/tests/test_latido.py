"""Item #12 — que una activity larga pueda LATIR mientras hace una llamada bloqueante.

**El problema, medido:** 23 activities registradas, **cero** llaman `activity.heartbeat()`. Poner
`heartbeat_timeout` sin que la activity lata **la mata** apenas supera el umbral — por eso #12 quedó
diferido desde el principio: no era configuración.

**Por qué no alcanzaba con "agregar un heartbeat":** las tres largas
(`dar_de_alta_afip` 10 min, `emitir_comprobante` 3 min, `archivar_factura_en_drive` 2 min) son
`await asyncio.to_thread(algo_bloqueante)` — **una sola llamada, sin punto intermedio** donde
reportar progreso. No hay dónde meter el latido sin partir la operación.

La salida es una tarea concurrente que late mientras el hilo bloqueado trabaja. Un solo mecanismo
aplicado tres veces, no tres diseños.

**Para qué sirve el heartbeat, y por qué importa acá:** sin él, Temporal sólo se entera de que un
worker murió cuando vence el `start_to_close_timeout` — 10 minutos, en el caso del alta. Con latido,
lo detecta en segundos y reintenta. Sobre una activity que habla con AFIP, esos 10 minutos son 10
minutos de un emprendedor esperando sin saber si su alta se está procesando o murió.
"""
from __future__ import annotations

import asyncio

import pytest
from temporalio import activity
from temporalio.testing import ActivityEnvironment

from latido import con_latido


@pytest.mark.asyncio
async def test_late_mientras_la_llamada_bloqueante_corre():
    """EL TEST QUE IMPORTA: el latido ocurre DURANTE la operación, no después."""
    latidos: list = []

    @activity.defn
    async def larga() -> str:
        return await con_latido(asyncio.to_thread(_bloqueante_corto), intervalo_s=0.02)

    env = ActivityEnvironment()
    env.on_heartbeat = lambda *a: latidos.append(a)
    resultado = await env.run(larga)

    assert resultado == "listo"
    assert len(latidos) >= 2, (
        f"la activity no latió durante la llamada bloqueante ({len(latidos)} latidos): "
        f"con `heartbeat_timeout` puesto, Temporal la mataría a mitad de camino")


@pytest.mark.asyncio
async def test_CONTROL_sin_el_mecanismo_no_hay_latidos():
    """Control negativo: sin `con_latido`, la misma operación no late ni una vez. Sin esto, el test de
    arriba lo pasaría un `env.on_heartbeat` que se dispara solo."""
    latidos: list = []

    @activity.defn
    async def larga_sin_latido() -> str:
        return await asyncio.to_thread(_bloqueante_corto)

    env = ActivityEnvironment()
    env.on_heartbeat = lambda *a: latidos.append(a)
    await env.run(larga_sin_latido)

    assert latidos == [], f"latió sin el mecanismo: el test de arriba no probaría nada ({latidos})"


@pytest.mark.asyncio
async def test_el_latido_se_detiene_cuando_la_operacion_termina():
    """Un latido que sigue después de terminar es una tarea huérfana: en un worker de verdad se
    acumulan una por activity y nadie las ve hasta que el proceso se degrada."""
    latidos: list = []

    @activity.defn
    async def corta() -> str:
        return await con_latido(asyncio.sleep(0, result="ya"), intervalo_s=0.01)

    env = ActivityEnvironment()
    env.on_heartbeat = lambda *a: latidos.append(a)
    await env.run(corta)

    cuantos = len(latidos)
    await asyncio.sleep(0.05)          # si la tarea quedó viva, acá seguiría latiendo
    assert len(latidos) == cuantos, "el latido siguió después de terminar: tarea huérfana"


@pytest.mark.asyncio
async def test_si_la_operacion_FALLA_el_error_se_propaga_y_el_latido_para():
    """El mecanismo no puede tragarse el error de la operación que envuelve — sería exactamente el
    fallo que este frente entero viene combatiendo."""
    latidos: list = []

    @activity.defn
    async def rompe() -> str:
        return await con_latido(_falla(), intervalo_s=0.01)

    env = ActivityEnvironment()
    env.on_heartbeat = lambda *a: latidos.append(a)
    with pytest.raises(ValueError, match="rompió"):
        await env.run(rompe)

    cuantos = len(latidos)
    await asyncio.sleep(0.05)
    assert len(latidos) == cuantos, "el latido siguió tras el error: tarea huérfana"


def _bloqueante_corto() -> str:
    """Simula el `to_thread` real: bloquea el hilo, no cede al event loop."""
    import time
    time.sleep(0.08)
    return "listo"


async def _falla() -> str:
    await asyncio.sleep(0.01)
    raise ValueError("la operación se rompió")
