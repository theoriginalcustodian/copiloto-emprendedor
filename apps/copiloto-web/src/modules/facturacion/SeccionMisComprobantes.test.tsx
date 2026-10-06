import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/** Partial mock: sólo la red. Mismo arnés que el gemelo de mobile
 *  (`apps/mobile/src/modules/facturacion/SeccionMisComprobantes.test.tsx`). */
vi.mock('@copiloto/core', async (importOriginal) => {
  const original = await importOriginal<typeof import('@copiloto/core')>();
  return {
    ...original,
    listarComprobantes: vi.fn(),
    anularComprobante: vi.fn(),
    estadoAnulacion: vi.fn(),
    confirmarAnulacion: vi.fn(),
  };
});

import {
  ApiError,
  anularComprobante,
  estadoAnulacion,
  listarComprobantes,
  type Comprobante,
  type EstadoAnulacion,
} from '@copiloto/core';

import '../../design-system/themes.css';
import { SeccionMisComprobantes } from './SeccionMisComprobantes';

const CUIT = '20111111112';
const TESTID = 'facturacion-mis-comprobantes';
/** tipoCbte-puntoVenta-nro del comprobante de abajo. */
const CLAVE = '11-6-8';
/** El id de la anulación = la fórmula del backend (`web.py:447`), derivada en la UI. */
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
  return render(<SeccionMisComprobantes cuit={CUIT} onVerDetalle={() => {}} />);
}

async function abrirAnulacion() {
  await waitFor(() => expect(screen.getByTestId(`${TESTID}-anular-${CLAVE}`)).toBeTruthy());
  fireEvent.click(screen.getByTestId(`${TESTID}-anular-${CLAVE}`));
}

/**
 * A3 · `BL-V31` — **la mitad web del gemelo**. El fix de mobile (FE1) y éste son el mismo código: la
 * anulación en curso NO se cachea en el dispositivo, se le pregunta al backend con un id **derivado**
 * del comprobante. Si el fix viajara sólo en una de las dos apps, el agujero seguiría vivo en la otra
 * — por eso el contrato pide las dos mitades juntas.
 */
describe('SeccionMisComprobantes — anulación derivada del comprobante (web)', () => {
  beforeEach(() => {
    vi.mocked(listarComprobantes).mockReset().mockResolvedValue({ status: 'ok', comprobantes: [comprobanteMock()] });
    vi.mocked(anularComprobante).mockReset();
    vi.mocked(estadoAnulacion).mockReset().mockRejectedValue(new ApiError(404, 'anulación no encontrada'));
  });

  it('al abrir el flujo consulta el id DERIVADO del comprobante (cuit-tipo-pv-nro), una sola vez', async () => {
    montar();
    await abrirAnulacion();

    await waitFor(() => expect(estadoAnulacion).toHaveBeenCalledWith(ID_ANULACION));
    // «Una consulta, no N»: 50 comprobantes en el listado no son 50 requests.
    expect(estadoAnulacion).toHaveBeenCalledTimes(1);
  });

  it('404 = no hay anulación en curso: se ofrece «Sí, anular» y no se pinta ningún error', async () => {
    montar();
    await abrirAnulacion();

    await waitFor(() => expect(screen.getByTestId(`${TESTID}-anulacion-${CLAVE}-si`)).toBeTruthy());
    // El 404 es la respuesta NORMAL acá: pintarlo como fallo pondría un error en el camino feliz.
    expect(screen.queryByTestId(`${TESTID}-error`)).toBeNull();
  });

  it('una anulación en curso en esperando_confirmacion retoma en «Confirmar», no en «Sí, anular»', async () => {
    vi.mocked(estadoAnulacion).mockReset().mockResolvedValue(estadoEsperando);
    montar();
    await abrirAnulacion();

    await waitFor(() => expect(screen.getByTestId(`${TESTID}-anulacion-${CLAVE}-confirmar`)).toBeTruthy());
    expect(screen.queryByTestId(`${TESTID}-anulacion-${CLAVE}-si`)).toBeNull();
  });

  /**
   * 🔴 DoD de A3: recargar la pestaña entre «Sí, anular» y «Confirmar» NO vuelve a ofrecer «Sí, anular»
   * para esa factura. La recarga se simula desmontando y remontando la sección: el estado en memoria se
   * pierde y lo único que queda es lo que el backend contesta.
   *
   * Control positivo: con la derivación anulada (`pedirAnulacion` sin la consulta, el `useState` pelado
   * de antes) este test da ROJO — medido por efecto, con la mutación registrada en el `avance_` de A3.
   */
  it('recargar entre «Sí, anular» y «Confirmar» retoma en «Confirmar» (no vuelve a «Sí, anular»)', async () => {
    vi.mocked(anularComprobante).mockResolvedValue({ status: 'ok', ok: true, anulacionId: ID_ANULACION });
    montar();
    await abrirAnulacion();
    await waitFor(() => expect(screen.getByTestId(`${TESTID}-anulacion-${CLAVE}-si`)).toBeTruthy());
    fireEvent.click(screen.getByTestId(`${TESTID}-anulacion-${CLAVE}-si`));
    await waitFor(() => expect(anularComprobante).toHaveBeenCalled());

    // «Recarga»: el backend ya tiene la nota de crédito en curso; el estado en memoria se pierde.
    cleanup();
    await new Promise((r) => setTimeout(r, 0));
    vi.mocked(estadoAnulacion).mockReset().mockResolvedValue(estadoEsperando);
    montar();
    await abrirAnulacion();

    await waitFor(() => expect(screen.getByTestId(`${TESTID}-anulacion-${CLAVE}-confirmar`)).toBeTruthy());
    expect(screen.queryByTestId(`${TESTID}-anulacion-${CLAVE}-si`)).toBeNull();
  });
});
