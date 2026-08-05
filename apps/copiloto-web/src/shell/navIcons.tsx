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

/** Billetera -- mismo lenguaje de trazo que el resto del set. Sin equivalente en el diseño
 * original (M-WEB spike 1, `contrato_planificacion-a-frontend_MWEB-spike-gastos-portado-a-web.md`
 * agrega el primer módulo de negocio al shell web, así que no hay SVG del mock para reusar). */
export function GastosIcon(): ReactNode {
  return (
    <svg {...svgProps}>
      <rect x="3" y="6" width="18" height="13" rx="2" {...strokeProps} />
      <path d="M3 10h18" {...strokeProps} />
      <path d="M16 14.5h2" {...strokeProps} />
    </svg>
  );
}

/** Cartera -- dos personas, para distinguirse del ícono de una sola persona de "Cuenta" (M-WEB
 * módulo 2, 2026-08-04). Mismo lenguaje de trazo que el resto del set; sin equivalente en el
 * diseño original por la misma razón que `GastosIcon`. */
export function ClientesIcon(): ReactNode {
  return (
    <svg {...svgProps}>
      <path d="M16 21a4 4 0 0 0-8 0" {...strokeProps} />
      <circle cx="12" cy="12.5" r="3.2" {...strokeProps} />
      <path d="M20.5 20a3.2 3.2 0 0 0-3.8-4.9M3.5 20a3.2 3.2 0 0 1 3.8-4.9" {...strokeProps} />
    </svg>
  );
}

/** Gráfico de barras -- lenguaje visual estándar de "contabilidad/reportes". Mismo trazo que el
 * resto del set (M-WEB, 2026-08-04). */
export function ContabilidadIcon(): ReactNode {
  return (
    <svg {...svgProps}>
      <path d="M4 20V10M11 20V4M18 20v-7" {...strokeProps} />
      <path d="M2.5 20h19" {...strokeProps} />
    </svg>
  );
}

/** Flecha entrando a una bandeja -- lenguaje visual de "ingreso/depósito", distinto de la
 * billetera de Gastos y de las barras de Contabilidad (M-WEB, 2026-08-04). */
export function IngresosIcon(): ReactNode {
  return (
    <svg {...svgProps}>
      <path d="M12 3v12M7 10.5l5 5 5-5" {...strokeProps} />
      <path d="M4 21h16" {...strokeProps} />
    </svg>
  );
}

/** Reloj -- lenguaje visual de "actividad reciente / historial", distinto del resto del set
 * (M-WEB, 2026-08-04). */
export function ActividadIcon(): ReactNode {
  return (
    <svg {...svgProps}>
      <circle cx="12" cy="12" r="9" {...strokeProps} />
      <path d="M12 7v5l3.5 2" {...strokeProps} />
    </svg>
  );
}

/** Documento con check -- lenguaje visual de "presupuesto/cotización", distinto del resto del set
 * (M-WEB, 2026-08-04). */
export function PresupuestosIcon(): ReactNode {
  return (
    <svg {...svgProps}>
      <path d="M6 3h9l3 3v15H6z" {...strokeProps} />
      <path d="M9 12.5l2 2 4-4.5" {...strokeProps} />
    </svg>
  );
}

/** Map declarativo key→ícono, alineado con el registro `TABS` de `TabBar` (data-driven). */
export const NAV_ICONS: Record<TabKey, () => ReactNode> = {
  chat: ChatIcon,
  apps: AppsIcon,
  connections: ConnectionsIcon,
  gastos: GastosIcon,
  clientes: ClientesIcon,
  contabilidad: ContabilidadIcon,
  ingresos: IngresosIcon,
  actividad: ActividadIcon,
  presupuestos: PresupuestosIcon,
  account: AccountIcon,
};
