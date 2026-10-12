#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Baja el APK del build EAS, lo archiva con PROCEDENCIA, lo instala y MIDE el resultado.

Produce exactamente la evidencia que los criterios 7 y 8 del gate exigen, y nada mas:
  - C8 quiere un APK **atribuible**: su nombre lleva el sha del build Y vive bajo el repo. La v1 del
    gate aprobo con un APK ajeno de 248 MB; la procedencia es la mitad que le faltaba.
  - C7 quiere `pm path` con ruta, con control positivo (paquete del sistema) y negativo (paquete
    inventado) — si el instrumento esta ciego, un vacio parece "no instalada".

=== POR QUE ARCHIVA EN DISCO ANTES DE INSTALAR ===
La retencion de artefactos de EAS es de **14 dias** y ya borro 12 builds de este proyecto: los 3
artefactos muestreados dan 404. Un binario que vive solo en expo.dev tiene fecha de desaparicion, y
con el se va la unica forma de volver a inspeccionar lo que se instalo. Se archiva primero.

=== LO QUE NO HACE, A PROPOSITO ===
No desinstala nada. Usa `adb install -r` (reinstala preservando datos). Desinstalar borraria la
sesion del usuario de prueba canonico, y el device **escribe en la base**: dos agentes tocandolo
fabrican evidencia falsa. Un solo dueno por vez.

