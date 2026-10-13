"""WORKERPOLLER — ¿cada worker systemd está SUSCRIPTO a su task queue, o sólo vivo?

`systemctl is-active` prueba PROCESO. Un worker que levanta, queda `active` y NO pollea su task queue
(no conectó a Temporal, registró otra cola, quedó colgado en el import) es un `is-active` verde con el
moat muerto: el deploy sale ✅ y las conversaciones no avanzan, sin romper ninguna request.

Temporal sabe quién pollea. `DescribeTaskQueue` devuelve los pollers con su `identity`, que el SDK de
Python arma como `<pid>@<hostname>` -- o sea, igual al `MainPID` del unit que lo lanzó (medido en vivo
2026-10-13: `uc-copiloto-worker` MainPID 2647957 == poller `2647957@unreal-copilot` en
`agent-emprendedor`). El check exige que el MainPID ACTUAL de cada unit aparezca entre los pollers de su
cola. Un poller viejo que Temporal retiene unos minutos tras un `restart` NO matchea el PID nuevo: no
engaña.

Qué lee del proceso (y por qué no de un .env): el `/proc/<MainPID>/environ` del worker. La cola y el
target que el worker REALMENTE recibió -- no una copia que pueda divergir del unit.

CUATRO estados por unit, no dos (un vacío del instrumento no es un hallazgo, pero tampoco es un pase):

  ok            el MainPID figura entre los pollers                      -> rc 0
  falta         Temporal CONTESTÓ y el MainPID no está (o el unit no     -> rc 1  ABORTA el deploy
                corre): es el caso que esta fila existe para cazar
  sin_api       Temporal está arriba pero NO contestó ESTA pregunta      -> rc 2  AVISA y SIGUE
                (API no implementada, versión nueva, permiso, un error
                del propio instrumento)
  inalcanzable  no pude hablar con Temporal (conexión, timeout,          -> rc 3  ABORTA el deploy
                UNAVAILABLE)

La decisión de `sin_api` y de `inalcanzable` es DISTINTA a propósito, y el motivo es la correlación:
  · `inalcanzable` aborta porque si Temporal no responde, el worker TAMPOCO puede pollear -- el instrumento
    y el hecho que mide fallan por la misma causa, así que dejarlo pasar es dar luz verde justo en el caso
    de activación del guard.
  · `sin_api` NO aborta porque ahí la falla es del instrumento y no del sistema (Temporal responde; sólo
    no a esta pregunta): abortar un deploy sano en [5/7] -- con prod ya reiniciada y el shell sin
    publicar, el peor estado intermedio -- por un upgrade de Temporal sería castigar al sistema por el
    instrumento. Se degrada al estado anterior a esta fila (sólo `is-active`), RUIDOSO: el deploy imprime
    «NO VERIFICADO» y quien lo corre sabe que esa mitad no se miró.

Declarado, no cubierto:
  · Prueba SUSCRIPCIÓN, no PROGRESO: un worker que pollea pero tiene el workflow task colgado lo cubre
    el gate de durabilidad `[4.95/7]`, no éste.
  · Sólo mira el poller de WORKFLOW (el de la sesión permanente). Los activities se registran junto con
    él en el mismo `Worker`.
  · Un worker lanzado con `Worker(identity=...)` propio no matchea `<pid>@<host>`: falla CERRADO y ruidoso.

Uso:  worker_pollers_check.py [--timeout S] [--intervalo S] [--rpc-timeout S] UNIT:ENVVAR:COLA_POR_DEFECTO ...
"""
from __future__ import annotations

import argparse
import asyncio
import socket
import subprocess
import sys
import time
from dataclasses import dataclass
from datetime import timedelta

TARGET_POR_DEFECTO = "localhost:7233"   # = el default de worker_b.py / worker_soporte.py
NAMESPACE_POR_DEFECTO = "default"

OK, FALTA, SIN_API, INALCANZABLE = "ok", "falta", "sin_api", "inalcanzable"
# Más grave primero: un hallazgo medido (`falta`) manda sobre un vacío del instrumento.
_PRECEDENCIA = ((FALTA, 1), (INALCANZABLE, 3), (SIN_API, 2))


@dataclass(frozen=True)
class Esperado:
    unit: str
    queue: str
    target: str
    namespace: str
    identity: str


