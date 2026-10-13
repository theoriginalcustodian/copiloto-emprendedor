import type { SoporteAudioResponse } from './soporteAudio';

// Claves declaradas de POST /soporte/chat/audio (CONTRATO4, lado TS). Espejo de `CLAVES_SOPORTE_CHAT_AUDIO` en
// `apps/copiloto/chat_contrato.py`: el test de paridad (`soporteAudio.contrato.paridad.test.ts`) LEE ese
// archivo como texto y compara los dos sets. `web.py:soporte_chat_audio` devuelve `{"wf_id", "accepted", "session_id", "transcript"}`.
// Ancla ESTE tipo (`apps/copiloto-web`, el que corre el PWA en vivo), no la copia de `packages/core`.

export const CLAVES_DECLARADAS: Record<keyof SoporteAudioResponse, true> = {
  wf_id: true,
  accepted: true,
  session_id: true,
  transcript: true,
};
