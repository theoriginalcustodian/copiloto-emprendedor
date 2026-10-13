#!/usr/bin/env python3
"""Mide la IMPLEMENTACION del mapeo prototipo->nativo (contratos del 2026-10-12), por fila y con unidad.

POR QUE EXISTE, y por que NO es `contar-veredictos.py` (2026-10-13).
El operador pidio «cuanto implementamos en %» y se le contesto **13 de 54 (24%)**. Era falso, y la
causa no era el dato: `contar-veredictos.py` mide el **criterio 3 / BL-Q3-v2** (paridad
prototipo<->PWA+mobile por `id + camino`) y descubre su corpus con `rglob` sobre **`coordinacion/`**
unicamente. Los tres documentos de veredictos del mapeo viven en **`docs/copiloto-emprendedor/`**,
fuera de ese arbol: no llegan ni a candidatos, asi que el ratchet «candidato sin clasificar -> exit 8»
—que existe justamente para que ningun documento se ignore en silencio— **tampoco los ve**. Un
instrumento con cuatro ratchets quedo ciego por el DIRECTORIO, no por el archivo.
  -> memoria: instrumento-que-no-mira-nunca-falla · un-gate-cuyo-corpus-vive-fuera-del-repo-mide-al-equipo-no-al-commit

Y ampliar el corpus de aquel script NO era el arreglo: los dos padrones tienen los MISMOS 54 ids y
preguntan cosas distintas —«¿la pantalla existe y coincide?» vs «¿las divergencias listadas de esta
fila estan resueltas o enmendadas?»—. Inyectar estos docs alla habria producido la mentira inversa,
que es el riesgo que su propio docstring ya documenta para el documento normativo.
  -> memoria: un-nombre-con-dos-referentes-prueba-A-y-concluye-B

EL DoD MANDA, Y ADMITE DOS CAMINOS. Literal del contrato, identico en los tres bloques:
«cada divergencia listada en la fila queda resuelta en el codigo, O declarada enmienda fundada con
su motivo escrito. Ninguna queda sin veredicto.» Por eso una ENMIENDA fundada **cumple** el DoD, y
por eso este script imprime SIEMPRE tres cifras con su unidad, no una:
   · cumple-DoD        (resuelta en codigo + enmienda fundada)
   · cerrada-en-codigo (solo lo que se escribio y mergeo)
   · con-veredicto     (medida por su dueno, sea cual sea el resultado)
Una sola de las tres se deja citar para cualquier pregunta; las tres juntas, no.
  -> memoria: una-cifra-sin-unidad-se-deja-citar-para-cualquier-pregunta

CONTROLES HORNEADOS
  1. UNIVERSO EXTERNO: los ids salen del doc de contratos, y el parser se valida contra las
     cantidades que **ese doc declara en sus propios encabezados** (7/15/32). Si no cuadra -> exit 2.
     Un universo derivado de los docs medidos esconderia cada fila que nadie midio.
  2. COBERTURA: un id sin veredicto sale como HUECO CON NOMBRE, no como un total que no se movio.
  3. POSITIVO por BRAZO, sin umbral: un brazo cuyo doc EXISTE y aporta 0 ids cambio de formato ->
     exit 2. Sin umbral a proposito: el primero que tuvo esta funcion era absoluto (>=20 / >=10),
     calibrado al corpus del dia, y ningun fixture chico podia pasarlo — o sea que el control
     quedaba sin test. La señal «doc presente, cero ids» no envejece y es ejercitable.
  4. CANARIO (`--canario`): rompe cada brazo de parseo de a uno y exige que la cobertura BAJE. Un
     brazo cuya rotura no mueve nada es un brazo que nadie controla.
  5. CORPUS POR GLOB, no a mano: `docs/copiloto-emprendedor/*veredicto*.md`. Un doc nuevo que el
     parser no sepa leer se reporta como NO PARSEADO (exit 2); no se ignora en silencio.

Read-only. Uso: python medir-mapeo-implementacion.py [--json] [--canario]
Costura de test: MAPEO_RAIZ=<dir> apunta la raiz (para fixtures offline y deterministas).

CODIGOS DE SALIDA
   0  medido y todos los controles pasaron.
   2  NO PUEDO MEDIR (falta un doc, el universo no cuadra, un doc del glob sin parser, bloque en 0).
      Nunca es un hallazgo sobre el dato: es ceguera del instrumento.
   3  hay HUECOS: ids del padron sin ningun veredicto. Es un hallazgo, con nombre y dueno.
"""
import json
import os
import re
import subprocess
import sys
from collections import Counter
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")  # Windows: cp1252 no puede con los simbolos de veredicto