class UnitNoCorre(Exception):
    """MainPID=0: el unit no está corriendo. Es un fallo MEDIDO (`falta`), no un «no pude medir»."""

    def __init__(self, unit: str):
        super().__init__(f"{unit}: MainPID=0 (el unit no está corriendo)")
        self.unit = unit


def parse_spec(spec: str) -> tuple[str, str, str]:
    """`UNIT:ENVVAR:DEFAULT` -> (unit, envvar, default). Las tres partes son obligatorias."""
    partes = spec.split(":")
    if len(partes) != 3 or not all(p.strip() for p in partes):
        raise ValueError(f"spec inválida {spec!r}: se espera UNIT:ENVVAR:COLA_POR_DEFECTO")
    return partes[0].strip(), partes[1].strip(), partes[2].strip()


def leer_mainpid(unit: str) -> int:
    out = subprocess.run(["systemctl", "show", "-p", "MainPID", "--value", unit],
                         capture_output=True, text=True, check=True).stdout.strip()
    return int(out or 0)


def leer_environ(pid: int) -> dict[str, str]:
    with open(f"/proc/{pid}/environ", "rb") as f:
        crudo = f.read().decode("utf-8", errors="replace")
    pares = (kv.split("=", 1) for kv in crudo.split("\0") if "=" in kv)
    return {k: v for k, v in pares}


def construir_esperados(specs, *, mainpid=leer_mainpid, environ=leer_environ,
                        host=socket.gethostname) -> list[Esperado]:
    """Un `Esperado` por unit; si algún unit no corre levanta `UnitNoCorre`."""
    esperados = []
    for spec in specs:
        unit, envvar, por_defecto = parse_spec(spec)
        pid = mainpid(unit)
        if pid <= 0:
            raise UnitNoCorre(unit)
        env = environ(pid)
        esperados.append(Esperado(
            unit=unit,
            queue=env.get(envvar) or por_defecto,
            target=env.get("TEMPORAL_TARGET") or TARGET_POR_DEFECTO,
            namespace=env.get("TEMPORAL_NAMESPACE") or NAMESPACE_POR_DEFECTO,
            identity=f"{pid}@{host()}",
        ))
    return esperados


async def identities_de_la_cola(client, namespace: str, queue: str, rpc_timeout_s: float = 10.0) -> list[str]:
    from temporalio.api.enums.v1 import TaskQueueType
    from temporalio.api.taskqueue.v1 import TaskQueue
    from temporalio.api.workflowservice.v1 import DescribeTaskQueueRequest

    resp = await client.workflow_service.describe_task_queue(
        DescribeTaskQueueRequest(namespace=namespace, task_queue=TaskQueue(name=queue),
                                 task_queue_type=TaskQueueType.TASK_QUEUE_TYPE_WORKFLOW),
        timeout=timedelta(seconds=rpc_timeout_s))
    return [p.identity for p in resp.pollers]


def clasificar_error(exc: BaseException) -> str:
    """Un fallo al PREGUNTAR (la conexión ya estaba): ¿no llegué a Temporal o Temporal no contestó esto?

    `inalcanzable` sólo para fallos de transporte; cualquier otra cosa (API ausente, versión nueva, un
    TypeError del SDK, permiso) es `sin_api`: el instrumento no ve, y eso NO abre ni cierra el deploy."""
    from temporalio.service import RPCError, RPCStatusCode

    if isinstance(exc, (asyncio.TimeoutError, TimeoutError, OSError, ConnectionError)):
        return INALCANZABLE
    if isinstance(exc, RPCError) and exc.status in (
            RPCStatusCode.UNAVAILABLE, RPCStatusCode.DEADLINE_EXCEEDED, RPCStatusCode.CANCELLED):
        return INALCANZABLE
    return SIN_API


async def _una_lectura(e: Esperado, clientes: dict, conectar, rpc_timeout_s: float):
    """-> (estado, detalle). El detalle son los pollers vistos, o el error si no pude preguntar."""
    clave = (e.target, e.namespace)
    try:
        if clave not in clientes:
            clientes[clave] = await asyncio.wait_for(conectar(e.target, e.namespace), rpc_timeout_s)
    except Exception as exc:  # noqa: BLE001 - cualquier fallo de conexión es «no llegué a Temporal»
        return INALCANZABLE, [f"conectar a {e.target}: {type(exc).__name__}: {str(exc)[:160]}"]
    try:
        vistos = await asyncio.wait_for(
            identities_de_la_cola(clientes[clave], e.namespace, e.queue, rpc_timeout_s), rpc_timeout_s + 5)
    except Exception as exc:  # noqa: BLE001 - se clasifica; no se traga
        return clasificar_error(exc), [f"{type(exc).__name__}: {str(exc)[:200]}"]
    return (OK if e.identity in vistos else FALTA), vistos


