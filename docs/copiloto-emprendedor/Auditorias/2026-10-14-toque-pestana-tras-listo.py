# -*- coding: utf-8 -*-

"""SM-A1 — el toque de la pestaña del escritorio, medido DESDE QUE LA PESTAÑA ES VISIBLE y con el
estado de arranque CLASIFICADO (no asumido).

=== QUÉ CORRIGE RESPECTO DE `2026-10-11-toque-pestana-por-pixeles.py` ===
Aquel instrumento espera un tiempo FIJO tras el deep link y recién entonces toca, y reporta «abrió
en el toque N» sin saber QUÉ había en pantalla. Medido el 2026-10-14 en RF8T318RN9T eso mezcla TRES
cosas distintas bajo un solo número:
  1. La app arranca con la conversación ARRIBA tapando Mi día (el modelo cree que está abajo; hint
     «Escribile a Odobi» arriba — `PanelDeslizable.tsx` «DEVICE15 H3», «causa de fondo no aislada»).
     Con eso la pestaña NO EXISTE en pantalla y un toque en (360,79) no puede abrirla. Medido: ~la
     mitad de los arranques en frío de esta sesión.
  2. El toque quieto sobre la pestaña: vivía en el `onEnd` de un `Gesture.Pan()`, que sólo se activa
     al moverse más que el slop → un toque sin temblor nunca lo dispara (`PanGestureHandler.kt`
     `ACTION_UP: if (state == ACTIVE) end() else fail()`).
  3. Cuánto tarda la app en estar lista (35-40 s en frío con el dev-client).
Este instrumento las SEPARA: clasifica cada ciclo por lo que había en pantalla antes de tocar.

=== LO QUE LO HACE MEDIR Y NO SÓLO PRODUCIR NÚMEROS ===
- Referencia VALIDADA: la huella del rótulo «Bajá para tus funciones» sólo vale si trae TINTA y es
  estable (una referencia sobre un fondo liso hace que cualquier pantalla lisa cuente «visible»).
- Sensor ESPECÍFICO de la pestaña (la franja del rótulo), no un diff de pantalla entera: el contenido
  de Mi día que llega solo daba 30 % / 11 % / 66 % para el mismo resultado.
- Antes de contar un toque la pestaña debe estar visible y ESTABLE 3 lecturas seguidas.
- Un ciclo que arranca con la conversación arriba es `CHAT_ARRIBA`/`SIN_PESTANA`: se informa, NO
  cuenta como «no abre» ni como «abre» — es otro defecto y tiene otro dueño.
- Las escalas de animación se leen y deben ser normales (`null` = default 1.0).
- CONTROL POSITIVO: un arrastre real (DOWN/MOVE/UP, nunca `input tap`) abre el escritorio en la misma
  corrida; si no, la corrida entera es INVALIDA.

Uso:  python -I -u 2026-10-14-toque-pestana-tras-listo.py [--validos=N] [--intentos=M]
      Requiere Metro vivo (`adb reverse tcp:8081`) y la sesión ya iniciada en la app.


=== PRECONDICION DEL A/B (medida 2026-10-14) ===
Metro con CI=1 (`Metro is running in CI mode, reloads are disabled`) NO observa archivos: el device corre
el PRIMER build. Un fix editado despues no llega aunque `curl` al bundle lo muestre (otro grafo). Reiniciar
Metro entre variantes y verificar que el cambio llego. Medido asi: original 0 de 4 ciclos (12 toques),
fix 6 de 6 al primer toque, ambos con control positivo (arrastre de 1000 px -> 26,7 %).
"""
import subprocess
import sys
import time

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

PKG = 'app.copiloto.emprendedor'
DEEP = 'copiloto://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081'
CX, CY = 360, 79
ANCHO = 720
SALTO = 16
# Franja del rótulo «Bajá para tus funciones» (debajo de los íconos de la barra de estado, que
# cambian solos). Franja del asa de la conversación cuando está ARRIBA: «Escribile a Odobi».
FRANJA_ROTULO = (220, 500, 46, 62)
FRANJA_ASA_CHAT = (220, 500, 100, 122)
UMBRAL = 3.0
VALIDOS = next((int(a.split('=', 1)[1]) for a in sys.argv[1:] if a.startswith('--validos=')), 6)
INTENTOS = next((int(a.split('=', 1)[1]) for a in sys.argv[1:] if a.startswith('--intentos=')), 14)
TOPE_LISTO = 130
# 🔴 QUIETO: el arranque en frío se deja SIN ninguna interaccion adb durante estos segundos. Medido
# el 2026-10-14 en RF8T318RN9T (dev-client + Metro local), misma sonda, mismo codigo:
#   - primer screencap a los 50 s y luego cada 2 s  -> conversacion ARRIBA 25/25 lecturas, en 4 de 4;
#   - primer screencap a los 56 s o 62 s            -> Mi dia 8/8 lecturas, en 4 de 4.
# Mirar ANTES de que termine de montar deja la conversacion arriba (D-A) y se queda asi: el instrumento
# cambiaba lo que media. La condicion para VER no puede ser distinta de la del usuario.
QUIETO = 62


