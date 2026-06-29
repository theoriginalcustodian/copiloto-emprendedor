"""resolve_datetime — convierte fecha/hora en lenguaje natural a fecha/hora absolutas (capa PLANTILLA).

DETERMINISTA: `now_iso` se inyecta (la activity lo pasa con workflow.now()); NUNCA lee el reloj -> apto para
correr dentro/cerca de Temporal sin romper determinismo. Locale es-AR por defecto (vocabulario + tz); para
otro locale/region se cambian las tablas WEEKDAYS/MONTHS/TIME_WORDS y el tz param -> el resto se reusa.

El LLM devuelve date_raw/time_raw CRUDOS (guardarrail 6); este modulo los resuelve. Cobertura: dias de la
semana, hoy/mañana/pasado, "N de <mes>", horas "a las 17"/"17:30"/"5 de la tarde"/"9 de la mañana"/mediodia.
Lo no reconocido -> None (el dispatcher pide clarificacion; ademas el agente SIEMPRE confirma antes de agendar).
"""
from __future__ import annotations

import datetime
import re
import unicodedata

try:
    from zoneinfo import ZoneInfo
except ImportError:  # pragma: no cover
    ZoneInfo = None

DEFAULT_TZ = "America/Argentina/Buenos_Aires"

WEEKDAYS = {"lunes": 0, "martes": 1, "miercoles": 2, "jueves": 3, "viernes": 4, "sabado": 5, "domingo": 6}
MONTHS = {"enero": 1, "febrero": 2, "marzo": 3, "abril": 4, "mayo": 5, "junio": 6, "julio": 7,
          "agosto": 8, "septiembre": 9, "setiembre": 9, "octubre": 10, "noviembre": 11, "diciembre": 12}


def _norm(s: str) -> str:
    """lowercase + sin acentos (para matchear 'miércoles'/'miercoles', 'cardiología'/...)."""
    s = unicodedata.normalize("NFKD", s or "")
    return "".join(c for c in s if not unicodedata.combining(c)).lower().strip()


def _tzinfo(tz: str):
    if ZoneInfo is not None:
        try:
            return ZoneInfo(tz)
        except Exception:  # noqa: BLE001 -- zona desconocida -> fallback offset AR
            pass
    return datetime.timezone(datetime.timedelta(hours=-3))   # AR sin DST


def _parse_date(text: str, today: datetime.date) -> datetime.date | None:
    t = _norm(text)
    if not t:
        return None
    if "pasado manana" in t:                            # 'pasado mañana' (t ya viene normalizado, sin acentos)
        return today + datetime.timedelta(days=2)
    if "manana" in t:                                   # 'mañana' (sin 'pasado')
        return today + datetime.timedelta(days=1)
    if "hoy" in t:
        return today
    # 'N de <mes>'
    m = re.search(r"(\d{1,2})\s+de\s+([a-z]+)", t)
    if m:
        day = int(m.group(1))
        mon = MONTHS.get(m.group(2))
        if mon and 1 <= day <= 31:
            year = today.year
            try:
                d = datetime.date(year, mon, day)
            except ValueError:
                return None
            if d < today:
                d = datetime.date(year + 1, mon, day)
            return d
    # dia de la semana (proximo; si es hoy mismo -> +7, asumimos el de la semana que viene)
    for name, wd in WEEKDAYS.items():
        if name in t:
            delta = (wd - today.weekday()) % 7
            return today + datetime.timedelta(days=delta or 7)
    # 'el 7' suelto -> dia 7 del mes actual o proximo
    m = re.search(r"\bel\s+(\d{1,2})\b", t)
    if m:
        day = int(m.group(1))
        if 1 <= day <= 31:
            year, mon = today.year, today.month
            try:
                d = datetime.date(year, mon, day)
            except ValueError:
                return None
            if d < today:
                mon += 1
                if mon > 12:
                    mon, year = 1, year + 1
                try:
                    d = datetime.date(year, mon, day)
                except ValueError:
                    return None
            return d
    return None


def _parse_time(text: str) -> datetime.time | None:
    t = _norm(text)
    if not t:
        return None
    if "mediodia" in t:
        return datetime.time(12, 0)
    if "medianoche" in t:
        return datetime.time(0, 0)
    pm = any(w in t for w in ("tarde", "noche"))
    am = "manana" in t                                  # t ya viene normalizado (sin acentos)
    # 'HH:MM' o 'HH' (a las 17 / 17hs / 17:30 / 5)
    m = re.search(r"(\d{1,2})(?::(\d{2}))?", t)
    if not m:
        return None
    hh = int(m.group(1))
    mm = int(m.group(2)) if m.group(2) else 0
    if hh > 23 or mm > 59:
        return None
    if pm and hh < 12:
        hh += 12                       # '5 de la tarde' -> 17
    elif not am and not pm and 1 <= hh <= 7:
        hh += 12                       # 'a las 5' sin indicador -> tarde (horario clinico tipico)
    if hh > 23:
        return None
    return datetime.time(hh, mm)


def _parse_period(text: str) -> str | None:
    """Franja del día cuando NO hay hora exacta: 'a la tarde'->'afternoon', 'a la mañana'->'morning',
    'a la noche'->'evening'. (es-AR; en text_time, 'mañana' = franja matutina, no el día siguiente.)
    Permite honrar la preferencia de franja aunque el paciente no diga una hora puntual."""
    t = _norm(text)
    if not t:
        return None
    if "tarde" in t:
        return "afternoon"
    if "noche" in t:
        return "evening"
    if "manana" in t or "temprano" in t:
        return "morning"
    return None


def resolve_datetime(text_date: str | None, text_time: str | None, *, now_iso: str,
                     tz: str = DEFAULT_TZ) -> dict:
    """Resuelve a {'date','time','period','datetime_iso'}. `now_iso` ancla 'hoy'/'mañana'/dias-de-semana
    (determinista). `period` ('morning'|'afternoon'|'evening'|None) solo cuando hay franja SIN hora exacta —
    el dominio filtra los slots a esa ventana. datetime_iso solo si hay date+time exactos."""
    now = datetime.datetime.fromisoformat(now_iso)
    today = now.date()
    date = _parse_date(text_date or "", today)
    time = _parse_time(text_time or "")
    period = _parse_period(text_time or "") if time is None else None
    dt_iso = None
    if date is not None and time is not None:
        naive = datetime.datetime.combine(date, time)
        aware = naive.replace(tzinfo=_tzinfo(tz))
        dt_iso = aware.astimezone(datetime.timezone.utc).isoformat()
    return {
        "date": date.isoformat() if date else None,
        "time": time.strftime("%H:%M") if time else None,
        "period": period,
        "datetime_iso": dt_iso,
    }
