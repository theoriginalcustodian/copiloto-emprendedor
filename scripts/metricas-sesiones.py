#!/usr/bin/env python
"""metricas-sesiones.py — el costo REAL de trabajar en 3 sesiones paralelas, medido del log.

Lee los transcripts JSONL de Claude Code y saca las métricas que ningún reporte de sesión da,
porque nadie las mira: cuánto del tiempo fue trabajo y cuánto latido, cuánto cuesta el heartbeat
de los crones, cuánto tarda una sesión en reaccionar a un mensaje del buzón, y dónde están los
huecos.

Por qué existe: el 2026-07-24 tres fallos grandes (sesión "parada" que trabajaba, sesión "viva"
que giraba en vacío, mensajes urgentes ignorados 20 min) sólo se vieron leyendo el log crudo a
mano. Esto lo hace sistemático y barato.

Diseño:
  · STREAMEA línea por línea. Los JSONL pesan cientos de MB; nunca se carga uno entero.
  · No infiere identidad de sesión por paths ni por nombre (ambos ya fallaron): usa el prompt del
    cron que la ventana RECIBE, que se lo asigna otro.
  · Imprime números y ejemplos concretos, no juicios. El juicio es de quien lee.

Uso:  python scripts/metricas-sesiones.py [--slug <slug>] [--horas N] [--json]
"""
from __future__ import annotations
import argparse, json, os, re, sys
from collections import Counter
from datetime import datetime, timezone, timedelta

# Windows abre stdout en cp1252 y una flecha `→` tumba el reporte entero a mitad de camino.
for _f in (sys.stdout, sys.stderr):
    try:
        _f.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

SLUG_DEFAULT = "c--Proyectos-Claude-Claude-code-copiloto-emprendedor"
MUTANTES = {"Write", "Edit", "MultiEdit", "NotebookEdit"}
CMD_PRODUCTIVO = re.compile(
    r"git\s+(commit|push|merge|cherry-pick|tag)|gh\s+pr\s+(create|merge)|pytest|"
    r"npm\s+(run|test)|yarn\s+(test|build)|deploy|sync-(test-)?backend|adb\s+",
    re.I,
)
CMD_LECTURA = re.compile(r"^\s*(ls|cat|date|head|tail|wc|git\s+(status|log|diff|branch))\b", re.I)
ROL_RE = re.compile(r"sesi[oó]n (BACKEND|FRONTEND|PLANIFICACI[OÓ]N)", re.I)
# Un turno disparado por cron: el prompt arranca con el encabezado del heartbeat.
CRON_RE = re.compile(r"^(Vig[ií]a de coordinaci[oó]n|Control de (sesiones|SESIONES)|Monitor de PAR[AÁ]LISIS)", re.M)

GAP_MIN = 5           # a partir de acá se cuenta como hueco
REACCION_MAX = 60     # minutos que se esperan para ver si reaccionó a un aviso del buzón


def ts(linea: dict):
    t = linea.get("timestamp")
    if not t:
        return None
    try:
        return datetime.fromisoformat(str(t).replace("Z", "+00:00"))
    except Exception:
        return None


def texto_de(msg) -> str:
    c = (msg or {}).get("content")
    if isinstance(c, str):
        return c
    if isinstance(c, list):
        return " ".join(b.get("text", "") for b in c if isinstance(b, dict) and b.get("type") == "text")
    return ""


