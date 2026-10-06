jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn() } }));
jest.mock('@copiloto/core', () => {
  const actual = jest.requireActual('@copiloto/core');
  return { ...actual, registrarIngreso: jest.fn(), crearCliente: jest.fn() };
});

import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { crearCliente, registrarIngreso, type ChatMessage, type Cliente, type Ingreso } from '@copiloto/core';

import { ThemeProvider } from '../../theme/ThemeProvider';
import { ListaMensajes } from './ListaMensajes';

const registrarMock = registrarIngreso as jest.MockedFunction<typeof registrarIngreso>;
const crearMock = crearCliente as jest.MockedFunction<typeof crearCliente>;

/**
 * IDEMINGCLI — la COSTURA: `ListaMensajes` tiene que pasar `mensaje.id` a las tarjetas de ingreso y de
 * cliente, que lo reenvían al formulario para derivar la `idemKey`. Los tests de formulario ejercitan
 * sólo la prop; éste ejercita el camino real de la lista: si `ListaMensajes` deja de pasar `mensajeId`,
 * la clave vuelve a nacer por montaje y este test da ROJO aunque los formularios estén bien.
 */
describe('ListaMensajes — mensajeId llega a las cards de ingreso y cliente (IDEMINGCLI)', () => {
  beforeEach(() => {
    registrarMock.mockReset();
    crearMock.mockReset();
    registrarMock.mockResolvedValue({ status: 'ok', ingreso: { id: 1, monto: '85000.00' } as unknown as Ingreso });
    crearMock.mockResolvedValue({ status: 'ok', cliente: { id: 1, nombre: 'Panadería' } as unknown as Cliente });
  });

  it('una card de ingreso manda idemKey `ingreso:<mensaje.id>`, estable al remontar la lista', async () => {
    const mensajes: ChatMessage[] = [
      {
        id: 'assistant-ing-9',
        role: 'assistant',
        text: 'Entendí este ingreso.',
        card: { kind: 'ingreso_propuesto', data: { monto: '85000.00', medio: 'efectivo' } },
      },
    ];

    const primera = await render(
      <ThemeProvider>
        <ListaMensajes messages={mensajes} onChoice={jest.fn()} onResolverTarjeta={jest.fn()} />
      </ThemeProvider>,
    );
    fireEvent.press(screen.getByTestId('ingreso-propuesto-formulario-guardar'));
    await waitFor(() => expect(registrarMock).toHaveBeenCalled());
    await primera.unmount();

    // Remontar la lista (scroll, recarga del hilo) no puede cambiar el gesto de la card.
    await render(
      <ThemeProvider>
        <ListaMensajes messages={mensajes} onChoice={jest.fn()} onResolverTarjeta={jest.fn()} />
      </ThemeProvider>,
    );
    fireEvent.press(screen.getByTestId('ingreso-propuesto-formulario-guardar'));
    await waitFor(() => expect(registrarMock).toHaveBeenCalledTimes(2));

    expect(registrarMock.mock.calls[0]?.[0]?.idemKey).toBe('ingreso:assistant-ing-9');
    expect(registrarMock.mock.calls[1]?.[0]?.idemKey).toBe('ingreso:assistant-ing-9');
  });

  it('una card de cliente manda idemKey `cliente:<mensaje.id>` del alta', async () => {
    const mensajes: ChatMessage[] = [
      {
        id: 'assistant-cli-4',
        role: 'assistant',
        text: 'Entendí este cliente.',
        card: { kind: 'cliente_propuesto', data: { nombre: 'Panadería', origen: 'voz' } },
      },
    ];

    await render(
      <ThemeProvider>
        <ListaMensajes messages={mensajes} onChoice={jest.fn()} onResolverTarjeta={jest.fn()} />
      </ThemeProvider>,
    );
    fireEvent.press(screen.getByTestId('cliente-propuesto-formulario-guardar'));
    await waitFor(() => expect(crearMock).toHaveBeenCalled());

    expect(crearMock.mock.calls[0]?.[1]?.idemKey).toBe('cliente:assistant-cli-4');
  });
});
