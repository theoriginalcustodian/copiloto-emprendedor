---
name: glass-apilado-empujar-una-vez
description: App móvil bloqueada al volver de una función = glass apilado por doble toque; la invariante es un lock de navegación por FOCO (empujarUnaVez de documed)
metadata: 
  node_type: memory
  type: project
  originSessionId: 37aeed5a-4657-4d45-ac7e-0a64568aac87
  modified: 2026-07-21T15:01:36.755Z
---

**LEER si la app móvil "se queda bloqueada y no responde" al volver de una pantalla de función.**

Síntoma (operador, 2026-07-21): *"cuando ingreso a apps y luego salgo, al volver a la pantalla
principal ya se queda bloqueada y no responde"*. Se ve el escritorio, los tiles no reaccionan, el
handle del panel tampoco, y el hint del panel miente sobre su estado.

**Causa medida en device (SM-A217M):** dos toques rápidos sobre un tile abren **DOS glass apilados**
de la misma función. Un solo "Volver" cierra uno; el segundo queda arriba y —al ser
`presentation: 'transparentModal'`— es transparente: se ve el escritorio a través de él mientras se
traga todos los toques. No hay ningún indicio visual de que haya una capa encima.

**Lo que NO era, y costó horas:** el gesto del panel. Se instrumentó `PanelDeslizable` con un log en
`onBegin` y otro en `onLayout`; el toque llegaba al gesto con `recorrido=819` bien medido después de
volver de un glass. Esa traza descartó de una las dos hipótesis competidoras (clamp a `[0,0]` y capa
propia comiéndose el evento) — **un instrumento que separa dos causas incompatibles vale más que
cinco fixes a ciegas.**

**Fix (clonado verbatim de documed, `src/navegacion/empujarUnaVez.ts`):** lock de navegación por
**FOCO**, no por tiempo. La puerta se cierra de forma síncrona al lanzar y sólo la reabre la pantalla
lanzadora desde su `useFocusEffect`. La invariante correcta no es "no dos pushes seguidos" sino
**"no otro MIENTRAS haya uno abierto"** — un debounce temporal deja pasar el toque encolado que llega
2 s después con el glass todavía abierto.

**How to apply:**
1. Toda pantalla lanzadora → `useFocusEffect(useCallback(() => reabrirNavegacion(), []))`.
2. Todo `router.push` de un tile/acción → `empujarUnaVez(ruta)`. Nunca `router.push` directo.
3. El mock de `useFocusEffect` en jest **tiene que ejecutar el callback**; si lo ignora, el test da
   verde con la puerta cerrada para siempre — un gate que no ejercita lo que cubre.
4. Regla hermana de Software Mansion, en dos mitades que van juntas: `ScrollView`/`FlatList` **y** los
   tocables de adentro salen de `react-native-gesture-handler`. Con una sola mitad hay dos árbitros
   sobre el mismo dedo y los taps rápidos se pierden.

[[consultar-documed-siempre-antes-de-implementar]] · [[gate-jsdom-no-ve-gestos-tactiles]] ·
[[copiloto-mobile-first-cascara-glass]]
