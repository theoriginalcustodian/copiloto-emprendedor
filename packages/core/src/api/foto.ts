import { postMultipart } from './client';
import type { ArchivoSubida } from './http';
import type { SendFotoResponse } from './types';

/**
 * POST /chat/foto (multipart/form-data) — Bearer requerido. Contrato: campos `session_id` (form) +
 * `imagen` (archivo, `image/jpeg` o `image/png`) + `cliente_id` (form) -> `{wf_id, accepted}`.
 * `cliente_id` se manda SIEMPRE (aunque venga vacío) — mismo criterio que `sendAudio`: si el backend
 * lo exige, un default silencioso acá escondería "sin cliente activo" detrás de un 422 genérico.
 *
 * Espejo de `sendAudio` (`audio.ts`), NO un mecanismo nuevo — usa el mismo `postMultipart`, el mismo
 * mapeo de errores 401/403 (vive una sola vez en `client.ts`). La diferencia real: **no hay
 * `transcript`** en la respuesta — la vision call arma el tool call `registrar_gasto` directamente,
 * sin pasar por texto libre (ver el docstring de `SendFotoResponse`).
 *
 * Contrato: `coordinacion/abierto/2026-08-03_contrato_planificacion-a-backend_POST-chat-foto-gastos-fase2.md`.
 */
export function sendFoto(
  sessionId: string,
  imagen: ArchivoSubida,
  clienteId: string,
): Promise<SendFotoResponse> {
  return postMultipart<SendFotoResponse>(
    '/chat/foto',
    { session_id: sessionId, cliente_id: clienteId },
    'imagen',
    imagen,
  );
}