def _raiz():
    """La raiz sale del CWD, NO del archivo — y esa diferencia es la que habilita este script a
    pasar por `scripts/vigia.sh`.

    El lanzador hace `exec bash "$PIN/scripts/vigia.sh"` SIN `cd`: el ARCHIVO del instrumento sale
    del pin (al dia) y el CWD se hereda del llamador. Derivar la raiz de `__file__` seria entonces
    el error que `vigia.sh:177-184` documenta para `gate.sh`: medir el arbol del PIN (o sea `main`)
    mientras el operador cree estar midiendo la rama en la que esta parado. Un instrumento que mide
    el arbol equivocado y sale verde no se nota nunca.

    Por eso la salida IMPRIME la raiz medida: la cifra sin el arbol al que pertenece se deja citar
    para cualquier pregunta.
    """
    if "MAPEO_RAIZ" in os.environ:          # costura de test: fixtures offline y deterministas
        return Path(os.environ["MAPEO_RAIZ"])
    r = subprocess.run(["git", "rev-parse", "--show-toplevel"],
                       capture_output=True, text=True)
    if r.returncode == 0 and r.stdout.strip():
        return Path(r.stdout.strip())
    return Path(__file__).resolve().parents[2]   # fuera de un repo: el arbol propio del archivo


RAIZ = _raiz()
DOCS = RAIZ / "docs" / "copiloto-emprendedor"
CONTRATOS = DOCS / "2026-10-12-contratos-del-mapeo.md"

SIN_MEDIR = ("SIN VEREDICTO", "FUERA-DE-ESTE-CORPUS")
CUMPLE_DOD = {"CERRADA-EN-CODIGO", "ENMIENDA-FUNDADA", "COHERENTE"}
BRAZOS = ("chat", "cascara", "device")   # el canario rompe estos de a uno

MARCA_R = "**R**"


def morir(msg, code=2):
    print("NO PUDE MEDIR: " + msg, file=sys.stderr)
    print("   (y eso NO es 0% ni 100%: es ceguera del instrumento)", file=sys.stderr)
    sys.exit(code)


def universo():
    """Los 54, desde el doc de contratos, validados contra lo que el doc declara de si mismo."""
    if not CONTRATOS.exists():
        morir("no existe " + str(CONTRATOS))
    txt = CONTRATOS.read_text(encoding="utf-8")
    grupo, ids, declarado = None, {}, {}
    for ln in txt.splitlines():
        m = re.match(r"^## (backend \+ nativa|nativa-con-device|nativa-sin-device) . (\d+) renglones", ln)
        if m:
            grupo = m.group(1)
            declarado[grupo] = int(m.group(2))
            continue
        if ln.startswith("## "):
            grupo = None
            continue
        if grupo and ln.startswith("|") and not re.match(r"^\|[-: |]*\|$", ln):
            celda = ln.lstrip("|").split("|")[0].strip().strip("`").strip()
            if celda and celda != "id":
                ids[celda] = grupo
    if not declarado:
        morir("el doc de contratos no declara cantidades por bloque (cambio de formato)")
    if len(ids) != sum(declarado.values()):
        morir("el parser extrajo %d ids y el doc declara %d %s - no mido con un universo que no cuadra"
              % (len(ids), sum(declarado.values()), declarado))
    return ids, declarado


def corpus(roto=None):
    """Descubre los docs de veredictos por glob y los asigna a un brazo. Sin lista a mano."""
    hallados = sorted(DOCS.glob("*veredicto*.md"))
    if not hallados:
        morir("el glob '*veredicto*.md' no encontro ningun doc en " + str(DOCS))
    asignados, sin_parser = {}, []
    for p in hallados:
        n = p.name
        brazo = "chat" if "chat" in n else ("cascara" if "cascara" in n else
                                            ("device" if "device" in n else None))
        if brazo is None:
            sin_parser.append(n)
            continue
        if brazo != roto:
            asignados.setdefault(brazo, []).append(p)
    if sin_parser:
        morir("docs de veredictos que este parser NO sabe leer (no los ignoro en silencio): "
              + ", ".join(sin_parser))
    return asignados


