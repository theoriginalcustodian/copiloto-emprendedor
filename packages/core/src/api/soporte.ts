import { apiClient, postMultipart } from './client';
import type { ArchivoSubida } from './http';
import type { ChatMessageKind } from './types';

/**
 * `CANALES_VALIDOS` (`soporte_store.py:37-39`, SOP3) — el enum cerrado que `ChatSoporteIn.funcion`
 * valida server-side (400 si no matchea). El vocabulario NO lo inventa el chat: lo reusa del ticket
 * (`canal`), regla 3 (reutilizar) aplicada por el propio backend. Union literal, no `string`, para
 * que un typo se cace en compile-time y no como un 400 en el device.
 */
export type FuncionSoporte = 'soporte_tecnico' | 'como_uso_la_app';

/**
 * Body de `/soporte/chat` — deliberadamente MÁS ANGOSTO que `ChatRequest` (`chat.ts`), no un alias
 * de él. `ChatRequest` carga `mode`/`payload`/`contenido` (gates de negocio, informe editable,
 * captura clínica) que no significan nada para soporte; reusar el tipo ancho invitaría a que algún
 * día alguien mande uno de esos campos "porque ya estaba en el shape" y el backend lo ignore en
 * silencio. Mismo criterio que el contrato aplica del lado del servidor (SOP5 §"La config no es la
 * misma"): un tipo propio, aunque hoy comparta los tres campos con el de negocio.
 *
 * `funcion` es OBLIGATORIO — corregido 2026-08-10 (`respuesta_planificacion-a-backend_SOP5-va-la-B`):
 * la primera versión del contrato no lo llevaba: mandar el body sin él es un 422 real contra el
 * backend, no un detalle cosmético.
 */
export interface SoporteChatRequest {
  session_id: string;
  text: string;
  funcion: FuncionSoporte;
  kind: ChatMessageKind;
}

/**
 * `session_id` acá es el `channel_ref` — namespaceado por el SERVIDOR
 * (`soporte:{funcion}:{session_id}`, `web.py::soporte_chat`), NO el `session_id` que el cliente
 * mandó. **Hay que usar ESTE valor para el `GET /reply` de ahí en adelante**: `/reply` filtra por el
 * `session_id` exacto que el workflow usa internamente, y el crudo que generó el cliente no es ese
 * — pollear con el crudo deja al chat viendo cero respuestas para siempre, sin ningún error que lo
 * delate (el fallo mudo que el propio DoD advierte).
 */
export interface SoporteChatResponse {
  wf_id: string | null;
  accepted: boolean;
  session_id: string;
}

/**
 * POST /soporte/chat — Bearer requerido. Ruta DEDICADA (no un parámetro de `/chat`): el contrato
 * SOP5 la eligió así porque el `task_queue` nunca debe salir del body, sólo del token + la ruta;
 * `funcion` sí viaja en el body, pero acotado a `CANALES_VALIDOS` — elige `domain` dentro de la
 * MISMA cola, no el destino. `GET /reply` es el mismo endpoint sin cambios — no hay un
 * `getSoporteReply`.
 */
export function sendSoporteChat(payload: SoporteChatRequest): Promise<SoporteChatResponse> {
  return apiClient.post<SoporteChatResponse>('/soporte/chat', payload);
}

/**
 * `session_id` en la respuesta: MISMO criterio que `SoporteChatResponse` — es el `channel_ref` que
 * arma el servidor, no el que mandó el cliente; hay que adoptarlo antes del próximo `GET /reply`
 * (ver su docstring). `transcript` puede venir `''` si Groq no entendió nada — el caller decide qué
 * hacer con eso (mismo criterio que `SendAudioResponse` de `audio.ts`, no un caso nuevo).
 */
export interface SoporteAudioResponse {
  wf_id: string | null;
  accepted: boolean;
  session_id: string;
  transcript: string;
}

/**
 * POST /soporte/chat/audio (multipart/form-data) — Bearer requerido. Espejo de `sendAudio`
 * (`audio.ts`) fusionado con el namespacing de `sendSoporteChat`: mismo `postMultipart`, mismo
 * mapeo de errores 401/403 (vive una sola vez en `client.ts`), pero `funcion` en vez de
 * `cliente_id`/`modo` — ODOBI8 §C1 (`apps/copiloto/web.py::soporte_chat_audio`). `audio` es OPACO
 * al core (`ArchivoSubida`, ver `http.ts`).
 */
export function sendSoporteAudio(
  sessionId: string,
  audio: ArchivoSubida,
  funcion: FuncionSoporte,
): Promise<SoporteAudioResponse> {
  return postMultipart<SoporteAudioResponse>(
    '/soporte/chat/audio',
    { session_id: sessionId, funcion },
    'audio',
    audio,
  );
}
