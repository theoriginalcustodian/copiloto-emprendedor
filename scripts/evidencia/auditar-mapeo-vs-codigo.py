#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Audita el MAPEO prototipo -> nativo CONTRA EL CODIGO VIVO: ¿lo que cada fila afirma sigue siendo cierto?

POR QUE EXISTE (2026-10-14). `verificar-mapeo.py` mira la FORMA del doc (universo, celdas, control
positivo de 5 filas) y `medir-mapeo-implementacion.py` mira el ESTADO de cada divergencia. Ninguno
contesta si el literal / el archivo / la ausencia que una fila AFIRMA existe hoy. El mapeo es el
instrumento con el que se juzga cada id en device: una fila rancia no da «no mide», da un
INCOHERENTE falso (o un COHERENTE falso) con cara de hallazgo de producto. Dos filas rancias
(`ingresar`: «Email»; `ingresar-error`: «despues de los botones») aparecieron TROPEZANDO con ellas,
no buscandolas — de ahi este barrido de las 54.

QUE COMPRUEBA, por fila (cada hallazgo lleva su motivo; ninguno es una adivinanza de estilo):
  RUTA     un `archivo.tsx[:N[-M]]` citado en la columna nativo/divergencia que no existe en
           apps/mobile ni packages/core (se resuelve por sufijo de ruta).
  LINEA    una linea citada que cae fuera del archivo (el archivo se acorto: ancla rancia).
  LITERAL  un texto entre comillas dobles en la columna divergencia que no esta NI en los archivos
           nativos citados NI en el prototipo. Sale rancio: el nativo cambio de copy, o el literal
           nunca existio. (Un literal que solo esta en el prototipo es correcto: es el lado proto.)
  AUSENCIA una afirmacion de ausencia («grep 0», «cero hits», «NUNCA se dibuja», «no existe»…)
           cuyo literal/identificador SI aparece hoy en el codigo nativo: alguien lo agrego y la fila
           sigue diciendo que falta.

CONVENCION DE COMILLAS (la que hace posible este gate): las comillas DOBLES de la columna divergencia
AFIRMAN («el nativo dice "X"») y se verifican. Un texto citado SIN afirmarlo —lo que el mapeo decia antes,
un placeholder, algo que no existe, un literal del lado prototipo— va entre «guillemets» y el barrido lo
ignora. Sin esta regla, la correccion de una fila rancia se lee a si misma como una afirmacion nueva.

QUE NO COMPRUEBA (declarado, no escondido): el SENTIDO de la divergencia (si «copy distinto» sigue
distinto es juicio del que mide en device) ni el numero de linea exacto de un literal.

COMO SE PRUEBA QUE MIRA (control positivo, `--canario`): se ensucia el doc EN MEMORIA de cuatro
maneras —ruta falsa, linea fuera de rango, literal inventado, ausencia de algo que existe— y se exige
que CADA una salga como hallazgo; ademas se exige que un mapeo SIN ensuciar no marque ninguna de las
cuatro sobre la fila elegida. Un barrido que devuelve «0 rancias» sin este control es indistinguible
de uno que no mira nada.

HALLAZGO METODOLOGICO (por que el control corre ANTES de confiar en el cero): la v1 de este barrido
devolvia «0 rancias» sobre `ingresar` mientras la fila ERA rancia: «Email» «vivia» como `setEmail` y como
`autoComplete="email"`, y la busqueda de subcadena lo daba por presente. Un barrido que devuelve «0 rancias»
es indistinguible de uno que no mira nada; lo que lo cazo fue el control positivo, no la revision. Por eso
`esta()` exige limite de palabra (y, para UNA sola palabra, que vaya pegada a comilla/backtick/borde JSX), y
por eso `main` corre `canario()` antes de aceptar su propio resultado — y aborta si el canario falla.

