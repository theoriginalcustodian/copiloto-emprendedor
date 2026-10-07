#!/usr/bin/env python3
"""Barrido SUPERFICIEOFFLINE v6 - AUTOCONTENIDO.

No depende de ningun archivo previo ni de ningun arbol materializado: lee TODO de `origin/main`
via `git show`, asi que corre desde cualquier worktree del repo y otra sesion lo reproduce.

Unidad de comparacion = la LLAMADA (verbo, ruta), no el archivo. Un archivo del front llama
muchas rutas; contar archivos mide una poblacion que no es la que se quiere verificar.

Para cada llamada compara:
  - lo que el front DECLARA   (el generico de apiClient.get<T>(...)), y
  - lo que el handler DEVUELVE (las claves del return del backend).
Cuando el generico es `unknown` (estilo documentado del repo), compara contra lo que el front
ESTRECHA: las claves que lee de `raw` despues de la llamada.

CONTROL POSITIVO embebido: dos llamadas de veredicto conocido. Si no reproducen, el barrido no vale.

Uso:  python barrido-v6.py [ref] [repo]
"""
import os
import re
import subprocess
import sys
from collections import defaultdict

REF = sys.argv[1] if len(sys.argv) > 1 else "origin/main"
ENV = {"MSYS_NO_PATHCONV": "1", "PATH": os.environ.get("PATH", "")}


def _raiz():
    """el repo donde vive este archivo, no uno hardcodeado: un instrumento que solo corre en la
    maquina del que lo escribio no cierra una fila."""
    r = subprocess.run(["git", "-C", os.path.dirname(os.path.abspath(__file__)),
                        "rev-parse", "--show-toplevel"], capture_output=True, text=True, env=ENV)
    return r.stdout.strip() or os.getcwd()


REPO = sys.argv[2] if len(sys.argv) > 2 else _raiz()


def git(*a):
    r = subprocess.run(["git", "-C", REPO, *a], capture_output=True, text=True,
                       errors="replace", env=ENV)
    return r.stdout if r.returncode == 0 else ""


def blob(path):
    return git("show", REF + ":" + path)


# --------------------------- 1. llamadas del front ---------------------------
VERBOS = {"get": "GET", "post": "POST", "put": "PUT", "patch": "PATCH",
          "del": "DELETE", "delete": "DELETE"}


def norm_ruta(p):
    p = p.split("?")[0]
    p = re.sub(r"\$\{[^}]*\}", "{}", p)
    p = re.sub(r"\{[^}]*\}", "{}", p)
    # `/ingresos${qs}` -> `/ingresos{}`: un {} PEGADO al segmento anterior (sin `/` delante) es
    # sufijo de query, no un path param. Dejarlo fabrica una ruta que ningun handler matchea.
    p = re.sub(r"(?<!/)\{\}$", "", p)
    return p or "/"


def balancear(txt, i, ab, ce):
    """desde txt[i]==ab devuelve (contenido, indice tras el cierre)"""
    d = 0
    for j in range(i, len(txt)):
        if txt[j] == ab:
            d += 1
        elif txt[j] == ce:
            d -= 1
            if d == 0:
                return txt[i + 1:j], j + 1
    return "", len(txt)


LLAM = re.compile(r"apiClient\.(get|post|put|patch|del|delete)\s*<")


