# -*- coding: utf-8 -*-
"""Caza la ficha que DECLARA PENDIENTE mientras su codigo YA esta en `main`.

Por que existe (2026-11-02): planificacion reporto al operador «6 fichas dentro
del sprint sin una sola linea de codigo». Era falso para 2 de 6 — `SM-N24`
(`32a0d66e`, #1430) y `SM-N28` (`4376027d`, #1435) tenian el fix mergeado y el
campo `Estado:` seguia en PENDIENTE. Lo refuto frontend2, no el gate.

El gate existente (`sprint-estado.py --check`) verifica lo contrario: que un
TERMINADO tenga sha ancestro de `origin/main`. O sea cubre el estado que afirma
DE MAS y deja mudo el que afirma DE MENOS — y el que afirma de menos no da
sintoma: se lee como trabajo pendiente, se despacha de nuevo, y alguien
reimplementa lo que ya existe. Es la mitad que el control positivo no miraba
([[el-control-positivo-cubre-la-mitad-que-sospechas-y-la-otra-queda-muda]]).

Que mide: para cada ficha en PENDIENTE, busca en `origin/main` commits cuyo
ASUNTO cite su id. Si hay alguno, la reporta. No es prueba de que el DoD este
hecho — es prueba de que «sin una sola linea» es falso, que es justo la frase
que se dijo mal.

Falsos positivos esperables y por que se aceptan: un commit de `docs(sprint)`
que cita varios ids al bajar fichas nuevas matchea sin ser codigo. Por eso el
script EXCLUYE los asuntos que empiezan con `docs(sprint)`/`docs(memoria)` y
igual imprime el asunto completo: el humano decide en un vistazo. Un control
que se calla ante la duda envenena la medicion
([[un-degradado-prudente-hacia-el-caso-benigno-envenena-la-medicion]]).

NO esta cableado a ningun gate todavia, a proposito: primero se mide si dispara
y con que ruido ([[medir-si-un-gate-dispara-antes-de-embarcarlo]]). Un guard que
grita en el caso normal se desarma solo.

Uso:
    python -I -X utf8 scripts/fichas-desincronizadas.py [<doc.md> ...]
Sin argumentos toma los backlogs de sprint conocidos.
Exit 0 = nada desincronizado · 1 = hay fichas a revisar · 2 = error de uso.
"""
import io
import os
import re
import subprocess
import sys

DEFECTO = [
    "docs/copiloto-emprendedor/2026-11-02-BACKLOG-sprint-correcciones-mapa.md",
    "docs/copiloto-emprendedor/2026-10-11-BACKLOG-sprint-mobile-beta.md",
]

# asuntos que citan ids sin ser el codigo de la ficha
RUIDO = re.compile(r"^(docs\(sprint\)|docs\(memoria\)|docs\(backlog\)|chore\(sprint\))", re.I)


def commits_que_citan(ficha_id):
    """Commits de origin/main cuyo ASUNTO cita el id, sin los docs de backlog."""
    try:
        salida = subprocess.run(
            ["git", "log", "origin/main", "--format=%h\t%s",
             "--grep=%s\\b" % re.escape(ficha_id), "-i", "-20"],
            capture_output=True, text=True, encoding="utf-8", errors="replace",
        )
    except OSError as e:
        print("ERROR: no pude correr git (%s)" % e, file=sys.stderr)
        sys.exit(2)
    if salida.returncode != 0:
        # un ref inexistente da vacio, y vacio se parsearia como «nada que ver»
        print("ERROR: git log fallo (rc=%d) — ¿existe origin/main?" % salida.returncode,
              file=sys.stderr)
        sys.exit(2)
    # `git log --grep` busca en el mensaje COMPLETO, no en el asunto: un commit
    # cuyo cuerpo menciona la ficha de pasada entraba igual. Medido el
    # 2026-11-02: `SM-L4` salio reportada por un commit cuyo asunto habla de
    # `SM-J3`. El filtro del asunto se hace aca, no se delega en git.
    patron_id = re.compile(r"\b%s\b" % re.escape(ficha_id), re.I)
    out = []
    for linea in salida.stdout.splitlines():
        if "\t" not in linea:
            continue
        sha, asunto = linea.split("\t", 1)
        if RUIDO.match(asunto) or not patron_id.search(asunto):
            continue
        out.append((sha, asunto))
    return out


def fichas_pendientes(path):
    crudo = io.open(path, "rb").read().decode("utf-8")
    t = crudo.replace("\r\n", "\n")
    for bloque in re.split(r"\n### ", t):
        m = re.match(r"(SM-[A-Z]\d+)\b", bloque)
        if not m:
            continue
        if re.search(r"^- \*\*Estado:\*\* *PENDIENTE *$", bloque, re.M):
            yield m.group(1)


def main(argv):
    docs = argv[1:] or DEFECTO
    hallazgos = []
    revisadas = 0
    for doc in docs:
        if not os.path.exists(doc):
            print("ERROR: no existe %s" % doc, file=sys.stderr)
            sys.exit(2)
        for ficha in fichas_pendientes(doc):
            revisadas += 1
            commits = commits_que_citan(ficha)
            if commits:
                hallazgos.append((doc, ficha, commits))

    if revisadas == 0:
        # vacio = pregunta, no luz verde: sin PENDIENTES no hay nada que medir
        print("AVISO: 0 fichas en PENDIENTE — el control no midio nada. "
              "¿El doc es el correcto y el campo se llama 'Estado:'?")
        return 1

    if not hallazgos:
        print("OK: %d fichas en PENDIENTE y ninguna tiene commits de codigo en "
              "origin/main que la citen." % revisadas)
        return 0

    print("DESINCRONIZADAS: %d de %d fichas en PENDIENTE tienen codigo en origin/main.\n"
          % (len(hallazgos), revisadas))
    for doc, ficha, commits in hallazgos:
        print("  %s  (%s)" % (ficha, os.path.basename(doc)))
        for sha, asunto in commits:
            print("      %s  %s" % (sha, asunto[:100]))
        print()
    print("Revisar una por una: un commit que la cita NO prueba que el DoD este "
          "hecho, pero sI refuta «no tiene una sola linea». Si corresponde, marcar\n"
          "con sprint-estado.py --marcar <id> --estado DOD-PARCIAL.")
    return 1


if __name__ == "__main__":
    sys.exit(main(sys.argv))
