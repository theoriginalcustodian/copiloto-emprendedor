# Spike de-risk — Sprint "voz-warp" (captura de voz push-to-talk warp)

> **Autor:** FRONTEND · **2026-07-23** · Cola de-risk mientras `narra-sin-hacer` bloquea la cadena IN
> (`dato_planificacion-a-frontend_cola-independiente-de-risk-voz-warp...`). **Cero código de
> producción, cero rama** — este documento es el output. El sprint sigue "NO arrancar" hasta que
> Inteligencia de Negocio cierre E2E (ya cerrado, pero el gate lo levanta planificación, no este spike).

## 0. Lo que ya existe — no partir de cero

El requisito #1 de `PLAN.md` §"Sprint SIGUIENTE" (*"quitar de TODOS los ingresos por voz el glass"*)
**ya está resuelto para el único punto de entrada de voz que existe hoy**: el `BotonVoz` del chat
(`apps/mobile/src/modules/chat/BotonVoz.tsx` + `useVozComando.ts` + `ControlesFlotantes.tsx`, PR#74/#76,
DoD verde en device). Verificado por `grep` (`useAudioRecorder`/`BotonVoz`/`sendAudio` en todo
`apps/mobile/src`): **no hay ningún otro sitio que capture voz** — ni un `GlassGrabacionCopiloto`
residual, ni un botón de voz en Gastos/Ingresos por fuera del chat. Si un futuro punto de entrada de
voz aparece antes de que este sprint arranque, ahí sí habría que replicar el patrón — hoy no hace falta.

Ya cumplido, no re-hacer:
- Push-to-talk: mantener graba, soltar envía, deslizar hacia arriba fija (ítems 2-3 del contrato).
- Sin glass: `ControlesFlotantes` es flotante, no `MarcoGlass`.
- Sin retención: `useVozComando` no persiste, `enviarAudio` borra el archivo apenas termina de subirlo.

**Lo que NO está resuelto — y es el foco real de este spike:** el requisito #4bis implícito, "empezar a
subir mientras el emprendedor todavía habla" (la precisión técnica que `PLAN.md` marca como el supuesto
crítico). Ver §2.

## 1. El gesto — portar adaptando, no copiar

Leí `documed-front/apps/mobile/src/modules/captura/BotonVoz.tsx` (canónica, read-only). Su gesto usa
`Pressable` NATIVO (`onPressIn`/`onPressMove`/`onPressOut`/`onPress`) — **deliberadamente sin
`react-native-gesture-handler`**, porque en documed el botón vive solo, sin un `ScrollView` padre
disputando el toque.

**Esa premisa NO aplica en el copiloto.** El `BotonVoz` del chat vive dentro de `ListaMensajes`
(`ScrollView` de RNGH) — exactamente el caso que `swmansion-rn-gestures` marca como el más propenso a
pelear con el panel, y que este repo ya pagó una vez (`glass-apilado-empujar-una-vez` /
`teclado-tapa-campos-cascara-glass`). Mi implementación actual YA resolvió esto con
`Gesture.LongPress()` + `Gesture.Pan()` compuestos vía `simultaneousWithExternalGesture` contra el
scroll — **ese patrón es el que corresponde seguir usando**, no el `Pressable` nativo de documed. El
umbral de fijado (documed usa 80px de deslizamiento) sí se porta tal cual — es una constante de UX, no
de plataforma.

