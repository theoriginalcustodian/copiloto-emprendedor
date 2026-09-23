import { useCallback, useEffect, useRef, useState } from 'react';

import { api, type CatalogService } from '../../lib/api';

/**
 * Hook reusable del módulo Conexiones (Task 20) — agnóstico de presentación, mismo criterio que
 * `useChat`: la LÓGICA vive acá (fetch/agrupado/connect/refresh), la presentación en
 * `ConnectionsScreen`/`ServiceCard`. El shell desktop (fase futura) reusa este mismo hook.
 */

export type ConnectionsStatus = 'loading' | 'ready' | 'error';

export interface ConnectionsGroup {
  category: string;
  services: CatalogService[];
}

export interface UseConnectionsResult {
  status: ConnectionsStatus;
  services: CatalogService[];
  /** Servicios agrupados por `category`, en el orden de aparición del catálogo (lo decide el
   * backend, no se reordena alfabéticamente acá). */
  groups: ConnectionsGroup[];
  connectedCount: number;
  totalCount: number;
  /**
   * Pide la URL de OAuth del servicio (vía su `connect_path` — data-driven, nunca bifurca
   * MP/Composio acá). El CALLER decide cómo abrirla (ej. `window.location.assign`).
   */
  connect: (service: CatalogService) => Promise<string>;
  /**
   * Desconecta el servicio por su `disconnect_path` (data-driven, como `connect`) y re-lee el
   * catálogo: el estado de la card sale del backend, no de un flip local optimista — si el DELETE
   * falla (404/red) la tarjeta sigue «Conectada» y el error llega al caller. Sin `disconnect_path`
   * (backend viejo) no hay nada que llamar: rechaza en vez de fingir.
   */
  disconnect: (service: CatalogService) => Promise<void>;
  /** Re-fetch explícito del catálogo (ej. botón "Reintentar", o al volver del OAuth). */
  refresh: () => Promise<void>;
}

function groupByCategory(services: CatalogService[]): ConnectionsGroup[] {
  const order: string[] = [];
  const byCategory = new Map<string, CatalogService[]>();

  for (const service of services) {
    if (!byCategory.has(service.category)) {
      order.push(service.category);
      byCategory.set(service.category, []);
    }
    byCategory.get(service.category)!.push(service);
  }

  return order.map((category) => ({ category, services: byCategory.get(category)! }));
}

export function useConnections(): UseConnectionsResult {
  const [status, setStatus] = useState<ConnectionsStatus>('loading');
  const [services, setServices] = useState<CatalogService[]>([]);
  const loadingRef = useRef(false);

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    // Evita solapar 2 fetches (ej. el mount y un visibilitychange casi simultáneo).
    if (loadingRef.current) return;
    loadingRef.current = true;
    if (!opts?.silent) setStatus('loading');
    try {
      const response = await api.catalog();
      setServices(response.services);
      setStatus('ready');
    } catch {
      // Un refresh SILENCIOSO (background, ej. volver de foco) que falla no debe tirar abajo una
      // pantalla que ya tenía datos buenos — el usuario sigue viendo el último catálogo conocido.
      // Un load NO silencioso (mount inicial, o "Reintentar" explícito) sí pasa a error visible.
      if (!opts?.silent) setStatus('error');
    } finally {
      loadingRef.current = false;
    }
  }, []);

  // Carga inicial al montar.
  useEffect(() => {
    void load();
  }, [load]);

  // Re-fetch al volver a foco (ej. el usuario autorizó el OAuth en otra pestaña/ventana y vuelve
  // acá) — el proveedor (MP/Composio) no necesariamente redirige a una ruta propia de la SPA, así
  // que no podemos depender de un callback de ruta; `visibilitychange` cubre el caso real sin
  // acoplarse a cómo cada proveedor resuelve el redirect.
  useEffect(() => {
    function onVisibilityChange() {
      if (document.visibilityState === 'visible') void load({ silent: true });
    }
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [load]);

  const connect = useCallback(async (service: CatalogService): Promise<string> => {
    const { url } = await api.connect(service.connect_path);
    return url;
  }, []);

  const disconnect = useCallback(
    async (service: CatalogService): Promise<void> => {
      if (!service.disconnect_path) {
        throw new Error(`El catálogo no trae disconnect_path para ${service.key}`);
      }
      await api.disconnect(service.disconnect_path);
      // `silent`: la pantalla ya tiene datos; un fallo de la relectura no debe tirarla a «error».
      // `load` ignora el pedido si hay otro fetch en curso (loadingRef) — se espera a que termine.
      while (loadingRef.current) await new Promise((r) => setTimeout(r, 20));
      await load({ silent: true });
    },
    [load],
  );

  const refresh = useCallback(() => load(), [load]);

  const connectedCount = services.filter((service) => service.connected).length;

  return {
    status,
    services,
    groups: groupByCategory(services),
    connectedCount,
    totalCount: services.length,
    connect,
    disconnect,
    refresh,
  };
}
