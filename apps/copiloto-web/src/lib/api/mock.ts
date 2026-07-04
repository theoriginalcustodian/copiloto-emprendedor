import type {
  CatalogResponse,
  ChatRequest,
  ChatResponse,
  CopilotApi,
  LoginResponse,
  MeResponse,
  ReplyResponse,
} from './types';

/**
 * Implementaciones mock — MISMAS firmas que el transporte real (`CopilotApi`), para dev local sin
 * backend (`VITE_API_MOCK=1`, ver index.ts). `sendChat`/`getReply` simulan la naturaleza asíncrona
 * y durable del agente real: la respuesta no llega en el POST, aparece unos segundos después vía
 * polling — igual que el backend real (Temporal workflow procesando en background).
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

// Cola de replies simuladas por session_id — vive en memoria del módulo (alcanza para dev local).
const repliesBySession = new Map<string, PendingReply[]>();
let replyIdSeq = 0;

function mockReplyText(userText: string): string {
  return `(mock) Recibí tu mensaje: "${userText}". Esto es una respuesta simulada del agente.`;
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

  async me(): Promise<MeResponse> {
    await delay(undefined);
    return {
      cliente_id: 'mock-cliente-1',
      mp_connected: false,
      composio_connected: ['gmail', 'googlecalendar'],
    };
  },

  async catalog(): Promise<CatalogResponse> {
    await delay(undefined);
    return {
      services: [
        {
          key: 'gmail',
          display_name: 'Gmail',
          work_label: 'Enviar y leer emails',
          category: 'comunicacion',
          kind: 'composio',
          description: 'Conectá tu Gmail para que el copiloto redacte y envíe emails por vos.',
          capabilities: ['send_email', 'read_email'],
          connected: true,
          connect_path: '/connect/gmail',
        },
        {
          key: 'mercadopago',
          display_name: 'Mercado Pago',
          work_label: 'Cobrar y ver movimientos',
          category: 'pagos',
          kind: 'mercadopago',
          description: 'Conectá tu cuenta de Mercado Pago para cobrar y consultar tu caja.',
          capabilities: ['create_charge', 'list_movements'],
          connected: false,
          connect_path: '/connect/mercadopago',
        },
      ],
    };
  },

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

  async getReply(sessionId: string, afterId: number): Promise<ReplyResponse> {
    const queue = repliesBySession.get(sessionId) ?? [];
    const replies = queue.filter((reply) => reply.id > afterId);
    const nextId = replies.length > 0 ? replies[replies.length - 1]!.id : afterId;
    await delay(undefined, 100);
    return { replies, next_id: nextId };
  },
};
