#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Por cada fila PENDIENTE del mapeo: mide si lo que declara ausente EXISTE en `origin/main`.

POR QUE EXISTE (seis casos el 2026-10-15, todos el mismo dia)
-------------------------------------------------------------
Un simbolo de divergencia (una dependencia atada, o una divergencia sin cerrar) lo escribe la DUENA
DEL DOC. La dependencia la cumple OTRA sesion, que mergea y avisa en el buzon. Nadie cierra el
simbolo, porque quien podria no es quien lo escribio. Medido ese dia:

  1. `consent` -- el pedido era `capacidades[]`; lo cumple `alcance_items` (`catalog.py:145`), mergeado.
  2. el `total` del listado de presupuestos -- existia en `presupuestos_web.py:325-327` (#1219) y un
     contrato de planificacion lo declaro inexistente. Lo refuto backend con la medicion.
  3. `soporte`, backend -- `GET /soporte/tickets` existia desde #1111 (`web.py:996`, `:1034`).
  4. el helper de presupuestos -- ya estaba en main (#1210).
  5. `soporte`, codigo de app -- el clip y el control de tickets anteriores estaban escritos desde
     #1115 (`PantallaSoporte.tsx:152-165,230-232`). No se vieron en el device porque se midio con
     CERO tickets: con `vigente === null` la tarjeta no tiene que mostrar nada y el clip avisa por
     `Alert`, a proposito.
  6. las 4 filas que midio frontend1 (`(home)`, `bi-refresh`, `entrada`, `splash`): de 11
     divergencias declaradas, **8 EXISTEN** (las cerro #1093).

Consecuencia dura: la cifra de pendientes esta SOBREESTIMADA y la de cumplidas SUBESTIMADA, y el
error no se ve desde ningun lado -- cada sesion verifico su mitad y la costura no es de nadie.

QUE HACE Y QUE NO HACE
----------------------
DESTAPA, no juzga. Dice «los identificadores que esta fila nombra EXISTEN en main: anda a mirarla»,
y **no marca ningun simbolo**: el simbolo lo escribe la duena del doc y solo un lugar mide
(`DEC-18`, `memoria/un-criterio-que-crece-con-cada-medicion-no-se-puede-alcanzar.md`).

EXISTENCIA NO ES CUMPLIMIENTO, y el caso 5 es la prueba: todo lo que la fila `soporte` nombraba
existia en main **y la fila seguia necesitando device** para verse. Si este script dijera «cumplida»
estaria fabricando el mismo falso verde que vino a cazar. Por eso su veredicto se llama
`CANDIDATA-A-REVISAR` y nunca `CERRADA`.

EL FALSO NEGATIVO, MEDIDO Y REPORTADO
-------------------------------------
Una fila que describe su ausencia en PROSA, sin ningun identificador entre backticks, es invisible
para este instrumento. No se puede evitar sin adivinar prosa -- pero se puede CONTAR, y se cuenta:
cada corrida reporta cuantas filas no tienen ningun identificador medible. Un instrumento que acota
su cobertura y no lo dice se lee como si hubiera mirado todo
(`memoria/instrumento-que-no-mira-nunca-falla.md`).

EL CORPUS NO SE RE-PARSEA
-------------------------
Las filas pendientes y su texto se consumen de `medir-mapeo-implementacion.py --json`
(`pendientes` + `texto_de_las_pendientes`). Re-leer los docs aca fabricaria una segunda definicion
de «que declara ausente esta fila», que es como se termina con dos cifras para la misma pregunta
(`memoria/dos-implementaciones-del-mismo-cliente-el-fix-llega-a-una.md`). Mismo patron que
`falta-en-mobile.py` con `contar-veredictos.py`.

EXIT CODES
  0  corrio y reporto (haya o no candidatas: encontrar candidatas no es un fallo, es el hallazgo)
  2  no pude medir (sin `origin/main`, el medidor no emitio json, o es anterior al campo que consumo)
  3  el medidor reporto su corpus ATRASADO: la lista de pendientes no es la de main

Read-only. Uso: python existe-en-main.py [--json] [--canario]
"""
import io
import json
import re
import subprocess
import sys
from pathlib import Path

AQUI = Path(__file__).resolve().parent
MEDIDOR = AQUI / "medir-mapeo-implementacion.py"
# Donde se busca un simbolo. No es `.` a proposito: un hit en `docs/` o en el buzon probaria que
# alguien lo ESCRIBIO, no que este implementado -- y es justo la confusion que este script ataja.
AMBITOS = ["apps", "packages", "motor", "deploy", "scripts"]
RE_BACKTICK = re.compile(r"`([^`]+)`")
RE_PATHISH = re.compile(r"[\w./-]+\.(?:tsx?|py|md|json|sh)(?::\d+(?:-\d+)?)?$")
RE_SIMBOLO = re.compile(r"^[A-Za-z_][A-Za-z0-9_]{2,}$")

# JERGA DEL REGISTRO: tokens que las filas citan para hablar DEL REGISTRO, no del producto. Existen
# todos (son el vocabulario de los propios instrumentos y del buzon) y su presencia no dice NADA
# sobre la divergencia. Sin esta lista inflaban las candidatas: la primera corrida sobre el corpus
# real marco `SI` en `pedido_`, `NO_MEDIBLE` y `NO_REPRODUCIBLE_SIN_EFECTO`, y una fila puede salir
# CANDIDATA porque sus tokens ACCESORIOS existen mientras lo que de verdad declara ausente no.
JERGA = {
    "NO_MEDIBLE", "NO_REPRODUCIBLE_SIN_EFECTO", "COHERENTE", "DESVIO", "ASSUMED_PENDING_VERIFY",
    "pedido_", "dato_", "contrato_", "hallazgo_", "avance_", "cierre_", "urgente_",
    "CERRADA", "PENDIENTE", "ENMIENDA", "enmienda", "device", "main", "origin",
}
RE_SHA = re.compile(r"^[0-9a-f]{7,40}$")
RE_ID_BACKLOG = re.compile(r"^(?:BL|DEC|SM|ADR)[-_]")


def morir(msg, rc=2):
    sys.stderr.write("existe-en-main: %s\n" % msg)
    sys.exit(rc)


def _raiz():
    r = subprocess.run(["git", "rev-parse", "--show-toplevel"], cwd=str(AQUI),
                       capture_output=True, text=True)
    if r.returncode != 0:
        morir("no estoy dentro de un repo git")
    return Path(r.stdout.strip())


RAIZ = _raiz()


def git(*args):
    return subprocess.run(["git"] + list(args), cwd=str(RAIZ), capture_output=True,
                          text=True, errors="replace")


def pendientes_del_medidor():
    """-> (ids, {id: texto}, corpus_divergente). NO re-parsea los docs."""
    if not MEDIDOR.is_file():
        morir("falta %s. Este script NO define su propia lectura del corpus a proposito." % MEDIDOR)
    r = subprocess.run([sys.executable, "-I", str(MEDIDOR), "--json"], cwd=str(RAIZ),
                       capture_output=True, text=True, errors="replace")
    # rc 3 del medidor = hay un id del padron sin veredicto. Es un hallazgo SUYO y no invalida el
    # json, asi que no se aborta por eso: hacerlo dejaria que su rojo tape esta medicion.
    try:
        d = json.loads(r.stdout)
    except Exception:
        morir("el medidor no emitio json (rc=%s): %s" % (r.returncode, (r.stderr or r.stdout)[:300]))
    if "texto_de_las_pendientes" not in d:
        morir("el medidor de este arbol no emite `texto_de_las_pendientes` -- es anterior al fix del "
              "2026-10-15. Corre sobre un arbol al dia.")
    return (d.get("pendientes", []), d.get("texto_de_las_pendientes", {}),
            d.get("corpus_divergente_de_main"))


def clasificar_token(t):
    """-> (tipo, token normalizado). El `:linea` se descarta para medir la existencia del ARCHIVO:
    el mapeo cita lineas que se corren con cada commit, y un numero viejo no prueba ausencia."""
    t = t.strip()
    if RE_PATHISH.search(t):
        return "path", t.split(":")[0]
    if t in JERGA or RE_SHA.match(t) or RE_ID_BACKLOG.match(t):
        return "jerga", t
    if RE_SIMBOLO.match(t):
        return "simbolo", t
    return "no-medible", t


_ARBOL = None


def arbol_de_main():
    global _ARBOL
    if _ARBOL is None:
        r = git("ls-tree", "-r", "--name-only", "origin/main")
        if r.returncode != 0:
            morir("no pude listar `origin/main` (fetch shallow?): " + (r.stderr or "").strip()[:160])
        _ARBOL = r.stdout.splitlines()
    return _ARBOL


def existe_path(p):
    """El mapeo cita `web.py:996` sin su directorio, asi que un basename cuenta si hay un archivo con
    ese nombre. Si hay varios se reportan todos: elegir uno seria inventar cual citaba la fila."""
    base = p.split("/")[-1]
    return [x for x in arbol_de_main()
            if x == p or x.endswith("/" + p) or x.endswith("/" + base)]


def existe_simbolo(s):
    """-> lista de archivos, o None si no se pudo medir. `None` NO es lista vacia: vacio significa
    «medi y no esta», None «no medi» -- y confundirlos es leer un vacio como luz verde."""
    amb = [a for a in AMBITOS if any(x.startswith(a + "/") for x in arbol_de_main())]
    if not amb:
        return None
    r = git("grep", "-l", "-F", "--", s, "origin/main", *amb)
    if r.returncode not in (0, 1):            # 1 = sin hits, que es una respuesta, no un error
        return None
    return [ln.split(":", 1)[-1] for ln in r.stdout.splitlines() if ln.strip()]


def medir():
    ids, textos, corpus_div = pendientes_del_medidor()
    out = []
    for i in sorted(ids):
        txt = textos.get(i, "") or ""
        vistos, idents = set(), []
        for tok in RE_BACKTICK.findall(txt):
            k, v = clasificar_token(tok)
            if (k, v) in vistos:
                continue
            vistos.add((k, v))
            if k == "path":
                h = existe_path(v)
                idents.append({"tipo": k, "token": v, "existe": bool(h), "donde": h[:3]})
            elif k == "simbolo":
                h = existe_simbolo(v)
                if h and all(x.startswith("scripts/") for x in h):
                    # Un simbolo cuyos hits viven TODOS en `scripts/` existe en el INSTRUMENTAL, no
                    # en el producto: no prueba que la divergencia este implementada. No se cuenta
                    # como presente ni como ausente -- acusar por esto seria un falso rojo.
                    idents.append({"tipo": "solo-instrumentos", "token": v,
                                   "existe": None, "donde": h[:3]})
                else:
                    idents.append({"tipo": k, "token": v,
                                   "existe": None if h is None else bool(h),
                                   "donde": (h or [])[:3]})
            else:
                idents.append({"tipo": k, "token": v, "existe": None, "donde": []})
        medibles = [f for f in idents if f["existe"] is not None]
        if not medibles:
            veredicto = "SIN-IDENTIFICADOR-MEDIBLE"
        elif all(f["existe"] for f in medibles):
            veredicto = "CANDIDATA-A-REVISAR"
        elif any(f["existe"] for f in medibles):
            veredicto = "MITAD-EXISTE"
        else:
            veredicto = "NADA-EXISTE-EN-MAIN"
        out.append({"id": i, "veredicto": veredicto, "medibles": len(medibles),
                    "identificadores": idents})
    return out, corpus_div


def canario():
    """Rompe cada control de a uno y exige que CADA uno responda. Un gate que nunca se probo hacia
    el «no» es indistinguible de uno ausente: el verde no prueba que mire."""
    fallos = []
    # SIN `origin/main` NO SE PUEDE MEDIR, y eso NO es un verde. En GitHub Actions el fetch es
    # shallow y el ref no existe; si el canario abortara con rc=2 pondria rojo el lint de todas las
    # ramas por algo que no es del commit, y si devolviera 0 callado seria un gate que no mira.
    # Saltea DICIENDOLO, que es el unico de los tres que no miente.
    if git("rev-parse", "--verify", "origin/main").returncode != 0:
        print("CANARIO SALTEADO: no existe `origin/main` en este arbol (fetch shallow?) -- no es un "
              "verde: es una medicion que no se hizo")
        return
    vivo = "scripts/evidencia/medir-mapeo-implementacion.py"
    if not existe_path(vivo):
        fallos.append("1 POSITIVO: %s existe en main y el medidor de paths dijo que no" % vivo)
    if existe_path("apps/mobile/src/PantallaQueNadieEscribioJamas.tsx"):
        fallos.append("2 NEGATIVO: un path inventado dio existe=True (el medidor dice si a todo)")
    if not existe_simbolo("adjuntarFotoATicket"):
        fallos.append("3 SIMBOLO POSITIVO: `adjuntarFotoATicket` esta en packages/core y no lo vio")
    # El token del control negativo NO puede escribirse literal: este archivo vive en `scripts/`, que
    # es uno de los AMBITOS que `existe_simbolo` busca, asi que un literal aca SE ENCUENTRA A SI MISMO
    # en cuanto el archivo entra a main. Medido en vivo: el token anterior enrojecio el lint de TODAS
    # las ramas minutos despues de mergearse #1226 -- el instrumento paso a ser parte del corpus que
    # mide, y el control que probaba «un simbolo inventado NO da hits» empezo a fallar por si mismo.
    # Se arma en tiempo de corrida para que el literal no exista en el disco; el control 9 verifica
    # que siga siendo asi, porque «simplificarlo» de vuelta a un literal reintroduce el defecto.
    inventado = "Berenjena" + "DeCuarzo" + "QueNadieEscribio"
    if existe_simbolo(inventado):
        fallos.append("4 SIMBOLO NEGATIVO: un simbolo inventado dio hits")
    # La prosa NO puede contarse como ausente: contarla asi convertiria cada frase de una fila en una
    # divergencia viva, y el reporte diria que nada existe.
    if clasificar_token("Ver tablero >")[0] != "no-medible":
        fallos.append("5 PROSA: un token de prosa se clasifico como medible")
    if clasificar_token("web.py:996") != ("path", "web.py"):
        fallos.append("6 LINEA: el `:linea` no se descarto al normalizar el path")
    # 7 JERGA - el vocabulario del propio registro no es evidencia del producto. Sin este control la
    #   primera corrida real marco `SI` en `pedido_`, `NO_MEDIBLE` y `NO_REPRODUCIBLE_SIN_EFECTO`, y
    #   una fila sale CANDIDATA porque sus tokens ACCESORIOS existen.
    for t in ("NO_MEDIBLE", "pedido_", "BL-O7", "083f5055"):
        if clasificar_token(t)[0] != "jerga":
            fallos.append("7 JERGA: `%s` se clasifico como medible (%s)" % (t, clasificar_token(t)[0]))
    # 8 NEGATIVO de la jerga - la lista no puede comerse un identificador real del producto.
    for t in ("PantallaSoporte", "adjuntarFotoATicket", "TAGLINE_MARCA"):
        if clasificar_token(t)[0] != "simbolo":
            fallos.append("8 JERGA DEMASIADO ANCHA: `%s` dejo de ser medible" % t)
    # 9 - el control 4 se degrada SOLO si alguien vuelve a escribir su token como literal: ahi el
    # token esta de nuevo en el disco y el 4 enrojece para siempre sin decir por que. Esto lo caza
    # antes, leyendo el propio archivo.
    try:
        propio = io.open(__file__, encoding="utf-8").read()
    except OSError:
        propio = None                         # «no medi» != «medi y esta limpio»
    if propio is not None and inventado in propio:
        fallos.append("9 TOKEN LITERAL: el simbolo del control 4 esta escrito literal en este "
                      "archivo -- se va a encontrar a si mismo en cuanto entre a main")
    for f in fallos:
        print("CANARIO ROJO: " + f)
    if fallos:
        sys.exit(1)
    print("CANARIO OK: responden los 9 controles (2 positivos, 2 negativos, prosa, normalizacion,"
          " jerga y su negativo, y el token del 4 que no puede estar literal en el disco)")


def main():
    if "--canario" in sys.argv:
        canario()
        return
    filas, corpus_div = medir()
    cand = [f for f in filas if f["veredicto"] == "CANDIDATA-A-REVISAR"]
    ciegas = [f for f in filas if f["veredicto"] == "SIN-IDENTIFICADOR-MEDIBLE"]

    if "--json" in sys.argv:
        print(json.dumps({"arbol": str(RAIZ), "ref": "origin/main",
                          "unidad": "filas PENDIENTE-DECLARADA del mapeo",
                          "corpus_divergente_de_main": corpus_div,
                          "pendientes": len(filas),
                          "candidatas_a_revisar": [f["id"] for f in cand],
                          "sin_identificador_medible": [f["id"] for f in ciegas],
                          "filas": filas}, ensure_ascii=False, indent=2))
    else:
        print("ARBOL: %s   REF: origin/main" % RAIZ)
        if corpus_div is None:
            print("CORPUS: el medidor no pudo medir su vigencia -- estas filas pueden no ser de main")
        elif corpus_div:
            print("CORPUS ATRASADO: %d doc(s) difieren de origin/main -- la lista de pendientes NO "
                  "es la de main" % len(corpus_div))
        print("PENDIENTES LEIDAS: %d" % len(filas))
        for f in filas:
            print("\n  %-12s %s" % (f["id"], f["veredicto"]))
            for d in f["identificadores"]:
                marca = {True: "SI ", False: "NO ", None: "?  "}[d["existe"]]
                donde = ("  <- " + ", ".join(d["donde"])) if d["donde"] else ""
                print("      %s %-10s %s%s" % (marca, d["tipo"], d["token"], donde))
        print("\n" + "-" * 96)
        print("CANDIDATAS A REVISAR : %d/%d  [todo lo que nombran EXISTE en main -- la duena del doc "
              "re-marca]" % (len(cand), len(filas)))
        if cand:
            print("    " + " ".join(f["id"] for f in cand))
        print("SIN IDENT. MEDIBLE   : %d/%d  [describen la ausencia en prosa: este instrumento NO "
              "las ve]" % (len(ciegas), len(filas)))
        if ciegas:
            print("    " + " ".join(f["id"] for f in ciegas))
        print("OJO: existir NO es cumplir. `soporte` tenia TODO en main y seguia necesitando device.")

    if corpus_div:
        sys.exit(3)


if __name__ == "__main__":
    main()
