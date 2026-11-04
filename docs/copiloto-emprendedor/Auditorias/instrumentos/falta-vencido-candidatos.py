"""¿El `Falta:` de cada ficha DOD-PARCIAL sigue siendo cierto contra el ref, o pide trabajo YA HECHO?

Pregunta sobre el SISTEMA, no sobre el documento: el sistema se movio despues de que el Falta se
escribio. Dos senales deterministas, sin LLM; las dos dan CANDIDATOS, el veredicto se lee a mano:

  (1) COMMITS POSTERIORES: commits de `ref` que nombran la ficha en su mensaje y entraron DESPUES del
      commit que introdujo el texto actual del Falta. Si existen, el Falta puede estar vencido.
      Caso real (auditoria 2026-11-04): e213dd47 hizo SM-N41 y la parte 2 de SM-Z4, y sus Falta
      seguian pidiendo la decision.
  (2) CORPUS MOVIDO: entradas del corpus (`entrada(s) NN`) que el Falta nombra y que hoy estan en
      CONFORME o DIFERENTE · B. Caso real: SM-N31 pedia pasar 12 y 13 a CONFORME y ya lo estaban
      desde e8ed06fb.

Ademas lista los shas que el Falta cita y son ancestros (el Falta RECONOCE codigo hecho: es el caso
limite de SM-Z1, carencia real pero de un disparador humano).

Uso (desde la raiz del repo, con `git fetch origin main`):
    python -I -X utf8 docs/copiloto-emprendedor/Auditorias/instrumentos/falta-vencido-candidatos.py [ref]

Controles medidos @61adbe95: positivo SM-N41/SM-Z4 (senal 1) y SM-N31 (senal 2); caso limite SM-Z1
(sale con 63b50b8a reconocido y SIN commits posteriores); negativo SM-J1 (sin ninguna senal: su
Falta pide documentar en el mapa y el mapa sigue sin «Te deben» ni «buscar»).
"""
import re
import subprocess
import sys

BACKLOG = "docs/copiloto-emprendedor/2026-11-02-BACKLOG-sprint-correcciones-mapa.md"
CORPUS = "docs/copiloto-emprendedor/2026-10-16-relevamiento-mapa-de-pantallas-vs-app.md"
CERRADOS = ("CONFORME", "DIFERENTE · B")


def git(*args):
    return subprocess.run(["git", *args], capture_output=True, text=True, encoding="utf-8").stdout


def veredictos(ref):
    """n -> veredicto del corpus en `ref`, con el regex FILA de scripts/mapa-51-estado.py (no uno propio)."""
    import importlib.util
    spec = importlib.util.spec_from_file_location("mapa51", "scripts/mapa-51-estado.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    out = {}
    for linea in git("show", f"{ref}:{CORPUS}").replace("\r\n", "\n").split("\n"):
        m = mod.FILA.match(linea)
        if m:
            out.setdefault(m["n"].zfill(2), re.sub(r"\s+", " ", m["ver"]).strip())
    return out


def main(ref="origin/main"):
    doc = git("show", f"{ref}:{BACKLOG}")
    if not doc:
        sys.exit(f"ERROR: {BACKLOG} no existe en {ref} (un ref vacio daria cero candidatos falsos)")
    ver = veredictos(ref)
    if len(ver) < 40:
        sys.exit(f"ERROR: lei {len(ver)} entradas del corpus, se esperan ~51: el parser no ve la tabla")
    parts = re.split(r"\n### (SM-[A-Z]\d+)", doc)
    fichas = {parts[i]: parts[i + 1] for i in range(1, len(parts), 2)}
    n = 0
    for ficha, cuerpo in fichas.items():
        if not re.search(r"- \*\*Estado:\*\* DOD-PARCIAL", cuerpo):
            continue
        n += 1
        m = re.search(r"- \*\*Falta[^*]*:\*\*(.*?)(?=\n- \*\*|\n---|\Z)", cuerpo, re.S)
        falta = m[1] if m else ""
        snippet = re.sub(r"\s+", " ", falta).strip()[:50]
        intro = git("log", ref, "--format=%H %cI", "--reverse", "-S", snippet, "--", BACKLOG).split("\n")[0].split()
        desde = intro[1] if len(intro) == 2 else None
        posteriores = []
        if desde:
            for linea in git("log", ref, f"--since={desde}", "--format=%h %cI %s", f"--grep={ficha}\\b",
                             "--extended-regexp").splitlines():
                h, fecha, *_ = linea.split(" ", 2)
                # docs(sprint|memoria|auditoria|SM-XX) hablan DE la ficha, no la cambian: son ruido medido
                # (a la primera corrida dieron 8 de 21 candidatos; docs(SM-L4) fabrico el falso de SM-L1).
                # docs(corpus) SI cuenta: mueve veredictos.
                if fecha > desde and not re.match(r"docs\((sprint|memoria|auditoria|SM-[A-Z]\d+)\)",
                                                  linea.split(" ", 2)[2]):
                    posteriores.append(linea[:120])
        corpus = [e for e in re.findall(r"entradas? ((?:\d{2}(?:,? y |, | )?)+)", falta) for e in re.findall(r"\d{2}", e)]
        movidas = [f"{e}={ver[e]}" for e in dict.fromkeys(corpus) if ver.get(e) in CERRADOS]
        reconocidos = [s for s in dict.fromkeys(re.findall(r"\b[0-9a-f]{8,40}\b", falta))
                       if git("cat-file", "-t", s).strip() == "commit"
                       and subprocess.run(["git", "merge-base", "--is-ancestor", s, ref]).returncode == 0]
        marca = "CANDIDATO-VENCIDO" if posteriores or movidas else ""
        print(f"##### {ficha} {marca} | Falta escrito {desde or '?'} | shas reconocidos: {' '.join(reconocidos) or '-'}")
        for p in posteriores:
            print(f"   commit posterior: {p}")
        if movidas:
            print(f"   corpus movido: {', '.join(movidas)}")
    print(f"DOD-PARCIAL leidas: {n} @ {git('rev-parse', '--short', ref).strip()}")


if __name__ == "__main__":
    main(*sys.argv[1:])
