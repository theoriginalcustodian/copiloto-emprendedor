import { postMultipart } from './client';
import type { FuncionSoporte } from './soporteChat';

/** `session_id` es el `channel_ref` que el SERVIDOR calculó (`soporte:{funcion}:{session_id}`),
 *  NO un eco del que mandó el cliente — mismo cuidado que `SoporteChatResponse` (ver su docstring).
 *  `transcript` vacío es un envío EXITOSO en el que el STT no entendió nada — el caller decide qué
 *  hacer (mismo criterio que `packages/core/src/api/soporte.ts`'s `sendSoporteAudio` en mobile). */
export interface SoporteAudioResponse {
  wf_id: string | null;
  accepted: boolean;
  session_id: string;
  transcript: string;
}

/**
 * POST /soporte/chat/audio (ODOBI8 §C1, multipart/form-data) — espejo de `sendAudio` (`./audio.ts`)
 * para el dominio de soporte: mismos campos base (`session_id` + blob `audio`), más `funcion`
 * (namespacing del `channel_ref`, ver `soporteChat.ts`). Vive en un archivo propio, no en
 * `soporteChat.ts`, mismo criterio que separa `audio.ts` de `chat.ts` del lado de negocio: otro
 * verbo HTTP (multipart vs JSON), otro shape de respuesta.
 */
export async function sendSoporteAudio(
  sessionId: string,
  blob: Blob,
  funcion: FuncionSoporte,
): Promise<SoporteAudioResponse> {
  const form = new FormData();
  form.append('session_id', sessionId);
  form.append('funcion', funcion);
  form.append('audio', blob, 'voz.webm');

  return postMultipart<SoporteAudioResponse>('/soporte/chat/audio', form);
}
