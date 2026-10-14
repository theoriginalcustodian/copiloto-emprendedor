# -*- coding: utf-8 -*-
"""El TOQUE de la pestaña del escritorio, medido por PIXELES y con las animaciones NORMALES.

=== POR QUE EXISTE UN SEGUNDO INSTRUMENTO, Y NO ES REDUNDANTE ===
La receta hermana (`2026-10-11-receta-device-21-pantallas.py`) lee la UI con `uiautomator dump`, que
**no consigue idle mientras algo anima**. La portada de la app anima siempre (ecualizador + halo), así
que la receta apaga las tres escalas de animación del sistema para poder ver. El problema es que eso
pone a **Reanimated en *reduced motion*** (lo avisa en el bundle) -- y en esa condición el toque de la
pestaña **no abre nunca**. Con las escalas en su valor normal, **sí abre**.

Es decir: la condición que el instrumento exigía para VER cambiaba lo que había que ver, y el primer
veredicto ("el tap es inalcanzable", con causa deducida de la skill canónica de RNGH) no sobrevivió
fuera de ella. Corriendo la receta con `--animaciones=normales` se ve el otro lado del mismo problema:
corta con "0 nodos, 0 resource-ids" -- su sensor **no existe** en la condición del usuario.

Este instrumento usa un sensor que no necesita idle: el porcentaje de BYTES distintos entre dos
framebuffers crudos (`adb exec-out screencap` sin `-p`; no se parsea el header, se saltean 16 bytes y
se comparan los payloads, que tienen el mismo largo).

=== LO QUE HACE QUE ESTO MIDA Y NO SOLO PRODUZCA NUMEROS ===
1. PISO DE RUIDO, medido antes de usarse. La portada anima sola: dos capturas consecutivas sin tocar
   nada ya difieren (~0,29 % medido en RF8T318RN9T). Sin esa línea base cualquier cambio "parece"
   apertura. El umbral se deriva del piso, no se elige.
2. TRES CICLOS CON RESET COMPLETO (force-stop + deep link). Un solo ciclo no separa "el tap no llega"
   de "el primer gesto tras montar se pierde" (H-62) -- y reescribir un hallazgo rojo sobre n=1 es
   cambiar una afirmación frágil por otra.
3. TRES TOQUES POR CICLO, registrando en cuál cambió la pantalla. Un ciclo donde ninguno abra también
   es dato: el comportamiento es intermitente y eso es parte del hallazgo.
4. CONTROL POSITIVO: el arrastre largo (85 % del recorrido) tiene que mover la pantalla en la misma
   corrida. Si no la mueve, el sensor o las coordenadas están mal y la corrida se declara INVALIDA en
   vez de concluir "no abre" -- que es exactamente el falso rojo que esta tanda ya pagó dos veces.
5. Lo que queda por debajo del umbral NO se atribuye. Un 4,86 % puede ser un snap a medias o un
   overlay; decir cuál sin medirlo sería volver a hacer lo que este instrumento vino a corregir.

Coordenadas: pantalla 720x1465, pestaña en [0,1][720,83] -> toque en (360,79). NO inventadas: medidas
con `uiautomator` en ESTE device cuando las animaciones estaban en 0. El centro de la pestaña (y=42)
cae DENTRO de la barra de estado del sistema, que se queda con el toque; de ahí los 4 px sobre el
borde inferior. Si la app no estuviera en la portada, el control positivo lo delata.

Uso:  python -I -u 2026-10-11-toque-pestana-por-pixeles.py [--ciclos=N]
      (requiere Metro vivo con EXPO_PUBLIC_API_BASE y la sesión ya iniciada en la app: este
      instrumento NO sabe loguear -- sin árbol de UI no hay cómo ubicar los campos. Si la app
      arranca en el login, el control positivo sale en rojo y la corrida se declara inválida.)
"""
import subprocess
import sys
import time

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

PKG = 'app.copiloto.emprendedor'
DEEP = 'copiloto://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081'
CX, CY = 360, 79
ALTO_PANTALLA = 1465
SALTO = 16
ESCALAS = ('window_animation_scale', 'transition_animation_scale', 'animator_duration_scale')
CICLOS = next((int(a.split('=', 1)[1]) for a in sys.argv[1:] if a.startswith('--ciclos=')), 3)


def adb(*a, t=180):
    return subprocess.run(('adb',) + a, capture_output=True, text=True, timeout=t,
                          errors='replace').stdout or ''


def fb():
    """Framebuffer crudo. No necesita idle: lee lo que hay."""
    return subprocess.run(('adb', 'exec-out', 'screencap'),
                          capture_output=True, timeout=180).stdout[SALTO:]


def dif(a, b):
    if not a or not b or len(a) != len(b):
        return None
    return 100.0 * sum(1 for x, y in zip(a, b) if x != y) / len(a)


def toque():
    adb('shell', 'input', 'motionevent', 'DOWN', str(CX), str(CY))
    adb('shell', 'input', 'motionevent', 'UP', str(CX), str(CY))


print('=' * 88)
print('TOQUE DE LA PESTANA -- sensor de pixeles, animaciones del sistema SIN TOCAR')
print('=' * 88)
dev = [l for l in adb('devices').splitlines()[1:] if l.strip().endswith('device')]
if len(dev) != 1:
    print('INVALIDO: se espera exactamente 1 device con dueno unico; hay %d' % len(dev))
    raise SystemExit(3)
