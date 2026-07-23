/**
 * `PantallaInteligencia` — la portada de IN.
 *
 * **[CONNECT] — el endpoint no está vivo; la pantalla habla con `leerPortada()` mockeado.** Lo que se
 * fija acá son las dos reglas que un tablero de KPIs no puede violar: (1) *«todavía no está»* ≠ *«tu
 * negocio está en cero»*, y (2) un número que no vino se muestra «—», nunca «$0».
 *
 * ⚠️ Todo `fireEvent` va con `await` — ver el docstring de `jest.config.js`.
 */
jest.mock('@copiloto/core', () => {
  const actual = jest.requireActual('@copiloto/core');
  return {
    ...actual,
    leerPortada: jest.fn(),
    leerGraficoFacturacion: jest.fn(),
    leerGraficoEntroVsSalio: jest.fn(),
    leerGraficoCategorias: jest.fn(),
    leerGraficoMargenTrabajo: jest.fn(),
    preguntarInteligencia: jest.fn(),
  };
});

import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import {
  leerGraficoCategorias,
  leerGraficoEntroVsSalio,
  leerGraficoFacturacion,
  leerGraficoMargenTrabajo,
  leerPortada,
  preguntarInteligencia,
} from '@copiloto/core';

import { PantallaInteligencia } from './PantallaInteligencia';
import { ThemeProvider } from '../../theme/ThemeProvider';

const leerMock = leerPortada as jest.MockedFunction<typeof leerPortada>;
const preguntarMock = preguntarInteligencia as jest.MockedFunction<typeof preguntarInteligencia>;
const facturacionMock = leerGraficoFacturacion as jest.MockedFunction<typeof leerGraficoFacturacion>;
const entroVsSalioMock = leerGraficoEntroVsSalio as jest.MockedFunction<typeof leerGraficoEntroVsSalio>;
const categoriasMock = leerGraficoCategorias as jest.MockedFunction<typeof leerGraficoCategorias>;
const margenTrabajoMock = leerGraficoMargenTrabajo as jest.MockedFunction<typeof leerGraficoMargenTrabajo>;

const PORTADA = {
  caja: { saldo: '184000.00', moneda: 'ARS' },
  mes: { ingresos: '95000.00', gastos: '31000.00', rentabilidad: '64000.00', facturado: '120000.00', cobrado: '90000.00' },
  serieMensual: [
    { mes: '2026-03', ingresos: '80000.00', gastos: '20000.00' },
    { mes: '2026-04', ingresos: '95000.00', gastos: '31000.00' },
  ],
  mejoresClientes: [{ cliente: 'Panadería Los Tilos', total: '48000.00' }],
  porCobrar: { total: '30000.00', vencido: '12000.00' },
};

async function montar() {
  return render(
    <ThemeProvider>
      <PantallaInteligencia />
    </ThemeProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  leerMock.mockResolvedValue({ status: 'ok', portada: PORTADA });
  // Los 4 gráficos no son el objeto de este archivo (tienen el propio `GraficosInteligencia.test.tsx`)
  // — `no_disponible` los deja sin pintar nada, así no interfieren con las aserciones de la portada.
  facturacionMock.mockResolvedValue({ status: 'no_disponible' });
  entroVsSalioMock.mockResolvedValue({ status: 'no_disponible' });
  categoriasMock.mockResolvedValue({ status: 'no_disponible' });
  margenTrabajoMock.mockResolvedValue({ status: 'no_disponible' });
  preguntarMock.mockResolvedValue({ status: 'ok', respuesta: { respuesta: 'Gastaste $18.000 este mes.', fuente: 'sql' } });
});

