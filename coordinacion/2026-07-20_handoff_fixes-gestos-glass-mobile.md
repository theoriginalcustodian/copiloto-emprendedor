# HANDOFF — aplicar los fixes de gestos / vidrio / tap del mobile

**De:** sesión de frontend de **DocuMed** (`Agencia_IA_HyC/documed-front`, branch `feat/frontend-h6-anclaje`)
**Para:** la sesión de **copiloto-emprendedor** que trabaja `apps/mobile/`
**Fecha:** 2026-07-20
**Por qué existe:** el operador probó estos arreglos en device (Samsung real) y quiere que tu copia los tenga también. Tu mobile es una copia **anterior** a nuestro trabajo de estos días. Acá está cada fix con causa raíz, el cambio exacto, la trampa que casi me come, y —lo más importante— **qué aplica a tu repo y qué no**, porque los repos ya divergieron y copiar a ciegas te rompe cosas.

> **Hermano de este doc:** `2026-07-20_handoff_tiron-glass-funcion.md` (misma carpeta), sobre el tirón al minimizar el glass de función. Ese es una **investigación abierta**; éste son **fixes cerrados y probados**. Se cruzan en un solo punto (el `FeGaussianBlur`), y lo marco abajo.

---

## 0. LO PRIMERO — la realidad de los dos repos (verificado HOY, no de memoria)

Comparé tu `apps/mobile` contra el nuestro hoy. **No son el mismo app.** Comparten las **primitivas de vidrio/shell** (la capa plantilla), pero tu mobile **no tiene la capa de grabación ni la clínica** que DocuMed le agregó encima:

| Tu módulo `chat` tiene | Tu mobile NO tiene |
|---|---|
| `Burbuja`, `Composer`, `ListaMensajes`, `useChat` (chat de texto) | `captura/` (grabación clínica) · `HudGrabacion` · `GlassGrabacionCopiloto` · `useVozComando` · `historias/` · `pacientes/` |

Por eso los fixes se parten limpio en dos grupos. **Control corrido hoy sobre tus archivos** (grep de los imports reales, no supuesto):

| # | Fix | Archivo | ¿Aplica a tu repo? | Estado verificado en TU código hoy |
|---|---|---|---|---|
| **B** | Tap perdido — `ScrollView` de RNGH | `src/modules/escritorio/EscritorioFunciones.tsx` | ✅ **SÍ** | `ScrollView` importado de `react-native` → **bug presente** |
| **C** | Tap perdido (2ª mitad) — `Pressable` de RNGH | `src/theme/glass/Tile.tsx` | ✅ **SÍ** | `Pressable` de `react-native` → **bug presente** |
| **D** | Quitar el "hundido" del tile al presionar | `src/theme/glass/Tile.tsx` | ✅ **SÍ** | `PRESS_SCALE` en `pressed` → **movimiento presente** |
| **F** | ⛔ Panel "clavado" — **fix RETIRADO, no lo apliques** | `src/shell/PanelDeslizable.tsx` | ❌ **NO** | tu versión SIN `useFocusEffect` YA es la correcta. El "fix" clavaba el chat — ver §1 |
| **E** | Un solo glass a la vez (lock por foco) | `src/navegacion/empujarUnaVez.ts` (nuevo) + tu home | ✅ **SÍ (patrón)** | el cableado difiere: tu home es `app/index.tsx`, tus tiles van a otras rutas |
| **G** | Render lento del glass = `FeGaussianBlur` | `src/theme/glass/GlassIcon.tsx` | ⚠️ **TRADE-OFF** | `FeGaussianBlur` presente; **decidir en device** (choca con el otro handoff) |
| **A** | Rutas con header nativo → lenguaje de vidrio | rutas sueltas | ⚠️ **quizá N/A** | tu `_layout.tsx` no usa `transparentModal`/`slide_from_bottom` → tu capa de rutas divergió |
| **H** | Rediseño del glass de grabación (desde abajo + solo Enviar) | grabación | ❌ **sin destino hoy** | tu mobile no tiene grabación — patrón por si la agregás |

> ⚠️ **Nada de esto está commiteado salvo `ef7dcc2`.** Los cambios viven en nuestro working tree. **No intentes cherry-pick de nuestra branch** — aplicá el cambio descrito. Y **no copies los instrumentos temporales** que quedaron en varios archivos: la lista está en §7.

---

## 1. (F) ⛔ El "fix" del panel clavado — NO lo apliques. Fue un error, lo retiramos.

> **Corrección importante (2026-07-20, después de probar en device).** La versión anterior de este handoff te decía que agregaras un `useFocusEffect` a `PanelDeslizable.tsx` para arreglar un "panel clavado al volver de un glass". **Ese fix estaba mal y clavó el chat principal.** Lo retiré. **Tu `PanelDeslizable.tsx`, tal como está hoy —SIN `useFocusEffect`—, ya es la versión correcta. No le agregues nada.** Si copiaste ese bloque de la versión anterior, sacalo.

