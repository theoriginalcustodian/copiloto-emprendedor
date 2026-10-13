/**
 * Respuesta de `POST /chat/foto`. El PWA no tiene cliente de foto todavía (mobile lo consume por
 * `packages/core/src/api/foto.ts`): el tipo ancla vive acá para que el espejo tenga contra qué
 * compararse. Si web adopta `sendFoto`, este tipo pasa a `types.ts` y el espejo lo importa de ahí.
 *
 * ⚠️ DOS RAREZAS DECLARADAS en `apps/copiloto/chat_contrato.py` (`CLAVES_CHAT_FOTO`):
 *  1. `accepted` es SIEMPRE `true` en el 200 (literal en el backend). La señal de falla es el STATUS
 *     HTTP (413/415/422/502/503), no el campo: ramificar por `accepted` no enseña nada.
 *  2. `wf_id` NO es un id de workflow: es el `idem_key` (`foto:<uuid>`) de la card escrita por
 *     `adapter.send`; este camino no pasa por Temporal. Nada debe usarlo para pollear (se pollea
 *     `/reply` por `session_id`). Latente, no bug vivo; renombrarlo es un `pedido_` aparte.
 */
export interface SendFotoResponse {
  wf_id: string;
  accepted: true;
}

// Claves declaradas de POST /chat/foto (CONTRATO4, lado TS). Espejo de `CLAVES_CHAT_FOTO` en
// `apps/copiloto/chat_contrato.py`; paridad en `foto.contrato.paridad.test.ts`.
export const CLAVES_DECLARADAS: Record<keyof SendFotoResponse, true> = {
  wf_id: true,
  accepted: true,
};