print('  device: %s' % dev[0].split()[0])

for s in ESCALAS:
    v = adb('shell', 'settings', 'get', 'global', s).strip()
    print('  %-28s %s' % (s, v))
    # `settings get` devuelve `null` cuando la escala nunca se tocó: Android aplica su default, 1.0
    # (medido en RF8T318RN9T el 2026-10-14). Eso ES el valor normal; sólo 0/0.5/etc. lo cambian.
    if v not in ('1', '1.0', 'null'):
        print('INVALIDO: este instrumento mide la condicion NORMAL; con %s=%s mediria la otra, que '
              'es la que ya se sabe que da "no abre"' % (s, v))
        raise SystemExit(3)

print()
print('  --- piso de RUIDO del sensor (la portada anima sola) ---')
adb('shell', 'cmd', 'statusbar', 'collapse')
adb('shell', 'am', 'force-stop', PKG)
adb('shell', 'am', 'start', '-a', 'android.intent.action.VIEW', '-d', DEEP)
time.sleep(15)
if PKG not in adb('shell', 'dumpsys', 'activity', 'activities'):
    print('INVALIDO: la app no tomo el foco tras el deep link')
    raise SystemExit(3)
ruidos, base = [], fb()
for i in range(1, 4):
    time.sleep(1.2)
    otra = fb()
    d = dif(base, otra)
    if d is None:
        print('INVALIDO: capturas de distinto largo; el sensor no es comparable')
        raise SystemExit(3)
    ruidos.append(d)
    print('    ruido %d: %.2f%%' % (i, d))
    base = otra
umbral = max(max(ruidos) * 4, 8.0)
print('    piso=%.2f%% -> umbral de APERTURA=%.2f%%' % (max(ruidos), umbral))

print()
print('  --- el TOQUE quieto, %d ciclos con reset completo ---' % CICLOS)
filas = []
for ciclo in range(1, CICLOS + 1):
    if ciclo > 1:
        adb('shell', 'cmd', 'statusbar', 'collapse')
        adb('shell', 'am', 'force-stop', PKG)
        adb('shell', 'am', 'start', '-a', 'android.intent.action.VIEW', '-d', DEEP)
        time.sleep(15)
        if PKG not in adb('shell', 'dumpsys', 'activity', 'activities'):
            print('    ciclo %d INVALIDO: la app no tomo el foco' % ciclo)
            filas.append((ciclo, None, []))
            continue
    adb('shell', 'cmd', 'statusbar', 'collapse')
    time.sleep(1.5)
    cambios, abrio_en = [], 0
    for i in (1, 2, 3):
        antes = fb()
        toque()
        time.sleep(2.0)
        d = dif(antes, fb())
        cambios.append(d)
        if d is not None and d > umbral:
            abrio_en = i
            break
    filas.append((ciclo, abrio_en, cambios))
    print('    ciclo %d -> abrio en el toque %-7s  cambios: %s'
          % (ciclo, abrio_en or 'NINGUNO',
             ' | '.join('%.2f%%' % c if c is not None else '?' for c in cambios)))

print()
print('  --- CONTROL POSITIVO: el arrastre largo mueve la pantalla en ESTA corrida ---')
dist = int((ALTO_PANTALLA - 44) * 0.85)
abrio_swipe, dmax = False, 0.0
for i in (1, 2):
    adb('shell', 'cmd', 'statusbar', 'collapse')
    antes = fb()
    adb('shell', 'input', 'swipe', str(CX), str(CY), str(CX), str(CY + dist), '800')
    time.sleep(2.0)
    d = dif(antes, fb()) or 0.0
    dmax = max(dmax, d)
    print('    arrastre %d de %d px -> %.2f%%   %s'
          % (i, dist, d, 'MUEVE' if d > umbral else 'no mueve'))
    if d > umbral:
        abrio_swipe = True
        break

print()
print('| ciclo | abrio en el toque | cambio de pantalla por toque |')
print('|---|---|---|')
for ciclo, abrio, cambios in filas:
    print('| %d | %s | %s |'
          % (ciclo, 'INVALIDO' if abrio is None else (abrio or '**ninguno de 3**'),
             ' . '.join('%.2f%%' % c if c is not None else '?' for c in cambios)))

validos = [f[1] for f in filas if f[1] is not None]
abrieron = [v for v in validos if v]
print()
if not abrio_swipe:
    print('VEREDICTO: INVALIDO -- ni el arrastre movio la pantalla (max %.2f%% <= %.2f%%). El sensor, '
          'las coordenadas o' % (dmax, umbral))
    print('           la pantalla de arranque estan mal: esta corrida NO dice nada sobre el toque.')
    raise SystemExit(3)
if not validos:
    print('VEREDICTO: ningun ciclo valido.')
    raise SystemExit(3)
print('VEREDICTO: el toque abrio en %d de %d ciclos validos%s.'
      % (len(abrieron), len(validos),
         ' (siempre en el intento %d)' % abrieron[0]
         if abrieron and len(set(abrieron)) == 1 else ''))
if all(c and c[0] is not None and c[0] <= umbral for _, _, c in filas if c):
    print('           Y el PRIMER toque no abrio en ninguno: el gesto perdido de H-62 no es del')
    print('           arrastre, es del primer gesto cualquiera sea su tipo.')
raise SystemExit(0 if abrieron else 1)
