import { apiClient } from './client';
import type { ChatRequest, ChatResponse } from './types';

/** POST /chat — Bearer requerido. */
export function sendChat(payload: ChatRequest): Promise<ChatResponse> {
  return apiClient.post<ChatResponse>('/chat', payload);
}
