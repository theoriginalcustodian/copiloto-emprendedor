#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Ejercita en el TELEFONO las 21 pantallas del relevamiento, separando DOS preguntas distintas.

=== LAS DOS PREGUNTAS, Y POR QUE NO SE MEZCLAN ===
El relevamiento dejo `veredicto_device = BLOQUEADO_POR_BUILD` en las 21. Pero "device" no es una
pregunta: son dos, y una no acredita a la otra.

  EJE A -- ALCANZABILIDAD NAVEGANDO. ¿Se LLEGA a la pantalla haciendo lo que hace un dedo?
           Es la pregunta de H-12 (6 rutas cuyo primer eslabon es un gesto que arranca fuera de
           pantalla) y de H-11 (la alcanzabilidad es TRANSITIVA: el primer salto no alcanza).
  EJE B -- RENDER. ¿La pantalla se MONTA en device sin reventar? Por deep link (`copiloto://ruta`).

H-10 prueba que son dos: `/midia` se alcanza por deep link y CERO call-sites navegan hacia ella. Un
verde del eje B sobre `/midia` no dice nada sobre llegar; si se reportaran juntos, el deep link
LAVARIA el hallazgo. Van en columnas separadas.

=== LO QUE SE APRENDIO EJERCITANDOLO, Y SIN LO CUAL ESTO MIENTE ===
1. `uiautomator dump` FALLA con "could not get idle state" mientras algo anima. La portada tiene un
   ecualizador y un halo que animan SIEMPRE, asi que el dump no volvia nunca -- y un dump vacio se
   lee como "la pantalla no tiene nada". Se apagan las tres escalas de animacion del sistema (las
   respeta tambien Reanimated) y se RESTAURAN en `finally`: un script que muta el device y revierte
   solo al final deja el mutante si algo explota.
   ⚠️ Con las escalas en 0 el eje A mide la NAVEGACION, no la animacion. La calidad del gesto
   (spring, snap, 60fps) queda fuera de alcance y se declara asi, no se insinua medida.
2. El arbol APILA las capas: con `/clientes` abierta siguen presentes `panel-principal` y
   `pantalla-midia`. Un testID presente puede ser de una pantalla ANTERIOR, asi que "aparece" no
   es evidencia. Cada ruta se mide con un PAR DE CONTRASTE: el testID NO esta antes del deep link
   y SI esta despues. Si ya estaba, se vuelve atras hasta que no este.
3. `input text` APPENDEA y el campo no se vacia solo. Escribir dos veces dejo email y password
   concatenados y el login fallo por BASURA, con cara de credencial mala. Se vacia y se verifica.
4. El TECLADO reflowea: un centro leido de un arbol anterior cae en otro control. Cada toque re-lee.
5. La credencial se verifica por HTTP ANTES de tocar el device, y el bundle necesita
   `EXPO_PUBLIC_API_BASE`: sin eso la app no habla con el backend y NINGUNA clave entra -- un rojo
   del entorno con la cara de uno de la app. Metro debe correr con esa variable.

Nunca imprime la credencial: el texto visible de un campo de password ES el secreto.

Uso:  python -I 2026-10-11-receta-device-21-pantallas.py [--solo-preflight] [--eje=a|b|ambos]
      [--env-e2e=<path a .env.e2e>]
