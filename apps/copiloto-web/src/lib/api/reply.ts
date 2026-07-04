import { apiClient } from './client';
import type { ReplyResponse } from './types';

/** GET /reply?session_id=<>&after_id=<n> — Bearer requerido. */
export function getReply(sessionId: string, afterId: number): Promise<ReplyResponse> {
  const params = new URLSearchParams({ session_id: sessionId, after_id: String(afterId) });
  return apiClient.get<ReplyResponse>(`/reply?${params.toString()}`);
}
