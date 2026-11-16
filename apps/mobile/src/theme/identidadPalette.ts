/**
 * BL-X10 — colores de las 4 formas de la animación de entrada (`modules/splash/IdentidadEntrada.tsx`).
 * FIJOS, no salen del tema: son el LOGOTIPO en construcción, mismo criterio que `--identidad-word`
 * en web (`Splash.css`, exención WCAG 1.4.3 — decisión Martín 22/07, `splash-port-reanimated.md §8`)
 * y que `ondaPalette.ts` acá: color intrínseco del diseño, no de la piel.
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
/** Fondo del splash (`#splash{background:linear-gradient(180deg,#FFFFFF 0%,#F7F3EC 100%)}`, `index.html:1188`). Fijo: es la pieza de marca, no la piel. */
export const COLOR_SPLASH_FONDO_ARRIBA = '#FFFFFF';
export const COLOR_SPLASH_FONDO_ABAJO = '#F7F3EC';
/** Descriptor del splash (`.tagline{color:var(--sec)}`, `index.html:17` + `1231`). */
export const COLOR_SPLASH_TAGLINE = '#5C534C';

/**
 * Portada de entrada (`PantallaMetodo`, «Creá tu cuenta o iniciá sesión» — Martin 12/11, a lo Tinder/Bumble):
 * la pantalla entera en terracota, como el splash. FIJA, no sale de la piel: es la pieza de marca que recibe,
 * no una pantalla de uso, y por eso no aplica el tope de acento ≤10%. Contrastes medidos:
 * - `tinta` sobre `fondo`: 5,9:1 (texto chico OK) · `marca` sobre `fondo`: 3,16:1 (logotipo, exento; además
 *   texto grande ≥3:1) · `sobreTinta` sobre `tinta` y `tinta` sobre `papel`: >14:1.
 */
export const PORTADA = {
  fondo: '#DE7250',
  marca: '#FFFFFF',
  tinta: '#1A1512',
  papel: '#F7F3EC',
  sobreTinta: '#F7F3EC',
} as const;
