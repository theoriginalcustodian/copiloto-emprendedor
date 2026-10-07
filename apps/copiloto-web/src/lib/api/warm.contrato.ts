import type { WarmResponse } from './types';

// Claves declaradas de POST /warm (MECLAVESRESTO). Los 3 `return` de `web.py:warm` comparten la
// misma forma: `{"warmed": bool}`.

export const CLAVES_DECLARADAS: Record<keyof WarmResponse, true> = {
  warmed: true,
};
