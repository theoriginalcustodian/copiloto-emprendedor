#!/usr/bin/env python3
"""Ayudante de medición en DEVICE para las recetas del bloque F (SM-F2 / SM-F3).

QUÉ ES: seis comandos sobre `adb` que convierten «tocá el botón X» en algo repetible: busca el
elemento por **testID** (en Android RN lo expone como `resource-id`) en el árbol de accesibilidad y
dispara DOWN/UP con `input motionevent` en su centro. NUNCA `input tap`: no ejercita un Gesture.Pan
de RNGH ni los botones flotantes (memoria `adb-no-puede-ejercitar-el-toque-corto-de-un-gesture-pan`).

QUÉ NO ES: no decide veredictos ni abre un segundo adb por su cuenta. El device es de dueño ÚNICO
(frontend2 hasta que declare «device LIBRE» por `dato_`): este script se corre SOLO cuando lo tenés.

Uso (ADB_SERIAL por defecto RF8T318RN9T):
  device_medir.py ver [--filtro texto]      lista testID | texto | centro (x,y) de lo visible
  device_medir.py tocar <testID>            DOWN/UP en el centro del elemento; exit 3 si no está
  device_medir.py mantener <testID> <ms>    DOWN, espera, UP (dictado: mantener el botón de voz)
  device_medir.py arrastrar <testID> <dx> <dy> [pasos]   DOWN, MOVEs, UP (fijar dictado = arriba)
  device_medir.py hay <texto|testID>        exit 0 si está visible, 1 si no (aserción de la receta)
  device_medir.py foto <archivo.png>        screencap por exec-out
  device_medir.py autotest                  control positivo OFFLINE del parser (sin adb)
"""
import os
import re
import subprocess
import sys
import time
from html import unescape

SERIAL = os.environ.get('ADB_SERIAL', 'RF8T318RN9T')
BOUNDS = re.compile(r'\[(\d+),(\d+)\]\[(\d+),(\d+)\]')
NODO = re.compile(r'<node\b([^>]*)>')
ATTR = re.compile(r'([\w-]+)="([^"]*)"')


def adb(*a, t=60, binario=False):
    r = subprocess.run(('adb', '-s', SERIAL) + a, capture_output=True, timeout=t)
    return r.returncode, r.stdout if binario else r.stdout.decode('utf-8', 'replace')


def elementos(xml):
    """(testID, texto, (cx, cy)) de cada nodo con bounds no vacío. Puro: se prueba sin device."""
    out = []
    for nodo in NODO.finditer(xml):  # regex y no un parser XML: la entrada es un dump de adb, texto plano
        a = {k: unescape(v) for k, v in ATTR.findall(nodo.group(1))}
        m = BOUNDS.fullmatch(a.get('bounds', ''))
        if not m:
            continue
        x1, y1, x2, y2 = map(int, m.groups())
        if x2 <= x1 or y2 <= y1:
            continue
        rid = a.get('resource-id', '').split('/')[-1]
        txt = a.get('text', '') or a.get('content-desc', '')
        if rid or txt:
            out.append((rid, txt, ((x1 + x2) // 2, (y1 + y2) // 2)))
    return out


def arbol():
    for _ in range(3):
        _, o = adb('exec-out', 'uiautomator', 'dump', '/dev/tty', t=40)
        if '<hierarchy' in o:
            return elementos(o)
        time.sleep(0.4)
    return []


def buscar(clave):
    """Primer elemento cuyo testID == clave o cuyo texto la contiene."""
    for rid, txt, c in arbol():
        if rid == clave or (clave and clave in txt):
            return c
    return None


def motion(accion, x, y):
    adb('shell', 'input', 'motionevent', accion, str(x), str(y), t=20)


def main(argv):
    if len(argv) < 2:
        print(__doc__)
        return 2
    cmd, args = argv[1], argv[2:]
    if cmd == 'autotest':
        xml = ('<?xml version="1.0"?><hierarchy><node resource-id="app:id/boton-voz" text="" '
               'bounds="[100,200][300,400]"/><node resource-id="" text="Por voz · 7s" '
               'bounds="[0,0][50,50]"/><node resource-id="vacio" text="" bounds="[5,5][5,5]"/></hierarchy>')
        e = elementos(xml)
        assert ('boton-voz', '', (200, 300)) in e, e
        assert ('', 'Por voz · 7s', (25, 25)) in e, e
        assert all(r != 'vacio' for r, _, _ in e), 'un nodo de área 0 no se puede tocar'
        print('autotest OK: testID, texto y descarte de bounds vacíos')
        return 0
    if cmd == 'ver':
        filtro = args[args.index('--filtro') + 1] if '--filtro' in args else ''
        for rid, txt, (x, y) in arbol():
            if filtro in rid or filtro in txt:
                print(f'{rid or "-"} | {txt} | ({x},{y})')
        return 0
    if cmd == 'foto':
        _, png = adb('exec-out', 'screencap', '-p', binario=True, t=40)
        open(args[0], 'wb').write(png)
        print(f'{args[0]} {len(png)} bytes')
        return 0 if len(png) > 10_000 else 1
    if cmd == 'hay':
        return 0 if buscar(args[0]) else 1
    c = buscar(args[0]) if args else None
    if c is None:
        print(f'no está visible: {args[0] if args else "?"}', file=sys.stderr)
        return 3
    x, y = c
    if cmd == 'tocar':
        motion('DOWN', x, y)
        time.sleep(0.08)
        motion('UP', x, y)
    elif cmd == 'mantener':
        motion('DOWN', x, y)
        time.sleep(int(args[1]) / 1000)
        motion('UP', x, y)
    elif cmd == 'arrastrar':
        dx, dy = int(args[1]), int(args[2])
        pasos = int(args[3]) if len(args) > 3 else 8
        motion('DOWN', x, y)
        for i in range(1, pasos + 1):
            motion('MOVE', x + dx * i // pasos, y + dy * i // pasos)
            time.sleep(0.03)
        motion('UP', x + dx, y + dy)
    else:
        print(f'comando desconocido: {cmd}', file=sys.stderr)
        return 2
    print(f'{cmd} {args[0]} @ ({x},{y})')
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
