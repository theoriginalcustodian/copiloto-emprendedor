import { Chip } from '../../design-system';
import type { ReplyChoice } from '../../lib/api';
import './chat.css';

export interface DisambiguationChipsProps {
  choices: ReplyChoice[];
  onSelect: (value: string, label: string) => void;
}

/**
 * Chips de desambiguación (Task 14, EXTRACT §2.7). Todos arrancan SIN seleccionar (`Chip
 * selected=false`, default): el mock mostraba uno ya "elegido" porque es una ilustración
 * estática post-hecho — acá el usuario elige en vivo, ninguno arranca pre-seleccionado. Clic
 * dispara `onSelect(value, label)` (el consumidor decide el `send(value, {kind:'callback',
 * displayText: label})` — BL-D4, mismo criterio que el HITL: la burbuja nunca pinta el `value`).
 */
export function DisambiguationChips({ choices, onSelect }: DisambiguationChipsProps) {
  return (
    <div
      className="disambiguation-chips"
      role="group"
      aria-label="Elegí una opción"
      data-testid="disambiguation-chips"
    >
      {choices.map((choice) => (
        <Chip key={choice.value} onClick={() => onSelect(choice.value, choice.label)}>
          {choice.label}
        </Chip>
      ))}
    </div>
  );
}
