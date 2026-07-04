import type { CSSProperties, ReactNode } from 'react';

/**
 * Íconos de MARCA de los servicios — SVG **verbatim del diseño** (`Copiloto App.dc.html`, grid de
 * Conexiones líneas 335-365 + sheet de Apps líneas 237-257). Compartido por `modules/connections`
 * (grid 38×38 r:11) y `modules/apps` (filas 42×42 r:12). Reemplaza las marcas-letra ("M"/"G") por
 * el ícono real de cada marca.
 *
 * Vive en `design-system/` A PROPÓSITO: los colores de marca son hex fijos (fieles a cada marca, no
 * theme-aware — un logo no se retematiza) y este directorio NO está bajo el gate "cero hex en
 * componentes" (que sí cubre `modules/*` y `shell`). Mapea por la `key` REAL del catálogo
 * (`catalog.py`: `mercadopago`, `gmail`, `googlecalendar`, `hubspot`, `googledrive`, `googledocs`,
 * `googlesheets`, `instagram`); las keys sin ícono de marca degradan a marca-letra, nunca rompen.
 */

interface Brand {
  /** Fondo del contenedor (gradiente de marca o blanco). */
  bg: string;
  /** Los íconos sobre blanco llevan un borde sutil (verbatim diseño). */
  bordered?: boolean;
  icon: ReactNode;
}

const BRANDS: Record<string, Brand> = {
  mercadopago: {
    bg: 'linear-gradient(150deg,#00B7EA,#009EE3)',
    icon: (
      <svg width="60%" height="60%" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m11 17 2 2a1 1 0 1 0 3-3" />
        <path d="m14 14 2.5 2.5a1 1 0 1 0 3-3l-3.88-3.88a3 3 0 0 0-4.24 0l-.88.88a1 1 0 1 1-3-3l2.81-2.81a5.79 5.79 0 0 1 7.06-.87l.47.28a2 2 0 0 0 1.42.25L21 4" />
        <path d="m21 3 1 11h-2" />
        <path d="M3 3 2 14l6.5 6.5a1 1 0 1 0 3-3" />
        <path d="M3 4h8" />
      </svg>
    ),
  },
  googlecalendar: {
    bg: '#fff',
    bordered: true,
    icon: (
      <svg width="66%" height="66%" viewBox="0 0 24 24">
        <rect x="4.5" y="5" width="15" height="14.5" rx="2.5" fill="#fff" stroke="#4285F4" strokeWidth="1.6" />
        <text x="12" y="16.6" fontSize="8" fontWeight="700" fill="#4285F4" textAnchor="middle" fontFamily="Arial,sans-serif">31</text>
      </svg>
    ),
  },
  gmail: {
    bg: '#fff',
    bordered: true,
    icon: (
      <svg width="63%" height="63%" viewBox="0 0 24 24">
        <path d="M4 6.5h1.4L12 11l6.6-4.5H20a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-1.6V9.4L12 14 5.6 9.4V18.5H4a1 1 0 0 1-1-1v-10a1 1 0 0 1 1-1z" fill="#EA4335" />
      </svg>
    ),
  },
  hubspot: {
    bg: '#fff',
    bordered: true,
    icon: (
      <svg width="60%" height="60%" viewBox="0 0 24 24" fill="none">
        <circle cx="9" cy="15" r="4.2" stroke="#FF7A59" strokeWidth="2" />
        <path d="M9 10.8V5.6" stroke="#FF7A59" strokeWidth="2" strokeLinecap="round" />
        <circle cx="9" cy="4" r="2" fill="#FF7A59" />
        <path d="M12.2 12.4l3.2-3" stroke="#FF7A59" strokeWidth="2" strokeLinecap="round" />
        <circle cx="17" cy="8" r="2.4" stroke="#FF7A59" strokeWidth="2" />
      </svg>
    ),
  },
  googledrive: {
    bg: '#fff',
    bordered: true,
    icon: (
      <svg width="60%" height="60%" viewBox="0 0 24 24">
        <path d="M9 3l-7 12 3.5 6L15.5 9z" fill="#0f9d58" />
        <path d="M22 15L15 3H9l7 12z" fill="#ffcd40" />
        <path d="M2 15l3.5 6h13L22 15z" fill="#4285f4" />
      </svg>
    ),
  },
  googledocs: {
    bg: '#fff',
    bordered: true,
    icon: (
      <svg width="60%" height="60%" viewBox="0 0 24 24">
        <path d="M13 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-6-6z" fill="#4285F4" />
        <path d="M13 2v6h6l-6-6z" fill="#A1C2FA" />
        <rect x="8" y="12" width="8" height="1.3" rx="0.65" fill="#fff" />
        <rect x="8" y="15" width="8" height="1.3" rx="0.65" fill="#fff" />
        <rect x="8" y="18" width="5" height="1.3" rx="0.65" fill="#fff" />
      </svg>
    ),
  },
  googlesheets: {
    bg: '#fff',
    bordered: true,
    icon: (
      <svg width="60%" height="60%" viewBox="0 0 24 24">
        <path d="M13 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-6-6z" fill="#0F9D58" />
        <path d="M13 2v6h6l-6-6z" fill="#87D3AB" />
        <path d="M8 12.5h8v6H8z" fill="none" stroke="#fff" strokeWidth="1.1" />
        <path d="M8 15.5h8M11.3 12.5v6" stroke="#fff" strokeWidth="1.1" />
      </svg>
    ),
  },
  instagram: {
    bg: 'linear-gradient(135deg,#F58529,#DD2A7B 55%,#8134AF)',
    icon: (
      <svg width="58%" height="58%" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
        <rect x="3" y="3" width="18" height="18" rx="5.5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.2" cy="6.8" r="1.2" fill="#fff" stroke="none" />
      </svg>
    ),
  },
};

export interface ServiceIconProps {
  /** `key` real del catálogo (`CatalogService.key`). */
  serviceKey: string;
  /** Nombre para el fallback marca-letra (inicial) cuando la key no tiene ícono de marca. */
  name: string;
  /** Lado del contenedor en px (Conexiones 38, sheet de Apps 42). Default 38. */
  size?: number;
  /** Radio del contenedor en px (Conexiones 11, sheet 12). Default 11. */
  radius?: number;
}

/**
 * Ícono de marca del servicio. Contenedor cuadrado con el fondo de la marca + el SVG centrado;
 * degrada a marca-letra (inicial sobre tile theme-aware) si la key no está mapeada.
 */
export function ServiceIcon({ serviceKey, name, size = 38, radius = 11 }: ServiceIconProps) {
  const brand = BRANDS[serviceKey];

  const base: CSSProperties = {
    width: size,
    height: size,
    borderRadius: radius,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  };

  if (!brand) {
    const initial = name.trim().charAt(0).toUpperCase() || '?';
    return (
      <span
        aria-hidden="true"
        style={{
          ...base,
          background: 'var(--tile-bg)',
          border: 'var(--tile-border)',
          color: 'var(--concept)',
          fontFamily: 'var(--font-display)',
          fontWeight: 600,
          fontSize: size * 0.42,
        }}
      >
        {initial}
      </span>
    );
  }

  return (
    <span
      aria-hidden="true"
      style={{
        ...base,
        background: brand.bg,
        border: brand.bordered ? '1px solid rgba(0,0,0,.08)' : 'none',
      }}
    >
      {brand.icon}
    </span>
  );
}