async def verificar(esperados, *, conectar, timeout_s: float = 60.0, intervalo_s: float = 2.0,
                    rpc_timeout_s: float = 10.0, reloj=time.monotonic,
                    dormir=asyncio.sleep) -> dict[str, tuple[str, list[str]]]:
    """Reintenta hasta el plazo: un worker recién reiniciado tarda segundos en empezar a pollear.
    Devuelve {unit: (estado, detalle de la última lectura)}.

    `sin_api` no se reintenta: la API que no existe no aparece a los 10 segundos."""
    clientes: dict = {}
    resultado: dict[str, tuple[str, list[str]]] = {e.unit: (FALTA, []) for e in esperados}
    limite = reloj() + timeout_s
    while True:
        for e in esperados:
            if resultado[e.unit][0] in (OK, SIN_API):
                continue
            resultado[e.unit] = await _una_lectura(e, clientes, conectar, rpc_timeout_s)
        if all(est in (OK, SIN_API) for est, _ in resultado.values()) or reloj() >= limite:
            return resultado
        await dormir(intervalo_s)


def rc_global(estados) -> int:
    """El peor estado manda: un hallazgo (`falta`) > Temporal inalcanzable > API ausente > todo OK."""
    estados = set(estados)
    for estado, rc in _PRECEDENCIA:
        if estado in estados:
            return rc
    return 0


async def _conectar_real(target: str, namespace: str):
    from temporalio.client import Client
    return await Client.connect(target, namespace=namespace)


def informar(esperados, resultado) -> int:
    for e in esperados:
        estado, detalle = resultado[e.unit]
        donde = f"{e.queue!r} ({e.target}, ns={e.namespace})"
        if estado == OK:
            print(f"OK    {e.unit}: {e.identity} pollea {donde}")
        elif estado == FALTA:
            print(f"FALTA {e.unit}: {e.identity} NO figura entre los pollers de {donde}; "
                  f"pollers vistos: {detalle or 'ninguno'}")
        elif estado == SIN_API:
            print(f"NO VERIFICADO {e.unit}: Temporal está arriba pero no contestó DescribeTaskQueue "
                  f"({detalle[0] if detalle else '?'}). Esto NO es «faltan pollers»: el instrumento no ve.")
        else:
            print(f"NO PUDE PREGUNTAR {e.unit}: Temporal inalcanzable en {e.target} "
                  f"({detalle[0] if detalle else '?'}). Esto NO es «faltan pollers», pero tampoco es un pase.")
    return rc_global(estado for estado, _ in resultado.values())


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("specs", nargs="+", help="UNIT:ENVVAR:COLA_POR_DEFECTO")
    ap.add_argument("--timeout", type=float, default=60.0)
    ap.add_argument("--intervalo", type=float, default=2.0)
    ap.add_argument("--rpc-timeout", type=float, default=10.0)
    args = ap.parse_args(argv)
    try:
        esperados = construir_esperados(args.specs)
    except UnitNoCorre as e:
        print(f"FALTA {e}", file=sys.stderr)
        return 1
    except Exception as e:  # noqa: BLE001 - un instrumento que revienta no es un hallazgo (rc=2, no rc=1)
        print(f"NO VERIFICADO: no pude armar lo esperado: {type(e).__name__}: {e}", file=sys.stderr)
        return 2
    try:
        resultado = asyncio.run(verificar(esperados, conectar=_conectar_real, timeout_s=args.timeout,
                                          intervalo_s=args.intervalo, rpc_timeout_s=args.rpc_timeout))
    except Exception as e:  # noqa: BLE001
        print(f"NO VERIFICADO: el instrumento falló: {type(e).__name__}: {e}", file=sys.stderr)
        return 2
    return informar(esperados, resultado)


if __name__ == "__main__":
    sys.exit(main())
