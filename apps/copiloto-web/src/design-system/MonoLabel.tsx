import type { ReactNode } from 'react';

import './primitives.css';

export interface MonoLabelProps {
  children: ReactNode;
  className?: string;
  htmlFor?: string;
}

/**
 * Label mono uppercase para pares label:valor (PARA/MONTO/CON/CUÁNDO — EXTRACT §1.1/§2.6) y
 * títulos de sección (ej. "ELEGÍ EL TEMA"). Semánticamente un <span> por default; pasar
 * `htmlFor` solo cuando en verdad envuelve/etiqueta un control de formulario.
 */
export function MonoLabel({ children, className, htmlFor }: MonoLabelProps) {
  const classes = ['uc-mono-label', className].filter(Boolean).join(' ');
  if (htmlFor) {
    return (
      <label htmlFor={htmlFor} className={classes}>
        {children}
      </label>
    );
  }
  return <span className={classes}>{children}</span>;
}
