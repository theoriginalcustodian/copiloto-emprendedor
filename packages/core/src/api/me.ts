import { apiClient } from './client';
import type { MeResponse } from './types';

/**
 * GET /me — Bearer requerido. Identidad del tenant autenticado (`cliente_id` + `email`, ambos
 * derivados del token en el backend: el cliente no puede falsearlos). Doble función:
 *  1) datos del bloque de Cuenta (Rail/TabBar/AccountScreen);
 *  2) PROBE de sesión en `SessionProvider` (mismo gate `require_tenant`: 401 sin token válido,
 *     403 sin tenant provisionado) — reemplaza al probe con `/warm`, que seguía siendo necesario
 *     como precalentamiento pero no traía identidad.
 */
export function me(): Promise<MeResponse> {
  return apiClient.get<MeResponse>('/me');
}
