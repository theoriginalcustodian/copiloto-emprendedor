import type { SoporteChatResponse } from './soporteChat';

// Claves declaradas de POST /soporte/chat (CONTRATO4, lado TS). Espejo de `CLAVES_SOPORTE_CHAT` en
// `apps/copiloto/chat_contrato.py`: el test de paridad (`soporteChat.contrato.paridad.test.ts`) LEE ese
// archivo como texto y compara los dos sets. `web.py:soporte_chat` devuelve `{"wf_id", "accepted", "session_id"}`.
// Ancla ESTE tipo (`apps/copiloto-web`, el que corre el PWA en vivo), no la copia de `packages/core`.
// `session_id` es el `channel_ref` que calculó el SERVIDOR (`soporte:<funcion>:<sid>`): el cliente
// lo adopta para los turnos siguientes y para pollear `/reply`.
export const CLAVES_DECLARADAS: Record<keyof SoporteChatResponse, true> = {
  wf_id: true,
  accepted: true,
  session_id: true,
};
