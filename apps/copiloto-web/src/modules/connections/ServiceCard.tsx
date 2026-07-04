import { Badge, Button, MonoLabel, Surface } from '../../design-system';
import { ServiceIcon } from '../../design-system/serviceIcons';
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

/**
 * Tarjeta de servicio del grid de Conexiones (Task 20, EXTRACT §2.8/§3.3 — fiel al diseño
 * `Copiloto App.dc.html` líneas 334-368): ícono de MARCA (`ServiceIcon`, compartido con
 * `modules/apps`; degrada a marca-letra si la key no tiene ícono mapeado) + `work_label`
 * (principal, grande — copy de trabajo, ej. "Cobrar") + `display_name` (secundario, ej. "Mercado
 * Pago") + indicador de estado al pie. SIN descripción — el diseño la deja afuera, la card es
 * compacta. 3 estados posibles (ver `deriveState` arriba sobre por qué solo 2 están activos hoy).
 *
 * La superficie (fondo/borde/sombra/blur/radio) reusa `<Surface variant="tile" blur>`
 * (design-system, EXTRACT §2.8 "grid de Conexiones" es uno de los 2 consumidores documentados de
 * `--tile-*`) en vez de duplicar esos tokens acá — los 2 estados que PISAN ese token base
 * (`--reconnect` borde de alerta, `--disconnected` opacidad) viven en `connections.css`.
 */
export function ServiceCard({ service, onConnect, connecting = false, state }: ServiceCardProps) {
  const resolvedState = state ?? deriveState(service);

  return (
    <Surface
      variant="tile"
      blur
      className={['service-card', `service-card--${resolvedState}`].join(' ')}
      data-testid={`service-card-${service.key}`}
      data-state={resolvedState}
    >
      <ServiceIcon serviceKey={service.key} name={service.display_name} size={38} radius={11} />

      <div className="service-card__body">
        <p className="service-card__work-label">{service.work_label}</p>
        <p className="service-card__name">{service.display_name}</p>
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
    </Surface>
  );
}
