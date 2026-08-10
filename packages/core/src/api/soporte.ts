import { apiClient } from './client';
import type { ChatMessageKind } from './types';

/**
 * Body de `/soporte/chat` — deliberadamente MÁS ANGOSTO que `ChatRequest` (`chat.ts`), no un alias
 * de él. `ChatRequest` carga `mode`/`payload`/`contenido` (gates de negocio, informe editable,
 * captura clínica) que no significan nada para soporte; reusar el tipo ancho invitaría a que algún
 * día alguien mande uno de esos campos "porque ya estaba en el shape" y el backend lo ignore en
 * silencio. Mismo criterio que el contrato aplica del lado del servidor (SOP5 §"La config no es la
 * misma"): un tipo propio, aunque hoy comparta los tres campos con el de negocio.
 */
export interface SoporteChatRequest {
  session_id: string;
  text: string;
  kind: ChatMessageKind;
}

export interface SoporteChatResponse {
  wf_id: string | null;
  accepted: boolean;
}

/**
 * POST /soporte/chat — Bearer requerido. Ruta DEDICADA (no un parámetro de `/chat`): el contrato
 * SOP5 la eligió así porque el destino (`domain`/`task_queue`) nunca debe salir del body, sólo del
 * token + la ruta. `GET /reply` es el mismo endpoint sin cambios — no hay un `getSoporteReply`.
 */
export function sendSoporteChat(payload: SoporteChatRequest): Promise<SoporteChatResponse> {
  return apiClient.post<SoporteChatResponse>('/soporte/chat', payload);
}
