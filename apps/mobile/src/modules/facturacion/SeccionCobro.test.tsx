/**
 * `SeccionCobro` — *¿esta factura la cobré?*
 *
 * Lo que se fija acá es lo que se rompe **sin que nadie note nada**: que la ausencia de dato no se
 * pinte como «impaga», que la clave de idempotencia sobreviva a un fallo, y que una nota de crédito no
 * ofrezca cobrarse.
 */
jest.mock('@copiloto/core', () => {
  const actual = jest.requireActual('@copiloto/core');
  return {
    ...actual,
    listarCobros: jest.fn(),
    registrarCobro: jest.fn(),
    borrarCobro: jest.fn(),
  };
});

import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { borrarCobro, listarCobros, registrarCobro } from '@copiloto/core';

import { ThemeProvider } from '../../theme/ThemeProvider';
import { SeccionCobro } from './SeccionCobro';

const listarMock = listarCobros as jest.MockedFunction<typeof listarCobros>;
const registrarMock = registrarCobro as jest.MockedFunction<typeof registrarCobro>;
const borrarMock = borrarCobro as jest.MockedFunction<typeof borrarCobro>;

function estado(over: Record<string, unknown> = {}) {
  return { id: 9, total: '10000.00', cobrado: '0.00', saldo: '10000.00', estadoCobro: 'impaga', ...over } as never;
}

async function montar(cobrable = true) {
  return render(
    <ThemeProvider>
      <SeccionCobro comprobanteId={9} cobrable={cobrable} />
    </ThemeProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  listarMock.mockResolvedValue({ status: 'ok', cobros: [], comprobante: estado() });
  registrarMock.mockResolvedValue({ status: 'ok', cobro: null, comprobante: estado() });
  borrarMock.mockResolvedValue({ status: 'ok', comprobante: estado() });
});