def leer_veredictos(asignados):
    """-> ({id: {'simbolos': set, 'device': (v1, v2), 'origen': str}}, {brazo: ids_aportados})

    Devuelve tambien el APORTE de cada brazo porque ahi vive el control positivo. El umbral
    absoluto que tuvo esta funcion primero («sin-device >= 20, con-device >= 10») estaba calibrado
    al corpus del dia: envejece con el, y ningun fixture chico podia pasarlo, asi que el test no
    habria podido ejercitar el control que supuestamente lo protege. La señal precisa no necesita
    umbral: un brazo cuyo DOC EXISTE y aporta CERO ids cambio de formato.
      -> memoria: un-umbral-calibrado-al-corpus-del-dia-envejece-con-el
    """
    est = {}
    antes = {}

    # brazo CHAT (frontend1): headings "### N - `id` - <simbolos>"
    antes["chat"] = len(est)
    for p in asignados.get("chat", []):
        txt = p.read_text(encoding="utf-8")
        for m in re.finditer(r"^### \d+ . `([^`]+)` . (.+)$", txt, re.M):
            e = est.setdefault(m.group(1), {"simbolos": set(), "origen": p.name + " (sin device)"})
            e["simbolos"].update(re.findall(r"[✅\U0001F4DD⛓⚠]", m.group(2)))

    aporte = {"chat": len(est) - antes["chat"]}

    # brazo CASCARA (frontend2): "| `id` | divergencia | **R** ... |"; celda vacia = sigue la fila
    antes["cascara"] = len(est)
    for p in asignados.get("cascara", []):
        ult = None
        for ln in p.read_text(encoding="utf-8").splitlines():
            if not ln.startswith("|") or re.match(r"^\|[-: |]*\|$", ln):
                continue
            cols = [c.strip() for c in ln.strip("|").split("|")]
            if len(cols) < 3:
                continue
            ident = cols[0].strip("`").strip()
            if ident in ("fila", "id"):
                continue
            if ident:
                ult = ident
            if not ult:
                continue
            e = est.setdefault(ult, {"simbolos": set(), "origen": p.name + " (sin device)"})
            mapa = {"R": "✅", "E": "\U0001F4DD", "D": "⛓", "P": "⚠"}
            e["simbolos"].update(mapa[x] for x in re.findall(r"\*\*([REDP])\*\*", cols[2]))

    aporte["cascara"] = len(est) - antes["cascara"]

    # brazo DEVICE (frontend2, en el telefono): "| N | `id` | v1 | v2 | nota |"
    con_device = 0
    for p in asignados.get("device", []):
        txt = p.read_text(encoding="utf-8")
        for m in re.finditer(r"^\| *\d+ *\| *`([^`]+)` *\| *([^|]+?) *\| *([^|]+?) *\|", txt, re.M):
            e = est.setdefault(m.group(1), {"simbolos": set(),
                                            "origen": p.name + " (MEDIDO EN DEVICE)"})
            e["device"] = (m.group(2).strip("` *"), m.group(3).strip("` *"))
            con_device += 1
    aporte["device"] = con_device
    return est, aporte


def clasificar(ids, est):
    filas, huecos = {}, []
    for i, g in ids.items():
        e = est.get(i)
        if g == "backend + nativa" and not (e and e["simbolos"]):
            # Su evidencia son los cierres del buzon (no versionado), no estos docs. Este script no
            # inventa un veredicto que no puede leer: lo declara fuera de SU corpus, con nombre.
            #
            # Pero FUERA no es una propiedad del GRUPO: es la consecuencia de que no haya evidencia
            # versionada que leer. Si alguien versiona el veredicto de una de estas 7 filas, ENTRA y
            # se mide como cualquier otra. Hasta el 2026-10-13 el `continue` estaba ANTES de mirar
            # `e`, asi que el grupo quedaba fuera con doc o sin doc — y entonces el DoD que le baje
            # a frontend1 («el medidor mueve `onb-cumplida` a medida») era INEJECUTABLE con
            # cualquier documento: un criterio de cierre que depende de algo fuera de alcance no se
            # cumple nunca. Lo midio ella contra `db318772`, con su doc presente y parseado, y el
            # instrumento igual la dejaba afuera. Codificar la deuda `EVIDENCIABUZON` como regla
            # permanente del padron habria vuelto incerrables esas 7 filas para siempre.
            filas[i] = (g, "FUERA-DE-ESTE-CORPUS", None)
            continue
        falta = (not e
                 or (g == "nativa-con-device" and "device" not in e)
                 # `backend + nativa` se evalua con la misma regla que `nativa-sin-device` (simbolos).
                 # Nombrarlo acá, en vez de confiar en el guard de arriba, es lo que evita que un doc
                 # sin simbolos caiga al `else` y salga ENMIENDA-FUNDADA por AUSENCIA de evidencia.
                 or (g in ("nativa-sin-device", "backend + nativa") and not e["simbolos"]))
        if falta:
            huecos.append((g, i))
            filas[i] = (g, "SIN VEREDICTO", None)
            continue
        if g == "nativa-con-device":
            v = " ".join(e["device"]).upper()
            clase = "DESVIO" if "DESV" in v else ("COHERENTE" if "COHERENTE" in v else "NO-MEDIBLE")
        else:
            s = e["simbolos"]
            clase = "CERRADA-EN-CODIGO" if "✅" in s else "ENMIENDA-FUNDADA"
        filas[i] = (g, clase, e.get("origen"))
    return filas, huecos


