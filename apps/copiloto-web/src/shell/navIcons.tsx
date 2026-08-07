import type { ReactNode } from 'react';

import type { TabKey } from './TabBar';

/**
 * Set de íconos de navegación -- **verbatim del set Odobi** (`Iconos Odobi.dc.html`, proyecto
 * "Copiloto emprendedor Odobi"), 24×24, trazo redondeado. Estructura hereda `currentColor` del tab
 * activo/inactivo; la señal (`var(--core)`, el acento único de las 3 pieles) marca el sub-trazo que
 * el diseño llama "acento" -- nunca un hex propio acá (ver `themesContrast.test.ts` del lado CSS).
 * Compartido: lo consume el `TabBar` mobile y (a futuro) el `Rail` desktop — un solo set, cero
 * duplicación.
 *
 * `AppsIcon`/`EscritorioIcon` NO tienen equivalente en el set de 21 (son íconos de NAVEGACIÓN --
 * "grid de funciones"/"launcher" -- no de función): quedan con su glifo propio, sólo alineado al
 * mismo trazo 1.7 del resto.
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
  strokeWidth: 1.7,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

/** El sub-trazo "acento" del diseño (señal, terracota) -- `var(--core)`, no un hex. */
const acentoProps = {
  stroke: 'var(--core)',
  strokeWidth: 1.7,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

/** Conversación -- la O concéntrica que irradia ondas, el motivo de marca de Odobi. */
export function ChatIcon(): ReactNode {
  return (
    <svg {...svgProps}>
      <path d="M10 4.5a7.5 7.5 0 1 0 0 15" {...strokeProps} />
      <path d="M10 8a4 4 0 1 0 0 8" {...strokeProps} />
      <path d="M15.4 9.2a4.2 4.2 0 0 1 0 5.6" {...acentoProps} />
      <path d="M18.4 7a8 8 0 0 1 0 10" {...acentoProps} />
    </svg>
  );
}

/** Sin equivalente en el set de 21 -- es navegación ("grid de funciones"), no una función. */
export function AppsIcon(): ReactNode {
  return (
    <svg {...svgProps}>
      <rect x="3" y="3" width="7" height="7" rx="1.6" {...strokeProps} />
      <rect x="14" y="3" width="7" height="7" rx="1.6" {...strokeProps} />
      <rect x="3" y="14" width="7" height="7" rx="1.6" {...strokeProps} />
      <rect x="14" y="14" width="7" height="7" rx="1.6" {...strokeProps} />
    </svg>
  );
}

/** Apps conectadas -- 4 nodos alrededor del centro (acento), el mismo glifo de "red" del set de 21. */
export function ConnectionsIcon(): ReactNode {
  return (
    <svg {...svgProps}>
      <circle cx="12" cy="12" r="2.4" {...acentoProps} />
      <circle cx="5.5" cy="6" r="1.8" {...strokeProps} />
      <circle cx="18.5" cy="6" r="1.8" {...strokeProps} />
      <circle cx="12" cy="19.5" r="1.8" {...strokeProps} />
      <path d="M10.3 10.5L7 7.4" {...strokeProps} />
      <path d="M13.7 10.5L17 7.4" {...strokeProps} />
      <path d="M12 14.4v3.3" {...strokeProps} />
    </svg>
  );
}

/** Cuenta -- cabeza + hombros, verbatim del set de 21. */
export function AccountIcon(): ReactNode {
  return (
    <svg {...svgProps}>
      <circle cx="12" cy="12" r="8.5" {...strokeProps} />
      <circle cx="12" cy="10" r="2.8" {...strokeProps} />
      <path d="M6.7 18.4a5.5 5.5 0 0 1 10.6 0" {...strokeProps} />
    </svg>
  );
}

/** Gastos -- billetera con flecha hacia arriba (acento) = plata que SALE. Verbatim del set de 21. */
export function GastosIcon(): ReactNode {
  return (
    <svg {...svgProps}>
      <path d="M4 12.5V19a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-6.5" {...strokeProps} />
      <path d="M12 13V3.5" {...strokeProps} />
      <path d="M8 7.5l4-4 4 4" {...acentoProps} />
    </svg>
  );
}

/** Clientes -- círculo (cabeza) + arco (hombros), verbatim del set de 21. */
export function ClientesIcon(): ReactNode {
  return (
    <svg {...svgProps}>
      <circle cx="12" cy="8.5" r="3.5" {...strokeProps} />
      <path d="M5.5 20a6.5 6.5 0 0 1 13 0" {...strokeProps} />
    </svg>
  );
}

/** Contabilidad -- barra + dos flechas (acento, entra/sale), verbatim del set de 21. */
export function ContabilidadIcon(): ReactNode {
  return (
    <svg {...svgProps}>
      <path d="M4 15.5h16" {...strokeProps} />
      <path d="M8 11V5" {...acentoProps} />
      <path d="M5.5 7.5L8 5l2.5 2.5" {...acentoProps} />
      <path d="M16 5v6" {...acentoProps} />
      <path d="M13.5 8.5L16 11l2.5-2.5" {...acentoProps} />
    </svg>
  );
}

/** Ingresos -- billetera con flecha hacia abajo (acento) = plata que ENTRA. Verbatim del set de 21. */
export function IngresosIcon(): ReactNode {
  return (
    <svg {...svgProps}>
      <path d="M4 12.5V19a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-6.5" {...strokeProps} />
      <path d="M12 3.5v9.5" {...strokeProps} />
      <path d="M8 9l4 4 4-4" {...acentoProps} />
    </svg>
  );
}

/** Actividad reciente -- flecha circular con reloj (acento), verbatim del set de 21. */
export function ActividadIcon(): ReactNode {
  return (
    <svg {...svgProps}>
      <path d="M20 12a8 8 0 1 1-2.3-5.6" {...strokeProps} />
      <path d="M20 4.5V8.5h-4" {...acentoProps} />
      <path d="M12 8v4.2l2.8 1.7" {...strokeProps} />
    </svg>
  );
}

/** Presupuestos -- documento con líneas, verbatim del set de 21. */
export function PresupuestosIcon(): ReactNode {
  return (
    <svg {...svgProps}>
      <path d="M6.5 3.5h7l4 4V20a.5.5 0 0 1-.5.5H6.5A.5.5 0 0 1 6 20V4a.5.5 0 0 1 .5-.5z" {...strokeProps} />
      <path d="M13 3.5V7.5h4" {...acentoProps} />
      <path d="M9 11.5h6" {...strokeProps} />
      <path d="M9 14.5h6" {...strokeProps} />
      <path d="M9 17.5h3.5" {...strokeProps} />
    </svg>
  );
}

/** Inteligencia -- foco con destellos (acento), verbatim del set de 21. */
export function InteligenciaIcon(): ReactNode {
  return (
    <svg {...svgProps}>
      <path
        d="M8.8 15.8a5.5 5.5 0 1 1 6.4 0 2.2 2.2 0 0 0-.9 1.8v.4H9.7v-.4a2.2 2.2 0 0 0-.9-1.8z"
        {...strokeProps}
      />
      <path d="M9.7 18.5h4.6" {...strokeProps} />
      <path d="M10.7 20.5h2.6" {...strokeProps} />
      <path d="M10.4 12.8a1.6 1.6 0 0 1 3.2 0" {...acentoProps} />
      <path d="M12 1.2v1.5" {...acentoProps} />
      <path d="M4.7 5.2l1 1" {...acentoProps} />
      <path d="M19.3 5.2l-1 1" {...acentoProps} />
    </svg>
  );
}

/** Mi día -- campana + destellos (acento), verbatim del set de 21. */
export function MidiaIcon(): ReactNode {
  return (
    <svg {...svgProps}>
      <path d="M4 17.5h16" {...strokeProps} />
      <path d="M7.5 17.5a4.5 4.5 0 0 1 9 0" {...strokeProps} />
      <path d="M12 5.5v2.5" {...acentoProps} />
      <path d="M6.4 8.4l1.5 1.5" {...acentoProps} />
      <path d="M17.6 8.4l-1.5 1.5" {...acentoProps} />
    </svg>
  );
}

/** Sin equivalente en el set de 21 -- es navegación ("launcher de funciones"), no una función. */
export function EscritorioIcon(): ReactNode {
  return (
    <svg {...svgProps}>
      <rect x="3.5" y="3.5" width="4.5" height="4.5" rx="1" {...strokeProps} />
      <rect x="9.75" y="3.5" width="4.5" height="4.5" rx="1" {...strokeProps} />
      <rect x="16" y="3.5" width="4.5" height="4.5" rx="1" {...strokeProps} />
      <rect x="3.5" y="9.75" width="4.5" height="4.5" rx="1" {...strokeProps} />
      <rect x="9.75" y="9.75" width="4.5" height="4.5" rx="1" {...strokeProps} />
      <rect x="16" y="9.75" width="4.5" height="4.5" rx="1" {...strokeProps} />
      <rect x="3.5" y="16" width="4.5" height="4.5" rx="1" {...strokeProps} />
      <rect x="9.75" y="16" width="4.5" height="4.5" rx="1" {...strokeProps} />
      <rect x="16" y="16" width="4.5" height="4.5" rx="1" {...strokeProps} />
    </svg>
  );
}

/** Memoria -- espiral con punto (acento), "cada hecho con su fecha". Distinto de `ActividadIcon`
 * a propósito -- son dos tabs separados (`actividad` vs `recientes`) y el set de 21 no tiene un
 * segundo glifo de "historial"; éste es la analogía más cercana. Verbatim del set de 21. */
export function RecientesIcon(): ReactNode {
  return (
    <svg {...svgProps}>
      <path d="M12 4a8 8 0 1 1-6 2.7" {...strokeProps} />
      <path d="M12 7.8a4.2 4.2 0 1 1-3 1.3" {...strokeProps} />
      <circle cx="12" cy="12" r="1.4" {...acentoProps} />
    </svg>
  );
}

/** Ajustes -- barras con dos círculos (acento), verbatim del set de 21. */
export function AjustesIcon(): ReactNode {
  return (
    <svg {...svgProps}>
      <path d="M4 8h9" {...strokeProps} />
      <circle cx="16" cy="8" r="2.3" {...acentoProps} />
      <path d="M18.3 8H20" {...strokeProps} />
      <path d="M4 16h3" {...strokeProps} />
      <circle cx="10" cy="16" r="2.3" {...acentoProps} />
      <path d="M12.3 16H20" {...strokeProps} />
    </svg>
  );
}

/** Facturación -- documento con check (acento), verbatim del set de 21. */
export function FacturacionIcon(): ReactNode {
  return (
    <svg {...svgProps}>
      <path d="M6.5 3.5h7l4 4V20a.5.5 0 0 1-.5.5H6.5A.5.5 0 0 1 6 20V4a.5.5 0 0 1 .5-.5z" {...strokeProps} />
      <path d="M13 3.5V7.5h4" {...strokeProps} />
      <path d="M9 11.5h5" {...strokeProps} />
      <path d="M9 15.4l1.7 1.7L14.2 13.6" {...acentoProps} />
    </svg>
  );
}

/**
 * Consola de operador -- monitor con pulso (acento). Como `AppsIcon`/`EscritorioIcon`, NO sale del
 * set de 21: es un ícono de navegación a una herramienta interna, no de una función del negocio del
 * emprendedor. Mismo trazo 1.7 y misma regla de acento que el resto: la señal es `var(--core)`, sin
 * hex propio.
 */
export function AdminIcon(): ReactNode {
  return (
    <svg {...svgProps}>
      <rect x="3" y="4.5" width="18" height="12" rx="1.6" {...strokeProps} />
      <path d="M9 20h6" {...strokeProps} />
      <path d="M12 16.5V20" {...strokeProps} />
      <path d="M6.5 11.2h2.2l1.6-2.6 2 5 1.5-2.4h3.7" {...acentoProps} />
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
  inteligencia: InteligenciaIcon,
  midia: MidiaIcon,
  escritorio: EscritorioIcon,
  recientes: RecientesIcon,
  ajustes: AjustesIcon,
  facturacion: FacturacionIcon,
  admin: AdminIcon,
  account: AccountIcon,
};
