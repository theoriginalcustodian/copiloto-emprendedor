import type { ChatResponse } from './types';

// Claves declaradas de POST /chat (MECLAVESRESTO). `web.py:chat` devuelve
// `{"wf_id": wf_id, "accepted": wf_id is not None}` -- ancla ESTE tipo (`apps/copiloto-web/src/lib/
// api/types.ts`), que es el que corre el PWA en vivo, no la copia de `packages/core` (la consume
// mobile; hoy son idénticas, pero `packages/core/src/api/catalogo.ts` ya documenta que web tiene su
// propia copia local "hasta que FE2 la migre" -- ver MECLAVESRESTO en PLAN.md).

export const CLAVES_DECLARADAS: Record<keyof ChatResponse, true> = {
  wf_id: true,
  accepted: true,
};
