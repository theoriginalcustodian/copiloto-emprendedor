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


def _day_bounds(d: datetime.date, tz) -> tuple[datetime.datetime, datetime.datetime]:
    """[00:00:00, 23:59:59.999999] del día `d` en el tz dado (aware)."""
    start = datetime.datetime.combine(d, datetime.time(0, 0, 0), tzinfo=tz)
    end = datetime.datetime.combine(d, datetime.time(23, 59, 59, 999999), tzinfo=tz)
    return start, end


def resolve_date_range(range_raw: str | None, *, now_iso: str, tz: str = DEFAULT_TZ) -> dict | None:
    """Resuelve un período en lenguaje natural (es-AR) a un rango de fecha ABSOLUTO para consultar la actividad.

    DETERMINISTA: ancla el "ahora" en `now_iso` (lo inyecta la activity), NUNCA lee el reloj → apto para correr
    en/cerca de Temporal. El LLM devuelve `range_raw` CRUDO (guardarrail 6: 'esta semana', 'ayer', 'del 1 al 5
    de julio'); este módulo lo resuelve. Todos los límites se calculan en el tz local (es-AR) y se devuelven en
    UTC ISO — así "ayer" no se corre por el offset. `until` nunca supera el "ahora" (no se pide el futuro).

    Cobertura: hoy · ayer · anteayer · esta semana (desde el lunes) · semana pasada · este mes · mes pasado ·
    "últimos/ultimos N días" (rolling) · "del/entre el X al/y el Y de <mes>" (mismo mes o cruza-meses) ·
    "la semana del N de <mes>" · "el mes de <mes>" · "el N de <mes>" (un día).
    Devuelve {'since': <utc iso>, 'until': <utc iso>, 'label': <humano>} o None si no reconoce el período.

    Fechas absolutas siempre en PASADO: una fecha/mes que aún no pasó este año se interpreta como la del año
    anterior (el usuario pregunta por su actividad, no por el futuro). Los rangos explícitos y 'la semana/el mes
    del N' aplican la MISMA corrección que el día puntual (review adversarial 2026-07-04: antes solo el día la
    tenía → 'del X al Y de <mes futuro>' invertía since>until y devolvía 'no encontré actividad')."""
    if not isinstance(range_raw, str):     # entities.range_raw no-string del LLM (lista/dict/número) -> None, no crashear
        return None
    t = _norm(range_raw)
    if not t:
        return None
    tzi = _tzinfo(tz)
    now = datetime.datetime.fromisoformat(now_iso).astimezone(tzi)
    today = now.date()

    def utc(dt: datetime.datetime) -> str:
        return dt.astimezone(datetime.timezone.utc).isoformat()

    def clamp(end: datetime.datetime) -> datetime.datetime:
        return min(end, now)   # nunca pedir el futuro

    def out(since: datetime.datetime, until: datetime.datetime, label: str) -> dict:
        return {"since": utc(since), "until": utc(clamp(until)), "label": label}

    def past_date(day: int, mon: int) -> datetime.date | None:
        """date(año-actual, mon, day); si cae en el FUTURO -> el del año pasado. None si el día/mes no existe."""
        try:
            d = datetime.date(today.year, mon, day)
        except ValueError:
            return None
        if d > today:
            try:
                d = datetime.date(today.year - 1, mon, day)
            except ValueError:
                return None
        return d

    def range_base_year(d1: int, mon1: int) -> int | None:
        """Año del rango decidido por su INICIO: si (d1 de mon1) ya pasó este año → este año; si es futuro → el
        año pasado (el rango ENTERO es del año anterior). Decidir por el inicio (no extremo-a-extremo) evita
        invertir un rango que 'straddlea' hoy: inicio pasado + fin futuro queda en el año actual y el fin se capa
        a `now` por clamp (ej. 'del 10 al 20 de julio' preguntado el 15 → 10→hoy, no 10/2026→20/2025 invertido)."""
        try:
            start_this = datetime.date(today.year, mon1, d1)
        except ValueError:
            return None
        return today.year if start_this <= today else today.year - 1

    month_names = [name for name in MONTHS if name in t]   # nombres de mes literales presentes en el texto

    # ── 1) RANGO cruza-meses: 'del X de <mes1> al Y de <mes2>' (año por el inicio; +1 al fin si cruza el año) ──
    m = re.search(r"(\d{1,2})\s+de\s+([a-z]+)\s+(?:al|a|hasta|-)\s+(?:el\s+)?(\d{1,2})\s+de\s+([a-z]+)", t)
    if m and MONTHS.get(m.group(2)) and MONTHS.get(m.group(4)):
        d1, mon1, d2, mon2 = int(m.group(1)), MONTHS[m.group(2)], int(m.group(3)), MONTHS[m.group(4)]
        base = range_base_year(d1, mon1)
        if base is not None:
            try:
                lo = datetime.date(base, mon1, d1)
                hi = datetime.date(base + (1 if mon2 < mon1 else 0), mon2, d2)   # dic→ene cruza al año siguiente
            except ValueError:
                lo = hi = None
            if lo and hi and lo <= hi:
                s, _ = _day_bounds(lo, tzi)
                _, e = _day_bounds(hi, tzi)
                return out(s, e, f"del {d1} de {m.group(2)} al {d2} de {m.group(4)}")
    # ── 2) RANGO mismo mes: 'del X al Y de <mes>' (separador EXPLÍCITO al/y/hasta/- → no parte '28' en '2 al 8') ──
    m = re.search(r"(\d{1,2})\s+(?:al|a|y|hasta|-)\s+(?:el\s+)?(\d{1,2})\s+de\s+([a-z]+)", t)
    if m and MONTHS.get(m.group(3)):
        mon = MONTHS[m.group(3)]
        lo_d, hi_d = sorted((int(m.group(1)), int(m.group(2))))
        base = range_base_year(lo_d, mon)
        if base is not None:
            try:
                lo = datetime.date(base, mon, lo_d)
                hi = datetime.date(base, mon, hi_d)
            except ValueError:
                lo = hi = None
            if lo and hi:
                s, _ = _day_bounds(lo, tzi)
                _, e = _day_bounds(hi, tzi)
                return out(s, e, f"del {lo_d} al {hi_d} de {m.group(3)}")
    # ── guard fail-closed (2ª pasada 2026-07-04): un rango de días explícito ('del 5 al 10 …') que NO resolvió
    #    arriba (sin nombre de mes → no sabemos de cuál) NO debe caer en las ramas anchas ('esta semana'/'este
    #    mes') devolviendo un período MÁS GRANDE que el pedido → None (el agente pide aclaración). Solo los
    #    separadores fuertes al/hasta: 'hoy de 9 a 18' (horas) no debe disparar el guard.
    if re.search(r"\b\d{1,2}\s+(?:al|hasta)\s+(?:el\s+)?\d{1,2}\b", t):
        return None
    # ── 3) 'la semana del <N de mes>' → la semana (lunes-domingo) que CONTIENE esa fecha ──────────────
    if "semana" in t:
        m = re.search(r"(\d{1,2})\s+de\s+([a-z]+)", t)
        if m and MONTHS.get(m.group(2)):
            d = past_date(int(m.group(1)), MONTHS[m.group(2)])
            if d:
                mon_d = d - datetime.timedelta(days=d.weekday())   # lunes de esa semana
                s, _ = _day_bounds(mon_d, tzi)
                _, e = _day_bounds(mon_d + datetime.timedelta(days=6), tzi)
                return out(s, e, f"la semana del {m.group(1)} de {m.group(2)}")
    # ── 4) 'el mes de <mes>' → todo ese mes calendario ───────────────────────────────────────────────
    if "mes" in t and month_names and "pasad" not in t and "anterior" not in t:
        mon = MONTHS[month_names[0]]
        first = past_date(1, mon)
        if first:
            nxt = datetime.date(first.year + (mon == 12), (mon % 12) + 1, 1)
            s, _ = _day_bounds(first, tzi)
            _, e = _day_bounds(nxt - datetime.timedelta(days=1), tzi)
            return out(s, e, month_names[0])
    # ── 5) un día puntual: 'el N de <mes>' — SOLO si no menciona semana/mes (si no, es rango/período) ──
    if "semana" not in t and "mes" not in t:
        m = re.search(r"(\d{1,2})\s+de\s+([a-z]+)", t)
        if m and MONTHS.get(m.group(2)):
            d = past_date(int(m.group(1)), MONTHS[m.group(2)])
            if d:
                s, e = _day_bounds(d, tzi)
                return out(s, e, f"el {m.group(1)} de {m.group(2)}")
    # ── 6) 'últimos N días' (rolling) ────────────────────────────────────────────────────────────────
    m = re.search(r"ultim\w*\s+(\d{1,3})\s+dia", t)
    if m:
        n = max(1, min(int(m.group(1)), 366))
        return out(now - datetime.timedelta(days=n), now, f"los últimos {n} días")
    # ── 7) anteayer / antes de ayer ──────────────────────────────────────────────────────────────────
    if "anteayer" in t or "antes de ayer" in t:
        s, e = _day_bounds(today - datetime.timedelta(days=2), tzi)
        return out(s, e, "anteayer")
    # ── 8) ayer ──────────────────────────────────────────────────────────────────────────────────────
    if "ayer" in t:
        s, e = _day_bounds(today - datetime.timedelta(days=1), tzi)
        return out(s, e, "ayer")
    # ── 9) semana pasada / la semana pasada ──────────────────────────────────────────────────────────
    if "semana" in t and ("pasad" in t or "anterior" in t):
        this_mon = today - datetime.timedelta(days=today.weekday())
        last_mon = this_mon - datetime.timedelta(days=7)
        s, _ = _day_bounds(last_mon, tzi)
        _, e = _day_bounds(this_mon - datetime.timedelta(days=1), tzi)
        return out(s, e, "la semana pasada")
    # ── 10) esta semana ──────────────────────────────────────────────────────────────────────────────
    if "semana" in t:
        this_mon = today - datetime.timedelta(days=today.weekday())
        s, _ = _day_bounds(this_mon, tzi)
        return out(s, now, "esta semana")
    # ── 11) mes pasado / el mes pasado ───────────────────────────────────────────────────────────────
    if "mes" in t and ("pasad" in t or "anterior" in t):
        first_this = today.replace(day=1)
        last_prev = first_this - datetime.timedelta(days=1)
        s, _ = _day_bounds(last_prev.replace(day=1), tzi)
        _, e = _day_bounds(last_prev, tzi)
        return out(s, e, "el mes pasado")
    # ── 12) este mes ─────────────────────────────────────────────────────────────────────────────────
    if "mes" in t:
        s, _ = _day_bounds(today.replace(day=1), tzi)
        return out(s, now, "este mes")
    # ── 13) hoy / lo de hoy ──────────────────────────────────────────────────────────────────────────
    if "hoy" in t:
        s, _ = _day_bounds(today, tzi)
        return out(s, now, "hoy")
    return None