def llamadas_de(path, txt):
    out = []
    for m in LLAM.finditer(txt):
        verbo = VERBOS[m.group(1)]
        gen, k = balancear(txt, m.end() - 1, "<", ">")
        # El argumento va ANCLADO al `(` que sigue al generico. Buscar una comilla "mas adelante"
        # agarra cualquier string del codigo posterior: asi `if ('filas' in raw)`, cuatro lineas
        # abajo, se convirtio en una ruta `filas` y produjo 4 SIN_HANDLER falsos.
        am = re.match(r"\s*\(\s*([`'\"])([^`'\"]*)\1", txt[k:k + 300])
        if am:
            ruta, via = norm_ruta(am.group(2)), "literal"
        else:
            # ruta por VARIABLE (`apiClient.get<T>(path)`): se resuelve hacia atras, buscando el
            # literal con el que se armo. Descartarla seria perder la llamada, no medirla.
            vm = re.match(r"\s*\(\s*([A-Za-z_]\w*)\s*[,)]", txt[k:k + 120])
            if not vm:
                continue
            ruta, via = _ruta_de_variable(txt, m.start(), vm.group(1)), "variable:" + vm.group(1)
            if not ruta:
                continue
        # Los comentarios se sacan ANTES de colapsar los saltos: `// ...se leen igual, opcionales:
        # cuando...` dentro del generico de /afip/estado se leia como una clave `opcionales` y
        # fabricaba un DIFIERE contra un handler sano ([[el-guard-se-satisface-con-su-propio-comentario]]).
        # Y el orden importa en los dos sentidos: limpiar DESPUES de colapsar borra el generico
        # entero, porque `//[^\n]*` sobre una sola linea se come todo lo que sigue.
        limpio = re.sub(r"/\*.*?\*/", " ", gen, flags=re.S)
        limpio = re.sub(r"//[^\n]*", " ", limpio)
        out.append({"verbo": verbo, "ruta": ruta, "via": via,
                    "generico": " ".join(limpio.split()), "archivo": path,
                    "linea": txt[:m.start()].count("\n") + 1, "offset": k})
    return out


def _ruta_de_variable(txt, hasta, var):
    """el literal de ruta con el que se armo `var`, buscando hacia atras desde la llamada"""
    ventana = txt[max(0, hasta - 1200):hasta]
    asigs = re.findall(r"\b(?:const|let|var)\s+" + re.escape(var) + r"\b[^;]*;", ventana, re.S)
    if not asigs:
        return ""
    cands = re.findall(r"[`'\"](/[^`'\"]*)[`'\"]", asigs[-1])
    if not cands:
        return ""
    # el mas corto: el ternario suele dar `/x?${qs}` y `/x`; la ruta sin query es la canonica
    return norm_ruta(sorted(cands, key=len)[0])


