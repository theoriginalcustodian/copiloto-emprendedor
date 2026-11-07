import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/** Partial mock: sólo la red — mismo arnés que `ClientesScreen.test.tsx`/`GastosScreen.test.tsx`. */
vi.mock('@copiloto/core', async (importOriginal) => {
  const original = await importOriginal<typeof import('@copiloto/core')>();
  return {
    ...original,
    dictarPorChat: vi.fn(),
    listarPresupuestos: vi.fn(),
    crearPresupuesto: vi.fn(),
  };
});

import { crearPresupuesto, listarPresupuestos, dictarPorChat, tomarPendiente } from '@copiloto/core';

import { PresupuestosScreen } from './PresupuestosScreen';

const mockListar = vi.mocked(listarPresupuestos);
const mockCrear = vi.mocked(crearPresupuesto);

describe('PresupuestosScreen — SM-P19 mitad A (dock del pie: el dictado prellena la función, sin chat)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tomarPendiente();
    mockListar.mockResolvedValue({ status: 'ok', presupuestos: [] });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('escribir en el dock prellena el alta EN la función (dictado) — sin chat, sin onAbrirChat, sin guardar nada', async () => {
    vi.mocked(dictarPorChat).mockResolvedValue({ status: 'ok', resultado: { destino: 'presupuesto', propuesta: { concepto: 'reforma del local', receptor: { nombre: 'Juan', docTipo: 99, docNro: '0', contacto: '' }, items: [] } } } as never);
    render(<PresupuestosScreen onFacturar={vi.fn()} />);
    await screen.findByTestId('presupuestos-nuevo');

    const campo = screen.getByPlaceholderText('Pedile un presupuesto al copiloto…');
    fireEvent.change(campo, { target: { value: 'reforma del local' } });
    fireEvent.keyDown(campo, { key: 'Enter' });

    expect(await screen.findByTestId('presupuesto-concepto')).toHaveValue('reforma del local');
    expect(dictarPorChat).toHaveBeenCalledWith(expect.objectContaining({ destino: 'presupuesto', texto: 'reforma del local' }), expect.anything());
    expect(tomarPendiente()).toBeFalsy();
    expect(mockCrear).not.toHaveBeenCalled();
  });

  it('el dictado NO depende del chat: sin onAbrirChat (chat sin hidratar) el dock está montado y no aparece CHAT_NO_LISTO', async () => {
    render(<PresupuestosScreen onFacturar={vi.fn()} />);
    await screen.findByTestId('presupuestos-nuevo');

    expect(screen.getByTestId('dock-funcion')).toBeInTheDocument();
    expect(screen.queryByText(/chat todavía no está listo/i)).not.toBeInTheDocument();
  });

  it('dictado sin card (respuesta sin sentido): avisa en el dock y NO abre un alta vacía', async () => {
    vi.mocked(dictarPorChat).mockResolvedValue({ status: 'sin_propuesta', motivo: 'respuesta_sin_card' } as never);
    render(<PresupuestosScreen onFacturar={vi.fn()} />);
    await screen.findByTestId('presupuestos-nuevo');

    const campo = screen.getByPlaceholderText('Pedile un presupuesto al copiloto…');
    fireEvent.change(campo, { target: { value: 'mmm' } });
    fireEvent.keyDown(campo, { key: 'Enter' });

    expect(await screen.findByText(/No alcancé a armar/)).toBeInTheDocument();
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
