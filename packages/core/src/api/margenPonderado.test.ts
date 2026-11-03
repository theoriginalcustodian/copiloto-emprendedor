import { describe, expect, it } from 'vitest';

import { margenPonderado, type TrabajoConMargen } from './inteligencia';

function t(etiqueta: string, cobrado: string | null, margen: string | null): TrabajoConMargen {
  return { eslabon: 'cobro', ref: 1, etiqueta, cobrado, gastado: null, margen, gastosImputados: 0 };
}

describe('margenPonderado (SM-N32)', () => {
  it('pondera por cobrado: Σmargen/Σcobrado, NO el promedio simple de porcentajes', () => {
    // 1.000 con 50% y 500.000 con 10%: simple = 30%, ponderado ≈ 10,07%.
    const r = margenPonderado([t('chico', '1000', '500'), t('grande', '500000', '50000')]);
    expect(r.n).toBe(2);
    expect(r.pct).toBeCloseTo((50500 / 501000) * 100, 6);
    expect(r.pct).not.toBeCloseTo(30, 0);
  });

  it('el peor es el de menor margen % y lleva nombre', () => {
    const r = margenPonderado([t('a', '100', '40'), t('b', '100', '-10'), t('c', '100', '20')]);
    expect(r.peor).toEqual({ etiqueta: 'b', pct: -10 });
  });

  it('sin trabajos legibles → null (ausente ≠ cero), y cobrado 0 / dato nulo no entran', () => {
    expect(margenPonderado([])).toEqual({ n: 0, pct: null, peor: null });
    const r = margenPonderado([t('sin cobro', '0', '0'), t('sin dato', null, null)]);
    expect(r).toEqual({ n: 0, pct: null, peor: null });
  });
});
