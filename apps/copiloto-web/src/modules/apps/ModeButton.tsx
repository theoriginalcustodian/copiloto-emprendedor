import { Chip } from '../../design-system';
import './apps.css';

export interface ModeButtonProps {
  /** Glyph decorativo (emoji), `aria-hidden` — mismo criterio que `TabBar`/`Composer` (íconos
   * emoji, no un set SVG propio). */
  icon: string;
  label: string;
  active: boolean;
  onToggle: () => void;
  testId?: string;
}

/**
 * Botón de modo de la barra de Apps (spec §6) — reusa `Chip` del design-system (mismo primitivo
 * que las sugerencias/desambiguación, A-1: adaptar antes que crear) en vez de un botón nuevo:
 * `selected` ya mapea a `aria-pressed` + estilo `--user-*` (estado "activo" NO solo por color,
 * a11y §9) y `--chip-*` outline para inactivo. Táctil ≥44px vía `.mode-bar__button` (apps.css).
 */
export function ModeButton({ icon, label, active, onToggle, testId }: ModeButtonProps) {
  return (
    <Chip
      selected={active}
      className="mode-bar__button"
      onClick={onToggle}
      data-testid={testId}
    >
      <span className="mode-bar__icon" aria-hidden="true">
        {icon}
      </span>
      {label}
    </Chip>
  );
}
