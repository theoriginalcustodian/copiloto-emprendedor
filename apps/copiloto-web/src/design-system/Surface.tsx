import type { HTMLAttributes, ReactNode } from 'react';

import './primitives.css';

export type SurfaceVariant = 'card' | 'tile' | 'bubble';

export interface SurfaceProps extends HTMLAttributes<HTMLDivElement> {
  variant?: SurfaceVariant;
  blur?: boolean;
  children: ReactNode;
}

/**
 * Superficie genérica (EXTRACT §1.3/§2.5/§2.6/§2.8):
 * - card   -> --card-*   (tarjeta HITL, card de durabilidad)
 * - tile   -> --tile-*   (grid de Conexiones, composer)
 * - bubble -> --bubble-* (burbuja de asistente; `blur` aplica el glass real del mock)
 *
 * El radio asimétrico de la cola de burbuja de chat (`20 20 20 6` / `20 20 6 20`) y el padding
 * exacto de la HITL card (`22px 20px 18px`) son detalle del componente consumidor específico
 * (Task 12/13) vía `className`/`style` — acá solo el token set + un radio/padding default
 * sensato para el Kit y para casos genéricos.
 */
export function Surface({
  variant = 'card',
  blur = false,
  className,
  children,
  ...rest
}: SurfaceProps) {
  const classes = ['uc-surface', `uc-surface--${variant}`, blur ? 'uc-surface--blur' : '', className]
    .filter(Boolean)
    .join(' ');
  return (
    <div className={classes} {...rest}>
      {children}
    </div>
  );
}
