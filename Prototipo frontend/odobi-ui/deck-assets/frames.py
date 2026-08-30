#!/usr/bin/env python3
"""Genera PNG del frame de telefono SOLO (sin capa de anotacion), uno por lane.

Uso:  python3 deck-assets/frames.py

Salida: deck-assets/frames/<carpeta>-laneN.png a 780x1688 (2x de 390x844).
Sirven de miniatura limpia para el arbol de producto (arbol/index.html) y como
"pantallas de prototipo": es la app sin la meta-capa de justificacion.

Los lanes que no tienen telefono (00-mapa, y los lanes comparativos de 01 y 03)
se saltean a proposito: son esquemas, no pantallas.

Mismas dos trampas que regenerar.py: marcar el lane por posicion en el string
(nunca nth-of-type, hay un div.page-head antes) y verificar que el PNG no salga
en blanco (Chrome escribe el archivo igual).
"""
import re, glob, os, subprocess, sys, tempfile, threading, functools, socket
import http.server, socketserver

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SALIDA = os.path.join(RAIZ, 'deck-assets', 'frames')
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"


def servidor(raiz):
    """Levanta un http.server efimero sobre `raiz` y devuelve (base_url, apagar).

    🔴 POR QUE NO ALCANZA file://  (aprendido rompiendo los frames el 24/08/2026)
    Desde el 19/08 los mockups NO recrean la UI: cargan el prototipo por <iframe>.
    Bajo file:// ese iframe no resuelve `../../prototipo/?ver=grabando` — Chrome se
    come el query string y termina sirviendo el LISTADO DEL DIRECTORIO del mockup.
    El PNG sale con contenido (una tabla de archivos sobre fondo negro), asi que
    pesa 87 KB y el gate de peso lo da por bueno. Por eso ademas del servidor esta
    `contenido_valido()`: un frame malo ya no es necesariamente uno liviano.
    """
    # ⚠️ NO correr dos veces en paralelo: los temporales viven en la carpeta del
    # mockup y una corrida borra los de la otra antes de que Chrome los pida — el
    # síntoma es un 404 por render y ningún PNG generado.
    with socket.socket() as s:
        s.bind(('127.0.0.1', 0)); puerto = s.getsockname()[1]
    class Callado(http.server.SimpleHTTPRequestHandler):
        # ⚠️ El silenciado tiene que ir en la CLASE. Antes se asignaba
        # `handler.log_message` sobre el functools.partial —que nunca se consulta—
        # y el log del servidor tapaba la salida del script: cuando dos corridas
        # se pisaron, los 404 quedaron enterrados entre miles de líneas de GET.
        def log_message(self, *a, **k): pass
    handler = functools.partial(Callado, directory=raiz)
    httpd = socketserver.TCPServer(('127.0.0.1', puerto), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return f'http://127.0.0.1:{puerto}', lambda: httpd.shutdown()


def contenido_valido(png):
    """True si el PNG parece una pantalla de Odobi y no un error renderizado.

    Se mide en gris con ffmpeg (PIL esta roto en esta maquina: x86_64 vs arm64).
      - media alta  -> el lienzo es crema/blanco. Un listado de directorio o una
                       pagina de error quedan casi negros (media < 60).
      - desvio > 8  -> hay contenido. Una lamina de un solo color da ~0.
    """
    if not os.path.exists(png) or os.path.getsize(png) < 12_000:
        return False, 'archivo vacio o minusculo'
    r = subprocess.run([FFMPEG, '-v', 'error', '-i', png, '-f', 'rawvideo',
                        '-pix_fmt', 'gray', '-'], capture_output=True)
    d = r.stdout
    if not d:
        return False, 'ffmpeg no pudo leerlo'
    n = len(d)
    media = sum(d) / n
    var = sum((b - media) ** 2 for b in d) / n
    desvio = var ** 0.5
    if media < 120:  return False, f'demasiado oscuro (media {media:.0f}) - probable error o listado'
    if desvio < 8:   return False, f'sin contenido (desvio {desvio:.1f})'
    return True, f'media {media:.0f} desvio {desvio:.0f}'


FFMPEG = 'ffmpeg'
ESCALA = 2
W, H = 390 * ESCALA, 844 * ESCALA

CSS = f"""
<style id="frameonly">
  html,body{{width:{W}px!important;height:{H}px!important;margin:0!important;padding:0!important;
            overflow:hidden!important;background:#FFFFFF!important}}
  body>*{{display:none!important}}
  .canvas-wrap.slide-on{{display:block!important;position:static!important;margin:0!important;
                        max-width:none!important;transform:none!important}}
  .canvas-wrap.slide-on>*{{display:none!important}}
  .canvas-wrap.slide-on .canvas{{display:block!important;position:static!important;
      background:none!important;border:none!important;box-shadow:none!important;
      width:auto!important;height:auto!important;overflow:visible!important}}
  .canvas-wrap.slide-on .canvas>*{{display:none!important}}
  /* 🔴 Defensa por CLASE, no por anidación. `\.canvas>*` alcanza sólo si la meta-capa es
     hija directa del canvas — y basta un `<svg>` de anotación que el parser no lea como
     SVG (pasa si algo previo lo sacó de foreign content) para que los `<path>` dejen de
     autocerrarse y se traguen las anotaciones que siguen: quedan anidadas en otro lado y
     el selector de hijo directo ya no las ve. Se escaparon al frame del 10 así.
     Ocultarlas por su propia clase no depende de dónde terminaron colgadas. */
  .canvas-wrap.slide-on .overlay,
  .canvas-wrap.slide-on .hand{{display:none!important}}
  .canvas-wrap.slide-on .phone{{display:flex!important;position:fixed!important;
      left:0!important;top:0!important;margin:0!important;
      transform:scale({ESCALA})!important;transform-origin:top left!important;
      border-radius:0!important;border:none!important;box-shadow:none!important}}
</style>
"""

def marcar_lane(html, n):
    viejo, nuevo = '<div class="canvas-wrap"', '<div class="canvas-wrap slide-on"'
    p = html.split(viejo)
    return viejo.join(p[:n]) + nuevo + viejo.join(p[n:])

def lanes_con_telefono(html):
    """Indices (1-based) de los canvas-wrap que contienen al menos un .phone.

    Ojo: hay frames con clase compuesta (`class="phone splash"`, `class="phone
    listen"`). Buscar la cadena exacta 'class="phone"' se los saltea en silencio
    y esos lanes quedan sin miniatura.
    """
    wraps = re.split(r'(?=<div class="canvas-wrap")', html)
    wraps = [w for w in wraps if w.startswith('<div class="canvas-wrap"')]
    return [i for i, w in enumerate(wraps, 1) if re.search(r'class="phone[ "]', w)]

# Pantallas que se renderizan DEL PROTOTIPO DIRECTO, sin pasar por un mockup.
# Son las de 12-funciones, 13-ajustes y 14-mi-dia-3v: esos mockups no tienen
# `.canvas-wrap` con un `.phone` adentro — son una grilla de iframes generada por
# JS, igual que `mapa-pantallas/`. Sacar el frame del prototipo es mas directo que
# desarmar esa grilla, y ademas es la MISMA fuente que ya usan sus iframes.
PROTOTIPO = [
    ('desktop',   ''),           # el escritorio de funciones (raiz = Mi dia)
    ('esc',       'esc'),
    ('gastos',    'gastos'),
    ('ingresos',  'ingresos'),
    ('factura',   'factura'),
    ('presu',     'presu'),
    ('clientes',  'clientes'),
    ('bi',        'bi'),
    ('ajustes',   'ajustes'),
    ('negocio',   'negocio'),
    ('afip',      'afip'),
    ('apps',      'apps'),
    ('plan',      'plan'),
    ('cuenta',    'cuenta'),
    ('apar',      'apar'),
    ('hablar',    'hablar'),
    ('tablero',   'tablero'),
    ('agenda',    'agenda'),
    ('cargando',  'cargando'),
    ('grabando',  'grabando'),
    ('bloqueado', 'bloqueado'),
    ('card',      'card'),
    ('comousar',  'comousar'),
    ('soporte',   'soporte'),
    ('feedback',  'feedback'),
]

PROTO_CSS = f"""
<style id="frameonly">
  /* 🔴 `body` del prototipo es `display:flex` centrado: sin neutralizarlo, el #app
     queda centrado en el viewport y despues se escala DESDE SU ESQUINA, asi que el
     frame sale corrido y recortado. Se pone en block y el #app se ancla en 0,0. */
  html,body{{width:{W}px!important;height:{H}px!important;margin:0!important;
            padding:0!important;overflow:hidden!important;
            display:block!important;background:#FFFFFF!important}}
  #app{{position:absolute!important;left:0!important;top:0!important;
       width:390px!important;height:844px!important;max-width:none!important;
       border:none!important;border-radius:0!important;box-shadow:none!important;
       transform:scale({ESCALA})!important;transform-origin:top left!important}}
</style>
"""


def frames_del_prototipo(base):
    """Renderiza pantallas sueltas del prototipo a 780x1688.

    Se escribe una copia temporal del prototipo con el CSS del marco inyectado —
    no se toca `prototipo/index.html`.
    """
    proto = os.path.join(RAIZ, 'prototipo', 'index.html')
    html = open(proto).read().replace('</head>', PROTO_CSS + '</head>')
    tmp = tempfile.NamedTemporaryFile('w', suffix='.html', delete=False,
                                      dir=os.path.dirname(proto))
    tmp.write(html); tmp.close()
    nombre_tmp = os.path.basename(tmp.name)
    ok, fallos = 0, []
    for nombre, ver in PROTOTIPO:
        destino = os.path.join(SALIDA, f'proto-{nombre}.png')
        url = f'{base}/prototipo/{nombre_tmp}' + (f'?ver={ver}' if ver else '')
        subprocess.run([CHROME, '--headless=new', '--disable-gpu', '--hide-scrollbars',
                        '--force-device-scale-factor=1', f'--window-size={W},{H}',
                        '--virtual-time-budget=4500', f'--screenshot={destino}', url],
                       capture_output=True)
        bien, motivo = contenido_valido(destino)
        print(f"  {'OK ' if bien else 'MAL'} frames/proto-{nombre}.png  ({motivo})")
        ok += 1 if bien else 0
        if not bien: fallos.append(f'proto-{nombre}')
    os.unlink(tmp.name)
    return ok, fallos


def main():
    os.makedirs(SALIDA, exist_ok=True)
    base, apagar = servidor(RAIZ)
    ok, fallos = 0, []
    # `--proto` rehace solo las pantallas sueltas: iterar sobre ellas sin volver a
    # renderizar los 29 lanes ahorra un par de minutos por vuelta.
    if '--proto' in sys.argv:
        print("  -- solo pantallas sueltas del prototipo:")
        ok, fallos = frames_del_prototipo(base)
        apagar()
        print(f"\n{ok} frames generados en deck-assets/frames/")
        if fallos: print("CON PROBLEMA: " + ", ".join(fallos)); sys.exit(1)
        return
    for ruta in sorted(glob.glob(os.path.join(RAIZ, 'mockups', '*', 'index.html'))):
        carpeta = os.path.basename(os.path.dirname(ruta))
        html = open(ruta).read()
        # Se sirve por http, asi que las rutas relativas ya resuelven solas.
        abs_html = html
        objetivo = lanes_con_telefono(html)
        if not objetivo:
            print(f"  -- {carpeta}: sin telefonos (esquema), se saltea")
            continue
        for n in objetivo:
            pagina = marcar_lane(abs_html, n).replace('</head>', CSS + '</head>')
            tmp = tempfile.NamedTemporaryFile('w', suffix='.html', delete=False, dir=os.path.dirname(ruta))
            tmp.write(pagina); tmp.close()
            destino = os.path.join(SALIDA, f'{carpeta}-lane{n}.png')
            subprocess.run([CHROME, '--headless=new', '--disable-gpu', '--hide-scrollbars',
                            '--force-device-scale-factor=1', f'--window-size={W},{H}',
                            '--virtual-time-budget=4500', f'--screenshot={destino}',
                            f'{base}/mockups/{carpeta}/{os.path.basename(tmp.name)}'],
                           capture_output=True)
            os.unlink(tmp.name)
            bien, motivo = contenido_valido(destino)
            print(f"  {'OK ' if bien else 'MAL'} frames/{carpeta}-lane{n}.png  ({motivo})")
            ok += 1 if bien else 0
            if not bien: fallos.append(f'{carpeta}-lane{n}')
    print("  -- pantallas sueltas del prototipo (12, 13 y 14):")
    ok_p, fallos_p = frames_del_prototipo(base)
    ok += ok_p; fallos += fallos_p
    apagar()
    print(f"\n{ok} frames generados en deck-assets/frames/")
    if fallos:
        print("CON PROBLEMA: " + ", ".join(fallos)); sys.exit(1)

if __name__ == '__main__':
    main()