def adb(*a, t=180):
    return subprocess.run(('adb',) + a, capture_output=True, text=True, timeout=t,
                          errors='replace').stdout or ''


def fb():
    return subprocess.run(('adb', 'exec-out', 'screencap'), capture_output=True,
                          timeout=180).stdout[SALTO:]


def franja(buf, caja):
    x1, x2, y1, y2 = caja
    if len(buf) < ANCHO * 4 * y2:
        return b''
    return b''.join(buf[(y * ANCHO + x1) * 4:(y * ANCHO + x2) * 4] for y in range(y1, y2))


def tinta(f):
    """% de pixeles que difieren del color dominante de la franja (0 = fondo liso)."""
    if not f:
        return 0.0
    px = [f[i:i + 4] for i in range(0, len(f), 4)]
    dom = max(set(px), key=px.count)
    return 100.0 * sum(1 for p in px if p != dom) / len(px)


def dif(a, b):
    """% de bytes distintos; 100.0 si no son comparables. NUNCA None: `dif(...) or 100.0` tomaba un
    0,0 % (identicas) por «no comparable» y hacia imposible reconocer la pestana (visto 2026-10-14)."""
    if not a or not b or len(a) != len(b):
        return 100.0
    return 100.0 * sum(1 for x, y in zip(a, b) if x != y) / len(a)


def arrancar():
    # Sin `cmd statusbar collapse`: medido el 2026-10-14, los arranques precedidos de esa orden dejaron
    # la conversacion arriba 0 de 7 veces; sin ella, Mi dia 4 de 5 (misma sonda, mismo device).
    adb('shell', 'am', 'force-stop', PKG)
    adb('shell', 'am', 'start', '-a', 'android.intent.action.VIEW', '-d', DEEP)
    return time.time()


def estado(buf, ref):
    """Qué hay en pantalla, por pixeles: PESTANA | CHAT_ARRIBA | OTRO."""
    r = franja(buf, FRANJA_ROTULO)
    if ref and dif(ref, r) < UMBRAL:
        return 'PESTANA'
    if tinta(r) < 0.5 and tinta(franja(buf, FRANJA_ASA_CHAT)) >= 2.0:
        return 'CHAT_ARRIBA'
    return 'OTRO'


print('=' * 88)
print('SM-A1 -- toque de la pestana desde que es VISIBLE, estado de arranque clasificado')
print('=' * 88)
dev = [l for l in adb('devices').splitlines()[1:] if l.strip().endswith('device')]
if len(dev) != 1:
    print('INVALIDO: se espera exactamente 1 device con dueno unico; hay %d' % len(dev))
    raise SystemExit(3)
print('  device: %s' % dev[0].split()[0])
for s in ('window_animation_scale', 'transition_animation_scale', 'animator_duration_scale'):
    v = adb('shell', 'settings', 'get', 'global', s).strip()
    print('  %-28s %s' % (s, v))
    if v not in ('1', '1.0', 'null'):
        print('INVALIDO: con %s=%s esto mediria reduced-motion, no la condicion del usuario' % (s, v))
        raise SystemExit(3)

