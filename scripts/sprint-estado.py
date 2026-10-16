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
  CERRADO-POR-DECISION  el DoD NO se va a cumplir y eso ES la resolucion: el operador declaro
               que la ficha cierra sin esa evidencia (p.ej. su DoD no es medible en device).
               Exige `Decision:` con QUIEN + CUANDO + DONDE (un doc del repo que EXISTE) y
               `Falta:` con lo que queda sin cumplir -- el hueco se DECLARA, no se borra.
  DIFERIDO     sale del alcance de ESTE sprint con su DoD intacto; exige `Decision:` igual y
               `Diferido-a:` con el destino. No es un cierre sino un cambio de ALCANCE, y por
               eso --pct lo descuenta del denominador en vez de sumarlo al avance.

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

ESTADOS = ("PENDIENTE", "EN-CURSO", "DOD-PARCIAL", "TERMINADO",
           "CERRADO-POR-DECISION", "DIFERIDO")
# Un estado que NO EXISTE en el enum no se puede marcar, y una ficha que no se puede marcar
# queda DOD-PARCIAL para siempre aunque el operador ya la haya resuelto. Medido el 2026-10-15:
# el operador decidio que 4 fichas cierran por DECLARACION (su DoD no es medible en device) y
# que 3 salen del sprint (SMTP/dominio, el tester externo), y el registro no tenia renglon para
# ninguna de las dos cosas -> el techo MECANICO del sprint era 23/27 = 85.2% por falta de una
# palabra en esta tupla. El enum ES el registro: lo que no esta aca no existe para el gate.
DECISORES = ("operador", "david")
RE_FECHA_ISO = re.compile(r"\b20\d\d-\d\d-\d\d\b")
RE_CITA_DOC = re.compile(
    r"(?P<path>(?:docs|memoria|scripts|apps|packages|deploy|motor)/[^\s,;)]+"
    r"\.(?:md|py|ts|tsx|sh))")
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


def _sha_ancestro_para_autotest():
    """Un sha corto que ES ancestro de origin/main en CUALQUIER rama, o None si no hay remoto.

    `merge-base HEAD origin/main` es el punto de bifurcacion: existe en el clon y esta en main.
    Usar HEAD en su lugar hace que el control positivo mida la rama (ver el comentario en
    `autotest`)."""
    for args in (["merge-base", "HEAD", "origin/main"], ["rev-parse", "origin/main"]):
        try:
            out = subprocess.check_output(["git", "-C", RAIZ] + args,
                                          stderr=subprocess.DEVNULL).decode().strip()
        except (subprocess.CalledProcessError, OSError):
            continue
        if out:
            return out[:8], True
    return None, False


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
        if est in ("CERRADO-POR-DECISION", "DIFERIDO"):
            errores.extend(validar_decision(fid, est, f["campos"]))
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


def validar_decision(fid, est, campos):
    """La evidencia de una decision es VERIFICABLE o no es evidencia.

    El operador pidio el estado «con evidencia obligatoria» (2026-10-15). Un `Decision:` en prosa
    libre seria el mismo agujero que este repo ya pago con el «0 secretos» de la cabecera de
    CLAUDE.md: una atestacion sin fecha se cita como si fuera de hoy. Asi que el gate exige las
    TRES cosas que la hacen auditable y chequea la unica que puede chequear solo -- que el doc
    citado EXISTA:

      QUIEN   uno de DECISORES; una decision sin sujeto no se puede contrastar con nadie.
      CUANDO  fecha ISO; sin fecha la decision no envejece, y por eso nunca se revisa.
      DONDE   un path del repo que existe. NO vale `coordinacion/` (no esta versionada: un gate con
              corpus fuera del repo mide al equipo y en CI da vacio) ni «lo dijo en el chat», que
              no es citable por quien clona el repo.
    """
    out = []
    dec = campos.get("Decision", "")
    if not dec:
        out.append("%s: %s sin **Decision:**. El estado existe para registrar una decision AJENA al "
                   "DoD; sin quien/cuando/donde es un TERMINADO disfrazado de tramite." % (fid, est))
        return out
    falta = []
    if not any(d in dec.lower() for d in DECISORES):
        falta.append("QUIEN (uno de %s)" % "|".join(DECISORES))
    # La fecha se busca con los paths BORRADOS. Lo cazo el control negativo del autotest, no yo:
    # en este repo todo doc se llama `2026-10-11-...md`, asi que cualquier cita satisfacia el
    # chequeo de CUANDO sola y el gate era decorativo EN EL CASO NORMAL -- el unico que importa.
    if not RE_FECHA_ISO.search(RE_CITA_DOC.sub(" ", dec)):
        falta.append("CUANDO (fecha YYYY-MM-DD propia; la del nombre del doc citado no cuenta)")
    m = RE_CITA_DOC.search(dec)
    if not m:
        falta.append("DONDE (un doc del repo: docs/...md; `coordinacion/` no esta versionada)")
    else:
        p = m.group("path").split("#")[0].split(":")[0]
        if not os.path.exists(os.path.join(RAIZ, p)):
            falta.append("DONDE: el doc citado '%s' NO existe en el repo" % p)
    if falta:
        out.append("%s: **Decision:** incompleta -- falta %s. Lo escrito: %r"
                   % (fid, " + ".join(falta), dec[:90]))
    if est == "CERRADO-POR-DECISION" and not campos.get("Falta"):
        out.append("%s: CERRADO-POR-DECISION sin **Falta:**. Cerrar por decision no borra el hueco: "
                   "lo DECLARA. Sin el, la ficha es indistinguible de un DoD cumplido." % fid)
    if est == "DIFERIDO" and not campos.get("Diferido-a"):
        out.append("%s: DIFERIDO sin **Diferido-a:**. Un diferido sin destino es un abandono con "
                   "mejor nombre: nadie lo vuelve a levantar." % fid)
    return out


