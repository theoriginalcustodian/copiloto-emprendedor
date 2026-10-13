"""CRASHFRIO: N arranques en frio LOGGED-OUT con el dev-client, logcat a ARCHIVO COMPLETO por corrida,
y la tasa «x de N». Autocontenido (sólo adb). NO pipear por tail/head: la evidencia es el archivo.

Precondiciones (las del hallazgo original, DEVICE15 H2):
  - device `RF8T318RN9T` con el dev-client instalado, USB, `adb reverse tcp:8081 tcp:8081`;
  - Metro del SHA a medir levantado con `EXPO_PUBLIC_API_BASE=https://copilotoemprendedor.duckdns.org`
    y `--clear` (sin la variable el login falla con «No pudimos conectarnos» y no es lo medido);
  - la app en estado LOGGED-OUT (cierre voluntario → reveal «volver»), animaciones del sistema normales.

Uso:
  python -I 2026-10-13-receta-crashfrio.py <N> <etiqueta> [directorio-de-salida]
  SAMPLER=1       carga de `adb exec-out screencap` concurrente (la condición del hallazgo)
  CONTROL_KILL=s  control POSITIVO: `kill -11` al proceso a los s segundos (el instrumento debe verlo)

Salida por corrida: runNN-logcat.txt (logcat -b all completo), runNN-exitinfo.txt, y resumen.json.
Un SIGSEGV genuino de la app dice `code 1 (SEGV_MAPERR)` o `code 2 (SEGV_ACCERR)` en el hilo `mqt_v_js`;
el control dice `code 0 (SI_USER from pid ...)`. Ese campo es lo que los distingue.
"""
import json
import os
import re
import subprocess
import sys
import threading
import time

PKG = 'app.copiloto.emprendedor'
DEEP_DEV = 'copiloto://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081'
VENTANA = 50  # s observando cada arranque (el crash del hallazgo cae entre ~17 y ~37 s)
SIG = re.compile(r'Fatal signal|SIGSEGV|SIGABRT|tombstone|backtrace:|CRASH_NATIVE|FATAL EXCEPTION', re.I)


def adb(*a, t=60):
    r = subprocess.run(('adb',) + a, capture_output=True, text=True, timeout=t, errors='replace', encoding='utf-8')
    return r.returncode, (r.stdout or '').strip(), (r.stderr or '').strip()


def pid():
    o = adb('shell', 'pidof', PKG, t=20)[1].split()
    return o[0] if o else ''


def arbol():
    for _ in range(3):
        o = adb('exec-out', 'uiautomator', 'dump', '/dev/tty', t=40)[1]
        if '<hierarchy' in o:
            return o
        time.sleep(0.3)
    return ''


def main():
    n, tag = int(sys.argv[1]), sys.argv[2]
    base = sys.argv[3] if len(sys.argv) > 3 else os.path.join(os.getcwd(), 'crashfrio-out')
    out = os.path.join(base, tag)
    os.makedirs(out, exist_ok=True)
    sampler = os.environ.get('SAMPLER') == '1'
    control_kill = int(os.environ.get('CONTROL_KILL', '0'))
    resumen = []
    for i in range(1, n + 1):
        adb('shell', 'logcat', '-b', 'all', '-c', t=30)
        adb('shell', 'am', 'force-stop', PKG, t=30)
        time.sleep(2)
        t0 = time.time()
        adb('shell', 'am', 'start', '-a', 'android.intent.action.VIEW', '-d', DEEP_DEV, t=30)
        linea, ult = [], None
        parar = threading.Event()
        if sampler:
            def _muestrear():
                while not parar.is_set():
                    subprocess.run(['adb', 'exec-out', 'screencap'], capture_output=True, timeout=60)
            threading.Thread(target=_muestrear, daemon=True).start()
        matado = False
        while time.time() - t0 < VENTANA:
            if control_kill and not matado and time.time() - t0 >= control_kill and pid():
                adb('shell', 'run-as', PKG, 'kill', '-11', pid(), t=20)
                matado = True
            p = pid()
            if p != ult:
                linea.append((round(time.time() - t0, 1), p or '-'))
                ult = p
            time.sleep(1)
        parar.set()
        vivo = bool(pid())
        x = arbol() if vivo else ''
        pantalla = next((k for k in ('reveal-entrada-primario', 'login-screen', 'panel-principal') if k in x),
                        'ninguna' if vivo else 'sin-proceso')
        lc = os.path.join(out, 'run%02d-logcat.txt' % i)
        with open(lc, 'wb') as f:
            f.write(subprocess.run(['adb', 'logcat', '-d', '-b', 'all', '-v', 'threadtime'],
                                   capture_output=True, timeout=120).stdout)
        with open(os.path.join(out, 'run%02d-exitinfo.txt' % i), 'w', encoding='utf-8') as f:
            f.write(adb('shell', 'dumpsys', 'activity', 'exit-info', PKG, t=40)[1])
        txt = open(lc, encoding='utf-8', errors='replace').read()
        hits = [l for l in txt.splitlines() if SIG.search(l) and (PKG in l or 'libreactnative' in l or 'DEBUG' in l or 'Fatal signal' in l)]
        pids = [p for _, p in linea if p != '-']
        crash = len(set(pids)) > 1 or not vivo or any('Fatal signal' in h for h in hits)
        r = dict(run=i, crash=crash, vivo_al_final=vivo, pantalla=pantalla, pids=pids, linea=linea,
                 hits=len(hits), primer_hit=(hits[0][:220] if hits else ''))
        resumen.append(r)
        print(json.dumps(r, ensure_ascii=False), flush=True)
    print('TASA %s: %d de %d' % (tag, sum(1 for r in resumen if r['crash']), n), flush=True)
    with open(os.path.join(out, 'resumen.json'), 'w', encoding='utf-8') as f:
        json.dump(resumen, f, ensure_ascii=False, indent=1)


if __name__ == '__main__':
    main()
