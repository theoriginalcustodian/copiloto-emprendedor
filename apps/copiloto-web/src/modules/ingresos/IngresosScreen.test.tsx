import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/** Partial mock: sólo la red — mismo arnés que `ClientesScreen.test.tsx`/`GastosScreen.test.tsx`. */
vi.mock('@copiloto/core', async (importOriginal) => {
  const original = await importOriginal<typeof import('@copiloto/core')>();
  return {
    ...original,
    listarIngresos: vi.fn(),
    obtenerResumenIngresos: vi.fn(),
    registrarIngreso: vi.fn(),
  };
});

import { listarIngresos, obtenerResumenIngresos, registrarIngreso, tomarPendiente } from '@copiloto/core';

import { IngresosScreen } from './IngresosScreen';

const mockListar = vi.mocked(listarIngresos);
const mockResumen = vi.mocked(obtenerResumenIngresos);
const mockRegistrar = vi.mocked(registrarIngreso);

describe('IngresosScreen — SM-P7 (dock del pie: la acción corre en el chat, no en el alta)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tomarPendiente();
    mockListar.mockResolvedValue({ status: 'ok', ingresos: [], total: '0.00' });
    mockResumen.mockResolvedValue({ status: 'ok', resumen: { periodo: '2026-09', total: '0.00', mesAnterior: null } });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('enviar texto desde el dock deja el pendiente y abre el chat — NO abre el alta ni guarda nada', async () => {
    const onAbrirChat = vi.fn();
    render(<IngresosScreen onAbrirChat={onAbrirChat} />);
    await screen.findByTestId('ingresos-nuevo');

    const campo = screen.getByPlaceholderText('Contale un cobro al copiloto…');
    fireEvent.change(campo, { target: { value: 'venta de pan dulce' } });
    fireEvent.keyDown(campo, { key: 'Enter' });

    expect(onAbrirChat).toHaveBeenCalledTimes(1);
    expect(tomarPendiente()).toBe('venta de pan dulce');
    expect(mockRegistrar).not.toHaveBeenCalled();
    expect(screen.queryByTestId('ingreso-concepto')).not.toBeInTheDocument();
  });

  it('el campo del dock se puede escribir: no está deshabilitado y tocarlo NO redirige', async () => {
    const onAbrirChat = vi.fn();
    render(<IngresosScreen onAbrirChat={onAbrirChat} />);
    await screen.findByTestId('ingresos-nuevo');

    const campo = screen.getByPlaceholderText('Contale un cobro al copiloto…');
    expect(campo).not.toBeDisabled();
    fireEvent.focus(campo);
    fireEvent.click(campo);

    expect(onAbrirChat).not.toHaveBeenCalled();
  });

  it('sin `onAbrirChat` no se monta el dock (no hay adónde llevar el texto)', async () => {
    render(<IngresosScreen />);
    await screen.findByTestId('ingresos-nuevo');

    expect(screen.queryByTestId('dock-funcion')).not.toBeInTheDocument();
  });

  it('«Anotar que me pagaron» sigue abriendo el alta EN BLANCO — el dock no le pisa el flujo manual', async () => {
    render(<IngresosScreen onAbrirChat={vi.fn()} />);
    await screen.findByTestId('ingresos-nuevo');

    fireEvent.click(screen.getByTestId('ingresos-nuevo'));

    expect(await screen.findByTestId('ingreso-concepto')).toHaveValue('');
  });
});
