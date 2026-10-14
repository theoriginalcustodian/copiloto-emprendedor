import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { ResumenGastos } from '@copiloto/core';

import { ResumenMes } from './ResumenMes';

/**
 * GASTOSCATEG — el desglose por categoría con barras YA existía (#237) y estaba montado en
 * `GastosScreen`, pero **ningún test lo fijaba**: el único caso de pantalla era `porCategoria: []`.
 * Este archivo es esa cobertura. El orden (mayor → menor) lo garantiza el backend (`ResumenGastos`
 * en core: «Ordenado por total desc, sin las categorías en cero»): acá se fija que el render lo
 * RESPETA y que el ancho se normaliza sobre la suma real, no sobre 100.
 */

const resumen = (parcial: Partial<ResumenGastos>): ResumenGastos => ({
  periodo: '2026-10',
  total: '0.00',
  porCategoria: [],
  mesAnterior: null,
  ...parcial,
});

const filas = (): string[] =>
  screen.queryAllByTestId(/^gastos-resumen-cat-/).map((el) => el.getAttribute('data-testid') as string);

const anchoDe = (cat: string): string =>
  (screen.getByTestId(`gastos-resumen-barra-${cat}`) as HTMLElement).style.width;

describe('ResumenMes — desglose por categoría', () => {
  // Control positivo del caso VACÍO, primero: diseñar sólo contra el caso lleno ciega al normal.
  it('con 0 gastos no rompe: total en cero, sin filas ni barras', () => {
    render(<ResumenMes resumen={resumen({ total: '0.00', porCategoria: [] })} />);

    expect(screen.getByTestId('gastos-resumen-total').textContent).toBe('$0,00');
    expect(filas()).toEqual([]);
    expect(screen.queryAllByTestId(/^gastos-resumen-barra-/)).toEqual([]);
    expect(screen.queryByTestId('gastos-resumen-mes-anterior')).toBeNull();
  });

  it('una barra por categoría, con su monto, en el orden que manda el resumen (mayor a menor)', () => {
    render(
      <ResumenMes
        resumen={resumen({
          total: '100000.00',
          porCategoria: [
            { categoria: 'mercaderia', total: '50000.00', porcentaje: 50 },
            { categoria: 'servicios', total: '30000.00', porcentaje: 30 },
            { categoria: 'otros', total: '20000.00', porcentaje: 20 },
          ],
        })}
      />,
    );

    expect(filas()).toEqual([
      'gastos-resumen-cat-mercaderia',
      'gastos-resumen-cat-servicios',
      'gastos-resumen-cat-otros',
    ]);
    expect(screen.getByTestId('gastos-resumen-cat-mercaderia').textContent).toContain('$50.000,00');
    expect(screen.getByTestId('gastos-resumen-cat-servicios').textContent).toContain('$30.000,00');
    expect(screen.getByTestId('gastos-resumen-cat-otros').textContent).toContain('$20.000,00');
    expect([anchoDe('mercaderia'), anchoDe('servicios'), anchoDe('otros')]).toEqual(['50%', '30%', '20%']);
  });

  it('normaliza el ancho sobre la suma REAL de porcentajes (tres iguales dan 33,3 y no suman 100)', () => {
    render(
      <ResumenMes
        resumen={resumen({
          total: '30000.00',
          porCategoria: [
            { categoria: 'mercaderia', total: '10000.00', porcentaje: 33.3 },
            { categoria: 'servicios', total: '10000.00', porcentaje: 33.3 },
            { categoria: 'otros', total: '10000.00', porcentaje: 33.3 },
          ],
        })}
      />,
    );

    // 33.3 / 99.9 = 1/3: las tres barras IGUALES entre sí y sumando 100 %, no 99,9 %.
    const anchos = ['mercaderia', 'servicios', 'otros'].map((c) => parseFloat(anchoDe(c)));
    expect(anchos[0]).toBeCloseTo(100 / 3, 5);
    expect(anchos[1]).toBeCloseTo(anchos[0] as number, 10);
    expect(anchos[2]).toBeCloseTo(anchos[0] as number, 10);
    expect(anchos.reduce((a, b) => a + b, 0)).toBeCloseTo(100, 5);
  });

  // Control NEGATIVO del propio test: si el render ignorara el dato (p. ej. dibujara siempre la
  // primera categoría), estos dos casos darían la MISMA cantidad de filas y este test se pone rojo.
  it('el render responde al dato: una categoría → 1 fila; tres → 3 filas', () => {
    const una = resumen({
      total: '51234.00',
      porCategoria: [{ categoria: 'otros', total: '51234.00', porcentaje: 100 }],
    });
    const tres = resumen({
      total: '100000.00',
      porCategoria: [
        { categoria: 'mercaderia', total: '50000.00', porcentaje: 50 },
        { categoria: 'servicios', total: '30000.00', porcentaje: 30 },
        { categoria: 'otros', total: '20000.00', porcentaje: 20 },
      ],
    });

    const { rerender } = render(<ResumenMes resumen={una} />);
    expect(filas()).toHaveLength(1);
    expect(anchoDe('otros')).toBe('100%');

    rerender(<ResumenMes resumen={tres} />);
    expect(filas()).toHaveLength(3);
  });

  it('muestra «Mes anterior» sólo cuando el backend lo trae', () => {
    const { rerender } = render(<ResumenMes resumen={resumen({ total: '10.00', mesAnterior: '150111.00' })} />);
    expect(screen.getByTestId('gastos-resumen-mes-anterior').textContent).toContain('$150.111,00');

    rerender(<ResumenMes resumen={resumen({ total: '10.00', mesAnterior: null })} />);
    expect(screen.queryByTestId('gastos-resumen-mes-anterior')).toBeNull();
  });
});
