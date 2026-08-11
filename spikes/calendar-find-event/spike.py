#!/usr/bin/env python3
"""Spike CAL1 §1 -- de-risk de GOOGLECALENDAR_FIND_EVENT contra Composio REAL, tenant canónico.

Corre EN EL VPS (necesita COMPOSIO_API_KEY del env de producción + el SDK `composio` del venv).
NO se ejecuta en la PC (regla 2 de CLAUDE.md).

Qué contesta (lo que pide el contrato CAL1 antes de fijar el shape del endpoint):
  1. ¿`googlecalendar` está conectado para el tenant canónico?
  2. Forma REAL de la respuesta de FIND (campos -- se vuelca el JSON crudo, no solo lo que ya
     extrae `_events()` de test_e2e.py).
  3. Filtro por rango de fecha: ¿cómo se pide "hoy"? ¿local o UTC?
  4. Recurrencias: ¿el FIND las expande (una fila por ocurrencia) o hay que expandirlas nosotros?

Reusa EXACTO el shape de argumentos que ya usa `dispatcher_emprendedor.py` para el CREATE real
(`summary`/`start_datetime`/`end_datetime`/`timezone`, sin offset embebido) -- no inventa un shape
nuevo. El tenant canónico está "limpio/vacío" (memoria/usuario-de-prueba-canonico...), así que si
no hay eventos hoy, el spike crea 2 sintéticos (uno simple, uno con recurrence) para poder
inspeccionar el shape real, y los borra al final -- mismo patrón de cleanup que test_e2e.py.

Uso (en el VPS, con el venv activo y el env cargado):
    python spikes/calendar-find-event/spike.py
"""
from __future__ import annotations

import json
import sys
from datetime import datetime, timedelta, timezone as dt_timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "apps" / "copiloto"))
from _paths import ensure_paths  # noqa: E402
ensure_paths()

from clients.agent.providers.composio_gateway import (  # noqa: E402
    ComposioGateway, ComposioExecutionError, ConnectionRequired,
)
from calendar_policy import CALENDAR_POLICY, CREATE_EVENT_SLUG, FIND_EVENT_SLUG  # noqa: E402

USER_ID = "4f3ecb78-2e36-4044-a56e-0e7ef6c4a655"  # e2e-device@copiloto.test (cliente_id = composio_user_id)
TZ_AR = "America/Argentina/Buenos_Aires"
TZ_OFFSET = "-03:00"  # mismo offset que ya usa test_e2e.py / el dispatcher real

OUT = Path(__file__).resolve().parent / "out"
OUT.mkdir(exist_ok=True)


def log(msg: str) -> None:
    print(f"[spike-cal1] {msg}")


def _hoy_ar():
    """Rango [00:00, 23:59:59) de HOY en AR (-03:00), como los pediría el panel "Mi Día"."""
    ahora_ar = datetime.now(dt_timezone(timedelta(hours=-3)))
    inicio = ahora_ar.replace(hour=0, minute=0, second=0, microsecond=0)
    fin = inicio + timedelta(days=1) - timedelta(seconds=1)
    return inicio.strftime(f"%Y-%m-%dT%H:%M:%S{TZ_OFFSET}"), fin.strftime(f"%Y-%m-%dT%H:%M:%S{TZ_OFFSET}")


def _rango_amplio():
    ahora_ar = datetime.now(dt_timezone(timedelta(hours=-3)))
    inicio = ahora_ar - timedelta(days=1)
    fin = ahora_ar + timedelta(days=30)
    return inicio.strftime(f"%Y-%m-%dT%H:%M:%S{TZ_OFFSET}"), fin.strftime(f"%Y-%m-%dT%H:%M:%S{TZ_OFFSET}")


def find(gw, time_min, time_max):
    return gw.execute(FIND_EVENT_SLUG, user_id=USER_ID,
                       arguments={"time_min": time_min, "time_max": time_max,
                                  "single_events": True, "order_by": "startTime", "max_results": 50},
                       confirmed=False)


