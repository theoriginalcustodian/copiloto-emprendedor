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
