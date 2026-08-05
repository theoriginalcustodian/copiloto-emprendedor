import { apiClient } from './client';
import type { GoogleIdTokenRequest, LoginRequest, LoginResponse } from './types';

/** POST /auth/login — sin Bearer (todavía no hay sesión propia que adjuntar). */
export function login(email: string, password: string): Promise<LoginResponse> {
  const body: LoginRequest = { email, password };
  return apiClient.post<LoginResponse>('/auth/login', body, { auth: false });
}

/**
 * POST /auth/google/id-token — sign-in nativo de Google (Credential Manager en Android, sin
 * browser). `idToken` ya lo emitió Google nativamente en el device; el backend hace el id_token-grant
 * server-side contra GoTrue (mismo motivo que `login`: el cliente nunca habla directo con GoTrue).
 * Mismo shape de respuesta que `login` — el caller sigue el mismo camino post-login.
 */
export function loginWithGoogleIdToken(idToken: string): Promise<LoginResponse> {
  const body: GoogleIdTokenRequest = { id_token: idToken };
  return apiClient.post<LoginResponse>('/auth/google/id-token', body, { auth: false });
}
