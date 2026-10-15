import { fotogramaOnda, ORIGEN_X, type ArcoOnda } from './ondaEntrada';

// Jest (jest-expo) -- describe/it/expect son globales.
// `react-native-reanimated` está stubbeado bajo Jest y `useAnimatedProps` no computa nada, así que la
// PROPIEDAD animada se afirma acá, sobre la función pura que el worklet ejecuta cada frame.

// Las dos ondas canónicas del isotipo (`Marca.tsx`): 'M16.5 8.8a4.8 4.8 0 0 1 0 6.4' y 'M19.5 6.5a9 9 0 0 1 0 11'.
const ONDA_1: ArcoOnda = { x: 16.5, y: 8.8, r: 4.8, dy: 6.4 };
const ONDA_2: ArcoOnda = { x: 19.5, y: 6.5, r: 9, dy: 11 };

/** Lee `M<x> <y>a<rx> <ry> …` del path animado. */
function leer(d: string) {
  const m = /^M(-?[\d.]+) (-?[\d.]+)a(-?[\d.]+) (-?[\d.]+) 0 0 1 0 (-?[\d.]+)$/.exec(d);
  if (!m) throw new Error(`path animado con forma inesperada: ${d}`);
  const [x, y, rx, ry, dy] = m.slice(1).map(Number);
  return { x, y, rx, ry, dy };
}

describe('fotogramaOnda -- `@keyframes onda` del prototipo (index.html:1171)', () => {
  it('0%: invisible, desplazada 3 y escalada a 0,7 en X, con origen en x=11', () => {
    const f = fotogramaOnda(0, ONDA_1);
    expect(f.opacity).toBe(0);
    const a = leer(f.d);
    // 16,5 → 11 + 0,7·5,5 − 3 ; el radio horizontal se escala, el vertical NO (scaleX, no scale).
    expect(a.x).toBeCloseTo(11 + 0.7 * 5.5 - 3);
    expect(a.rx).toBeCloseTo(0.7 * 4.8);
    expect(a.ry).toBeCloseTo(4.8);
    expect(a.y).toBeCloseTo(8.8);
    expect(a.dy).toBeCloseTo(6.4);
  });

  it('el origen de la escala es x=11: un arco que empezara EN el origen sólo se traslada', () => {
    const a = leer(fotogramaOnda(0, { x: ORIGEN_X, y: 12, r: 3, dy: 4 }).d);
    expect(a.x).toBeCloseTo(ORIGEN_X - 3);
  });

  it('60%: la opacidad ya es 1 pero la geometría todavía no terminó (son dos curvas distintas)', () => {
    const f = fotogramaOnda(0.6, ONDA_2);
    expect(f.opacity).toBeCloseTo(1);
    expect(leer(f.d).rx).toBeLessThan(9);
    expect(leer(f.d).x).not.toBeCloseTo(19.5);
  });

  it('100%: IDÉNTICA al path canónico del isotipo, y opacidad 1 — y es lo que da `reducido` (progreso 1)', () => {
    expect(fotogramaOnda(1, ONDA_1)).toEqual({ opacity: 1, d: 'M16.5 8.8a4.8 4.8 0 0 1 0 6.4' });
    expect(fotogramaOnda(1, ONDA_2)).toEqual({ opacity: 1, d: 'M19.5 6.5a9 9 0 0 1 0 11' });
  });

  it('el progreso fuera de rango se acota (un easing puede pasarse de 1)', () => {
    expect(fotogramaOnda(-0.2, ONDA_1)).toEqual(fotogramaOnda(0, ONDA_1));
    expect(fotogramaOnda(1.3, ONDA_1)).toEqual(fotogramaOnda(1, ONDA_1));
  });

  it('no devuelve `transform` (se anima el path, no una transformación)', () => {
    for (const p of [0, 0.3, 0.6, 1]) expect(Object.keys(fotogramaOnda(p, ONDA_1)).sort()).toEqual(['d', 'opacity']);
  });

  it('control del mutante: una onda que SÓLO funde opacidad no cumple (el path quieto a mitad de camino)', () => {
    expect(fotogramaOnda(0.3, ONDA_1).d).not.toBe('M16.5 8.8a4.8 4.8 0 0 1 0 6.4');
  });
});
