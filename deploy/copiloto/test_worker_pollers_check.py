"""WORKERPOLLER — el check «el worker está SUSCRIPTO a su cola, no sólo vivo».

Los tres casos que importan corren contra un Temporal REAL (dev server local, `start_local`) con un
`Worker` real: el servidor de tiempo simulado NO implementa `DescribeTaskQueue` (medido 2026-10-13:
«Method ... DescribeTaskQueue is unimplemented»), así que ahí el test habría medido otra cosa.

Control positivo y hostil juntos:
  · suscripto      -> el MainPID del unit figura entre los pollers      -> True
  · vivo sin poll  -> nadie pollea la cola (es el `is-active` verde)    -> False
  · otro proceso   -> alguien pollea la cola, pero no el PID del unit   -> False
"""
from __future__ import annotations

import os
import re
import socket
from contextlib import asynccontextmanager
from pathlib import Path

import pytest
from temporalio import workflow
from temporalio.testing import WorkflowEnvironment
from temporalio.worker import UnsandboxedWorkflowRunner, Worker

import worker_pollers_check as w

RAIZ = Path(__file__).resolve().parents[2]
HOST = socket.gethostname()


@workflow.defn(name="NoopPoller")
class NoopPoller:
    @workflow.run
    async def run(self) -> None:
        return None


@asynccontextmanager
async def _temporal_con_worker(queue: str | None):
    """Dev server real + (opcional) un Worker real pollando `queue`."""
    async with await WorkflowEnvironment.start_local() as env:
        if queue is None:
            yield env
            return
        async with Worker(env.client, task_queue=queue, workflows=[NoopPoller],
                          workflow_runner=UnsandboxedWorkflowRunner()):
            yield env


def _esperado(queue: str, pid: int, unit: str = "uc-x.service") -> w.Esperado:
    return w.Esperado(unit=unit, queue=queue, target="x:0", namespace="default", identity=f"{pid}@{HOST}")


async def _verificar(env, esperado: w.Esperado, **kw):
    async def conectar(_target, _ns):
        return env.client
    return await w.verificar([esperado], conectar=conectar, **kw)


@pytest.mark.asyncio
async def test_el_worker_que_pollea_su_cola_figura_con_el_pid_del_unit():
    async with _temporal_con_worker("q-poller-ok") as env:
        # En el test el «MainPID» del unit es el propio proceso: el SDK arma `<pid>@<host>`.
        res = await _verificar(env, _esperado("q-poller-ok", os.getpid()), timeout_s=20, intervalo_s=0.3)
    ok, vistos = res["uc-x.service"]
    assert ok, f"el worker real no figuró entre los pollers: {vistos}"
    assert f"{os.getpid()}@{HOST}" in vistos


@pytest.mark.asyncio
async def test_un_unit_vivo_que_no_pollea_su_cola_NO_pasa():
    """El caso que `is-active` no ve: el proceso existe, la cola no tiene a nadie."""
    async with _temporal_con_worker(None) as env:
        res = await _verificar(env, _esperado("q-sin-nadie", os.getpid()), timeout_s=1.5, intervalo_s=0.3)
    ok, vistos = res["uc-x.service"]
    assert not ok
    assert vistos == []


@pytest.mark.asyncio
async def test_si_pollea_otro_proceso_no_se_da_por_suscripto_al_unit():
    """La cola tiene un poller, pero no es el MainPID del unit (p. ej. un worker huérfano de un deploy
    anterior): matchear por «hay alguien» daría verde con el unit nuevo muerto."""
    async with _temporal_con_worker("q-poller-ajeno") as env:
        res = await _verificar(env, _esperado("q-poller-ajeno", os.getpid() + 1), timeout_s=1.5,
                               intervalo_s=0.3)
    ok, vistos = res["uc-x.service"]
    assert not ok
    assert f"{os.getpid()}@{HOST}" in vistos, "debía verse al poller real, sólo que no es el del unit"


class _ClienteQueEmpiezaVacio:
    """describe_task_queue devuelve 0 pollers las primeras `vacias` veces y después al poller real."""

    def __init__(self, vacias: int, identity: str):
        self.vacias, self.identity, self.llamadas = vacias, identity, 0
        self.workflow_service = self

    async def describe_task_queue(self, _req):
        from types import SimpleNamespace
        self.llamadas += 1
        if self.llamadas <= self.vacias:
            return SimpleNamespace(pollers=[])
        return SimpleNamespace(pollers=[SimpleNamespace(identity=self.identity)])


@pytest.mark.asyncio
async def test_reintenta_hasta_el_plazo_porque_el_worker_recien_reiniciado_tarda_en_pollear():
    e = _esperado("q", 99)
    cliente = _ClienteQueEmpiezaVacio(vacias=3, identity=e.identity)
    ahora = {"t": 0.0}

    async def conectar(_t, _n):
        return cliente

    async def dormir(s):
        ahora["t"] += s

    res = await w.verificar([e], conectar=conectar, timeout_s=60, intervalo_s=2,
                            reloj=lambda: ahora["t"], dormir=dormir)
    assert res[e.unit][0] is True
    assert cliente.llamadas == 4, "debía reintentar las 3 lecturas vacías y parar en la primera buena"


