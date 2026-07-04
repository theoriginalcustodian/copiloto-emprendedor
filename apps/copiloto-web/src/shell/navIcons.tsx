import type { ReactNode } from 'react';

import type { TabKey } from './TabBar';

/**
 * Set de íconos de navegación — SVG **verbatim del diseño** (`Copiloto App.dc.html:198-214`),
 * 24×24, `stroke="currentColor"` `stroke-width=1.8` (heredan el color del tab activo/inactivo).
 * Compartido: lo consume el `TabBar` mobile y (a futuro) el `Rail` desktop — un solo set, cero
 * duplicación. Antes eran glyphs emoji (`💬 ▦ 🔗 👤`): el `▦` renderizaba más chico que los emoji
 * de color → por eso "Apps" se veía más pequeño; con SVG los 4 miden exactamente igual.
 */
const svgProps = {
  width: 24,
  height: 24,
  viewBox: '0 0 24 24',
  fill: 'none',
  'aria-hidden': true as const,
};

const strokeProps = {
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export function ChatIcon(): ReactNode {
  return (
    <svg {...svgProps}>
      <path
        d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.9-.9L3 21l1.9-5.6A8.5 8.5 0 0 1 12.5 3 8.38 8.38 0 0 1 21 11.5z"
        {...strokeProps}
      />
    </svg>
  );
}

export function AppsIcon(): ReactNode {
  return (
    <svg {...svgProps}>
      <rect x="3" y="3" width="7" height="7" rx="1.6" stroke="currentColor" strokeWidth="1.8" />
      <rect x="14" y="3" width="7" height="7" rx="1.6" stroke="currentColor" strokeWidth="1.8" />
      <rect x="3" y="14" width="7" height="7" rx="1.6" stroke="currentColor" strokeWidth="1.8" />
      <rect x="14" y="14" width="7" height="7" rx="1.6" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

export function ConnectionsIcon(): ReactNode {
  return (
    <svg {...svgProps}>
      <path
        d="M9 15l6-6M10.5 6.5l1-1a4.24 4.24 0 0 1 6 6l-1 1M13.5 17.5l-1 1a4.24 4.24 0 0 1-6-6l1-1"
        {...strokeProps}
      />
    </svg>
  );
}

export function AccountIcon(): ReactNode {
  return (
    <svg {...svgProps}>
      <path d="M20 21a8 8 0 0 0-16 0M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" {...strokeProps} />
    </svg>
  );
}

/** Map declarativo key→ícono, alineado con el registro `TABS` de `TabBar` (data-driven). */
export const NAV_ICONS: Record<TabKey, () => ReactNode> = {
  chat: ChatIcon,
  apps: AppsIcon,
  connections: ConnectionsIcon,
  account: AccountIcon,
};
