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

/** Respuesta de `POST /me/legal/aceptar`: siempre trae la versión VIGENTE del server. */
export interface AceptarLegalResultado {
  aceptado: boolean;
  version: string;
  en: string;
}

/**
 * POST /me/legal/aceptar (BL-O6 parte B) — Bearer requerido. Registra que ESTE tenant vio y aceptó
 * `version` (la identidad sale del token, no del body). Idempotente: aceptar dos veces la misma
 * versión devuelve 200 las dos. `409` (con `extra.vigente`) si el texto que vio quedó viejo.
 * Gemelo de `apps/copiloto-web/src/lib/api/me.ts`.
 */
export function aceptarLegal(version: string): Promise<AceptarLegalResultado> {
  return apiClient.post<AceptarLegalResultado>('/me/legal/aceptar', { version });
}
