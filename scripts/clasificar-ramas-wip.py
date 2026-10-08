#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Clasifica ramas locales en LLEGO (su contenido ya está en main) / WIP (escribió algo que main no
tiene), para poder limpiar ramas y worktrees acumulados sin perder trabajo.

POR QUÉ EXISTE
==============
Este repo acumula worktrees (62 el 2026-10-07) y las señales obvias **mienten, todas hacia WIP**:

  `git rev-list origin/main..rama`  marcó 41 de 41 ramas: el squash-merge crea un commit NUEVO, el
                                   original nunca llega a main.
  `git cherry`                      compara por patch-id: un PR que squasheó 13 commits deja los 13
                                   marcados como ausentes aunque el contenido esté en main.
  diff rama↔main                    un blob que pasa de CRLF a LF hace ver el archivo ENTERO cambiado
                                   (`--ignore-cr-at-eol` NO alcanza), y las líneas MOVIDAS cuentan.
  conjuntos rama↔main               cuenta como propio todo lo que main EDITÓ después de que la rama
                                   saliera. La rama no lo escribió: quedó ATRASADA.

EL CRITERIO, que es el punto de todo el script
==============================================
    escrito_por_la_rama = lineas(rama:archivo)  -  lineas(merge_base:archivo)
    falta_en_main       = escrito_por_la_rama   -  lineas(main:archivo)

Si la rama no ESCRIBIÓ una línea, no cuenta, por mucho que main haya cambiado alrededor. Se reportan
las dos cifras («falta 44 de 838 escritas») porque un numerador sin denominador parece trabajo
perdido: así se lee el atraso como lo que es.

El error que este criterio corrige costó un hallazgo publicado en falso: «4 ramas con trabajo en
paralelo sobre el mismo archivo» donde dos de ellas estaban enteras en main. Comparar por archivo y
tapar los archivos de alta rotación con una excepción NO alcanzaba: el defecto era del criterio, así
que revivía en cualquier archivo que main tocara. Con el merge-base restado no hace falta excepción.

CANARIOS (5, construidos en worktrees aislados y borrados; si uno falla el script ABORTA)
========================================================================================
  A  código inventado, desde main                         -> WIP
  B  código duplicado de una línea que ya está en main    -> LLEGO
  C  rama sin cambios                                     -> LLEGO
  D  línea inventada en un índice de memoria              -> WIP    (no hay archivos exentos)
  E  desde un main VIEJO, duplica una línea del archivo
     viejo (no escribe nada nuevo)                        -> LLEGO  <- separa este criterio del malo

E es el canario del defecto: sin él, «restar el merge-base» es una afirmación, no una medición. Un
canario calibrado al diseño anterior deja de medir cuando el diseño cambia — este set ya se cobró ese
caso (un canario mutaba el archivo que la versión previa había pasado a eximir, y dejó de poder dar
WIP; el script se abortó solo, que es lo correcto).

USO
===
    python scripts/clasificar-ramas-wip.py --prefijo plan/
    python scripts/clasificar-ramas-wip.py --prefijo fe2/ --borrar-llego

⚠️ Tocá SÓLO tu prefijo: las ramas de otra sesión las limpia su dueña.
⚠️ `--borrar-llego` se NIEGA si el worktree de la rama tiene cambios sin commitear: este script
   compara COMMITS, y el WIP sin commitear le es invisible. En una corrida real apareció un worktree
   con 9 archivos sin commitear que un `remove --force` habría descartado.
