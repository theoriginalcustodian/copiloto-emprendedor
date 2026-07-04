import { Badge } from '../../design-system';
import { ServiceIcon } from '../../design-system/serviceIcons';
import type { CatalogService } from '../../lib/api';
import './apps.css';

export interface ModeButtonProps {
  service: CatalogService;
  active: boolean;
  onToggle: () => void;
  testId?: string;
}

/**
 * ASUNCIÓN documentada (mismo criterio que `ServiceCard.deriveState` en
 * `modules/connections/ServiceCard.tsx`): el contrato ACTUAL de `CatalogService` solo expone
 * `connected: boolean` — no hay ninguna señal de "necesita reconectar" (token expirado, scope
 * revocado, etc.). El badge "RECONECTAR" de la fila Gmail (diseño línea 250) queda IMPLEMENTADO
 * acá, pero hoy nada en el catálogo lo dispara. Candidato para cuando el backend agregue la señal
 * real (`needs_reconnect`/`status`, fuera de este ownership) — ese día esta función pasa a leerla.
 */
function needsReconnect(_service: CatalogService): boolean {
  return false;
}

/** Check circular de fila seleccionada (diseño línea 239, verbatim). */
function CheckIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Fila de modo del listado de Apps (diseño `Copiloto App.dc.html` líneas 236-258, verbatim) —
 * ícono de MARCA real (`ServiceIcon`, compartido con Conexiones) + `work_label` (acción, ej.
 * "Cobrar") + `display_name` (servicio, ej. "Mercado Pago") + badge "RECONECTAR" si aplica +
 * check circular cuando el modo está activo. Es un `<button>` real (foco/teclado/click), mismo
 * criterio que el `Chip` que reemplaza acá (necesitaba layout de fila completa, no de chip).
 */
export function ModeButton({ service, active, onToggle, testId }: ModeButtonProps) {
  const reconnect = needsReconnect(service);

  return (
    <button
      type="button"
      className="mode-row"
      onClick={onToggle}
      aria-pressed={active}
      data-testid={testId}
    >
      <ServiceIcon serviceKey={service.key} name={service.display_name} size={42} radius={12} />

      <span className="mode-row__body">
        <span className="mode-row__label">{service.work_label}</span>
        <span className="mode-row__meta">
          <span className="mode-row__name">{service.display_name}</span>
          {reconnect && <Badge variant="warning">RECONECTAR</Badge>}
        </span>
      </span>

      {active && (
        <span className="mode-row__check" aria-hidden="true">
          <CheckIcon />
        </span>
      )}
    </button>
  );
}