def analizar(path: str, desde: datetime | None) -> dict:
    r = {
        "archivo": os.path.basename(path)[:8],
        "mb": round(os.path.getsize(path) / 1e6, 1),
        "rol": Counter(),
        "tools": Counter(),
        "primera": None, "ultima": None,
        "turnos_usuario": 0, "turnos_cron": 0,
        "actos_productivos": 0, "actos_lectura": 0,
        "errores_tool": 0,
        "avisos_buzon": 0, "avisos_reaccionados": 0, "demoras_reaccion": [],
        "huecos": [],            # (minutos, hora_inicio) — se computan al final
        "_tiempos": [],          # timestamps crudos, para ORDENARLOS antes de medir
        "cmds": Counter(),       # comandos bash repetidos textualmente
        "tokens_out": 0, "tokens_in": 0,
    }
    prev_t = None
    aviso_pendiente = None       # (timestamp, nombres[]) esperando que abra coordinacion/

    with open(path, "r", encoding="utf-8", errors="replace") as fh:
        for linea in fh:
            if not linea.strip():
                continue
            try:
                d = json.loads(linea)
            except Exception:
                continue
            t = ts(d)
            if t is None:
                continue
            if desde and t < desde:
                continue
            r["primera"] = r["primera"] or t
            r["ultima"] = t

            # Los huecos NO se calculan acá. El JSONL no viene ordenado por tiempo — las
            # líneas de sub-agentes (sidechains) llegan intercaladas — y medir el gap entre
            # líneas consecutivas del ARCHIVO cuenta el mismo salto varias veces. Lo delató
            # (2026-07-24) un imposible aritmético: 3827 min de huecos en una ventana de
            # 1800. Un instrumento así no falla: CONFIRMA. Se ordena primero, más abajo.
            r["_tiempos"].append(t)

            msg = d.get("message") or {}
            rol_msg = d.get("type") or msg.get("role")

            # identidad: el prompt del cron que la ventana RECIBE
            cuerpo = texto_de(msg)
            if cuerpo:
                for m in ROL_RE.finditer(cuerpo):
                    r["rol"][m.group(1).upper().replace("Ó", "O")] += 1

            if rol_msg == "user" and cuerpo:
                if CRON_RE.search(cuerpo):
                    r["turnos_cron"] += 1
                elif "<buzon-nuevo" not in cuerpo and len(cuerpo) > 20:
                    r["turnos_usuario"] += 1

            # avisos del buzón entregados, y si reaccionó
            if "buzon-nuevo" in linea or "buzon-al-reanudar" in linea:
                r["avisos_buzon"] += 1
                aviso_pendiente = t

            u = msg.get("usage") or {}
            r["tokens_out"] += u.get("output_tokens", 0) or 0
            r["tokens_in"] += (u.get("input_tokens", 0) or 0)

            c = msg.get("content")
            if not isinstance(c, list):
                continue
            for b in c:
                if not isinstance(b, dict):
                    continue
                if b.get("type") == "tool_result" and b.get("is_error"):
                    r["errores_tool"] += 1
                if b.get("type") != "tool_use":
                    continue
                nombre = b.get("name", "?")
                r["tools"][nombre] += 1
                inp = b.get("input") or {}
                ruta = str(inp.get("file_path") or "")
                cmd = str(inp.get("command") or "")

                # ¿reaccionó al aviso? = tocó coordinacion/ dentro de la ventana
                if aviso_pendiente is not None and "coordinacion" in (ruta + cmd):
                    demora = (t - aviso_pendiente).total_seconds() / 60
                    if demora <= REACCION_MAX:
                        r["avisos_reaccionados"] += 1
                        r["demoras_reaccion"].append(round(demora, 1))
                    aviso_pendiente = None

                if nombre in MUTANTES:
                    r["actos_productivos"] += 1
                elif nombre == "Bash":
                    if CMD_PRODUCTIVO.search(cmd):
                        r["actos_productivos"] += 1
                    elif CMD_LECTURA.search(cmd):
                        r["actos_lectura"] += 1
                    r["cmds"][cmd.strip()[:70]] += 1
                else:
                    r["actos_lectura"] += 1

    # Huecos, ahora sí: orden cronológico real y sin timestamps repetidos.
    ts_ordenados = sorted(set(r.pop("_tiempos")))
    for a, b in zip(ts_ordenados, ts_ordenados[1:]):
        gap = (b - a).total_seconds() / 60
        if gap >= GAP_MIN:
            r["huecos"].append((round(gap), a.strftime("%H:%M")))

    # Control de sanidad DEL PROPIO INSTRUMENTO: los huecos no pueden sumar más que la
    # ventana observada. Si pasa, el cálculo está roto y hay que verlo — no publicar el
    # número como si fuera una medición. (Ley de los instrumentos, BUCLE-CANONICO §12.)
    if r["primera"] and r["ultima"]:
        span = (r["ultima"] - r["primera"]).total_seconds() / 60
        suma = sum(h[0] for h in r["huecos"])
        if span > 0 and suma > span * 1.02:
            r["huecos_sospechosos"] = f"{suma:.0f} min de huecos en {span:.0f} min observados"
    return r


