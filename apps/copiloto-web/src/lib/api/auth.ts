import { apiClient } from './client';
import type { LoginRequest, LoginResponse, SignupRequest, SignupResponse } from './types';

/** POST /auth/login — sin Bearer (todavía no hay sesión propia que adjuntar). */
export function login(email: string, password: string): Promise<LoginResponse> {
  const body: LoginRequest = { email, password };
  return apiClient.post<LoginResponse>('/auth/login', body, { auth: false });
}

/** POST /auth/signup — sin Bearer (todavía no hay tenant). NO devuelve tokens (`SignupResponse`);
 * el caller encadena `login()` con las mismas credenciales. */
export function signup(email: string, password: string): Promise<SignupResponse> {
  const body: SignupRequest = { email, password };
  return apiClient.post<SignupResponse>('/auth/signup', body, { auth: false });
}
