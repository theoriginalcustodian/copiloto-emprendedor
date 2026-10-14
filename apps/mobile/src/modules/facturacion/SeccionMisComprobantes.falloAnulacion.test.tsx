import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import {
  ApiError,
  anularComprobante,
  confirmarAnulacion,
  estadoAnulacion,
  listarComprobantes,
  type Comprobante,
  type EstadoAnulacion,
} from '@copiloto/core';

// SM-D7 (#1009) — anular un comprobante NO falla en silencio. Antes: `try/finally` sin `catch` y sin
// `else` sobre `status !== 'ok'`: cualquier fallo dejaba el flujo igual que antes, sin una palabra. Tres
// vías de silencio, tres tests: anular que lanza, anular que devuelve `no_disponible`, confirmar que lanza.

jest.mock('@copiloto/core', () => {
  const actual = jest.requireActual('@copiloto/core');
  return {
    ...actual,
    listarComprobantes: jest.fn(),
    anularComprobante: jest.fn(),
    estadoAnulacion: jest.fn(),
    confirmarAnulacion: jest.fn(),
  };
});

import { ThemeProvider } from '../../theme/ThemeProvider';
import { SeccionMisComprobantes } from './SeccionMisComprobantes';

const CUIT = '20111111112';
const TESTID = 'facturacion-mis-comprobantes';
const CLAVE = '11-6-8';
const ID_ANULACION = `${CUIT}-11-6-8`;

const comprobante = {
  cuit: CUIT,
  tipoCbte: 11,
  puntoVenta: 6,
  nro: 8,
  cae: '86294776469171',
  caeVto: '2026-08-01',
  fechaEmision: '2026-07-21T00:00:00Z',
  total: '1000.00',
  estado: 'emitida',
  pdfUrl: null,
  cbteAsocNro: null,
} as Comprobante;

const estadoEsperando: EstadoAnulacion = {
  paso: 'esperando_confirmacion',
  original: null,
  errores: [],
  resultado: null,
  motivo: null,
  terminado: false,
  marcada: false,
};

const ID = (sufijo: string) => `${TESTID}-anulacion-${CLAVE}-${sufijo}`;

function montar() {
  return render(
    <ThemeProvider>
      <SeccionMisComprobantes cuit={CUIT} onVerDetalle={() => {}} />
    </ThemeProvider>,
  );
}

async function irAlPedido() {
  await waitFor(() => expect(screen.getByTestId(`${TESTID}-anular-${CLAVE}`)).toBeTruthy());
  fireEvent.press(screen.getByTestId(`${TESTID}-anular-${CLAVE}`));
  await waitFor(() => expect(screen.getByTestId(ID('si'))).toBeTruthy());
}

describe('SeccionMisComprobantes — SM-D7: el fallo de anular se VE', () => {
  beforeEach(() => {
    jest.mocked(listarComprobantes).mockReset().mockResolvedValue({ status: 'ok', comprobantes: [comprobante] });
    jest.mocked(anularComprobante).mockReset();
    jest.mocked(confirmarAnulacion).mockReset();
    jest.mocked(estadoAnulacion).mockReset().mockRejectedValue(new ApiError(404, 'anulación no encontrada'));
  });
  afterEach(() => cleanup());

  it('«Sí, anular» con el backend rechazando: se ve el motivo y se puede reintentar (no queda a medias)', async () => {
    jest.mocked(anularComprobante).mockRejectedValue(new ApiError(400, 'bad', 'El CAE ya no admite anulación', {}));
    montar();
    await irAlPedido();

    fireEvent.press(screen.getByTestId(ID('si')));

    await waitFor(() => expect(screen.getByTestId(ID('error'))).toBeTruthy());
    expect(screen.getByTestId(ID('error'))).toHaveTextContent('El CAE ya no admite anulación');
    // No avanzó al paso de confirmar, y el botón volvió a estar disponible para reintentar.
    expect(screen.queryByTestId(ID('confirmar'))).toBeNull();
    expect(screen.getByTestId(ID('si'))).toBeTruthy();
    expect(screen.getByText('Sí, anular')).toBeTruthy();
  });

  it('«Sí, anular» con `no_disponible`: lo dice (antes: ni error ni aviso)', async () => {
    jest.mocked(anularComprobante).mockResolvedValue({ status: 'no_disponible' });
    montar();
    await irAlPedido();

    fireEvent.press(screen.getByTestId(ID('si')));

    await waitFor(() => expect(screen.getByTestId(ID('error'))).toBeTruthy());
    expect(screen.getByTestId(ID('error'))).toHaveTextContent(/todavía no está disponible/);
    expect(screen.queryByTestId(ID('confirmar'))).toBeNull();
  });

  it('confirmar la nota de crédito con el 409 del backend: se ve su `motivo`', async () => {
    // La anulación ya existe y espera confirmación (recarga entre «Sí, anular» y «Confirmar»).
    jest.mocked(estadoAnulacion).mockReset().mockResolvedValue(estadoEsperando);
    jest
      .mocked(confirmarAnulacion)
      .mockRejectedValue(new ApiError(409, 'conflict', 'otro', { motivo: 'La anulación ya quedó fallida', motivo_codigo: 'fallida' }));
    montar();
    await waitFor(() => expect(screen.getByTestId(`${TESTID}-anular-${CLAVE}`)).toBeTruthy());
    fireEvent.press(screen.getByTestId(`${TESTID}-anular-${CLAVE}`));
    await waitFor(() => expect(screen.getByTestId(ID('confirmar'))).toBeTruthy());
    expect(estadoAnulacion).toHaveBeenCalledWith(ID_ANULACION);

    fireEvent.press(screen.getByTestId(ID('confirmar')));

    await waitFor(() => expect(screen.getByTestId(ID('error'))).toBeTruthy());
    expect(screen.getByTestId(ID('error'))).toHaveTextContent('La anulación ya quedó fallida');
    // El botón de confirmar sigue ahí: no se dio por anulada.
    expect(screen.getByTestId(ID('confirmar'))).toBeTruthy();
    expect(screen.queryByTestId(ID('resultado'))).toBeNull();
  });

  it('control: cuando anular SÍ sale bien no se pinta ningún error', async () => {
    jest.mocked(anularComprobante).mockResolvedValue({ status: 'ok', ok: true, anulacionId: ID_ANULACION });
    montar();
    await irAlPedido();

    fireEvent.press(screen.getByTestId(ID('si')));

    await waitFor(() => expect(screen.queryByTestId(ID('si'))).toBeNull());
    expect(screen.queryByTestId(ID('error'))).toBeNull();
    expect(anularComprobante).toHaveBeenCalledTimes(1);
  });

  it('un reintento exitoso borra el error anterior', async () => {
    jest
      .mocked(anularComprobante)
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce({ status: 'ok', ok: true, anulacionId: ID_ANULACION });
    montar();
    await irAlPedido();

    fireEvent.press(screen.getByTestId(ID('si')));
    await waitFor(() => expect(screen.getByTestId(ID('error'))).toBeTruthy());

    fireEvent.press(screen.getByTestId(ID('si')));
    await waitFor(() => expect(screen.queryByTestId(ID('error'))).toBeNull());
    expect(anularComprobante).toHaveBeenCalledTimes(2);
  });
});
