import type { CSSProperties, ReactNode } from 'react';

import calendarLogo from './logos/calendar.svg';
import docsLogo from './logos/docs.svg';
import driveLogo from './logos/drive.svg';
import gmailLogo from './logos/gmail.svg';
import mercadopagoLogo from './logos/mercadopago.svg';
import sheetsLogo from './logos/sheets.svg';

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

/**
 * BL-X11 (decisión de Martín, DEC-10): los logos REALES de las apps, no una analogía dibujada. Son
 * marcas de terceros: no se tiñen ni se adaptan al tema, y van sobre un tile BLANCO (sobre arena el
 * rojo de Gmail y el azul de Calendar se ensucian). Fuente versionada en `./logos/` (copia de
 * `odobi-ui/assets/logos/`, ver `logos/LEEME.md` para la nota de uso de marca).
 *
 * Se cargan como `<img>` y no inline: los SVG traen clases CSS (`.cls-1` en Mercado Pago), ids de
 * máscaras y `width`/`height` fijos que, inline, se pisarían entre sí o contra el resto de la página.
 * Cada `<img>` aísla su propio documento.
 */
const LOGOS_REALES: Record<string, string> = {
  mercadopago: mercadopagoLogo,
  googlecalendar: calendarLogo,
  gmail: gmailLogo,
  googledrive: driveLogo,
  googledocs: docsLogo,
  googlesheets: sheetsLogo,
};

const BRANDS: Record<string, Brand> = {
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
  const logo = LOGOS_REALES[serviceKey];
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

  if (logo != null) {
    return (
      <span aria-hidden="true" style={{ ...base, background: '#fff', border: '1px solid rgba(0,0,0,.08)' }}>
        {/* `contain` por el lado largo: Docs es vertical, Drive y Mercado Pago apaisados. */}
        <img
          src={logo}
          alt=""
          data-testid={`logo-${serviceKey}`}
          style={{ maxWidth: '66%', maxHeight: '66%', objectFit: 'contain' }}
        />
      </span>
    );
  }

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
