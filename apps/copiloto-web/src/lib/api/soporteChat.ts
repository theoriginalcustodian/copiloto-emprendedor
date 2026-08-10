import { apiClient } from './client';
import type { ChatMessageKind } from './types';

/** Enum cerrado del backend (`soporte_store.CANALES_VALIDOS`, SOP3) — mismo tipo que
 * `packages/core/src/api/soporte.ts` define para mobile, repetido acá porque este archivo NO
 * reusa el core (ver docstring de `SoporteChatRequest`). */
export type FuncionSoporte = 'soporte_tecnico' | 'como_uso_la_app';

/**
 * Body de `/soporte/chat` (SOP5) — ANGOSTO a propósito, mismo criterio que `packages/core/src/api/
 * soporte.ts`: `ChatRequest` (`chat.ts`) carga `mode` (el "Modo Mail" de `useMode()`), que no
 * significa nada para soporte. Un tipo propio evita que ese campo se filtre acá "porque ya estaba
 * en el shape ancho".
 *
 * **Por qué este archivo vive en `apps/copiloto-web/src/lib/api/` y NO reusa
 * `@copiloto/core`'s `sendSoporteChat`, habiendo uno**: se midió antes de escribir (regla de
 * reutilización) — `ReplyCard`/`ReplyChoice` de este barrel YA DIVERGIERON de los del core (acá
 * trae `data`/`kind` de artefactos web como `payment_link`/`email_draft`; el core trae `markdown`/
 * `pdf_b64`/`entrada_clinica_id`, herencia clínica). Forzar el `ChatMessage[]` del core a través de
 * `MessageList` (tipado contra ESTOS tipos locales) sería la misma trampa que CTA7 ya pagó con el
 * cliente HTTP duplicado, un nivel más abajo. Mismo criterio que `sendChat`/`getReply` de este
 * mismo directorio: ruta propia sobre el cliente propio.
 *
 * **`funcion` es OBLIGATORIO** (shape real verificado contra `main`, 2026-08-10 — el backend
 * devuelve 422 sin él, `ChatSoporteIn.funcion: str` sin default).
 */
export interface SoporteChatRequest {
  session_id: string;
  text: string;
  funcion: FuncionSoporte;
  kind: ChatMessageKind;
}

/** `session_id` es el `channel_ref` que el SERVIDOR calculó (`soporte:{funcion}:{session_id}`),
 * NO un eco del que mandó el cliente — hay que adoptarlo antes de pollear `/reply`, o el chat
 * queda mudo para siempre sin ningún error que lo delate. */
export interface SoporteChatResponse {
  wf_id: string | null;
  accepted: boolean;
  session_id: string;
}

/** POST /soporte/chat — Bearer requerido. `GET /reply` es el mismo endpoint sin cambios (contrato
 * SOP5) — se reusa `getReply` de `./reply` tal cual, sin equivalente propio acá. */
export function sendSoporteChat(payload: SoporteChatRequest): Promise<SoporteChatResponse> {
  return apiClient.post<SoporteChatResponse>('/soporte/chat', payload);
}
