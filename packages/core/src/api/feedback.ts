import { apiClient, postMultipart } from './client';
import type { ArchivoSubida } from './http';
import type { EnviarFeedbackAudioResponse, EnviarFeedbackResponse } from './types';

/**
 * `/feedback` — BETA-1a, feedback in-app (voz + texto). Contrato:
 * `coordinacion/abierto/2026-08-04_contrato_planificacion-a-todos_BETA1a-feedback-endpoint.md`.
 *
 * Dos rutas, mismo patrón que `/chat` vs `/chat/audio` (`chat.ts`/`audio.ts`): texto va JSON directo,
 * voz va multipart y el backend transcribe server-side (cero retención de audio, mismo criterio que
 * `useVozComando`). Standalone —no entra en `CopilotApi`/`mockApi`— igual que `gastos.ts`/
 * `clientes.ts`: esa interfaz es sólo el núcleo de chat (login/sendChat/sendAudio/sendFoto/getReply/
 * warm), el resto de la superficie son funciones exportadas directas.
 *
 * Errores (422 texto vacío / >2000 chars, y los mismos códigos de `/chat/audio` para la voz —
 * 413/503/502/422) llegan como `ApiError` con `.detail` mostrable tal cual — el caller no reinterpreta.
 */

/** `texto.trim()` vacío o `>2000` chars → 422 del backend (mismo criterio que el resto de la API: la
 * app no duplica la validación, sólo muestra el `detail` que ya viene explicado). */
export function enviarFeedback(texto: string, contexto?: string): Promise<EnviarFeedbackResponse> {
  return apiClient.post<EnviarFeedbackResponse>('/feedback', {
    texto,
    ...(contexto !== undefined ? { contexto } : {}),
  });
}

/** `audio` es OPACO al core (`ArchivoSubida`) — mismo criterio que `sendAudio`/`sendFoto`: el
 * adaptador de cada plataforma sabe adjuntarlo al multipart real. */
export function enviarFeedbackAudio(
  audio: ArchivoSubida,
  contexto?: string,
): Promise<EnviarFeedbackAudioResponse> {
  return postMultipart<EnviarFeedbackAudioResponse>(
    '/feedback/audio',
    contexto !== undefined ? { contexto } : {},
    'audio',
    audio,
  );
}
