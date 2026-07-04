import { apiClient } from './client';
import type { CatalogResponse } from './types';

/** GET /catalog — Bearer requerido. */
export function catalog(): Promise<CatalogResponse> {
  return apiClient.get<CatalogResponse>('/catalog');
}
