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
    // await es EMPÍRICO, no derivado: sin él, este caso falla con «waitFor was aborted by cleanup» (medido
    // 4/10 en CI-like, 2/2 local; con él, 10/10 verde). El mecanismo exacto de RNTL 14 no está aislado:
    // si alguien quita el await «por simplificar», el flake vuelve. Main rojo desde #803.
    await cleanup();
    jest.mocked(estadoAnulacion).mockReset().mockResolvedValue(estadoEsperando);
    montar();
    await abrirAnulacion();

    await waitFor(() => expect(screen.getByTestId(`${TESTID}-anulacion-${CLAVE}-confirmar`)).toBeTruthy());
    expect(screen.queryByTestId(`${TESTID}-anulacion-${CLAVE}-si`)).toBeNull();
  });
});

/**
 * 🔴 `F1.3` del sprint «app lista para usuarios reales» (issue #1015) — **el caso HOSTIL del
 * predicado `esAnulable`**. Mitad mobile; la de web es el gemelo
 * (`apps/copiloto-web/src/modules/facturacion/SeccionMisComprobantes.test.tsx`).
 *
 * El control estaba escrito (`esAnulable` = `estado === 'emitida'`) y **nada lo ejercitaba**: los
 * tests de arriba sólo construyen comprobantes `emitida`, así que `return true` los dejaba a todos
 * verdes. El síntoma era ofrecer **anular una nota de crédito** — anular la anulación.
 *
 * ⚠️ El predicado vive DOS veces, una por app: `SeccionMisComprobantes.tsx:26` acá y `:24` en web.
 * Por eso el test va en las dos mitades y no en una — un fix que viaje a una sola deja el agujero
 * abierto en la otra, y el verde de la que sí lo tiene lo tapa.
 *
 * Los tres estados van en la MISMA lista a propósito: un test que renderiza sólo la NC pasa igual
 * si la sección no renderizó nada. El botón de la `emitida` es el control positivo interno.
 */
describe('SeccionMisComprobantes — sólo una factura emitida se puede anular', () => {
  const EMITIDA = '11-6-8';
  const NOTA_CREDITO = '13-6-9';
  const ANULADA = '11-6-10';

  beforeEach(() => {
    jest
      .mocked(listarComprobantes)
      .mockReset()
      .mockResolvedValue({
        status: 'ok',
        comprobantes: [
          comprobanteMock(),
          comprobanteMock({ tipoCbte: 13, nro: 9, estado: 'nota_credito' }),
          comprobanteMock({ nro: 10, estado: 'anulada' }),
        ],
      });
    jest.mocked(anularComprobante).mockReset();
    jest.mocked(estadoAnulacion).mockReset().mockRejectedValue(new ApiError(404, 'anulación no encontrada'));
  });

  it('una nota de crédito NO ofrece «Anular» — y la factura emitida de al lado SÍ', async () => {
    montar();

    // Control positivo interno: sin esto, un `queryByTestId` null no distingue «el filtro filtró»
    // de «la lista nunca se renderizó».
    await waitFor(() => expect(screen.getByTestId(`${TESTID}-anular-${EMITIDA}`)).toBeTruthy());

    expect(screen.queryByTestId(`${TESTID}-anular-${NOTA_CREDITO}`)).toBeNull();
  });

  it('un comprobante ya anulado tampoco ofrece «Anular»', async () => {
    montar();
    await waitFor(() => expect(screen.getByTestId(`${TESTID}-anular-${EMITIDA}`)).toBeTruthy());

    expect(screen.queryByTestId(`${TESTID}-anular-${ANULADA}`)).toBeNull();
  });
});
