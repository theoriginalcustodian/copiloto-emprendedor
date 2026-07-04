import { useEffect } from 'react';

import './primitives.css';

export type ToastVariant = 'neutral' | 'ok' | 'danger';

export interface ToastProps {
  message: string;
  variant?: ToastVariant;
  onDismiss?: () => void;
  durationMs?: number;
}

/**
 * Notificación efímera. No hay una sección propia de "Toast" en el EXTRACT — reusa los tokens
 * más cercanos (`--card-*` de base + acento `--ok-*`/`--danger-*` según variante).
 * Auto-descarta a los `durationMs` (default 4000ms) si se pasa `onDismiss`; `variant="danger"`
 * usa `role="alert"` (interrumpe al lector de pantalla), el resto `role="status"` (educado).
 */
export function Toast({ message, variant = 'neutral', onDismiss, durationMs = 4000 }: ToastProps) {
  useEffect(() => {
    if (!onDismiss) return;
    const id = window.setTimeout(onDismiss, durationMs);
    return () => window.clearTimeout(id);
  }, [onDismiss, durationMs]);

  return (
    <div
      className={['uc-toast', `uc-toast--${variant}`].join(' ')}
      role={variant === 'danger' ? 'alert' : 'status'}
      aria-live={variant === 'danger' ? 'assertive' : 'polite'}
    >
      <span className="uc-toast__message">{message}</span>
      {onDismiss ? (
        <button
          type="button"
          className="uc-toast__close"
          onClick={onDismiss}
          aria-label="Cerrar notificación"
        >
          ×
        </button>
      ) : null}
    </div>
  );
}
