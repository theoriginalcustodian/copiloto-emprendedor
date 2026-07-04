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
 * Fila de modo del listado de Apps (diseño `Copiloto App.dc.html` líneas 236-258) — ícono de MARCA
 * real (`ServiceIcon`, compartido con Conexiones) + `display_name` (el nombre REAL del servicio,
 * ej. "Mercado Pago") + badge "RECONECTAR" si aplica + check circular cuando el modo está activo.
 * Pedido operador 2026-07-04 (mismo criterio que `ServiceCard` en Conexiones): SOLO el nombre real,
 * sin el `work_label` amigable ("Cobrar"/"Mail") ni subtítulo — el `work_label` sigue vivo en el
 * modeStore y alimenta el chip "Modo Mail" del Composer (la acción). Es un `<button>` real
 * (foco/teclado/click), mismo criterio que el `Chip` que reemplaza acá (layout de fila completa).
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

      <span className="mode-row__name">{service.display_name}</span>
      {reconnect && <Badge variant="warning">RECONECTAR</Badge>}

      {active && (
        <span className="mode-row__check" aria-hidden="true">
          <CheckIcon />
        </span>
      )}
    </button>
  );
}