Uso:  python -I 2026-10-11-instalar-y-medir-apk.py [--solo-medir] [--proyecto=<ruta a apps/mobile>]
"""
import io
import json
import os
import re
import subprocess
import sys
import urllib.error
import urllib.request

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

PKG = 'app.copiloto.emprendedor'
SAL = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(SAL, '..', '..', '..'))
ARCHIVO = os.path.join(REPO, 'artefactos-build')
SOLO_MEDIR = '--solo-medir' in sys.argv[1:]
# DESDE DONDE se le habla a la plataforma. El CLI de EAS resuelve la config del proyecto con los
# node_modules del checkout, asi que corrido desde un worktree sin instalar falla con 'Failed to
# resolve plugin for module expo-router' -- un rojo del ENTORNO con la misma cara que uno de la
# plataforma. Se separa de donde se ARCHIVA a proposito: los instrumentos y el documento viven en
# el worktree de la auditoria, y las dependencias en el del build.
PROYECTO = next((a.split('=', 1)[1] for a in sys.argv[1:] if a.startswith('--proyecto=')),
                os.path.join(REPO, 'apps', 'mobile'))

fallas = []


def mal(msg):
    fallas.append(msg)
    print('  ROJO  %s' % msg)


def adb(*args, timeout=600):
    r = subprocess.run(('adb',) + args, capture_output=True, text=True,
                       timeout=timeout, errors='replace')
    return r.returncode, (r.stdout or '').strip(), (r.stderr or '').strip()


# ------------------------------------------------------------------ 1. el build y su procedencia
def consultar_build():
    """Pide a la plataforma el ultimo build de Android. Nunca levanta: el error es un valor.

    Misma leccion que ya pagaron dos instrumentos hermanos (`2026-10-11-eas-builds.py:50` y el
    control de plataforma del gate): un `urlopen` pelado deja cualquier no-2xx en "no medido", y una
    credencial invalida en api.expo.dev responde **HTTP 200 con `me: null`**, no un error.
    """
    tok = os.environ.get('EXPO_TOKEN', '').strip()
    if not tok:
        st = os.path.expanduser('~/.expo/state.json')
        if os.path.isfile(st):
            tok = ((json.load(io.open(st, encoding='utf-8')).get('auth') or {})
                   .get('sessionSecret') or '')
    if not tok:
        print('  sin credencial (ni EXPO_TOKEN ni sesion del CLI): no se puede consultar la plataforma')
        return None
    # Preflight que nombra la causa REAL antes de que el CLI la disfrace. Corrido desde un worktree
    # sin instalar, `eas build:list` muere con "Failed to resolve plugin for module expo-router":
    # un rojo del ENTORNO con la misma cara que uno de la plataforma.
    if not any(os.path.isdir(os.path.join(PROYECTO, *p))
               for p in (('node_modules',), ('..', '..', 'node_modules'))):
        print('  OJO: %s no tiene node_modules alcanzables; el CLI de EAS va a fallar al resolver '
              'la config del proyecto. Pasar --proyecto=<checkout con deps>.' % PROYECTO)
    # el CLI resuelve projectId, cola y permisos solo: reusarlo es mas barato que replicar su GraphQL
    r = subprocess.run(['npx', '-y', 'eas-cli@24.7.0', 'build:list', '--platform', 'android',
                        '--limit', '1', '--json'],
                       capture_output=True, text=True, timeout=600,
                       cwd=PROYECTO, errors='replace', shell=True)
    try:
        return (json.loads(r.stdout) or [None])[0]
    except ValueError:
        print('  la plataforma no devolvio JSON (rc=%s): %s' % (r.returncode, (r.stdout or '')[:160]))
        return None


def bajar(url, destino):
    req = urllib.request.Request(url, headers={'User-Agent': 'instalar-y-medir-apk/1.0'})
    tmp = destino + '.parcial'
    try:
        with urllib.request.urlopen(req, timeout=900) as r, io.open(tmp, 'wb') as f:
            while True:
                trozo = r.read(1 << 20)
                if not trozo:
                    break
                f.write(trozo)
    except urllib.error.HTTPError as exc:
        if os.path.exists(tmp):
            os.remove(tmp)
        return 'HTTP %s' % exc.code
    # escritura atomica: un `open(w)` que explota a mitad deja un archivo de 0 bytes que parece valido
    os.replace(tmp, destino)
    return None


print('=' * 86)
print('APK DEL BUILD -> DISCO -> DEVICE, con sus controles')
print('=' * 86)
print('  repo    : %s' % REPO)
print('  archivo : %s' % ARCHIVO)
print()

sha, apk = None, None
if not SOLO_MEDIR:
    b = consultar_build()
    if not b:
        mal('no se pudo consultar el build: sin procedencia no se archiva nada')
    else:
        sha = (b.get('gitCommitHash') or '')[:8]
        estado = b.get('status')
        url = (b.get('artifacts') or {}).get('applicationArchiveUrl')
        print('  build %s | %s | sha %s' % (b.get('id', '?')[:8], estado, sha or '?'))
        if estado != 'FINISHED':
            mal('el build no esta FINISHED (esta %s): no hay artefacto que bajar' % estado)
        elif not url:
            mal('build FINISHED sin applicationArchiveUrl (la retencion de 14 dias ya borro 12)')
        else:
            if not os.path.isdir(ARCHIVO):
                os.makedirs(ARCHIVO)
            # el sha EN EL NOMBRE es lo que vuelve atribuible al archivo (C8 del gate)
            apk = os.path.join(ARCHIVO, 'copiloto-dev-client-%s.apk' % sha)
            if os.path.isfile(apk) and os.path.getsize(apk) > 1 << 20:
                print('  ya archivado (idempotente): %.1f MB' % (os.path.getsize(apk) / 1e6))
            else:
                print('  bajando...')
                err = bajar(url, apk)
                if err:
                    mal('la descarga fallo: %s' % err)
                    apk = None
                else:
                    print('  archivado: %s (%.1f MB)' % (os.path.basename(apk),
                                                         os.path.getsize(apk) / 1e6))

# ------------------------------------------------------------------ 2. device: dueno unico
print()
print('  --- device ---')
rc, out, _ = adb('devices', timeout=60)
seriales = [l.split()[0] for l in out.splitlines()[1:] if l.strip().endswith('device')]
if not seriales:
    mal('0 devices autorizados: nada que medir')
elif len(seriales) > 1:
    mal('%d devices conectados: el device exige DUENO UNICO, dos adb fabrican evidencia falsa'
        % len(seriales))
else:
    print('  device: %s' % seriales[0])

# ------------------------------------------------------------------ 3. instalar
if apk and seriales and len(seriales) == 1:
    print()
    print('  --- instalacion (-r: reinstala PRESERVANDO datos; no se desinstala nada) ---')
    rc, out, err = adb('install', '-r', apk, timeout=900)
    salida = ' '.join((out + ' ' + err).split())
    # `adb install` puede salir rc=0 imprimiendo "Failure": el exit code NO es el control
    if 'Success' in salida:
        print('  Success')
    else:
        mal('la instalacion no reporto Success (rc=%s): %s' % (rc, salida[:200]))

# ------------------------------------------------------------------ 4. medir, con los dos controles
print()
print('  --- medicion: pm path, con control positivo y negativo ---')
if seriales and len(seriales) == 1:
    def pm_path(pkg):
        return adb('shell', 'pm', 'path', pkg, timeout=60)[1]

    ctl = pm_path('com.android.settings') or pm_path('android')
    if not ctl.startswith('package:'):
        mal('CONTROL POSITIVO de pm path FALLO: el instrumento esta ciego, un vacio no significa nada')
    else:
        print('  control positivo OK: %s' % ctl.splitlines()[0][:70])
        inventado = pm_path('no.existe.este.paquete.zzz')
        if inventado:
            mal('CONTROL NEGATIVO FALLO: un paquete inventado devolvio %r' % inventado[:60])
        else:
            print('  control negativo OK: paquete inventado -> vacio')
            real = pm_path(PKG)
            if real.startswith('package:'):
                print('  INSTALADA: %s' % real.splitlines()[0][:80])
            else:
                mal('`pm path %s` -> VACIO con ambos controles verdes: NO esta instalada' % PKG)

    # los permisos del APK: la unica medicion que ve el resultado del merge de manifiestos de Gradle
    print()
    print('  --- permisos efectivos (lo que el prebuild NO puede mostrar) ---')
    _, dump, _ = adb('shell', 'dumpsys', 'package', PKG, timeout=120)
    # ALCANCE EN LA PREGUNTA, no «aparece en el dump». `dumpsys package` imprime varias secciones
    # (requested, install, runtime, y las concedidas por usuario), asi que un barrido global
    # responde "aparece el string" cuando la pregunta es "el APK lo PIDE". Mismo defecto que C2 del
    # gate ya pago: un check de presencia global degrada a medida que el texto crece.
    # MEDIDO sobre `com.android.settings`: la seccion da **122** permisos y el dump entero **259**
    # -- 137 de ruido. Y la parte honesta: el canario NO reprodujo un falso verde para CAMERA
    # (`com.android.providers.calendar` no la trae ni en la seccion ni en el dump completo), asi que
    # el sobre-reporte esta medido y la consecuencia sobre ESTE check queda como NO demostrada. Se
    # acota igual, porque la pregunta correcta es mas barata que seguir discutiendo el margen.
    sec = re.search(r'requested permissions:\s*\n(.*?)(?=\n\s*\w[\w ]*permissions:|\n\s*User \d|\Z)',
                    dump, re.S)
    pedidos = sorted(set(re.findall(r'(android\.permission\.[A-Z_]+)', sec.group(1)))) if sec else []
    if not pedidos:
        print('  sin seccion "requested permissions" en el dump (la app puede no estar instalada)')
        # control de ceguera: si el dump trae permisos pero la seccion no se encontro, el que esta
        # roto es el PARSEO, no la app -- y callarlo seria un falso "no pide nada".
        if re.search(r'android\.permission\.[A-Z_]+', dump):
            mal('el dump SI tiene permisos pero no se pudo acotar la seccion: el parseo esta roto, '
                'no la app (un vacio de instrumento no es un hallazgo)')
    else:
        for p in pedidos:
            print('    %s' % p)
        for esperado in ('android.permission.CAMERA', 'android.permission.RECORD_AUDIO'):
            if esperado not in pedidos:
                mal('el APK instalado NO pide %s, y el codigo la usa' % esperado)
    m = re.search(r'versionCode=(\d+).*?versionName=([^\s]+)', dump, re.S)
    if m:
        print('  versionCode=%s versionName=%s' % (m.group(1), m.group(2)))

print()
print('=' * 86)
if fallas:
    print('ROJO — %d falla(s):' % len(fallas))
    for f in fallas:
        print('  %s' % f)
    raise SystemExit(1)
print('VERDE — APK archivado con procedencia, instalado y medido con ambos controles.')
if sha:
    print('        sha del build: %s  (este literal tiene que estar en el documento para C8)' % sha)
raise SystemExit(0)
