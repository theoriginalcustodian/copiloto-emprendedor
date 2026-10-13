/**
 * Geometría de las formas del splash que React Native NO dibuja con estilos: `border-radius`
 * elíptico asimétrico y `linear-gradient(<ángulo>, …)` del prototipo (`index.html:1202-1204`,
 * `2452-2456`). Matemática pura (sin RN), en coords `viewBox="0 0 1 1"` y `objectBoundingBox`.
 * Antes eran radios uniformes + color sólido («aproximación deliberada», `IdentidadEntrada`): la fila
 * `splash` de DEVICE15 lo midió como DESVÍO.
 */

/** Radios de las 4 esquinas en el orden de CSS: arriba-izq, arriba-der, abajo-der, abajo-izq. */
export type RadiosEsquinas = readonly [number, number, number, number];

/**
 * `border-radius: h0 h1 h2 h3 / v0 v1 v2 v3` (fracciones 0..1 del lado) como path de un cuadrado
 * unitario. Mismo orden de esquinas que CSS. No re-escala radios que sumen más de 1: los del
 * prototipo suman exactamente 1 por lado.
 */
export function bordeElipticoPath(h: RadiosEsquinas, v: RadiosEsquinas): string {
  const f = (n: number) => n.toFixed(4);
  return (
    `M ${f(h[0])} 0 ` +
    `H ${f(1 - h[1])} A ${f(h[1])} ${f(v[1])} 0 0 1 1 ${f(v[1])} ` +
    `V ${f(1 - v[2])} A ${f(h[2])} ${f(v[2])} 0 0 1 ${f(1 - h[2])} 1 ` +
    `H ${f(h[3])} A ${f(h[3])} ${f(v[3])} 0 0 1 0 ${f(1 - v[3])} ` +
    `V ${f(v[0])} A ${f(h[0])} ${f(v[0])} 0 0 1 ${f(h[0])} 0 Z`
  );
}

/**
 * Extremos (en `objectBoundingBox`) de la línea de un `linear-gradient(<ángulo>deg, …)` de CSS sobre una
 * caja CUADRADA: 0° = hacia arriba, 90° = hacia la derecha, 180° = hacia abajo; la línea pasa por el
 * centro y su largo es `|sin|+|cos|` (por eso los extremos caen fuera de [0,1]).
 */
export function gradienteCss(anguloDeg: number): { x1: number; y1: number; x2: number; y2: number } {
  const a = (anguloDeg * Math.PI) / 180;
  const dx = Math.sin(a);
  const dy = -Math.cos(a);
  const mitad = (Math.abs(dx) + Math.abs(dy)) / 2;
  return { x1: 0.5 - dx * mitad, y1: 0.5 - dy * mitad, x2: 0.5 + dx * mitad, y2: 0.5 + dy * mitad };
}
