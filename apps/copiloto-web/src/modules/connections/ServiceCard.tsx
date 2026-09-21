import { useState } from 'react';

import { Badge, Button, MonoLabel, Surface } from '../../design-system';
import { ServiceIcon } from '../../design-system/serviceIcons';
import type { CatalogService } from '../../lib/api';
import './connections.css';

export type ServiceCardState = 'connected' | 'reconnect' | 'disconnected';

export interface ServiceCardProps {
  service: CatalogService;
  /** Conectar toca `useConnections.connect(service)` — este componente NO llama a la API. */
  onConnect: (service: CatalogService) => void;
  /**
   * Desconectar toca `useConnections.disconnect(service)`. La card sólo ofrece la acción si el
   * catálogo trae `disconnect_path` (backend nuevo) Y el caller pasa este handler; lo que se pierde
   * se le dice al usuario en una confirmación en la propia card (sin diálogo modal: un solo toque
   * no debe cortar el acceso del copiloto a una app).
   */
  onDisconnect?: (service: CatalogService) => Promise<void> | void;
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
 * `modules/apps`; degrada a marca-letra si la key no tiene ícono mapeado) + `display_name` (el
 * nombre REAL del servicio, ej. "Mercado Pago" / "Google Docs" — pedido operador 2026-07-04: solo el
 * nombre real, sin el `work_label` amigable ("Cobrar"/"Archivos") ni subtítulo) + indicador de estado
 * al pie. SIN descripción — el diseño la deja afuera, la card es compacta. 3 estados posibles (ver
 * `deriveState` arriba sobre por qué solo 2 están activos hoy).
 *
 * La superficie (fondo/borde/sombra/blur/radio) reusa `<Surface variant="tile" blur>`
 * (design-system, EXTRACT §2.8 "grid de Conexiones" es uno de los 2 consumidores documentados de
 * `--tile-*`) en vez de duplicar esos tokens acá — los 2 estados que PISAN ese token base
 * (`--reconnect` borde de alerta, `--disconnected` opacidad) viven en `connections.css`.
 */
/**
 * Qué pierde el usuario al desconectar, dicho con las capacidades REALES del servicio (mismo criterio
 * que mobile `PantallaApps.tsx`): un «¿estás seguro?» pelado no informa nada. Sin capacidades
 * declaradas cae en una frase genérica, nunca en una lista vacía que insinúe que no se pierde nada.
 * Drive tiene una consecuencia que no está en sus capacidades — la facturación — y se dice en
 * CONDICIONAL porque esta pantalla no conoce el perfil fiscal (afirmarlo sería inventar un dato).
 */
const CONSECUENCIA_EXTRA: Record<string, string> = {
  googledrive:
    'Si tenés activado "guardar mis facturas en Drive", tus facturas nuevas van a dejar de archivarse ahí.',
};

export function loQueSePierde(service: CatalogService): string {
  const base =
    service.capabilities.length === 0
      ? `El copiloto va a dejar de poder usar ${service.display_name} hasta que lo vuelvas a conectar.`
      : `El copiloto va a dejar de poder ${service.capabilities.map((c) => c.toLowerCase()).join(', ')} hasta que vuelvas a conectar ${service.display_name}.`;
  const extra = CONSECUENCIA_EXTRA[service.key];
  return extra ? `${base} ${extra}` : base;
}

export function ServiceCard({
  service,
  onConnect,
  onDisconnect,
  connecting = false,
  state,
}: ServiceCardProps) {
  const resolvedState = state ?? deriveState(service);
  const canDisconnect = Boolean(onDisconnect && service.disconnect_path);
  const [confirming, setConfirming] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [failed, setFailed] = useState(false);

  const confirmDisconnect = async () => {
    if (!onDisconnect) return;
    setDisconnecting(true);
    setFailed(false);
    try {
      await onDisconnect(service);
      setConfirming(false);
    } catch {
      // El backend rechazó (o no hubo red): la card sigue conectada y se lo decimos.
      setFailed(true);
    } finally {
      setDisconnecting(false);
    }
  };

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
        <p className="service-card__name">{service.display_name}</p>
        {service.description && (
          <p className="service-card__description" data-testid={`service-card-description-${service.key}`}>
            {service.description}
          </p>
        )}
      </div>

      <div className="service-card__footer">
        {resolvedState === 'connected' && (
          <span className="service-card__status" data-testid={`service-card-status-${service.key}`}>
            <span className="service-card__status-dot" aria-hidden="true" />
            <MonoLabel className="service-card__status-label">CONECTADO</MonoLabel>
          </span>
        )}

        {resolvedState === 'connected' && canDisconnect && !confirming && (
          <Button
            variant="ghost"
            className="service-card__disconnect"
            onClick={() => setConfirming(true)}
            aria-label={`Desconectar ${service.display_name}`}
          >
            Desconectar
          </Button>
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

      {confirming && (
        <div
          className="service-card__confirm"
          role="alertdialog"
          aria-label={`Desconectar ${service.display_name}`}
          data-testid={`service-card-confirm-${service.key}`}
        >
          <p className="service-card__confirm-text">{loQueSePierde(service)}</p>
          {failed && (
            <p className="service-card__confirm-error" role="alert">
              No pudimos desconectarlo. Probá de nuevo.
            </p>
          )}
          <div className="service-card__confirm-actions">
            <Button variant="cancel" onClick={() => setConfirming(false)} disabled={disconnecting}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={() => void confirmDisconnect()} disabled={disconnecting}>
              {disconnecting ? 'Desconectando…' : 'Sí, desconectar'}
            </Button>
          </div>
        </div>
      )}
    </Surface>
  );
}