**Qué pasó, para que no repitas el pozo:**

- El síntoma que ese fix decía atacar (*"al volver de una función el panel queda topeado"*) **probablemente no existía** en nuestra config. `PanelDeslizable` **no se desmonta** cuando se abre un glass: el glass se monta *encima* (en DocuMed, `transparentModal` sobre la pantalla que sigue montada). Como el componente sigue vivo, `panelY` conserva su valor y el panel queda exactamente donde se lo dejó. No hay desincronización que reparar.
- El `useFocusEffect` metía un **tercer writer** de `panelY` que se disparaba en **cada foco** —o sea en cada apertura/cierre de glass— y lo pisaba con `panelAbajo ? recorrido : 0`, leyendo `recorrido`/`panelAbajo` que en ese instante podían estar sin actualizar. Resultado, reportado por el operador en el teléfono: **el chat dejó de deslizar**.

> 🔴 **La invariante real:** `panelY` tiene **exactamente dos dueños — el gesto (`Gesture.Pan`) y `senalSubir`**. Cualquier tercer writer (foco, un efecto de sincronización, un layout) reintroduce la carrera y clava el panel. En nuestro `PanelDeslizable.tsx` dejé esta advertencia escrita en el lugar donde estaba el bug, justamente para que nadie —yo incluido— lo vuelva a agregar.

**Si en TU repo el panel SÍ se desincroniza al navegar** (tu config difiere: tu `_layout.tsx` no usa `transparentModal`, así que puede que tus glass sean rutas reales que SÍ desmontan el panel) → **instrumentá y encontrá la causa** antes de tocar. No la tapes con un writer atado al foco: el precio es clavar la interacción principal. La pregunta correcta es *"¿el componente se desmonta al navegar?"* — si sí, el arreglo va del lado de la navegación (mantenerlo montado, o rehidratar `panelY` de una fuente única), no de un efecto que pelea con el gesto.

**Sobre el mock de `jest.setup.js`** que mencionaba la versión anterior: era para ese `useFocusEffect`. Como ya no está en `PanelDeslizable`, **no lo necesitás para el shell**. Sólo te sirve si testeás las pantallas del lock de navegación (§4), que sí usan `useFocusEffect`:

```js
jest.mock('expo-router', () => {
  const real = jest.requireActual('expo-router');
  const { useEffect } = require('react');
  return { ...real, useFocusEffect: (cb) => useEffect(cb, [cb]) };
});
```

---

## 2. (B + C) El tap corto se perdía — "tengo que tocar dos veces" — y por qué son DOS mitades

**Síntoma (operador):** *"a veces tengo que hacer tap dos veces en un icono para que abra… pero es random"*. Con taps rápidos, peor.

**Causa raíz, medida** (registrador de 3 capas, 1 grupo sin `OK` sobre 97 eventos):

```
IN         tile=tile-historias
RAW-CANCEL tile=tile-historias      ← el toque se cancela
SCROLL-DRAG-INICIO                   ← y el ScrollView reclama el gesto
```

El `ScrollView` del escritorio (del **responder system de react-native**) compite con los gestos de **RNGH** que viven en el mismo árbol. Un tap rápido arrastra unos píxeles al despegar, el scroll lo interpreta como drag y se lo lleva. Es la regla §Critical Rules de Software Mansion: **nunca mezclar el touch system de RN con RNGH en el mismo árbol** — hay que poner los dos en la misma arena.

**Son dos mitades y hacen falta las dos** (yo apliqué sólo la primera en `ef7dcc2` y el bug siguió):

**Mitad B — `EscritorioFunciones.tsx`.** Tu línea 32 hoy es:
```tsx
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
```
El `ScrollView` (y cualquier `Pressable`/touchable que viva **dentro** de ese scroll) tiene que salir de RNGH:
```tsx
import { StyleSheet, Text, View } from 'react-native';
import { Pressable, ScrollView } from 'react-native-gesture-handler';
```

**Mitad C — `Tile.tsx`.** Tu línea 13 hoy:
```tsx
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
```
→
```tsx
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
```
La API es idéntica (mismo `style={({ pressed }) => …}` — aunque ese `pressed` lo sacamos en el fix D). No cambia nada más.

---

## 3. (D) El tile se "hundía" al presionar y el glass sólo abría al soltar

**Síntoma (operador):** *"el ícono tiene movimiento, se va hacia atrás como un botón presionado y cuando se vuelve a levantar ahí recién lanza el glass… que sean fijos"*.

**Fix:** el `scale(.95)` en `pressed` daba esa sensación de "esperar a que el botón vuelva". En `Tile.tsx`, sacá el `PRESS_SCALE`:

