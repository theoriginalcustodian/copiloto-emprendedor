import type { RawReplyResponse } from './types';

// Claves declaradas de GET /reply (MECLAVESRESTO). `web.py:reply` devuelve
// `{"replies": rows, "next_id": next_id}` -- ancla `RawReplyResponse` (el shape CRUDO, antes del
// mapeo `reply_text` -> `text` que hace `reply.ts`), no `ReplyResponse` (el normalizado): comparar
// contra el normalizado compararía una transformación del cliente, no la respuesta real del
// backend. Mismo motivo que ancló MECLAVESCORE contra el `return` crudo de `/me`.

export const CLAVES_DECLARADAS: Record<keyof RawReplyResponse, true> = {
  replies: true,
  next_id: true,
};
