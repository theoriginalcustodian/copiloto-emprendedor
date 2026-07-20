/**
 * Barrel de los adaptadores de audio nativos.
 *
 * 🔴 Vacío a propósito hasta F6, no por olvido. En documed este barrel exporta
 * `crearGrabadorNativo` desde `./grabador.native` — 892 LOC construidas para captura clínica
 * larga: interrupciones, reanudación, huérfanos, chunking a archivo.
 *
 * Acá el caso es dictar un mensaje corto y mandarlo a Groq, que devuelve texto (decisión D6): no
 * se retiene audio ni se persiste nada local. Portar ese grabador tal cual sería traer la
 * maquinaria de un problema que no tenemos.
 *
 * El grabador propio se escribe en F6, y ahí se decide si `expo-audio` alcanza o hace falta
 * `react-native-audio-api`. Hasta entonces este archivo no exporta nada — y eso es información,
 * no un hueco: dice que el audio todavía no está cableado.
 */
export {};
