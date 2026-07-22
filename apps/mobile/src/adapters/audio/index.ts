/**
 * Barrel de los adaptadores de audio nativos.
 *
 * 🔴 Sigue vacío tras F6, y ahora es una decisión, no una pausa. En documed este barrel exporta
 * `crearGrabadorNativo` desde `./grabador.native` — 892 LOC construidas para captura clínica
 * larga: interrupciones, reanudación, huérfanos, chunking a archivo.
 *
 * Acá el caso es dictar un mensaje corto y mandarlo a Groq, que devuelve texto (decisión D6): no
 * se retiene audio ni se persiste nada local. Portar ese grabador tal cual sería traer la
 * maquinaria de un problema que no tenemos.
 *
 * ## F6 — decisión: `expo-audio`, NO `react-native-audio-api`
 *
 * Las dos libs están en las deps (`apps/mobile/package.json`) porque el `AudioRecorder` port
 * (`packages/core/src/audio/ports.ts`) las contempla ambas para el grabador CLÍNICO futuro. Para
 * el dictado corto del copiloto, el criterio es el que la skill `swmansion-rn-audio` da: usar la
 * lib más simple que cumple el requisito, y reservar la más pesada para donde el requisito la
 * justifique.
 *
 * `react-native-audio-api` expone un `AudioRecorder` de bajo nivel (file/data-callback/graph
 * processing, `AudioContext`, worklets) — pensado para procesamiento en tiempo real o para
 * sobrevivir interrupciones vía segmentación a disco. Nada de eso hace falta acá: no hay grafo de
 * audio que armar, no hay efectos, y D6 ya descartó explícitamente la segmentación/reanudación.
 * Pagar esa complejidad para grabar unos segundos sería la sobreingeniería que la constitución
 * del repo prohíbe.
 *
 * `expo-audio` SÍ tiene un defecto documentado (ver el docstring de `ports.ts`): pierde el audio
 * previo si entra una llamada mientras graba (atiende `interruptionBegan`, nunca
 * `interruptionEnded`). Es exactamente por qué el proyecto hermano (documed) construyó el
 * grabador clínico pesado para sus CONSULTAS largas. Pero ese mismo proyecto, para su propio
 * comando de voz corto (`useVozComando.ts` en `modules/chat/`), eligió `expo-audio` — con el
 * mismo razonamiento que aplica acá: *"si se pierde, el usuario lo repite"*. Nuestro caso es
 * IDÉNTICO en las condiciones que importan (dictado corto, tolerante a reintento, sin dato
 * irrepetible en juego): el mismo bug que hace inaceptable `expo-audio` para una consulta de 40
 * minutos es irrelevante para un mensaje de pocos segundos.
 *
 * **No hace falta un adaptador acá.** El grabador de `expo-audio` es un HOOK (`useAudioRecorder`),
 * no un objeto instanciable fuera de React — no hay forma de implementarlo detrás del puerto
 * `AudioRecorder` (que es una interfaz async, no un hook) sin envolverlo en una capa que no
 * aportaría nada: esta app no tiene una plataforma web/Capacitor alternativa que necesite
 * intercambiar el adaptador, así que no hay abstracción que ganar. El punto de integración real
 * vive en `modules/chat/useVozComando.ts` (mismo lugar que en documed), consumiendo el hook
 * directo. Este barrel queda vacío porque no hay nada agnóstico de plataforma que exportar.
 */
export {};
