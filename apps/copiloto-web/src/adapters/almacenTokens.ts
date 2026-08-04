import type { AlmacenTokens } from '@copiloto/core';

import { clearToken, getRefreshToken, getToken, setRefreshToken, setToken } from '../auth/session';

/**
 * `AlmacenTokens` de `@copiloto/core` (ADR-010) para `copiloto-web` — delega a `auth/session.ts`
 * en vez de reimplementar el storage: **MISMAS claves** (`copiloto-token`/`copiloto-refresh`) que
 * `lib/api/client.ts` (el cliente propio de web, usado hoy por chat/connections/account) y que
 * `apps/mobile/src/adapters/almacen.ts` — un login en cualquiera de las tres superficies deja la
 * sesión leíble por las otras. `leerToken`/`guardarToken` son async por contrato del puerto (ver su
 * docstring), aunque acá resuelvan sobre `localStorage` síncrono.
 */
export const almacenTokensWeb: AlmacenTokens = {
  async leerToken() {
    return getToken();
  },
  async guardarToken(token) {
    setToken(token);
  },
  async leerRefresh() {
    return getRefreshToken();
  },
  async guardarRefresh(token) {
    setRefreshToken(token);
  },
  async limpiar() {
    clearToken();
  },
};
