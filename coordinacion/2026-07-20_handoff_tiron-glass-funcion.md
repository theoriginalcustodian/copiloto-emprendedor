# HANDOFF — el tirón al minimizar el glass de FUNCIÓN

**De:** sesión de frontend de **DocuMed** (`Agencia_IA_HyC/documed-front`, branch `feat/frontend-h6-anclaje`)
**Para:** quien esté investigando el mismo salto en `copiloto-emprendedor`
**Fecha:** 2026-07-20
**Por qué existe este archivo:** el operador avisó que vos también estás atacando esto. Acá está **todo lo que ya se descartó**, para que no vuelvas a pagarlo. Lo más valioso de este documento no son las hipótesis vivas — son las **muertas** y las **herramientas que no sirven**.

---

## ✅ Lo primero, porque cambia cuánto de esto te sirve

Comparé los archivos de los dos repos hoy, byte a byte:

| Archivo | Estado |
|---|---|
| `apps/mobile/src/theme/glass/MarcoGlass.tsx` | **IDÉNTICO** (160 líneas) |
| `apps/mobile/src/shell/PanelDeslizable.tsx` | **IDÉNTICO** (260 líneas) |
| `apps/mobile/src/theme/glass/GlassIcon.tsx` | **IDÉNTICO** (183 líneas; sólo difieren CRLF vs LF) |

⇒ **Todos los números de línea de este documento aplican tal cual en tu repo.** No hace falta que los re-mapees. (DocuMed es un fork duro del copiloto y estos tres archivos todavía no divergieron.)

---

## El síntoma

Arrastrando **hacia abajo con el dedo** para minimizar/replegar:

- **Glass de FUNCIÓN** (los que abren desde un tile: "Informe por voz", "Ajustes", "Historias"…): el panel **se detiene en un punto** por un instante y después sigue. *"Se repliega bien pero sigue el salto."*
- **Chat principal**: **no pasa**. Se siente fluido.

Reproducible a mano, siempre. Palabras textuales del operador (2026-07-20): *"se sigue trabando en la mitad pero sólo en las funciones… en el chat principal no ocurre"*.

---

## ⛔ HIPÓTESIS YA REFUTADAS — no las repitas

| # | Hipótesis | Cómo se refutó |
|---|---|---|
| 1 | *"Es el `feGaussianBlur` de `GlassIcon`"* | **A/B en device apagando el filtro.** Con el filtro **APAGADO la cola empeoró** (150 ms ×2 + un 350 ms). Refutada por medición, no por argumento. |
| 2 | *"Es la composición de GPU"* | El **chat compone más** y va mejor. Ver la tabla de abajo. |
| 3 | *"Es jank general de render"* | El chat mide **peor en todas las métricas** y **se siente mejor**. Los agregados no explican este defecto. |
| 4 | *"Se detiene en un punto fijo ⇒ hay un umbral en el código"* | **Falsa, y era mi premisa.** Se auditó el camino completo del arrastre: no hay ninguna comparación contra constante entre `onStart` y `onEnd`. Detalle abajo. |

### La medición que refuta 2 y 3

| | Chat (NO se traba) | Función (SÍ se traba) |
|---|---|---|
| Frames janky | **11,31%** | 4,46% |
| Mediana | **31 ms** | 27 ms |
| GPU | **17 ms** | 14 ms |

**El que mide peor en todo es el que se siente bien.** Cualquier hipótesis que explique el defecto por "hace más trabajo" ya está contradicha por estos números.

---

## ⛔ HERRAMIENTAS QUE NO SIRVEN PARA ESTE BUG

Esto te ahorra horas:

1. **`adb shell input swipe` NO reproduce el síntoma.** Probado a 900 ms y a 2200 ms: **cero frames >40 ms** en ambos, mientras un dedo real produce uno de **150 ms**. Un A/B cuyo caso base no exhibe el defecto **no prueba nada** — casi me hace declarar culpable al filtro por eso. Todo experimento necesita **dedo humano**.

2. **`dumpsys gfxinfo <pkg> framestats` se DRENA en cada lectura.** Devolvió 2 frames en los tres intentos. Inútil acá. (El `gfxinfo` sin `framestats` sí sirve: da el histograma acumulado.)

3. **Los percentiles esconden este defecto.** Es un evento **raro en la cola**, no una saturación. Mirar el **histograma** y los **vsync perdidos**, nunca la mediana.

---

## 🔴 CORRECCIÓN DE PREMISA (esto es lo más importante que descubrimos)

**No son dos configuraciones del mismo componente. Son DOS implementaciones de gesto distintas, en dos archivos distintos, con dos hosts de navegación distintos.**

- Chat → `PanelDeslizable.tsx`
- Función → `MarcoGlass.tsx` (+ `presentation: transparentModal` en `app/_layout.tsx:117-118`)

Si arrancaste asumiendo "el mismo panel con distinto contenido", como hice yo, todo el razonamiento sale torcido.

### Y el camino del arrastre NO tiene ningún umbral

Auditado exhaustivamente (no por muestreo):

