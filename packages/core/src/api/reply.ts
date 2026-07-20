import { apiClient } from './client';
import type { RawReplyResponse, ReplyResponse } from './types';

/**
 * GET /reply?session_id=<>&after_id=<n> — Bearer requerido.
 *
 * Normaliza el shape CRUDO del backend (`reply_text`, `created_at`) al shape interno que consume
 * `useChat` (`text`). El nombre de campo del backend (`reply_text`) queda aislado acá — el resto de
 * la app (y el mock) hablan siempre `text`.
 *
 * No recibe `clienteId`: el hilo es `(session_id)` a secas, un chat único y continuo, sin partición
 * por cliente en ESTE hilo de lectura. El `cliente_id` de cada acción de negocio sigue viajando en
 * `/chat`/`/chat/audio` según corresponda.
 */
export async function getReply(sessionId: string, afterId: number): Promise<ReplyResponse> {
  const params = new URLSearchParams({
    session_id: sessionId,
    after_id: String(afterId),
  });
  const raw = await apiClient.get<RawReplyResponse>(`/reply?${params.toString()}`);
  return {
    replies: raw.replies.map((r) => ({
      id: r.id,
      text: r.reply_text,
      choices: r.choices ?? undefined,
      card: r.card ?? undefined,
    })),
    next_id: raw.next_id,
  };
}
