#!/usr/bin/env python3
"""backlog-dod-gap.py — DODTILDE: por qué el criterio 2 del Cierre A mide una casilla que el
propio backlog decidió no llenar.

Origen: `H-A4b-3` (A4-bis) + contrato `planificacion-a-frontend1_DODTILDE` (2026-09-30).
Tercera dirección del mecanismo de `scripts/plan-drift-check.sh` (dir.1: fila `pendiente` ya
hecha; dir.2: fila `✅` cuya evidencia no aparece en main), sobre otro sujeto: el backlog de
ítems `BL-*` tiene DOS señales de "terminado" que conviven sin lector común —

  1. `📌 Evidencia medida` — PR citado, derivable contra `origin/main`.
  2. la casilla de DoD (`[x]`/`[ ]`) — verificada a mano, deliberadamente escasa:
     tildar por conteo es la aprobación ritual que el propio backlog prohíbe (`:14-17`).

El criterio 2 del Cierre A sólo lee la señal (2), así que un ítem con PR real mergeado y
casilla vacía (A4 verificó `BL-D4…D8`/`W11`/`W12`/`X8` así el 22/09) se mide como "no hecho".
Este lector NO tilda nada — pone las dos señales lado a lado y nombra el hueco (`gap`).

Read-only, como `plan-drift-check.sh`: recolecta, no dicta veredicto. No escribe el backlog.

── El enum de `gap`, y la partición que lo hace no-ambiguo ─────────────────────────────────
El contrato (§3) describe 4 buckets con una superposición aparente entre VERIFICADO y
SOLO-CASILLA (las dos hablan de "casillas marcadas"). La partición sin solapamiento que
satisface los TRES controles obligatorios del propio contrato (BL-P4/P7/Q1 → VERIFICADO;
BL-D4…D8/W11/W12/X8 con casilla vacía y PR real → DERIVABLE; PR inventado → SIN-SEÑAL) es:

    completas  = (vacías == 0 and marcadas > 0)          # TODAS tildadas, al menos una
    evidencia  = algún PR citado por el ítem aparece en el log de origin/main

    completas                                  -> VERIFICADO   (el humano ya lo verificó)
    no completas Y evidencia                   -> DERIVABLE    (el trabajo existe, la casilla no lo dice)
    no completas Y NO evidencia Y marcadas > 0 -> SOLO-CASILLA (tildado parcial sin PR: optimista o evidencia fuera de git)
    no completas Y NO evidencia Y marcadas == 0-> SIN-SEÑAL    (ni casilla ni PR — el cubo valioso)

Un ítem con DoD NARRATIVO (sin ningún `[x]`/`[ ]`, ej. `BL-J1`: "el que figura en BL-D1";
`BL-X8`: "se escribe cuando DEC-7 fije...") tiene marcadas=vacías=0 — cae en la rama de
"no completas", NUNCA en VERIFICADO (cero casillas no es "todas tildadas"), y se marca con
`sin_casillas=True` para que no se lea como un `[0,0]` normal (que significaría "0 de 0
pendientes", un estado trivialmente resuelto que este NO es).

── El extractor de evidencia — el mismo criterio que dir.2, no un nuevo diseño ──────────────
SOLO números de PR en la forma `(#NNN)` o `PR #NNN` (nunca sha corto, nunca `#NNN` suelto, y
NUNCA existencia de path): `plan-drift-check.sh` probó y descartó las dos primeras (24 y 39
falsos positivos contra el `PLAN.md` real) y la tercera es la MISMA razón por la que ese
script tampoco usa paths para su dir.2 — la mayoría de lo que un ítem cita como evidencia
(archivos del buzón gitignoreado, capturas de prod, el prototipo) nunca vive en el árbol de
git aunque el ítem esté genuinamente cerrado. Reusar ese descarte acá, sin volver a medirlo,
es la instrucción explícita del contrato ("no se diseña de cero, tenés el corpus caliente").

Caveat medido, no un bug: `BL-J1` cita su propio PR (`#522`) SUELTO, sin `PR ` ni paréntesis
("...no por título de PR (2026-09-23). #522 (`feat...`)...") — la MISMA ambigüedad que
`OLA0`/`AACORE` en `plan-drift-check.sh` (acta vs. color hex vs. PR real sin esa forma). Por
esa razón el extractor estricto no lo cuenta como evidencia y `BL-J1` sale `SIN-SEÑAL` pese a
estar cerrado (puente `K-01 ≡ BL-J1: SÍ` documentado en su propio texto) — se declara en el
reporte, no se corrige el regex a medida para un solo caso (mismo criterio que "un `#NNN`
real pero sin esa forma cae en NO-MEDIBLE, no en candidato").

Uso:
  python scripts/backlog-dod-gap.py              # informe completo
  python scripts/backlog-dod-gap.py --quiet       # sólo el resumen + el cubo SIN-SEÑAL
  REPO=/otra/ruta python scripts/backlog-dod-gap.py

Exit: 0 = corrió y midió (el enum GAP no es pass/fail, es un mapa) · 2 = el instrumento no
pudo medir, o algún control obligatorio salió rojo — en ese caso NO se imprime ninguna cifra
del backlog real (contrato §3: "cero cifras publicadas si un control sale rojo").
"""
import os
import re
import subprocess
import sys

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")