| Qué se buscó | Dónde | Resultado |
|---|---|---|
| Comparación contra constante durante el arrastre | `MarcoGlass.tsx:74-77` | **Ninguna.** Es `panelY.value = Math.max(inicio.value + e.translationY, 0)` y nada más. |
| `UMBRAL_CIERRE = 140` | `MarcoGlass.tsx:44` | Se evalúa **sólo en `onEnd`** (`:85`). Nunca durante el arrastre. |
| Estado de React durante el drag | `MarcoGlass.tsx` completo | **Cero `useState`.** El único `runOnJS` es `cerrar`, en `onEnd` (`:86`). |
| `useAnimatedReaction` / `useDerivedValue` | `src/` + `app/` | **0 hits.** |
| `onLayout` en el camino de la función | `src/` | **Ninguno.** |

**Conclusión dura:** entre `onStart` y `onEnd` el código no hace nada más que asignar un número a un shared value. Si hay un evento discreto, **viene de una capa por debajo** (react-native-screens, Fabric, el compositor de Android, `react-native-svg`), no del gesto.

**Y ojo con la ambigüedad que queda abierta:** un tirón que *se siente* en una posición fija también lo produce un evento a **tiempo fijo** desde el inicio del gesto — uno arrastra a velocidad parecida cada vez, así que *tiempo fijo ≈ posición fija*. **Eso todavía no está resuelto, y resolverlo es el próximo paso** (ver "Medición 1"), no elegir entre las hipótesis de abajo.

---

## Las 3 asimetrías reales que quedan (ninguna llega a "causa")

Van con su prior honesto. **Ninguna tiene un mecanismo que explique el "punto fijo".**

### A1 — SVG con `<Filter>/<FeGaussianBlur>` DENTRO del subárbol que se traslada · ~20%
`MarcoGlass.tsx:123` renderiza `<GlassIcon size={28}/>` **dentro** del `Animated.View`. `GlassIcon.tsx:147-149` es **el único `<Filter>` de todo el repo**. En el chat: **cero** — sus `GlassIcon` viven en `EscritorioFunciones`, en la capa estática (`PanelDeslizable.tsx:215`), **fuera** de lo que se mueve.

- **No es la hipótesis ya refutada.** Aquella varió *filtro on/off*; esta es *filtro dentro vs. fuera de lo que se traslada*. Variable distinta.
- **En contra:** trasladar un padre no re-renderiza el SVG. Lo mejor que se puede argumentar es un evento de una sola vez (capa fría), y eso predeciría el tirón **al principio**, no en el medio.

### A2 — Transparencia real debajo (`transparentModal`) vs. fondo opaco · ~10%
Chat: `raiz` con `backgroundColor` (`PanelDeslizable.tsx:201`). Función: **sin fondo** (`MarcoGlass.tsx:153`) + `contentStyle` transparente. Al bajar, el área liberada se compone a través de la pantalla entera (`FondoIluminado` SVG + escritorio + otro `CristalVidrio` con `elevation:20`).

- **En contra:** la ventana ya está en modo transparente desde la animación de apertura, así que el "primer frame transparente" ya ocurrió.

### A3 — El nodo animado está EN FLUJO (`flex:1`) en vez de absoluto · ~10%
`MarcoGlass.tsx:154` = `{flex:1}`. `PanelDeslizable.tsx:253` = `{position:'absolute', top/right/bottom/left:0, zIndex:3}`.
**El spike que midió 60 fps / 0% jank (`app/spike-panel.tsx:194-204`) usa la forma absoluta.** `MarcoGlass` nunca se midió con la forma que sí se validó. Vale como higiene aunque no sea la causa.

### Descartado por lectura de código (confianza alta)
- **El contenido de la función:** `PantallaAjustes` es estático puro (cero estado, cero timers) y **tiene el defecto igual**.
- **Re-render de React durante el drag:** imposible, `MarcoGlass` no tiene estado.
- **Config del gesto:** `Gesture.Pan()` sin offsets en ambos. Idéntica.
- **Carga de animación:** está **invertida** — el *chat* anima además una propiedad de **layout** (`height` del spacer, `PanelDeslizable.tsx:187-197`) por frame, y la función sólo transforma. El que hace *más* trabajo es el que se siente mejor.

---

## ▶️ EL ENTREGABLE: la medición que bisecta el problema entero

**Hacé esto ANTES de tocar una línea de producción.** Cuesta ~10 líneas y descarta dos tercios del espacio de búsqueda.

**Pregunta:** durante el tirón, ¿`panelY` deja de avanzar, o avanza liso y sólo los píxeles se detienen?

Instrumentar el worklet en `MarcoGlass.tsx:74-77`: acumular `[timestamp, panelY.value, e.translationY]` en un array del runtime de UI en cada `onUpdate`, y volcarlo con **un solo** `runOnJS` en `onEnd`. **Nunca un `console.log` por frame** — eso fabrica exactamente el jank que estás buscando. Leer por `adb logcat` y mirar los **deltas de tiempo entre muestras consecutivas**.

Discrimina de una:

