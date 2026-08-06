/**
 * Catálogo de los 21 íconos de función Odobi: descriptores de datos puros (`GlassIcon.tsx` los
 * traduce a primitivos `react-native-svg`). Verbatim del diseño (`Iconos Odobi.dc.html`, proyecto
 * "Copiloto emprendedor Odobi") -- viewBox 24×24, trazo redondeado, `currentColor` por defecto.
 *
 * CERO color acá -- cada elemento declara su ROL (`'estructura' | 'acento'`), nunca un hex; quien
 * resuelve el rol a color es `GlassIcon.tsx` (`'estructura'` -> `currentColor`, `'acento'` -> el
 * acento único del tema). Ver `temaSinHex.test.ts`.
 *
 * Reemplaza el catálogo "glass" (blobs radiales, 11 nombres semánticos, ver PR de ODOBI hito 5):
 * ese lenguaje visual (frost + blur + gradientes de 8 paletas) es exactamente lo que ODOBI retira,
 * misma familia que el `backdrop-filter`/`expo-blur` que hito 2 borra en paralelo. El acento único
 * reemplaza las 8 paletas -- ver la decisión §3 documentada en el PR.
 */

/** `'estructura'` (default) -> `currentColor`, hereda del contenedor. `'acento'` -> el acento único
 *  del tema activo (mismo valor en las 3 pieles) -- nunca un hex propio. */
export type ColorGlifo = 'estructura' | 'acento';

export interface PathGlifo {
  tipo: 'path';
  d: string;
  color?: ColorGlifo;
  /** `true` = relleno sólido sin trazo (único caso: el semicírculo de `apariencia`). Default: sólo
   *  trazo (`fill:none`), que es como está dibujado el resto del set. */
  relleno?: boolean;
}

export interface CirculoGlifo {
  tipo: 'circulo';
  cx: number;
  cy: number;
  r: number;
  color?: ColorGlifo;
}

export interface RectGlifo {
  tipo: 'rect';
  x: number;
  y: number;
  w: number;
  h: number;
  rx: number;
  color?: ColorGlifo;
}

export type ElementoGlifo = PathGlifo | CirculoGlifo | RectGlifo;

export interface DefinicionIconoOdobi {
  elementos: readonly ElementoGlifo[];
}

/** Los 21 nombres de función del set Odobi (`Iconos Odobi.dc.html`). */
export type NombreIconoGlass =
  | 'conversacion'
  | 'facturacion'
  | 'ingresos'
  | 'gastos'
  | 'presupuestos'
  | 'clientes'
  | 'miDia'
  | 'inteligencia'
  | 'contabilidad'
  | 'cobros'
  | 'appsConectadas'
  | 'actividadReciente'
  | 'memoria'
  | 'grabar'
  | 'comoHablarle'
  | 'miNegocio'
  | 'perfilFiscal'
  | 'ajustes'
  | 'apariencia'
  | 'miPlan'
  | 'cuenta';