@pytest.mark.asyncio
async def test_al_vencer_el_plazo_deja_de_reintentar_y_falla():
    e = _esperado("q", 99)
    cliente = _ClienteQueEmpiezaVacio(vacias=10**6, identity=e.identity)
    ahora = {"t": 0.0}

    async def conectar(_t, _n):
        return cliente

    async def dormir(s):
        ahora["t"] += s

    res = await w.verificar([e], conectar=conectar, timeout_s=10, intervalo_s=2,
                            reloj=lambda: ahora["t"], dormir=dormir)
    assert res[e.unit][0] is False
    assert cliente.llamadas == 6   # t=0,2,4,6,8,10 -> en t=10 vence y no duerme más


def test_construir_esperados_toma_cola_y_target_del_environ_del_proceso():
    envs = {4242: {"AGENT_B_TASK_QUEUE": "q-del-proceso", "TEMPORAL_TARGET": "t:1", "TEMPORAL_NAMESPACE": "ns"}}
    [e] = w.construir_esperados(["u.service:AGENT_B_TASK_QUEUE:agent-emprendedor"],
                                mainpid=lambda unit: 4242, environ=lambda pid: envs[pid], host=lambda: "h")
    assert (e.queue, e.target, e.namespace, e.identity) == ("q-del-proceso", "t:1", "ns", "4242@h")


def test_sin_variable_en_el_proceso_rige_el_default_del_worker():
    [e] = w.construir_esperados(["u.service:SOPORTE_TASK_QUEUE:agent-soporte"],
                                mainpid=lambda unit: 7, environ=lambda pid: {}, host=lambda: "h")
    assert (e.queue, e.target, e.namespace) == ("agent-soporte", "localhost:7233", "default")


def test_un_unit_con_mainpid_cero_es_un_fallo_medido():
    with pytest.raises(w.UnitNoCorre):
        w.construir_esperados(["u.service:Q:q"], mainpid=lambda unit: 0, environ=lambda pid: {},
                              host=lambda: "h")


def test_main_distingue_unit_caido_de_no_pude_medir(monkeypatch, capsys):
    def unit_caido(specs, **kw):
        raise w.UnitNoCorre("u.service")
    monkeypatch.setattr(w, "construir_esperados", unit_caido)
    assert w.main(["u.service:Q:q"]) == 1
    monkeypatch.undo()
    assert w.main(["spec-sin-partes"]) == 2   # el instrumento no pudo mirar: otro rc, mismo abort


def test_los_defaults_del_deploy_son_los_de_los_workers_que_lanza():
    """Los nombres de cola por defecto viven en 3 lugares (worker_b, worker_soporte, deploy.sh). Si uno
    cambia y el check sigue mirando la cola vieja, daría FALTA siempre (o peor, otra cola). Este test es
    el cable entre los tres."""
    deploy = (RAIZ / "deploy/copiloto/deploy.sh").read_text(encoding="utf-8")
    b = re.search(r'AGENT_B_TASK_QUEUE\s*=\s*os\.environ\.get\("AGENT_B_TASK_QUEUE",\s*"([^"]+)"\)',
                  (RAIZ / "apps/copiloto/worker_b.py").read_text(encoding="utf-8"))
    s = re.search(r'SOPORTE_TASK_QUEUE\s*=\s*os\.environ\.get\("SOPORTE_TASK_QUEUE",\s*"([^"]+)"\)',
                  (RAIZ / "apps/copiloto/worker_soporte.py").read_text(encoding="utf-8"))
    assert b and s, "no encontré el default de la cola en worker_b.py / worker_soporte.py"
    assert f':AGENT_B_TASK_QUEUE:{b.group(1)}"' in deploy
    assert f':SOPORTE_TASK_QUEUE:{s.group(1)}"' in deploy


def test_el_deploy_corre_el_check_antes_del_publish_y_aborta():
    """El check tiene que estar en [5/7] (antes de [5.5/7]) y poder ABORTAR: un `|| true` o un lugar
    posterior al publish lo volvería cosmético."""
    deploy = (RAIZ / "deploy/copiloto/deploy.sh").read_text(encoding="utf-8")
    i_check = deploy.index("worker_pollers_check.py")
    i_publish = deploy.index("[5.5/7] publish del shell")
    assert i_check < i_publish
    linea = next(l for l in deploy[i_check - 200:i_check + 600].splitlines() if "worker_pollers_check.py" in l)
    assert "|| true" not in deploy[i_check:i_check + 700]
    assert linea  # la invocación existe en una línea propia