def tabla(fichas):
    icono = {"PENDIENTE": "⬜", "EN-CURSO": "\U0001f7e8",
             "DOD-PARCIAL": "\U0001f7e7", "TERMINADO": "✅",
             "CERRADO-POR-DECISION": "\U0001f5f3\ufe0f", "DIFERIDO": "\u23ed\ufe0f"}
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


def marcar(texto, fid, estado, cierre=None, falta=None, dueno=None,
           decision=None, diferido_a=None):
    """Escribe/actualiza los bullets gestionados de UNA ficha, debajo de su encabezado."""
    if estado not in ESTADOS:
        raise SystemExit("estado '%s' no esta en %s" % (estado, "|".join(ESTADOS)))
    nl = "\r\n" if "\r\n" in texto else "\n"
    lineas = texto.split(nl)
    idx = next((i for i, ln in enumerate(lineas)
                if RE_FICHA.match(ln) and RE_FICHA.match(ln).group("id") == fid), None)
    if idx is None:
        raise SystemExit("ficha '%s' no existe en el backlog. Un id inventado no es una orden." % fid)
    gestionados = ("Estado", "Cierre", "Falta", "Dueno-activo", "Decision", "Diferido-a")
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
    if decision:
        nuevos.append("- **Decision:** %s" % decision)
    if diferido_a:
        nuevos.append("- **Diferido-a:** %s" % diferido_a)
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
    DOC_OK = "docs/copiloto-emprendedor/2026-10-11-BACKLOG-sprint-mobile-beta.md"
    DEC_OK = "operador 2026-10-15, ver %s" % DOC_OK
    casos = [
        ("sin Estado", base, 1),
        ("Estado invalido", base.replace("- **DoD:**", "- **Estado:** CASI\r\n- **DoD:**"), 1),
        ("TERMINADO sin Cierre", base.replace("- **DoD:**", "- **Estado:** TERMINADO\r\n- **DoD:**"), 1),
        ("TERMINADO sha inventado", base.replace(
            "- **DoD:**", "- **Estado:** TERMINADO\r\n- **Cierre:** merge deadbee\r\n- **DoD:**"), 1),
        ("DOD-PARCIAL sin Falta", base.replace("- **DoD:**", "- **Estado:** DOD-PARCIAL\r\n- **DoD:**"), 1),
        ("EN-CURSO sin dueno", base.replace("- **DoD:**", "- **Estado:** EN-CURSO\r\n- **DoD:**"), 1),
        ("PENDIENTE limpio", base.replace("- **DoD:**", "- **Estado:** PENDIENTE\r\n- **DoD:**"), 0),
        ("CxD sin Decision", base.replace(
            "- **DoD:**", "- **Estado:** CERRADO-POR-DECISION\r\n- **Falta:** x\r\n- **DoD:**"), 1),
        ("CxD sin Falta", base.replace(
            "- **DoD:**", "- **Estado:** CERRADO-POR-DECISION\r\n- **Decision:** " + DEC_OK
            + "\r\n- **DoD:**"), 1),
        ("CxD Decision sin fecha", base.replace(
            "- **DoD:**", "- **Estado:** CERRADO-POR-DECISION\r\n- **Falta:** x\r\n"
            "- **Decision:** operador en %s\r\n- **DoD:**" % DOC_OK), 1),
        ("CxD Decision sin quien", base.replace(
            "- **DoD:**", "- **Estado:** CERRADO-POR-DECISION\r\n- **Falta:** x\r\n"
            "- **Decision:** 2026-10-15 en %s\r\n- **DoD:**" % DOC_OK), 1),
        ("CxD doc INEXISTENTE", base.replace(
            "- **DoD:**", "- **Estado:** CERRADO-POR-DECISION\r\n- **Falta:** x\r\n"
            "- **Decision:** operador 2026-10-15 en docs/no-existe-jamas.md\r\n- **DoD:**"), 1),
        ("CxD COMPLETO", base.replace(
            "- **DoD:**", "- **Estado:** CERRADO-POR-DECISION\r\n- **Falta:** x\r\n"
            "- **Decision:** " + DEC_OK + "\r\n- **DoD:**"), 0),
        ("DIFERIDO sin destino", base.replace(
            "- **DoD:**", "- **Estado:** DIFERIDO\r\n- **Decision:** " + DEC_OK
            + "\r\n- **DoD:**"), 1),
        ("DIFERIDO COMPLETO", base.replace(
            "- **DoD:**", "- **Estado:** DIFERIDO\r\n- **Diferido-a:** sprint siguiente\r\n"
            "- **Decision:** " + DEC_OK + "\r\n- **DoD:**"), 0),
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
    # El sha del control positivo sale de `origin/main`, NO de HEAD. Con HEAD, este caso medía la
    # RAMA y no el gate: `sha_en_main()` exige ser ANCESTRO de origin/main, y el HEAD de cualquier
    # rama de PR no lo es todavia -- el autotest daba VERDE en main y ROJO en las dos ramas que lo
    # estrenaron (CI de #1275 y #1276, 2026-10-16). O sea: el control fallaba exactamente donde el
    # gate sirve, y un falso rojo no es prudencia -- es el permiso para el `--no-verify`, que en
    # este repo arrastra gitleaks. `merge-base HEAD origin/main` es ancestro de origin/main por
    # definicion y existe en cualquier checkout con el remoto; si no hay remoto, cae a HEAD y el
    # caso se SALTEA en vez de condenar (se declara, no se finge verde).
    sha_real, _puede = _sha_ancestro_para_autotest()
    if sha_real is None:
        print("  [SKIP ] %-26s sin `origin/main` en este clon: el caso no se puede montar"
              % "TERMINADO sha REAL")
        print("\nautotest: %s (%d fallos de %d casos, 1 salteado)"
              % ("VERDE" if not fallos else "ROJO", fallos, len(casos)))
        return 1 if fallos else 0
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
    ap.add_argument("--decision", help="QUIEN + CUANDO + DONDE (doc del repo) de la decision")
    ap.add_argument("--diferido-a", dest="diferido_a", help="destino de una ficha DIFERIDA")
    ap.add_argument("--autotest", action="store_true")
    ap.add_argument("--sin-git", action="store_true", help="no validar shas contra origin/main")
    a = ap.parse_args()

    if a.autotest:
        return autotest()

    texto = leer(BACKLOG)

    if a.marcar:
        if not a.estado:
            raise SystemExit("--marcar exige --estado")
        texto = marcar(texto, a.marcar, a.estado, a.cierre, a.falta, a.dueno,
                       a.decision, a.diferido_a)
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
        # TRES cifras y no una, por la misma razon que el repo ya pago en la memoria
        # `una-cifra-sin-unidad-se-deja-citar-para-cualquier-pregunta`: "cuanto del DoD esta
        # cumplido", "cuanto esta RESUELTO" y "cuanto queda del alcance VIVO" son preguntas
        # distintas, y una sola cifra se cita para las tres -- siempre la mas alta.
        dec = cuenta.get("CERRADO-POR-DECISION", 0)
        dif = cuenta.get("DIFERIDO", 0)
        vivo = tot - dif
        print("DoD COMPLETO            : %d/%d = %.1f%%  (evidencia del DoD entero)"
              % (term, tot, 100.0 * term / tot))
        print("+ CERRADAS POR DECISION : %d/%d = %.1f%%  (RESUELTAS: %d con DoD + %d declaradas)"
              % (term + dec, tot, 100.0 * (term + dec) / tot, term, dec))
        if dif:
            print("ALCANCE VIVO            : %d/%d = %.1f%%  (sin las %d DIFERIDAS, que salieron "
                  "del sprint con su DoD intacto)"
                  % (term + dec, vivo, 100.0 * (term + dec) / vivo if vivo else 0.0, dif))
        print("Una cifra sin sujeto ni fecha es inutilizable, y una sin UNIDAD se cita para "
              "cualquiera de las tres preguntas.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
