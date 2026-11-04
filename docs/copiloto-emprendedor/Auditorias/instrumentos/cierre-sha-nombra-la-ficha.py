"""Para cada ficha TERMINADO del backlog: ¿algún sha ancestro que cita su Cierre nombra la ficha?

El gate de sprint-estado.py verifica que el sha sea ANCESTRO de origin/main, no que sea DE LA FICHA:
cualquier commit de main pasa. Caso real: SM-N25 citaba a6600880, que es el commit de SM-N45
(auditoria 2026-11-03, H15). Este instrumento separa las dos preguntas.

Uso (desde la raiz del repo, despues de `git fetch origin main`):
    git show origin/main:docs/copiloto-emprendedor/2026-11-02-BACKLOG-sprint-correcciones-mapa.md > /tmp/b.md
    python -I -X utf8 docs/copiloto-emprendedor/Auditorias/instrumentos/cierre-sha-nombra-la-ficha.py /tmp/b.md [ref]

Salida: una linea por sha ancestro que NO nombra la ficha, y al final las fichas SIN NINGUN sha propio.
Un sha ajeno no es defecto por si solo (las referencias cruzadas rotuladas son legitimas): lo que
pide lectura es la ficha SIN-PROPIO. Control positivo medido: SM-N25 @9225e4ee sale SIN-PROPIO.
Control negativo: SM-N23 sale con 2 propios.
"""
import re
import subprocess
import sys


def git(*args):
    return subprocess.run(["git", *args], capture_output=True, text=True, encoding="utf-8")


def main(path, ref="origin/main"):
    doc = open(path, encoding="utf-8").read()
    parts = re.split(r"\n### (SM-[A-Z]\d+)", doc)
    fichas = {parts[i]: parts[i + 1] for i in range(1, len(parts), 2)}
    total = ajenos = 0
    sin_propio = []
    for ficha, cuerpo in fichas.items():
        if not re.search(r"- \*\*Estado:\*\* TERMINADO", cuerpo):
            continue
        m = re.search(r"- \*\*Cierre[^*]*:\*\*(.*?)(?=\n- \*\*|\n---|\Z)", cuerpo, re.S)
        cierre = m[1] if m else ""
        propios = 0
        ancestros = 0
        for sha in dict.fromkeys(re.findall(r"\b[0-9a-f]{8,40}\b", cierre)):
            if git("cat-file", "-t", sha).stdout.strip() != "commit":
                continue
            if git("merge-base", "--is-ancestor", sha, ref).returncode:
                continue
            ancestros += 1
            total += 1
            msg = git("log", "-1", "--format=%B", sha).stdout
            corto = ficha[3:]
            if re.search(re.escape(ficha) + r"(?!\d)", msg) or re.search(
                r"\b" + corto + r"\b|sm-" + corto.lower() + r"(?!\d)", msg
            ):
                propios += 1
            else:
                ajenos += 1
                print(f"{ficha} {sha} | {msg.splitlines()[0][:110]}")
        if ancestros and not propios:
            sin_propio.append(ficha)
    print(f"shas ancestro citados: {total} | no nombran la ficha: {ajenos}")
    print(f"fichas SIN-PROPIO: {sin_propio}")


if __name__ == "__main__":
    main(*sys.argv[1:])
