/**
 * Barrel del transporte de la API (Task 7). `api` es la única superficie que el resto de la app
 * debería importar — real por default, mock si `VITE_API_MOCK=1` (dev local sin backend).
 */
import { sendAudio } from './audio';
import { login } from './auth';
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
