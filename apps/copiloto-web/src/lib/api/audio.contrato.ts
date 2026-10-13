import type { SendAudioResponse } from './types';

// Claves declaradas de POST /chat/audio (CONTRATO4, lado TS). Espejo de `CLAVES_CHAT_AUDIO` en
// `apps/copiloto/chat_contrato.py`: el test de paridad (`audio.contrato.paridad.test.ts`) LEE ese
// archivo como texto y compara los dos sets. `web.py:chat_audio` devuelve `{"wf_id", "accepted", "transcript"}`.
// Ancla ESTE tipo (`apps/copiloto-web`, el que corre el PWA en vivo), no la copia de `packages/core`.
// Sin `session_id` A PROPÓSITO (asimetría con `/chat` declarada en `chat_contrato.py`): sin `kind`
// el audio nunca abre un namespace de dictado, el id efectivo es siempre el enviado (#1050).
export const CLAVES_DECLARADAS: Record<keyof SendAudioResponse, true> = {
  wf_id: true,
  accepted: true,
  transcript: true,
};
