import { postMultipart } from './client';
import { ApiError } from './errors';
import type { ArchivoSubida } from './http';

/** Contextos válidos de `POST /transcribir` (contrato K-10 §2) — sólo logging/telemetría del lado del
 * backend: un valor fuera de esta lista se ignora ahí, nunca 422. */
export type ContextoTranscripcion = 'gasto' | 'ingreso' | 'presupuesto' | 'cliente';

export interface TranscribirResponse {
  transcript: string;
}

/**
 * Lo que le decimos al usuario para cada error de `POST /transcribir` (mismos códigos que
 * `/chat/audio`, contrato K-10 §2): texto en español, nunca el código crudo. Siempre devuelve algo
 * mostrable — hasta un error sin `status` (red caída, etc.) cae en el texto genérico del default.
 */
export function avisoErrorTranscripcion(err: unknown): string {
  if (err instanceof ApiError) {
    switch (err.status) {
      case 401:
        return 'Tu sesión venció. Volvé a entrar para dictar.';
      case 413:
        return 'El audio es muy largo. Grabá algo más corto.';
      case 415:
        return 'Ese archivo no es un audio válido.';
      case 422:
        return 'No se entendió el audio. Probá de nuevo.';
      case 502:
        return 'No pudimos transcribir ahora. Probá de nuevo en un momento.';
      case 503:
        return 'El dictado por voz no está disponible ahora.';
      default:
        return 'No pudimos transcribir el audio. Probá de nuevo.';
    }
  }
  return 'No pudimos transcribir el audio. Probá de nuevo.';
}

/**
 * POST /transcribir (multipart/form-data) — Bearer requerido. BL-J7/K-10: transcribe SIN despachar al
 * agente ni abrir sesión — a diferencia de `sendAudio` (`audio.ts`), que sí dispara `/chat/audio` y un
 * workflow. Es lo que usa `MicFuncion` para llenar un campo de formulario con un dictado, sin ensuciar
 * el historial del chat ni gastar una ejecución de Temporal por campo.
 *
 * `cliente_id` NO viaja: `require_tenant` lo resuelve del token, mismo criterio que el resto de los
 * endpoints tenant-scoped que no lo repiten en el body.
 */
export function transcribir(audio: ArchivoSubida, contexto?: ContextoTranscripcion): Promise<TranscribirResponse> {
  return postMultipart<TranscribirResponse>(
    '/transcribir',
    contexto ? { contexto } : {},
    'audio',
    audio,
  );
}
