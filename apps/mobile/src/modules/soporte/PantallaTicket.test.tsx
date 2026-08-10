import { render, screen, waitFor } from '@testing-library/react-native';

/** Partial mock: sólo la red, mismo criterio que `PantallaClientes.test.tsx`. */
jest.mock('@copiloto/core', () => {
  const actual = jest.requireActual('@copiloto/core');
  return { ...actual, obtenerMiTicket: jest.fn() };
});

import { obtenerMiTicket } from '@copiloto/core';
import type { MiTicketResult } from '@copiloto/core';

import { ThemeProvider } from '../../theme/ThemeProvider';
import { PantallaTicket } from './PantallaTicket';

const mockObtener = obtenerMiTicket as jest.MockedFunction<typeof obtenerMiTicket>;

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

async function montar(ticketId = 7) {
  return render(
    <ThemeProvider>
      <PantallaTicket ticketId={ticketId} />
    </ThemeProvider>,
  );
}

describe('PantallaTicket (S6-11)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('pide el ticket por SU id, y muestra el hilo COMPLETO en orden', async () => {
    mockObtener.mockResolvedValue(TICKET);
    await montar(7);

    await waitFor(() => screen.getByTestId('ticket-msj-1'));
    expect(mockObtener).toHaveBeenCalledWith(7);
    expect(screen.getByTestId('ticket-msj-1-texto')).toHaveTextContent('No me deja emitir');
    expect(screen.getByTestId('ticket-msj-2-texto')).toHaveTextContent('Ya lo revisamos, probá de nuevo');
  });

  it('`no_disponible` (endpoint todavía no desplegado) es un estado HONESTO', async () => {
    mockObtener.mockResolvedValue({ status: 'no_disponible' });
    await montar(7);

    await waitFor(() => screen.getByTestId('ticket-no-disponible'));
  });

  it('`no_encontrado` (404 real) es un mensaje DISTINTO de `no_disponible`', async () => {
    mockObtener.mockResolvedValue({ status: 'no_encontrado' });
    await montar(999);

    await waitFor(() => screen.getByTestId('ticket-no-encontrado'));
  });
});
