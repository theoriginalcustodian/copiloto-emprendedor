import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/** Partial mock: sólo la red — mismo arnés que `ClientesScreen.test.tsx`/`GastosScreen.test.tsx`. */
vi.mock('@copiloto/core', async (importOriginal) => {
  const original = await importOriginal<typeof import('@copiloto/core')>();
  return {
    ...original,
    listarPresupuestos: vi.fn(),
    crearPresupuesto: vi.fn(),
  };
});

import { crearPresupuesto, listarPresupuestos, tomarPendiente } from '@copiloto/core';

import { PresupuestosScreen } from './PresupuestosScreen';

const mockListar = vi.mocked(listarPresupuestos);
const mockCrear = vi.mocked(crearPresupuesto);

describe('PresupuestosScreen — SM-P7 (dock del pie: la acción corre en el chat, no en el alta)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tomarPendiente();
    mockListar.mockResolvedValue({ status: 'ok', presupuestos: [] });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('enviar texto desde el dock deja el pendiente y abre el chat — NO abre el alta ni guarda nada', async () => {
    const onAbrirChat = vi.fn();
    render(<PresupuestosScreen onFacturar={vi.fn()} onAbrirChat={onAbrirChat} />);
    await screen.findByTestId('presupuestos-nuevo');

    const campo = screen.getByPlaceholderText('Pedile un presupuesto al copiloto…');
    fireEvent.change(campo, { target: { value: 'reforma del local' } });
    fireEvent.keyDown(campo, { key: 'Enter' });

    expect(onAbrirChat).toHaveBeenCalledTimes(1);
    expect(tomarPendiente()).toBe('reforma del local');
    expect(mockCrear).not.toHaveBeenCalled();
    expect(screen.queryByTestId('presupuesto-concepto')).not.toBeInTheDocument();
  });

  it('el campo del dock se puede escribir: no está deshabilitado y tocarlo NO redirige', async () => {
    const onAbrirChat = vi.fn();
    render(<PresupuestosScreen onFacturar={vi.fn()} onAbrirChat={onAbrirChat} />);
    await screen.findByTestId('presupuestos-nuevo');

    const campo = screen.getByPlaceholderText('Pedile un presupuesto al copiloto…');
    expect(campo).not.toBeDisabled();
    fireEvent.focus(campo);
    fireEvent.click(campo);

    expect(onAbrirChat).not.toHaveBeenCalled();
  });

  it('sin `onAbrirChat` no se monta el dock (no hay adónde llevar el texto)', async () => {
    render(<PresupuestosScreen onFacturar={vi.fn()} />);
    await screen.findByTestId('presupuestos-nuevo');

    expect(screen.queryByTestId('dock-funcion')).not.toBeInTheDocument();
  });

  it('«Nuevo presupuesto» sigue abriendo el alta EN BLANCO, nunca una corrección — el dock no le pisa el flujo manual', async () => {
    render(<PresupuestosScreen onFacturar={vi.fn()} onAbrirChat={vi.fn()} />);
    await screen.findByTestId('presupuestos-nuevo');

    fireEvent.click(screen.getByTestId('presupuestos-nuevo'));

    expect(await screen.findByTestId('presupuesto-concepto')).toHaveValue('');
    expect(screen.queryByTestId('presupuesto-aviso-correccion')).not.toBeInTheDocument();
  });

  it('contrato foco-en-BODY: al abrir el alta el foco cae en el PRIMER campo editable, no en BODY', async () => {
    render(<PresupuestosScreen onFacturar={vi.fn()} onAbrirChat={vi.fn()} />);
    await screen.findByTestId('presupuestos-nuevo');

    fireEvent.click(screen.getByTestId('presupuestos-nuevo'));

    const concepto = await screen.findByTestId('presupuesto-concepto');
    expect(document.activeElement).toBe(concepto);
  });
});