def main() -> int:
    resultado = {"user_id": USER_ID, "toolkit_version": CALENDAR_POLICY["googlecalendar"].version}
    gw = ComposioGateway(CALENDAR_POLICY)

    # 1. ¿conectado?
    log("1/4 -- connection_status(googlecalendar)")
    try:
        status = gw.connection_status(USER_ID, "googlecalendar")
    except Exception as e:  # noqa: BLE001 -- de-risk, cualquier fallo se reporta, no se esconde
        log(f"connection_status FALLÓ: {type(e).__name__}: {e}")
        resultado["connection_status_error"] = f"{type(e).__name__}: {e}"
        status = None
    resultado["connection_status"] = status
    log(f"connection_status = {status!r}")

    if status != "ACTIVE":
        log("NO conectado (ACTIVE). Genero redirect_url de onboarding -- conectar requiere OAuth")
        log("humano en navegador, no lo puedo completar yo. Corto el spike acá.")
        try:
            resultado["authorize_redirect_url"] = gw.authorize(USER_ID, "googlecalendar")
        except Exception as e:  # noqa: BLE001
            resultado["authorize_error"] = f"{type(e).__name__}: {e}"
        (OUT / "resultado.json").write_text(json.dumps(resultado, indent=2, ensure_ascii=False), encoding="utf-8")
        return 1

    # 2. FIND rango "hoy"
    log("2/4 -- FIND rango HOY (AR -03:00)")
    tmin_hoy, tmax_hoy = _hoy_ar()
    resultado["rango_hoy"] = {"time_min": tmin_hoy, "time_max": tmax_hoy}
    try:
        res_hoy = find(gw, tmin_hoy, tmax_hoy)
        resultado["find_hoy_raw"] = res_hoy
        log(f"FIND hoy OK -- successful={res_hoy.get('successful')}")
    except Exception as e:  # noqa: BLE001
        log(f"FIND hoy FALLÓ: {type(e).__name__}: {e}")
        resultado["find_hoy_error"] = f"{type(e).__name__}: {e}"
        res_hoy = {}

    # 3. FIND rango amplio (para no depender de que haya algo agendado justo hoy)
    log("3/4 -- FIND rango amplio (-1d .. +30d)")
    tmin_w, tmax_w = _rango_amplio()
    resultado["rango_amplio"] = {"time_min": tmin_w, "time_max": tmax_w}
    try:
        res_w = find(gw, tmin_w, tmax_w)
        resultado["find_amplio_raw"] = res_w
        n_items = len(_items(res_w))
        log(f"FIND amplio OK -- successful={res_w.get('successful')}, items detectados={n_items}")
    except Exception as e:  # noqa: BLE001
        log(f"FIND amplio FALLÓ: {type(e).__name__}: {e}")
        resultado["find_amplio_error"] = f"{type(e).__name__}: {e}"
        res_w, n_items = {}, 0

    # 4. si el tenant está vacío (esperable, es el canónico "limpio"), crear 2 eventos sintéticos
    #    (uno simple, uno con recurrence) para poder inspeccionar el shape real, y limpiarlos después.
    creados: list[str] = []
    if n_items == 0:
        log("4/4 -- tenant sin eventos en el rango; creo 2 sintéticos para inspeccionar el shape")
        creados = _crear_sinteticos(gw, resultado)
        try:
            res_w2 = find(gw, tmin_w, tmax_w)
            resultado["find_amplio_post_create_raw"] = res_w2
            log(f"FIND post-create -- items detectados={len(_items(res_w2))}")
        except Exception as e:  # noqa: BLE001
            log(f"FIND post-create FALLÓ: {type(e).__name__}: {e}")
            resultado["find_post_create_error"] = f"{type(e).__name__}: {e}"
    else:
        log("4/4 -- ya hay eventos reales en el rango, no creo sintéticos")

    (OUT / "resultado.json").write_text(json.dumps(resultado, indent=2, ensure_ascii=False, default=str),
                                          encoding="utf-8")
    log(f"volcado completo en {OUT / 'resultado.json'}")

    # cleanup de los sintéticos (best-effort, no debe esconder el resultado del spike)
    for eid in creados:
        try:
            gw.execute("GOOGLECALENDAR_DELETE_EVENT", user_id=USER_ID,
                       arguments={"event_id": eid, "calendar_id": "primary"}, confirmed=True)
            log(f"cleanup: borrado evento sintético {eid}")
        except Exception as e:  # noqa: BLE001
            log(f"cleanup FALLÓ para {eid} (no bloqueante): {type(e).__name__}: {e}")

    log("SPIKE OK -- ver resultado.json para el shape completo")
    return 0


