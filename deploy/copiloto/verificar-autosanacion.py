#!/usr/bin/env python3
"""Salud del ciclo de autosanación, en un comando.

Responde la pregunta que el log NO responde: **¿el ciclo está vivo, o sólo callado?**
En un sistema bien construido la superficie de error tiende a cero y el desenlace normal es
`sin_traumas` — que es *idéntico* al de un ciclo con el cable de detección cortado. Este script
separa las dos cosas mirando el mecanismo, no el resultado.

Corre en el VPS, con el venv del servicio:

    set -a; . /etc/unreal-copilot/copiloto.env; set +a
    /opt/uc-copiloto-venv/bin/python deploy/copiloto/verificar-autosanacion.py

Sale 1 si algo está mal. Cuatro medidas:
  1. SCHEDULE   — existe, no está pausado, y con qué horas de disparo.
  2. DISPARÓ    — ¿hubo una corrida AUTOMÁTICA (en una hora programada), o sólo manuales?
                  Distinción clave: una corrida manual demuestra el ciclo, NO el Schedule.
  3. DESENLACES — qué devolvió cada corrida reciente, con su trauma y su PR.
  4. DLQ        — cuántos traumas hay, y si la tabla recibió inserts alguna vez (la secuencia).
                  DLQ en 0 con secuencia en 0 = nunca entró nada: el cable no está probado.
                  DLQ en 0 con secuencia > 0 = entraron y se procesaron. Muy distinto.
"""
from __future__ import annotations

import asyncio
import os
import sys

SCHEDULE_ID = os.environ.get("COPILOTO_AUTOSANACION_SCHEDULE_ID", "autosanacion-global")


def _horas_del_spec(spec) -> list[int]:
    horas: set[int] = set()
    for cal in getattr(spec, "calendars", []) or []:
        for r in getattr(cal, "hour", []) or []:
            horas.update(range(r.start, r.end + 1, r.step or 1))
    return sorted(horas)


async def revisar_schedule(fallas: list[str]) -> None:
    from temporalio.client import Client

    cliente = await Client.connect(
        os.environ.get("TEMPORAL_ADDRESS", "127.0.0.1:7233"),
        namespace=os.environ.get("TEMPORAL_NAMESPACE", "default"),
    )
    try:
        d = await cliente.get_schedule_handle(SCHEDULE_ID).describe()
    except Exception as e:  # noqa: BLE001
        fallas.append(f"no existe el Schedule '{SCHEDULE_ID}': {type(e).__name__}")
        print(f"[MAL] schedule '{SCHEDULE_ID}': no se pudo describir")
        return

    horas = _horas_del_spec(d.schedule.spec)
    pausado = d.schedule.state.paused
    print(f"[{'MAL' if pausado else 'OK '}] schedule '{SCHEDULE_ID}': "
          f"{'PAUSADO' if pausado else 'activo'} · horas {horas} · "
          f"próxima {d.info.next_action_times[:1]}")
    if pausado:
        fallas.append(f"el Schedule está pausado (nota: {d.schedule.state.note or '-'})")
    if not horas:
        fallas.append("el Schedule no declara ninguna hora de disparo")

    # --- ¿disparó SOLO alguna vez? Una corrida manual no prueba el Schedule. ---
    recientes = list(d.info.recent_actions)
    automaticas = [a for a in recientes if a.scheduled_at.hour in horas and a.scheduled_at.minute == 0]
    print(f"[{'OK ' if automaticas else 'MAL'}] corridas: {len(recientes)} recientes, "
          f"{len(automaticas)} en hora programada (el resto fueron disparos manuales)")
    if not automaticas:
        fallas.append("ninguna corrida AUTOMÁTICA todavía: el ciclo está probado, el Schedule no")

    for a in recientes[-6:]:
        act = a.action
        wid = getattr(act, "workflow_id", None)
        rid = getattr(act, "first_execution_run_id", None)
        marca = "auto" if (a.scheduled_at.hour in horas and a.scheduled_at.minute == 0) else "manual"
        try:
            r = await cliente.get_workflow_handle(wid, run_id=rid).result()
            print(f"      {a.scheduled_at:%m-%d %H:%M} [{marca:6}] {r}")
        except Exception as e:  # noqa: BLE001
            print(f"      {a.scheduled_at:%m-%d %H:%M} [{marca:6}] ERROR {type(e).__name__}: {str(e)[:70]}")
            fallas.append(f"la corrida {wid} terminó en error")


