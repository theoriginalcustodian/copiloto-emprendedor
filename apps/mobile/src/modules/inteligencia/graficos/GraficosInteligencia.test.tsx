/**
 * `GraficosInteligencia` — los 4 gráficos montados juntos, cada uno con su propia carga. **[CONNECT]**
 * — los 4 endpoints hablan con `leerGrafico*` mockeados; lo que se fija acá es que cada tarjeta
 * degrada sola a `no_disponible`/vacío sin tumbar a las otras 3.
 *
 * ⚠️ Todo `fireEvent`/`render` va con `await` — ver el docstring de `jest.config.js`.
 */
jest.mock('@copiloto/core', () => {
  const actual = jest.requireActual('@copiloto/core');
  return {
    ...actual,
    leerGraficoFacturacion: jest.fn(),
    leerGraficoEntroVsSalio: jest.fn(),
    leerGraficoCategorias: jest.fn(),
    leerGraficoMargenTrabajo: jest.fn(),
  };
});

import { render, screen, waitFor } from '@testing-library/react-native';

import {
  leerGraficoCategorias,
  leerGraficoEntroVsSalio,
  leerGraficoFacturacion,
  leerGraficoMargenTrabajo,
} from '@copiloto/core';

import { GraficosInteligencia } from './GraficosInteligencia';
import { ThemeProvider } from '../../../theme/ThemeProvider';

const facturacionMock = leerGraficoFacturacion as jest.MockedFunction<typeof leerGraficoFacturacion>;
const entroVsSalioMock = leerGraficoEntroVsSalio as jest.MockedFunction<typeof leerGraficoEntroVsSalio>;
const categoriasMock = leerGraficoCategorias as jest.MockedFunction<typeof leerGraficoCategorias>;
const margenTrabajoMock = leerGraficoMargenTrabajo as jest.MockedFunction<typeof leerGraficoMargenTrabajo>;

async function montar() {
  return render(
    <ThemeProvider>
      <GraficosInteligencia />
    </ThemeProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  facturacionMock.mockResolvedValue({
    status: 'ok',
    modo: 'serie',
    tipo: 'barras',
    periodo: 'Julio 2026',
    serie: [{ mes: '2026-07', total: '120000.00', cantidad: 8 }],
  });
  entroVsSalioMock.mockResolvedValue({
    status: 'ok',
    modo: 'serie',
    tipo: 'barras_enfrentadas',
    periodo: 'Julio 2026',
    serie: [{ mes: '2026-07', entro: '95000.00', salio: '31000.00' }],
  });
  categoriasMock.mockResolvedValue({
    status: 'ok',
    modo: 'serie',
    tipo: 'torta',
    periodo: 'Julio 2026',
    serie: [
      { categoria: 'servicios', total: '18000.00' },
      { categoria: 'transporte', total: '5000.00' },
    ],
  });
  margenTrabajoMock.mockResolvedValue({
    status: 'ok',
    modo: 'lista',
    tipo: 'barras',
    trabajos: [
      { eslabon: 'comprobante', ref: 1, etiqueta: 'Factura #12', cobrado: '30000.00', gastado: '10000.00', margen: '20000.00', gastosImputados: 2 },
    ],
    sinIngreso: [{ eslabon: 'presupuesto', ref: 5, etiqueta: 'Presupuesto #5', gastado: '2000.00', gastosImputados: 1 }],
  });
});

