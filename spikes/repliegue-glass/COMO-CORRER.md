# Medición 1 — el tirón del glass de función

> **Estado:** instrumento listo, **medición PENDIENTE**. Requiere dedo humano.
> **Origen:** `coordinacion/2026-07-20_handoff_tiron-glass-funcion.md` (sesión de frontend de DocuMed).
> **Device:** `SM-A217M` (`RF8R50N2WGR`), 720×1600, Android 12 — el mismo con el que midieron ellos.

---

## Por qué esto no lo puede correr el agente solo

Está verificado en device que **`adb shell input swipe` no reproduce el defecto**: cero frames >40 ms a 900 ms y a 2200 ms, mientras un dedo real produce uno de 150 ms.

Eso no es un detalle de comodidad. Un A/B cuyo **caso base no exhibe el síntoma** no prueba nada — y a la otra sesión casi le hace declarar culpable al filtro SVG. Si el instrumento no ve el defecto, cualquier variante "sin defecto" es indistinguible de una variante que no se midió.

El sprint autónomo llega hasta acá: instrumento listo, procedimiento escrito. La corrida es tuya.

---

## Qué pregunta responde

> Durante el tirón, ¿`panelY` **deja de avanzar**, o avanza liso y sólo **los píxeles** se detienen?

Las tres respuestas posibles mandan a capas distintas del stack y son incompatibles entre sí. Por eso esto va **antes** de cualquier A/B: bisecta el espacio de búsqueda de una.

| Lo que salga | Qué significa | Dónde seguir |
|---|---|---|
| Hueco en los timestamps | el hilo de UI se bloqueó | render/compositor → Perfetto |
| Timestamps parejos, `panelY` liso | el valor nunca se detuvo; se atrasa el **dibujo** | screens / SurfaceFlinger |
| Timestamps parejos, `translationY` salta | es de **entrada** | gesture-handler / InputDispatcher |

---

## Las variantes (factorial 2×2)

Sobre las dos asimetrías que el handoff dejó vivas:

| | forma del nodo | ícono SVG dentro de lo que se traslada |
|---|---|---|
| **V1-base** | `flex:1` | sí |
| **V2-absoluto** | `absoluto` | sí |
| **V3-sin-svg** | `flex:1` | no |
| **V4-ambos** | `absoluto` | no |

**V1 reproduce `MarcoGlass` tal cual.** Es el control: si V1 no se traba, la corrida no vale y hay que repetirla.

---

## Procedimiento

```bash
# 1. La app tiene que estar instalada y abierta en la pantalla /spike
bash scripts/sprint-mobile/S3-device-harness.sh check

# 2. Capturar el volcado (dejar corriendo en otra terminal)
adb logcat -c
adb logcat | grep --line-buffered SPIKE_REPLIEGUE > _evidencia/medicion1.log

# 3. En el teléfono, por CADA variante (V1 → V2 → V3 → V4):
#      - tocar la tarjeta
#      - arrastrar el handle hacia abajo, LENTO y LARGO, con el dedo
#      - repetir ~5 veces
#    Anotá a ojo en cuáles sentiste el tirón: sirve para contrastar con el número.

# 4. Cortar el logcat (Ctrl-C) y analizar
node scripts/sprint-mobile/S7-parse-medicion1.mjs _evidencia/medicion1.log
```

**Arrastrar lento importa.** El defecto es un evento raro en la cola; un swipe corto y rápido puede no atravesarlo.

---

## Cómo leer la salida

S7 imprime, por variante: el peor delta de cada gesto, cuántos gestos tuvieron hueco, y dos dispersiones:

- **dispersión del punto (px)** — si es baja, el tirón cae siempre en el mismo **lugar** de la pantalla.
- **dispersión del instante (ms)** — si es baja, cae siempre en el mismo **momento** del gesto.

Esa distinción es la que el handoff deja explícitamente abierta, y no se puede resolver a ojo: arrastrando siempre a velocidad parecida, "mismo lugar" y "mismo momento" se ven idénticos. La magnitud que se repite es la que manda.

Al final, S7 avisa si **el caso base no exhibió el defecto**. Si eso pasa, **la corrida no es concluyente** — no importa lo lindos que se vean los números de las otras variantes.

---

## Lo que este spike NO prueba

- **No prueba que la causa esté entre A1 y A3.** Sólo mide si esas dos asimetrías cambian algo. El handoff les asigna ~20% y ~10% de prior, y avisa que ninguna tiene un mecanismo que explique un "punto fijo".
- **No descarta el compositor ni SurfaceFlinger.** Si el veredicto es "atraso de dibujo", el instrumento correcto pasa a ser Perfetto, no esto.
- **No mide el cierre.** El repliegue final quedó fuera a propósito: el síntoma que se investiga ocurre durante el arrastre.
- **Un V4 verde no es una solución.** Sería una pista sobre dónde mirar. Cambiar dos cosas a la vez no aísla cuál importó — para eso están V2 y V3 por separado.

---

## Hipótesis ya refutadas — no repetirlas

Del handoff, todas refutadas **por medición**, no por argumento:

1. *"Es el `feGaussianBlur` de `GlassIcon`"* — con el filtro apagado la cola **empeoró** (150 ms ×2 + un 350 ms).
2. *"Es la composición de GPU"* — el chat compone más y va mejor.
3. *"Es jank general de render"* — el chat mide peor en **todas** las métricas y se siente mejor (11,31% de frames janky vs 4,46%; mediana 31 ms vs 27 ms).
4. *"Se detiene en un punto fijo ⇒ hay un umbral en el código"* — auditoría exhaustiva del camino del arrastre: no hay ninguna comparación contra constante entre `onStart` y `onEnd`.

Y una quinta, de esta sesión: *"el tirón viene del traspaso gesto→router al soltar"*. Refutada por (4) y porque el síntoma ocurre **durante** el arrastre.

---

## Si la Medición 1 dice "el hilo de UI se bloqueó"

Entonces el instrumento pasa a ser Perfetto, que sobrevive al dedo humano y **no se drena al leerlo** (a diferencia de `gfxinfo framestats`):

```bash
adb shell perfetto -o /data/misc/perfetto-traces/t.pftrace -t 15s sched freq gfx view wm am
```

Buscar el slice largo de `Choreographer#doFrame` / `DrawFrame` y mirar **qué hay encima**: `RNSVG` → A1 · composición/`Surface` → A2 · `layout` → A3.

---

## Cuando haya resultado

Escribir `RESULT.md` en esta carpeta con los números, el veredicto y una sección **"Qué NO prueba"**. Y dejarlo también en `coordinacion/2026-07-20_handoff_tiron-glass-funcion.md`: del lado de DocuMed el frente está abierto y pausado, y van a leer ese archivo antes de retomarlo.
