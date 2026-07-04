import type { ButtonHTMLAttributes } from 'react';

import './primitives.css';

export type ButtonVariant = 'primary' | 'cancel' | 'ghost' | 'danger';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

/**
 * Botón primitivo del design-system. 4 variantes verbatim del EXTRACT:
 * - primary -> --btn-*    (CTA principal, ej. "Sí, cobrar $X")
 * - cancel  -> --cancel-* (acción secundaria, ej. "Cancelar")
 * - ghost   -> --cancel-border + transparente (ej. "Conectar" en card sin conectar, EXTRACT §2.8)
 * - danger  -> --danger-btn-* (acción irreversible, ej. "Mantené para publicar")
 *
 * Táctil (min 44px alto), `type="button"` por default (no dispara submits accidentales),
 * `disabled` nativo (bloquea onClick sin lógica extra), foco visible vía `:focus-visible`.
 */
export function Button({ variant = 'primary', className, type = 'button', ...rest }: ButtonProps) {
  const classes = ['uc-btn', `uc-btn--${variant}`, className].filter(Boolean).join(' ');
  return <button type={type} className={classes} {...rest} />;
}
