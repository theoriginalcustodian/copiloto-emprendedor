import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/** Partial mock: sólo la red. `leerFacturaPropuesta`, REAL — mismo arnés que
 *  `TarjetaClientePropuesto.test.tsx`. */
vi.mock('@copiloto/core', async (importOriginal) => {
  const original = await importOriginal<typeof import('@copiloto/core')>();
  return {
    ...original,
    confirmarConTokenFresco: vi.fn(),
  };
});

import { confirmarConTokenFresco, leerFacturaPropuesta } from '@copiloto/core';

import { TarjetaFacturaPropuesta } from './TarjetaFacturaPropuesta';

const mockConfirmar = vi.mocked(confirmarConTokenFresco);

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
