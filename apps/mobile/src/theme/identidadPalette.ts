/**
 * BL-X10 — colores de las 4 formas de la animación de entrada (`modules/splash/IdentidadEntrada.tsx`).
 * FIJOS, no salen del tema: son el LOGOTIPO en construcción, mismo criterio que `--identidad-word`
 * en web (`Splash.css`, exención WCAG 1.4.3 — decisión Martín 22/07, `splash-port-reanimated.md §8`)
 * y que `ondaPalette.ts`/`ecualizadorPalette.ts` acá: color intrínseco del diseño, no de la piel.
 * SÓLO-DATOS-DE-COLOR, sin lógica — quien lo consume queda cero-hex.
 */
export const COLOR_FORMA_SCALLOP = '#1A1512';
export const COLOR_FORMA_SQUIRCLE = '#DE7250';
/** Inicio del degradé del squircle (`linear-gradient(160deg,#E8A088,#DE7250)`, prototipo `index.html:2453`). */
export const COLOR_FORMA_SQUIRCLE_CLARO = '#E8A088';
/**
 * El wordmark «dobi» del reveal — la `--terracota` del prototipo (`.rv-word`, `index.html:469`), gemelo
 * de `--identidad-word` en web (misma exención 1.4.3 que las formas: es el logotipo, no texto de UI).
 */
export const COLOR_PALABRA_MARCA = '#DE7250';
export const COLOR_FORMA_SUPER = '#FFFFFF';
export const COLOR_FORMA_EGG = '#B04A2E';
