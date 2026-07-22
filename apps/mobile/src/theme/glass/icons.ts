/**
 * Catálogo de geometría de los iconos "glass": silueta (para clip + borde), blobs de color y glifo.
 * CERO color acá — los blobs referencian una paleta por NOMBRE (`iconPalette.ts`) y el glifo un
 * color por rol (`'blanco' | 'acentoCian' | 'acentoAmbar'`); quien resuelve el nombre a hex es
 * `GlassIcon.tsx`. Ver `temaSinHex.test.ts`.
 *
 * Port 1:1 del objeto `ICONS` de
 * `App glass/DocuMed 2 — Skin Z-Depth HUD (exploración)/glass-icons-v2.js` (fuente canónica del
 * prototipo), acotado a los 9 nombres semánticos que la app mobile necesita hoy. Los 9 existen tal
 * cual en el source (mapeo identidad, ver reporte de la tarea) — no fue necesario componer ninguno.
 *
 * El `glyph` del source era markup SVG crudo (string); acá es una lista de descriptores de datos
 * puros (`ElementoGlifo`) que `GlassIcon.tsx` traduce a primitivos `react-native-svg` — un `.ts` de
 * sólo-datos no puede tener JSX.
 */
import type { NombrePaletaBlob } from './iconPalette';

// ---- helpers de forma (idénticos a `rr`/`circ` del source — devuelven el `d` de un path) ----

/** Rectángulo redondeado centrado en `(x,y)` con ancho `w`, alto `h` y radio `r`. */
function rr(x: number, y: number, w: number, h: number, r: number): string {
  return (
    `M${x + r},${y} h${w - 2 * r} a${r},${r} 0 0 1 ${r},${r} v${h - 2 * r} ` +
    `a${r},${r} 0 0 1 ${-r},${r} h${-(w - 2 * r)} a${r},${r} 0 0 1 ${-r},${-r} ` +
    `v${-(h - 2 * r)} a${r},${r} 0 0 1 ${r},${-r} z`
  );
}

/** Círculo centrado en `(cx,cy)` de radio `r`, como path (para poder combinarlo con `extra`). */
function circ(cx: number, cy: number, r: number): string {
  return `M${cx - r},${cy} a${r},${r} 0 1 0 ${2 * r},0 a${r},${r} 0 1 0 ${-2 * r},0 z`;
}

// ---- descriptores del glifo (datos puros; `GlassIcon.tsx` los renderiza) ----

export type ColorGlifo = 'blanco' | 'acentoCian' | 'acentoAmbar';

export interface LineaGlifo {
  tipo: 'linea';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: ColorGlifo;
  ancho: number;
  opacidad?: number;
}

export interface CirculoGlifo {
  tipo: 'circulo';
  cx: number;
  cy: number;
  r: number;
  color: ColorGlifo;
  /** `true` = relleno sólido (glifo tipo "punto"); `false` = sólo contorno (requiere `ancho`). */
  relleno: boolean;
  ancho?: number;
  opacidad?: number;
}

export interface RectGlifo {
  tipo: 'rect';
  x: number;
  y: number;
  w: number;
  h: number;
  rx: number;
  color: ColorGlifo;
  opacidad?: number;
}

export interface PathGlifo {
  tipo: 'path';
  d: string;
  color: ColorGlifo;
  relleno: boolean;
  ancho?: number;
  opacidad?: number;
}

export type ElementoGlifo = LineaGlifo | CirculoGlifo | RectGlifo | PathGlifo;

// ---- catálogo del icono completo ----

export interface BlobIcono {
  cx: number;
  cy: number;
  r: number;
  paleta: NombrePaletaBlob;
}

export interface DefinicionIconoGlass {
  /** Path de la silueta principal — recorta el clip y dibuja el borde de luz exterior. */
  shape: string;
  /** Trazo adicional opcional (ej. el "globo" de `chat`, o la base de `chart`) — mismo tratamiento
   * que `shape` pero con el borde algo más tenue, igual que el source. */
  extra?: string;
  blobs: BlobIcono[];
  glifo: ElementoGlifo[];
}

