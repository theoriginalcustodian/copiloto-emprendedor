#!/usr/bin/env python3
"""Genera los insumos que `construir-artifact.py` necesita, desde los mockups.

Uso:  python3 deck-assets/preparar-artifact.py

Sale (todo dentro del repo, en `deck-assets/_artifact/`):
  - `notas.json`  — por mockup y lane: el rótulo, la bajada y las anotaciones
  - `f1/`         — los frames de teléfono reducidos (menos peso para el data-URI)
  - `mapa/`       — los 4 esquemas del 00-mapa, que no son pantallas de teléfono

🔴 **Por qué existe.** `construir-artifact.py` leía estos tres insumos de un
scratchpad de sesión (`/private/tmp/claude-501/.../scratchpad`). Esa carpeta muere
con la sesión: el 16/08 el artefacto autocontenido quedó **no regenerable**, con la
única copia existente ya desactualizada (frames viejos, con una tabbar que los
mockups ya no tienen). La dependencia ahora vive en el repo y se reconstruye sola.

Se apoya en `frames.py`, que ya sabe renderizar un lane sin la capa de anotación:
acá sólo se reducen esos PNG, no se vuelve a renderizar el teléfono.
"""
import json
import os
import re
import subprocess
import sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MOCKUPS = os.path.join(RAIZ, 'mockups')
FRAMES_FULL = os.path.join(RAIZ, 'deck-assets', 'frames')
SALIDA = os.path.join(RAIZ, 'deck-assets', '_artifact')
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
ANCHO_REDUCIDO = 460          # el panel del artifact nunca muestra el frame a más de ~430 px


def _texto_plano(html):
    """El texto visible de una anotación: sin etiquetas, sin entidades, sin dobles espacios."""
    t = re.sub(r'<[^>]+>', '', html)
    for a, b in (('&lt;', '<'), ('&gt;', '>'), ('&amp;', '&'), ('&nbsp;', ' '),
                 ('&Delta;', 'Δ'), ('&rarr;', '→'), ('&larr;', '←'), ('&times;', '×')):
        t = t.replace(a, b)
    return re.sub(r'\s+', ' ', t).strip()


def notas_de(mockup_html):
    """Devuelve una lista por lane: {tag, sub, notas:[{t, k}]}.

    Se recorre el HTML por POSICIÓN, no con selectores: cada `canvas-wrap` abre un
    lane y todo lo que aparece hasta el siguiente le pertenece. Es la misma cautela
    que `frames.py` y `regenerar.py` — un `nth-of-type` acá se corre de índice.
    """
    lanes = []
    trozos = mockup_html.split('<div class="canvas-wrap"')[1:]
    for tr in trozos:
        tag = re.search(r'<span class="lane-tag">(.*?)</span>', tr, re.S)
        sub = re.search(r'<p class="lane-sub">(.*?)</p>', tr, re.S)
        notas = []
        for m in re.finditer(r'<div class="hand([^"]*)"[^>]*>(.*?)</div>', tr, re.S):
            clase = m.group(1).strip()
            k = 'accent' if 'accent' in clase else ('dim' if 'dim' in clase else '')
            t = _texto_plano(m.group(2))
            if t:
                notas.append({'t': t, 'k': k})
        lanes.append({
            'tag': _texto_plano(tag.group(1)) if tag else '',
            'sub': _texto_plano(sub.group(1)) if sub else '',
            'notas': notas,
        })
    return lanes


def reducir(origen, destino, ancho=ANCHO_REDUCIDO):
    subprocess.run(['ffmpeg', '-v', 'error', '-i', origen,
                    '-vf', f'scale={ancho}:-1', '-y', destino], check=True)


def esquemas_del_mapa():
    """Los lanes del 00-mapa no tienen teléfono: son esquemas. Se renderiza el canvas."""
    destino = os.path.join(SALIDA, 'mapa')
    os.makedirs(destino, exist_ok=True)
    ruta = os.path.join(MOCKUPS, '00-mapa', 'index.html')
    html = open(ruta, encoding='utf-8').read()
    n = html.count('<div class="canvas-wrap"')
    for i in range(1, n + 1):
        css = f'''<style>
          body>*{{display:none!important}} body{{padding:0!important;background:#fff!important}}
          .canvas-wrap:nth-of-type({i}){{}}
        </style>'''
        # Se marca el lane por POSICIÓN en el string (nunca nth-of-type: hay un
        # div.page-head antes y el índice se corre) — misma trampa que frames.py.
        partes = html.split('<div class="canvas-wrap"')
        marcado = partes[0]
        for j, p in enumerate(partes[1:], start=1):
            marcado += ('<div class="canvas-wrap slide-on"' if j == i else '<div class="canvas-wrap"') + p
        marcado = marcado.replace('</head>', f'''<style>
          html,body{{margin:0!important;padding:0!important;background:#FFFFFF!important}}
          body>*{{display:none!important}}
          .canvas-wrap.slide-on{{display:block!important;margin:0!important;max-width:none!important}}
          .canvas-wrap.slide-on>*:not(.canvas){{display:none!important}}
          .canvas-wrap.slide-on .canvas{{border:none!important;border-radius:0!important;box-shadow:none!important}}
        </style></head>''')
        tmp = os.path.join(SALIDA, f'_mapa{i}.html')
        open(tmp, 'w', encoding='utf-8').write(marcado)
        out = os.path.join(destino, f'00-mapa-lane{i}.png')
        subprocess.run([CHROME, '--headless', '--disable-gpu', f'--screenshot={out}',
                        '--window-size=1000,1000', '--hide-scrollbars', f'file://{tmp}'],
                       capture_output=True)
        os.remove(tmp)
        # Gate por peso: Chrome escribe el PNG aunque la página renderice vacía.
        if not os.path.exists(out) or os.path.getsize(out) < 12000:
            sys.exit(f'ERROR: {out} salió vacío o demasiado liviano')
        print(f'  OK  mapa/00-mapa-lane{i}.png ({os.path.getsize(out)//1024} KB)')


def main():
    os.makedirs(SALIDA, exist_ok=True)

    # 1) notas.json
    notas = {}
    for carpeta in sorted(os.listdir(MOCKUPS)):
        ruta = os.path.join(MOCKUPS, carpeta, 'index.html')
        if not os.path.exists(ruta):
            continue
        notas[carpeta] = notas_de(open(ruta, encoding='utf-8').read())
    destino_json = os.path.join(SALIDA, 'notas.json')
    json.dump(notas, open(destino_json, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    total = sum(len(l['notas']) for v in notas.values() for l in v)
    print(f'  OK  notas.json — {len(notas)} mockups, {total} anotaciones')
    if total < 50:
        sys.exit('ERROR: se extrajeron muy pocas anotaciones; revisar el parseo')

    # 2) frames reducidos
    destino_f1 = os.path.join(SALIDA, 'f1')
    os.makedirs(destino_f1, exist_ok=True)
    n = 0
    for f in sorted(os.listdir(FRAMES_FULL)):
        if not f.endswith('.png'):
            continue
        reducir(os.path.join(FRAMES_FULL, f), os.path.join(destino_f1, f))
        n += 1
    print(f'  OK  f1/ — {n} frames reducidos a {ANCHO_REDUCIDO}px de ancho')

    # 3) esquemas del mapa
    esquemas_del_mapa()
    print(f'\nInsumos listos en {SALIDA}. Ahora: python3 deck-assets/construir-artifact.py')


if __name__ == '__main__':
    main()