LIMITE DECLARADO — la clase de fila que este barrido NO ve: las afirmaciones POSICIONALES / ESTRUCTURALES.
`ingresar-error` decia que la alerta iba «despues de los botones»; el literal «login-alert» existe y por
eso nada marca. Hubo que medirlo en device (y=940, ENTRE la contrasena y=830 y Entrar y=1060). Lo mismo
para un orden, una jerarquia, un «a la derecha de», o un ancla `:NNN` que se corrio pero sigue cayendo
dentro del archivo. Eso es juicio de quien mide en device; este script no lo reemplaza. Una fila con
afirmacion posicional que el barrido da por sana NO esta verificada, esta no-refutada.
  MEDIDO (2026-10-15, mapeo @9a0d8354): las filas `splash` y `detalle` afirmaban ausencias estructurales («sin degrade»,
  «sin chip-p…») FALSAS y el ratchet daba 0/54: no las veia. Por eso la salida ya no deja el «0» solo: `sin_juzgar()`
  NOMBRA las filas con clausulas negativas/posicionales que el script no contrasta (hoy 45 de 54, 84 clausulas), y
  `canario()` inyecta una afirmacion estructural falsa para exigir que salga nombrada como no juzgada.
  «0 rancias detectadas» NO significa «54 filas verificadas».

RATCHET (decision de planificacion 2026-10-14, en vez de un gate binario): un guard que se pone rojo en el
caso NORMAL se desarma solo (`--no-verify`) y deja sensacion de cobertura. `--ratchet` compara contra el
PISO versionado (`mapeo-vs-codigo-piso.json`, hoy 0 filas rancias de 54):
  · una fila con hallazgo que NO esta en el piso  -> rojo, y la nombra (el numero SUBIO);
  · una fila del piso que ya no tiene hallazgo    -> rojo: bajar el piso en el mismo PR (si no, queda
    holgura y esa fila puede volver a romperse en silencio);
  · el piso nunca se sube sin escribir POR QUE en el campo `motivo_de_la_ultima_subida`: queda en el diff,
    visible y discutible; un `--no-verify` no.

