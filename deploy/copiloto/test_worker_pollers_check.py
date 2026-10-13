"""WORKERPOLLER — el check «el worker está SUSCRIPTO a su cola, no sólo vivo».

Los casos que importan corren contra un Temporal REAL (dev server local, `start_local`) con un `Worker`
real. Y los dos fallos del PROPIO instrumento contra su condición real, no contra un mock:
  · API ausente      -> el servidor de tiempo simulado responde «DescribeTaskQueue is unimplemented»
                        (medido 2026-10-13): estado `sin_api`, NO `falta`
  · Temporal caído   -> un puerto cerrado: estado `inalcanzable`, NO `falta` y NO `ok`

Control positivo y hostil juntos:
  · suscripto      -> el MainPID del unit figura entre los pollers      -> ok
  · vivo sin poll  -> nadie pollea la cola (es el `is-active` verde)    -> falta
  · otro proceso   -> alguien pollea la cola, pero no el PID del unit   -> falta
"""
from __future__ import annotations

import os
import re
import socket
from contextlib import asynccontextmanager
from pathlib import Path
from types import SimpleNamespace

import pytest
from temporalio import workflow
from temporalio.service import RPCError, RPCStatusCode
from temporalio.testing import WorkflowEnvironment
from temporalio.worker import UnsandboxedWorkflowRunner, Worker

import worker_pollers_check as w

RAIZ = Path(__file__).resolve().parents[2]
HOST = socket.gethostname()
UNIT = "uc-x.service"


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


def _esperado(queue: str, pid: int, unit: str = UNIT) -> w.Esperado:
    return w.Esperado(unit=unit, queue=queue, target="x:0", namespace="default", identity=f"{pid}@{HOST}")


async def _verificar(env, esperado: w.Esperado, **kw):
    async def conectar(_target, _ns):
        return env.client
    return await w.verificar([esperado], conectar=conectar, **kw)


# ── los tres estados que mide Temporal ───────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_el_worker_que_pollea_su_cola_figura_con_el_pid_del_unit():
    async with _temporal_con_worker("q-poller-ok") as env:
        # En el test el «MainPID» del unit es el propio proceso: el SDK arma `<pid>@<host>`.
        res = await _verificar(env, _esperado("q-poller-ok", os.getpid()), timeout_s=20, intervalo_s=0.3)
    estado, vistos = res[UNIT]
    assert estado == w.OK, f"el worker real no figuró entre los pollers: {vistos}"
    assert f"{os.getpid()}@{HOST}" in vistos


@pytest.mark.asyncio
async def test_un_unit_vivo_que_no_pollea_su_cola_NO_pasa():
    """El caso que `is-active` no ve: el proceso existe, la cola no tiene a nadie."""
    async with _temporal_con_worker(None) as env:
        res = await _verificar(env, _esperado("q-sin-nadie", os.getpid()), timeout_s=1.5, intervalo_s=0.3)
    estado, vistos = res[UNIT]
    assert estado == w.FALTA
    assert vistos == []


@pytest.mark.asyncio
async def test_si_pollea_otro_proceso_no_se_da_por_suscripto_al_unit():
    """La cola tiene un poller, pero no es el MainPID del unit (p. ej. un worker huérfano de un deploy
    anterior): matchear por «hay alguien» daría verde con el unit nuevo muerto."""
    async with _temporal_con_worker("q-poller-ajeno") as env:
        res = await _verificar(env, _esperado("q-poller-ajeno", os.getpid() + 1), timeout_s=1.5,
                               intervalo_s=0.3)
    estado, vistos = res[UNIT]
    assert estado == w.FALTA
    assert f"{os.getpid()}@{HOST}" in vistos, "debía verse al poller real, sólo que no es el del unit"


# ── los fallos del PROPIO instrumento: ni «falta» ni «ok» ────────────────────────────────────────

@pytest.mark.asyncio
async def test_si_temporal_no_implementa_la_API_es_sin_api_no_falta():
    """El servidor de tiempo simulado NO implementa DescribeTaskQueue. Un instrumento que lo leyera como
    «0 pollers» acusaría un worker caído que no lo está; leído como «ok», daría luz verde a ciegas."""
    async with await WorkflowEnvironment.start_time_skipping() as env:
        res = await _verificar(env, _esperado("q-cualquiera", os.getpid()), timeout_s=30, intervalo_s=0.3)
    estado, detalle = res[UNIT]
    assert estado == w.SIN_API, f"{estado}: {detalle}"
    assert "unimplemented" in detalle[0].lower()