def medir(roto=None):
    ids, declarado = universo()
    asignados = corpus(roto)
    est, aporte = leer_veredictos(asignados)
    # CONTROL POSITIVO: un brazo cuyo doc EXISTE y aporta 0 ids cambio de formato. `roto` es el
    # unico brazo exento, porque el canario lo apaga a proposito para medir que la metrica baje.
    for brazo in BRAZOS:
        if brazo != roto and asignados.get(brazo) and aporte.get(brazo, 0) == 0:
            morir("el brazo '%s' tiene su doc presente (%s) y no extrajo NINGUN id: "
                  "cambio el formato de ese doc" % (brazo, asignados[brazo][0].name))
    filas, huecos = clasificar(ids, est)
    por_bloque = {g: Counter() for g in set(ids.values())}
    for _i, (g, clase, _o) in filas.items():
        por_bloque[g][clase] += 1
    return ids, declarado, filas, huecos, por_bloque


def cubiertas(filas):
    return sum(1 for _i, (_g, c, _o) in filas.items() if c not in SIN_MEDIR)


def canario():
    base = cubiertas(medir()[2])
    print("CANARIO - cobertura con los %d brazos: %d filas con veredicto" % (len(BRAZOS), base))
    malos = []
    for b in BRAZOS:
        try:
            n = cubiertas(medir(b)[2])
        except SystemExit:
            n = -1
        ok = n < base
        print("   brazo '%s' roto -> %d filas  %s" % (b, n, "BAJA (controlado)" if ok else "NO SE MOVIO"))
        if not ok:
            malos.append(b)
    if malos:
        print("brazos SIN control: %s - su rotura no mueve la metrica" % ", ".join(malos),
              file=sys.stderr)
        sys.exit(2)
    print("OK: los %d brazos estan controlados" % len(BRAZOS))


def main():
    if "--canario" in sys.argv:
        canario()
        return

    ids, declarado, filas, huecos, por_bloque = medir()   # el control positivo vive adentro
    n = len(ids)
    cumple = sum(1 for _i, (_g, c, _o) in filas.items() if c in CUMPLE_DOD)
    codigo = sum(1 for _i, (_g, c, _o) in filas.items() if c == "CERRADA-EN-CODIGO")
    medidas = cubiertas(filas)
    fuera = sum(1 for _i, (_g, c, _o) in filas.items() if c == "FUERA-DE-ESTE-CORPUS")

    if "--json" in sys.argv:
        print(json.dumps({"arbol": str(RAIZ),
                          "unidad": "filas de contrato del mapeo prototipo->nativo",
                          "padron": n, "declarado_por_el_doc": declarado,
                          "cumple_dod": cumple, "cerrada_en_codigo": codigo,
                          "con_veredicto": medidas, "fuera_de_este_corpus": fuera,
                          "huecos": ["%s/%s" % (g, i) for g, i in huecos],
                          "por_bloque": {g: dict(c) for g, c in por_bloque.items()}},
                         ensure_ascii=False, indent=2))
    else:
        print("ARBOL MEDIDO: %s" % RAIZ)   # sin esto la cifra no dice de que rama es
        print("PADRON: %d filas de contrato - declarado por el doc: %s" % (n, declarado))
        print("UNIDAD: filas de contrato del mapeo prototipo->nativo (NO ids del criterio 3)\n")
        for i, (g, clase, origen) in sorted(filas.items(), key=lambda kv: (kv[1][0], kv[0])):
            print("  %-18s %-16s %-20s %s" % (g, i, clase, origen or ""))
        print("\n" + "-" * 96)
        for g in sorted(por_bloque):
            print("%s (n=%d)" % (g, sum(por_bloque[g].values())))
            for k, v in por_bloque[g].most_common():
                print("    %3d  %s" % (v, k))
        print("-" * 96)
        print("CUMPLE EL DoD        : %d/%d filas (%d%%)  [codigo + enmienda fundada]"
              % (cumple, n, cumple * 100 // n))
        print("CERRADA EN CODIGO    : %d/%d filas (%d%%)  [solo lo escrito y mergeado]"
              % (codigo, n, codigo * 100 // n))
        print("CON VEREDICTO MEDIDO : %d/%d filas (%d%%)" % (medidas, n, medidas * 100 // n))
        print("FUERA DE ESTE CORPUS : %d/%d filas  [backend+nativa: su evidencia son los cierres del buzon]"
              % (fuera, n))
        if huecos:
            print("\nHUECOS (%d) - ids del padron sin veredicto, con nombre:" % len(huecos))
            for g, i in huecos:
                print("    %s / %s" % (g, i))
    if huecos:
        sys.exit(3)


if __name__ == "__main__":
    main()
