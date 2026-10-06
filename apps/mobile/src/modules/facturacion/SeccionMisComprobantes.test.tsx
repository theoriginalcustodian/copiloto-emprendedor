import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import {
  ApiError,
  anularComprobante,
  estadoAnulacion,
  listarComprobantes,
  type Comprobante,
  type EstadoAnulacion,
} from '@copiloto/core';

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
// tipoCbte-puntoVenta-nro del comprobante de abajo.
const CLAVE = '11-6-8';
// El id de la anulación = la fórmula del backend (`make_iniciar_anulacion`).
const ID_ANULACION = `${CUIT}-11-6-8`;

function comprobanteMock(over: Partial<Comprobante> = {}): Comprobante {
  return {
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
    ...over,
  } as Comprobante;
}

const estadoEsperando: EstadoAnulacion = {
  paso: 'esperando_confirmacion',
  original: null,
  errores: [],
  resultado: null,
  motivo: null,
  terminado: false,
  marcada: false,
};

function montar() {
  return render(
    <ThemeProvider>
      <SeccionMisComprobantes cuit={CUIT} onVerDetalle={() => {}} />
    </ThemeProvider>,
  );
}

async function abrirAnulacion() {
  await waitFor(() => expect(screen.getByTestId(`${TESTID}-anular-${CLAVE}`)).toBeTruthy());
  fireEvent.press(screen.getByTestId(`${TESTID}-anular-${CLAVE}`));
}

describe('SeccionMisComprobantes — anulación derivada del comprobante', () => {
  beforeEach(() => {
    jest.mocked(listarComprobantes).mockReset().mockResolvedValue({ status: 'ok', comprobantes: [comprobanteMock()] });
    jest.mocked(anularComprobante).mockReset();
    jest.mocked(estadoAnulacion).mockReset().mockRejectedValue(new ApiError(404, 'anulación no encontrada'));
  });

  it('al abrir el flujo consulta el id DERIVADO del comprobante (cuit-tipo-pv-nro), una sola vez', async () => {
    montar();
    await abrirAnulacion();

    await waitFor(() => expect(estadoAnulacion).toHaveBeenCalledWith(ID_ANULACION));
    expect(estadoAnulacion).toHaveBeenCalledTimes(1);
  });

  it('404 = no hay anulación en curso: se ofrece «Sí, anular» y no se pinta ningún error', async () => {
    montar();
    await abrirAnulacion();

    await waitFor(() => expect(screen.getByTestId(`${TESTID}-anulacion-${CLAVE}-si`)).toBeTruthy());
    expect(screen.queryByTestId(`${TESTID}-error`)).toBeNull();
  });

  it('una anulación en curso en esperando_confirmacion retoma en «Confirmar», no en «Sí, anular»', async () => {
    jest.mocked(estadoAnulacion).mockReset().mockResolvedValue(estadoEsperando);
    montar();
    await abrirAnulacion();

    await waitFor(() => expect(screen.getByTestId(`${TESTID}-anulacion-${CLAVE}-confirmar`)).toBeTruthy());
    expect(screen.queryByTestId(`${TESTID}-anulacion-${CLAVE}-si`)).toBeNull();
  });

  /**
   * 🔴 DoD de A3: recargar la app entre «Sí, anular» y «Confirmar» NO vuelve a ofrecer «Sí, anular» para
   * esa factura. Se simula la recarga desmontando y remontando la sección: el estado en memoria se pierde,
   * y lo único que queda es lo que el backend contesta.
   *
   * Control positivo: con `anulacionEnCursoDe` reemplazada por `null` (el `useState` pelado de antes), este
   * test da ROJO — ver el registro de mutación en el avance de A3.
   */
  it('recargar entre «Sí, anular» y «Confirmar» retoma en «Confirmar» (no vuelve a «Sí, anular»)', async () => {
    jest.mocked(anularComprobante).mockResolvedValue({ status: 'ok', ok: true, anulacionId: ID_ANULACION });
    montar();
    await abrirAnulacion();
    await waitFor(() => expect(screen.getByTestId(`${TESTID}-anulacion-${CLAVE}-si`)).toBeTruthy());
    fireEvent.press(screen.getByTestId(`${TESTID}-anulacion-${CLAVE}-si`));
    await waitFor(() => expect(anularComprobante).toHaveBeenCalled());

    // «Recarga»: el backend ya tiene la NC en curso; el estado en memoria de la pantalla se pierde.
    // cleanup() es async en RNTL 14 y drena su cola con await: sin await, el waitFor de abajo se registra
    // en la cola que aún se drena y lo aborta («waitFor was aborted by cleanup»). Main rojo desde #803.
    await cleanup();
    jest.mocked(estadoAnulacion).mockReset().mockResolvedValue(estadoEsperando);
    montar();
    await abrirAnulacion();

    await waitFor(() => expect(screen.getByTestId(`${TESTID}-anulacion-${CLAVE}-confirmar`)).toBeTruthy());
    expect(screen.queryByTestId(`${TESTID}-anulacion-${CLAVE}-si`)).toBeNull();
  });
});