describe('GraficosInteligencia — los 4 aparecen y cargan', () => {
  it('muestra facturación, entró-vs-salió, categorías y margen por trabajo', async () => {
    await montar();

    await waitFor(() => expect(screen.getByTestId('inteligencia-grafico-facturacion')).toBeTruthy());
    expect(screen.getByTestId('inteligencia-grafico-entro-vs-salio')).toBeTruthy();
    expect(screen.getByTestId('inteligencia-grafico-categorias')).toBeTruthy();
    expect(screen.getByTestId('inteligencia-grafico-margen-trabajo')).toBeTruthy();
  });

  it('la torta de categorías muestra la ETIQUETA humana, no la clave interna', async () => {
    await montar();
    await waitFor(() => expect(screen.getByText('Servicios')).toBeTruthy());
    expect(screen.queryByText('servicios')).toBeNull();
  });

  it('el margen por trabajo avisa cuántos trabajos quedan sin ingreso, sin promediarlos', async () => {
    await montar();
    await waitFor(() =>
      expect(screen.getByTestId('inteligencia-grafico-margen-trabajo-sin-ingreso')).toBeTruthy(),
    );
    expect(screen.getByText(/1 trabajo sin cobro registrado/)).toBeTruthy();
  });
});

describe('GraficosInteligencia — lo que NO inventa', () => {
  it('🔴 un gráfico `no_disponible` no se pinta — no rompe a los otros 3', async () => {
    facturacionMock.mockResolvedValue({ status: 'no_disponible' });

    await montar();

    await waitFor(() => expect(screen.getByTestId('inteligencia-grafico-entro-vs-salio')).toBeTruthy());
    expect(screen.queryByTestId('inteligencia-grafico-facturacion')).toBeNull();
    expect(screen.getByTestId('inteligencia-grafico-categorias')).toBeTruthy();
    expect(screen.getByTestId('inteligencia-grafico-margen-trabajo')).toBeTruthy();
  });

  it('🔴 margen por trabajo vacío (sin trabajos ni sin-ingreso) muestra el aviso, no barras rotas', async () => {
    margenTrabajoMock.mockResolvedValue({ status: 'ok', modo: 'lista', tipo: 'barras', trabajos: [], sinIngreso: [] });

    await montar();

    await waitFor(() => expect(screen.getByTestId('inteligencia-grafico-margen-trabajo-vacio')).toBeTruthy());
  });
});

/**
 * SM-E3, DoD de UI: **ninguna pantalla muestra margen sin el conteo de gastos imputados al lado.** Un
 * margen sobre cero gastos imputados es el cobrado entero y se ve identico a uno completo
 * (`apps/copiloto/gastos_web.py:188`). El texto lo decide `imputacionDeTrabajos` en core (8 casos en
 * `packages/core/src/api/inteligencia.test.ts`); aca se fija que la tarjeta lo PINTE.
 */
describe('TarjetaMargenTrabajo - el margen nunca se muestra solo', () => {
  it('con trabajos imputados muestra el conteo al lado del margen', async () => {
    await montar();
    await waitFor(() =>
      expect(screen.getByTestId('inteligencia-grafico-margen-trabajo-imputacion')).toBeTruthy(),
    );
    expect(screen.getByText('2 gastos imputados en el trabajo.')).toBeTruthy();
  });

  it('CERO gastos imputados: avisa que el margen es el cobrado entero', async () => {
    margenTrabajoMock.mockResolvedValue({
      status: 'ok',
      modo: 'lista',
      tipo: 'barras',
      trabajos: [
        { eslabon: 'comprobante', ref: 1, etiqueta: 'Factura #12', cobrado: '30000.00', gastado: null, margen: '30000.00', gastosImputados: 0 },
      ],
      sinIngreso: [],
    });

    await montar();

    await waitFor(() =>
      expect(screen.getByTestId('inteligencia-grafico-margen-trabajo-imputacion')).toBeTruthy(),
    );
    expect(screen.getByText(/cobrado entero/)).toBeTruthy();
  });

  it('sin trabajos no hay conteo: no se califica un margen que no esta en pantalla', async () => {
    margenTrabajoMock.mockResolvedValue({ status: 'ok', modo: 'lista', tipo: 'barras', trabajos: [], sinIngreso: [] });

    await montar();

    await waitFor(() => expect(screen.getByTestId('inteligencia-grafico-margen-trabajo-vacio')).toBeTruthy());
    expect(screen.queryByTestId('inteligencia-grafico-margen-trabajo-imputacion')).toBeNull();
  });
});
