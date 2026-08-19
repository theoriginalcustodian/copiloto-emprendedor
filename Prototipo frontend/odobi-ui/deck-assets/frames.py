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
import re, glob, os, subprocess, sys, tempfile

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SALIDA = os.path.join(RAIZ, 'deck-assets', 'frames')
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
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

def main():
    os.makedirs(SALIDA, exist_ok=True)
    ok, fallos = 0, []
    for ruta in sorted(glob.glob(os.path.join(RAIZ, 'mockups', '*', 'index.html'))):
        carpeta = os.path.basename(os.path.dirname(ruta))
        html = open(ruta).read()
        abs_html = re.sub(r'(url\(["\']?)\.\./\.\./', r'\1file://' + RAIZ + '/', html)
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
                            '--virtual-time-budget=3000', f'--screenshot={destino}',
                            'file://' + tmp.name], capture_output=True)
            os.unlink(tmp.name)
            peso = os.path.getsize(destino) if os.path.exists(destino) else 0
            bien = peso > 25_000          # una lamina plana de 780x1688 pesa ~8-15 KB
            print(f"  {'OK ' if bien else 'VACIO'} frames/{carpeta}-lane{n}.png  ({peso//1024} KB)")
            ok += 1 if bien else 0
            if not bien: fallos.append(f'{carpeta}-lane{n}')
    print(f"\n{ok} frames generados en deck-assets/frames/")
    if fallos:
        print("CON PROBLEMA: " + ", ".join(fallos)); sys.exit(1)

if __name__ == '__main__':
    main()
