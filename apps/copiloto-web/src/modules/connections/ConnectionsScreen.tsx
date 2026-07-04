import { useMemo, useState } from 'react';

import { useSession } from '../../auth/useSession';
import { Button, Skeleton } from '../../design-system';
import type { CatalogService } from '../../lib/api';
import { ServiceCard } from './ServiceCard';
import { useConnections } from './useConnections';
import './connections.css';

/** A partir de esta cantidad de servicios aparece el buscador (EXTRACT: "si N crece, un buscador simple"). */
const SEARCH_THRESHOLD = 8;

const SKELETON_ROWS = 4;

function matchesQuery(service: CatalogService, query: string): boolean {
  const q = query.toLowerCase();
  return (
    service.display_name.toLowerCase().includes(q) ||
    service.work_label.toLowerCase().includes(q) ||
    service.description.toLowerCase().includes(q)
  );
}

/**
 * Inicial del avatar del header — mismo patrón que `AccountScreen` (`/me` hoy solo trae
 * `cliente_id`, no nombre/email, ver `lib/api/types.ts`): degrada a "?" sin sesión resuelta.
 */
function initial(clienteId: string | undefined): string {
  return (clienteId?.trim()?.[0] ?? '?').toUpperCase();
}

/**
 * Módulo Conexiones (Task 20, EXTRACT §2.8/§3.3) — grid PLANO de 2 columnas, SIN agrupar por
 * categoría (fiel al diseño, `Copiloto App.dc.html` líneas 312-370): las cards van en el orden que
 * entrega `/catalog` vía `useConnections`. Toda la LÓGICA (fetch, connect, refresh-al-volver-de-
 * foco) vive en el hook; acá solo presentación + el flujo de abrir el OAuth.
 */
export function ConnectionsScreen() {
  const { status, services, connectedCount, totalCount, connect, refresh } = useConnections();
  const { me } = useSession();
  const [query, setQuery] = useState('');
  const [connectingKey, setConnectingKey] = useState<string | null>(null);

  const filteredServices = useMemo(() => {
    const trimmed = query.trim();
    if (!trimmed) return services;
    return services.filter((service) => matchesQuery(service, trimmed));
  }, [services, query]);

  const handleConnect = async (service: CatalogService) => {
    setConnectingKey(service.key);
    try {
      const url = await connect(service);
      // Redirect full-page (no popup): el OAuth de MP/Composio necesita el flujo completo de
      // navegador; al volver, `useConnections` re-fetchea vía `visibilitychange`.
      window.location.assign(url);
    } catch {
      setConnectingKey(null);
    }
  };

  return (
    <div className="connections-screen" data-testid="connections-screen">
      <header className="connections-screen__header">
        <div className="connections-screen__heading">
          <h1 className="connections-screen__title">Conexiones</h1>
          {status === 'ready' && (
            <p className="connections-screen__count">
              {connectedCount} activas · {totalCount - connectedCount} disponibles
            </p>
          )}
        </div>
        <span className="connections-screen__avatar" aria-hidden="true">
          {initial(me?.cliente_id)}
        </span>
      </header>

      {status === 'loading' && (
        <div className="connections-screen__loading" data-testid="connections-loading">
          {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
            <Skeleton key={i} height={78} radius={20} />
          ))}
        </div>
      )}

      {status === 'error' && (
        <div className="connections-screen__error" data-testid="connections-error">
          <p>No pudimos cargar tus conexiones.</p>
          <Button variant="cancel" onClick={() => void refresh()}>
            Reintentar
          </Button>
        </div>
      )}

      {status === 'ready' && (
        <>
          {totalCount > SEARCH_THRESHOLD && (
            <input
              className="connections-screen__search"
              type="search"
              placeholder="Buscar una app…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label="Buscar servicio"
            />
          )}

          {totalCount === 0 ? (
            <p className="connections-screen__empty">Todavía no hay servicios disponibles.</p>
          ) : filteredServices.length === 0 ? (
            <p className="connections-screen__empty">Ninguna app coincide con &quot;{query}&quot;.</p>
          ) : (
            <div className="connections-screen__grid">
              {filteredServices.map((service) => (
                <ServiceCard
                  key={service.key}
                  service={service}
                  onConnect={(s) => void handleConnect(s)}
                  connecting={connectingKey === service.key}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