def revisar_dlq(fallas: list[str]) -> None:
    import psycopg2

    # El DSN del CICLO primero: su rol tiene `BYPASSRLS` porque el auditor es global (uno para toda
    # la app, no uno por tenant). Los otros DSN son de la app, cuyo rol está sujeto a RLS `FORCE`.
    #
    # ⚠️ Medido el 2026-08-02: con un DSN de app y sin declarar la GUC de tenant, `select count(*)
    # from uc_factory.copiloto_traumas` devuelve **0 SIEMPRE** — no porque no haya filas, sino porque la policy
    # no deja verlas. Este verificador reportó "0 traumas" y "el canario nunca se disparó" mientras
    # la fila del canario estaba en la tabla (id 14). Un instrumento ciego no dice "no veo": dice
    # "no hay", que es la peor forma de mentir ([[instrumentos-que-confirman-en-vez-de-verificar]]).
    dsn = os.environ.get("COPILOTO_AUTOSANACION_DSN") or next(
        (os.environ[k] for k in ("COPILOTO_PG_DSN", "DATABASE_URL", "PG_DSN", "FUSION_PG_DSN")
         if os.environ.get(k)), None)
    if not dsn:
        print("[MAL] DLQ: no hay DSN en el entorno — ¿cargaste los EnvironmentFile del servicio?")
        fallas.append("sin DSN: la DLQ quedó SIN medir")
        return

    # Control de ceguera, ANTES de contar: si el rol no saltea RLS, cualquier cero que sigue es
    # indistinguible de "no puedo ver". Preguntárselo al catálogo cuesta una query y evita publicar
    # un número que no significa nada.
    with psycopg2.connect(dsn) as c, c.cursor() as cur:
        cur.execute("select current_user, coalesce((select rolbypassrls from pg_roles "
                    "where rolname = current_user), false)")
        rol, ve_todo = cur.fetchone()
    if not ve_todo:
        print(f"[MAL] DLQ: el rol '{rol}' NO tiene BYPASSRLS — cualquier conteo sería ceguera, "
              "no ausencia. Cargá COPILOTO_AUTOSANACION_DSN (el rol del ciclo)")
        fallas.append(f"medida ciega: '{rol}' está sujeto a RLS y no puede ver la DLQ completa")
        return

    with psycopg2.connect(dsn) as c, c.cursor() as cur:
        cur.execute("select count(*) from uc_factory.copiloto_traumas")
        vivos = cur.fetchone()[0]
        cur.execute("select last_value, is_called from uc_factory.copiloto_traumas_id_seq")
        ultimo, arrancada = cur.fetchone()
        emitidos = ultimo if arrancada else 0
        cur.execute("select estado, count(*) from uc_factory.copiloto_traumas group by estado order by 2 desc")
        por_estado = cur.fetchall()

    # El control que hace significativo al cero: una DLQ vacía puede ser "no falla nada" o
    # "no entra nada". La secuencia las distingue — es lo único que recuerda los que ya pasaron.
    if emitidos == 0:
        print("[MAL] DLQ: 0 traumas y la secuencia nunca avanzó — el cable NUNCA fue ejercitado")
        fallas.append("la DLQ jamás recibió un insert: detección sin demostrar")
    else:
        print(f"[OK ] DLQ: {vivos} traumas ahora · {emitidos} ids emitidos históricos "
              f"(el cable sí fue ejercitado) · por estado: {por_estado or '—'}")

    revisar_canario(dsn, fallas)


#: Un canario más viejo que esto ya no dice nada del presente: el cable pudo cortarse ayer.
DIAS_DE_VIGENCIA_DEL_CANARIO = 7


def revisar_canario(dsn: str, fallas: list[str]) -> None:
    """La prueba de vida: ¿cuándo fue la última vez que el camino completo funcionó?

    Es la medida que vuelve informativo al silencio. `sin_traumas` significa "no falla nada" **sólo
    si** el canario pasó hace poco; sin eso significa "no sé", que es lo que este frente ya pagó.

    Y la vigencia importa tanto como el hecho: un canario que pasó hace un mes prueba que el cable
    estaba sano hace un mes. La evidencia vence.
    """
    import psycopg2

    with psycopg2.connect(dsn) as c, c.cursor() as cur:
        cur.execute("""SELECT max(created_at), count(*)
                         FROM uc_factory.copiloto_traumas WHERE error_type = 'ErrorDeCanario'""")
        ultimo, cuantos = cur.fetchone()

    if not ultimo:
        print("[MAL] canario: nunca se disparó — el camino detección→DLQ no tiene prueba de vida")
        fallas.append("sin canario: un 'sin_traumas' no se puede distinguir de un cable cortado")
        return

    import datetime as _dt

    edad = _dt.datetime.now(_dt.timezone.utc) - ultimo.astimezone(_dt.timezone.utc)
    dias = edad.days
    vencido = dias > DIAS_DE_VIGENCIA_DEL_CANARIO
    print(f"[{'MAL' if vencido else 'OK '}] canario: última prueba de vida hace {dias} día(s) "
          f"({ultimo:%Y-%m-%d %H:%M} UTC) · {cuantos} registro(s)")
    if vencido:
        fallas.append(f"el canario no pasa hace {dias} días (vigencia: "
                      f"{DIAS_DE_VIGENCIA_DEL_CANARIO}): la salud del cable es una foto vieja")


async def main() -> int:
    fallas: list[str] = []
    await revisar_schedule(fallas)
    try:
        revisar_dlq(fallas)
    except Exception as e:  # noqa: BLE001
        print(f"[MAL] DLQ: {type(e).__name__}: {str(e)[:90]}")
        fallas.append("no se pudo consultar la DLQ")

    print()
    if fallas:
        for f in fallas:
            print(f"FALLA: {f}")
        return 1
    print("Ciclo de autosanación sano: dispara solo, corre entero y la DLQ está cableada.")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
