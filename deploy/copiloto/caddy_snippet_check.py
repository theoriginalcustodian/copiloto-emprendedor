"""Diff `Caddyfile.snippet` <-> Caddyfile VIVO, en las dos direcciones, sobre HOSTS (SNIPPETMIENTE).

El snippet es la «referencia» que lee quien audita el repo. Si afirma un bloque que el vivo no tiene, o el
vivo tiene uno que el repo ni menciona, el lector concluye algo falso sin verificarlo contra el VPS
(pasó: tres sesiones dedujeron una ruta que en prod no existía). Este módulo es el instrumento:

  A) `afirmado_y_ausente`   hosts que el snippet declara como bloque y el vivo NO tiene
  B) `vivo_y_no_mencionado` hosts del vivo que el snippet no nombra en ningún lado (ni en un comentario)

Compara HOSTS, no contenido de los bloques: de qué bloques escribe el repo y cuáles no, el snippet lo dice
en las líneas `escribe:` y lo mide `bloques_sin_escribe` + `test_caddy_converge.py`.

Uso offline:  python3 caddy_snippet_check.py <Caddyfile.snippet> <cabeceras-vivas.txt | ->
Uso en vivo:  deploy/copiloto/caddy-vivo-vs-snippet.sh   (lee las cabeceras por ssh, sólo lectura)
Stdlib puro. rc=0 si A y B vacíos · rc=1 si no · rc=2 si no hay nada que medir (fail-closed).
"""
import re
import sys

BASE_POR_DEFECTO = "178-105-191-1.sslip.io"
_CABECERA = re.compile(r"^([^\s#{}][^{]*?)\s*\{\s*$")


def _hosts_de_cabecera(cabecera):
    """`a.com, b.com` -> ['a.com', 'b.com'] (un bloque de Caddy puede declarar varios hosts)."""
    return [h.strip() for h in cabecera.split(",") if h.strip()]


def hosts_declarados(snippet):
    """Hosts de los bloques top-level del snippet (columna 0, `host {`)."""
    hosts = []
    for linea in snippet.splitlines():
        m = _CABECERA.match(linea)
        if m:
            hosts += _hosts_de_cabecera(m.group(1))
    return hosts


def hosts_vivos(cabeceras):
    """Hosts de un listado de cabeceras de bloque del Caddyfile vivo (una por línea, `host {`)."""
    hosts = []
    for linea in cabeceras.splitlines():
        m = _CABECERA.match(linea.rstrip())
        if m:
            hosts += _hosts_de_cabecera(m.group(1))
    return hosts


def bloques_sin_escribe(snippet):
    """Hosts de bloque cuyo comentario contiguo NO trae `escribe:` (sin él, el bloque vuelve a ser una
    afirmación muda de que el repo lo aplica)."""
    lineas = snippet.splitlines()
    faltan = []
    for i, linea in enumerate(lineas):
        m = _CABECERA.match(linea)
        if not m:
            continue
        j, racha = i - 1, []
        while j >= 0 and lineas[j].startswith("#"):
            racha.append(lineas[j])
            j -= 1
        if not any("escribe:" in r for r in racha):
            faltan.append(m.group(1))
    return faltan


def _normalizar(snippet, base):
    """Para buscar menciones: `<base>` -> el dominio base, y un host cortado en dos líneas de comentario
    (`documed.x\\n#   .duckdns.org`) se vuelve a unir."""
    texto = snippet.replace("<base>", base)
    return re.sub(r"\n#\s+(?=\.)", "", texto)


def mencionado(host, texto):
    """El host aparece como token propio (no como sufijo de otro: la raíz `178-...sslip.io` NO se da por
    mencionada porque `mp.178-...sslip.io` la contenga)."""
    return re.search(r"(?<![\w.-])" + re.escape(host) + r"(?![\w-])", texto) is not None


def comparar(snippet, cabeceras_vivas, base=BASE_POR_DEFECTO):
    vivos = hosts_vivos(cabeceras_vivas)
    declarados = hosts_declarados(snippet)
    texto = _normalizar(snippet, base)
    afirmado_y_ausente = [h for h in declarados if h not in vivos]
    vivo_y_no_mencionado = [h for h in vivos if not mencionado(h, texto)]
    return afirmado_y_ausente, vivo_y_no_mencionado, vivos


def main(argv):
    if len(argv) < 3:
        print(__doc__, file=sys.stderr)
        return 2
    with open(argv[1], encoding="utf-8") as f:
        snippet = f.read()
    if argv[2] == "-":
        cabeceras = sys.stdin.read()
    else:
        with open(argv[2], encoding="utf-8") as f:
            cabeceras = f.read()
    a, b, vivos = comparar(snippet, cabeceras)
    if not vivos:
        print("SIN DATOS: el listado vivo no trae ningún bloque -- no hay nada que comparar (fail-closed).",
              file=sys.stderr)
        return 2
    print(f"vivo: {len(vivos)} hosts · snippet declara {len(hosts_declarados(snippet))} bloques")
    for h in a:
        print(f"A  AFIRMADO Y AUSENTE   {h}   (el snippet lo declara; el Caddyfile vivo no lo tiene)")
    for h in b:
        print(f"B  VIVO Y NO MENCIONADO {h}   (está en el Caddyfile vivo; el snippet no lo nombra)")
    if not a and not b:
        print("OK: las dos direcciones vacías")
        return 0
    return 1


if __name__ == "__main__":
    sys.exit(main(sys.argv))
