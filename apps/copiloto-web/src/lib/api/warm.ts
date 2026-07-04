import { apiClient } from './client';
import type { WarmResponse } from './types';

/**
 * POST /warm — Bearer requerido. Precalienta la memoria de largo plazo del tenant (el `cliente_id` sale
 * del token en el backend, no del cliente). Best-effort: el caller (`useChat`) lo dispara fire-and-forget
 * al abrir la app / volver a la pestaña de chat; un fallo NO afecta el chat (solo se pierde la
 * optimización de latencia del 1er mensaje).
 */
export function warm(): Promise<WarmResponse> {
  return apiClient.post<WarmResponse>('/warm');
}
