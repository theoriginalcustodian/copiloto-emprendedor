#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Registro UNICO de estado del sprint: deriva, valida y escribe el estado de cada ficha.

POR QUE EXISTE
--------------
Medido el 2026-10-14 sobre el buzon completo (460 `cierre_`, control negativo 0):
**18 de las 26 fichas del backlog nunca fueron nombradas por ninguna sesion**. El backlog no
dejaba de marcarse por descuido: su id no circulaba. Las sesiones citaban ids propios
(`KVCAIDASALE`, `EXHAUSTIVEDEPSON`, `DRIVECERO`, `A7`), asi que la casilla de la ficha no
entraba al circuito de cierre y el estado del sprint se leia en tres registros incompatibles.

QUIEN MARCA
-----------
NADIE a mano. La sesion que termina aporta la EVIDENCIA en su `cierre_`; este script DERIVA y
ESCRIBE el estado en el backlog (`--marcar`), y el gate (`--check`) rechaza un TERMINADO cuya
evidencia no existe. Tres sesiones editando la misma tabla sobre un checkout compartido es
edit-race; y ordenar a mano ya fracaso una vez en este repo (memoria
`buzon-se-ordena-por-janitor-no-por-disciplina`: `abierto/` 32 -> 136).

EL CRITERIO DE MARCADO ES EL DoD COMPLETO, NO EL MERGE COMMIT
-------------------------------------------------------------
Orden del operador (2026-10-14): «las tareas se marcan como terminadas cuando el dod esta hecho
completo». El merge commit es UNA de las evidencias, no el criterio. De ahi el cuarto estado:

  PENDIENTE    nadie la tomo.
  EN-CURSO     tomada; exige `Dueno-activo:`.
  DOD-PARCIAL  hay codigo en main pero el DoD NO esta completo; exige `Falta:` con lo que falta.
               Este es el estado que impide el error que este repo ya pago: declarar terminado
               sin la evidencia de device.
  TERMINADO    DoD completo; exige `Cierre:` con >=1 sha ANCESTRO de origin/main + evidencia.

El gate NO puede verificar lo tactil (device). Lo que hace es impedir que se declare TERMINADO
sin que la evidencia este ESCRITA y el sha exista: lo no mecanizable queda visible, no implicito.

CORPUS DENTRO DEL REPO
----------------------
Lee y escribe solo el backlog versionado. `coordinacion/` NO esta versionada, asi que un gate que
dependiera de ella mediria al equipo y no al commit (memoria
`un-gate-cuyo-corpus-vive-fuera-del-repo-mide-al-equipo-no-al-commit`) y en CI daria vacio.

USO
---
  python -I -X utf8 scripts/sprint-estado.py --check          # gate: exit 1 si hay falso TERMINADO
  python -I -X utf8 scripts/sprint-estado.py --tabla          # regenera la tabla-indice (idempotente)
  python -I -X utf8 scripts/sprint-estado.py --pct --hoy 2026-10-14
  python -I -X utf8 scripts/sprint-estado.py --marcar B-3 --estado TERMINADO \
         --cierre "merge 6d3b3579 - DoD(1) predicado unico apps/x.py:12 - DoD(2) test verde VPS"
  python -I -X utf8 scripts/sprint-estado.py --autotest       # control positivo Y negativo del gate
