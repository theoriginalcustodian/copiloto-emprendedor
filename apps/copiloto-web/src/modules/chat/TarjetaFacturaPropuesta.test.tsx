import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/** Partial mock: sólo la red. `leerFacturaPropuesta`, REAL — mismo arnés que
 *  `TarjetaClientePropuesto.test.tsx`. */
vi.mock('@copiloto/core', async (importOriginal) => {
  const original = await importOriginal<typeof import('@copiloto/core')>();
  return {
    ...original,
    confirmarConTokenFresco: vi.fn(),
    estadoFactura: vi.fn(),
  };
});

import { confirmarConTokenFresco, estadoFactura, leerFacturaPropuesta, type EstadoFacturaResp } from '@copiloto/core';

import { TarjetaFacturaPropuesta } from './TarjetaFacturaPropuesta';

const mockConfirmar = vi.mocked(confirmarConTokenFresco);
const mockEstado = vi.mocked(estadoFactura);

function estadoEmitido(over: Partial<EstadoFacturaResp> = {}): EstadoFacturaResp {
  return {
    estado: 'emitida',
    faltantes: [],
    items: [],
    total: '50000',
    tokenConfirmacion: null,
    resultado: { ok: true, duplicado: false, cae: '74123456789012', caeVto: '2026-10-01', nro: 42, tipoCbte: 11, puntoVenta: 1, id: null },
    pdf: null,
    drive: null,
    receptor: null,
    datosVenta: null,
    motivo: null,
    motivoCodigo: null,
    terminado: false,
    ...over,
  };
}

function propuesta(over: Record<string, unknown> = {}) {
  const p = leerFacturaPropuesta({
    kind: 'factura_propuesta',
    data: {
      factura_id: 'presu-12',
      faltantes: [],
      items: [{ descripcion: 'Service de aire', cantidad: 1, precio_unitario: 50000 }],
      cliente: { razon_social: 'Juan Pérez', cuit: '20304050607', condicion_iva: 'CF' },
      total: 50000,
      tipo_comprobante: 'C',
      ...over,
    },
  });
  if (p == null) throw new Error('la propuesta de prueba no debería ser null');
  return p;
}

const MENSAJE_ID = 'assistant-1';

