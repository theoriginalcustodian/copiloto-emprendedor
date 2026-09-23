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
/**
 * DELETE al `disconnect_path` del servicio (mismo criterio data-driven que `getConnect`: MP va por
 * `/mp/connection` y Composio por `/composio/connection?service=<key>`, y esa regla la decide el
 * backend, no esta función). El backend responde 404 si el tenant no tenía esa conexión: se deja
 * propagar como `ApiError` para que la pantalla lo muestre en vez de fingir un éxito.
 */
export async function deleteConnection(disconnectPath: string): Promise<void> {
  await apiClient.delete<unknown>(disconnectPath);
}

export function getConnect(connectPath: string): Promise<ConnectResponse> {
  return apiClient.get<ConnectResponse>(connectPath);
}