"""
import io
import json
import os
import re
import subprocess
import sys
import time
import urllib.error
import urllib.request

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

PKG = 'app.copiloto.emprendedor'
SCHEME = 'copiloto'
METRO = 'http://localhost:8081'
BASE_API = 'https://copilotoemprendedor.duckdns.org'
DEEP_DEV = 'copiloto://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081'
SAL = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(SAL, '..', '..', '..'))

ARGS = sys.argv[1:]
SOLO_PREFLIGHT = '--solo-preflight' in ARGS
EJE = next((a.split('=', 1)[1] for a in ARGS if a.startswith('--eje=')), 'ambos')
# Las escalas en 0 son lo que deja ver el arbol, pero tambien ponen a Reanimated en *reduced
# motion* (lo dice su propio aviso en el bundle). Con este flag no se tocan: el gesto se mide
# en la condicion del usuario, al precio de que `uiautomator` tarda mas en conseguir idle.
ANIM_NORMALES = '--animaciones=normales' in ARGS
ENV_E2E = next((a.split('=', 1)[1] for a in ARGS if a.startswith('--env-e2e=')),
               r'C:\Proyectos\Claude\Claude code\copiloto-emprendedor\.env.e2e')

# Las 21 rutas del §8 con el testID que acredita la pantalla, MEDIDO en el fuente.
#
# 🔴 LA TABLA EMPEZO DEDUCIDA Y ESTABA MAL EN 10 DE 21. La v1 asumio el patron `pantalla-<ruta>`;
# el grep de los testID reales lo refuto: `/ajustes-cuenta` es `pantalla-cuenta`, `/ajustes-negocio`
# es `pantalla-perfil-negocio`, `/ajustes-afip` es `pantalla-afip-setup`, `/` es `panel-principal`,
# `/legal` es un TEMPLATE. Corrido asi, el eje B habria dado 10 rojos falsos atribuidos a la app.
# Y el control positivo del arranque NO los habria cazado: mira UNA pantalla y con ese verde
# absuelve a las otras 20 -- la mitad que uno sospecha queda cubierta y la otra, muda.
PANTALLAS = [
    ('/',                   ['panel-principal']),                   # PantallaPrincipal.tsx:164
    ('/midia',              ['pantalla-midia']),                    # PantallaMiDia.tsx:498
    ('/inteligencia',       ['pantalla-inteligencia']),
    # `/legal` NO es literal: `legal-screen-${kind}`, y el deep link sin param cae en el default
    # 'tos' del guard (`app/legal.tsx:13`). El testID depende del PARAMETRO, no de la ruta.
    ('/legal',              ['legal-screen-tos']),                  # PantallaLegal.tsx:35
    ('/ajustes-soporte',    ['pantalla-soporte']),
    ('/facturacion',        ['pantalla-facturacion']),
    ('/presupuestos',       ['pantalla-presupuestos']),
    ('/gastos',             ['pantalla-gastos']),
    ('/ingresos',           ['pantalla-ingresos']),
    ('/ajustes-afip',       ['pantalla-afip-setup']),
    ('/clientes',           ['pantalla-clientes']),
    ('/recientes',          ['pantalla-recientes']),
    ('/agenda',             ['pantalla-agenda']),
    # dos testIDs y NO es laxitud: un deep link sin `id` entra por la rama sin ticket. Se acepta
    # cualquiera y el resultado dice CUAL aparecio; con uno solo, el rojo hablaria del link que
    # mande yo, no de la pantalla.
    ('/soporte-ticket',     ['pantalla-ticket', 'pantalla-ticket-sin-id']),
    ('/apps',               ['pantalla-apps']),
    ('/ajustes',            ['pantalla-ajustes']),
    ('/ajustes-cuenta',     ['pantalla-cuenta']),
    ('/ajustes-negocio',    ['pantalla-perfil-negocio']),
    ('/ajustes-skins',      ['pantalla-skins']),
    ('/ajustes-como-usar',  ['pantalla-como-usar']),
    ('/ajustes-feedback',   ['pantalla-feedback']),
]

# Las 6 del escritorio: su primer eslabon es el gesto de H-12. testID `tile-<key>`, medido en
# `EscritorioFunciones.tsx:233` (NO estan en PantallaPrincipal, que tiene un solo testID).
TILES = ['/facturacion', '/ingresos', '/gastos', '/presupuestos', '/clientes', '/inteligencia']

ESCALAS = ('window_animation_scale', 'transition_animation_scale', 'animator_duration_scale')

fallas = []
resultados = {}


def mal(msg):
    fallas.append(msg)
    print('  ROJO  %s' % msg)


def adb(*a, t=180):
    r = subprocess.run(('adb',) + a, capture_output=True, text=True, timeout=t, errors='replace')
    return r.returncode, (r.stdout or '').strip(), (r.stderr or '').strip()


def arbol(intentos=6):
    """El arbol de la UI. Reintenta: con animacion viva, `uiautomator` devuelve vacio."""
    for _ in range(intentos):
        _, out, _ = adb('exec-out', 'uiautomator', 'dump', '/dev/tty')
        if '<hierarchy' in out:
            return out
        if ANIM_NORMALES:
            # Con animacion viva hay que ESPERARLA; eso no es lo mismo que insistir mas veces.
            # Fundir las dos cosas (12 intentos forzados) volvio el polling de `hasta_principal`
            # -- que llama con intentos=2 a proposito, hasta 80 veces -- en minutos de pausas, y la
            # corrida se comio su timeout sin llegar a medir nada.
            time.sleep(0.3)
    return ''


def ve(x, tid):
    return re.search(r'(?:resource-id|content-desc)="[^"]*\b%s\b[^"]*"' % re.escape(tid),
                     x) is not None


def ve_alguno(x, tids):
    return next((t for t in tids if ve(x, t)), None)


def centro(x, pat):
    m = re.search(r'<node[^>]*(?:resource-id|content-desc|text)="%s"[^>]*'
                  r'bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"' % re.escape(pat), x)
    if not m:
        return None
    a, b, c, d = (int(g) for g in m.groups())
    return ((a + c) // 2, (b + d) // 2, a, b, c, d)


def toca_pt(x, y):
    adb('shell', 'input', 'motionevent', 'DOWN', str(x), str(y))
    adb('shell', 'input', 'motionevent', 'UP', str(x), str(y))


def toca_pat(pat):
    """Re-lee el arbol y toca: el layout se mueve entre dump y toque (razon 4 del docstring)."""
    pt = centro(arbol(), pat)
    if not pt:
        return False
    toca_pt(pt[0], pt[1])
    return True


def arrastre(x, y0, y1, pasos=12):
    """DOWN + MOVEs + UP. `input tap` no lo ve un Pan de RNGH, y `input swipe` decide la velocidad
    por su cuenta -- y el `onEnd` de `PanelFunciones.tsx:88` separa tap de arrastre comparando
    `velocityY` contra 500."""
    adb('shell', 'input', 'motionevent', 'DOWN', str(x), str(y0))
    for i in range(1, pasos + 1):
        adb('shell', 'input', 'motionevent', 'MOVE', str(x), str(int(y0 + (y1 - y0) * i / pasos)))
    adb('shell', 'input', 'motionevent', 'UP', str(x), str(y1))


def esperar(cond, intentos=10):
    ultimo = ''
    for _ in range(intentos):
        ultimo = arbol(intentos=2)
        if ultimo and cond(ultimo):
            return True, ultimo
    return False, ultimo


CAPTURAS = os.path.join(REPO, 'artefactos-build', 'device-capturas')


def capturar(nombre):
    if not os.path.isdir(CAPTURAS):
        os.makedirs(CAPTURAS)
    r = subprocess.run(['adb', 'exec-out', 'screencap', '-p'], capture_output=True, timeout=180)
    if not r.stdout.startswith(b'\x89PNG'):
        return False
    destino = os.path.join(CAPTURAS, '%s.png' % (nombre.strip('/').replace('/', '_') or 'raiz'))
    tmp = destino + '.parcial'
    with io.open(tmp, 'wb') as f:
        f.write(r.stdout)
    os.replace(tmp, destino)
    return True


print('=' * 88)
print('RECETA DE DEVICE -- 21 pantallas, eje A (navegando) y eje B (render)')
print('=' * 88)

# ------------------------------------------------------------------ 1. dueno unico
_, out, _ = adb('devices', t=60)
seriales = [l.split()[0] for l in out.splitlines()[1:] if l.strip().endswith('device')]
if len(seriales) != 1:
    print('ROJO  %d devices: se exige DUENO UNICO (dos adb fabrican evidencia falsa)' % len(seriales))
    raise SystemExit(1)
print('  device: %s' % seriales[0])

if not adb('shell', 'pm', 'path', PKG, t=60)[1].startswith('package:'):
    mal('%s no esta instalada: correr antes 2026-10-11-instalar-y-medir-apk.py' % PKG)

# ------------------------------------------------------------------ 2. Metro y la credencial
adb('reverse', 'tcp:8081', 'tcp:8081', t=60)
try:
    with urllib.request.urlopen(METRO + '/status', timeout=15) as r:
        vivo = 'packager-status:running' in r.read().decode('utf-8', 'replace')
except (urllib.error.URLError, OSError):
    vivo = False
if not vivo:
    mal('Metro no corre: el dev-client NO trae bundle y la app abre en blanco. Lanzarlo en el '
        'worktree del build CON EXPO_PUBLIC_API_BASE, o la app no habla con el backend.')
else:
    sha = subprocess.run(['git', '-C', REPO, 'rev-parse', '--short', 'HEAD'],
                         capture_output=True, text=True, errors='replace').stdout.strip()
    print('  Metro vivo | checkout de este repo: %s' % (sha or '?'))

cred = {}
if os.path.isfile(ENV_E2E):
    for linea in io.open(ENV_E2E, encoding='utf-8'):
        if '=' in linea and not linea.strip().startswith('#'):
            k, v = linea.split('=', 1)
            cred[k.strip()] = v.strip().strip('"').strip("'")
EMAIL, PWD = cred.get('E2E_DEVICE_EMAIL', ''), cred.get('E2E_DEVICE_PASSWORD', '')
if not EMAIL or not PWD:
    mal('sin credencial del usuario canonico en %s' % ENV_E2E)
else:
    try:
        req = urllib.request.Request(
            BASE_API + '/auth/login',
            data=json.dumps({'email': EMAIL, 'password': PWD}).encode(),
            headers={'Content-Type': 'application/json'})
        with urllib.request.urlopen(req, timeout=30) as r:
            ok_http = 'access_token' in json.loads(r.read().decode('utf-8', 'replace'))
    except (urllib.error.HTTPError, urllib.error.URLError, OSError, ValueError) as exc:
        ok_http = False
        print('  la verificacion HTTP fallo: %r' % exc)
    if not ok_http:
        mal('la credencial de %s no entra por HTTP: hasta que eso este verde, el device no puede '
            'decir nada sobre la UI' % EMAIL)
    else:
        print('  credencial de %s VALIDA por HTTP' % EMAIL)

if fallas:
    print()
    print('ROJO en preflight -- no se mide nada.')
    raise SystemExit(1)

# ------------------------------------------------------------------ 3. preparar el device
previas = {}
for s in ESCALAS:
    previas[s] = adb('shell', 'settings', 'get', 'global', s, t=60)[1]


def restaurar():
    for k, v in previas.items():
        # `null` es el valor por defecto: borrar la clave, no escribir la cadena "null"
        if v and v != 'null':
            adb('shell', 'settings', 'put', 'global', k, v, t=60)
        else:
            adb('shell', 'settings', 'delete', 'global', k, t=60)


def escribir_en(rid, valor, nombre):
    """Enfoca, VACIA, verifica, y recien entonces escribe (razon 3 del docstring)."""
    if not toca_pat(rid):
        return False, 'no encontre %s' % rid
    x = arbol()
    m = re.search(r'<node[^>]*resource-id="%s"[^>]*text="([^"]*)"' % re.escape(rid), x)
    actual = m.group(1) if m else ''
    if actual:
        adb('shell', 'input', 'keyevent', 'KEYCODE_MOVE_END')
        pulsos = ['KEYCODE_DEL'] * (len(actual) + 8)
        for i in range(0, len(pulsos), 30):
            adb('shell', 'input', 'keyevent', *pulsos[i:i + 30])
        m2 = re.search(r'<node[^>]*resource-id="%s"[^>]*text="([^"]*)"' % re.escape(rid), arbol())
        quedo = m2.group(1) if m2 else ''
        if quedo and len(quedo) >= len(actual):
            return False, ('no pude vaciar %s (%d -> %d chars): NO escribo encima, seria basura '
                           'concatenada y el rojo parecerian las credenciales'
                           % (rid, len(actual), len(quedo)))
    adb('shell', 'input', 'text', valor)
    print('  %s escrito' % nombre)   # NUNCA el contenido: en password, el texto visible ES la clave
    return True, ''


def hasta_principal(limite=80):
    """Desde CUALQUIER estado hasta `panel-principal`. Camino medido en device, no deducido."""
    adb('shell', 'am', 'force-stop', PKG)
    adb('shell', 'am', 'start', '-a', 'android.intent.action.VIEW', '-d', DEEP_DEV)
    intentos_login = 0
    for _ in range(limite):
        x = arbol(intentos=2)
        if not x:
            continue
        if ve(x, 'panel-principal') or ve(x, 'panel-funciones'):
            return True, x
        if ve(x, 'login-screen'):
            if intentos_login >= 2:
                return False, x
            intentos_login += 1
            for rid, val, nom in (('login-email', EMAIL, 'email'),
                                  ('login-password', PWD, 'password')):
                ok, msg = escribir_en(rid, val, nom)
                if not ok:
                    print('  ROJO %s' % msg)
                    return False, x
            toca_pat('login-submit')
            continue
        if 'Empecemos' in x:
            toca_pat('Empecemos')
            continue
        if 'content-desc="Close"' in x:
            toca_pat('Close')
            continue
        if 'Continue' in x:
            toca_pat('Continue')
            continue
        if PKG not in x:
            adb('shell', 'am', 'start', '-a', 'android.intent.action.VIEW', '-d', DEEP_DEV)
    return False, ''


try:
    adb('shell', 'svc', 'power', 'stayon', 'usb', t=60)
    adb('shell', 'input', 'keyevent', 'KEYCODE_WAKEUP', t=60)
    adb('shell', 'wm', 'dismiss-keyguard', t=60)
    if ANIM_NORMALES:
        print('  animaciones del sistema SIN TOCAR (--animaciones=normales): se mide el gesto en la '
              'condicion del usuario, no con Reanimated en reduced motion')
    else:
        for s in ESCALAS:
            adb('shell', 'settings', 'put', 'global', s, '0', t=60)
        print('  animaciones del sistema en 0 (se restauran al salir) -- sin esto `uiautomator` no '
              'consigue idle y devuelve vacio, que se lee como "la pantalla no tiene nada"')

    print()
    print('  --- arranque y controles del instrumento ---')
    ok, xml = hasta_principal()
    if not ok:
        nodos = len(re.findall(r'<node ', xml))
        ids = len(re.findall(r'resource-id="[^"]+"', xml))
        mal('no llegue a `panel-principal` (nodos=%d, resource-ids=%d). Si ids=0 el testID de RN no '
            'llega a uiautomator y TODA medicion de abajo seria del instrumento: se corta aca en '
            'vez de emitir 21 rojos falsos.' % (nodos, ids))
        print()
        print('ROJO -- instrumento sin acreditar.')
        raise SystemExit(1)
    print('  control POSITIVO ok: la app expone testIDs que uiautomator ve')
    if ve(xml, 'pantalla-que-no-existe-zzz'):
        mal('control NEGATIVO fallo: un testID inventado tambien aparece -- el matcher machea '
            'cualquier cosa y los verdes de abajo no valdrian nada')
        raise SystemExit(1)
    print('  control NEGATIVO ok: un testID inventado no aparece')
    capturar('00-principal')

    if SOLO_PREFLIGHT:
        print()
        print('VERDE -- preflight y controles ok (no se midio ninguna pantalla).')
        raise SystemExit(0)

    # -------------------------------------------------------- 4. EJE A: navegando (H-12)
    if EJE in ('a', 'ambos'):
        print()
        print('  --- EJE A: alcanzabilidad NAVEGANDO (H-12) ---')
        pest = centro(xml, 'panel-funciones-pestana')
        if not pest:
            mal('no encontre la pestana del escritorio: el eje A no se puede medir (y eso NO es lo '
                'mismo que "el gesto no abre")')
        else:
            # El punto NO es el centro de la pestana. Con bounds [0,1][720,83] el centro cae en
            # y=42, DENTRO de la barra de estado del sistema: Android se queda con el toque, y un
            # arrastre hacia abajo desde ahi es el gesto de la CORTINA DE NOTIFICACIONES -- que
            # ademas tapa la app, asi que las pantallas de despues salen NO_MONTA y el rojo parece
            # de ellas. Medido 2026-10-11: desde y=42 no abre; desde y=79 (4px sobre el borde de
            # abajo) ABRE con el mismo arrastre. Se toca donde toca el usuario: la parte de la
            # pestana que el sistema no reclama.
            cx, cy = pest[0], pest[5] - 4
            print('  pestana en [%d,%d][%d,%d] -> toco (%d,%d), 4px sobre el borde inferior '
                  '(el centro y=%d cae en la barra de estado)'
                  % (pest[2], pest[3], pest[4], pest[5], cx, cy, pest[1]))
            adb('shell', 'cmd', 'statusbar', 'collapse')
            # El TOQUE QUIETO y el ARRASTRE son DOS veredictos, no un fallback. Fundirlos fue lo
            # que fabrico el falso "H-12 confirmado": el toque no abre (defecto real) y el
            # arrastre de 600px tampoco, pero por una razon legitima -- `onEnd` hace snap por
            # MITAD (`PanelFunciones.tsx:99-108`), y 600 de los ~1421 de recorrido es el 42%, asi
            # que volver a cerrado era el comportamiento CORRECTO. Un instrumento que arrastra
            # menos de la mitad mide su propio gesto corto y lo imputa a la app.
            # Medido 2026-10-11 en RF8T318RN9T: 42% no abre · 85% ABRE (capa 83 -> 1465 px).
            # TRES toques, no uno. H-62 (el primer gesto tras montar se pierde) hace que un
            # solo "no abre" no separe "el tap es inalcanzable" (H-60) de "se perdio el gesto".
            abrio_toque, xa = False, ''
            for i_tap in (1, 2, 3):
                toca_pt(cx, cy)
                abrio_toque, xa = esperar(lambda x: ve(x, 'tile-facturacion'), intentos=6)
                if abrio_toque:
                    print('  el escritorio abrio con el TOQUE numero %d de 3' % i_tap)
                    break
            resultados['__toque_pestana__'] = {'abrio': abrio_toque, 'intentos': 3,
                                               'animaciones': 1 if ANIM_NORMALES else 0}
            print('  toque quieto en la pestana: %s'
                  % ('ABRE' if abrio_toque else 'NO ABRE (el escritorio sigue cerrado)'))
            abrio, via = abrio_toque, 'toque-quieto'
            pantalla = re.search(r'bounds="\[0,0\]\[\d+,(\d+)\]"', xml)
            recorrido = (int(pantalla.group(1)) if pantalla else 1465) - 44
            dist = int(recorrido * 0.85)
            if not abrio:
                print('  -> pruebo ARRASTRE de %d px (85%% del recorrido %d; por debajo de %d el '
                      'snap lo devuelve a cerrado POR DISENO)' % (dist, recorrido, recorrido // 2))
                # DOS gestos, no uno. El PRIMER gesto tras montar la pantalla no hace efecto:
                # medido 3 de 3 ciclos (reset -> swipe1 no abre -> swipe2 ABRE). Un instrumento
                # que hace un solo arrastre siempre ejercita el que se pierde, y reporta
                # "inalcanzable" sobre un escritorio que si abre. Candidata del codigo:
                # `onEnd` arranca con `if (max <= 0) return` y `max` es `alto.value`, que fija
                # `onLayout`. Se usa `input swipe` con duracion DECLARADA: 20 `motionevent` son 20
                # comandos adb con jitter, y RNGH deriva `velocityY` de esos timestamps -- gesto
                # no reproducible (1 de 3). Con duracion fija, la velocidad deja de ser emergente.
                abrio = False
                for intento in (1, 2):
                    adb('shell', 'input', 'swipe', str(cx), str(cy), str(cx), str(cy + dist),
                        '800')
                    abrio, xa = esperar(lambda x: ve(x, 'tile-facturacion'), intentos=8)
                    if abrio:
                        print('  el escritorio abrio en el gesto %d de 2' % intento)
                        break
                    if intento == 1:
                        print('  gesto 1 sin efecto (esperado: ver H-63) -> repito')
                via = 'arrastre'
            resultados['__escritorio__'] = {'abrio': abrio, 'via': via if abrio else None,
                                            'abre_con_toque': abrio_toque}
            if not abrio:
                mal('el escritorio NO abrio ni con toque quieto ni con arrastre LARGO: las 6 rutas '
                    'del escritorio quedan inalcanzables desde el arranque (H-12 confirmado)')
            else:
                print('  el escritorio ABRIO via %s' % via)
                capturar('01-escritorio-abierto')
                def reabrir(xactual):
                    """Deja el escritorio ABIERTO y devuelve el arbol, o None.

                    Tras un KEYCODE_BACK el escritorio queda CERRADO. La v1 lo daba por abierto y
                    los tiles 2..6 salian 'tile no encontrado' / 'NO LLEGA' -- rojos del
                    instrumento con cara de rutas rotas, y encima en la direccion que confirmaba
                    lo que yo ya creia. El estado se RESTABLECE antes de cada medicion, no se
                    hereda de la anterior."""
                    if ve(xactual or '', 'tile-facturacion'):
                        return xactual
                    for _ in range(3):
                        adb('shell', 'input', 'swipe', str(cx), str(cy), str(cx), str(cy + dist),
                            '800')
                        hay, xr = esperar(lambda x: ve(x, 'tile-facturacion'), intentos=6)
                        if hay:
                            return xr
                    return None

                for ruta in TILES:
                    tids = dict(PANTALLAS)[ruta]
                    xa = reabrir(xa)
                    if xa is None:
                        resultados.setdefault(ruta, {})['eje_a'] = 'NO_ATRIBUIBLE_ESCRITORIO_CERRADO'
                        print('    %-18s eje A: NO ATRIBUIBLE (no logre reabrir el escritorio; '
                              'no es un veredicto sobre la ruta)' % ruta)
                        continue
                    tile = centro(xa, 'tile-%s' % ruta.strip('/'))
                    if not tile:
                        resultados.setdefault(ruta, {})['eje_a'] = 'TILE_NO_ENCONTRADO'
                        print('    %-18s eje A: tile no encontrado (con el escritorio ABIERTO '
                              'verificado)' % ruta)
                        continue
                    toca_pt(tile[0], tile[1])
                    lleg, _ = esperar(lambda x, t=tids: ve_alguno(x, t) is not None, intentos=8)
                    resultados.setdefault(ruta, {})['eje_a'] = 'LLEGA' if lleg else 'NO_LLEGA'
                    print('    %-18s eje A: %s' % (ruta, 'LLEGA' if lleg else 'NO LLEGA'))
                    if lleg:
                        capturar('A-' + ruta.strip('/'))
                    adb('shell', 'input', 'keyevent', 'KEYCODE_BACK')
                    _, xa2 = esperar(lambda x: ve(x, 'tile-facturacion'), intentos=6)
                    xa = xa2 or xa

    # -------------------------------------------------------- 5. EJE B: render por deep link
    if EJE in ('b', 'ambos'):
        print()
        print('  --- EJE B: RENDER por deep link (NO acredita alcanzabilidad: ver H-10) ---')
        for ruta, tids in PANTALLAS:
            # si algo dejo la cortina del sistema abierta, uiautomator ve la cortina y no la app:
            # todas las rutas saldrian NO_MONTA por una causa que no es de ninguna de ellas.
            adb('shell', 'cmd', 'statusbar', 'collapse')
            # PAR DE CONTRASTE (razon 2 del docstring): el arbol APILA, asi que "aparece" no es
            # evidencia si ya estaba. Se vuelve atras hasta que no este; si no se logra, se declara
            # NO_ATRIBUIBLE en vez de cantar un verde prestado.
            for _ in range(6):
                x0 = arbol(intentos=2)
                if x0 and ve_alguno(x0, tids) is None:
                    break
                adb('shell', 'input', 'keyevent', 'KEYCODE_BACK')
            else:
                x0 = arbol(intentos=2)
            previo = ve_alguno(x0, tids) if x0 else None
            adb('shell', 'am', 'start', '-a', 'android.intent.action.VIEW',
                '-d', '%s://%s' % (SCHEME, ruta.lstrip('/')))
            monto, xb = esperar(lambda x, t=tids: ve_alguno(x, t) is not None, intentos=8)
            cual = ve_alguno(xb, tids) if monto else None
            if previo:
                estado = 'NO_ATRIBUIBLE'   # ya estaba antes de navegar: el verde no seria de esta ruta
            else:
                estado = 'MONTA' if monto else 'NO_MONTA'
            resultados.setdefault(ruta, {})['eje_b'] = estado
            if cual:
                resultados[ruta]['testid_visto'] = cual
            print('    %-18s eje B: %-14s %s' % (ruta, estado, cual or ''))
            if estado == 'MONTA':
                capturar('B-' + (ruta.strip('/') or 'raiz'))
            elif estado == 'NO_MONTA':
                mal('%s no monto por deep link' % ruta)
finally:
    restaurar()
    print()
    print('  animaciones del sistema restauradas')

# -------------------------------------------------------- 6. reporte
salida = os.path.join(SAL, '2026-10-11-receta-device-resultado.json')
tmp = salida + '.parcial'
with io.open(tmp, 'w', encoding='utf-8') as f:
    json.dump(resultados, f, ensure_ascii=False, indent=2, sort_keys=True)
os.replace(tmp, salida)   # un `open(w)` que explota a mitad deja 0 bytes con cara de valido

monta = sum(1 for v in resultados.values() if v.get('eje_b') == 'MONTA')
llega = sum(1 for v in resultados.values() if v.get('eje_a') == 'LLEGA')
print('=' * 88)
print('  eje B (render)     : %d de %d' % (monta, len(PANTALLAS)))
print('  eje A (navegando)  : %d de %d tiles del escritorio' % (llega, len(TILES)))
print('  NO MEDIDO en eje A : las 5 del hub /ajustes y el resto de H-11. La alcanzabilidad es '
      'TRANSITIVA y esta tanda cubre SOLO el primer eslabon del escritorio.')
print('  NO MEDIDO en absoluto: la calidad de la animacion -- las escalas estuvieron en 0.')
print('  capturas  : %s' % CAPTURAS)
print('  resultado : %s' % salida)
if fallas:
    print('ROJO -- %d falla(s)' % len(fallas))
    raise SystemExit(1)
print('VERDE -- los dos ejes medidos, con control positivo, negativo y par de contraste.')
raise SystemExit(0)
