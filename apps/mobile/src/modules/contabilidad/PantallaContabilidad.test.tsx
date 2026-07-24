import { render, screen, waitFor } from '@testing-library/react-native';

/** Partial mock: sólo la red, mismo criterio que `PantallaGastos.test.tsx`. */
jest.mock('@copiloto/core', () => {
  const actual = jest.requireActual('@copiloto/core');
  return { ...actual, obtenerResumenContabilidad: jest.fn() };
});

import { obtenerResumenContabilidad, type ResumenContabilidad } from '@copiloto/core';

import { ThemeProvider } from '../../theme/ThemeProvider';
import { PantallaContabilidad } from './PantallaContabilidad';

const mockResumen = obtenerResumenContabilidad as jest.MockedFunction<typeof obtenerResumenContabilidad>;

function resumen(over: Partial<ResumenContabilidad> = {}): ResumenContabilidad {
  return {
    periodo: '2026-07',
    caja: { entro: '150000.00', salio: '45000.00', queda: '105000.00', mesAnterior: null },
    gastos: { porCategoria: [{ categoria: 'mercaderia', total: '30000.00', porcentaje: 66.6 }] },
    facturado: { periodo: '80000.00', doceMeses: '400000.00', tope: null },
    clientes: [{ clienteRef: 12, nombre: 'Juan Pérez', total: '80000.00' }],
    ...over,
  };
}

/** 🔴 `render` es ASÍNCRONO en RNTL 14 + React 19 — sin `await` el árbol no existe todavía. */
async function montar() {
  return render(
    <ThemeProvider>
      <PantallaContabilidad />
    </ThemeProvider>,
  );
}

describe('PantallaContabilidad', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockResumen.mockResolvedValue({ status: 'ok', resumen: resumen() });
  });

  it('carga y muestra las 4 secciones', async () => {
    await montar();

    await waitFor(() => expect(screen.getByTestId('contabilidad-contenido')).toBeTruthy());
    expect(screen.getByTestId('contabilidad-caja')).toBeTruthy();
    expect(screen.getByTestId('contabilidad-gastos')).toBeTruthy();
    expect(screen.getByTestId('contabilidad-facturado')).toBeTruthy();
    expect(screen.getByTestId('contabilidad-clientes')).toBeTruthy();
  });

  it('🔴 nunca mezcla caja y facturado — son dos números en dos tiles separados', async () => {
    await montar();

    await waitFor(() => expect(screen.getByTestId('contabilidad-caja-queda')).toBeTruthy());
    expect(screen.getByTestId('contabilidad-caja-queda')).toHaveTextContent('$105.000,00');
    expect(screen.getByTestId('contabilidad-facturado-periodo')).toHaveTextContent('$80.000,00');
  });

  it('`queda` negativo se muestra tal cual — un mes en rojo es información', async () => {
    mockResumen.mockResolvedValue({
      status: 'ok',
      resumen: resumen({ caja: { entro: '10000.00', salio: '50000.00', queda: '-40000.00', mesAnterior: null } }),
    });
    await montar();

    await waitFor(() => expect(screen.getByTestId('contabilidad-caja-queda')).toHaveTextContent('-$40.000,00'));
  });

  it('🔴 sin escala vigente, `tope: null` — se muestra sólo el acumulado, sin porcentaje', async () => {
    await montar();

    await waitFor(() => expect(screen.getByTestId('contabilidad-facturado')).toBeTruthy());
    expect(screen.queryByTestId('contabilidad-facturado-tope')).toBeNull();
  });

  it('con escala vigente, muestra el porcentaje del tope', async () => {
    mockResumen.mockResolvedValue({
      status: 'ok',
      resumen: resumen({ facturado: { periodo: '1', doceMeses: '2', tope: { valor: '30000000', porcentaje: 40, semaforo: 'verde' } } }),
    });
    await montar();

    await waitFor(() => expect(screen.getByTestId('contabilidad-facturado-tope')).toHaveTextContent('40% del tope monotributo'));
  });

  it('`gastos: []` — la sección no se pinta (degradación declarada, no un error)', async () => {
    mockResumen.mockResolvedValue({ status: 'ok', resumen: resumen({ gastos: { porCategoria: [] } }) });
    await montar();

    await waitFor(() => expect(screen.getByTestId('contabilidad-caja')).toBeTruthy());
    expect(screen.queryByTestId('contabilidad-gastos')).toBeNull();
  });

  it('`clientes: []` (Clientes sin desplegar) — la sección no se pinta, el resto sigue', async () => {
    mockResumen.mockResolvedValue({ status: 'ok', resumen: resumen({ clientes: [] }) });
    await montar();

    await waitFor(() => expect(screen.getByTestId('contabilidad-caja')).toBeTruthy());
    expect(screen.queryByTestId('contabilidad-clientes')).toBeNull();
  });

  it('mientras carga, muestra el spinner', async () => {
    mockResumen.mockReturnValue(new Promise(() => {})); // nunca resuelve
    await montar();

    expect(screen.getByTestId('contabilidad-cargando')).toBeTruthy();
  });

  it('🔴 el endpoint no desplegado se dice explícito, no como error genérico', async () => {
    mockResumen.mockResolvedValue({ status: 'no_disponible' });
    await montar();

    await waitFor(() => expect(screen.getByTestId('contabilidad-no-disponible')).toBeTruthy());
  });

  it('un fallo real de red muestra el error de reintentar', async () => {
    mockResumen.mockRejectedValue(new Error('network down'));
    await montar();

    await waitFor(() => expect(screen.getByTestId('contabilidad-error')).toBeTruthy());
  });
});
