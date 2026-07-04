import { useEffect, useState } from 'react';

import './primitives.css';

export interface StatusBarProps {
  /** Override para tests/Kit; sin esto, muestra la hora real y se refresca solo. */
  time?: string;
  className?: string;
}

function formatNow(): string {
  return new Date().toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/**
 * Barra de estado mobile (EXTRACT §2/status bar de los screenshots): reloj mono + ícono de
 * batería. No usa la Battery Status API (deprecada/removida de la mayoría de browsers) — el
 * ícono es estático, decorativo (`aria-hidden`).
 */
export function StatusBar({ time, className }: StatusBarProps) {
  const [clock, setClock] = useState(() => time ?? formatNow());

  useEffect(() => {
    if (time) return; // controlado externamente (tests / Kit)
    const id = window.setInterval(() => setClock(formatNow()), 15_000);
    return () => window.clearInterval(id);
  }, [time]);

  return (
    <div
      className={['uc-status-bar', className].filter(Boolean).join(' ')}
      data-testid="status-bar"
    >
      <span className="uc-status-bar__clock">{time ?? clock}</span>
      <span className="uc-status-bar__battery" aria-hidden="true">
        <svg width="22" height="11" viewBox="0 0 22 11" role="presentation" focusable="false">
          <rect
            x="0.5"
            y="0.5"
            width="18"
            height="10"
            rx="2.5"
            fill="none"
            stroke="currentColor"
            strokeOpacity="0.6"
          />
          <rect x="20" y="3.5" width="1.5" height="4" rx="0.75" fill="currentColor" fillOpacity="0.6" />
          <rect x="2" y="2" width="14" height="7" rx="1.2" fill="currentColor" />
        </svg>
      </span>
    </div>
  );
}
