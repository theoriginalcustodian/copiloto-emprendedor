import type { ModoCopiloto } from '../chat/modo';
import type { ArchivoSubida } from './http';
import type {
  ChatRequest,
  ChatResponse,
  CopilotApi,
  LoginResponse,
  MeResponse,
  OauthEnsureResponse,
  ReplyResponse,
  SendAudioResponse,
  WarmResponse,
} from './types';

/**
 * Implementaciones mock — MISMAS firmas que el transporte real (`CopilotApi`), para dev local sin
 * backend (cada plataforma decide cuándo usarlas — el core NO elige real-vs-mock, ver `index.ts`).
 * `sendChat`/`getReply` simulan la naturaleza asíncrona y durable del agente real: la respuesta no
 * llega en el POST, aparece unos segundos después vía polling — igual que el backend real (Temporal
 * workflow procesando en background).
 */

const MOCK_DELAY_MS = 400;
const MOCK_REPLY_DELAY_MS = 1200;

function delay<T>(value: T, ms = MOCK_DELAY_MS): Promise<T> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(value), ms);
  });
}

interface PendingReply {
  id: number;
  text: string;
}

/** Cola de replies simuladas por `session_id` — vive en memoria del módulo (alcanza para dev
 * local). El hilo es un chat único y continuo, sin datos sensibles que aislar por cliente (el
 * contenido de negocio viaja por `payload.contenido`, no por el texto del hilo) — mismo criterio
 * que `getReply`/`useChat` reales. */
const repliesBySession = new Map<string, PendingReply[]>();
let replyIdSeq = 0;

function mockReplyText(userText: string): string {
  return `(mock) Recibí tu mensaje: "${userText}". Esto es una respuesta simulada del copiloto.`;
}

export const mockApi: CopilotApi = {
  async login(email: string): Promise<LoginResponse> {
    await delay(undefined);
    return {
      access_token: 'mock-access-token',
      token_type: 'bearer',
      expires_in: 3600,
      refresh_token: 'mock-refresh-token',
      user: { email },
    };
  },

  async ensureOauthTenant(): Promise<OauthEnsureResponse> {
    await delay(undefined);
    return { cliente_id: 'mock-cliente-1' };
  },

  me: async (): Promise<MeResponse> => ({ cliente_id: 'cli-mock-0001', email: 'demo@copiloto.test' }),

  async sendChat(payload: ChatRequest): Promise<ChatResponse> {
    const wfId = `mock-wf-${Date.now()}`;
    const replyId = ++replyIdSeq;
    const queue = repliesBySession.get(payload.session_id) ?? [];
    repliesBySession.set(payload.session_id, queue);

    // Encola la respuesta simulada; llega después vía getReply, nunca en este POST (igual que el
    // agente real, que procesa en background y responde por polling).
    setTimeout(() => {
      queue.push({ id: replyId, text: mockReplyText(payload.text) });
    }, MOCK_REPLY_DELAY_MS);

    await delay(undefined, 80);
    return { wf_id: wfId, accepted: true };
  },

  async sendAudio(sessionId: string, _archivo: ArchivoSubida, _clienteId: string, _modo?: ModoCopiloto | null): Promise<SendAudioResponse> {
    // Fake transcript — el dev local sin backend no transcribe de verdad, solo simula el shape
    // de respuesta y el mismo pipeline de reply asíncrono que `sendChat`.
    const transcript = '(mock) esto es lo que dijiste por audio';
    const wfId = `mock-wf-audio-${Date.now()}`;
    const replyId = ++replyIdSeq;
    const queue = repliesBySession.get(sessionId) ?? [];
    repliesBySession.set(sessionId, queue);

    setTimeout(() => {
      queue.push({ id: replyId, text: mockReplyText(transcript) });
    }, MOCK_REPLY_DELAY_MS);

    await delay(undefined, 80);
    return { wf_id: wfId, accepted: true, transcript };
  },

  async getReply(sessionId: string, afterId: number): Promise<ReplyResponse> {
    const queue = repliesBySession.get(sessionId) ?? [];
    const replies = queue.filter((reply) => reply.id > afterId);
    const nextId = replies.length > 0 ? replies[replies.length - 1]!.id : afterId;
    await delay(undefined, 100);
    return { replies, next_id: nextId };
  },

  async warm(): Promise<WarmResponse> {
    // Dev local sin backend: no hay grafo que precalentar, solo simula el shape "warmed" del real.
    await delay(undefined, 50);
    return { warmed: true };
  },
};
