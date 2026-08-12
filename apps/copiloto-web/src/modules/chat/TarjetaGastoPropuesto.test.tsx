import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/** Partial mock: sólo la red. `leerGastoPropuesto`, REAL — mismo arnés que
 *  `TarjetaPresupuestoPropuesto.test.tsx`. */
vi.mock('@copiloto/core', async (importOriginal) => {
  const original = await importOriginal<typeof import('@copiloto/core')>();
  return {
    ...original,
    crearGasto: vi.fn(),
  };
});

import { crearGasto, leerGastoPropuesto, type Gasto } from '@copiloto/core';

import { TarjetaGastoPropuesto } from './TarjetaGastoPropuesto';

const mockCrear = vi.mocked(crearGasto);

function propuesta(over: Record<string, unknown> = {}) {
  const p = leerGastoPropuesto({
    kind: 'gasto_propuesto',
    data: {
      monto: '15000',
      monto_sugerido: null,
      fecha: '2026-08-12',
      categoria: 'mercaderia',
      proveedor: 'Ferretería Sur',
      medio_pago: 'efectivo',
      descripcion: 'quince mil de insumos en la ferretería',
      origen: 'voz',
      ...over,
    },
  });
  if (p == null) throw new Error('la propuesta de prueba no debería ser null');
  return p;
}

function gastoGuardado(monto: string): Gasto {
  return {
    id: 5,
    monto,
    montoSugerido: null,
    fecha: '2026-08-12',
    categoria: 'mercaderia',
    proveedor: 'Ferretería Sur',
    medioPago: 'efectivo',
    descripcion: 'quince mil de insumos en la ferretería',
    origen: 'voz',
    creadoEn: '2026-08-12T12:00:00.000000+00:00',
  };
}

const MENSAJE_ID = 'assistant-1';

describe('TarjetaGastoPropuesto', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear(); // guard cross-reload vive en localStorage — aislar entre tests
  });

  it('dice explícitamente que TODAVÍA no se anotó', async () => {
    render(<TarjetaGastoPropuesto propuesta={propuesta()} mensajeId={MENSAJE_ID} />);

    expect(await screen.findByText(/todavía no lo anoté/)).toBeInTheDocument();
  });

  it('precarga monto, categoría, proveedor y medio de pago — editables', async () => {
    render(<TarjetaGastoPropuesto propuesta={propuesta()} mensajeId={MENSAJE_ID} />);

    expect(await screen.findByTestId('gasto-monto')).toHaveValue('15000');
    expect(screen.getByTestId('gasto-categoria')).toHaveValue('mercaderia');
    expect(screen.getByTestId('gasto-proveedor')).toHaveValue('Ferretería Sur');
    expect(screen.getByTestId('gasto-medio-pago')).toHaveValue('efectivo');
  });

  it('muestra lo dictado como cita', async () => {
    render(<TarjetaGastoPropuesto propuesta={propuesta()} mensajeId={MENSAJE_ID} />);

    expect(await screen.findByText('«quince mil de insumos en la ferretería»')).toBeInTheDocument();
  });

  it('origen foto: NO precarga el monto, ofrece la sugerencia del OCR tocable', async () => {
    render(
      <TarjetaGastoPropuesto
        propuesta={propuesta({ monto: '', monto_sugerido: '8500', origen: 'foto', descripcion: null })}
        mensajeId={MENSAJE_ID}
      />,
    );

    expect(await screen.findByTestId('gasto-monto')).toHaveValue('');
    const sugerido = screen.getByTestId('gasto-monto-sugerido');
    expect(sugerido).toHaveTextContent('8500');

    fireEvent.click(sugerido);

    expect(screen.getByTestId('gasto-monto')).toHaveValue('8500');
  });

  it('al guardar se convierte en confirmación — no persiste en automático', async () => {
    mockCrear.mockResolvedValue({ status: 'ok', gasto: gastoGuardado('15000.00') });
    render(<TarjetaGastoPropuesto propuesta={propuesta()} mensajeId={MENSAJE_ID} />);

    expect(mockCrear).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('gasto-guardar'));

    await waitFor(() => expect(screen.getByTestId('gasto-propuesto-guardado')).toBeInTheDocument());
    expect(screen.queryByTestId('gasto-guardar')).toBeNull();
  });

  it('descartar no guarda nada', () => {
    render(<TarjetaGastoPropuesto propuesta={propuesta()} mensajeId={MENSAJE_ID} />);

    fireEvent.click(screen.getByTestId('gasto-cancelar'));

    expect(screen.getByTestId('gasto-propuesto-descartado')).toBeInTheDocument();
    expect(mockCrear).not.toHaveBeenCalled();
  });
});

describe('TarjetaGastoPropuesto — guard cross-reload (caso hostil)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it('card ya GUARDADA + reload (remount) ⇒ va directo al estado terminal, no se puede duplicar', async () => {
    mockCrear.mockResolvedValue({ status: 'ok', gasto: gastoGuardado('15000.00') });
    const { unmount } = render(<TarjetaGastoPropuesto propuesta={propuesta()} mensajeId={MENSAJE_ID} />);

    fireEvent.click(screen.getByTestId('gasto-guardar'));
    await waitFor(() => expect(screen.getByTestId('gasto-propuesto-guardado')).toBeInTheDocument());
    expect(mockCrear).toHaveBeenCalledTimes(1);

    unmount(); // simula el reload: React se remonta desde cero, sólo `localStorage` sobrevive

    render(<TarjetaGastoPropuesto propuesta={propuesta()} mensajeId={MENSAJE_ID} />);

    expect(screen.getByTestId('gasto-propuesto-guardado')).toBeInTheDocument();
    expect(screen.queryByTestId('gasto-guardar')).toBeNull();
    expect(screen.queryByTestId('gasto-monto')).toBeNull();
    // Control negativo del guard: sin él este 2º render volvería a 'editando' y el click habría
    // llamado a `crearGasto` una 2ª vez (duplicado). Sigue en 1 con el guard puesto.
    expect(mockCrear).toHaveBeenCalledTimes(1);
  });

  it('card ya DESCARTADA + reload (remount) ⇒ sigue descartada, no reaparece editable', () => {
    render(<TarjetaGastoPropuesto propuesta={propuesta()} mensajeId={MENSAJE_ID} />);
    fireEvent.click(screen.getByTestId('gasto-cancelar'));
    expect(screen.getByTestId('gasto-propuesto-descartado')).toBeInTheDocument();

    render(<TarjetaGastoPropuesto propuesta={propuesta()} mensajeId={MENSAJE_ID} />);

    expect(screen.getAllByTestId('gasto-propuesto-descartado').length).toBeGreaterThan(0);
    expect(screen.queryByTestId('gasto-guardar')).toBeNull();
    expect(mockCrear).not.toHaveBeenCalled();
  });

  it('dos mensajes distintos (`mensajeId` distinto) NO comparten resolución — la marca es por card, no global', async () => {
    mockCrear.mockResolvedValue({ status: 'ok', gasto: gastoGuardado('15000.00') });
    const { unmount } = render(<TarjetaGastoPropuesto propuesta={propuesta()} mensajeId="assistant-1" />);
    fireEvent.click(screen.getByTestId('gasto-guardar'));
    await waitFor(() => expect(screen.getByTestId('gasto-propuesto-guardado')).toBeInTheDocument());
    unmount();

    render(<TarjetaGastoPropuesto propuesta={propuesta()} mensajeId="assistant-2" />);

    expect(await screen.findByTestId('gasto-monto')).toBeInTheDocument(); // el 2º sigue editable
  });
});
