#!/usr/bin/env python3
"""Barrido SUPERFICIEOFFLINE v7 - AUTOCONTENIDO.

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


# Un nombre LLAMADO dentro de la expresion devuelta (`_solapas(x)`, `self._fila(row)`), y un metodo
# invocado sobre el resultado de una llamada (`store(cid).resumen`), del que se captura TAMBIEN el
# dueno (`store`), porque sin el no se puede desambiguar un metodo homonimo. Deliberadamente SIN
# anclar al `return`: lo que se mira lo decide _expr_devueltas.
LLAMADA = re.compile(r"([A-Za-z_][A-Za-z0-9_.]*)\s*\(")
MIEMBRO = re.compile(r"([A-Za-z_]\w*)\s*\([^()]*\)\s*\.\s*([A-Za-z_]\w*)\s*[(,)]")
# `return <var>` a secas: la delegacion esta en la ASIGNACION de <var>, no en el return.
RET_VAR = re.compile(r"\breturn\s+([A-Za-z_]\w*)\s*$", re.M)
RET = re.compile(r"\breturn\s+(?!$)")


def _sentencia(txt, i):
    """el texto desde `i` hasta cerrar los parentesis abiertos (minimo, hasta fin de linea)."""
    fin = txt.find("\n", i)
    if fin < 0:
        fin = len(txt)
    frag = txt[i:fin]
    while frag.count("(") > frag.count(")") and fin < len(txt):
        nf = txt.find("\n", fin + 1)
        if nf < 0:
            nf = len(txt)
        frag, fin = txt[i:nf], nf
    return frag


def _expr_devueltas(cuerpo):
    """las expresiones que el cuerpo devuelve: el RHS de cada `return`, MAS el RHS de las
    asignaciones cuya variable se retorna.

    Dos huecos sintacticos medidos, los dos con la misma cara de "handler ilegible":
      1. el patron canonico de "uno por id" NO delega en el `return`: delega en una ASIGNACION,
         porque entre las dos esta el guard del 404 --
             gasto = await asyncio.to_thread(gasto_store_factory(cid).detalle, gasto_id)
             if gasto is None: raise HTTPException(status_code=404, ...)
             return gasto
         (gastos_web.py:149-152, afip_web.py:558-561);
      2. la delegacion puede no estar pegada al nombre: `to_thread(lambda: _cobros(cid).listar(...))`
         (afip_web.py:419) mete un `lambda` en medio del patron.
    Un extractor que exige la delegacion pegada al `return` no ve NINGUNO de los dos, y los reporta
    con la misma cara que un passthrough de un productor externo, que si es ilegible de verdad.
    """
    out = []
    for m in RET.finditer(cuerpo):
        out.append(_sentencia(cuerpo, m.end()))
    for vm in RET_VAR.finditer(cuerpo):
        var = vm.group(1)
        for am in re.finditer(r"^[ \t]*" + re.escape(var) + r"(?:\s*:[^=\n]+)?\s*=\s*",
                              cuerpo, re.M):
            out.append(_sentencia(cuerpo, am.end()))
    return out


def _nombres_referidos(cuerpo):
    """los nombres a los que el cuerpo delega lo que devuelve, como pares `(dueno, nombre)`.

    `dueno` es el identificador llamado antes del punto (`gasto_store_factory(cid).detalle` -> dueno
    `gasto_store_factory`), o None para una llamada suelta. Se usa para desambiguar homonimos.
    Solo producen efecto los nombres con un `def` en el backend, asi que los de biblioteca
    (`asyncio.to_thread`, `HTTPException`) se filtran solos en _defs_de.
    """
    vistos, out = [], []
    for expr in _expr_devueltas(cuerpo):
        for m in MIEMBRO.finditer(expr):
            par = (m.group(1), m.group(2))
            if par not in vistos:
                vistos.append(par)
                out.append(par)
        for m in LLAMADA.finditer(expr):
            par = (None, m.group(1).split(".")[-1])
            if par not in vistos:
                vistos.append(par)
                out.append(par)
    return out


def _defs_de(nombre, dueno, txt, otros):
    """los cuerpos de `def <nombre>` que PUEDEN ser el que compone la respuesta, resueltos en tres
    pasos, y FAIL-CLOSED cuando no se puede decidir. -> (candidatos, ambiguo).

    Por que hace falta resolver y no juntar: `def detalle` y `def _fila` existen cada uno en ~8
    modulos de `apps/copiloto`. Juntar las claves de todos no da una lista "parcial", da una lista
    CONTAMINADA con claves de otro productor: medido, `/gastos/{}` devolvia 43 claves (`telefono`,
    `condicion_iva`, `presupuesto_ref`...) y le faltaban las dos que el front si pide (`proveedor`,
    `monto_sugerido`). Y el riesgo no es solo un NO_CONCLUYENTE ruidoso: una clave ajena que coincide
    con la que el front espera produce un **OK falso**, que es el veredicto que nadie audita.

    Los tres pasos:
      1. definicion LOCAL al archivo que estamos leyendo: en Python gana, y es la resolucion
         correcta de un helper propio (`self._fila` dentro de `gasto_store.py`);
      2. un unico candidato en todo el backend: no hay nada que desambiguar;
      3. el dueno nombra su modulo: `gasto_store_factory` contiene el stem `gasto_store`. Es una
         heuristica de NOMBRE, no una resolucion real -- el factory es un parametro inyectado
         (`gastos_web.py:101`) y su wiring vive en el composition root (`serve.py`), que este
         extractor no sigue. Por eso su resultado se valida contra lectura a mano, y por eso la
         lista sigue saliendo `completa=False`.
    Si ninguno decide, se devuelve VACIO: "no medi" es honesto, "medi con claves de otro" no.
    """
    pat = re.compile(r"^([ \t]*)(?:async\s+)?def\s+" + re.escape(nombre) + r"\s*\(", re.M)
    dm = pat.search(txt)
    if dm:
        return [("<propio>", txt, _cuerpo_def(txt, dm))], False
    cands = []
    for nom, otro in (otros or {}).items():
        if otro is txt:
            continue
        dm = pat.search(otro)
        if dm:
            cands.append((nom, otro, _cuerpo_def(otro, dm)))
    if len(cands) <= 1:
        return cands, False
    if dueno:
        elegidos = [c for c in cands
                    if re.sub(r"\.py$", "", c[0].rsplit("/", 1)[-1]) in dueno]
        if len(elegidos) == 1:
            return elegidos, False
    return [], True


def _seguir(cuerpo, txt, otros, prof, vistos):
    """claves alcanzables siguiendo la delegacion, hasta `prof` saltos. -> (claves, ambiguo).

    Recursivo a proposito: los 9 `HANDLER_OPACO` medidos no eran handlers ilegibles, eran handlers
    a DOS o mas saltos (handler -> store.metodo -> self._fila -> dict). Con un solo salto el
    extractor devolvia vacio, y vacio se lee igual que "no manda nada".
    `vistos` corta ciclos y trabajo repetido; sin el, un store que se llama a si mismo cuelga.
    """
    ks, ambiguo = set(), False
    if prof <= 0:
        return ks, ambiguo
    for dueno, nombre in _nombres_referidos(cuerpo):
        cands, amb = _defs_de(nombre, dueno, txt, otros)
        ambiguo = ambiguo or amb
        for etq, src, cuer in cands:
            if (etq, nombre) in vistos:
                continue
            vistos.add((etq, nombre))
            propias = _claves_de_dicts(cuer)
            if propias:
                ks |= propias
            else:
                sub, amb2 = _seguir(cuer, src, otros, prof - 1, vistos)
                ks |= sub
                ambiguo = ambiguo or amb2
    return ks, ambiguo


def claves_handler(txt, desde, prof=4, otros=None):
    """claves que devuelve el handler que arranca en `desde`.

    -> (claves, opaco, completa, ambiguo). `opaco=True` cuando no se pudo leer NINGUNA forma.
    La regla que no se toca: una lista obtenida por indireccion sale `completa=False`, y una lista
    parcial solo puede confirmar un OK, nunca emitir una acusacion (clase NO_CONCLUYENTE). Por eso
    subir la profundidad amplia lo que el instrumento puede VER sin ampliar lo que puede ACUSAR.
    """
    fin = len(txt)
    m = OTRO_DEC.search(txt, desde + 10)
    if m:
        fin = m.start()
    cuerpo = txt[desde:fin]
    ks = _claves_de_dicts(cuerpo)
    if ks:
        # La lista es COMPLETA solo si TODOS los `return` del handler son dicts literales. Si alguno
        # delega, la respuesta puede componerse afuera y lo leido es parcial -- medido: asi escapo el
        # falso DIFIERE de /inteligencia/graficos/facturacion, cuyo `periodo` lo manda un helper
        # (inteligencia_web.py:66,79,97) fuera del rango del handler.
        total = len(re.findall(r"\breturn\b", cuerpo))
        dicts = len(re.findall(r"\breturn\s*\{", cuerpo))
        return sorted(ks), False, total == dicts, False
    ks, ambiguo = _seguir(cuerpo, txt, otros, prof, set())
    if ks:
        # Por INDIRECCION la lista es PARCIAL por construccion: el store tiene varios metodos y la
        # respuesta se compone en uno que puede no ser el que matcheo. Medido: asi salieron DOS falsos
        # DIFIERE (`mes_anterior`, que cobro_store.py:387 SI escribe; y `periodo`, que
        # inteligencia_web.py:66 SI manda).
        return sorted(ks), False, False, ambiguo
    # el `ambiguo` se propaga TAMBIEN cuando no hubo claves: opaco-por-homonimo-no-desambiguado
    # y opaco-por-productor-externo son dos causas distintas con el mismo veredicto, y solo la
    # primera se arregla desde este repo. Descartarlo aca fue un defecto que cazo el canario 4.
    return [], True, False, ambiguo


def _canario_primitivas():
    """control positivo de las PRIMITIVAS del extractor, antes de medir nada.

    Existe por dos defectos medidos, ninguno visible en el control de 3 rutas end-to-end:

    1. **la completitud siempre-verdadera.** Al escribir este script, un `\\b` del regex de
       completitud se convirtio en el caracter BACKSPACE (0x08): `\\b` es un escape valido de Python,
       asi que la conversion fue CALLADA, mientras el `\\s` del renglon siguiente, invalido, aviso con
       un SyntaxWarning y sobrevivio intacto. Con el regex roto, `total == dicts == 0` para todo
       handler => `completa=True` SIEMPRE => el instrumento recupero la capacidad de ACUSAR en falso y
       resucito el DIFIERE de /inteligencia/graficos/facturacion que §3.bis habia matado por
       construccion. Las 3 rutas de control son OK, y un OK sale igual con la completitud rota.

    2. **el homonimo que contamina.** Si un metodo existe en varios modulos y se juntan las claves de
       todos, la lista no queda parcial: queda con claves de OTRO productor, y una que coincida con la
       que el front espera produce un OK falso. El fail-closed de _defs_de es lo que lo impide, y sin
       canario nadie mide que siga activo.
    """
    lit = '@app.get("/canario")\nasync def h():\n    return {"a": 1, "b": 2}\n'
    ks, opaco, comp, _amb = claves_handler(lit, 0)
    assert ks == ["a", "b"] and not opaco and comp, \
        "canario 1: dict literal -> %r opaco=%s completa=%s" % (ks, opaco, comp)

    mix = ('@app.get("/canario")\nasync def h():\n    x = g()\n    if x:\n        return x\n'
           '    return {"a": 1}\n')
    ks, opaco, comp, _amb = claves_handler(mix, 0)
    assert ks == ["a"] and not opaco and not comp, \
        "canario 2: un return que delega deja la lista PARCIAL -> %r completa=%s" % (ks, comp)

    vacio = '@app.get("/canario")\nasync def h():\n    return await nada_que_exista(1)\n'
    ks, opaco, comp, _amb = claves_handler(vacio, 0, otros={})
    assert ks == [] and opaco and not comp, \
        "canario 3: sin forma legible -> opaco. %r opaco=%s" % (ks, opaco)

    # el fail-closed: `detalle` en dos modulos, dueno que no nombra a ninguno => no se usa NINGUNO.
    hand = ('@app.get("/canario")\nasync def h():\n'
            '    f = await asyncio.to_thread(sin_pista(cid).detalle, 1)\n    return f\n')
    dos = {"a/uno_store.py": 'class A:\n    def detalle(self, i):\n        return {"propia": 1}\n',
           "a/dos_store.py": 'class B:\n    def detalle(self, i):\n        return {"ajena": 2}\n'}
    ks, opaco, comp, amb = claves_handler(hand, 0, otros=dos)
    assert ks == [] and opaco and amb, \
        "canario 4: homonimo sin desambiguar tiene que salir VACIO y ambiguo -> %r amb=%s" % (ks, amb)
    # y con el dueno nombrando su modulo, resuelve a UNO solo (y no mezcla la ajena)
    hand2 = hand.replace("sin_pista", "uno_store_factory")
    ks, opaco, comp, amb = claves_handler(hand2, 0, otros=dos)
    assert ks == ["propia"] and not opaco and not comp, \
        "canario 5: el dueno desambigua y la lista queda PARCIAL -> %r completa=%s" % (ks, comp)


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
    _canario_primitivas()
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
            ks, opaco, completa, ambiguo = claves_handler(t, m.start(), otros=blobs)
            handlers.setdefault(key, []).append(
                {"archivo": bf, "linea": t[:m.start()].count("\n") + 1,
                 "claves": ks, "opaco": opaco, "completa": completa,
                 "ambiguo": ambiguo})

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
