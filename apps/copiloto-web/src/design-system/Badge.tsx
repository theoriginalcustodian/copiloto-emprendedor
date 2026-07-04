import type { ReactNode } from 'react';

import './primitives.css';

export type BadgeVariant = 'warning' | 'danger' | 'ok' | 'neutral';

export interface BadgeProps {
  variant?: BadgeVariant;
  children: ReactNode;
  className?: string;
}

/**
 * Badge de estado, mono/uppercase (EXTRACT §2.6/§2.8):
 * - warning -> --badge-*  ("REVISAR", "RECONECTAR")
 * - danger  -> --danger-* ("IRREVERSIBLE")
 * - ok      -> --ok-*     ("CONECTADO", "PAGADO")
 * - neutral -> --chip-*   (closest token disponible; el EXTRACT no define un --badge-neutral-*)
 */
export function Badge({ variant = 'neutral', children, className }: BadgeProps) {
  const classes = ['uc-badge', `uc-badge--${variant}`, className].filter(Boolean).join(' ');
  return <span className={classes}>{children}</span>;
}
