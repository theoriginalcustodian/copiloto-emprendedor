/**
 * Colores de los iconos "glass" — junto a `tokens.ts`, el ÚNICO archivo autorizado a tener literales
 * de color (ver `temaSinHex.test.ts`). Son colores INTRÍNSECOS al diseño de cada icono (ej.: el
 * icono de "carpeta" es ámbar→magenta en los 5 skins de la app, no deriva del tema activo) — por eso
 * viven separados de `tokens.ts`, que sí es color-por-tema.
 *
 * Port 1:1 (mismos nombres, mismos valores hex) del objeto `P` + neutros de
 * `App glass/DocuMed 2 — Skin Z-Depth HUD (exploración)/glass-icons-v2.js`, la fuente canónica del
 * prototipo de diseño. CERO verde-jade: prohibido explícitamente en esa fuente para toda la app.
 *
 * `GlassIcon.tsx` e `icons.ts` (geometría) consumen estas constantes por nombre — nunca un hex propio.
 */

/** Un blob de color va de `desde` (centro del gradiente radial) a `hasta` (borde). */
export type ParPaleta = readonly [desde: string, hasta: string];

/** Las 8 paletas de blobs radiales del catálogo de iconos. Nombres y valores EXACTOS del source —
 * no reordenar ni "mejorar" los tonos: es el diseño ya aprobado. */
export const PALETAS_BLOB = {
  magOrange: ['#ff1f7a', '#ff7a00'],
  cyanBlue: ['#00e5ff', '#2f6bff'],
  purplePink: ['#c04bff', '#ff3db0'],
  yellowOrange: ['#ffd000', '#ff4d00'],
  cyanTeal: ['#00eaff', '#0088ff'],
  violet: ['#8a3dff', '#4d3dff'],
  pinkRed: ['#ff2d6f', '#ff1a1a'],
  amber: ['#ffc400', '#ff5e00'],
} as const satisfies Record<string, ParPaleta>;

export type NombrePaletaBlob = keyof typeof PALETAS_BLOB;

// ---------------------------------------------------------------------------------------------
// Neutros de la capa de vidrio (frost / velo / borde de luz) y acentos puntuales del glifo. Mismos
// valores que las constantes hardcodeadas en `build()` del source JS.
// ---------------------------------------------------------------------------------------------

/** Blanco base: frost, velo, borde de luz y la mayoría de los glifos. */
export const BLANCO = '#ffffff';

/** Frost: gradiente lineal top→bottom de blanco translúcido decreciente (`frostId` en el source). */
export const FROST_DESDE_OPACIDAD = 0.14;
export const FROST_HASTA_OPACIDAD = 0.04;

/** Velo lechoso: capa plana de blanco muy tenue encima de los blobs, dentro del clip. */
export const VELO_OPACIDAD = 0.06;

/** Borde de luz: silueta principal vs. trazo "extra" (algo más tenue), mismo ancho para ambos. */
export const BORDE_PRINCIPAL_OPACIDAD = 0.55;
export const BORDE_EXTRA_OPACIDAD = 0.5;
export const BORDE_ANCHO = 1.6;

/** Acentos puntuales de glifo que no son blancos (ej. las manecillas de `clock`, los puntos de
 * `settings`, la lupa de `doc_search`). */
export const ACENTO_CIAN = '#4dd9ff';
export const ACENTO_AMBAR = '#ff9a3d';