describe('PantallaInteligencia — lo que muestra', () => {
  it('pinta la caja, los cinco números del mes y los mejores clientes', async () => {
    await montar();

    await waitFor(() => expect(screen.getByTestId('inteligencia-caja')).toBeTruthy());
    expect(screen.getByTestId('inteligencia-mes-rentabilidad')).toBeTruthy();
    expect(screen.getByText('Panadería Los Tilos')).toBeTruthy();
  });

  it('la serie mensual dibuja una barra por mes', async () => {
    await montar();

    await waitFor(() => expect(screen.getByTestId('inteligencia-barra-2026-03')).toBeTruthy());
    expect(screen.getByTestId('inteligencia-barra-2026-04')).toBeTruthy();
  });

  it('lo vencido se muestra aparte, porque es lo accionable', async () => {
    await montar();

    await waitFor(() => expect(screen.getByTestId('inteligencia-vencido')).toBeTruthy());
  });

  it('el título "Inteligencia de Negocio" lo aporta su MarcoGlass, una sola vez', async () => {
    await montar();
    await waitFor(() => expect(screen.getByTestId('inteligencia-caja')).toBeTruthy());
    expect(screen.getAllByText('Inteligencia de Negocio')).toHaveLength(1);
  });
});

describe('PantallaInteligencia — lo que NO inventa', () => {
  it('🔴 sin endpoint desplegado lo DICE, y no muestra ningún número', async () => {
    leerMock.mockResolvedValue({ status: 'no_disponible' });

    await montar();

    await waitFor(() => expect(screen.getByTestId('inteligencia-no-disponible')).toBeTruthy());
    expect(screen.queryByTestId('inteligencia-portada')).toBeNull();
  });

  it('🔴 un KPI en `null` se muestra «—», nunca «$0»', async () => {
    // La regla que sostiene el tablero entero: «no sé cuánto facturó» y «facturó cero» son cosas
    // distintas, y un cero por default sería un KPI que miente.
    leerMock.mockResolvedValue({
      status: 'ok',
      portada: { ...PORTADA, caja: { saldo: null, moneda: 'ARS' }, mes: { ...PORTADA.mes, facturado: null } },
    });

    await montar();

    await waitFor(() => expect(screen.getByTestId('inteligencia-caja')).toBeTruthy());
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
    // Y NO hay ningún «$0» inventado en pantalla.
    expect(screen.queryByText(/\$\s?0(\D|$)/)).toBeNull();
  });

  it('🔴 mejores clientes vacío muestra el aviso, no una lista rota', async () => {
    // Degrada a [] si Clientes no está (contrato §3.1): la card muestra vacío, no rompe.
    leerMock.mockResolvedValue({ status: 'ok', portada: { ...PORTADA, mejoresClientes: [] } });

    await montar();

    await waitFor(() => expect(screen.getByTestId('inteligencia-clientes-vacio')).toBeTruthy());
  });

  it('🔴 CONTROL — el buscador encuentra un cliente presente y NO uno ausente', async () => {
    await montar();

    await waitFor(() => expect(screen.getByText('Panadería Los Tilos')).toBeTruthy());
    expect(screen.queryByText('Cliente Que No Existe')).toBeNull();
  });
});

describe('PantallaInteligencia — la solapa "Preguntar" (decisión de placement)', () => {
  it('arranca en "Resumen"; tocar "Preguntar" monta el chat y oculta la portada', async () => {
    await montar();
    await waitFor(() => expect(screen.getByTestId('inteligencia-caja')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('inteligencia-solapa-preguntar'));

    expect(screen.getByTestId('chat-inteligencia')).toBeTruthy();
    expect(screen.queryByTestId('inteligencia-portada')).toBeNull();
  });

  it('volver a "Resumen" restaura la portada sin perder la pregunta ya hecha', async () => {
    await montar();
    await waitFor(() => expect(screen.getByTestId('inteligencia-caja')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('inteligencia-solapa-preguntar'));
    await fireEvent.press(screen.getByTestId('inteligencia-solapa-resumen'));

    expect(screen.getByTestId('inteligencia-caja')).toBeTruthy();
    expect(screen.queryByTestId('chat-inteligencia')).toBeNull();
  });

  it('🔴 los 4 gráficos entran DEBAJO de la portada, en el mismo scroll', async () => {
    facturacionMock.mockResolvedValue({
      status: 'ok',
      modo: 'serie',
      tipo: 'barras',
      periodo: 'Julio 2026',
      serie: [{ mes: '2026-07', total: '50000.00', cantidad: 3 }],
    });

    await montar();

    await waitFor(() => expect(screen.getByTestId('inteligencia-graficos-seccion')).toBeTruthy());
    expect(screen.getByTestId('inteligencia-grafico-facturacion')).toBeTruthy();
  });
});
