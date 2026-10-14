import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/** Partial mock: sólo la red. Gemelo de mobile
 *  (`apps/mobile/src/modules/facturacion/SeccionMisComprobantes.falloAnulacion.test.tsx`).
 *
 *  SM-D7 (#1009) — anular un comprobante NO falla en silencio. El defecto vivía igual en web y en mobile
 *  (mismo archivo, mismas funciones): arreglar sólo una dejaba la otra muda. */
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
  confirmarAnulacion,
  estadoAnulacion,
  listarComprobantes,
  type Comprobante,
  type EstadoAnulacion,
} from '@copiloto/core';

import '../../design-system/themes.css';
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
  return render(<SeccionMisComprobantes cuit={CUIT} onVerDetalle={() => {}} />);
}

async function irAlPedido() {
  await waitFor(() => expect(screen.getByTestId(`${TESTID}-anular-${CLAVE}`)).toBeTruthy());
  fireEvent.click(screen.getByTestId(`${TESTID}-anular-${CLAVE}`));
  await waitFor(() => expect(screen.getByTestId(ID('si'))).toBeTruthy());
}

describe('SeccionMisComprobantes — SM-D7: el fallo de anular se VE (web)', () => {
  beforeEach(() => {
    vi.mocked(listarComprobantes).mockReset().mockResolvedValue({ status: 'ok', comprobantes: [comprobante] });
    vi.mocked(anularComprobante).mockReset();
    vi.mocked(confirmarAnulacion).mockReset();
    vi.mocked(estadoAnulacion).mockReset().mockRejectedValue(new ApiError(404, 'anulación no encontrada'));
  });
  afterEach(() => cleanup());

  it('«Sí, anular» con el backend rechazando: se ve el motivo y se puede reintentar (no queda a medias)', async () => {
    vi.mocked(anularComprobante).mockRejectedValue(new ApiError(400, 'bad', 'El CAE ya no admite anulación', {}));
    montar();
    await irAlPedido();

    fireEvent.click(screen.getByTestId(ID('si')));

    await waitFor(() => expect(screen.getByTestId(ID('error'))).toBeTruthy());
    expect(screen.getByTestId(ID('error')).textContent).toBe('El CAE ya no admite anulación');
    expect(screen.queryByTestId(ID('confirmar'))).toBeNull();
    expect(screen.getByTestId(ID('si'))).toBeTruthy();
    expect((screen.getByTestId(ID('si')) as HTMLButtonElement).disabled).toBe(false);
  });

  it('«Sí, anular» con `no_disponible`: lo dice (antes: ni error ni aviso)', async () => {
    vi.mocked(anularComprobante).mockResolvedValue({ status: 'no_disponible' });
    montar();
    await irAlPedido();

    fireEvent.click(screen.getByTestId(ID('si')));

    await waitFor(() => expect(screen.getByTestId(ID('error'))).toBeTruthy());
    expect(screen.getByTestId(ID('error')).textContent).toMatch(/todavía no está disponible/);
    expect(screen.queryByTestId(ID('confirmar'))).toBeNull();
  });

  it('confirmar la nota de crédito con el 409 del backend: se ve su `motivo`', async () => {
    vi.mocked(estadoAnulacion).mockReset().mockResolvedValue(estadoEsperando);
    vi.mocked(confirmarAnulacion).mockRejectedValue(
      new ApiError(409, 'conflict', 'otro', { motivo: 'La anulación ya quedó fallida', motivo_codigo: 'fallida' }),
    );
    montar();
    await waitFor(() => expect(screen.getByTestId(`${TESTID}-anular-${CLAVE}`)).toBeTruthy());
    fireEvent.click(screen.getByTestId(`${TESTID}-anular-${CLAVE}`));
    await waitFor(() => expect(screen.getByTestId(ID('confirmar'))).toBeTruthy());
    expect(estadoAnulacion).toHaveBeenCalledWith(ID_ANULACION);

    fireEvent.click(screen.getByTestId(ID('confirmar')));

    await waitFor(() => expect(screen.getByTestId(ID('error'))).toBeTruthy());
    expect(screen.getByTestId(ID('error')).textContent).toBe('La anulación ya quedó fallida');
    expect(screen.getByTestId(ID('confirmar'))).toBeTruthy();
    expect(screen.queryByTestId(ID('resultado'))).toBeNull();
  });

  it('control: cuando anular SÍ sale bien no se pinta ningún error', async () => {
    vi.mocked(anularComprobante).mockResolvedValue({ status: 'ok', ok: true, anulacionId: ID_ANULACION });
    montar();
    await irAlPedido();

    fireEvent.click(screen.getByTestId(ID('si')));

    await waitFor(() => expect(screen.queryByTestId(ID('si'))).toBeNull());
    expect(screen.queryByTestId(ID('error'))).toBeNull();
    expect(anularComprobante).toHaveBeenCalledTimes(1);
  });

  it('un reintento exitoso borra el error anterior', async () => {
    vi.mocked(anularComprobante)
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce({ status: 'ok', ok: true, anulacionId: ID_ANULACION });
    montar();
    await irAlPedido();

    fireEvent.click(screen.getByTestId(ID('si')));
    await waitFor(() => expect(screen.getByTestId(ID('error'))).toBeTruthy());

    fireEvent.click(screen.getByTestId(ID('si')));
    await waitFor(() => expect(screen.queryByTestId(ID('error'))).toBeNull());
    expect(anularComprobante).toHaveBeenCalledTimes(2);
  });
});
