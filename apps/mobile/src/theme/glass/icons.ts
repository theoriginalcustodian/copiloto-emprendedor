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
  | 'conversacion'
  | 'soporte'
  | 'feedback'
  | 'grabar'
  | 'comoHablarle'
  | 'miNegocio'
  | 'perfilFiscal'
  | 'ajustes'
  | 'apariencia'
  | 'miPlan'
  | 'cuenta';

/* El catálogo de glifos dibujados a mano se retiró el 18/09: los íconos salen del set del
   sistema (`phosphor.ts`) y qué glifo le toca a cada pantalla vive en `mapaIconos.ts`. Este
   archivo conserva sólo el tipo `NombreIconoGlass`, que es el vocabulario de la app. */
