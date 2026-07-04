import { useMemo, useState } from 'react';

import { Button, MonoLabel, Skeleton } from '../../design-system';
import type { CatalogService } from '../../lib/api';
import { ServiceCard } from './ServiceCard';
import { useConnections } from './useConnections';
import './connections.css';

/** A partir de esta cantidad de servicios aparece el buscador (EXTRACT: "si N crece, un buscador simple"). */
const SEARCH_THRESHOLD = 8;

const SKELETON_ROWS = 4;

/**
 * Categorías conocidas -> label es-AR legible. NO es una whitelist cerrada: `categoryLabel`
 * degrada con gracia a cualquier categoría nueva que el backend agregue (capitaliza el string
 * crudo) — sumar un servicio con categoría nueva no rompe ni requiere tocar este componente.
 */
const CATEGORY_LABELS: Record<string, string> = {
  pagos: 'Pagos',
  comunicacion: 'Comunicación',
  agenda: 'Agenda',
  archivos: 'Archivos',
  clientes: 'Clientes',
  publicacion: 'Publicación',
};

function categoryLabel(category: string): string {
  const known = CATEGORY_LABELS[category];
  if (known) return known;
  return category.replace(/[_-]+/g, ' ').replace(/\b\p{L}/gu, (letter) => letter.toUpperCase());
}

function matchesQuery(service: CatalogService, query: string): boolean {
  const q = query.toLowerCase();
  return (
    service.display_name.toLowerCase().includes(q) ||
    service.work_label.toLowerCase().includes(q) ||
    service.description.toLowerCase().includes(q)
  );
}

/**
 * Módulo Conexiones (Task 20, EXTRACT §2.8/§3.3) — grid data-driven desde `/catalog`+`/me`
 * (vía `useConnections`), agrupado por `category`. Toda la LÓGICA (fetch, agrupado, connect,
 * refresh-al-volver-de-foco) vive en el hook; acá solo presentación + el flujo de abrir el OAuth.
 */
export function ConnectionsScreen() {
  const { status, groups, connectedCount, totalCount, connect, refresh } = useConnections();
  const [query, setQuery] = useState('');
  const [connectingKey, setConnectingKey] = useState<string | null>(null);

  const filteredGroups = useMemo(() => {
    const trimmed = query.trim();
    if (!trimmed) return groups;
    return groups
      .map((group) => ({
        category: group.category,
        services: group.services.filter((service) => matchesQuery(service, trimmed)),
      }))
      .filter((group) => group.services.length > 0);
  }, [groups, query]);

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
        <h1 className="connections-screen__title">Conexiones</h1>
        {status === 'ready' && (
          <p className="connections-screen__count">
            {connectedCount} conectados · {totalCount} disponibles
          </p>
        )}
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
          ) : (
            <div className="connections-screen__list">
              {filteredGroups.map((group) => (
                <section key={group.category} className="connections-screen__group">
                  <MonoLabel className="connections-screen__group-label">
                    {categoryLabel(group.category)}
                  </MonoLabel>
                  <div className="connections-screen__grid">
                    {group.services.map((service) => (
                      <ServiceCard
                        key={service.key}
                        service={service}
                        onConnect={(s) => void handleConnect(s)}
                        connecting={connectingKey === service.key}
                      />
                    ))}
                  </div>
                </section>
              ))}

              {filteredGroups.length === 0 && (
                <p className="connections-screen__empty">Ninguna app coincide con &quot;{query}&quot;.</p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
