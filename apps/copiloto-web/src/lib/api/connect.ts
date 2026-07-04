import { apiClient } from './client';
import type { ConnectResponse } from './types';

/**
 * GET al `connect_path` que trae cada servicio del catálogo (Bearer) — data-driven: el path
 * (`/mp/connect` para Mercado Pago, `/composio/connect?service=<key>` para el resto) lo decide el
 * BACKEND por servicio (`CatalogService.connect_path`); este helper nunca bifurca por proveedor,
 * solo hace GET al path que le pasan.
 *
 * Exportado como `getConnect` (mismo criterio de nombre que `getReply`); se cablea al método
 * `connect` de `CopilotApi` en `index.ts` porque así lo consume `useConnections`
 * (`api.connect(service.connect_path)`).
 */
export function getConnect(connectPath: string): Promise<ConnectResponse> {
  return apiClient.get<ConnectResponse>(connectPath);
}
