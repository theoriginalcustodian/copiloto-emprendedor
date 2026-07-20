/**
 * Paleta de la onda de audio — **datos de color puros, sin lógica** (mismo criterio que
 * `iconPalette.ts`, y por eso está autorizado a tener hex en `temaSinHex.test.ts`).
 *
 * 🔴 **Por qué NO sale de los tokens del tema.** La galería de referencia
 * (`App glass/DocuMed 3 — Skin Z-Depth HUD (exploración)/waves-gallery.js`) lo declara en su
 * encabezado: *«cada onda trae su propia paleta fija — sin skins»*. El degradé no decora la onda:
 * **es la onda**. Teñirla con el acento del skin activo la convertiría en cinco ondas distintas y
 * ninguna sería la del diseño. Es el mismo argumento por el que el ícono de carpeta es
 * magenta→naranja en los cinco skins.
 *
 * Valores tomados literalmente de la variante `osc-gbp` («Oscilograma espectro»),
 * `waves-gallery.js:17-18`. No se ajustaron ni se redondearon.
 */

/**
 * Los 5 stops del degradé, en orden. Se reparten **uniformemente** a lo ancho de la onda: el
 * `<linearGradient>` de la referencia (`waves-gallery.js:69-70`) usa `gradientUnits="userSpaceOnUse"`
 * horizontal con offsets `i / (n - 1)` — o sea `0 · 0.25 · 0.5 · 0.75 · 1`.
 *
 * Que el degradé sea **estático** es lo que hace barata a esta onda: el color de cada barra depende
 * sólo de su posición, que no cambia nunca. Se calcula una vez al montar y no vuelve a tocarse,
 * aunque la barra esté animándose a 60 fps.
 */
export const ONDA_OSC_GBP: readonly string[] = [
  '#9bd83a',
  '#3cc9b0',
  '#3aa6d0',
  '#5f6fd0',
  '#b95bc9',
];

/**
 * Color del halo (`drop-shadow`) del grupo frontal. La referencia usa el color **del medio** de la
 * paleta (`waves-gallery.js:75`: `def.colors[Math.floor(def.colors.length / 2)]`), no un color nuevo.
 */
export const ONDA_OSC_GBP_HALO = ONDA_OSC_GBP[Math.floor(ONDA_OSC_GBP.length / 2)];
