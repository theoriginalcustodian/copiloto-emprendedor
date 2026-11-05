import type { ArchivoSubida } from '@copiloto/core';

/**
 * 🔴 **El despacho al chat desde OTRA pantalla: la acción se EJECUTA primero, la vuelta al chat va DESPUÉS.**
 *
 * Decisión del operador (2026-11-04): al escribir o dictar en el dock de una función (o de Mi día), el mensaje se
 * manda y recién entonces se vuelve al chat, que llega con la card ya en camino. Antes se dejaba un aviso en un
 * buzón y el chat lo ejecutaba al recuperar el foco: se navegaba ANTES de actuar.
 *
 * Qué lo hace posible (medido): el estado de `useChat` es local de `ChatView`, y `ChatView` NO se desmonta cuando
 * se abre un glass encima (los glass son `transparentModal`; ver su comentario sobre `useFocusEffect`). Entonces
 * `ChatView` registra acá su `send`/`enviarAudio` mientras está montado e hidratado, y la función los invoca antes
 * de `router.back()`. El polling del reply sigue corriendo en `ChatView`.
 *
 * Si no hay chat registrado (el onboarding se renderiza EN LUGAR del chat, o `useChat` aún no hidrató) el despacho
 * devuelve `false`: quien llama NO navega y lo dice, en vez de perder el mensaje en silencio.
 */
export interface DespachoChat {
  texto: (texto: string) => void;
  audio: (audio: ArchivoSubida, duracionSeg: number) => void;
}

let activo: DespachoChat | null = null;

/** Devuelve la baja. Sólo desregistra si el activo sigue siendo éste (un remonte no pisa al nuevo). */
export function registrarDespachoChat(despacho: DespachoChat): () => void {
  activo = despacho;
  return () => {
    if (activo === despacho) activo = null;
  };
}

export function despacharTextoAlChat(texto: string): boolean {
  if (activo == null) return false;
  activo.texto(texto);
  return true;
}

export function despacharAudioAlChat(audio: ArchivoSubida, duracionSeg: number): boolean {
  if (activo == null) return false;
  activo.audio(audio, duracionSeg);
  return true;
}