def claves_generico(gen):
    """claves de nivel 0 de un literal de objeto TS inline; None si es alias o unknown"""
    g = gen.strip()
    if not g.startswith("{"):
        return None
    cuerpo, _ = balancear(g, 0, "{", "}")
    claves, d, buf = [], 0, ""
    for ch in cuerpo:
        if ch in "{[(":
            d += 1
        elif ch in "}])":
            d -= 1
        if d == 0 and ch in ";,":
            if ":" in buf:
                claves.append(buf.split(":")[0].strip().rstrip("?"))
            buf = ""
        else:
            buf += ch
    if ":" in buf:
        claves.append(buf.split(":")[0].strip().rstrip("?"))
    return sorted({c for c in claves if re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", c)})


def claves_estrechadas(txt, offset, ventana=1400):
    """lo que el front LEE de la respuesta: raw.X / raw['X'] / const {X} = raw"""
    seg = txt[offset:offset + ventana]
    seg = re.sub(r"//[^\n]*", "", seg)
    ks = set(re.findall(r"\braw\.([A-Za-z_][A-Za-z0-9_]*)", seg))
    ks |= set(re.findall(r"\braw\[['\"]([^'\"]+)['\"]\]", seg))
    for d in re.findall(r"const\s*\{([^}]*)\}\s*=\s*raw\b", seg):
        ks |= {x.split(":")[0].strip() for x in d.split(",") if x.strip()}
    return sorted(k for k in ks if re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", k))


# --------------------------- 2. handlers del backend ---------------------------
DEC = re.compile(r'^\s*@(?:app|router)\.(get|post|put|patch|delete)\(\s*"([^"]*)"', re.M)
OTRO_DEC = re.compile(r"^\s*@(?:app|router)\.", re.M)


def _clave_de(frag):
    m = re.match(r'\s*"([A-Za-z_][A-Za-z0-9_]*)"\s*:', frag)
    if m:
        return {m.group(1)}
    m = re.match(r"\s*\*\*(\w+)", frag)
    if m:
        return {"**" + m.group(1)}
    return set()


def _claves_de_dicts(cuerpo):
    """todas las claves de nivel 0 de los `return {...}` que haya en `cuerpo`"""
    ks = set()
    for rm in re.finditer(r"\breturn\s*\{", cuerpo):
        dic, _ = balancear(cuerpo, rm.end() - 1, "{", "}")
        d, buf = 0, ""
        for ch in dic:
            if ch in "{[(":
                d += 1
            elif ch in "}])":
                d -= 1
            if d == 0 and ch == ",":
                ks |= _clave_de(buf)
                buf = ""
            else:
                buf += ch
        ks |= _clave_de(buf)
    return ks


# `return _solapas(x)` / `return await asyncio.to_thread(f, ...)` / `return await f(...)`
INDIR = re.compile(r"\breturn\s+(?:await\s+)?(?:asyncio\.to_thread\(\s*)?([A-Za-z_][A-Za-z0-9_.]*)\s*\(")


# `return await asyncio.to_thread(gasto_store_factory(cliente_id).resumen, periodo)`
# Lo que importa es el METODO del final, y vive en OTRO archivo (el store). Sin este patron los
# handlers de plata (/gastos/resumen, /ingresos/resumen, /afip/comprobantes/impagos) quedan opacos:
# el 12 de HANDLER_OPACO era mayormente esto.
METODO = re.compile(r"\breturn\s+(?:await\s+)?(?:asyncio\.to_thread\(\s*)?"
                    r"[A-Za-z_]\w*\([^)]*\)\.([A-Za-z_]\w*)")


def claves_handler(txt, desde, prof=1, otros=None):
    """claves que devuelve el handler que arranca en `desde`.

    Sigue la indireccion en dos pasos: un `return helper(...)` del mismo archivo, y un
    `return store(...).metodo` cuyo metodo vive en otro archivo del backend. Un `return` que
    delega no es un handler sin claves, y tratar el vacio como "no manda nada" fabrica un
    DIFIERE falso contra el front.
    Devuelve (claves, opaco): `opaco=True` cuando no se pudo leer ninguna forma.
    """
    fin = len(txt)
    m = OTRO_DEC.search(txt, desde + 10)
    if m:
        fin = m.start()
    cuerpo = txt[desde:fin]
    ks = _claves_de_dicts(cuerpo)
    if ks:
        # La lista es COMPLETA solo si TODOS los `return` del handler son dicts literales. Si alguno
        # delega, la respuesta puede componerse afuera y lo leido es parcial — medido: asi escapo el
        # falso DIFIERE de /inteligencia/graficos/facturacion, cuyo `periodo` lo manda un helper
        # (inteligencia_web.py:66,79,97) fuera del rango del handler.
        total = len(re.findall(r"\breturn\b", cuerpo))
        dicts = len(re.findall(r"\breturn\s*\{", cuerpo))
        return sorted(ks), False, total == dicts
    if prof > 0:
        for im in INDIR.finditer(cuerpo):
            nombre = im.group(1).split(".")[-1]
            dm = re.search(r"^([ \t]*)(?:async\s+)?def\s+" + re.escape(nombre) + r"\s*\(", txt, re.M)
            if dm:
                ks |= _claves_de_dicts(_cuerpo_def(txt, dm))
        if ks:
            return sorted(ks), False, False
        for mm in METODO.finditer(cuerpo):
            metodo = mm.group(1)
            for otro in (otros or {}).values():
                dm = re.search(r"^([ \t]*)(?:async\s+)?def\s+" + re.escape(metodo) + r"\s*\(",
                               otro, re.M)
                if dm:
                    ks |= _claves_de_dicts(_cuerpo_def(otro, dm))
        if ks:
            # Por INDIRECCION la lista es PARCIAL por construccion: el store tiene varios metodos
            # y la respuesta se compone en uno que puede no ser el que matcheo. Medido: asi salieron
            # DOS falsos DIFIERE (`mes_anterior`, que cobro_store.py:387 SI escribe; y `periodo`,
            # que inteligencia_web.py:66 SI manda). De una lista parcial no se puede emitir una
            # acusacion: solo confirmar un OK.
            return sorted(ks), False, False
    return [], True, False


def _cuerpo_def(txt, dm):
    """el cuerpo del `def` que matchea `dm`, cortado por INDENTACION.

    Sin este corte un `def` anidado (los handlers viven dentro de factories, asi que casi todos
    lo estan) se extiende hasta el fin del archivo y el extractor junta las claves de TODOS los
    handlers: un denominador inflado que fabrica un DIFIERE con 18 claves ajenas.
    """
    ind = len(dm.group(1))
    lineas = txt[dm.start():].splitlines(keepends=True)
    out = [lineas[0]]
    for l in lineas[1:]:
        if l.strip() and (len(l) - len(l.lstrip())) <= ind:
            break
        out.append(l)
    return "".join(out)


# --------------------------- 3. corrida ---------------------------
def main():
    crudo = git("grep", "-I", "-l", "-E", r"apiClient\.(get|post|put|patch|del|delete)",
                REF, "--", "packages/core/src", "apps/copiloto-web/src", "apps/mobile/src")
    front = [l.split(":", 1)[1] for l in crudo.splitlines() if ":" in l]
    front = [f for f in front if not re.search(r"\.test\.|\.spec\.", f)]

    back = [l for l in git("ls-tree", "-r", "--name-only", REF, "--", "apps/copiloto").splitlines()
            if l.endswith(".py") and "/tests/" not in l]

    blobs = {bf: blob(bf) for bf in back}
    handlers = {}
    for bf in back:
        t = blobs[bf]
        for m in DEC.finditer(t):
            key = (m.group(1).upper(), norm_ruta(m.group(2)))
            ks, opaco, completa = claves_handler(t, m.start(), otros=blobs)
            handlers.setdefault(key, []).append(
                {"archivo": bf, "linea": t[:m.start()].count("\n") + 1,
                 "claves": ks, "opaco": opaco, "completa": completa})

    # indice de alias de tipo de TODO el front, no solo de los archivos que llaman al backend:
    # `CatalogResponse`/`MeResponse` viven en archivos de tipos que no importan apiClient, asi que
    # indexar solo los 37 llamadores deja 20 llamadas sin forma por donde VIVE el tipo, no por como es.
    tipos_ff = [l for l in git("ls-tree", "-r", "--name-only", REF, "--",
                               "packages/core/src", "apps/copiloto-web/src", "apps/mobile/src").splitlines()
                if re.search(r"\.tsx?$", l) and not re.search(r"\.test\.|\.spec\.", l)]
    alias = {}
    for ff in tipos_ff:
        t = blob(ff)
        for am in re.finditer(r"^\s*(?:export\s+)?(?:type\s+([A-Za-z_]\w*)\s*=\s*\{|interface\s+([A-Za-z_]\w*)\s*\{)",
                              t, re.M):
            nombre = am.group(1) or am.group(2)
            i = t.index("{", am.start())
            cuerpo, _ = balancear(t, i, "{", "}")
            alias.setdefault(nombre, claves_generico("{" + cuerpo + "}"))

    todas = []
    for ff in front:
        t = blob(ff)
        for c in llamadas_de(ff, t):
            c["decl"] = claves_generico(c["generico"])
            if c["decl"] is None:
                g = c["generico"].strip().rstrip("[]").strip()
                if g in alias:
                    c["decl"] = alias[g]
                    c["via_alias"] = g
            c["estrecha"] = claves_estrechadas(t, c["offset"])
            todas.append(c)

    print("### DENOMINADOR: %d llamadas en %d archivos del front · %d rutas en %d archivos del backend  (ref %s)\n"
          % (len(todas), len(front), len(handlers), len(back), REF))

    print("### CONTROL POSITIVO (tres llamadas de veredicto conocido):")
    #  /feedback y /afip/facturas: `return {...}` literal  -> claves legibles
    #  /mi-dia/tablero: `return _solapas(...)`             -> SOLO legible si la indireccion funciona
    for v, r, esp in (("GET", "/feedback", "claves literales"),
                      ("POST", "/afip/facturas", "claves literales"),
                      ("GET", "/mi-dia/tablero", "via indireccion (_solapas)")):
        hs = handlers.get((v, r))
        ls = [c for c in todas if (c["verbo"], c["ruta"]) == (v, r)]
        print("   %-6s %-24s handler=%-3s opaco=%-5s claves=%s · llamadas=%d  [%s]"
              % (v, r, "SI" if hs else "NO", hs[0]["opaco"] if hs else "-",
                 hs[0]["claves"] if hs else "-", len(ls), esp))
    print("   alias de tipo del front indexados: %d" % len(alias))
    print()

    cont = defaultdict(int)
    det = defaultdict(list)
    for c in todas:
        hs = handlers.get((c["verbo"], c["ruta"]))
        if not hs:
            cont["SIN_HANDLER"] += 1
            det["SIN_HANDLER"].append(c)
            continue
        if hs[0]["opaco"]:
            # sin forma legible del lado del backend: NO se puede acusar al front.
            cont["HANDLER_OPACO"] += 1
            det["HANDLER_OPACO"].append((c, hs[0]))
            continue
        hk = set(hs[0]["claves"])
        spread = any(k.startswith("**") for k in hk)
        declara = c["decl"] if c["decl"] is not None else c["estrecha"]
        fuente = ("alias:" + c["via_alias"]) if c.get("via_alias") else (
            "tipo" if c["decl"] is not None else "estrechamiento")
        if not declara:
            cont["SIN_FORMA"] += 1
            det["SIN_FORMA"].append(c)
            continue
        sobra = sorted(set(declara) - hk)
        if sobra and not spread:
            if not hs[0]["completa"]:
                # lista parcial (por indireccion): no habilita una acusacion, solo un OK
                cont["NO_CONCLUYENTE"] += 1
                det["NO_CONCLUYENTE"].append((c, fuente, sobra, sorted(hk), hs[0]))
                continue
            cont["DIFIERE"] += 1
            det["DIFIERE"].append((c, fuente, sobra, sorted(hk)))
            continue
        cont["OK"] += 1
        det["OK"].append((c, fuente))

    print("### VEREDICTOS")
    for k in ("OK", "DIFIERE", "NO_CONCLUYENTE", "SIN_FORMA", "HANDLER_OPACO", "SIN_HANDLER"):
        print("   %-16s %d" % (k, cont[k]))
    comp = cont["OK"] + cont["DIFIERE"]
    print("\n   COMPARADAS (veredicto real): %d de %d llamadas = %d%%"
          % (comp, len(todas), 100 * comp // max(len(todas), 1)))
    por_fuente = defaultdict(int)
    for c, f in det["OK"]:
        por_fuente[f.split(":")[0]] += 1
    print("   de las OK: %d por tipo inline · %d por alias resuelto · %d por estrechamiento"
          % (por_fuente["tipo"], por_fuente["alias"], por_fuente["estrechamiento"]))

    print("\n### DIFIERE (el front espera claves que el handler no manda):")
    for c, f, sobra, hk in det["DIFIERE"]:
        print("   %-6s %-34s [%s] espera=%s" % (c["verbo"], c["ruta"], f, sobra))
        print("          %s:%d · handler manda=%s" % (c["archivo"], c["linea"], hk))

    print("\n### SIN_FORMA (ni tipo inline ni estrechamiento legible):")
    for c in det["SIN_FORMA"]:
        print("   %-6s %-34s %s:%d  generico=%s"
              % (c["verbo"], c["ruta"], c["archivo"], c["linea"], c["generico"][:40]))

    print("\n### NO_CONCLUYENTE (la lista del handler es PARCIAL: habilita OK, no acusacion):")
    for c, f, sobra, hk, h in det["NO_CONCLUYENTE"]:
        print("   %-6s %-34s [%s] el front espera=%s" % (c["verbo"], c["ruta"], f, sobra))
        print("          %s:%d | lei del handler (parcial)=%s" % (h["archivo"], h["linea"], hk))

    print("\n### HANDLER_OPACO (el backend no expone forma legible: NO acusa al front):")
    for c, h in det["HANDLER_OPACO"]:
        print("   %-6s %-34s front=%s:%d | handler=%s:%d"
              % (c["verbo"], c["ruta"], c["archivo"], c["linea"], h["archivo"], h["linea"]))

    print("\n### SIN_HANDLER (llamada del front sin ruta en este backend):")
    for c in det["SIN_HANDLER"]:
        print("   %-6s %-34s %s:%d  via=%s" % (c["verbo"], c["ruta"], c["archivo"], c["linea"], c["via"]))


if __name__ == "__main__":
    main()