def rol_de(r) -> str:
    return r["rol"].most_common(1)[0][0] if r["rol"] else "SIN-CRON"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--slug", default=SLUG_DEFAULT)
    ap.add_argument("--horas", type=float, default=24)
    ap.add_argument("--json", action="store_true")
    a = ap.parse_args()

    base = os.path.join(os.path.expanduser("~"), ".claude", "projects", a.slug)
    if not os.path.isdir(base):
        print(f"no existe el slug: {base}", file=sys.stderr)
        return 2
    desde = datetime.now(timezone.utc) - timedelta(hours=a.horas)

    res = []
    for n in sorted(os.listdir(base)):
        if not n.endswith(".jsonl"):
            continue
        p = os.path.join(base, n)
        try:
            r = analizar(p, desde)
        except Exception as e:            # un transcript ilegible no tumba el reporte
            print(f"[warn] {n[:8]}: {e}", file=sys.stderr)
            continue
        if r["ultima"] is None:
            continue
        res.append(r)

    if a.json:
        print(json.dumps([{**r, "rol": rol_de(r), "primera": str(r["primera"]), "ultima": str(r["ultima"]),
                           "tools": dict(r["tools"]), "cmds": dict(r["cmds"].most_common(10))} for r in res],
                         ensure_ascii=False, indent=1, default=str))
        return 0

    print(f"# Métricas de sesiones — últimas {a.horas:g} h  ({len(res)} transcripts con actividad)\n")
    print("| rol | id | MB | turnos usuario | turnos CRON | productivos | lecturas | ratio prod | errores | avisos buzón | reaccionó | tok_out |")
    print("|---|---|---|---|---|---|---|---|---|---|---|---|")
    tot = Counter()
    for r in sorted(res, key=lambda x: -(x["actos_productivos"])):
        p, l = r["actos_productivos"], r["actos_lectura"]
        ratio = f"{p/(p+l)*100:.0f}%" if (p + l) else "—"
        print(f"| {rol_de(r)} | {r['archivo']} | {r['mb']} | {r['turnos_usuario']} | {r['turnos_cron']} | "
              f"{p} | {l} | {ratio} | {r['errores_tool']} | {r['avisos_buzon']} | "
              f"{r['avisos_reaccionados']} | {r['tokens_out']:,} |")
        for k in ("turnos_cron", "turnos_usuario", "actos_productivos", "actos_lectura",
                  "errores_tool", "avisos_buzon", "avisos_reaccionados", "tokens_out"):
            tot[k] += r[k]

    print(f"\n## Totales\n")
    print(f"- Turnos disparados por CRON: **{tot['turnos_cron']}** · por el operador: **{tot['turnos_usuario']}**")
    if tot["turnos_cron"] + tot["turnos_usuario"]:
        pct = tot["turnos_cron"] / (tot["turnos_cron"] + tot["turnos_usuario"]) * 100
        print(f"  → el **{pct:.0f}%** de los turnos los disparó el heartbeat, no una persona.")
    print(f"- Actos productivos: **{tot['actos_productivos']}** · de lectura/exploración: **{tot['actos_lectura']}**")
    print(f"- Errores de tool: **{tot['errores_tool']}**")
    print(f"- Avisos del buzón entregados: **{tot['avisos_buzon']}** · seguidos de una lectura de `coordinacion/`: "
          f"**{tot['avisos_reaccionados']}**"
          + (f" ({tot['avisos_reaccionados']/tot['avisos_buzon']*100:.0f}%)" if tot["avisos_buzon"] else ""))
    demoras = [d for r in res for d in r["demoras_reaccion"]]
    if demoras:
        demoras.sort()
        print(f"  → demora en reaccionar: mediana **{demoras[len(demoras)//2]:.1f} min**, peor caso **{demoras[-1]:.1f} min**")
    print(f"- Tokens de salida: **{tot['tokens_out']:,}**")

    print(f"\n## Huecos ≥{GAP_MIN} min (dónde se fue el tiempo de pared)\n")
    for r in sorted(res, key=lambda x: -sum(h[0] for h in x["huecos"]))[:5]:
        if not r["huecos"]:
            continue
        total = sum(h[0] for h in r["huecos"])
        peores = sorted(r["huecos"], reverse=True)[:4]
        print(f"- **{rol_de(r)}** `{r['archivo']}`: {len(r['huecos'])} huecos, **{total} min** en total. "
              f"Mayores: {', '.join(f'{m}min desde {h}' for m, h in peores)}")
        if r.get("huecos_sospechosos"):
            print(f"  - ⚠️ **CÁLCULO SOSPECHOSO** ({r['huecos_sospechosos']}) — no usar este número.")

    print(f"\n## Comandos repetidos (candidatos a script o a caché)\n")
    glob = Counter()
    for r in res:
        glob.update(r["cmds"])
    for cmd, n in glob.most_common(8):
        if n > 2:
            print(f"- **{n}×** `{cmd}`")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
