/**
 * `SeccionMeDeben` — la plata facturada que todavía no entró.
 *
 * El caso que más importa acá no es el feliz: es que **«no te debe nadie» y «no pudimos consultar» no
 * sean la misma pantalla**. La primera es la frase más tranquilizadora que dice esta app, y dicha
 * sobre la ausencia total del dato nadie la va a cuestionar.
 */
jest.mock('@copiloto/core', () => {
  const actual = jest.requireActual('@copiloto/core');
  return { ...actual, listarImpagos: jest.fn() };
});

import { render, screen, waitFor } from '@testing-library/react-native';

import { listarImpagos } from '@copiloto/core';

import { ThemeProvider } from '../../theme/ThemeProvider';
import { SeccionMeDeben } from './SeccionMeDeben';

const listarMock = listarImpagos as jest.MockedFunction<typeof listarImpagos>;

function fila(over: Record<string, unknown> = {}) {
  return {
    id: 86,
    nro: 901,
    receptorNombre: 'Panadería',
    fechaEmision: '2026-07-22',
    total: '10000.00',
    cobrado: '0.00',
    saldo: '10000.00',
    estadoCobro: 'impaga',
    dias: 0,
    ...over,
  } as never;
}

async function montar() {
  return render(
    <ThemeProvider>
      <SeccionMeDeben />
    </ThemeProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  listarMock.mockResolvedValue({ status: 'ok', comprobantes: [fila()], totalAdeudado: '10000.00' });
});

describe('SeccionMeDeben', () => {
  it('muestra el total que sumó el backend, sin recalcularlo', async () => {
    listarMock.mockResolvedValue({
      status: 'ok',
      comprobantes: [fila(), fila({ id: 87, saldo: '5000.00' })],
      totalAdeudado: '15000.00',
    });

    await montar();

    await waitFor(() => expect(screen.getByTestId('facturacion-me-deben-total')).toBeTruthy());
    // 🔴 Sale el `total_adeudado` servido. Sumar acá daría un segundo número para la misma pregunta, y
    // el día que difieran el emprendedor ve dos verdades y deja de creerle a las dos.
    expect(screen.getByTestId('facturacion-me-deben-total').props.children).toContain('15.000');
  });

  it('🔴 sin dato NO dice «no tenés facturas impagas»', async () => {
    listarMock.mockResolvedValue({ status: 'no_disponible' });

    await montar();

    await waitFor(() => expect(screen.getByTestId('facturacion-me-deben-no-disponible')).toBeTruthy());
    expect(screen.queryByTestId('facturacion-me-deben-vacia')).toBeNull();
    expect(screen.queryByTestId('facturacion-me-deben-total')).toBeNull();
  });

  it('sin impagas dice que no hay, y no muestra un total de cero', async () => {
    listarMock.mockResolvedValue({ status: 'ok', comprobantes: [], totalAdeudado: '0.00' });

    await montar();

    await waitFor(() => expect(screen.getByTestId('facturacion-me-deben-vacia')).toBeTruthy());
    // Un «$0,00» gigante arriba de una lista vacía es ruido: la frase ya lo dice.
    expect(screen.queryByTestId('facturacion-me-deben-total')).toBeNull();
  });

  it('🔴 la fila muestra el SALDO, no el total', async () => {
    // Si le pagaron la mitad, lo que le deben es la otra mitad. Mostrar el total diría que le deben
    // plata que ya cobró.
    listarMock.mockResolvedValue({
      status: 'ok',
      comprobantes: [fila({ total: '10000.00', cobrado: '6000.00', saldo: '4000.00', estadoCobro: 'parcial' })],
      totalAdeudado: '4000.00',
    });

    await montar();

    await waitFor(() => expect(screen.getByTestId('facturacion-me-deben-saldo-86')).toBeTruthy());
    expect(screen.getByTestId('facturacion-me-deben-saldo-86').props.children).toContain('4.000');
  });

  it('`dias` en null no escribe una antigüedad inventada', async () => {
    // «hace 0 días» sobre una factura de marzo es peor que el silencio.
    listarMock.mockResolvedValue({ status: 'ok', comprobantes: [fila({ dias: null })], totalAdeudado: '10000.00' });

    await montar();

    await waitFor(() => expect(screen.getByTestId('facturacion-me-deben-fila-86')).toBeTruthy());
    expect(screen.queryByText(/hace 0 días|de hoy/)).toBeNull();
  });
});
