---
name: adb-no-puede-ejercitar-el-toque-corto-de-un-gesture-pan
description: "adb shell input tap/swipe no logra disparar la clasificación toque-vs-arrastre de un Gesture.Pan() de react-native-gesture-handler, aunque SÍ dispara taps simples (onPress) y drags grandes sobre el mismo componente"
metadata: 
  node_type: memory
  type: project
  originSessionId: cbc14bc5-aae4-430e-9c3d-4df2449cbd57
  modified: 2026-08-04T12:04:25.473Z
---

Al intentar verificar A3 (BETA-4a/Sprint mobile-first, `PanelDeslizable.tsx`) — un toque corto y
casi sin desplazamiento sobre `panel-handle` que hace *toggle* del panel sin arrastrar —
`adb shell input tap` y `adb shell input swipe` con 0-2px de movimiento **nunca dispararon el
toggle**, 3 intentos, coordenadas verificadas por `uiautomator dump` (no adivinadas) contra los
bounds reales del `GestureDetector`.

**El control que lo aisló:** en la MISMA corrida, taps simples (`TouchableOpacity`/`onPress`, ej.
"Volver"/"Cancelar") respondieron normal vía ADB, y un drag grande (600px) sobre la MISMA zona
también movió el panel correctamente. Sin ese control, hubiera sido fácil concluir "el toque no
funciona" cuando en realidad sólo falla el camino de desplazamiento casi-cero.

**Hipótesis (no confirmada, no hay forma de confirmarla sin un dedo real):** `Gesture.Pan()` en
Android sólo activa (`BEGAN`→`ACTIVE`, y de ahí a que corra la lógica de `.onEnd()`) al cruzar el
*touch slop* nativo del framework, que suele ser mayor a un `UMBRAL_TAP` chico (5px en este código).
Un desplazamiento sintético de ADB es determinístico/perfecto (0-2px exactos) — sin el jitter
natural de un dedo real (que típicamente ya supera esos pocos px), puede quedar siempre por debajo
del piso de activación nativo, y el branch de "fue un toque" nunca se alcanza, sin que eso implique
que el toque real de un usuario tenga el mismo problema.

**Por qué importa:** un umbral de tap MENOR al touch-slop nativo de Android es, en el peor caso, un
bug real nunca ejercitado en device (nadie lo probó con un dedo desde que se escribió, 07-21); en el
mejor caso, es sólo una limitación de ADB. Sin diferenciarlos, un E2E "PASS" vía ADB sería evidencia
falsa, y un "FAIL" también — de ahí que se reportó como INCONCLUSO en vez de forzar cualquiera de
los dos veredictos.

**Cómo aplicar:** para cualquier gesto basado en `Gesture.Pan()`/`Gesture.Tap()` con umbral de
distancia CHICO (toques que se distinguen de arrastres por pocos px), no asumir que
`adb shell input tap/swipe` puede ejercitarlo — correr primero el control (¿un tap simple en OTRO
componente funciona? ¿un drag grande en el MISMO componente funciona?) antes de declarar el gesto
roto o verificado. Si ambos controles pasan y el toque corto específico sigue sin disparar, es este
patrón — reportar INCONCLUSO con la hipótesis, no forzar un veredicto. Ver también
[[gate-jsdom-no-ve-gestos-tactiles]] (limitación hermana, en el gate de CI en vez de en ADB).
