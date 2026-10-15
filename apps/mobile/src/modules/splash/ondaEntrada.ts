/**
 * Fotograma de una onda de la entrada diaria, a partir del progreso `p` (0..1) de su animación.
 * Réplica de `@keyframes onda` del prototipo (`index.html:1171`):
 *
 *   0%   → opacity 0, translateX(-3px) scaleX(.7)
 *   60%  → opacity 1
 *   100% → opacity 1, transform none      (con `transform-origin: 11px 12px`)
 *
 * Matemática pura y `worklet` (corre en el hilo de UI dentro de `useAnimatedProps`). Se extrae del
 * componente porque bajo Jest `react-native-reanimated` está stubbeado y el valor animado no se
 * computa: acá la propiedad animada SÍ se puede afirmar.
 *
 * 🔴 **Se anima `d`, NO `transform`.** Un escalado en X de un arco elíptico sin rotación es EXACTO sobre
 * sus parámetros —`x' = s·(x − 11) + 11 + t`, `rx' = s·rx`, `dx' = s·dx`—, así que se reescribe el path
 * en vez de transformarlo (mismo patrón que `ProgressArc` de la skill de animaciones SVG). Animar
 * `transform` sobre un `Path` pasa por el serializador de props de Reanimated
 * (`SynchronousPropsBufferSerializer.cpp:235`), que aborta el proceso si un item no es objeto.
 */
export const ORIGEN_X = 11;
export const ESCALA_INICIAL = 0.7;
export const DESPLAZAMIENTO_INICIAL = -3;
/** Fracción de la animación a la que la opacidad ya llegó a 1 (`60%{opacity:1}`). */
export const OPACIDAD_PLENA_EN = 0.6;

/** Un arco `M x y a r r 0 0 1 0 dy` del isotipo (viewBox 24): empieza en (x, y) y baja `dy`. */
export interface ArcoOnda {
  x: number;
  y: number;
  r: number;
  dy: number;
}

export function fotogramaOnda(p: number, arco: ArcoOnda): { opacity: number; d: string } {
  'worklet';
  const e = Math.min(1, Math.max(0, p));
  const s = ESCALA_INICIAL + (1 - ESCALA_INICIAL) * e;
  const t = DESPLAZAMIENTO_INICIAL * (1 - e);
  // `toFixed` + `+` quita ceros sobrantes: en p=1 el path sale idéntico al canónico de `Marca.tsx`.
  const n = (v: number) => String(+v.toFixed(3));
  const x = s * (arco.x - ORIGEN_X) + ORIGEN_X + t;
  return {
    opacity: Math.min(1, e / OPACIDAD_PLENA_EN),
    d: `M${n(x)} ${n(arco.y)}a${n(s * arco.r)} ${n(arco.r)} 0 0 1 0 ${n(arco.dy)}`,
  };
}