**Conclusión #1: no hay gesto nuevo que inventar.** El de warp es el MISMO gesto que ya está en
producción (PR#74/#76). Lo que cambia es sólo lo que pasa con el audio mientras se sostiene — §2.

## 2. El riesgo real — subir mientras graba, contra la arquitectura actual

`apps/mobile/src/adapters/http.native.ts` sube el audio con `uploadAsync` de `expo-file-system`
(`FileSystemUploadType.MULTIPART`), streameando **desde disco en nativo** — decisión deliberada
(docstring del archivo, verificado 2026-07-14): evita cargar el archivo entero al heap de JS (`fetch`
con `FormData` no soporta `{uri}` en Expo SDK 54; `.bytes()` duplicaría el archivo en memoria).

**El problema para warp:** `uploadAsync` recibe una URI de archivo y sube ESE archivo — no hay API para
"empezar a subir un archivo que todavía se está escribiendo". Es upload de archivo terminado, no
streaming real. Y `useVozComando` graba a UN solo archivo sin segmentar (`.m4a`), a propósito —
documed tampoco segmenta, y el docstring propio dice explícito *"sigue sin segmentar a disco, que es lo
que la mantiene simple"*.

**Conclusión #2 (la que importa):** con la arquitectura actual, **"empezar a subir mientras habla" NO
es alcanzable sin uno de estos tres cambios, cada uno con costo distinto:**

| Opción | Qué requiere | Costo |
|---|---|---|
| **(a) Segmentar a disco** (como documed evitaba, y este repo también) | Grabar en trozos (ej. cada 2-3s) + subir cada trozo por separado + backend que los reensambla/transcribe incremental | Alto: reintroduce la complejidad de segmentación que ambos repos evitaron a propósito; necesita endpoint backend nuevo |
| **(b) Streaming HTTP real** (chunked transfer, sin tocar disco) | Una librería que exponga el buffer de audio en vivo (`react-native-audio-api`, no `expo-audio`) + un endpoint backend que acepte un stream (WebSocket o HTTP chunked) en vez de `multipart` de archivo completo | Alto: cambia el adaptador de audio Y el contrato del backend (`/chat/audio` hoy es `multipart` de archivo único) |
| **(c) No-warp real, sí percibido** — subir el archivo completo pero ARRANCAR el upload en el instante exacto de `soltar`/`fijar`, sin ningún paso intermedio evitable | Auditar `detener()` → `tomar()` → `enviarAudio()` por awaits innecesarios entre el `stop()` y el primer byte HTTP | Bajo: no toca arquitectura, achica la ventana real, no la elimina |

**Recomendación para cuando arranque el sprint:** medir (c) primero — es spike-first aplicado al propio
spike: cuantificar la ventana actual entre "soltar el dedo" y "primer byte HTTP sale" en device real
(mismo método de medición que el contrato original §2.bis pedía para el arranque). Si esa ventana ya es
chica (los usuarios de STT hoy sienten latencia del propio Groq, no de la subida — dato del contrato de
pre-warm), (c) sola podría ser el warp completo y (a)/(b) serían sobre-ingeniería. Si la ventana es
grande, ahí se decide entre (a)/(b) — y eso SÍ es una decisión MAYOR (cambia contrato con backend), no
táctica.

## 3. Animación del relieve — reanimated SÍ está disponible acá

`documed-front` evita `react-native-reanimated` a propósito (no está en su `package.json`, sin
`babel.config.js` para el plugin). **Esa restricción NO aplica al copiloto**: `apps/mobile/package.json`
tiene `react-native-reanimated@4.5.0` + `react-native-worklets@0.10.0`, y ya se usa en producción
(`ControlesFlotantes.tsx` usa `Animated.View` de reanimated con `FadeIn`/`FadeOut`). El "relieve, en
profundidad, coherente con el resto" de los botones revelados debería usar `useSharedValue` +
`withSpring`/`withTiming` de reanimated (vía `swmansion-rn-animations`), no la API `Animated` del core
que documed usa por necesidad — portar esa restricción sería copiar ciego un problema que acá no existe.

## 4. Riesgos y mitigación (los 3-4 pedidos)

1. **Warp real vs. warp percibido** (arriba, §2) — mitigación: medir (c) antes de comprometerse a
   (a)/(b); es el supuesto crítico, spike-first cuando arranque.
2. **Gesto Pan+LongPress dentro de ScrollView** — YA mitigado, patrón en producción (PR#74/#76). Riesgo
   residual: el ítem 7 del DoD de voz-sin-glass sigue "parcial" (scroll simultáneo con grabación activa,
   sin poder simularlo por ADB con confianza) — no bloqueó ese cierre, tampoco debería bloquear éste.
3. **Endpoint backend para (a)/(b)** — si el spike de arranque concluye que hace falta streaming/
   segmentación, el contrato `/chat/audio` cambia de forma — eso es un `contrato_` para planificación
   ANTES de tocar código, no una decisión unilateral de frontend ni backend.
4. **Reanimated + worklets en un componente que compite con gestos del panel** — mismo cuidado que
   `swmansion-rn-multithreading` marca: los callbacks de gesto ya corren en el hilo de UI; cualquier
   valor compartido que anime el relieve tiene que mutarse desde ahí (worklet), no desde un `useEffect`
   de JS — mitigación: seguir el patrón ya usado en `Onda.tsx`/`ControlesFlotantes.tsx`, no inventar uno.

## 5. Qué NO se porta de documed (ya sabido, re-confirmado)

- **Persistencia del audio** — documed retiene por trazabilidad clínica (ADR-004 de ese repo); acá D6
  dice explícito que no hace falta, y `useVozComando` ya no persiste. No cambia con warp.
- **Gesto con `Pressable` nativo** — ver §1, la razón de documed (sin scroll competidor) no aplica acá.
- **Restricción anti-reanimated** — ver §3, no aplica acá.

## 6. Para cuando el sprint arranque

Este spike no decide nada — dice qué medir primero. El primer paso real del sprint, cuando destrabe, es
la medición de §2 (ventana soltar→primer-byte-HTTP), no escribir código de segmentación. Si esa medición
cambia el contrato de `/chat/audio`, eso sí es `contrato_` a planificación antes de la primera línea.
