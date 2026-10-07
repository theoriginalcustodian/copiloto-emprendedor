import type { LoginResponse } from './types';

// Claves declaradas de POST /auth/login (MECLAVESRESTO, retrofit). `web.py:login` reenvía
// `gotrue.password_grant(...)` tal cual -- sin spreads -- así que el set es exactamente el que
// GoTrue emite: access_token, token_type, expires_in, refresh_token, user.
//
// ⚠️ Ancla ESTE `LoginResponse` (`apps/copiloto-web/src/lib/api/types.ts`), el que corre el PWA en
// vivo -- no `packages/core`'s `LoginResponse` (consumida por mobile), que es la que ancló el PR
// #909. Las dos declaran hoy el mismo set porque son una copia textual, pero son DOS tipos TS
// independientes sin ningún re-export entre ellos (a diferencia de `MeResponse`, que web SÍ
// re-exporta de `@copiloto/core`) -- así que el control de #909 no cubría el `LoginResponse` que
// el PWA en vivo realmente usa. Esta es la mitad que faltaba.

export const CLAVES_DECLARADAS: Record<keyof LoginResponse, true> = {
  access_token: true,
  token_type: true,
  expires_in: true,
  refresh_token: true,
  user: true,
};