"""
import argparse
import os
import subprocess
import sys

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

MAIN = "origin/main"
# Candidatos de base vieja para el canario E: el primero donde el archivo elegido DIFIERA de main.
PROFUNDIDADES = (60, 120, 200, 320, 500)


def git(*a, **kw):
    cwd = kw.get("cwd")
    p = subprocess.run(("git",) + a, capture_output=True, text=True, encoding="utf-8",
                       errors="replace", cwd=cwd)
    return p.stdout or ""


def norm(txt):
    """Líneas significativas: sin CR, sin bordes, sin vacías. Neutraliza EOL y reindentado."""
    return set(l.strip() for l in txt.replace("\r\n", "\n").split("\n") if l.strip())


def blob(ref, f):
    return norm(git("show", "%s:%s" % (ref, f)))


# Fraccion de lo escrito por debajo de la cual «lo que falta» huele a version VIEJA de algo que
# main ya reescribio, no a trabajo pendiente. NO es un veredicto y NO descarta: enciende `WIP?`, que
# `--borrar-llego` se niega a borrar. Medido el 2026-10-07 sobre las 10 ramas `plan/*` adjudicadas a
# mano: las 10 eran reescritura de main, con ratios de 1/66, 2/63, 3/37 y 44/951 (4.6%, el mayor).
# Un umbral calibrado al corpus de UN dia envejece con el, asi que este no frena nada — pide lectura.
RATIO_REESCRITO = 0.10


def clasificar(rama):
    """-> (veredicto, [(archivo, falta, escrito, lineas)], archivos_tocados, merge_base)

    Veredictos: LLEGO (nada que main no tenga) · WIP (escribio algo propio) · WIP? (lo que falta es
    una fraccion < RATIO_REESCRITO de lo escrito => probable reescritura de main; hay que LEERLO).
    """
    mb = git("merge-base", MAIN, rama).strip()
    if not mb:
        return ("AMBIGUA", [], 0, "")
    tocados = [f for f in git("diff", "--name-only", mb, rama).splitlines() if f.strip()]
    if not tocados:
        return ("LLEGO", [], 0, mb[:8])
    propios = []
    for f in tocados:
        en_rama = blob(rama, f)
        if not en_rama:
            continue                                  # borrado por la rama: no es trabajo pendiente
        escrito = en_rama - blob(mb, f)               # lo que la rama agregó DE VERDAD
        if not escrito:
            continue                                  # sólo arrastra la versión vieja => atraso
        falta = escrito - blob(MAIN, f)               # y que main todavía no tiene
        if falta:
            propios.append((f, len(falta), len(escrito), sorted(falta)))
    if not propios:
        return ("LLEGO", [], len(tocados), mb[:8])
    # `WIP?` solo si TODOS los archivos huelen a reescritura: si uno solo tiene trabajo propio de
    # verdad, la rama es WIP y no se puede tocar. El flag nunca absuelve a la rama entera por mayoria.
    sospecha = all(falta / float(escrito) < RATIO_REESCRITO for _f, falta, escrito, _l in propios)
    return ("WIP?" if sospecha else "WIP", propios, len(tocados), mb[:8])


# ---------------------------------------------------------------- canarios

def _archivo_codigo():
    """Un archivo de código versionado, con comentarios para poder duplicar una línea existente."""
    for f in git("ls-tree", "-r", "--name-only", MAIN, "scripts/").splitlines():
        f = f.strip()
        if f.endswith((".sh", ".py")) and "/tests/" not in f:
            txt = git("show", "%s:%s" % (MAIN, f))
            if sum(1 for l in txt.split("\n") if l.strip().startswith("#") and len(l.strip()) > 20) > 2:
                return f
    sys.exit("ABORT: no encontré un archivo de código para los canarios")


def _base_vieja(f):
    """La primera profundidad donde `f` difiera de main: sin diferencia, el canario E no mide nada."""
    actual = blob(MAIN, f)
    for n in PROFUNDIDADES:
        ref = "%s~%d" % (MAIN, n)
        if not git("rev-parse", "--verify", "--quiet", ref).strip():
            continue
        if blob(ref, f) and blob(ref, f) != actual:
            return ref
    return None


def _append(wt, rel, data):
    p = os.path.join(wt, *rel.split("/"))
    with open(p, "rb") as fh:
        raw = fh.read()
    with open(p, "wb") as fh:
        fh.write(raw + data)
    return rel


def _dup_linea(wt, rel):
    p = os.path.join(wt, *rel.split("/"))
    with open(p, "rb") as fh:
        raw = fh.read()
    cands = [l for l in raw.split(b"\n") if l.strip().startswith(b"#") and len(l.strip()) > 20]
    if not cands:
        sys.exit("ABORT: no hay línea de comentario para duplicar en %s" % rel)
    return _append(wt, rel, b"\n" + cands[0] + b"\n")


def canario(nombre, base, mutar):
    wt = os.path.join(os.path.dirname(os.path.abspath(git("rev-parse", "--show-toplevel").strip())),
                      "_wt-can-%s" % nombre)
    rama = "can-%s" % nombre
    git("worktree", "remove", "--force", wt)
    git("branch", "-D", rama)
    if not git("worktree", "add", "-b", rama, wt, base) and not os.path.isdir(wt):
        sys.exit("ABORT: no pude crear el worktree del canario %s" % nombre)
    try:
        ruta = mutar(wt)
        if ruta:
            subprocess.run(("git", "-C", wt, "add", ruta), capture_output=True)
            subprocess.run(("git", "-C", wt, "commit", "-q", "-m", "canario " + nombre),
                           capture_output=True)
        return clasificar(rama)[0]
    finally:
        git("worktree", "remove", "--force", wt)
        git("branch", "-D", rama)


def _traer_de_main_mas_una(wt, rel):
    """Copia el archivo TAL COMO ESTA EN MAIN sobre una base vieja y le suma una linea inventada.

    Lo que fabrica es el caso que v4 no distinguia: la rama «escribio» todo lo que main cambio desde
    la base vieja (porque su contenido lo trae), y de todo eso main solo NO tiene la linea inventada.
    Ratio = 1/N, muy por debajo del umbral => `WIP?`. Si saliera `WIP`, el flag no esta cableado.
    """
    contenido = git("show", "%s:%s" % (MAIN, rel))
    if not contenido:
        return None
    with open(os.path.join(wt, rel), "w", encoding="utf-8", newline="") as fh:
        fh.write(contenido + "\n# CANARIO F: linea propia sobre el contenido de main\n")
    return rel


def correr_canarios(indice):
    cod = _archivo_codigo()
    viejo = _base_vieja(cod) or _base_vieja(indice)
    if not viejo:
        sys.exit("ABORT: no encontré una base vieja donde el archivo difiera; el canario E no mediría "
                 "nada y sin él el criterio no está probado.")
    archivo_e = cod if _base_vieja(cod) else indice
    casos = (
        ("A-codigo-inventado", MAIN,
         lambda wt: _append(wt, cod, b"\n# CANARIO inventado que no existe en main\n"), "WIP"),
        ("B-codigo-duplicado", MAIN, lambda wt: _dup_linea(wt, cod), "LLEGO"),
        ("C-sin-cambios", MAIN, lambda wt: None, "LLEGO"),
        ("D-indice-inventado", MAIN,
         lambda wt: _append(wt, indice, b"- [CANARIO inexistente](canario-zzz.md)\n"), "WIP"),
        ("E-viejo-duplicado", viejo, lambda wt: _dup_linea(wt, archivo_e), "LLEGO"),
        # F es el control POSITIVO de `WIP?`, y A es su control negativo (1 linea inventada sobre
        # main => ratio 1.0 => WIP sin flag). F reproduce el caso real que me costo el turno del
        # 2026-10-07: una rama vieja cuyo archivo main ya reescribio, con una sola linea propia.
        ("F-viejo-reescrito-por-main", viejo,
         lambda wt: _traer_de_main_mas_una(wt, archivo_e), "WIP?"),
    )
    print("CANARIOS   (código: %s · base vieja de E: %s sobre %s)" % (cod, viejo, archivo_e))
    ok = True
    for nombre, base, mutar, esperado in casos:
        got = canario(nombre.split("-")[0].lower(), base, mutar)
        bien = got == esperado
        ok = ok and bien
        print("   %-20s = %-7s esperado %-7s %s" % (nombre, got, esperado, "OK" if bien else "<<< FALLA"))
    if not ok:
        sys.exit("ABORT: el clasificador NO discrimina. Su veredicto NO se usa.")
    print("   => E en LLEGO prueba que restar el merge-base distingue atraso de trabajo pendiente.\n")


# ---------------------------------------------------------------- barrido

def worktree_de(rama):
    cur = None
    for l in git("worktree", "list", "--porcelain").splitlines():
        if l.startswith("worktree "):
            cur = l[len("worktree "):]
        elif l == "branch refs/heads/%s" % rama:
            return cur
    return None


def main():
    ap = argparse.ArgumentParser(description="Clasifica ramas en LLEGO / WIP restando el merge-base.")
    ap.add_argument("--prefijo", required=True,
                    help="prefijo de ramas a clasificar (plan/ · fe1/ · fe2/ · backend/ · aud/). "
                         "Tocá SÓLO tu prefijo: las ajenas las limpia su dueña.")
    ap.add_argument("--indice", default="memoria/MEMORY.md",
                    help="archivo de alta rotación para el canario D (default: memoria/MEMORY.md)")
    ap.add_argument("--mostrar", type=int, default=3,
                    help="líneas pendientes a imprimir por archivo (0 = todas). Imprimirlas es el "
                         "punto: con una sola muestra el veredicto WIP parece una conclusión, y es "
                         "una pregunta — hay que leer para saber si main ya reescribió eso")
    ap.add_argument("--borrar-llego", action="store_true",
                    help="borra las LLEGO y su worktree. Se NIEGA si el worktree tiene cambios sin "
                         "commitear: este script compara commits y no los ve.")
    ap.add_argument("--sin-canarios", action="store_true",
                    help="NO usar salvo para depurar el script: sin canarios el veredicto no está "
                         "acreditado y no debe decidir ningún borrado.")
    args = ap.parse_args()

    if args.sin_canarios and args.borrar_llego:
        sys.exit("ABORT: --borrar-llego sin canarios borraría sobre un veredicto no acreditado.")
    git("fetch", "origin", "main", "--quiet")
    print("main = %s\n" % git("rev-parse", "--short", MAIN).strip())
    if not args.sin_canarios:
        correr_canarios(args.indice)

    ramas = [b.strip() for b in git("branch", "--list", args.prefijo + "*",
                                    "--format=%(refname:short)").splitlines() if b.strip()]
    if not ramas:
        print("no hay ramas con el prefijo %s" % args.prefijo)
        return 0
    llego, wip = [], []
    for b in ramas:
        ver, propios, n, mb = clasificar(b)
        if ver == "LLEGO":
            llego.append((b, propios, n, worktree_de(b), mb))
        else:
            wip.append((ver, b, propios, n, worktree_de(b), mb))

    print("TOTAL %d ramas %s*  ->  LLEGO %d  |  WIP %d" % (len(ramas), args.prefijo, len(llego), len(wip)))
    print("\n--- LLEGO: todo lo que la rama escribió ya está en main ---")
    for b, _, n, w, mb in sorted(llego):
        print("  %-56s mb:%s %2d archivos  wt:%s" % (b, mb, n, w or "-"))
    print("\n--- WIP: líneas que la rama escribió y main NO tiene ---")
    print("    ⚠️  `WIP?` = lo que falta es < %d%% de lo escrito: casi siempre main REESCRIBIÓ esa"
          % int(RATIO_REESCRITO * 100))
    print("        región y lo pendiente es la versión vieja. LEÉ las líneas antes de rescatar.")
    print("    ⚠️  Y `WIP` TAMPOCO prueba trabajo pendiente: el 2026-10-07 adjudiqué 10 ramas `plan/*`")
    print("        una por una y las 10 eran atraso — DOS de ellas con ratio 21% y 37%, muy por")
    print("        encima de este umbral. El flag levanta los casos más obvios; no cubre el resto.")
    print("        El único criterio que decidió fue por FUNCIÓN: ¿existe en main, aunque con otro")
    print("        texto? (grep del mecanismo, no de la línea). Las 10 veces la respuesta fue sí.")
    for ver_b, b, propios, n, w, mb in sorted(wip, key=lambda x: -sum(c for _, c, _, _ in x[2])):
        print("  [%-4s] %-49s mb:%s %3d líneas en %d archivos  wt:%s"
              % (ver_b, b, mb, sum(c for _, c, _, _ in propios), len(propios), w or "-"))
        for f, falta, escrito, lns in sorted(propios, key=lambda x: -x[1]):
            pct = 100.0 * falta / float(escrito)
            print("        falta %3d de %4d escritas (%4.1f%%)  %s" % (falta, escrito, pct, f))
            for l in lns[:args.mostrar] if args.mostrar else lns:
                print("            | %s" % l.strip()[:116])
            if args.mostrar and len(lns) > args.mostrar:
                print("            | … %d más (subí --mostrar)" % (len(lns) - args.mostrar))

    compartidos = {}
    for _ver, b, propios, _n, _w, _mb in wip:
        for f, c, _e, _m in propios:
            compartidos.setdefault(f, []).append((b, c))
    comunes = {f: rs for f, rs in compartidos.items() if len(rs) > 1}
    print("\n--- archivos con WIP en MÁS DE UNA rama (resolverlo tomando un lado no converge) ---")
    if not comunes:
        print("  (ninguno)")
    for f, rs in sorted(comunes.items(), key=lambda x: -len(x[1])):
        print("  %s  <- %d ramas" % (f, len(rs)))
        for b, c in sorted(rs, key=lambda x: -x[1]):
            print("        %3d líneas  %s" % (c, b))

    if args.borrar_llego:
        print("\n--- BORRADO de las LLEGO ---")
        for b, _, _n, w, _mb in sorted(llego):
            if w:
                sucios = [l for l in git("status", "--porcelain", cwd=w).splitlines() if l.strip()]
                if sucios:
                    print("  SALTEADA %s: su worktree tiene %d archivos sin commitear (invisibles "
                          "para este script). Revisalos a mano." % (b, len(sucios)))
                    continue
                git("worktree", "remove", "--force", w)
            git("branch", "-D", b)
            print("  borrada %s%s" % (b, " (+ worktree)" if w else ""))
        git("worktree", "prune")
        print("  quedan: %d ramas %s* · %d worktrees"
              % (len(git("branch", "--list", args.prefijo + "*").splitlines()),
                 args.prefijo, len(git("worktree", "list").splitlines())))
    return 0


if __name__ == "__main__":
    sys.exit(main())