export const CATALOGO_ICONOS: Record<NombreIconoGlass, DefinicionIconoOdobi> = {
  conversacion: {
    elementos: [
      { tipo: 'path', d: 'M10 4.5a7.5 7.5 0 1 0 0 15' },
      { tipo: 'path', d: 'M10 8a4 4 0 1 0 0 8' },
      { tipo: 'path', d: 'M15.4 9.2a4.2 4.2 0 0 1 0 5.6', color: 'acento' },
      { tipo: 'path', d: 'M18.4 7a8 8 0 0 1 0 10', color: 'acento' },
    ],
  },
  facturacion: {
    elementos: [
      { tipo: 'path', d: 'M6.5 3.5h7l4 4V20a.5.5 0 0 1-.5.5H6.5A.5.5 0 0 1 6 20V4a.5.5 0 0 1 .5-.5z' },
      { tipo: 'path', d: 'M13 3.5V7.5h4' },
      { tipo: 'path', d: 'M9 11.5h5' },
      { tipo: 'path', d: 'M9 15.4l1.7 1.7L14.2 13.6', color: 'acento' },
    ],
  },
  ingresos: {
    elementos: [
      { tipo: 'path', d: 'M4 12.5V19a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-6.5' },
      { tipo: 'path', d: 'M12 3.5v9.5' },
      { tipo: 'path', d: 'M8 9l4 4 4-4', color: 'acento' },
    ],
  },
  gastos: {
    elementos: [
      { tipo: 'path', d: 'M4 12.5V19a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-6.5' },
      { tipo: 'path', d: 'M12 13V3.5' },
      { tipo: 'path', d: 'M8 7.5l4-4 4 4', color: 'acento' },
    ],
  },
  presupuestos: {
    elementos: [
      { tipo: 'path', d: 'M6.5 3.5h7l4 4V20a.5.5 0 0 1-.5.5H6.5A.5.5 0 0 1 6 20V4a.5.5 0 0 1 .5-.5z' },
      { tipo: 'path', d: 'M13 3.5V7.5h4', color: 'acento' },
      { tipo: 'path', d: 'M9 11.5h6' },
      { tipo: 'path', d: 'M9 14.5h6' },
      { tipo: 'path', d: 'M9 17.5h3.5' },
    ],
  },
  clientes: {
    elementos: [
      { tipo: 'circulo', cx: 12, cy: 8.5, r: 3.5 },
      { tipo: 'path', d: 'M5.5 20a6.5 6.5 0 0 1 13 0' },
    ],
  },
  miDia: {
    elementos: [
      { tipo: 'path', d: 'M4 17.5h16' },
      { tipo: 'path', d: 'M7.5 17.5a4.5 4.5 0 0 1 9 0' },
      { tipo: 'path', d: 'M12 5.5v2.5', color: 'acento' },
      { tipo: 'path', d: 'M6.4 8.4l1.5 1.5', color: 'acento' },
      { tipo: 'path', d: 'M17.6 8.4l-1.5 1.5', color: 'acento' },
    ],
  },
  inteligencia: {
    elementos: [
      {
        tipo: 'path',
        d: 'M8.8 15.8a5.5 5.5 0 1 1 6.4 0 2.2 2.2 0 0 0-.9 1.8v.4H9.7v-.4a2.2 2.2 0 0 0-.9-1.8z',
      },
      { tipo: 'path', d: 'M9.7 18.5h4.6' },
      { tipo: 'path', d: 'M10.7 20.5h2.6' },
      { tipo: 'path', d: 'M10.4 12.8a1.6 1.6 0 0 1 3.2 0', color: 'acento' },
      { tipo: 'path', d: 'M12 1.2v1.5', color: 'acento' },
      { tipo: 'path', d: 'M4.7 5.2l1 1', color: 'acento' },
      { tipo: 'path', d: 'M19.3 5.2l-1 1', color: 'acento' },
    ],
  },
  contabilidad: {
    elementos: [
      { tipo: 'path', d: 'M4 15.5h16' },
      { tipo: 'path', d: 'M8 11V5', color: 'acento' },
      { tipo: 'path', d: 'M5.5 7.5L8 5l2.5 2.5', color: 'acento' },
      { tipo: 'path', d: 'M16 5v6', color: 'acento' },
      { tipo: 'path', d: 'M13.5 8.5L16 11l2.5-2.5', color: 'acento' },
    ],
  },
  cobros: {
    elementos: [
      { tipo: 'path', d: 'M12 3.5v17', color: 'acento' },
      {
        tipo: 'path',
        d: 'M15.8 7.6A3.5 3.5 0 0 0 12.4 5.6h-1.1a3 3 0 0 0-.5 5.95l2.7.5a3 3 0 0 1-.5 5.95h-1.1a3.5 3.5 0 0 1-3.4-2',
      },
    ],
  },
  appsConectadas: {
    elementos: [
      { tipo: 'circulo', cx: 12, cy: 12, r: 2.4, color: 'acento' },
      { tipo: 'circulo', cx: 5.5, cy: 6, r: 1.8 },
      { tipo: 'circulo', cx: 18.5, cy: 6, r: 1.8 },
      { tipo: 'circulo', cx: 12, cy: 19.5, r: 1.8 },
      { tipo: 'path', d: 'M10.3 10.5L7 7.4' },
      { tipo: 'path', d: 'M13.7 10.5L17 7.4' },
      { tipo: 'path', d: 'M12 14.4v3.3' },
    ],
  },
  actividadReciente: {
    elementos: [
      { tipo: 'path', d: 'M20 12a8 8 0 1 1-2.3-5.6' },
      { tipo: 'path', d: 'M20 4.5V8.5h-4', color: 'acento' },
      { tipo: 'path', d: 'M12 8v4.2l2.8 1.7' },
    ],
  },
  memoria: {
    elementos: [
      { tipo: 'path', d: 'M12 4a8 8 0 1 1-6 2.7' },
      { tipo: 'path', d: 'M12 7.8a4.2 4.2 0 1 1-3 1.3' },
      { tipo: 'circulo', cx: 12, cy: 12, r: 1.4, color: 'acento' },
    ],
  },
  grabar: {
    elementos: [
      { tipo: 'rect', x: 9, y: 3, w: 6, h: 11, rx: 3 },
      { tipo: 'path', d: 'M6 11a6 6 0 0 0 12 0' },
      { tipo: 'path', d: 'M12 17v3.5' },
      { tipo: 'path', d: 'M20 8.5a4.5 4.5 0 0 1 0 7', color: 'acento' },
    ],
  },
  comoHablarle: {
    elementos: [
      {
        tipo: 'path',
        d: 'M5 5.5h14a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1h-8l-4 3.5V15.5H5a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1z',
      },
      { tipo: 'path', d: 'M8.5 10.5v3', color: 'acento' },
      { tipo: 'path', d: 'M11 8.8v6.4', color: 'acento' },
      { tipo: 'path', d: 'M13.5 10v2.5', color: 'acento' },
      { tipo: 'path', d: 'M16 11v1.5', color: 'acento' },
    ],
  },
  miNegocio: {
    elementos: [
      { tipo: 'path', d: 'M5 9.5h14' },
      { tipo: 'path', d: 'M6 9.5l1-4.5h10l1 4.5', color: 'acento' },
      { tipo: 'path', d: 'M5 9.5V20a.5.5 0 0 0 .5.5h13a.5.5 0 0 0 .5-.5V9.5' },
      { tipo: 'path', d: 'M10 20.5v-5h4v5' },
    ],
  },
  perfilFiscal: {
    elementos: [
      {
        tipo: 'path',
        d: 'M12 3.5l6.5 2.3v5.2c0 4.3-2.9 7.4-6.5 9-3.6-1.6-6.5-4.7-6.5-9V5.8z',
      },
      { tipo: 'path', d: 'M9 12l2 2 4-4', color: 'acento' },
    ],
  },
  ajustes: {
    elementos: [
      { tipo: 'path', d: 'M4 8h9' },
      { tipo: 'circulo', cx: 16, cy: 8, r: 2.3, color: 'acento' },
      { tipo: 'path', d: 'M18.3 8H20' },
      { tipo: 'path', d: 'M4 16h3' },
      { tipo: 'circulo', cx: 10, cy: 16, r: 2.3, color: 'acento' },
      { tipo: 'path', d: 'M12.3 16H20' },
    ],
  },
  /** Único ícono con relleno: la mitad derecha del círculo es sólida (acento), sin trazo -- "claro
   *  · oscuro" como semicírculo, verbatim del diseño. */
  apariencia: {
    elementos: [
      { tipo: 'circulo', cx: 12, cy: 12, r: 8 },
      { tipo: 'path', d: 'M12 4v16a8 8 0 0 0 0-16z', color: 'acento', relleno: true },
    ],
  },
  miPlan: {
    elementos: [
      { tipo: 'rect', x: 4, y: 6.5, w: 16, h: 11, rx: 2.2 },
      { tipo: 'path', d: 'M4 10h16' },
      { tipo: 'path', d: 'M7 14h4', color: 'acento' },
    ],
  },
  cuenta: {
    elementos: [
      { tipo: 'circulo', cx: 12, cy: 12, r: 8.5 },
      { tipo: 'circulo', cx: 12, cy: 10, r: 2.8 },
      { tipo: 'path', d: 'M6.7 18.4a5.5 5.5 0 0 1 10.6 0' },
    ],
  },
};
