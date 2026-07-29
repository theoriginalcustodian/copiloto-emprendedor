import { postMultipart } from './client';
import type { SendAudioResponse } from './types';

/**
 * POST /chat/audio (multipart/form-data) — Bearer requerido (Task 19, FASE 4). Contrato: campos
 * `session_id` (form) + `audio` (blob webm/mp4, filename `voz.webm`) -> `{wf_id, accepted,
 * transcript}`.
 *
 * Vía `postMultipart` de `client.ts`: mismo refresh-on-401 + single-flight que el resto de la API —
 * sin esto, un dictado con token vencido desloguea en vez de reintentar, perdiendo la grabación.
 */
export async function sendAudio(sessionId: string, blob: Blob): Promise<SendAudioResponse> {
  const form = new FormData();
  form.append('session_id', sessionId);
  form.append('audio', blob, 'voz.webm');

  return postMultipart<SendAudioResponse>('/chat/audio', form);
}
