# -*- coding: utf-8 -*-
"""SM-L4 — cuenta las 51 entradas del mapa por veredicto y dice QUIEN cubre cada divergencia.

Por que existe: el DoD de `SM-L4` exige las 51 entradas en CONFORME o DIFERENTE·B
«contadas con `collections.Counter` por un script, no a mano». Contar a mano un
corpus de 51 filas es como se produjeron las tres cifras incompatibles que este
sprint ya pago ([[una-cifra-sin-unidad-se-deja-citar-para-cualquier-pregunta]]).

Que mide, y son DOS preguntas distintas que no se citan una por la otra:

  (A) VEREDICTOS — cuantas entradas hay en cada estado, sobre el corpus
      `docs/.../2026-10-16-relevamiento-mapa-de-pantallas-vs-app.md`. Ese doc es la
      foto del 2026-10-16; no se actualiza solo cuando una ficha cierra.

  (B) COBERTURA — para cada entrada que NO esta conforme, que ficha del backlog la
      cubre y en que estado esta. El hallazgo util no es el porcentaje: es la
      entrada DIVERGENTE que NINGUNA ficha cita, porque esa no la va a arreglar
      nadie y no da sintoma — se lee como «pendiente», que es un estado normal
      ([[el-registro-no-se-marcaba-porque-su-id-no-circulaba]]).

Lo que NO hace, a proposito: no re-veredicta nada. Un veredicto se cambia midiendo
la app y editando el corpus con su cita, no por el estado de una ficha — si el
script dedujera «la ficha cerro ⇒ la entrada esta CONFORME» estaria afirmando algo
que no midio, que es exactamente el defecto de clase de este sprint
([[el-instrumento-tambien-CONDENA-no-solo-absuelve]]).

Controles propios (fallan RUIDOSO, nunca al caso benigno):
  * el corpus tiene que dar EXACTAMENTE 51 filas; cualquier otro numero sale por
    stderr y exit 2 — un corpus que cambio de forma mide otra cosa y el Counter no
    se da cuenta ([[instrumento-que-no-mira-nunca-falla]]).
  * cada veredicto tiene que ser uno de los cuatro conocidos; uno nuevo es exit 2,
    no una categoria silenciosa.
  * si 0 entradas quedan sin cubrir, lo dice con el total revisado, no con un «OK»
    pelado: vacio es pregunta ([[el-canario-el-control-positivo-de-lo-que-falla-callado]]).

Uso:
    python -I -X utf8 scripts/mapa-51-estado.py [--json]
Exit 0 = toda divergencia tiene ficha · 1 = hay divergencias sin dueño · 2 = el
corpus no tiene la forma esperada (no se publica ninguna cifra en ese caso).
"""
from __future__ import annotations

import collections
import io
import json
import os
import re
import sys

CORPUS = "docs/copiloto-emprendedor/2026-10-16-relevamiento-mapa-de-pantallas-vs-app.md"
BACKLOG = "docs/copiloto-emprendedor/2026-11-02-BACKLOG-sprint-correcciones-mapa.md"
ESPERADAS = 51
VEREDICTOS = ("CONFORME", "DIFERENTE · A", "DIFERENTE · B", "NO-VERIFICABLE")
CONFORMES = ("CONFORME", "DIFERENTE · B")  # el DoD acepta las dos como cierre

FILA = re.compile(
    r"^\*\*(?P<n>\d+) · `(?P<id>[^`]+)` — (?P<nombre>.+?)\*\* — \*\*(?P<ver>[^*]+)\*\*"
    r"(?: · (?P<fuente>.+?))?\s*$")


def leer(path):
    return io.open(path, "rb").read().decode("utf-8").replace("\r\n", "\n")