| Lo que veas | Qué significa |
|---|---|
| **Hueco en los timestamps** (p. ej. 3 muestras y de golpe 150 ms) | El hilo de UI se bloqueó → el defecto es de **render/compositor**; A1/A2 vuelven a la mesa con dónde mirar. |
| **Timestamps parejos y `panelY` liso** | El valor nunca se detuvo: lo que se atrasa es el **dibujo**. A1/A2/A3 quedan **irrelevantes** y el problema es de presentación (screens / SurfaceFlinger). |
| **Timestamps parejos pero `e.translationY` salta** | Es de **entrada** (RNGH / InputDispatcher). Ninguna de las tres aplica. |

**Ninguna de esas tres ramas es la que las hipótesis de arriba asumen.** Por eso va primero.

### Si la Medición 1 dice "el hilo de UI se bloqueó" → Perfetto, no gfxinfo

```
adb shell perfetto -o /data/misc/perfetto-traces/t.pftrace -t 15s sched freq gfx view wm am
```

mientras el operador hace 3 arrastres **reales**. Sobrevive al dedo humano y **no se drena al leerlo**. Buscar el slice largo de `Choreographer#doFrame` / `DrawFrame` y ver **qué hay encima**: si dice `RNSVG` → A1; si dice composición/`Surface` → A2; si dice `layout` → A3.

### Los dos A/B de un renglón (sólo DESPUÉS de la Medición 1, y sólo si dio "bloqueo")

- **A1:** `MarcoGlass.tsx:123` → `<GlassIcon name={icono} size={28}/>` por `<View style={{width:28,height:28}}/>`. Aísla "SVG-con-filtro dentro de lo que se mueve".
- **A3:** `MarcoGlass.tsx:154` → `panel: {flex:1}` por `{position:'absolute', top:0,right:0,bottom:0,left:0}`. Iguala la forma que el spike midió a 60 fps.

Uno por vez, con dedo humano.

---

## 🐛 Defecto lateral, no relacionado — pero real

`MarcoGlass.tsx:76` **no tiene cota superior**: `Math.max(..., 0)` sin `Math.min`. El chat sí la tiene (`PanelDeslizable.tsx:165`). El panel de función se puede empujar indefinidamente fuera de pantalla. No explica el síntoma; conviene taparlo cuando toques el archivo.

---

## 🧠 Un hallazgo de HOY que te puede servir aunque sea de otro frente

Investigando el jank de la onda de audio (frente distinto, mismo device) apareció esto, y es un error conceptual que vale para cualquier animación de este repo:

> **`useNativeDriver: true` NO significa "corre en otro hilo". Significa "no pasa por JS".**
> El driver corre en el **hilo de UI**, dentro del callback del `Choreographer`
> (`NativeAnimatedModule$animatedFrameCallback → Choreographer#doFrame`), **compitiendo con el dibujo**.

Medido: la app quieta va a **2,8% de frames tarde y 0 vsync perdidos**; con N vistas animadas sube a **99%** con `Slow UI thread = 592`, y **bajar la cantidad de vistas a la mitad no cambia nada**. Si en algún momento sospechás que el arrastre compite con otra animación, ese es el mecanismo por el que podría hacerlo.

También apareció, en el mismo frente, un defecto que **puede estar en tu repo igual** (el archivo del cliente HTTP es compartido en origen): un efecto que dependía de un array recreado ~10 veces por segundo hacía `stop()`+`start()` sobre un `Animated.Value` del que colgaban N cadenas de nodos, y Android lo reportaba en cada vuelta:

```
NativeAnimatedNodesManager: Native animation workaround, frame lost as result of race condition
JSApplicationCausedNativeException: Illegal node ID set as an input for Animated.Add node
```

**Un frame perdido por carrera, en bucle.** Si ves esas líneas en `adb logcat --pid=$(adb shell pidof <pkg>)`, buscá un `useEffect` de animación que dependa de un objeto/array recreado por render. (En DocuMed: `Onda.tsx`, arreglado en el commit `a52ca54`.)

---

## Método, por si sirve

Esto ya falló 4 veces por ir con hipótesis sueltas. En DocuMed la regla que quedó es: **invocar `superpowers:systematic-debugging` al primer síntoma**, y su punto más útil acá es —

> **3+ fixes fallidos ⇒ no es una hipótesis fallida, es la arquitectura equivocada. Parar y discutir, no intentar el fix #4.**

Y el control que más rindió, siempre el mismo: **medir el baseline sin la cosa sospechada, antes del primer fix.** En el frente de la onda eso destrabó todo y era un solo comando; me lo salteé cuatro intentos seguidos.

---

## Contacto / trazabilidad

- Repo donde se hizo el análisis: `Agencia_IA_HyC/documed-front`, branch `feat/frontend-h6-anclaje`.
- Deuda registrada como **D-TIRON-GLASS-FUNCION** en la memoria del proyecto DocuMed.
- Si confirmás una causa, dejala escrita acá mismo: del lado de DocuMed el frente está **abierto y pausado por decisión del operador**, y vamos a leer este archivo antes de retomarlo.