/** Los 10 nombres semánticos que la app mobile necesita hoy. */
export type NombreIconoGlass =
  | 'folder'
  | 'note'
  | 'doc_search'
  | 'mic'
  | 'chat'
  | 'clock'
  | 'settings'
  | 'chart'
  | 'media'
  | 'user'
  /**
   * La billetera de "Gastos". **Se agregó en vez de reusar `chart`** (que ya es Métricas): dos tiles
   * con el mismo glifo en el mismo grid no se distinguen de un vistazo, que es exactamente para lo
   * que sirve un ícono. Cuando el catálogo cerrado no alcanza, la salida es ampliarlo, no repetir.
   */
  | 'wallet'
  | 'ingreso';

/**
 * Tipado explícito (`Record<NombreIconoGlass, DefinicionIconoGlass>`), NO `as const satisfies` —
 * con `as const` cada entrada sin `extra` queda tipada SIN esa propiedad (ni siquiera `undefined`),
 * y `CATALOGO_ICONOS[name].extra` deja de compilar para el resto de las entradas. El tipo explícito
 * le da a las 9 entradas la forma completa de `DefinicionIconoGlass` (con `extra?` real), que es lo
 * que `GlassIcon.tsx` necesita para leerlo de forma uniforme sin narrowing por nombre.
 */