```tsx
// borrar el import:
// import { PRESS_SCALE } from './presion';

// en el style callback, cambiar la firma y borrar la línea del scale:
style={() => [            // ← ya no recibe { pressed }
  styles.raiz,
  { borderColor: g.bd },
  sombraTile(g.sombra),
  // borrado: pressed && onPress ? PRESS_SCALE : null,
  style,
]}
```

El acuse del toque ahora lo da la navegación misma (el glass sube), no una animación de la card. Si tenés un test de "feedback de presión" (nosotros: `presion.test.tsx`), agregá `Tile.tsx` a su allowlist con la razón: *tiles fijos por pedido del operador (2026-07-20)*.

---

## 4. (E) Solo un glass a la vez — "si apreto varios rápido se abren varios"

**Síntoma (operador), en dos pasos:** *"si apreto rápido dos veces abre dos glass diferentes de la misma función"* → y la regla completa: *"solo puede abrirse un solo glass hasta minimizarlo y volver a la pantalla de funciones"*.

**Causa raíz:** cada tile hace `router.push`, y `push` **apila sin preguntar**. La navegación no tenía invariante de "uno a la vez".

**Por qué un lock por FOCO y no por tiempo:** un lock temporal (ignorar pushes N ms) tapa el doble-tap pero no la regla real — si el sistema entrega un toque encolado 2 s después con el glass abierto, el tiempo ya expiró y apila igual. La invariante correcta no es "no dos seguidos", es "**no otro mientras haya uno abierto**". Eso es exactamente el foco.

**Archivo nuevo — copiá verbatim** `src/navegacion/empujarUnaVez.ts`:

```ts
import { router } from 'expo-router';

let puertaAbierta = true;

/** La llama el `useFocusEffect` de cada pantalla lanzadora al ganar foco: reabre la puerta. */
export function reabrirNavegacion(): void {
  puertaAbierta = true;
}

export function empujarUnaVez(ruta: string): void {
  if (!puertaAbierta) return;
  puertaAbierta = false;
  router.push(ruta as never);
}
```

**Cableado (adaptá a TU app — tu home es `app/index.tsx`, tus tiles van a tus rutas):**

1. En **cada pantalla lanzadora** (la que tiene tiles que abren glass — tu home, y cualquier pantalla-menú), agregá al montar:
   ```tsx
   import { useFocusEffect } from 'expo-router';
   import { useCallback } from 'react';
   import { reabrirNavegacion } from '../src/navegacion/empujarUnaVez';

   useFocusEffect(useCallback(() => { reabrirNavegacion(); }, []));
   ```
2. Reemplazá **cada** `router.push('/x')` de esos tiles por `empujarUnaVez('/x')`.
3. **Excepción:** lo que NO abre una ruta nueva (en nuestro caso, el chat que sube el panel que ya está montado) se queda como está — no lo pases por el lock.

Funciona con **un solo flag global** porque sólo una pantalla tiene foco a la vez (el modal de arriba). La puerta se cierra al lanzar (síncrono, así el 2º tap ya la ve cerrada) y se reabre cuando la lanzadora recupera el foco.

---

## 5. (G) ⚠️ Render lento del glass = `FeGaussianBlur` — TRADE-OFF, leé esto antes de tocar

**Síntoma (operador):** un glass (en nuestro caso Ajustes) *"aparece de golpe, no sube desde abajo como el resto"*.

**Lo que medí:** con sus 6 iconos, el primer render de ese glass cuesta **~865 ms** (control, otro glass: ~410 ms) y la pantalla llega **tarde a su propia animación de entrada** — aparece ya asentada. El `<FeGaussianBlur>` de `GlassIcon.tsx` es el **único elemento caro** del icono. Quitándolo, el defecto desaparece (verificado por el operador).

> 🔴 **Choca con el otro handoff, y NO es contradicción — es un trade-off entre dos hilos.** El handoff de D-TIRON midió que **apagar el filtro EMPEORÓ** la cola del arrastre (jank de compositor, hilo de UI). Acá, apagarlo **arregla** el render inicial (construcción del árbol, hilo de JS). Son dos síntomas en dos hilos distintos. **Por eso lo dejo como decisión de device, no como fix que te digo que apliques.** Si tu glass tarda en aparecer → probá quitarlo y medí el arrastre; si el arrastre te importa más → dejalo. **Medí en build de producción** (`--no-dev --minify`) antes de decidir: buena parte de los 865 ms puede ser overhead de dev-mode.

Si decidís quitarlo, en `GlassIcon.tsx`: borrá los imports `FeGaussianBlur, Filter`, el `<Filter id={blurId}>…</Filter>` y cambiá `<G filter={url(#blurId)}>` por `<G>`.