def entradas():
    t = leer(CORPUS)
    out = []
    for linea in t.split("\n"):
        m = FILA.match(linea)
        if not m:
            continue
        ver = re.sub(r"\s+", " ", m.group("ver")).strip()
        if ver not in VEREDICTOS:
            print("ERROR: veredicto desconocido %r en la entrada %s (%s). Un veredicto "
                  "nuevo no se cuenta en silencio." % (ver, m.group("n"), m.group("id")),
                  file=sys.stderr)
            sys.exit(2)
        out.append({"n": m.group("n"), "id": m.group("id"),
                    "nombre": m.group("nombre").strip(), "veredicto": ver,
                    "fuente": (m.group("fuente") or "").strip(),
                    "vinculo": []})
    # El corpus declara la ficha dueña en su propio campo `*Vínculo:*` (44 de 51
    # filas lo tienen). La primera version de este script buscaba el dueño SOLO en
    # el backlog y reporto 4 entradas «sin ficha» que lo tenian escrito dos lineas
    # mas abajo: el dato existia y el instrumento no lo miraba
    # ([[instrumento-que-no-mira-nunca-falla]]). El vinculo es declarativo, no
    # medido, asi que se reporta como tal.
    bloques = re.split(r"\n(?=\*\*\d+ · `)", t)
    por_id = {e["id"]: e for e in out}
    for b in bloques:
        mi = re.match(r"\*\*\d+ · `([^`]+)`", b)
        if not mi or mi.group(1) not in por_id:
            continue
        mv = re.search(r"^\*Vínculo:\* *(.+)$", b, re.M)
        if mv:
            por_id[mi.group(1)]["vinculo"] = re.findall(r"\b([A-Z]\d+)\b", mv.group(1))
    if len(out) != ESPERADAS:
        print("ERROR: el corpus dio %d filas y se esperaban %d. El corpus cambio de "
              "forma: no publico ninguna cifra sobre el." % (len(out), ESPERADAS),
              file=sys.stderr)
        sys.exit(2)
    return out


def fichas():
    """{SM-XX: (estado, cuerpo)} del backlog versionado."""
    t = leer(BACKLOG)
    out = {}
    for bloque in re.split(r"\n### ", t):
        m = re.match(r"(SM-[A-Z]\d+)\b", bloque)
        if not m:
            continue
        est = re.search(r"^- \*\*Estado:\*\* *(\S+)", bloque, re.M)
        out[m.group(1)] = (est.group(1) if est else "(sin Estado)", bloque)
    return out


def cubren(entrada_id, fich):
    """Fichas cuyo cuerpo cita el id de la entrada entre backticks."""
    pat = re.compile(r"`%s`" % re.escape(entrada_id))
    return sorted(fid for fid, (_, cuerpo) in fich.items() if pat.search(cuerpo))


def cubren_por_nombre(nombre, fich):
    """Fichas cuyo cuerpo cita el NOMBRE de la pantalla.

    Existe porque buscar SOLO el id entre backticks tiene un falso negativo
    enorme: una ficha puede estar sobre «Mi día» sin escribir nunca `base`. Medir
    por una sola forma del nombre es el defecto que este sprint ya pago dos veces
    en un dia — un barrido conto 6 fichas de tenencia buscando «canonica» cuando
    el doc escribe «canonico» ([[no-era-que-no-cazaba-el-patron-era-que-no-lo-cazaba-en-su-forma-real]]).

    Esta pasada NO acredita cobertura: un nombre comun («Chat», «Agenda») aparece
    en prosa sin ser el sujeto de la ficha. Por eso su salida es una TERCERA
    categoria, «a revisar a mano», y no se suma a las cubiertas: un control que
    ante la duda cae al caso benigno envenena la medicion
    ([[un-degradado-prudente-hacia-el-caso-benigno-envenena-la-medicion]]).
    """
    if len(nombre) < 4:  # un nombre muy corto matchea cualquier prosa
        return []
    pat = re.compile(r"\b%s\b" % re.escape(nombre), re.I)
    return sorted(fid for fid, (_, cuerpo) in fich.items() if pat.search(cuerpo))