export const CATALOGO_ICONOS: Record<NombreIconoGlass, DefinicionIconoGlass> = {
  folder: {
    shape:
      'M20,34 v-4 a5,5 0 0 1 5,-5 h13 l6,7 h26 a5,5 0 0 1 5,5 v33 a5,5 0 0 1 -5,5 h-45 a5,5 0 0 1 -5,-5 z',
    blobs: [
      { cx: 34, cy: 48, r: 24, paleta: 'amber' },
      { cx: 68, cy: 66, r: 22, paleta: 'magOrange' },
    ],
    glifo: [],
  },
  note: {
    shape: rr(26, 18, 48, 64, 10),
    blobs: [
      { cx: 40, cy: 34, r: 20, paleta: 'cyanBlue' },
      { cx: 64, cy: 68, r: 20, paleta: 'purplePink' },
    ],
    glifo: [
      { tipo: 'linea', x1: 37, y1: 38, x2: 63, y2: 38, color: 'blanco', ancho: 4, opacidad: 0.92 },
      { tipo: 'linea', x1: 37, y1: 50, x2: 63, y2: 50, color: 'blanco', ancho: 4, opacidad: 0.92 },
      { tipo: 'linea', x1: 37, y1: 62, x2: 55, y2: 62, color: 'blanco', ancho: 4, opacidad: 0.92 },
    ],
  },
  doc_search: {
    shape: rr(24, 20, 44, 56, 9),
    blobs: [
      { cx: 40, cy: 36, r: 20, paleta: 'cyanTeal' },
      { cx: 60, cy: 66, r: 18, paleta: 'violet' },
    ],
    glifo: [
      { tipo: 'linea', x1: 34, y1: 36, x2: 50, y2: 36, color: 'blanco', ancho: 4, opacidad: 0.9 },
      { tipo: 'linea', x1: 34, y1: 46, x2: 46, y2: 46, color: 'blanco', ancho: 4, opacidad: 0.9 },
      { tipo: 'circulo', cx: 60, cy: 62, r: 10, color: 'acentoCian', relleno: false, ancho: 5 },
      { tipo: 'linea', x1: 68, y1: 70, x2: 78, y2: 80, color: 'acentoCian', ancho: 5 },
    ],
  },
  mic: {
    shape:
      'M50,18 a12,12 0 0 1 12,12 v14 a12,12 0 0 1 -24,0 v-14 a12,12 0 0 1 12,-12 z ' +
      'M30,44 a20,20 0 0 0 40,0 M50,64 v14 M40,82 h20',
    blobs: [
      { cx: 50, cy: 34, r: 20, paleta: 'magOrange' },
      { cx: 50, cy: 52, r: 16, paleta: 'yellowOrange' },
    ],
    glifo: [],
  },
  chat: {
    shape:
      'M22,30 a10,10 0 0 1 10,-10 h24 a10,10 0 0 1 10,10 v14 a10,10 0 0 1 -10,10 h-16 l-12,10 ' +
      'v-10 a10,10 0 0 1 -6,-9 z',
    extra: circ(70, 62, 15),
    blobs: [
      { cx: 40, cy: 34, r: 20, paleta: 'purplePink' },
      { cx: 70, cy: 60, r: 16, paleta: 'yellowOrange' },
    ],
    glifo: [
      { tipo: 'circulo', cx: 34, cy: 37, r: 3, color: 'blanco', relleno: true, opacidad: 0.9 },
      { tipo: 'circulo', cx: 44, cy: 37, r: 3, color: 'blanco', relleno: true, opacidad: 0.9 },
      { tipo: 'circulo', cx: 54, cy: 37, r: 3, color: 'blanco', relleno: true, opacidad: 0.9 },
    ],
  },
  clock: {
    shape: circ(50, 50, 32),
    blobs: [
      { cx: 62, cy: 62, r: 22, paleta: 'cyanTeal' },
      { cx: 40, cy: 38, r: 18, paleta: 'violet' },
    ],
    glifo: [
      { tipo: 'linea', x1: 50, y1: 34, x2: 50, y2: 52, color: 'acentoCian', ancho: 5 },
      { tipo: 'linea', x1: 50, y1: 52, x2: 63, y2: 60, color: 'acentoCian', ancho: 5 },
    ],
  },
  settings: {
    shape: rr(20, 26, 60, 48, 12),
    blobs: [
      { cx: 36, cy: 40, r: 18, paleta: 'cyanTeal' },
      { cx: 64, cy: 60, r: 18, paleta: 'magOrange' },
    ],
    glifo: [
      { tipo: 'linea', x1: 30, y1: 40, x2: 70, y2: 40, color: 'blanco', ancho: 4, opacidad: 0.92 },
      { tipo: 'linea', x1: 30, y1: 60, x2: 70, y2: 60, color: 'blanco', ancho: 4, opacidad: 0.92 },
      { tipo: 'circulo', cx: 58, cy: 40, r: 6, color: 'acentoAmbar', relleno: true },
      { tipo: 'circulo', cx: 42, cy: 60, r: 6, color: 'acentoCian', relleno: true },
    ],
  },
  chart: {
    shape: rr(20, 26, 60, 44, 8),
    extra: 'M50,70 v8 M38,82 h24',
    blobs: [
      { cx: 38, cy: 42, r: 18, paleta: 'cyanBlue' },
      { cx: 64, cy: 40, r: 16, paleta: 'magOrange' },
    ],
    glifo: [
      { tipo: 'rect', x: 32, y: 48, w: 7, h: 14, rx: 2, color: 'blanco', opacidad: 0.92 },
      { tipo: 'rect', x: 46, y: 40, w: 7, h: 22, rx: 2, color: 'blanco', opacidad: 0.92 },
      { tipo: 'rect', x: 60, y: 52, w: 7, h: 10, rx: 2, color: 'blanco', opacidad: 0.92 },
    ],
  },
  media: {
    shape: circ(50, 50, 28),
    blobs: [
      { cx: 42, cy: 42, r: 18, paleta: 'magOrange' },
      { cx: 60, cy: 60, r: 16, paleta: 'cyanTeal' },
    ],
    glifo: [{ tipo: 'path', d: 'M44,38 l20,12 l-20,12 z', color: 'blanco', relleno: true, opacidad: 0.95 }],
  },
  // Port 1:1 de `user` del source (`glass-icons-v2.js`, label "Paciente" en DocuMed): cabeza + hombros.
  // Entró al catálogo cuando Pacientes pasó a tener su propio ícono de entrada en el escritorio de
  // DocuMed (2026-07-18); acá se hereda igual, para el equivalente "Clientes". Los otros 9 ya estaban.
  user: {
    shape: circ(50, 50, 32),
    blobs: [
      { cx: 50, cy: 40, r: 22, paleta: 'cyanBlue' },
      { cx: 50, cy: 74, r: 24, paleta: 'cyanTeal' },
    ],
    glifo: [
      { tipo: 'circulo', cx: 50, cy: 42, r: 10, color: 'blanco', relleno: true, opacidad: 0.9 },
      { tipo: 'path', d: 'M32,72 a18,16 0 0 1 36,0 z', color: 'blanco', relleno: true, opacidad: 0.9 },
    ],
  },
  /**
   * `wallet` — Gastos. Billetera cerrada con el broche a la derecha: la silueta se lee a 46px, que es
   * el tamaño real del tile, sin depender del detalle interno.
   *
   * Paletas cálidas (`amber` / `yellowOrange`) a propósito, para que el tile de **lo que sale** no se
   * confunda de un vistazo con los fríos de Presupuestos y Facturación, que son **lo que entra**.
   */
  wallet: {
    shape: rr(20, 30, 60, 44, 10),
    blobs: [
      { cx: 38, cy: 44, r: 22, paleta: 'amber' },
      { cx: 66, cy: 64, r: 20, paleta: 'yellowOrange' },
    ],
    glifo: [
      // La solapa de cierre.
      { tipo: 'linea', x1: 20, y1: 46, x2: 80, y2: 46, color: 'blanco', ancho: 4, opacidad: 0.9 },
      // El broche.
      { tipo: 'circulo', cx: 66, cy: 60, r: 6, color: 'blanco', relleno: true, opacidad: 0.92 },
    ],
  },
  /**
   * `ingreso` — plata que ENTRA: una flecha que baja hacia una bandeja.
   *
   * 🔴 **Se agregó al catálogo en vez de reusar uno libre**, y la alternativa era mala de las dos
   * formas: quedaban `mic` y `media`. `mic` no distingue nada —en esta app se dicta TODO, no sólo los
   * ingresos— y `media` (ojo/preview) no significa plata. Un tile con un glifo que no dice lo que hace
   * manda a la pantalla equivocada, que es el mismo costo que ya se pagó eligiendo mal en Ajustes.
   *
   * 🔴 **Paleta FRÍA a propósito.** `wallet` (Gastos) es ámbar/naranja; si Ingresos usara los mismos
   * tonos, las dos funciones simétricas —la plata que sale y la que entra— se verían iguales de un
   * vistazo, que es justo cuando se mira un grid.
   *
   * La flecha apunta hacia ABAJO, no hacia arriba: una flecha ascendente se lee como crecimiento y
   * eso ya es `chart` (Inteligencia de Negocio) en este mismo grid.
   */
  ingreso: {
    shape: rr(20, 26, 60, 52, 12),
    blobs: [
      { cx: 40, cy: 42, r: 22, paleta: 'cyanTeal' },
      { cx: 64, cy: 62, r: 20, paleta: 'cyanBlue' },
    ],
    glifo: [
      // El asta de la flecha.
      { tipo: 'linea', x1: 50, y1: 36, x2: 50, y2: 59, color: 'blanco', ancho: 4, opacidad: 0.92 },
      // Las dos alas de la punta.
      { tipo: 'linea', x1: 40, y1: 49, x2: 50, y2: 60, color: 'blanco', ancho: 4, opacidad: 0.92 },
      { tipo: 'linea', x1: 60, y1: 49, x2: 50, y2: 60, color: 'blanco', ancho: 4, opacidad: 0.92 },
      // La bandeja donde cae.
      { tipo: 'linea', x1: 30, y1: 68, x2: 70, y2: 68, color: 'blanco', ancho: 4, opacidad: 0.9 },
    ],
  },
};
