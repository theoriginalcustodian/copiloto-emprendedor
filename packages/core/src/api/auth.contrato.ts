import type { LoginResponse } from './types';

// Claves declaradas de POST /auth/login (MECLAVESRESTO). `web.py:login` reenvía
// `gotrue.password_grant(...)` tal cual -- sin spreads, a diferencia de /me -- así que el set es
// exactamente el que GoTrue emite: access_token, token_type, expires_in, refresh_token, user.

export const CLAVES_DECLARADAS: Record<keyof LoginResponse, true> = {
  access_token: true,
  token_type: true,
  expires_in: true,
  refresh_token: true,
  user: true,
};
