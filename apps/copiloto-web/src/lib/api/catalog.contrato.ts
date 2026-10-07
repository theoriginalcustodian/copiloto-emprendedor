import type { CatalogResponse } from './types';

// Claves declaradas de GET /catalog (MECLAVESRESTO). `web.py:catalog` devuelve
// `{"services": build_catalog(...)}` -- ancla ESTE tipo local (el que corre el PWA); el cliente de
// `packages/core` (`listarCatalogo`, consumido por mobile) usa un tipo ANÓNIMO `{services: [...]}`,
// sin nombre exportado contra el que anclar un `Record<keyof X, true>`.

export const CLAVES_DECLARADAS: Record<keyof CatalogResponse, true> = {
  services: true,
};