filas = []  # (intento, estado_inicial, t_listo, abrio_en, cambios)
ref = b''
n_validos = 0
print()
print('  --- hasta %d ciclos validos, maximo %d arranques en frio ---' % (VALIDOS, INTENTOS))
for intento in range(1, INTENTOS + 1):
    if n_validos >= VALIDOS:
        break
    t0 = arrancar()
    time.sleep(QUIETO)
    estable = 0
    t_listo = None
    while time.time() - t0 < TOPE_LISTO:
        buf = fb()
        if not ref:
            r = franja(buf, FRANJA_ROTULO)
            # Referencia: la primera franja con tinta que se repite estable entre dos capturas.
            if tinta(r) >= 2.0:
                time.sleep(1.0)
                r2 = franja(fb(), FRANJA_ROTULO)
                if dif(r, r2) <= 1.0:
                    ref = r2
                    print('    referencia del rotulo capturada a los %.0f s (tinta %.1f%%)'
                          % (time.time() - t0, tinta(ref)))
            time.sleep(1.0)
            continue
        if estado(buf, ref) == 'PESTANA':
            estable += 1
            if estable >= 3:
                t_listo = time.time() - t0
                break
        else:
            estable = 0
        time.sleep(2.0)
    if t_listo is None:
        # Nunca llego la pestana. Si la pantalla quedo con la conversacion arriba, se informa asi.
        e = 'CHAT_ARRIBA' if ref and estado(fb(), ref) == 'CHAT_ARRIBA' else 'SIN_PESTANA'
        filas.append((intento, e, None, None, []))
        print('    arranque %2d -> %s (la pestana no aparecio en %d s)' % (intento, e, TOPE_LISTO))
        continue
    cambios, abrio_en = [], 0
    for i in (1, 2, 3):
        # 🔴 `input tap` (un solo proceso, DOWN y UP a ~10 ms) y NO dos `input motionevent` sueltos: cada
        # `adb shell input ...` arranca una JVM en el device y deja ~0,3-0,6 s entre DOWN y UP — mas
        # que el `maxDuration(500)` del Tap, que entonces FALLA. Un dedo real suelta en ~100 ms. (La
        # regla «nunca `input tap`» es para el PAN, que exige moverse; el Tap es justo un toque.)
        adb('shell', 'input', 'tap', str(CX), str(CY))
        time.sleep(2.0)
        buf = fb()
        d = dif(ref, franja(buf, FRANJA_ROTULO))
        cambios.append(d)
        if estado(buf, ref) == 'CHAT_ARRIBA':
            abrio_en = -i  # la conversacion subio: otro defecto, no «abre»
            break
        if d is not None and d > UMBRAL:
            abrio_en = i
            break
    n_validos += 1
    filas.append((intento, 'PESTANA', t_listo, abrio_en, cambios))
    txt = ('abrio en el toque %d' % abrio_en if abrio_en > 0
           else 'CHAT SUBIO tras el toque %d' % -abrio_en if abrio_en < 0 else 'NO abrio en 3 toques')
    print('    arranque %2d -> pestana lista a los %5.1f s, %s   cambios: %s'
          % (intento, t_listo, txt, ' | '.join('%.1f%%' % c if c is not None else '?' for c in cambios)))

print()
print('  --- CONTROL POSITIVO: un arrastre real abre el escritorio en ESTA corrida ---')
dctl, ctl_ok = 0.0, False
for _ in range(4):
    t0 = arrancar()
    time.sleep(QUIETO)
    ok = False
    while time.time() - t0 < TOPE_LISTO:
        if ref and estado(fb(), ref) == 'PESTANA':
            ok = True
            break
        time.sleep(2.0)
    if not ok:
        continue
    time.sleep(3.0)
    # DOWN/MOVE/UP reales; `input swipe` los genera y el Pan se activa por distancia.
    adb('shell', 'input', 'swipe', str(CX), str(CY), str(CX), str(CY + 1000), '700')
    time.sleep(2.0)
    buf = fb()
    dctl = dif(ref, franja(buf, FRANJA_ROTULO))
    ctl_ok = dctl > UMBRAL and estado(buf, ref) != 'CHAT_ARRIBA'
    print('    arrastre de 1000 px -> franja %.1f%%   %s' % (dctl, 'MUEVE' if ctl_ok else 'no mueve'))
    break

print()
print('| arranque | estado inicial | lista (s) | abrio en el toque | cambio por toque |')
print('|---|---|---|---|---|')
for intento, e, tl, ab, cs in filas:
    print('| %d | %s | %s | %s | %s |'
          % (intento, e, '-' if tl is None else '%.1f' % tl,
             '-' if ab is None else ('CHAT SUBIO' if ab < 0 else (ab or '**ninguno de 3**')),
             ' . '.join('%.1f%%' % c if c is not None else '?' for c in cs)))
con_pestana = [f for f in filas if f[1] == 'PESTANA']
al_primero = [f for f in con_pestana if f[3] == 1]
sin_pestana = [f for f in filas if f[1] in ('CHAT_ARRIBA', 'SIN_PESTANA')]
print()
print('arranques=%d  con pestana=%d  SIN pestana (chat arriba u otro)=%d  tras-toque chat subio=%d'
      % (len(filas), len(con_pestana), len(sin_pestana),
         len([f for f in con_pestana if f[3] is not None and f[3] < 0])))
if not ctl_ok:
    print('VEREDICTO: INVALIDO -- el arrastre no abrio el escritorio; la corrida no dice nada.')
    raise SystemExit(3)
if not con_pestana:
    print('VEREDICTO: ningun arranque dejo la pestana visible; no se pudo medir el toque.')
    raise SystemExit(3)
print('VEREDICTO: abrio AL PRIMER TOQUE (pestana ya visible y estable) en %d de %d ciclos con pestana.'
      % (len(al_primero), len(con_pestana)))
raise SystemExit(0 if len(al_primero) == len(con_pestana) else 1)