@pytest.mark.asyncio
async def test_si_temporal_no_responde_es_inalcanzable_no_falta_ni_ok():
    """Puerto cerrado: no llegué a Temporal. Mismo código de salida que `falta` sería abortar un deploy
    sano por una causa que no es del worker; pasarlo en verde sería fallar abierto."""
    e = w.Esperado(unit=UNIT, queue="q", target="127.0.0.1:1", namespace="default", identity="1@h")
    res = await w.verificar([e], conectar=w._conectar_real, timeout_s=3, intervalo_s=0.5, rpc_timeout_s=2)
    estado, detalle = res[UNIT]
    assert estado == w.INALCANZABLE, f"{estado}: {detalle}"


def test_el_peor_estado_manda_en_el_rc_global():
    assert w.rc_global([w.OK, w.OK]) == 0
    assert w.rc_global([w.OK, w.SIN_API]) == 2
    assert w.rc_global([w.OK, w.INALCANZABLE]) == 3
    assert w.rc_global([w.SIN_API, w.INALCANZABLE]) == 3, "inalcanzable aborta; sin_api no: gana el que aborta"
    assert w.rc_global([w.FALTA, w.INALCANZABLE, w.SIN_API]) == 1, "un hallazgo medido manda sobre un vacío"


def test_clasificar_error_separa_transporte_de_api_ausente():
    assert w.clasificar_error(TimeoutError()) == w.INALCANZABLE
    assert w.clasificar_error(ConnectionRefusedError()) == w.INALCANZABLE
    assert w.clasificar_error(RPCError("x", RPCStatusCode.UNAVAILABLE, b"")) == w.INALCANZABLE
    assert w.clasificar_error(RPCError("x", RPCStatusCode.DEADLINE_EXCEEDED, b"")) == w.INALCANZABLE
    assert w.clasificar_error(RPCError("x", RPCStatusCode.UNIMPLEMENTED, b"")) == w.SIN_API
    assert w.clasificar_error(TypeError("cambió la firma del SDK")) == w.SIN_API


# ── reintento y plazo (deterministas) ────────────────────────────────────────────────────────────

class _ClienteQueEmpiezaVacio:
    """describe_task_queue devuelve 0 pollers las primeras `vacias` veces y después al poller real."""

    def __init__(self, vacias: int, identity: str):
        self.vacias, self.identity, self.llamadas = vacias, identity, 0
        self.workflow_service = self

    async def describe_task_queue(self, _req, **_kw):
        self.llamadas += 1
        if self.llamadas <= self.vacias:
            return SimpleNamespace(pollers=[])
        return SimpleNamespace(pollers=[SimpleNamespace(identity=self.identity)])


class _ClienteQueFalla:
    def __init__(self, exc: Exception):
        self.exc, self.llamadas = exc, 0
        self.workflow_service = self

    async def describe_task_queue(self, _req, **_kw):
        self.llamadas += 1
        raise self.exc


def _reloj_falso():
    ahora = {"t": 0.0}

    async def dormir(s):
        ahora["t"] += s
    return (lambda: ahora["t"]), dormir


@pytest.mark.asyncio
async def test_reintenta_hasta_el_plazo_porque_el_worker_recien_reiniciado_tarda_en_pollear():
    e = _esperado("q", 99)
    cliente = _ClienteQueEmpiezaVacio(vacias=3, identity=e.identity)
    reloj, dormir = _reloj_falso()

    async def conectar(_t, _n):
        return cliente

    res = await w.verificar([e], conectar=conectar, timeout_s=60, intervalo_s=2, reloj=reloj, dormir=dormir)
    assert res[e.unit][0] == w.OK
    assert cliente.llamadas == 4, "debía reintentar las 3 lecturas vacías y parar en la primera buena"


@pytest.mark.asyncio
async def test_al_vencer_el_plazo_deja_de_reintentar_y_falla():
    e = _esperado("q", 99)
    cliente = _ClienteQueEmpiezaVacio(vacias=10**6, identity=e.identity)
    reloj, dormir = _reloj_falso()

    async def conectar(_t, _n):
        return cliente

    res = await w.verificar([e], conectar=conectar, timeout_s=10, intervalo_s=2, reloj=reloj, dormir=dormir)
    assert res[e.unit][0] == w.FALTA
    assert cliente.llamadas == 6   # t=0,2,4,6,8,10 -> en t=10 vence y no duerme más


