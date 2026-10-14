import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { leerGraficoCategorias, leerGraficoEntroVsSalio, leerGraficoFacturacion, leerGraficoMargenTrabajo } =
  vi.hoisted(() => ({
    leerGraficoCategorias: vi.fn(),
    leerGraficoEntroVsSalio: vi.fn(),
    leerGraficoFacturacion: vi.fn(),
    leerGraficoMargenTrabajo: vi.fn(),
  }));

vi.mock('@copiloto/core', async (orig) => ({
  ...(await orig<typeof import('@copiloto/core')>()),
  leerGraficoCategorias,
  leerGraficoEntroVsSalio,
  leerGraficoFacturacion,
  leerGraficoMargenTrabajo,
}));

import { GraficosInteligencia } from './GraficosInteligencia';

/**
 * `GraficosInteligencia` (web) - **el gemelo de `apps/mobile/.../GraficosInteligencia.test.tsx`**, que
 * existia solo del lado de mobile: la tarjeta de web no tenia NINGUN test (medido el 2026-10-14, SM-E3).
 *
 * Lo que fija este archivo es el DoD de UI de SM-E3: **ninguna pantalla muestra margen sin el conteo de
 * gastos imputados al lado**. No es estetica - un margen calculado sobre cero gastos imputados es el
 * cobrado entero y se ve identico a uno completo (`apps/copiloto/gastos_web.py:188`).
 * `imputacionDeTrabajos` se deja REAL a proposito (no mockeada): lo que se prueba es que la tarjeta la
 * pinte, y el texto en si ya tiene sus 8 casos en `packages/core/src/api/inteligencia.test.ts`.
 */
const UN_TRABAJO = {
  eslabon: 'comprobante' as const,
  ref: 12,
  etiqueta: 'Factura #12',
  cobrado: '30000.00',
  gastado: '10000.00',
  margen: '20000.00',
  gastosImputados: 2,
};

beforeEach(() => {
  leerGraficoFacturacion.mockResolvedValue({ status: 'no_disponible' });
  leerGraficoEntroVsSalio.mockResolvedValue({ status: 'no_disponible' });
  leerGraficoCategorias.mockResolvedValue({ status: 'no_disponible' });
  leerGraficoMargenTrabajo.mockResolvedValue({
    status: 'ok', modo: 'lista', tipo: 'barras', trabajos: [UN_TRABAJO], sinIngreso: [],
  });
});

describe('TarjetaMargenTrabajo (web) - el margen nunca se muestra solo', () => {
  it('con trabajos imputados muestra el conteo al lado del margen', async () => {
    render(<GraficosInteligencia />);
    await waitFor(() => expect(screen.getByTestId('inteligencia-grafico-margen-trabajo')).toBeTruthy());
    expect(screen.getByTestId('inteligencia-grafico-margen-trabajo-imputacion')).toHaveTextContent(
      '2 gastos imputados en el trabajo.',
    );
  });

  it('CERO gastos imputados: la tarjeta avisa que el margen es el cobrado entero', async () => {
    leerGraficoMargenTrabajo.mockResolvedValue({
      status: 'ok', modo: 'lista', tipo: 'barras',
      trabajos: [{ ...UN_TRABAJO, gastosImputados: 0 }], sinIngreso: [],
    });

    render(<GraficosInteligencia />);

    await waitFor(() =>
      expect(screen.getByTestId('inteligencia-grafico-margen-trabajo-imputacion')).toHaveTextContent(
        /cobrado entero/,
      ),
    );
  });

  it('el conteo aparece SIEMPRE que haya una barra - es el invariante, no un caso', async () => {
    leerGraficoMargenTrabajo.mockResolvedValue({
      status: 'ok', modo: 'lista', tipo: 'barras',
      trabajos: [UN_TRABAJO, { ...UN_TRABAJO, ref: 13, etiqueta: 'Factura #13', gastosImputados: 0 }],
      sinIngreso: [],
    });

    render(<GraficosInteligencia />);

    await waitFor(() => expect(screen.getByTestId('grafico-margen-trabajo')).toBeTruthy());
    const conteo = screen.getByTestId('inteligencia-grafico-margen-trabajo-imputacion');
    expect(conteo.textContent).not.toBe('');
    expect(conteo).toHaveTextContent('1 de 2 trabajos sin ninguno');
  });

  it('sin trabajos no hay barra ni conteo: el aviso de vacio es el unico texto', async () => {
    leerGraficoMargenTrabajo.mockResolvedValue({
      status: 'ok', modo: 'lista', tipo: 'barras', trabajos: [], sinIngreso: [],
    });

    render(<GraficosInteligencia />);

    await waitFor(() => expect(screen.getByTestId('inteligencia-grafico-margen-trabajo-vacio')).toBeTruthy());
    expect(screen.queryByTestId('inteligencia-grafico-margen-trabajo-imputacion')).toBeNull();
  });
});
