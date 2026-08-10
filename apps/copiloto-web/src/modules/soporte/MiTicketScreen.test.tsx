import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@copiloto/core', async (importOriginal) => {
  const original = await importOriginal<typeof import('@copiloto/core')>();
  return { ...original, obtenerMiTicket: vi.fn() };
});

import { obtenerMiTicket, type MiTicketResult } from '@copiloto/core';

import { MiTicketScreen } from './MiTicketScreen';

const TICKET: MiTicketResult = {
  status: 'ok',
  ticket: {
    id: 7,
    codigo: 'SOP-0007',
    canal: 'soporte_tecnico',
    estado: 'respondido',
    asunto: 'No puedo emitir una factura',
    created_at: '2026-08-07T10:00:00Z',
    updated_at: '2026-08-10T09:00:00Z',
  },
  mensajes: [
    { id: 1, autor: 'usuario', texto: 'No me deja emitir', created_at: '2026-08-07T10:00:00Z' },
    { id: 2, autor: 'operador', texto: 'Ya lo revisamos, probá de nuevo', created_at: '2026-08-10T09:00:00Z' },
  ],
};

describe('MiTicketScreen (S6-11)', () => {
  beforeEach(() => {
    vi.mocked(obtenerMiTicket).mockReset();
  });

  it('muestra el código, el estado y el hilo COMPLETO en orden', async () => {
    vi.mocked(obtenerMiTicket).mockResolvedValue(TICKET);
    render(<MiTicketScreen ticketId={7} onVolver={() => {}} />);

    await waitFor(() => screen.getByTestId('mi-ticket-mensajes'));
    expect(screen.getByText('SOP-0007')).toBeInTheDocument();
    expect(screen.getByText('No puedo emitir una factura')).toBeInTheDocument();
    const mensajes = screen.getAllByTestId(/^mi-ticket-msj-/);
    expect(mensajes).toHaveLength(2);
    expect(mensajes[0]).toHaveTextContent('No me deja emitir');
    expect(mensajes[1]).toHaveTextContent('Ya lo revisamos, probá de nuevo');
  });

  it('`onVolver` se dispara al tocar el botón, sin pedir confirmación', async () => {
    vi.mocked(obtenerMiTicket).mockResolvedValue(TICKET);
    const onVolver = vi.fn();
    render(<MiTicketScreen ticketId={7} onVolver={onVolver} />);
    await waitFor(() => screen.getByTestId('mi-ticket-mensajes'));

    fireEvent.click(screen.getByTestId('mi-ticket-volver'));
    expect(onVolver).toHaveBeenCalledTimes(1);
  });

  it('`no_disponible` (endpoint todavía no desplegado) muestra un estado HONESTO, no un error', async () => {
    vi.mocked(obtenerMiTicket).mockResolvedValue({ status: 'no_disponible' });
    render(<MiTicketScreen ticketId={7} onVolver={() => {}} />);

    await waitFor(() => screen.getByTestId('mi-ticket-no-disponible'));
    expect(screen.queryByTestId('mi-ticket-error')).not.toBeInTheDocument();
  });

  it('`no_encontrado` (404 real) es un mensaje DISTINTO de `no_disponible`', async () => {
    vi.mocked(obtenerMiTicket).mockResolvedValue({ status: 'no_encontrado' });
    render(<MiTicketScreen ticketId={999} onVolver={() => {}} />);

    await waitFor(() => screen.getByTestId('mi-ticket-no-encontrado'));
    expect(screen.queryByTestId('mi-ticket-no-disponible')).not.toBeInTheDocument();
  });

  it('un rechazo inesperado cae en error, con reintento', async () => {
    vi.mocked(obtenerMiTicket).mockRejectedValue(new Error('boom'));
    render(<MiTicketScreen ticketId={7} onVolver={() => {}} />);

    await waitFor(() => screen.getByTestId('mi-ticket-error'));
    vi.mocked(obtenerMiTicket).mockResolvedValue(TICKET);
    fireEvent.click(screen.getByText('Reintentar'));
    await waitFor(() => screen.getByTestId('mi-ticket-mensajes'));
  });
});
