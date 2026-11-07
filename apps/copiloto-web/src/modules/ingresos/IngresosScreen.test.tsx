import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/** Partial mock: sólo la red — mismo arnés que `ClientesScreen.test.tsx`/`GastosScreen.test.tsx`. */
vi.mock('@copiloto/core', async (importOriginal) => {
  const original = await importOriginal<typeof import('@copiloto/core')>();
  return {
    ...original,
    dictarPorChat: vi.fn(),
    listarIngresos: vi.fn(),
    obtenerResumenIngresos: vi.fn(),
    registrarIngreso: vi.fn(),
  };
});

import { listarIngresos, obtenerResumenIngresos, registrarIngreso, dictarPorChat, tomarPendiente } from '@copiloto/core';

import { IngresosScreen } from './IngresosScreen';

const mockListar = vi.mocked(listarIngresos);
const mockResumen = vi.mocked(obtenerResumenIngresos);
const mockRegistrar = vi.mocked(registrarIngreso);

describe('IngresosScreen — SM-P19 mitad A (dock del pie: el dictado prellena la función, sin chat)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tomarPendiente();
    mockListar.mockResolvedValue({ status: 'ok', ingresos: [], total: '0.00' });
    mockResumen.mockResolvedValue({ status: 'ok', resumen: { periodo: '2026-09', total: '0.00', mesAnterior: null } });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('escribir en el dock prellena el alta EN la función (dictado) — sin chat, sin onAbrirChat, sin guardar nada', async () => {
    vi.mocked(dictarPorChat).mockResolvedValue({ status: 'ok', resultado: { destino: 'ingreso', propuesta: { monto: '1500.00', clienteNombre: 'Panadería', medio: null, concepto: 'venta de pan dulce', fecha: '' } } } as never);
    render(<IngresosScreen />);
    await screen.findByTestId('ingresos-nuevo');

    const campo = screen.getByPlaceholderText('Contale un cobro al copiloto…');
    fireEvent.change(campo, { target: { value: 'venta de pan dulce' } });
    fireEvent.keyDown(campo, { key: 'Enter' });

    expect(await screen.findByTestId('ingreso-concepto')).toHaveValue('venta de pan dulce');
    expect(dictarPorChat).toHaveBeenCalledWith(expect.objectContaining({ destino: 'ingreso', texto: 'venta de pan dulce' }), expect.anything());
    expect(tomarPendiente()).toBeFalsy();
    expect(mockRegistrar).not.toHaveBeenCalled();
  });

  it('el dictado NO depende del chat: sin onAbrirChat (chat sin hidratar) el dock está montado y no aparece CHAT_NO_LISTO', async () => {
    render(<IngresosScreen />);
    await screen.findByTestId('ingresos-nuevo');

    expect(screen.getByTestId('dock-funcion')).toBeInTheDocument();
    expect(screen.queryByText(/chat todavía no está listo/i)).not.toBeInTheDocument();
  });

  it('dictado sin card (respuesta sin sentido): avisa en el dock y NO abre un alta vacía', async () => {
    vi.mocked(dictarPorChat).mockResolvedValue({ status: 'sin_propuesta', motivo: 'respuesta_sin_card' } as never);
    render(<IngresosScreen />);
    await screen.findByTestId('ingresos-nuevo');

    const campo = screen.getByPlaceholderText('Contale un cobro al copiloto…');
    fireEvent.change(campo, { target: { value: 'mmm' } });
    fireEvent.keyDown(campo, { key: 'Enter' });

    expect(await screen.findByText(/No alcancé a armar/)).toBeInTheDocument();
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

  it('«Anotar que me pagaron» sigue abriendo el alta EN BLANCO — el dock no le pisa el flujo manual', async () => {
    render(<IngresosScreen onAbrirChat={vi.fn()} />);
    await screen.findByTestId('ingresos-nuevo');

    fireEvent.click(screen.getByTestId('ingresos-nuevo'));

    expect(await screen.findByTestId('ingreso-concepto')).toHaveValue('');
  });
});