describe('TarjetaFacturaPropuesta', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('dice explícitamente que TODAVÍA no la mandó', () => {
    render(<TarjetaFacturaPropuesta propuesta={propuesta()} mensajeId={MENSAJE_ID} />);

    expect(screen.getByText('Esto entendí. Revisalo y tocá Emitir — todavía no la mandé.')).toBeInTheDocument();
  });

  it('muestra cliente, ítems y total', () => {
    render(<TarjetaFacturaPropuesta propuesta={propuesta()} mensajeId={MENSAJE_ID} />);

    expect(screen.getByText('Juan Pérez · 20304050607')).toBeInTheDocument();
    expect(screen.getByText('Service de aire')).toBeInTheDocument();
    expect(screen.getByText('1 × 50000')).toBeInTheDocument();
    expect(screen.getByTestId('factura-propuesta-total')).toHaveTextContent('Total: 50000');
  });

  it('🔴 no permite editar ítems en el chat — no hay ningún input, sólo lectura + acción', () => {
    render(<TarjetaFacturaPropuesta propuesta={propuesta()} mensajeId={MENSAJE_ID} />);

    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('faltantes vacío → botón Emitir; al tocarlo, confía en `confirmarConTokenFresco`', async () => {
    mockConfirmar.mockResolvedValue({ emitida: true });
    render(<TarjetaFacturaPropuesta propuesta={propuesta()} mensajeId={MENSAJE_ID} />);

    expect(screen.queryByTestId('factura-propuesta-completar')).toBeNull();
    fireEvent.click(screen.getByTestId('factura-propuesta-emitir'));

    expect(mockConfirmar).toHaveBeenCalledWith('presu-12');
    await waitFor(() => expect(screen.getByTestId('factura-propuesta-emitida')).toBeInTheDocument());
    expect(screen.getByTestId('factura-propuesta-emitida')).toHaveTextContent('Factura emitida.');
  });

  it('BL-C2: tras emitir muestra número, CAE y vencimiento; el PDF que llega después aparece sin recargar', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      mockConfirmar.mockResolvedValue({ emitida: true, estado: estadoEmitido() });
      mockEstado.mockResolvedValue(
        estadoEmitido({ terminado: true, pdf: { url: 'https://afip.test/f.pdf', nombre: 'f.pdf', expiraAt: null } }),
      );
      render(<TarjetaFacturaPropuesta propuesta={propuesta()} mensajeId={MENSAJE_ID} />);

      fireEvent.click(screen.getByTestId('factura-propuesta-emitir'));

      await waitFor(() => expect(screen.getByTestId('factura-emitida-cae')).toHaveTextContent('74123456789012'));
      expect(screen.getByTestId('factura-emitida-numero')).toHaveTextContent('0001-00000042');
      expect(screen.getByTestId('factura-emitida-vto')).toHaveTextContent('2026-10-01');
      expect(screen.getByTestId('factura-emitida-preparando')).toBeInTheDocument();
      expect(screen.queryByTestId('factura-emitida-pdf')).toBeNull();

      await vi.advanceTimersByTimeAsync(1600);

      const pdf = await screen.findByTestId('factura-emitida-pdf');
      expect(pdf).toHaveAttribute('href', 'https://afip.test/f.pdf');
      expect(screen.queryByTestId('factura-emitida-preparando')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('BL-C2: terminado sin PDF ni Drive dice que se emitió (CAE válido), no que falló', async () => {
    mockConfirmar.mockResolvedValue({ emitida: true, estado: estadoEmitido({ terminado: true }) });
    render(<TarjetaFacturaPropuesta propuesta={propuesta()} mensajeId={MENSAJE_ID} />);
    fireEvent.click(screen.getByTestId('factura-propuesta-emitir'));
    expect(await screen.findByTestId('factura-emitida-sin-pdf')).toHaveTextContent('CAE es válido');
    expect(screen.getByTestId('factura-emitida-cae')).toBeInTheDocument();
  });

  it('BL-C2: Drive gana sobre el link de AFIP (no vence)', async () => {
    mockConfirmar.mockResolvedValue({
      emitida: true,
      estado: estadoEmitido({
        terminado: true,
        pdf: { url: 'https://afip.test/f.pdf', nombre: 'f.pdf', expiraAt: null },
        drive: { guardado: true, link: 'https://drive.test/f' },
      }),
    });
    render(<TarjetaFacturaPropuesta propuesta={propuesta()} mensajeId={MENSAJE_ID} />);
    fireEvent.click(screen.getByTestId('factura-propuesta-emitir'));
    expect(await screen.findByTestId('factura-emitida-pdf')).toHaveAttribute('href', 'https://drive.test/f');
  });

  it('🔴 `emitida:false` (no-op del backend) NO pasa a terminal — muestra el motivo y se puede reintentar', async () => {
    mockConfirmar.mockResolvedValue({
      emitida: false,
      motivo: 'los datos cambiaron, revisá el resumen antes de confirmar',
    });
    render(<TarjetaFacturaPropuesta propuesta={propuesta()} mensajeId={MENSAJE_ID} />);

    fireEvent.click(screen.getByTestId('factura-propuesta-emitir'));

    await waitFor(() => expect(screen.getByTestId('factura-propuesta-error')).toBeInTheDocument());
    expect(screen.getByTestId('factura-propuesta-error')).toHaveTextContent(
      'los datos cambiaron, revisá el resumen antes de confirmar',
    );
    expect(screen.queryByTestId('factura-propuesta-emitida')).toBeNull();
    expect(screen.getByTestId('factura-propuesta-emitir')).toBeInTheDocument();
  });

  it('faltantes no vacío + sin onCompletarAMano → ni Emitir ni el botón (caller no ofrece el handoff)', () => {
    render(<TarjetaFacturaPropuesta propuesta={propuesta({ faltantes: ['cliente'] })} mensajeId={MENSAJE_ID} />);

    expect(screen.queryByTestId('factura-propuesta-emitir')).toBeNull();
    expect(screen.queryByTestId('factura-propuesta-completar')).toBeNull();
    expect(mockConfirmar).not.toHaveBeenCalled();
  });

  it('faltantes no vacío + onCompletarAMano → ofrece "Completar a mano" con el facturaId del borrador', () => {
    const onCompletarAMano = vi.fn();
    render(
      <TarjetaFacturaPropuesta
        propuesta={propuesta({ faltantes: ['cliente'] })}
        mensajeId={MENSAJE_ID}
        onCompletarAMano={onCompletarAMano}
      />,
    );

    fireEvent.click(screen.getByTestId('factura-propuesta-completar'));

    expect(onCompletarAMano).toHaveBeenCalledWith('presu-12');
    expect(mockConfirmar).not.toHaveBeenCalled();
  });
});
