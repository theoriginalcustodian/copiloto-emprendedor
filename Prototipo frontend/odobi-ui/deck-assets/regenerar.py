#!/usr/bin/env python3
"""Regenera los PNG 2560x1440 del deck, uno por lane, desde los mockups.

Uso:  python3 deck-assets/regenerar.py          (desde cualquier lado)

Por cada mockups/*/index.html y por cada .canvas-wrap adentro genera
deck-assets/<carpeta>-laneN.png, mostrando SOLO ese lane, escalado para entrar
en 2560x1440 con margen.

DOS TRAMPAS, las dos aprendidas rompiendo los 27 PNG el 07/08/2026:

1. NO usar `.canvas-wrap:nth-of-type(N)` para elegir el lane. `nth-of-type`
   cuenta entre hermanos del mismo TAG, y `<body>` abre con un `div.page-head`
   antes de los wraps: el indice se corre uno y el lane 1 no matchea nada ->
   slide en blanco. Se marca el wrap por posicion en el string y listo.

2. NO dar por bueno un PNG porque el archivo existe. Chrome escribe el archivo
   igual aunque la pagina renderice vacia. Por eso al final se verifica que la
   imagen tenga contenido real (mas de un color y varianza suficiente).
"""
import re, glob, os, subprocess, sys, tempfile

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SALIDA = os.path.join(RAIZ, 'deck-assets')
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
W, H = 2560, 1440

CSS = """
<style id="slide">
  html,body{{width:{W}px!important;height:{H}px!important;overflow:hidden!important;
            margin:0!important;padding:0!important;background:#F2EEE7!important}}
  body>*{{display:none!important}}
  .canvas-wrap.slide-on{{
      display:flex!important;position:fixed!important;left:50%!important;top:50%!important;
      margin:0!important;transform:translate(-50%,-50%) scale({k})!important;
      transform-origin:center center!important}}
</style>
"""

def marcar_lane(html, n):
    """Marca con .slide-on el n-esimo <div class="canvas-wrap"> (1-based)."""
    viejo, nuevo = '<div class="canvas-wrap"', '<div class="canvas-wrap slide-on"'
    partes = html.split(viejo)
    if n >= len(partes):
        raise IndexError(f'lane {n} inexistente (hay {len(partes)-1})')
    return viejo.join(partes[:n]) + nuevo + viejo.join(partes[n:])

def alto_canvas(html, n):
    wraps = re.findall(r'<div class="canvas-wrap".*?(?=<div class="canvas-wrap"|</body>)', html, re.S)
    m = re.search(r'class="canvas"[^>]*style="[^"]*height:\s*(\d+)', wraps[n-1]) if n-1 < len(wraps) else None
    return int(m.group(1)) if m else 900

def tiene_contenido(png):
    """True si el PNG no es una lamina plana. Devuelve (ok, n_colores)."""
    try:
        from PIL import Image
    except ImportError:
        return (os.path.getsize(png) > 60_000, -1)
    with Image.open(png) as im:
        chico = im.convert('RGB').resize((160, 90))
        colores = len(set(chico.getdata()))
    return (colores >= 12, colores)

def main():
    if not os.path.exists(CHROME):
        sys.exit(f"No esta Chrome en {CHROME}")
    ok_total, fallos = 0, []
    for ruta in sorted(glob.glob(os.path.join(RAIZ, 'mockups', '*', 'index.html'))):
        carpeta = os.path.basename(os.path.dirname(ruta))
        html = open(ruta).read()
        n_lanes = html.count('<div class="canvas-wrap"')
        # rutas relativas -> absolutas: la pagina temporal se escribe en la misma
        # carpeta del mockup, pero dejarlo explicito evita sorpresas si eso cambia
        abs_html = re.sub(r'(url\(["\']?)\.\./\.\./', r'\1file://' + RAIZ + '/', html)
        for n in range(1, n_lanes + 1):
            alto = alto_canvas(html, n)
            k = min((W - 120) / 960.0, (H - 120) / (alto + 110.0))
            pagina = marcar_lane(abs_html, n).replace('</head>', CSS.format(W=W, H=H, k=round(k, 4)) + '</head>')
            tmp = tempfile.NamedTemporaryFile('w', suffix='.html', delete=False, dir=os.path.dirname(ruta))
            tmp.write(pagina); tmp.close()
            destino = os.path.join(SALIDA, f'{carpeta}-lane{n}.png')
            subprocess.run([CHROME, '--headless=new', '--disable-gpu', '--hide-scrollbars',
                            '--force-device-scale-factor=1', f'--window-size={W},{H}',
                            '--virtual-time-budget=3000', f'--screenshot={destino}',
                            'file://' + tmp.name], capture_output=True)
            os.unlink(tmp.name)
            if not os.path.exists(destino):
                fallos.append((f'{carpeta}-lane{n}', 'Chrome no escribio el archivo')); continue
            ok, colores = tiene_contenido(destino)
            print(f"  {'OK ' if ok else 'VACIO'} {carpeta}-lane{n}.png  "
                  f"(canvas {alto}px, escala {k:.3f}, {colores} colores)")
            ok_total += 1 if ok else 0
            if not ok:
                fallos.append((f'{carpeta}-lane{n}', f'lamina plana, {colores} colores'))
    print(f"\n{ok_total} PNG con contenido verificado.")
    if fallos:
        print(f"{len(fallos)} CON PROBLEMA:")
        for nombre, motivo in fallos:
            print(f"  - {nombre}: {motivo}")
        sys.exit(1)

if __name__ == '__main__':
    main()