@pytest.mark.asyncio
async def test_una_API_ausente_no_se_reintenta_hasta_agotar_el_plazo():
    """No aparece a los 10 segundos: reintentarla sólo demora el deploy 60 s."""
    e = _esperado("q", 99)
    cliente = _ClienteQueFalla(RPCError("Method DescribeTaskQueue is unimplemented",
                                        RPCStatusCode.UNIMPLEMENTED, b""))
    reloj, dormir = _reloj_falso()

    async def conectar(_t, _n):
        return cliente

    res = await w.verificar([e], conectar=conectar, timeout_s=60, intervalo_s=2, reloj=reloj, dormir=dormir)
    assert res[e.unit][0] == w.SIN_API
    assert cliente.llamadas == 1


@pytest.mark.asyncio
async def test_sin_api_en_un_unit_no_se_vuelve_a_preguntar_mientras_otro_sigue_reintentando():
    """El caso donde el skip importa: con UN solo unit el loop ya corta por «todos resueltos»; con dos,
    uno sigue vivo y el otro (API ausente) no tiene por qué recibir una consulta por pasada."""
    a = w.Esperado(unit="a.service", queue="qa", target="a:0", namespace="default", identity=f"1@{HOST}")
    b = w.Esperado(unit="b.service", queue="qb", target="b:0", namespace="default", identity=f"2@{HOST}")
    cli_a = _ClienteQueFalla(RPCError("unimplemented", RPCStatusCode.UNIMPLEMENTED, b""))
    cli_b = _ClienteQueEmpiezaVacio(vacias=3, identity=b.identity)
    reloj, dormir = _reloj_falso()

    async def conectar(target, _n):
        return {"a:0": cli_a, "b:0": cli_b}[target]

    res = await w.verificar([a, b], conectar=conectar, timeout_s=60, intervalo_s=2, reloj=reloj, dormir=dormir)
    assert res["a.service"][0] == w.SIN_API and res["b.service"][0] == w.OK
    assert cli_b.llamadas == 4
    assert cli_a.llamadas == 1, "la API ausente no aparece a los 2 segundos: no se reintenta"


@pytest.mark.asyncio
async def test_un_fallo_transitorio_de_transporte_se_reintenta_y_puede_recuperarse():
    e = _esperado("q", 99)
    reloj, dormir = _reloj_falso()
    estado = {"n": 0}

    class _Cliente:
        workflow_service = None

        async def describe_task_queue(self, _req, **_kw):
            estado["n"] += 1
            if estado["n"] == 1:
                raise RPCError("blip", RPCStatusCode.UNAVAILABLE, b"")
            return SimpleNamespace(pollers=[SimpleNamespace(identity=e.identity)])

    c = _Cliente()
    c.workflow_service = c

    async def conectar(_t, _n):
        return c

    res = await w.verificar([e], conectar=conectar, timeout_s=60, intervalo_s=2, reloj=reloj, dormir=dormir)
    assert res[e.unit][0] == w.OK


# ── lo esperado se arma del proceso, no de una copia ─────────────────────────────────────────────

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


def test_main_unit_caido_es_rc1_y_un_instrumento_roto_es_rc2(monkeypatch):
    """Unit caído = hallazgo (aborta). El instrumento que revienta NO puede salir como hallazgo: un
    traceback de Python termina en rc=1, que el deploy leería como «el worker no pollea»."""
    def unit_caido(specs, **kw):
        raise w.UnitNoCorre("u.service")
    monkeypatch.setattr(w, "construir_esperados", unit_caido)
    assert w.main(["u.service:Q:q"]) == 1

    def roto(specs, **kw):
        raise KeyError("cambió el formato de /proc")
    monkeypatch.setattr(w, "construir_esperados", roto)
    assert w.main(["u.service:Q:q"]) == 2
    monkeypatch.undo()
    assert w.main(["spec-sin-partes"]) == 2


# ── el cable con deploy.sh ───────────────────────────────────────────────────────────────────────

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


def test_el_deploy_corre_el_check_antes_del_publish():
    """El check tiene que estar en [5/7], antes de [5.5/7]. Que ABORTE (y que `sin_api` no lo haga) lo
    ejercita `test_guard_workers_activos.sh` sobre el bloque real, no un grep de este archivo."""
    deploy = (RAIZ / "deploy/copiloto/deploy.sh").read_text(encoding="utf-8")
    assert deploy.index("worker_pollers_check.py") < deploy.index("[5.5/7] publish del shell")