describe('SeccionCobro', () => {
  it('muestra el estado y el saldo que devolvió el backend', async () => {
    await montar();

    await waitFor(() => expect(screen.getByTestId('cobro-estado')).toBeTruthy());
    expect(screen.getByTestId('cobro-estado').props.children).toBe('Todavía no te la pagaron');
    // 🔴 El saldo se MUESTRA, no se calcula: restar acá daría dos fuentes para el mismo número.
    expect(screen.getByTestId('cobro-saldo')).toBeTruthy();
  });

  it('🔴 si no se puede consultar, NO dice «impaga» — dice que no sabe', async () => {
    // "No sé si me pagaron" y "no me pagaron" se ven idénticos en pantalla, y el falso empuja a
    // reclamarle a un cliente que ya pagó.
    listarMock.mockResolvedValue({ status: 'no_disponible' });

    await montar();

    await waitFor(() => expect(screen.getByTestId('cobro-sin-dato')).toBeTruthy());
    expect(screen.queryByTestId('cobro-estado')).toBeNull();
    // Y sin dato tampoco se ofrece cobrar: sería actuar sobre algo que no se sabe.
    expect(screen.queryByTestId('cobro-marcar')).toBeNull();
  });

  it('🔴 un `ok` que no trajo el estado tampoco se pinta como impaga', async () => {
    listarMock.mockResolvedValue({ status: 'ok', cobros: [], comprobante: null });

    await montar();

    await waitFor(() => expect(screen.getByTestId('cobro-sin-dato')).toBeTruthy());
  });

  it('🔴 sobre una nota de crédito o una anulada no se dibuja nada', async () => {
    // No son una deuda de nadie: ofrecer «ya me la pagaron» contradice al propio documento.
    await montar(false);

    expect(screen.queryByTestId('cobro')).toBeNull();
    expect(listarMock).not.toHaveBeenCalled();
  });

  it('marcar cobrada manda `idem_key` y OMITE el monto (= saldo completo)', async () => {
    await montar();
    await waitFor(() => expect(screen.getByTestId('cobro-marcar')).toBeTruthy());

    fireEvent.press(screen.getByTestId('cobro-marcar'));

    await waitFor(() => expect(registrarMock).toHaveBeenCalledTimes(1));
    const [id, datos] = registrarMock.mock.calls[0];
    expect(id).toBe(9);
    expect(typeof datos.idemKey).toBe('string');
    expect(datos.idemKey.length).toBeGreaterThan(10);
    // Omitido, no `null`: omitido significa "el saldo pendiente completo".
    expect(datos.monto).toBeUndefined();
  });

  it('🔴 tras un fallo, el reintento reusa LA MISMA clave — es para lo que existe', async () => {
    // Si la red se corta después de que el backend registró el cobro, el usuario ve un error y vuelve
    // a tocar. Con una clave nueva por toque, eso deja DOS cobros.
    registrarMock.mockResolvedValueOnce({ status: 'no_disponible' });
    await montar();
    await waitFor(() => expect(screen.getByTestId('cobro-marcar')).toBeTruthy());

    fireEvent.press(screen.getByTestId('cobro-marcar'));
    await waitFor(() => expect(screen.getByTestId('cobro-error')).toBeTruthy());
    fireEvent.press(screen.getByTestId('cobro-marcar'));

    await waitFor(() => expect(registrarMock).toHaveBeenCalledTimes(2));
    expect(registrarMock.mock.calls[1][1].idemKey).toBe(registrarMock.mock.calls[0][1].idemKey);
  });

  it('🔴 tras un cobro EXITOSO, el próximo usa una clave nueva', async () => {
    // Un segundo cobro parcial del mismo monto es un caso real: deduplicarlo sería comerse plata.
    listarMock
      .mockResolvedValueOnce({ status: 'ok', cobros: [], comprobante: estado() })
      .mockResolvedValue({ status: 'ok', cobros: [], comprobante: estado({ estadoCobro: 'parcial', saldo: '5000.00' }) });
    await montar();
    await waitFor(() => expect(screen.getByTestId('cobro-marcar')).toBeTruthy());

    fireEvent.press(screen.getByTestId('cobro-marcar'));
    await waitFor(() => expect(registrarMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByTestId('cobro-marcar')).toBeTruthy());
    fireEvent.press(screen.getByTestId('cobro-marcar'));

    await waitFor(() => expect(registrarMock).toHaveBeenCalledTimes(2));
    expect(registrarMock.mock.calls[1][1].idemKey).not.toBe(registrarMock.mock.calls[0][1].idemKey);
  });

  it('el motivo del rechazo se muestra tal cual lo explica el backend', async () => {
    registrarMock.mockResolvedValue({ status: 'rechazado', motivo: 'el cobro supera lo que falta cobrar' });
    await montar();
    await waitFor(() => expect(screen.getByTestId('cobro-marcar')).toBeTruthy());

    fireEvent.press(screen.getByTestId('cobro-marcar'));

    await waitFor(() =>
      expect(screen.getByTestId('cobro-error').props.children).toBe('el cobro supera lo que falta cobrar'),
    );
  });

  it('sobre una cobrada no se ofrece cobrar de nuevo, ni se muestra «falta»', async () => {
    listarMock.mockResolvedValue({
      status: 'ok',
      cobros: [{ id: 1, monto: '10000.00', medio: 'efectivo', fecha: '2026-07-22', creadoEn: '' }],
      comprobante: estado({ estadoCobro: 'cobrada', cobrado: '10000.00', saldo: '0.00' }),
    });

    await montar();

    await waitFor(() => expect(screen.getByTestId('cobro-estado')).toBeTruthy());
    expect(screen.queryByTestId('cobro-marcar')).toBeNull();
    expect(screen.queryByTestId('cobro-saldo')).toBeNull();
  });

  it('deshacer un cobro lo borra y vuelve a preguntar el estado', async () => {
    listarMock.mockResolvedValue({
      status: 'ok',
      cobros: [{ id: 4, monto: '10000.00', medio: null, fecha: '2026-07-22', creadoEn: '' }],
      comprobante: estado({ estadoCobro: 'cobrada', saldo: '0.00' }),
    });
    await montar();
    await waitFor(() => expect(screen.getByTestId('cobro-deshacer-4')).toBeTruthy());

    fireEvent.press(screen.getByTestId('cobro-deshacer-4'));

    await waitFor(() => expect(borrarMock).toHaveBeenCalledWith(9, 4));
    // Se re-pregunta en vez de asumir el efecto: el estado lo deriva el backend.
    await waitFor(() => expect(listarMock).toHaveBeenCalledTimes(2));
  });
});
