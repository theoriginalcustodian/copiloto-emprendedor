/**
 * Barrel del transporte de la API (Task 7). `api` es la única superficie que el resto de la app
 * debería importar — real por default, mock si `VITE_API_MOCK=1` (dev local sin backend).
 */
import { sendAudio } from './audio';
import { login, signup } from './auth';
import { catalog } from './catalog';
import { sendChat } from './chat';
import { getConnect } from './connect';
import { me } from './me';
import { mockApi } from './mock';
import { ensureOauthTenant } from './oauth';
import { getReply } from './reply';
import type { CopilotApi } from './types';
import { warm } from './warm';

const realApi: CopilotApi = {
  login,
  signup,
  ensureOauthTenant,
  me,
  catalog,
  connect: getConnect,
  sendChat,
  sendAudio,
  getReply,
  warm,
};

export const api: CopilotApi = import.meta.env.VITE_API_MOCK === '1' ? mockApi : realApi;

export { ApiError, ForbiddenError, UnauthorizedError } from './client';
export * from './types';

/** `/soporte/chat` (SOP5) — fuera de `CopilotApi`/`realApi`/`mockApi` a propósito, mismo criterio
 * que separa `sendChat` del dominio de negocio: es otra ruta, otro dominio. Ver `soporteChat.ts`. */
export { sendSoporteChat } from './soporteChat';
export type { SoporteChatRequest, SoporteChatResponse } from './soporteChat';