QUIET = "--quiet" in sys.argv[1:]
REPO = os.environ.get("REPO", os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
BACKLOG_PATH = "docs/copiloto-emprendedor/2026-09-21-backlog-beta-odobi-con-dod.md"


def fatal(msg: str) -> None:
    print(f"🛑 NO PUDE MEDIR: {msg}", file=sys.stderr)
    sys.exit(2)


def run(args: list[str]) -> str:
    try:
        r = subprocess.run(
            args, cwd=REPO, capture_output=True, text=True, encoding="utf-8", errors="replace"
        )
    except FileNotFoundError as e:
        fatal(f"no pude ejecutar {args[0]}: {e}")
    if r.returncode != 0:
        fatal(f"'{' '.join(args)}' salió con rc={r.returncode}: {r.stderr.strip()[:400]}")
    return r.stdout


# ── Extractores — mismo criterio que dir.2 de plan-drift-check.sh, reusado sin rediseñar ────
FUNDAMENTO_RE = re.compile(r"\([Vv]er:[^)]*\)")
CITA_RE = re.compile(r"\(#(\d{3,4})\)|PR #(\d{3,4})")


def extraer_citas(texto: str) -> set[str]:
    """PR citados en forma `(#NNN)` o `PR #NNN`, excluyendo segmentos `(ver: ...)` (fundamento,
    no entregable — mismo criterio que `extraer_artefactos`/`extraer_citas` de plan-drift-check.sh)."""
    sin_fund = FUNDAMENTO_RE.sub("", texto)
    out = set()
    for m in CITA_RE.finditer(sin_fund):
        out.add(m.group(1) or m.group(2))
    return out


def autotest_extraccion() -> None:
    """Autotest de strings, sin git — corre siempre, antes de tocar la red (mismo orden que
    plan-drift-check.sh: el control más barato y más específico primero)."""
    fila = (
        "✅ cerrado (ver: hallazgo #9999 que lo motivó) por PR #1234, "
        "cita suelta #4321, sha `abc1234`, y también (#5678)"
    )
    c = extraer_citas(fila)
    if "9999" in c:
        fatal("AUTOTEST citas: un #NNN dentro de '(ver: ...)' salió como evidencia. Cuenta el fundamento como si fuera el entregable.")
    if "1234" not in c:
        fatal("AUTOTEST citas: el PR en forma 'PR #NNN' desapareció.")
    if "5678" not in c:
        fatal("AUTOTEST citas: el PR en forma '(#NNN)' desapareció.")
    if "4321" in c:
        fatal("AUTOTEST citas: un '#NNN' SUELTO salió como evidencia (ambigüedad OLA0/AACORE que se descartó).")
    if "abc1234" in c:
        fatal("AUTOTEST citas: un sha corto salió como evidencia. Ese camino está descartado (LEGAL/FACTID).")


# ── El lector de DoD — inline (`- **DoD:** [x] a; [ ] b`) y lista multilínea (`  - [ ] a`) ──
DOD_MARK_RE = re.compile(r"-\s*\*\*DoD[^*]*:\*\*")
SUBITEM_RE = re.compile(r"^\s*-\s*\[([ xX])\]")


def parse_dod(body: str):
    """Devuelve (marcadas, vacias, sin_casillas). La región de DoD es lo que sigue al marcador
    EN SU PROPIA LÍNEA (formato inline: `- **DoD:** [x] a; [ ] b`) más las líneas indentadas
    `- [ ]`/`- [x]` inmediatamente siguientes, sin línea en blanco de por medio (formato lista:
    ver BL-D1, BL-B1). Las dos conviven en el backlog real."""
    m = DOD_MARK_RE.search(body)
    if not m:
        return None  # el ítem no tiene línea de DoD — no debería pasar en ninguno (DoD base :92)
    nl = body.find("\n", m.end())
    if nl == -1:
        resto = [body[m.end():]]
        nl = len(body) - 1
    else:
        resto = [body[m.end():nl]]
    for ln in body[nl + 1:].splitlines():
        if SUBITEM_RE.match(ln):
            resto.append(ln)
        else:
            break
    region = "\n".join(resto)
    marcadas = len(re.findall(r"\[[xX]\]", region))
    vacias = len(re.findall(r"\[ \]", region))
    return marcadas, vacias, (marcadas + vacias == 0)


def autotest_dod() -> None:
    inline = parse_dod("- **DoD:** [x] uno; [ ] dos; [x] tres")
    if inline != (2, 1, False):
        fatal(f"AUTOTEST DoD inline: esperaba (2,1,False), salió {inline}.")
    multilinea = parse_dod("- **DoD:**\n  - [ ] a\n  - [x] b\n  - [ ] c\n\n(otro párrafo)")
    if multilinea != (1, 2, False):
        fatal(f"AUTOTEST DoD multilínea: esperaba (1,2,False), salió {multilinea}.")
    narrativo = parse_dod("- **DoD:** se escribe cuando DEC-7 fije el alcance. Sin casillas acá.")
    if narrativo != (0, 0, True):
        fatal(f"AUTOTEST DoD narrativo (sin casillas): esperaba (0,0,True), salió {narrativo}.")
    corte = parse_dod("- **DoD:**\n  - [x] a\n\n- **Otro campo:** no es DoD\n  - [ ] esto NO cuenta")
    if corte != (1, 0, False):
        fatal(f"AUTOTEST DoD corte de región: esperaba (1,0,False) — no debe leer más allá del párrafo, salió {corte}.")


ALIAS_RE = re.compile(r"\bK-\d{1,3}\b|\bH-A\d[a-z]?-\d+\b|\bH-BIS-\d+\b")


def extraer_alias(body: str) -> list[str]:
    return sorted(set(ALIAS_RE.findall(body)))


def clasificar(marcadas: int, vacias: int, evidencia: bool) -> str:
    completas = vacias == 0 and marcadas > 0
    if completas:
        return "VERIFICADO"
    if evidencia:
        return "DERIVABLE"
    if marcadas > 0:
        return "SOLO-CASILLA"
    return "SIN-SEÑAL"


def autotest_clasificar() -> None:
    casos = [
        ((3, 0, False), "VERIFICADO"),
        ((3, 0, True), "VERIFICADO"),
        ((0, 4, True), "DERIVABLE"),
        ((2, 2, True), "DERIVABLE"),
        ((2, 2, False), "SOLO-CASILLA"),
        ((0, 0, False), "SIN-SEÑAL"),
        ((0, 3, False), "SIN-SEÑAL"),
    ]
    for (marcadas, vacias, evidencia), esperado in casos:
        got = clasificar(marcadas, vacias, evidencia)
        if got != esperado:
            fatal(
                f"AUTOTEST clasificar({marcadas},{vacias},{evidencia}): esperaba {esperado}, salió {got}."
            )


ITEM_RE = re.compile(r"^### (BL-[A-Z0-9]+) · (.*)$", re.MULTILINE)
SECTION_END_RE = re.compile(r"^## ", re.MULTILINE)


def parse_items(texto: str):
    matches = list(ITEM_RE.finditer(texto))
    items = []
    for i, m in enumerate(matches):
        start = m.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(texto)
        sec = SECTION_END_RE.search(texto, start, end)
        if sec:
            end = sec.start()
        items.append({"id": m.group(1), "title": m.group(2).strip(), "body": texto[start:end]})
    return items


def main() -> None:
    autotest_extraccion()
    autotest_dod()
    autotest_clasificar()

    subprocess.run(["git", "-C", REPO, "fetch", "origin", "--quiet"], capture_output=True)
    backlog_text = run(["git", "-C", REPO, "show", f"origin/main:{BACKLOG_PATH}"])
    log_text = run(["git", "-C", REPO, "log", "--oneline", "origin/main"])
    log_lineas = log_text.count("\n")
    if log_lineas < 50:
        fatal(f"el log de origin/main trajo {log_lineas} líneas: eso no es este repo con su historia real.")

    def cita_en_main(pr: str) -> bool:
        return re.search(rf"(?<!\d)#{pr}(?!\d)", log_text) is not None

    head_subject = run(["git", "-C", REPO, "log", "-1", "--format=%s", "origin/main"]).strip()
    hm = re.search(r"\(#(\d{2,6})\)", head_subject)
    if not hm:
        fatal(f"el HEAD de origin/main ('{head_subject}') no trae '(#NNN)': no puedo armar el canario.")
    head_pr = hm.group(1)
    if not cita_en_main(head_pr):
        fatal(f"control POSITIVO falló: el propio PR del HEAD (#{head_pr}) no aparece en su log.")
    if cita_en_main("999999"):
        fatal("control NEGATIVO falló: un PR inventado (#999999) dio PRESENTE en el log.")

    items = parse_items(backlog_text)
    # El numero es LITERAL a proposito: este guard existe para cazar que el parser deje de
    # reconocer el backlog. Derivarlo de len(items) lo haria pasar SIEMPRE -- un guard que
    # se compara consigo mismo falla abierto justo en su caso de activacion. Al cambiar la
    # forma del backlog se actualiza A MANO, citando el PR que la cambio.
    if len(items) != 77:
        fatal(
            f"esperaba 77 ítems `### BL-*` (invariante medido del backlog: 66 + los 11 "
            f"encabezados repuestos en #962, 2026-10-08), encontré {len(items)}. "
            "El backlog cambió de forma o el parser dejó de reconocerlo — no sigo sin re-medir."
        )

    filas = []
    for it in items:
        dod = parse_dod(it["body"])
        if dod is None:
            fatal(f"{it['id']}: no encontré línea '**DoD:**' — invariante de la DoD base (:92) rota.")
        marcadas, vacias, sin_casillas = dod
        citas = extraer_citas(it["body"])
        confirmadas = sorted(c for c in citas if cita_en_main(c))
        evidencia = len(confirmadas) > 0
        gap = clasificar(marcadas, vacias, evidencia)
        filas.append(
            {
                "id": it["id"],
                "title": it["title"],
                "evidencia": evidencia,
                "prs": confirmadas,
                "marcadas": marcadas,
                "vacias": vacias,
                "sin_casillas": sin_casillas,
                "alias": extraer_alias(it["body"]),
                "gap": gap,
            }
        )

    por_id = {f["id"]: f for f in filas}

    # ── Control POSITIVO obligatorio (contrato §3) — sobre el backlog REAL, no un sintético ──
    verificado_esperado = ["BL-P4", "BL-P7", "BL-Q1"]
    derivable_esperado = ["BL-D4", "BL-D5", "BL-D6", "BL-D7", "BL-D8", "BL-W11", "BL-W12", "BL-X8"]
    fallas = []
    for bid in verificado_esperado:
        f = por_id.get(bid)
        if f is None:
            fallas.append(f"{bid}: no encontrado en el backlog (¿cambió de id?).")
        elif f["gap"] != "VERIFICADO":
            fallas.append(f"{bid}: esperaba VERIFICADO, salió {f['gap']} (marcadas={f['marcadas']} vacias={f['vacias']} evidencia={f['evidencia']}).")
    for bid in derivable_esperado:
        f = por_id.get(bid)
        if f is None:
            fallas.append(f"{bid}: no encontrado en el backlog (¿cambió de id?).")
        elif f["gap"] != "DERIVABLE":
            fallas.append(f"{bid}: esperaba DERIVABLE, salió {f['gap']} (marcadas={f['marcadas']} vacias={f['vacias']} evidencia={f['evidencia']} PRs={f['prs']}).")
    if fallas:
        for f in fallas:
            print(f"   ✗ {f}", file=sys.stderr)
        fatal(
            "control POSITIVO real (BL-P4/P7/Q1 → VERIFICADO; BL-D4..D8/W11/W12/X8 → DERIVABLE) "
            "no pasó. El lector de evidencia o de casillas está roto — cero cifras publicadas."
        )

    for bid in ("BL-J1", "BL-X8"):
        f = por_id.get(bid)
        if f is None or not f["sin_casillas"]:
            fatal(f"{bid}: se esperaba sin_casillas=True (DoD narrativo, sin [x]/[ ]) — el parser no lo detectó.")

    # ── Reporte ──────────────────────────────────────────────────────────────────────────────
    cubos: dict[str, list] = {"VERIFICADO": [], "DERIVABLE": [], "SOLO-CASILLA": [], "SIN-SEÑAL": []}
    for f in filas:
        cubos[f["gap"]].append(f)

    print(f"── BACKLOG-DOD-GAP · sujeto: origin/main · {BACKLOG_PATH} · {len(filas)} ítems `BL-*`")
    print(
        f"── VERIFICADO={len(cubos['VERIFICADO'])} · DERIVABLE={len(cubos['DERIVABLE'])} "
        f"· SOLO-CASILLA={len(cubos['SOLO-CASILLA'])} · SIN-SEÑAL={len(cubos['SIN-SEÑAL'])}"
    )
    print("── controles: POSITIVO real (11 ítems) ok · NEGATIVO (#999999) ok · sin_casillas BL-J1/BL-X8 ok")

    if not QUIET:
        for nombre in ("SIN-SEÑAL", "SOLO-CASILLA", "DERIVABLE", "VERIFICADO"):
            print(f"\n{'🔴' if nombre == 'SIN-SEÑAL' else '⚪'} {nombre} ({len(cubos[nombre])}):")
            for f in cubos[nombre]:
                casillas = "SIN_CASILLAS" if f["sin_casillas"] else f"[{f['marcadas']},{f['vacias']}]"
                alias = f" alias={','.join(f['alias'])}" if f["alias"] else ""
                prs = f" PR={','.join(f['prs'])}" if f["prs"] else ""
                print(f"   {f['id']:8s} {casillas:14s}{prs}{alias}  — {f['title']}")
    else:
        print("SIN-SEÑAL: " + " ".join(f["id"] for f in cubos["SIN-SEÑAL"]))

    print(
        "\n⚠️  Caveat medido: BL-J1 cita su propio PR (#522) SUELTO, sin 'PR ' ni paréntesis "
        "— misma ambigüedad OLA0/AACORE de plan-drift-check.sh. El extractor estricto no lo "
        "cuenta y BL-J1 sale SIN-SEÑAL pese a estar cerrado (puente K-01≡BL-J1 documentado en "
        "su propio texto). No es un ítem sin trabajo: es un límite conocido del extractor."
    )


if __name__ == "__main__":
    main()
