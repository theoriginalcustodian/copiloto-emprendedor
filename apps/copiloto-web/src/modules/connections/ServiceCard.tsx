import { Badge, Button, MonoLabel } from '../../design-system';
import type { CatalogService } from '../../lib/api';
import './connections.css';

export type ServiceCardState = 'connected' | 'reconnect' | 'disconnected';

export interface ServiceCardProps {
  service: CatalogService;
  /** Conectar toca `useConnections.connect(service)` — este componente NO llama a la API. */
  onConnect: (service: CatalogService) => void;
  /** Mientras se está pidiendo la URL de OAuth (deshabilita el botón + cambia el copy). */
  connecting?: boolean;
  /**
   * Override manual del estado visual. Default: derivado de `service.connected` (ver
   * `deriveState`). Ver ASUNCIÓN documentada abajo sobre por qué existe este override.
   */
  state?: ServiceCardState;
}

/**
 * ASUNCIÓN documentada (Task 20): el contrato ACTUAL de `CatalogService` (confirmado vivo contra
 * el backend) solo expone `connected: boolean` — no hay ninguna señal de "necesita reconectar"
 * (token expirado, scope revocado, etc.). El estado visual `reconnect` del EXTRACT (§2.8: badge
 * "RECONECTAR" + borde `--danger-border` en la card entera) queda IMPLEMENTADO y testeado en este
 * componente, pero HOY nada en el catálogo lo dispara — vive detrás de la prop `state` (override
 * explícito). `deriveState` solo puede devolver 'connected'/'disconnected' desde el boolean actual.
 *
 * Candidato para cuando el backend agregue la señal real (fuera de mi ownership, Task 5/backend):
 * un campo tipo `needs_reconnect: boolean` o un `status: 'connected'|'expired'|'disconnected'` en
 * `CatalogService`, cruzado desde el estado real del token en Composio/MP. Ese día,
 * `deriveState` pasa a leer ese campo en vez de asumir "solo 2 estados posibles".
 */
function deriveState(service: CatalogService): ServiceCardState {
  return service.connected ? 'connected' : 'disconnected';
}

function initial(name: string): string {
  const trimmed = name.trim();
  return trimmed ? trimmed.charAt(0).toUpperCase() : '?';
}

/**
 * Tarjeta de servicio del grid de Conexiones (Task 20, EXTRACT §2.8/§3.3): ícono/inicial +
 * `work_label` (principal, grande — copy de trabajo, ej. "Cobrar") + `display_name` (secundario,
 * ej. "Mercado Pago") + `description` + indicador de estado. 3 estados posibles (ver `deriveState`
 * arriba sobre por qué solo 2 están activos hoy).
 */
export function ServiceCard({ service, onConnect, connecting = false, state }: ServiceCardProps) {
  const resolvedState = state ?? deriveState(service);

  return (
    <div
      className={['service-card', `service-card--${resolvedState}`].join(' ')}
      data-testid={`service-card-${service.key}`}
      data-state={resolvedState}
    >
      <span className="service-card__icon" aria-hidden="true">
        {initial(service.display_name)}
      </span>

      <div className="service-card__body">
        <p className="service-card__work-label">{service.work_label}</p>
        <p className="service-card__name">{service.display_name}</p>
        {service.description && <p className="service-card__description">{service.description}</p>}
      </div>

      <div className="service-card__footer">
        {resolvedState === 'connected' && (
          <span className="service-card__status" data-testid={`service-card-status-${service.key}`}>
            <span className="service-card__status-dot" aria-hidden="true" />
            <MonoLabel className="service-card__status-label">CONECTADO</MonoLabel>
          </span>
        )}

        {resolvedState === 'reconnect' && <Badge variant="warning">RECONECTAR</Badge>}

        {resolvedState === 'disconnected' && (
          <Button
            variant="ghost"
            className="service-card__connect"
            onClick={() => onConnect(service)}
            disabled={connecting}
          >
            {connecting ? 'Conectando…' : 'Conectar'}
          </Button>
        )}
      </div>
    </div>
  );
}
