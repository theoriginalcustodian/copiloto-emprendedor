import type { LoginResponse } from './types';

// Claves declaradas de POST /auth/login (MECLAVESRESTO). `web.py:login` reenvía
// `gotrue.password_grant(...)` tal cual -- sin spreads -- así que el set es exactamente el que
// GoTrue emite. Ampliado 2026-10-07 (hallazgo backend, reconciliado contra GoTrue real v2.186.0):
// el payload trae 7 claves siempre, no 5 -- `expires_at`/`weak_password` no estaban en el docstring
// de `onboarding.py` que originó el set de PR #909.

export const CLAVES_DECLARADAS: Record<keyof LoginResponse, true> = {
  access_token: true,
  token_type: true,
  expires_in: true,
  expires_at: true,
  refresh_token: true,
  user: true,
  weak_password: true,
};
