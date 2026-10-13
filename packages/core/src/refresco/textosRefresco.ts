/**
 * Textos de estado del refresco de Inteligencia (BL-W6), compartidos por web y mobile.
 *
 * 🔴 **El estado no puede depender sólo del ícono ni del color** (WCAG 1.4.1): cada fase tiene su
 * texto. `tirar` y `soltar` son del gesto de arrastre (mobile); web refresca con un botón y sólo usa
 * `actualizando` y `aldia`.
 */
export type FaseRefresco = 'tirar' | 'soltar' | 'actualizando' | 'aldia';

export const TEXTO_REFRESCO: Record<FaseRefresco, string> = {
  tirar: 'Tirá para actualizar',
  soltar: 'Soltá para actualizar',
  actualizando: 'Actualizando…',
  aldia: 'Al día · recién',
};

/**
 * Cuánto se muestra «Al día · recién» antes de volver al reposo: 700 ms, como el prototipo
 * (`index.html:3561`, `setTimeout(…, 700)`). Era 3000: la fila `bi-refresh` de DEVICE15 lo midió como DESVÍO.
 */
export const MS_AL_DIA = 700;

/** Arrastre (px hacia abajo, iOS) desde el que el gesto ya alcanza y «Soltá» reemplaza a «Tirá». */
export const UMBRAL_SOLTAR_PX = 64;

/** Fase a mostrar: `actualizando` y `aldia` mandan sobre el arrastre. */
export function faseRefresco(args: {
  actualizando: boolean;
  alDia: boolean;
  arrastrePx: number;
}): FaseRefresco {
  if (args.actualizando) return 'actualizando';
  if (args.alDia) return 'aldia';
  return args.arrastrePx >= UMBRAL_SOLTAR_PX ? 'soltar' : 'tirar';
}
