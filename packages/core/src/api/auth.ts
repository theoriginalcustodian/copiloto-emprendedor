import { apiClient } from './client';
import type { LoginRequest, LoginResponse } from './types';

/** POST /auth/login — sin Bearer (todavía no hay sesión propia que adjuntar). */
export function login(email: string, password: string): Promise<LoginResponse> {
  const body: LoginRequest = { email, password };
  return apiClient.post<LoginResponse>('/auth/login', body, { auth: false });
}