Salida: tasa (filas / filas con hallazgo / hallazgos), lista con motivo. `--json` para maquina.
Exit: 0 sin rancias (o, con --ratchet, sin regresion) · 1 hay rancias / el numero subio / el canario fallo ·
2 no puedo medir (falta fuente / corpus 0 / piso ilegible).
"""
import json
import os
import re
import sys
import unicodedata
from pathlib import Path

RAIZ = Path(os.environ.get("COPILOTO_RAIZ", Path(__file__).resolve().parents[2]))
MAPEO = RAIZ / "docs" / "copiloto-emprendedor" / "2026-10-12-mapeo-prototipo-vs-nativo.md"
PROTO = RAIZ / "Prototipo frontend" / "odobi-ui" / "prototipo" / "index.html"
CODIGO_DIRS = [RAIZ / "apps" / "mobile" / "src", RAIZ / "apps" / "mobile" / "app", RAIZ / "packages" / "core" / "src"]

PISO = Path(__file__).resolve().parent / "mapeo-vs-codigo-piso.json"

AUSENCIA = re.compile(
    r"grep (?:de )?[\"`]?[^;.)]{0,40}?0\b|cero (?:hits|consumidores|usos)|nunca se dibuja|no (?:existe|tiene|hay|esta)\b"
    r"|sin (?:chip|rotulo|grip|boton|enlace|icono|nota|subtitulo)|\bfalta\b",
    re.IGNORECASE,
)
# Mas estricto para el control AUSENCIA: solo las frases que afirman un conteo cero literal.
AUSENCIA_DURA = re.compile(r"grep [^;.)]{0,60}?\b0\b|cero hits|cero consumidores|NUNCA se dibuja|\bgrep 0\b", re.IGNORECASE)


def morir(msg, codigo=2):
    print("ABORTA: %s" % msg, file=sys.stderr)
    sys.exit(codigo)


def norm(s: str) -> str:
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    s = s.replace("¿", "").replace("¡", "").replace("…", "...").replace("“", '"').replace("”", '"')
    return re.sub(r"\s+", " ", s).lower().strip()


def norm_cs(s: str) -> str:
    """Como `norm` pero CONSERVANDO mayusculas: «Email» (texto visible) != `"email"` (valor de un prop)."""
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    s = s.replace("¿", "").replace("¡", "").replace("…", "...").replace("“", '"').replace("”", '"')
    return re.sub(r"\s+", " ", s).strip()


def leer(p: Path) -> str:
    return p.read_text(encoding="utf-8", errors="replace")


def esta(frag: str, texto_norm: str, texto_cs: str = "", frag_original: str = "") -> bool:
    """¿`frag` (ya normalizado) vive en `texto_norm` como cadena y no como pedazo de un identificador?

    Limites de palabra siempre. Si es UNA sola palabra, ademas tiene que ir pegada a una comilla,
    a un backtick o a un borde JSX (`>`/`<`): «Email» no puede darse por viva porque exista
    `setEmail` o `emailInicial` (medido: era exactamente el falso verde de la fila `ingresar`).
    """
    f = re.escape(frag)
    if " " in frag:
        return re.search(r"(?<![\w])" + f + r"(?![\w])", texto_norm) is not None
    if texto_cs and frag_original:  # una palabra: misma capitalizacion que cita el doc (texto visible vs valor de prop)
        return re.search(r"[\"'`>]\s*" + re.escape(norm_cs(frag_original)) + r"\s*[\"'`<{]", texto_cs) is not None
    return re.search(r"[\"'`>]\s*" + f + r"\s*[\"'`<{]", texto_norm) is not None


def indexar_codigo():
    """{ruta_posix_relativa_a_RAIZ: (texto_normalizado, n_lineas)} sobre codigo de PRODUCTO.

    Los tests SE INDEXAN (para que una cita a `X.test.tsx` resuelva) pero con texto vacio: un literal
    que solo vive en un test no acredita que el producto lo muestre.
    """
    out = {}
    for d in CODIGO_DIRS:
        if not d.exists():
            continue
        for p in d.rglob("*"):
            if not p.is_file() or p.suffix not in (".ts", ".tsx") or "node_modules" in p.parts:
                continue
            t = leer(p)
            es_test = ".test." in p.name or "__tests__" in p.parts
            # una frase de comentario partida en dos lineas (` * ` / `// `) se une para poder buscarla
            plano = re.sub(r"\n[ \t]*(?:/\*+|\*+/?|//+)[ \t]?", " ", t)
            out[p.relative_to(RAIZ).as_posix()] = (
                "" if es_test else norm(plano), t.count("\n") + 1, "" if es_test else norm_cs(plano))
    return out


def parsear_filas(texto: str):
    filas = []
    for l in texto.splitlines():
        if not l.startswith("| `"):
            continue
        celdas = [c.strip() for c in l.strip().strip("|").split(" | ")]
        if len(celdas) < 4:
            # la divergencia puede contener " | " — se une el resto
            celdas = [c.strip() for c in l.strip().strip("|").split("|")]
        if len(celdas) < 4:
            continue
        idf = celdas[0].strip("`")
        filas.append({"id": idf, "proto": celdas[1], "nativo": celdas[2], "div": " | ".join(celdas[3:])})
    return filas


RE_RUTA = re.compile(r"((?:[\w.-]+/)*[\w.-]+\.tsx?)(?::(\d+)(?:-(\d+))?)?")


def resolver(ruta: str, idx):
    r = ruta.lstrip("./")
    return [k for k in idx if k == r or k.endswith("/" + r)]


def citas(fila, idx):
    """Rutas citadas en nativo + divergencia: [(ruta, n1, n2, [resueltas])]."""
    out, vistos = [], set()
    for campo in ("nativo", "div"):
        # se corta antes de «(» de comentario? no: una cita dentro de parentesis tambien cuenta
        for m in RE_RUTA.finditer(fila[campo]):
            ruta = m.group(1)
            if "Prototipo" in ruta or ruta.startswith("index"):
                continue
            n1 = int(m.group(2)) if m.group(2) else None
            n2 = int(m.group(3)) if m.group(3) else n1
            clave = (ruta, n1, n2)
            if clave in vistos:
                continue
            vistos.add(clave)
            out.append((ruta, n1, n2, resolver(ruta, idx)))
    return out


_RUIDO = re.compile(r"[$<>{}|]|->|vs|nativo|prototipo|proto", re.IGNORECASE)


def literales(div: str):
    """Textos entre comillas dobles de la divergencia, ya filtrados y partidos en fragmentos.

    Un «literal» con placeholders (`$X`, `{label}`), un par de comillas mal apareado (empieza o
    termina en espacio, o contiene « vs »/«nativo») o con elipsis/separadores NO es una cadena
    que viva tal cual en el codigo: se parte en fragmentos (` / `, ` · `, `…`) y se juzga cada uno.
    Un literal compuesto esta VIVO si CUALQUIER fragmento de >=6 caracteres lo esta; solo se acusa
    cuando NINGUNO aparece (si no, se castiga el formato del doc y no la rancidez).
    """
    out = []
    for clausula in re.split(r"[;]|\.\s", div):
        for m in re.finditer(r'"([^"]{3,120})"', clausula):
            lit = m.group(1)
            if lit != lit.strip() or _RUIDO.search(lit):
                continue
            frags = [f.strip(" .:,") for f in re.split(r"\s?/\s?|\s·\s|…|\.\.\.", lit)]
            frags = [f for f in frags if len(f) >= 4]
            if frags:
                # `"X" (:159)` / `"X" (Archivo.tsx:159)`: ancla a una linea NATIVA (<1000) => el literal es del
                # lado nativo y solo vale si el codigo nativo lo tiene; sin ancla, puede ser del lado prototipo.
                cola = clausula[m.end(): m.end() + 40]
                ancla = re.match(r"\s*\((?:[\w./-]+)?:(\d+)", cola)
                out.append((lit, frags, bool(ancla and int(ancla.group(1)) < 1000)))
    return out


def ids_ausencia(div: str):
    """Literales/identificadores que una clausula DURA afirma ausentes (conteo cero / nunca se dibuja)."""
    out = []
    for clausula in re.split(r"[;]|\.\s", div):
        for dura in AUSENCIA_DURA.finditer(clausula):
            a, b = dura.span()
            # el item citado MAS CERCANO a la frase (antes o despues), a <=60 caracteres
            mejores = []
            for m in re.finditer(r'"([^"]{4,90})"|`([A-Za-z_][\w.-]{3,60})`', clausula):
                d = min(abs(m.start() - b), abs(m.end() - a))
                if d <= 60:
                    mejores.append((d, m.group(1) or m.group(2)))
            if mejores:
                out.append(min(mejores)[1])
            else:
                g = re.search(r'grep ["`]?([^"`\s;.)]{4,40})', clausula[a:])
                if g:
                    out.append(g.group(1))
    return [x for x in dict.fromkeys(out) if len(x) >= 5 and not _RUIDO.search(x)]


def _sin_comentarios(t: str) -> str:
    """Quita `/* … */` (incluido `{/* … */}` de JSX) y `// …` conservando los saltos de linea."""
    t = re.sub(r"/\*.*?\*/", lambda m: "\n" * m.group(0).count("\n"), t, flags=re.DOTALL)
    return re.sub(r"(?<![:\w])//[^\n]*", "", t)


def proto_rangos(f, proto_lineas):
    """Texto normalizado de las lineas de index.html que la fila cita (rangos y anclas, ±6)."""
    nums = []
    for campo in (f["proto"], f["div"]):
        for m in re.finditer(r"index\.html:(\d{3,4})(?:-(\d{3,4}))?", campo):
            nums.append((int(m.group(1)), int(m.group(2) or m.group(1))))
        for m in re.finditer(r"(?<![\w/])[:](\d{3,4})(?:-(\d{3,4}))?", f["proto"]):
            nums.append((int(m.group(1)), int(m.group(2) or m.group(1))))
    if not nums:
        return ""
    trozos = []
    for a, b in nums:
        if 1 <= a <= len(proto_lineas):
            trozos.append(" ".join(proto_lineas[max(0, a - 7): min(len(proto_lineas), b + 6)]))
    return " ".join(trozos)


def auditar(filas, idx, proto_n: str, proto_lineas=None):
    proto_lineas = proto_lineas or []
    res = []
    for f in filas:
        hall = []
        cs = citas(f, idx)
        archivos = set()
        for ruta, n1, n2, resueltas in cs:
            if not resueltas:
                hall.append(("RUTA", f"{ruta} no existe en apps/mobile ni packages/core"))
                continue
            archivos.update(resueltas)
            if n1 is not None and all(idx[k][1] < n1 for k in resueltas):
                hall.append(("LINEA", f"{ruta}:{n1} cae fuera del archivo ({max(idx[k][1] for k in resueltas)} lineas)"))
        # alcance NATIVO = archivos citados + hermanos de su directorio (el copy suele vivir al lado)
        dirs = {k.rsplit("/", 1)[0] for k in archivos}
        cercanos = {k for k in idx if k.rsplit("/", 1)[0] in dirs}
        nativo_n = " ".join(idx[k][0] for k in archivos | cercanos)
        nativo_cs = " ".join(idx[k][2] for k in archivos | cercanos)
        core_n = " ".join(v[0] for k, v in idx.items() if k.startswith("packages/core/"))
        core_cs = " ".join(v[2] for k, v in idx.items() if k.startswith("packages/core/"))
        # alcance PROTO = los rangos de index.html que la fila cita (±6 lineas); sin rangos, todo el archivo
        proto_scope = proto_rangos(f, proto_lineas) or proto_n
        if archivos:
            for lit, frags, es_nativo in literales(f["div"]):
                en_nativo = any(esta(norm(fr), nativo_n, nativo_cs, fr) or esta(norm(fr), core_n, core_cs, fr) for fr in frags)
                # lado prototipo: sus lineas citadas y, si no, cualquier parte de index.html (la fila a veces
                # cita el literal de otra pantalla del proto). Un literal ANCLADO al nativo no usa este cupo.
                en_proto = (not es_nativo) and any(esta(norm(fr), proto_scope) or esta(norm(fr), proto_n) for fr in frags)
                vivo = en_nativo or en_proto
                if not vivo:
                    hall.append(("LITERAL", f'"{lit}" no esta en los archivos nativos citados (ni vecinos ni core) ni en las lineas del prototipo que la fila cita'))
        # ausencias duras: SI aparece hoy en un archivo CITADO (con linea de evidencia), la fila miente
        for ident in ids_ausencia(f["div"]):
            ni = norm(ident)
            for k in sorted(archivos):
                if ni not in idx[k][0]:
                    continue
                # Solo cuenta CODIGO que se pinta: una mencion en un comentario («NO se porta», una
                # enmienda fundada) es la ausencia declarada, no una presencia. Se busca sin comentarios.
                vivo_k = _sin_comentarios(leer(RAIZ / k))
                if ni in norm(vivo_k):
                    ln = next((i + 1 for i, l in enumerate(vivo_k.splitlines()) if ni in norm(l)), "?")
                    hall.append(("AUSENCIA", f'la fila afirma ausente «{ident}» y aparece en codigo (no comentario) {k}:~{ln}'))
                    break
        res.append({"id": f["id"], "citas": len(cs), "archivos": sorted(archivos), "hallazgos": hall})
    return res


_GUILLEMETS = re.compile(r"«[^»]*»")
# Afirmaciones que este script NO sabe contrastar contra el codigo: una negacion sin identificador
# («sin degrade», «no existe tablero aparte») o una posicion («despues de», «a la derecha de»).
_NEGATIVA = re.compile(
    r"\bsin\b|\bno (?:hay|existe|tiene|lleva|aparece|muestra|se dibuja|se pinta|esta)\b|\bnunca\b|\bausente\b|\bfalta\b|\bcero\b")
_POSICIONAL = re.compile(
    r"\b(?:despues de|antes de|debajo|arriba|abajo|encima|a la (?:derecha|izquierda)|entre (?:la|el|los|las)|bajo el pliegue)\b")


def sin_juzgar(div: str):
    """Clausulas de la divergencia que AFIRMAN algo estructural y que `auditar` no contrasta: [(tipo, clausula)].

    Cero-que-no-miro y cero-que-miro-y-no-encontro son el mismo numero y dos cosas distintas: esto separa la
    segunda de la primera. Una negacion queda JUZGADA solo si `ids_ausencia` le saca un identificador (es decir,
    la frase dura «grep 0 / cero hits / NUNCA se dibuja» + un item citado, que `auditar` si busca en el codigo).
    Una cita entre comillas NO la juzga: `LITERAL` verifica que el texto exista, no que la negacion sea cierta.
    Lo que va entre «guillemets» es texto citado SIN afirmar (convencion del doc) y se ignora.
    Es un ORDEN DE MAGNITUD, no una cota: sobrecuenta negaciones inocuas («sin ella solo queda la fila…») y no ve
    las afirmaciones estructurales AFIRMATIVAS («las acciones son swipe»). Sirve para lo que importa: que el «0»
    de arriba no se lea como «54 filas verificadas»."""
    out = []
    for clausula in re.split(r"[;]|\.\s", _GUILLEMETS.sub(" ", div)):
        n = norm(clausula)
        tipo = "NEGACION" if _NEGATIVA.search(n) else ("POSICION" if _POSICIONAL.search(n) else None)
        if tipo is None or ids_ausencia(clausula):
            continue
        out.append((tipo, clausula.strip()))
    return out


def evaluar_piso(con_hallazgo: set, piso: set):
    """(suben, bajaron). `suben`: filas con hallazgo que el piso NO acepta. `bajaron`: filas aceptadas que
    ya no tienen hallazgo (el piso tiene holgura y hay que bajarlo). Pura: no toca disco."""
    return sorted(con_hallazgo - piso), sorted(piso - con_hallazgo)


def leer_piso() -> set:
    try:
        d = json.loads(PISO.read_text(encoding="utf-8"))
        ids = d["rancias_aceptadas"]
        if not isinstance(ids, list) or not all(isinstance(i, str) for i in ids):
            raise ValueError("rancias_aceptadas debe ser lista de ids")
        return set(ids)
    except (OSError, ValueError, KeyError) as e:
        morir(f"piso ilegible ({PISO}): {e}")


def canario(filas, idx, proto_n, proto_lineas=None) -> list[str]:
    """Devuelve la lista de controles que FALLARON (vacia = el barrido mira)."""
    fallos = []
    base = next((f for f in filas if f["id"] == "chat"), None) or filas[0]
    limpia = auditar([base], idx, proto_n, proto_lineas)[0]["hallazgos"]
    ruta_ok = next((c for c in citas(base, idx) if c[3]), None)
    if ruta_ok is None:
        return ["canario: la fila base no cita ninguna ruta resoluble (elegir otra)"]
    nombre = ruta_ok[0].split("/")[-1]
    casos = {
        "RUTA": dict(base, nativo=base["nativo"] + " + modules/chat/ArchivoQueNoExisteNunca.tsx:10"),
        "LINEA": dict(base, nativo=base["nativo"] + f" + {nombre}:999999"),
        "LITERAL": dict(base, div=base["div"] + ' ; copy "zzqx frase inventada que no existe"'),
        "AUSENCIA": dict(base, div=base["div"] + f' ; sin consumidores: `{Path(nombre).stem}` (grep 0)'),
    }
    for tipo, fila in casos.items():
        h = [t for t, _ in auditar([fila], idx, proto_n, proto_lineas)[0]["hallazgos"]]
        if tipo not in h:
            fallos.append(f"el canario {tipo} NO fue detectado (hallazgos: {h or 'ninguno'})")
    # SIN JUZGAR: una afirmacion estructural FALSA e inyectada a proposito tiene que salir NOMBRADA como no
    # juzgada (el barrido no puede refutarla, pero no puede dejarla pasar como «limpia»); una juzgada
    # (identificador + «grep 0») y una citada entre «guillemets» NO tienen que sumar.
    n0 = len(sin_juzgar(base["div"]))
    for tipo, extra, delta in (
        ("NEGACION", ' ; sin degrade ni rebote en el titulo', 1),
        ("POSICION", ' ; la alerta va despues de los botones', 1),
        ("juzgada-no-suma", f' ; sin consumidores: `{Path(nombre).stem}` (grep 0)', 0),
        ("guillemets-no-suma", ' ; «sin degrade ni rebote» era lo que decia la fila', 0),
    ):
        n = len(sin_juzgar(base["div"] + extra))
        if n - n0 != delta:
            fallos.append(f"sin_juzgar {tipo}: la fila ensuciada suma {n - n0} clausula(s) sin juzgar, esperado {delta}")
    # control positivo del RATCHET: sube -> acusa; baja -> acusa; igual -> calla
    if evaluar_piso({"zz"}, set()) != (["zz"], []):
        fallos.append("ratchet: una fila rancia fuera del piso NO se acuso como regresion")
    if evaluar_piso(set(), {"zz"}) != ([], ["zz"]):
        fallos.append("ratchet: una fila del piso ya sana NO se acuso como holgura")
    if evaluar_piso({"zz"}, {"zz"}) != ([], []):
        fallos.append("ratchet: una fila rancia ya aceptada marca rojo (grita en el caso normal)")
    # control negativo: la fila base sin ensuciar no puede marcar los tipos que inyectamos
    espurios = [t for t, _ in limpia if t in ("RUTA", "LINEA", "AUSENCIA")]
    if espurios:
        fallos.append(f"la fila base `{base['id']}` marca {espurios} sin haberla ensuciado: falso positivo")
    return fallos


def main(argv):
    as_json = "--json" in argv
    if not MAPEO.exists() or not PROTO.exists():
        morir(f"falta una fuente: {MAPEO} / {PROTO}")
    filas = parsear_filas(leer(MAPEO))
    idx = indexar_codigo()
    if len(filas) < 54 or len(idx) < 50:
        morir(f"corpus sospechosamente chico: {len(filas)} filas, {len(idx)} archivos de codigo (esperado 54 / 100+)")
    proto_txt = leer(PROTO)
    proto_n = norm(proto_txt)
    proto_lineas = [norm(l) for l in proto_txt.splitlines()]
    if "--canario" in argv:
        f = canario(filas, idx, proto_n, proto_lineas)
        for x in f:
            print("CANARIO ❌", x)
        if not f:
            print("CANARIO ✅ RUTA, LINEA, LITERAL y AUSENCIA detectados sobre una fila ensuciada; la fila limpia no marca; "
                  "una negacion/posicion inyectada sale NOMBRADA como sin juzgar (y una juzgada o entre «guillemets» no suma)")
        return 1 if f else 0
    # el control positivo corre SIEMPRE antes de confiar en el «0 rancias»
    ctl = canario(filas, idx, proto_n, proto_lineas)
    if ctl:
        for x in ctl:
            print("CONTROL POSITIVO ❌", x, file=sys.stderr)
        morir("el barrido no pasa su propio control positivo: su «0 rancias» no se puede citar", 1)
    res = auditar(filas, idx, proto_n, proto_lineas)
    con = [r for r in res if r["hallazgos"]]
    total = sum(len(r["hallazgos"]) for r in res)
    ciegas = {f["id"]: sin_juzgar(f["div"]) for f in filas}
    ciegas = {i: c for i, c in ciegas.items() if c}
    n_clausulas = sum(len(c) for c in ciegas.values())
    if as_json:
        print(json.dumps({"filas": len(res), "con_hallazgo": len(con), "hallazgos": total, "detalle": con,
                          "sin_juzgar": {"filas": len(ciegas), "clausulas": n_clausulas,
                                         "detalle": {i: [{"tipo": t, "clausula": c} for t, c in cl] for i, cl in ciegas.items()}}},
                         ensure_ascii=False, indent=1))
    else:
        sin_cita = [r["id"] for r in res if r["citas"] == 0]
        print(f"filas: {len(res)} · con citas resolubles: {sum(1 for r in res if r['archivos'])} · sin cita a codigo: {len(sin_cita)} {sin_cita}")
        print(f"TASA: {len(con)} filas con hallazgo de {len(res)} · {total} hallazgos")
        for r in con:
            for tipo, motivo in r["hallazgos"]:
                print(f"  [{tipo}] {r['id']}: {motivo}")
        print("control positivo: OK (RUTA/LINEA/LITERAL/AUSENCIA detectan sobre fila ensuciada)")
        # el «0» de arriba mira SOLO rutas, lineas, literales e identificadores: esto es lo que NO mira
        print(f"SIN JUZGAR: {len(ciegas)} de {len(res)} filas llevan {n_clausulas} clausula(s) negativa(s)/posicional(es) "
              f"que este barrido NO contrasta con el codigo — el «{len(con)} con hallazgo» NO las cubre (orden de magnitud, ver sin_juzgar())")
        if "--sin-juzgar" in argv:
            for i, cl in ciegas.items():
                for t, c in cl:
                    print(f"  [{t}] {i}: {c[:140]}")
        else:
            print(f"  filas: {sorted(ciegas)}  (--sin-juzgar para ver cada clausula)")
    if "--ratchet" in argv:
        suben, bajaron = evaluar_piso({r["id"] for r in con}, leer_piso())
        for i in suben:
            for tipo, motivo in next(r for r in con if r["id"] == i)["hallazgos"]:
                print(f"  ❌ [{tipo}] {i}: {motivo}")
        for i in bajaron:
            print(f"  ❌ `{i}` esta en el piso pero ya no tiene hallazgo: bajalo de rancias_aceptadas en {PISO.name}")
        if suben:
            print(f"RATCHET ❌ el numero SUBIO: {len(suben)} fila(s) rancia(s) nueva(s) {suben}. "
                  f"Corregi la fila (con su sha de verificacion) — subir el piso exige escribir por que.")
        if bajaron and not suben:
            print("RATCHET ❌ el piso tiene holgura: bajalo en este mismo PR.")
        if not suben and not bajaron:
            print(f"RATCHET ✅ {len(con)} filas rancias DETECTADAS de {len(res)} (piso {len(leer_piso())}): no empeoro. "
                  f"NO es «{len(res)} filas verificadas»: {len(ciegas)} llevan afirmaciones que este barrido no juzga")
        return 1 if (suben or bajaron) else 0
    return 1 if con else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
