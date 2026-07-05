import { apiClient } from './client';
import type { OauthEnsureResponse } from './types';

/**
 * POST /auth/oauth/ensure-tenant — provisiona el tenant en el FIRST-LOGIN de un proveedor OAuth
 * (Google). El user ya existe en GoTrue (alta self-service del proveedor); esto solo da de alta la
 * fila de tenant + propaga el claim. Idempotente en el backend (por `auth_user_id`), así que llamarlo
 * en cada login OAuth es seguro. Requiere Bearer (el token recién capturado del callback).
 */
export function ensureOauthTenant(): Promise<OauthEnsureResponse> {
  return apiClient.post<OauthEnsureResponse>('/auth/oauth/ensure-tenant', undefined, { auth: true });
}