"""
import argparse
import os
import re
import subprocess
import sys
import tempfile

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BACKLOG = os.path.join(RAIZ, "docs", "copiloto-emprendedor", "2026-10-11-BACKLOG-sprint-mobile-beta.md")

ESTADOS = ("PENDIENTE", "EN-CURSO", "DOD-PARCIAL", "TERMINADO")
MARCA_INI = "<!-- TABLA-ESTADO:INICIO (generada por scripts/sprint-estado.py --tabla - NO editar a mano) -->"
MARCA_FIN = "<!-- TABLA-ESTADO:FIN -->"

RE_FICHA = re.compile(r"^### (?P<id>SM-[A-F]\d+) · `(?P<issue>[^`]+)` — (?P<titulo>.*?)\s*$")
RE_BLOQUE = re.compile(r"^# Bloque (?P<letra>[A-F]) · (?P<nombre>.*?)\s*$")
RE_CAMPO = re.compile(r"^\s*-\s+\*\*(?P<campo>[^:*]+):?\*\*:?\s*(?P<valor>.*?)\s*$")
RE_SHA = re.compile(r"\b[0-9a-f]{7,40}\b")


def leer(path):
    with open(path, "r", encoding="utf-8", newline="") as fh:
        return fh.read()


def escribir_atomico(path, texto):
    """tmp + os.replace: open(path,'w') TRUNCA al abrir y una excepcion deja 0 bytes."""
    d = os.path.dirname(path)
    fd, tmp = tempfile.mkstemp(dir=d, prefix=".sprint-estado-", suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="") as fh:
            fh.write(texto)
        os.replace(tmp, path)
    except BaseException:
        if os.path.exists(tmp):
            os.unlink(tmp)
        raise


def parsear(texto):
    """Devuelve [ficha] en orden del documento. Una ficha = un dict con sus campos crudos."""
    fichas, bloque, actual = [], None, None
    for i, linea in enumerate(texto.splitlines(), start=1):
        mb = RE_BLOQUE.match(linea)
        if mb:
            bloque = "%s - %s" % (mb.group("letra"), mb.group("nombre"))
            continue
        mf = RE_FICHA.match(linea)
        if mf:
            actual = {
                "id": mf.group("id"), "issue": mf.group("issue"), "titulo": mf.group("titulo"),
                "bloque": bloque, "linea": i, "campos": {},
            }
            fichas.append(actual)
            continue
        if actual is None:
            continue
        if linea.startswith("#"):
            actual = None
            continue
        mc = RE_CAMPO.match(linea)
        if mc:
            actual["campos"][mc.group("campo").strip()] = mc.group("valor").strip()
    return fichas


def estado_de(f):
    return f["campos"].get("Estado", "").split("·")[0].strip()


def sha_en_main(sha):
    """True si el sha existe Y es ancestro de origin/main. Citar un sha de rama no alcanza
    (memoria `la-cita-de-procedencia-muere-en-el-merge`)."""
    try:
        if subprocess.call(["git", "-C", RAIZ, "cat-file", "-e", sha + "^{commit}"],
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL) != 0:
            return False, "no existe en este clon"
        rc = subprocess.call(["git", "-C", RAIZ, "merge-base", "--is-ancestor", sha, "origin/main"],
                             stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        return (True, "ancestro de origin/main") if rc == 0 else (False, "existe pero NO esta en origin/main")
    except OSError as exc:
        return False, "git no disponible: %s" % exc


def verificar(fichas, con_git=True):
    """Devuelve (errores, avisos). Un error = exit 1 del gate."""
    errores, avisos = [], []
    por_id = {f["id"]: f for f in fichas}
    for f in fichas:
        est, fid = estado_de(f), f["id"]
        if not est:
            errores.append("%s (linea %d): sin campo **Estado:**. Toda ficha necesita su renglon."
                           % (fid, f["linea"]))
            continue
        if est not in ESTADOS:
            errores.append("%s: Estado '%s' no esta en el enum %s." % (fid, est, "|".join(ESTADOS)))
            continue
        if est == "EN-CURSO" and not f["campos"].get("Dueno-activo"):
            errores.append("%s: EN-CURSO sin **Dueno-activo:**. Una ficha tomada sin dueno es una "
                           "ficha parada que nadie reclama." % fid)
        if est == "DOD-PARCIAL" and not f["campos"].get("Falta"):
            errores.append("%s: DOD-PARCIAL sin **Falta:**. El estado existe para NOMBRAR lo que "
                           "falta del DoD; sin eso es un TERMINADO disfrazado." % fid)
        if est == "TERMINADO":
            cierre = f["campos"].get("Cierre", "")
            if not cierre:
                errores.append("%s: TERMINADO sin **Cierre:**. El DoD completo se acredita con "
                               "evidencia, no con la autoevaluacion de quien lo hizo." % fid)
            else:
                shas = RE_SHA.findall(cierre)
                sin_codigo = "sin-codigo" in cierre
                if not shas and not sin_codigo:
                    errores.append("%s: **Cierre:** no cita ningun sha. Si la ficha cierra sin codigo "
                                   "(decision del operador), escribi 'sin-codigo' y el motivo." % fid)
                elif shas and con_git:
                    ok = [s for s in shas if sha_en_main(s)[0]]
                    if not ok:
                        detalle = "; ".join("%s: %s" % (s, sha_en_main(s)[1]) for s in shas[:3])
                        errores.append("%s: TERMINADO pero ningun sha citado esta en origin/main (%s)."
                                       % (fid, detalle))
            dep = f["campos"].get("Depende de", "")
            for otro in re.findall(r"\b(SM-[A-F]\d+)\b", dep):
                if otro in por_id and estado_de(por_id[otro]) != "TERMINADO":
                    avisos.append("%s esta TERMINADO pero su dependencia %s esta %s."
                                  % (fid, otro, estado_de(por_id[otro]) or "sin estado"))
    return errores, avisos


def tabla(fichas):
    icono = {"PENDIENTE": "⬜", "EN-CURSO": "\U0001f7e8",
             "DOD-PARCIAL": "\U0001f7e7", "TERMINADO": "✅"}
    out = [MARCA_INI, "",
           "| Ficha | Issue | Estado | Que falta del DoD / evidencia de cierre |",
           "|---|---|---|---|"]
    for f in fichas:
        est = estado_de(f) or "?"
        detalle = (f["campos"].get("Falta") or f["campos"].get("Cierre")
                   or f["campos"].get("Dueno-activo") or "—")
        detalle = re.sub(r"\s+", " ", detalle)
        if len(detalle) > 120:
            detalle = detalle[:117] + "…"
        out.append("| **%s** | `%s` | %s %s | %s |"
                   % (f["id"], f["issue"], icono.get(est, "❔"), est, detalle))
    out += ["", MARCA_FIN]
    return out


def insertar_tabla(texto, fichas):
    nl = "\r\n" if "\r\n" in texto else "\n"
    cuerpo = nl.join(tabla(fichas))
    if MARCA_INI in texto and MARCA_FIN in texto:
        ini = texto.index(MARCA_INI)
        fin = texto.index(MARCA_FIN) + len(MARCA_FIN)
        return texto[:ini] + cuerpo + texto[fin:]
    ancla = texto.find("# Bloque A")
    if ancla < 0:
        raise SystemExit("no encuentro el ancla '# Bloque A' para insertar la tabla")
    return texto[:ancla] + cuerpo + nl + nl + texto[ancla:]


def marcar(texto, fid, estado, cierre=None, falta=None, dueno=None):
    """Escribe/actualiza los bullets gestionados de UNA ficha, debajo de su encabezado."""
    if estado not in ESTADOS:
        raise SystemExit("estado '%s' no esta en %s" % (estado, "|".join(ESTADOS)))
    nl = "\r\n" if "\r\n" in texto else "\n"
    lineas = texto.split(nl)
    idx = next((i for i, ln in enumerate(lineas)
                if RE_FICHA.match(ln) and RE_FICHA.match(ln).group("id") == fid), None)
    if idx is None:
        raise SystemExit("ficha '%s' no existe en el backlog. Un id inventado no es una orden." % fid)
    gestionados = ("Estado", "Cierre", "Falta", "Dueno-activo")
    j = idx + 1
    while j < len(lineas) and not lineas[j].startswith("#"):
        mc = RE_CAMPO.match(lineas[j])
        if mc and mc.group("campo").strip() in gestionados:
            lineas[j] = None
        j += 1
    nuevos = ["", "- **Estado:** %s" % estado]
    if dueno:
        nuevos.append("- **Dueno-activo:** %s" % dueno)
    if falta:
        nuevos.append("- **Falta:** %s" % falta)
    if cierre:
        nuevos.append("- **Cierre:** %s" % cierre)
    lineas = [ln for ln in lineas if ln is not None]
    idx = next(i for i, ln in enumerate(lineas)
               if RE_FICHA.match(ln) and RE_FICHA.match(ln).group("id") == fid)
    while idx + 1 < len(lineas) and lineas[idx + 1].strip() == "":
        del lineas[idx + 1]
    lineas[idx + 1:idx + 1] = nuevos
    return nl.join(lineas)


def autotest():
    """Control POSITIVO y NEGATIVO del gate: un gate que nunca dispara no es un gate."""
    base = "### SM-F9 · `#1` — ficha de prueba\r\n\r\n- **DoD:** algo\r\n"
    casos = [
        ("sin Estado", base, 1),
        ("Estado invalido", base.replace("- **DoD:**", "- **Estado:** CASI\r\n- **DoD:**"), 1),
        ("TERMINADO sin Cierre", base.replace("- **DoD:**", "- **Estado:** TERMINADO\r\n- **DoD:**"), 1),
        ("TERMINADO sha inventado", base.replace(
            "- **DoD:**", "- **Estado:** TERMINADO\r\n- **Cierre:** merge deadbee\r\n- **DoD:**"), 1),
        ("DOD-PARCIAL sin Falta", base.replace("- **DoD:**", "- **Estado:** DOD-PARCIAL\r\n- **DoD:**"), 1),
        ("EN-CURSO sin dueno", base.replace("- **DoD:**", "- **Estado:** EN-CURSO\r\n- **DoD:**"), 1),
        ("PENDIENTE limpio", base.replace("- **DoD:**", "- **Estado:** PENDIENTE\r\n- **DoD:**"), 0),
        ("TERMINADO sin-codigo", base.replace(
            "- **DoD:**",
            "- **Estado:** TERMINADO\r\n- **Cierre:** sin-codigo - decision operador\r\n- **DoD:**"), 0),
    ]
    fallos = 0
    for nombre, txt, esperado in casos:
        if not parsear(txt):
            print("  [FALLA] %-26s el parser no vio la ficha de prueba" % nombre)
            fallos += 1
            continue
        errs, _ = verificar(parsear(txt))
        obtenido = 1 if errs else 0
        if obtenido != esperado:
            fallos += 1
        print("  [%s] %-26s esperado=%d obtenido=%d %s"
              % ("OK   " if obtenido == esperado else "FALLA", nombre, esperado, obtenido,
                 ("| " + errs[0][:62]) if errs else ""))
    sha_real = subprocess.check_output(["git", "-C", RAIZ, "rev-parse", "HEAD"]).decode().strip()[:8]
    txt_ok = base.replace("- **DoD:**",
                          "- **Estado:** TERMINADO\r\n- **Cierre:** merge %s - ev\r\n- **DoD:**" % sha_real)
    visto = parsear(txt_ok)
    errs, _ = verificar(visto)
    if errs or not visto:
        fallos += 1
    if not visto:
        print("  [FALLA] %-26s el parser no vio la ficha: un esperado=0 que pasa por VACIO es falso verde"
              % "TERMINADO sha REAL")
        return 1
    print("  [%s] %-26s esperado=0 obtenido=%d %s"
          % ("OK   " if not errs else "FALLA", "TERMINADO sha REAL", 1 if errs else 0,
             ("| " + errs[0][:62]) if errs else ""))
    print("\nautotest: %s (%d fallos de %d casos)"
          % ("VERDE" if not fallos else "ROJO", fallos, len(casos) + 1))
    return 1 if fallos else 0


def main():
    ap = argparse.ArgumentParser(description="Registro unico de estado del sprint mobile.")
    ap.add_argument("--check", action="store_true", help="gate: exit 1 si hay un TERMINADO sin evidencia")
    ap.add_argument("--tabla", action="store_true", help="regenera la tabla-indice (idempotente)")
    ap.add_argument("--pct", action="store_true", help="porcentaje con sujeto y fecha")
    ap.add_argument("--hoy", help="fecha para el reporte de --pct (no la invento)")
    ap.add_argument("--marcar", metavar="ID", help="ficha a marcar")
    ap.add_argument("--estado", choices=ESTADOS)
    ap.add_argument("--cierre")
    ap.add_argument("--falta")
    ap.add_argument("--dueno")
    ap.add_argument("--autotest", action="store_true")
    ap.add_argument("--sin-git", action="store_true", help="no validar shas contra origin/main")
    a = ap.parse_args()

    if a.autotest:
        return autotest()

    texto = leer(BACKLOG)

    if a.marcar:
        if not a.estado:
            raise SystemExit("--marcar exige --estado")
        texto = marcar(texto, a.marcar, a.estado, a.cierre, a.falta, a.dueno)
        fichas = parsear(texto)
        errs, _ = verificar([f for f in fichas if f["id"] == a.marcar], con_git=not a.sin_git)
        if errs:
            print("RECHAZADO - el marcado no cumple su propia regla:")
            for e in errs:
                print("  [X] " + e)
            return 1
        texto = insertar_tabla(texto, fichas)
        escribir_atomico(BACKLOG, texto)
        print("OK %s -> %s (tabla regenerada)" % (a.marcar, a.estado))
        return 0

    fichas = parsear(texto)
    if not fichas:
        raise SystemExit("0 fichas parseadas: el formato del backlog cambio. Vacio = pregunta, no luz verde.")

    if a.tabla:
        escribir_atomico(BACKLOG, insertar_tabla(texto, fichas))
        print("tabla regenerada: %d fichas" % len(fichas))

    if a.check:
        errs, avisos = verificar(fichas, con_git=not a.sin_git)
        for w in avisos:
            print("[!] " + w)
        if errs:
            print("\n[X] REGISTRO INCOHERENTE - %d problema(s):" % len(errs))
            for e in errs:
                print("  - " + e)
            print("\nArreglalo con: python -I -X utf8 scripts/sprint-estado.py --marcar <ID> --estado <E> ...")
            return 1
        print("OK registro coherente: %d fichas, todos los TERMINADO con sha en origin/main" % len(fichas))

    if a.pct:
        cuenta = {}
        for f in fichas:
            cuenta[estado_de(f)] = cuenta.get(estado_de(f), 0) + 1
        tot = len(fichas)
        term = cuenta.get("TERMINADO", 0)
        print("SUJETO: fichas del backlog del sprint mobile (%s)" % os.path.basename(BACKLOG))
        print("FECHA : %s" % (a.hoy or "no declarada (pasa --hoy)"))
        print("TOTAL : %d fichas" % tot)
        for e in ESTADOS:
            print("  %-12s %2d  (%4.1f%%)" % (e, cuenta.get(e, 0), 100.0 * cuenta.get(e, 0) / tot))
        sin = cuenta.get("", 0)
        if sin:
            print("  %-12s %2d  (%4.1f%%)  <- sin campo Estado" % ("(sin marcar)", sin, 100.0 * sin / tot))
        print("DoD COMPLETO: %d/%d = %.1f%% - una cifra sin sujeto ni fecha es inutilizable"
              % (term, tot, 100.0 * term / tot))
    return 0


if __name__ == "__main__":
    sys.exit(main())
