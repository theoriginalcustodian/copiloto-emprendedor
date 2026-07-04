import { apiClient } from './client';
import type { MeResponse } from './types';

/** GET /me — Bearer requerido. */
export function me(): Promise<MeResponse> {
  return apiClient.get<MeResponse>('/me');
}
