import { apiClient } from './client';
import type { AceptarLegalRequest, AceptarLegalResponse, MeResponse } from './types';

/** GET /me — Bearer requerido. */
export function me(): Promise<MeResponse> {
  return apiClient.get<MeResponse>('/me');
}

/** POST /me/legal/aceptar (BL-O6 parte B) — Bearer requerido. */
export function aceptarLegal(version: string): Promise<AceptarLegalResponse> {
  const body: AceptarLegalRequest = { version };
  return apiClient.post<AceptarLegalResponse>('/me/legal/aceptar', body);
}
