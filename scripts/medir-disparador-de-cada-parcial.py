#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Clasifica cada ficha DOD-PARCIAL por el DISPARADOR que le falta, no por su avance.

QUE PREGUNTA CONTESTA -- Y CUAL NO
----------------------------------
Contesta UNA: *de lo que falta en esta ficha, hace falta el telefono?* Sirve para decidir
que se puede ejecutar mientras el device no esta disponible y para cuantificar el costo de
que no lo este.

**NO es una cifra de avance del sprint.** El avance se mide con el registro unico
(`scripts/sprint-estado.py --pct`), que declara sujeto y fecha. Citar el numero de este
script como progreso es el error que el repo ya pago tres veces: una cifra sin su pregunta
se deja citar para cualquier otra (memoria
`una-cifra-sin-unidad-se-deja-citar-para-cualquier-pregunta`). Por eso la salida imprime la
pregunta arriba y nunca un porcentaje.

COMO CLASIFICA, Y DONDE ES FALIBLE
----------------------------------
Lee el campo `Falta:` de cada DOD-PARCIAL de los registros de `sprint-estado.py` y busca
palabras. Es una heuristica LEXICA sobre prosa escrita a mano, no un analisis del DoD:

  SOLO-DEVICE   el `Falta:` menciona captura/device/filmacion y NADA que suene a codigo.
  DEVICE+ALGO   menciona las dos cosas: hay trabajo adelantable ANTES del telefono.
  SIN-DEVICE    no menciona device: es ejecutable ya.

Un `Falta:` mal redactado cae en la casilla equivocada, y un `Falta:` VENCIDO clasifica por
lo que dice y no por lo que falta de verdad -- paso con SM-H5, cuyo `Falta:` pedia dos veces
trabajo ya hecho. Por eso la salida lista los ids: el control es leerlos, no creerle al conteo.
"""
import os
import re
import subprocess
import sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REGISTROS = (
    "docs/copiloto-emprendedor/2026-10-11-BACKLOG-sprint-mobile-beta.md",
    "docs/copiloto-emprendedor/2026-11-02-BACKLOG-sprint-correcciones-mapa.md",
)
RE_FICHA = re.compile(r"^### (?P<id>SM-[A-Z]\d+) · ")

DEVICE = ("captura", "capturar", "device", "filmad", "filmar", "release", "apk", "tenant vac")
CODIGO = ("codigo", "código", "test", "implement", "decidir", "decision", "decisión",
          "payload", "revertir", "escala", "adversarial", "build de release")


def texto_de(ref, path):
    if ref:
        r = subprocess.run(["git", "show", "%s:%s" % (ref, path)],
                           capture_output=True, text=True, encoding="utf-8", cwd=RAIZ)
        if r.returncode != 0:
            raise SystemExit("no se pudo leer %s:%s -- %s" % (ref, path, r.stderr.strip()))
        return r.stdout
    with open(os.path.join(RAIZ, path), encoding="utf-8") as fh:
        return fh.read()


def clasificar(ref):
    cubos = {"SOLO-DEVICE": [], "DEVICE+ALGO": [], "SIN-DEVICE": []}
    sin_falta = []
    for path in REGISTROS:
        for bloque in re.split(r"\n(?=### SM-)", texto_de(ref, path)):
            m = RE_FICHA.match(bloque)
            if not m:
                continue
            est = re.search(r"\*\*Estado:\*\* (\S+)", bloque)
            if not est or est.group(1) != "DOD-PARCIAL":
                continue
            fid = m.group("id")
            fa = re.search(r"\*\*Falta:\*\*\s*(.+)", bloque)
            if not fa:
                sin_falta.append(fid)
                continue
            s = fa.group(1).lower()
            tiene_dev = any(k in s for k in DEVICE)
            tiene_cod = any(k in s for k in CODIGO)
            if tiene_dev and not tiene_cod:
                cubos["SOLO-DEVICE"].append(fid)
            elif tiene_dev:
                cubos["DEVICE+ALGO"].append(fid)
            else:
                cubos["SIN-DEVICE"].append(fid)
    return cubos, sin_falta


def main():
    ref = "origin/main"
    if "--working-tree" in sys.argv:
        ref = None
    cubos, sin_falta = clasificar(ref)
    total = sum(len(v) for v in cubos.values()) + len(sin_falta)
    print("PREGUNTA: de lo que falta en cada ficha DOD-PARCIAL, hace falta el telefono?")
    print("SUJETO: %d fichas DOD-PARCIAL de los 2 registros, leidas en %s"
          % (total, ref or "el working tree"))
    print("NO es avance del sprint -- eso lo mide sprint-estado.py --pct.\n")
    for k in ("SOLO-DEVICE", "DEVICE+ALGO", "SIN-DEVICE"):
        print("%-12s %2d  %s" % (k, len(cubos[k]), " ".join(cubos[k])))
    if sin_falta:
        print("\n[X] %d DOD-PARCIAL SIN campo Falta: %s" % (len(sin_falta), " ".join(sin_falta)))
        print("    Un DOD-PARCIAL sin Falta es un TERMINADO disfrazado; sprint-estado.py --check lo rechaza.")
        return 1
    if total == 0:
        print("\n[X] 0 fichas DOD-PARCIAL: vacio es PREGUNTA, no luz verde -- cambio el formato?")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