def _items(res: dict) -> list:
    """Best-effort: intenta ubicar la lista de eventos sin asumir el path exacto (eso es justo
    lo que el spike está determinando). Recorre el árbol buscando dicts con 'summary'+'id'."""
    acc: list = []
    def _walk(o):
        if isinstance(o, dict):
            if "summary" in o and "id" in o:
                acc.append(o)
            for v in o.values():
                _walk(v)
        elif isinstance(o, list):
            for v in o:
                _walk(v)
    _walk(res)
    return acc


def _crear_sinteticos(gw, resultado: dict) -> list[str]:
    """Crea un evento simple + uno con recurrence, mismo shape de argumentos que ya usa
    dispatcher_emprendedor.py para el CREATE real (summary/start_datetime/end_datetime/timezone).
    NO asume que el campo 'recurrence' es aceptado por el slug -- lo intenta y reporta si falla."""
    creados = []
    manana = (datetime.now(dt_timezone(timedelta(hours=-3))) + timedelta(days=1)).strftime("%Y-%m-%d")

    try:
        out = gw.execute(CREATE_EVENT_SLUG, user_id=USER_ID,
                          arguments={"summary": "SPIKE-CAL1 simple", "start_datetime": f"{manana}T10:00:00",
                                     "end_datetime": f"{manana}T11:00:00", "timezone": TZ_AR},
                          confirmed=True)
        resultado["create_simple_raw"] = out
        eid = _extraer_id(out)
        if eid:
            creados.append(eid)
        log(f"CREATE simple OK -- id={eid}")
    except Exception as e:  # noqa: BLE001
        log(f"CREATE simple FALLÓ: {type(e).__name__}: {e}")
        resultado["create_simple_error"] = f"{type(e).__name__}: {e}"

    try:
        out = gw.execute(CREATE_EVENT_SLUG, user_id=USER_ID,
                          arguments={"summary": "SPIKE-CAL1 recurrente", "start_datetime": f"{manana}T12:00:00",
                                     "end_datetime": f"{manana}T12:30:00", "timezone": TZ_AR,
                                     "recurrence": ["RRULE:FREQ=DAILY;COUNT=3"]},
                          confirmed=True)
        resultado["create_recurrente_raw"] = out
        eid = _extraer_id(out)
        if eid:
            creados.append(eid)
        log(f"CREATE recurrente OK -- id={eid}")
    except Exception as e:  # noqa: BLE001
        log(f"CREATE recurrente FALLÓ (puede que 'recurrence' no sea el nombre de campo que espera "
            f"el slug -- es justo lo que este spike busca determinar): {type(e).__name__}: {e}")
        resultado["create_recurrente_error"] = f"{type(e).__name__}: {e}"

    return creados


def _extraer_id(out: dict):
    for ev in _items(out):
        return ev.get("id")
    if isinstance(out, dict):
        data = out.get("data")
        if isinstance(data, dict) and data.get("id"):
            return data["id"]
    return None


if __name__ == "__main__":
    sys.exit(main())