---

## 6. (H) Rediseño del glass de grabación — SIN destino en tu repo hoy, pero acá está el patrón

Tu mobile no tiene grabación, así que esto **no aplica ahora**. Lo dejo por si la agregás (o si tu app web/otra la tiene). Dos cambios que pidió el operador:

- **Entra deslizando desde abajo como el resto.** El glass de grabación se monta **dentro** de un componente (no es una ruta), así que el `slide_from_bottom` del router no lo anima. Se lo da `reanimated`: envolver en `<Animated.View entering={SlideInDown.duration(320)} exiting={SlideOutDown.duration(240)} style={StyleSheet.absoluteFill}>`.
- **Botones: Pausar/Reanudar + Enviar, sin "Detener".** "Detener" cortaba a una fase intermedia desde la que había que apretar Enviar de nuevo — un paso de más que no se puede reanudar. Ahora **Enviar corta y manda en un toque**: el handler, si todavía graba, hace `await detener()` primero y recién ahí toma y envía. Enviar queda SIEMPRE visible; Descartar es la única vía de perder el audio.

---

## 7. 🔬 Instrumentos temporales — NO los copies (los vamos a borrar de nuestro lado)

Varios archivos nuestros tienen instrumentos de diagnóstico que **no son parte del fix**. Si copiás un archivo entero en vez del cambio descrito, sacá esto:

| Archivo | Instrumento a NO copiar |
|---|---|
| `Tile.tsx` | Registrador de tap de 3 capas: `marca()`, `tApoyo`, y los `onTouchStart/End/Cancel`, `onPressIn/Out`, `onPress` envuelto que loguean `[TRAZA-TAP]`. El fix real es sólo el import de RNGH + sacar `PRESS_SCALE`. |
| `EscritorioFunciones.tsx` | `onTouchStart/End` con `[TRAZA-TAP] PANTALLA-*` en el `<View>` raíz y `onScrollBeginDrag` con `SCROLL-DRAG-INICIO`. El fix real es sólo el import de `ScrollView` desde RNGH. |
| `PanelDeslizable.tsx` | Bloque "🔬 INSTRUMENTO TEMPORAL — traza del gesto" (los shared values `traza`, `renders`, `creacionesGesto`, `volcarTraza`, el `console.log` en `onLayout`). Es diagnóstico de D-TIRON, no un fix. **Ojo:** en este archivo NO hay ningún cambio que aplicar (ver §1 — el `useFocusEffect` se retiró). |
| `GlassIcon.tsx` | El comentario "🔬 BISECT TEMPORAL" con el filtro viejo pegado. |
| `PantallaAjustes.tsx` / `GlassHistorias.tsx` (equivalentes tuyos) | `[TRAZA-AJUSTES]` / `[TRAZA-HISTORIAS]` — medían el costo de primer render. |
| `_layout.tsx` | ⚠️ `animationDuration: 1500` — **este quedó COMMITEADO en `ef7dcc2`** (nuestro), es un instrumento para diagnosticar la entrada del glass. Si tu `_layout` alguna vez toma nuestra línea, bajalo al valor real. En tu repo hoy no está (tu `_layout` divergió). |

---

## 8. Método y trazabilidad

- **Verificación:** el operador probó todo en device (Samsung real) y confirmó que "anda bien". **Lo visual/gestual no lo prueba Jest** — la única prueba real es el dedo humano. `tsc` limpio y ~490 tests en verde de nuestro lado, pero eso NO cubre lo que ves en pantalla.
- **La regla que quedó de estos frentes:** invocar `superpowers:systematic-debugging` al primer síntoma. Su punto más caro acá: **medí el baseline sin la cosa sospechada antes del primer fix** — el control barato mató varias hipótesis falsas en segundos (el tap perdido lo resolvió capturar el caso que falla y el que anda, no razonar).
- **La lección más cara de este frente (por eso el §1 dice "no lo apliques"):** el panel clavado lo CAUSÉ yo, con un `useFocusEffect` que "arreglaba" un problema que no existía. Iteré ese fix dos veces (deps mal → deps por ref) antes de parar. La salida no fue un fix #3: fue **borrarlo** y volver al estado bueno conocido. Cuando llevás 3 intentos sobre la misma entidad, no es la hipótesis la que falla — es que la solución sobra. Aplicá el mismo criterio si algo de este handoff no te cierra: preferí quitar antes que apilar.
- **Repo del análisis:** `Agencia_IA_HyC/documed-front`, branch `feat/frontend-h6-anclaje`. Commit base compartido: `ef7dcc2`.
- Si aplicás alguno y encontrás que tu app diverge en algo que no anticipé, **dejalo escrito acá** (archivo nuevo tuyo, no edites éste) — nosotros leemos esta carpeta antes de retomar.
