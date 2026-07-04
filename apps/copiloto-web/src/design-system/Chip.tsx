import type { ButtonHTMLAttributes } from 'react';

import './primitives.css';

export interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
}

/**
 * Chip de desambiguación/sugerencia (EXTRACT §2.7). `selected` = estilo de burbuja de usuario
 * (--user-*); no-seleccionado = outline transparente (--chip-border) + opacity .75.
 * Es un <button> real (foco/teclado/click) aunque en el mock original era estático — necesario
 * para que Task 14 (chips de desambiguación reales) lo pueda cablear sin reescribirlo.
 */
export function Chip({ selected = false, className, type = 'button', ...rest }: ChipProps) {
  const classes = ['uc-chip', selected ? 'uc-chip--selected' : 'uc-chip--outline', className]
    .filter(Boolean)
    .join(' ');
  return <button type={type} className={classes} aria-pressed={selected} {...rest} />;
}
