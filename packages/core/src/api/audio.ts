import { postMultipart } from './client';
import type { ArchivoSubida } from './http';
import type { ModoCopiloto } from '../chat/modo';
import type { SendAudioResponse } from './types';

/**
 * POST /chat/audio (multipart/form-data) — Bearer requerido. Contrato: campos `session_id` (form) +
 * `audio` (archivo, filename `voz.webm` en la práctica web) + `cliente_id` (form) ->
 * `{wf_id, accepted, transcript}`. `cliente_id` se manda SIEMPRE (aunque venga vacío): si el backend
 * lo exige (falta → 422) ANTES de gastar cómputo de STT, un default silencioso acá escondería el caso
 * "sin cliente activo" en vez de dejar que el 422 lo explicite.
 *
 * Usa `postMultipart` (`client.ts`) — el mapeo de errores 401/403/genérico vive UNA sola vez ahí. El
 * `audio` es OPACO al core (`ArchivoSubida`, ver `http.ts`) — el adaptador de cada plataforma es quien
 * sabe adjuntarlo al multipart real (en web, un `Blob` al `FormData`).
 */
export function sendAudio(
  sessionId: string,
  audio: ArchivoSubida,
  clienteId: string,
  modo?: ModoCopiloto | null,
): Promise<SendAudioResponse> {
  return postMultipart<SendAudioResponse>(
    '/chat/audio',
    // 🔴 `modo` viaja TAMBIÉN por acá, y no es un detalle: este es un copiloto **de voz**. Este
    // camino no pasa por `sendChat`, así que sin esta línea el modo negocio sólo regiría cuando el
    // usuario ESCRIBE -- el camino minoritario -- y hablando iría en silencio al modelo general.
    // Un modo que rige a veces es peor que uno que no existe: el usuario no tiene cómo notar cuál de
    // los dos le contestó.
    { session_id: sessionId, cliente_id: clienteId, ...(modo ? { modo } : {}) },
    'audio',
    audio,
  );
}
