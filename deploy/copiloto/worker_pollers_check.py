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

Declarado, no cubierto:
  · Prueba SUSCRIPCIÓN, no PROGRESO: un worker que pollea pero tiene el workflow task colgado lo cubre
    el gate de durabilidad `[4.95/7]`, no éste.
  · Sólo mira el poller de WORKFLOW (el de la sesión permanente). Los activities se registran junto con
    él en el mismo `Worker`.
  · Un worker lanzado con `Worker(identity=...)` propio no matchea `<pid>@<host>`: falla CERRADO y ruidoso.

Uso:  worker_pollers_check.py [--timeout S] [--intervalo S] UNIT:ENVVAR_DE_LA_COLA:COLA_POR_DEFECTO ...
rc 0 = todos suscriptos · 1 = alguno NO lo está al vencer el plazo (o su unit no corre) · 2 = no pude medir
"""
from __future__ import annotations

import argparse
import asyncio
import os
import socket
import subprocess
import sys
import time
from dataclasses import dataclass

TARGET_POR_DEFECTO = "localhost:7233"   # = el default de worker_b.py / worker_soporte.py
NAMESPACE_POR_DEFECTO = "default"


@dataclass(frozen=True)
class Esperado:
    unit: str
    queue: str
    target: str
    namespace: str
    identity: str


class UnitNoCorre(Exception):
    """MainPID=0: el unit no está corriendo. Es un fallo MEDIDO (rc=1), no un «no pude medir»."""

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


async def identities_de_la_cola(client, namespace: str, queue: str) -> list[str]:
    from temporalio.api.enums.v1 import TaskQueueType
    from temporalio.api.taskqueue.v1 import TaskQueue
    from temporalio.api.workflowservice.v1 import DescribeTaskQueueRequest

    resp = await client.workflow_service.describe_task_queue(DescribeTaskQueueRequest(
        namespace=namespace, task_queue=TaskQueue(name=queue),
        task_queue_type=TaskQueueType.TASK_QUEUE_TYPE_WORKFLOW))
    return [p.identity for p in resp.pollers]


async def verificar(esperados, *, conectar, timeout_s: float = 60.0, intervalo_s: float = 2.0,
                    reloj=time.monotonic, dormir=asyncio.sleep) -> dict[str, tuple[bool, list[str]]]:
    """Reintenta hasta el plazo: un worker recién reiniciado tarda segundos en empezar a pollear.
    Devuelve {unit: (suscripto, identities_vistas_en_la_última_lectura)}."""
    clientes: dict = {}
    resultado: dict[str, tuple[bool, list[str]]] = {e.unit: (False, []) for e in esperados}
    limite = reloj() + timeout_s
    while True:
        for e in esperados:
            if resultado[e.unit][0]:
                continue
            clave = (e.target, e.namespace)
            if clave not in clientes:
                clientes[clave] = await conectar(e.target, e.namespace)
            vistos = await identities_de_la_cola(clientes[clave], e.namespace, e.queue)
            resultado[e.unit] = (e.identity in vistos, vistos)
        if all(ok for ok, _ in resultado.values()) or reloj() >= limite:
            return resultado
        await dormir(intervalo_s)


async def _conectar_real(target: str, namespace: str):
    from temporalio.client import Client
    return await Client.connect(target, namespace=namespace)


def informar(esperados, resultado) -> int:
    rc = 0
    for e in esperados:
        ok, vistos = resultado[e.unit]
        if ok:
            print(f"OK    {e.unit}: {e.identity} pollea {e.queue!r} ({e.target}, ns={e.namespace})")
        else:
            rc = 1
            print(f"FALTA {e.unit}: {e.identity} NO figura entre los pollers de {e.queue!r} "
                  f"({e.target}, ns={e.namespace}); pollers vistos: {vistos or 'ninguno'}")
    return rc


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("specs", nargs="+", help="UNIT:ENVVAR:COLA_POR_DEFECTO")
    ap.add_argument("--timeout", type=float, default=60.0)
    ap.add_argument("--intervalo", type=float, default=2.0)
    args = ap.parse_args(argv)
    try:
        esperados = construir_esperados(args.specs)
    except UnitNoCorre as e:
        print(f"FALTA {e}", file=sys.stderr)
        return 1
    except (ValueError, OSError, subprocess.CalledProcessError) as e:
        print(f"NO PUDE MEDIR: {type(e).__name__}: {e}", file=sys.stderr)
        return 2
    try:
        resultado = asyncio.run(verificar(esperados, conectar=_conectar_real,
                                          timeout_s=args.timeout, intervalo_s=args.intervalo))
    except Exception as e:  # noqa: BLE001 - un fallo al conectar es «no pude medir», no «está bien»
        print(f"NO PUDE MEDIR: {type(e).__name__}: {e}", file=sys.stderr)
        return 2
    return informar(esperados, resultado)


if __name__ == "__main__":
    sys.exit(main())