def main(argv):
    for p in (CORPUS, BACKLOG):
        if not os.path.exists(p):
            print("ERROR: no existe %s" % p, file=sys.stderr)
            sys.exit(2)

    ent = entradas()
    fich = fichas()
    cuenta = collections.Counter(e["veredicto"] for e in ent)

    divergentes = [e for e in ent if e["veredicto"] not in CONFORMES]
    sin_dueno = []
    cubiertas = []
    por_nombre = []
    for e in divergentes:
        fs = cubren(e["id"], fich)
        # el vinculo declarado en el corpus cuenta como dueno: lo escribio quien midio
        for v in e["vinculo"]:
            fid = "SM-%s" % v
            if fid in fich and fid not in fs:
                fs.append(fid)
        if fs:
            cubiertas.append((e, [(f, fich[f][0]) for f in sorted(fs)]))
            continue
        # segunda pasada: el nombre, que NO acredita — sólo marca a revisar
        fn = cubren_por_nombre(e["nombre"], fich)
        if fn:
            por_nombre.append((e, [(f, fich[f][0]) for f in fn]))
        else:
            sin_dueno.append(e)

    if "--json" in argv:
        print(json.dumps({
            "corpus": CORPUS, "total": len(ent), "veredictos": dict(cuenta),
            "sin_dueno": [e["id"] for e in sin_dueno],
            "cubiertas": {e["id"]: dict(fs) for e, fs in cubiertas},
            "solo_por_nombre": {e["id"]: dict(fs) for e, fs in por_nombre},
        }, ensure_ascii=False, indent=2))
    else:
        print("=== (A) VEREDICTOS sobre %d entradas — corpus %s ===" % (len(ent), CORPUS))
        for v in VEREDICTOS:
            marca = "  (cierra el DoD)" if v in CONFORMES else ""
            print("  %-16s %2d%s" % (v, cuenta[v], marca))
        listo = sum(cuenta[v] for v in CONFORMES)
        print("  %-16s %2d de %d" % ("→ en condicion", listo, len(ent)))
        print("\n  Esta cifra responde «¿que decia el corpus la ultima vez que se MIDIO la\n"
              "  app?». NO dice si una ficha cerro: eso es la seccion (B). Citar una por\n"
              "  la otra es el error mas repetido del sprint.")

        print("\n=== (B) COBERTURA de las %d entradas no-conformes ===" % len(divergentes))
        for e, fs in cubiertas:
            print("  %s · %-22s %-14s -> %s" % (
                e["n"], e["id"], e["veredicto"],
                ", ".join("%s(%s)" % (f, st) for f, st in fs)))

        print("\n--- cubiertas SOLO por el NOMBRE, no por el id: %d (a revisar a mano) ---"
              % len(por_nombre))
        if por_nombre:
            for e, fs in por_nombre:
                print("  %s · %-22s %-14s ~ %s" % (
                    e["n"], e["id"], e["veredicto"],
                    ", ".join("%s(%s)" % (f, st) for f, st in fs)))
            print("\n  El nombre en la prosa de una ficha NO acredita que la ficha sea sobre\n"
                  "  esa entrada. Confirmar una por una y, si corresponde, hacer que la ficha\n"
                  "  cite el id — para que el proximo barrido la vea sin ambiguedad.")

        print("\n--- entradas DIVERGENTES que NINGUNA ficha cita: %d ---" % len(sin_dueno))
        if not sin_dueno:
            print("  Ninguna, sobre %d divergentes revisadas. El control miro todas,\n"
                  "  no se callo por vacio." % len(divergentes))
        else:
            for e in sin_dueno:
                print("  %s · %-22s %-14s  %s" % (e["n"], e["id"], e["veredicto"],
                                                  e["nombre"]))
            print("\n  Cada una necesita ficha o una razon escrita. Una divergencia sin\n"
                  "  ficha no da sintoma: se lee como pendiente, que es un estado normal.")

    return 1 if sin_dueno else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
