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
  device_medir.py filmar <dir> [--seg 4] [--disparo-tocar <testID>] [--disparo-relanzar]
                            [--fps-min 50] [--sello]
        GRABA la pantalla y parte el video en un PNG por cuadro. Es el instrumento para lo que
        `foto` NO puede medir: una animacion de ~1 s no la resuelve una cadena de screencap
        (cada screencap tarda del orden del fenomeno que quiere medir). Con 60 fps reales, 1 s
        son ~60 cuadros.
        `--disparo-relanzar` mata y relanza la app DESPUES de arrancar la grabacion: es la unica
        forma de filmar una animacion de ENTRADA (splash / reveal), que solo ocurre al montar.
        Corta con exit 5 si los fps REALES no llegan a `--fps-min`: una captura a 24 fps es tan
        ciega como el screencap que vino a reemplazar, y tiene que decirlo en vez de entregar
        cuadros que parecen evidencia.
  device_medir.py autotest                  control positivo OFFLINE del parser (sin adb)
"""
import os
import re
import subprocess
import sys
import tempfile
import time
from html import unescape
from pathlib import Path

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


PAQUETE = 'app.copiloto.emprendedor'  # el OTRO paquete del telefono es documed: filmar el ajeno se ve valido
REMOTO = '/sdcard/uc-filmar.mp4'
FPS_MIN_DEFECTO = 50.0


def _opt(args, nombre, defecto):
    return args[args.index(nombre) + 1] if nombre in args else defecto


def _corr(cmd, t=180):
    r = subprocess.run(cmd, capture_output=True, timeout=t)
    return r.returncode, r.stdout.decode('utf-8', 'replace'), r.stderr.decode('utf-8', 'replace')


def fps_y_cuadros(mp4):
    """(fps, cuadros) de un mp4. CUENTA los cuadros (`-count_frames`); no los estima.

    Si el contenedor no declara `avg_frame_rate` (pasa con lo que escribe `screenrecord`), los fps
    se DERIVAN de cuadros/duracion. Derivar no es leer: por eso el que llama recibe el numero y
    decide, en vez de que esta funcion complete un default que despues se cita como medicion.
    """
    rc, out, err = _corr(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-count_frames',
                          '-show_entries', 'stream=avg_frame_rate,nb_read_frames,duration',
                          '-of', 'default=nw=1', str(mp4)])
    if rc != 0:
        raise RuntimeError('ffprobe fallo: ' + (err.strip() or 'sin stderr')[:300])
    d = dict(l.split('=', 1) for l in out.splitlines() if '=' in l)
    cuadros = int(d.get('nb_read_frames') or 0)
    num, _, den = (d.get('avg_frame_rate') or '0/0').partition('/')
    try:
        fps = float(num) / float(den) if float(den or 0) else 0.0
    except ValueError:
        fps = 0.0
    if fps <= 0:
        dur = float(d.get('duration') or 0)
        fps = cuadros / dur if dur > 0 else 0.0
    return fps, cuadros


def extraer(mp4, destino):
    """Un PNG por cuadro + el pts de cada uno en ms.

    `-vsync 0` es lo que importa: sin el, ffmpeg DUPLICA o TIRA cuadros para encajar en un fps
    fijo, y entonces los PNG dejan de ser lo que el telefono mostro.
    """
    destino.mkdir(parents=True, exist_ok=True)
    rc, _, err = _corr(['ffmpeg', '-v', 'error', '-y', '-i', str(mp4), '-vsync', '0',
                        '-f', 'image2', str(destino / 'cuadro_%05d.png')], t=600)
    if rc != 0:
        raise RuntimeError('ffmpeg fallo: ' + (err.strip() or 'sin stderr')[:300])
    rc, out, _ = _corr(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries',
                        'frame=best_effort_timestamp_time', '-of', 'csv=p=0', str(mp4)])
    crudos = out.replace(',', ' ').split()
    ms = [round(float(x) * 1000, 1) for x in crudos if x and x != 'N/A']
    return sorted(destino.glob('cuadro_*.png')), ms


def _foco():
    _, o = adb('shell', 'dumpsys', 'window', t=40)
    for ln in o.splitlines():
        if 'mCurrentFocus' in ln:
            return ln.strip()
    return ''


def filmar(args):
    if not args:
        print('falta el directorio de salida', file=sys.stderr)
        return 2
    destino = Path(args[0])
    seg = int(_opt(args, '--seg', '4'))
    fps_min = float(_opt(args, '--fps-min', str(FPS_MIN_DEFECTO)))
    tocar_id = _opt(args, '--disparo-tocar', '')
    relanzar = '--disparo-relanzar' in args

    adb('shell', 'rm', '-f', REMOTO, t=30)
    if relanzar:
        adb('shell', 'am', 'force-stop', PAQUETE, t=40)
        time.sleep(0.6)

    cmd = ['adb', '-s', SERIAL, 'shell', 'screenrecord', '--bit-rate', '20000000',
           '--time-limit', str(seg)]
    if '--sello' in args:
        cmd.append('--bugreport')  # estampa tiempo y nro de cuadro EN la imagen; ensucia el pixel
    cmd.append(REMOTO)
    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)

    # La grabacion NO arranca cuando arranca el proceso. Disparar antes de que el archivo crezca
    # filma el final de la animacion, o nada: se espera a que el device escriba bytes.
    t0 = time.monotonic()
    while time.monotonic() - t0 < 3:
        _, o = adb('shell', 'ls', '-l', REMOTO, t=20)
        if any(p.isdigit() and int(p) > 0 for p in o.split()):
            break
        time.sleep(0.15)
    else:
        proc.kill()
        print('screenrecord no empezo a escribir en 3 s', file=sys.stderr)
        return 1
    arranque = time.monotonic()

    if relanzar:
        adb('shell', 'monkey', '-p', PAQUETE, '-c', 'android.intent.category.LAUNCHER', '1', t=60)
    elif tocar_id:
        c = buscar(tocar_id)
        if c is None:
            proc.kill()
            print('no esta visible: ' + tocar_id, file=sys.stderr)
            return 3
        motion('DOWN', c[0], c[1])
        time.sleep(0.08)
        motion('UP', c[0], c[1])
    disparo_ms = round((time.monotonic() - arranque) * 1000)

    try:
        proc.wait(timeout=seg + 25)
    except subprocess.TimeoutExpired:
        proc.kill()
        print('screenrecord no termino', file=sys.stderr)
        return 1

    foco = _foco()
    if PAQUETE not in foco:
        print('FOCO AJENO, el video no es de esta app: ' + (foco or 'sin mCurrentFocus'),
              file=sys.stderr)
        return 4

    destino.mkdir(parents=True, exist_ok=True)
    local = destino / 'pantalla.mp4'
    rc, _, err = _corr(['adb', '-s', SERIAL, 'pull', REMOTO, str(local)], t=180)
    adb('shell', 'rm', '-f', REMOTO, t=30)
    if rc != 0 or not local.exists():
        print('pull fallo: ' + err.strip()[:200], file=sys.stderr)
        return 1

    fps, cuadros = fps_y_cuadros(local)
    print('video    : %s (%d bytes)' % (local, local.stat().st_size))
    print('fps REAL : %.2f  ·  cuadros contados: %d  ·  %d s pedidos' % (fps, cuadros, seg))
    print('disparo  : ~%d ms despues del primer byte '
          '(precision limitada por el arranque de screenrecord)' % disparo_ms)
    if fps < fps_min:
        print('[FAIL] fps reales %.2f < %.0f exigidos: esta captura NO resuelve una animacion '
              'de ~1 s.' % (fps, fps_min), file=sys.stderr)
        print('       No se extraen cuadros: entregarlos los volveria evidencia de algo que no '
              'se vio.', file=sys.stderr)
        return 5
    pngs, ms = extraer(local, destino)
    print('cuadros  : %d PNG en %s' % (len(pngs), destino))
    if ms:
        print('ventana  : %.1f ms .. %.1f ms  ·  paso medio %.1f ms'
              % (ms[0], ms[-1], (ms[-1] - ms[0]) / max(len(ms) - 1, 1)))
    for i, p in enumerate(pngs):
        print('  %s  t=%s ms' % (p.name, ms[i] if i < len(ms) else '?'))
    return 0


def _autotest_video():
    """Control del camino ffprobe/ffmpeg SIN device: se fabrica el video y se mide el resultado.

    Dos mitades, porque una sola absuelve al ciego: que ACEPTE 60 fps no prueba que el gate de
    `--fps-min` pueda RECHAZAR. Se fabrica tambien un clip de 24 fps y se exige que lo rechace,
    que es el control positivo del "no" (un mecanismo roto hacia el NO no da sintoma).
    """
    if _corr(['ffmpeg', '-version'], t=30)[0] != 0:
        print('[SALTEADO] ffmpeg no esta: el camino de video queda SIN CONTROL (no es un OK)')
        return 4
    with tempfile.TemporaryDirectory() as tmp:
        d = Path(tmp)
        for rate, esperado in ((60, True), (24, False)):
            mp4 = d / ('c%d.mp4' % rate)
            rc, _, err = _corr(['ffmpeg', '-v', 'error', '-y', '-f', 'lavfi', '-i',
                                'testsrc=duration=1:size=320x240:rate=%d' % rate,
                                '-pix_fmt', 'yuv420p', str(mp4)], t=120)
            assert rc == 0, 'no se pudo fabricar el clip: ' + err[:200]
            fps, cuadros = fps_y_cuadros(mp4)
            assert abs(fps - rate) < 1.5, 'fps mal leidos: %.2f vs %d' % (fps, rate)
            assert abs(cuadros - rate) <= 2, 'cuadros mal contados: %d vs %d' % (cuadros, rate)
            assert (fps >= FPS_MIN_DEFECTO) is esperado, (
                'el gate de fps no discrimina: %.2f fps con umbral %.0f' % (fps, FPS_MIN_DEFECTO))
        pngs, ms = extraer(d / 'c60.mp4', d / 'cuadros')
        assert len(pngs) >= 58, ('extrajo %d cuadros de 60: -vsync 0 no esta preservandolos'
                                 % len(pngs))
        assert len(ms) == len(pngs), 'un pts por cuadro: %d vs %d' % (len(ms), len(pngs))
        assert ms[0] < ms[-1], 'los pts no avanzan'
    print('autotest video OK: lee 60 y 24 fps, cuenta cuadros, extrae 1 PNG por cuadro '
          'y el gate de fps RECHAZA 24 (control negativo)')
    return 0


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
        return _autotest_video()
    if cmd == 'filmar':
        return filmar(args)
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
