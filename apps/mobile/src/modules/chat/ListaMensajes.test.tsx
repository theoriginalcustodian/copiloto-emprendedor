import { fireEvent, render, screen } from '@testing-library/react-native';

// Jest (jest-expo) -- describe/it/expect/jest son globales, no se importan de vitest.

/** `TarjetaClientePropuesto` importa `empujarUnaVez`, que toca `expo-router`. */
jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn() } }));

import type { ChatMessage } from '@copiloto/core';

import { ThemeProvider } from '../../theme/ThemeProvider';
import { ListaMensajes } from './ListaMensajes';

// `render` de esta versión de @testing-library/react-native es `async` -- hay que awaitearlo.
async function envolver(messages: ChatMessage[], onChoice = jest.fn()) {
  await render(
    <ThemeProvider>
      <ListaMensajes messages={messages} onChoice={onChoice} />
    </ThemeProvider>,
  );
  return { onChoice };
}

describe('ListaMensajes', () => {
  it('el estado vacío muestra la marca y el texto de bienvenida', async () => {
    await envolver([]);

    expect(screen.getByTestId('chat-vacio')).toBeTruthy();
    expect(screen.getByText('¿En qué te ayudo?')).toBeTruthy();
  });

  it('un mensaje de usuario se renderiza como burbuja simple', async () => {
    const mensajes: ChatMessage[] = [{ id: 'user-1', role: 'user', text: 'hola copiloto' }];

    await envolver(mensajes);

    expect(screen.getByText('hola copiloto')).toBeTruthy();
    expect(screen.queryByTestId('tarjeta-confirmacion')).toBeNull();
  });

  it('el gate de confirmación (par confirmar/cancelar) se renderiza como tarjeta, no como burbuja', async () => {
    const mensajes: ChatMessage[] = [
      {
        id: 'assistant-1',
        role: 'assistant',
        text: 'Vas a enviarle este mail a Juan. ¿Confirmás?',
        choices: [
          { label: 'Enviar', value: 'confirm' },
          { label: 'Cancelar', value: 'cancel' },
        ],
      },
    ];

    await envolver(mensajes);

    expect(screen.getByTestId('tarjeta-confirmacion')).toBeTruthy();
    expect(screen.getByText('Vas a enviarle este mail a Juan. ¿Confirmás?')).toBeTruthy();
  });

  it('confirmar manda el value de confirmar, sin payload -- es de sólo lectura, no se edita nada', async () => {
    const mensajes: ChatMessage[] = [
      {
        id: 'assistant-1',
        role: 'assistant',
        text: 'Vas a cobrar $500 por MercadoPago. ¿Confirmás?',
        choices: [
          { label: 'Cobrar', value: 'confirm' },
          { label: 'Cancelar', value: 'cancel' },
        ],
      },
    ];
    const { onChoice } = await envolver(mensajes);

    await fireEvent.press(screen.getByTestId('tarjeta-confirmacion-confirmar'));

    expect(onChoice).toHaveBeenCalledWith('confirm');
  });

  it('cancelar manda el value de cancelar', async () => {
    const mensajes: ChatMessage[] = [
      {
        id: 'assistant-1',
        role: 'assistant',
        text: 'Vas a publicar en Instagram. ¿Confirmás?',
        choices: [
          { label: 'Publicar', value: 'confirm' },
          { label: 'Cancelar', value: 'cancel' },
        ],
      },
    ];
    const { onChoice } = await envolver(mensajes);

    await fireEvent.press(screen.getByTestId('tarjeta-confirmacion-cancelar'));

    expect(onChoice).toHaveBeenCalledWith('cancel');
  });

  it('🔴 un `cliente_propuesto` se renderiza como CARD editable, no como burbuja', async () => {
    // La card no lleva `choices`, así que `mapearGate` la ignora: sin este cableado caería en
    // `Burbuja` y el emprendedor vería el texto del copiloto y ningún lugar donde corregir el nombre.
    const mensajes: ChatMessage[] = [
      {
        id: 'assistant-1',
        role: 'assistant',
        text: 'Entendí este cliente.',
        card: {
          kind: 'cliente_propuesto',
          data: { nombre: 'Ferretería El Tornillo', doc_tipo: 80, doc_nro: '30712345678', origen: 'voz' },
        },
      },
    ];

    await envolver(mensajes);

    expect(screen.getByTestId('cliente-propuesto')).toBeTruthy();
    expect(screen.getByTestId('cliente-propuesto-formulario')).toBeTruthy();
    expect(screen.queryByText('Entendí este cliente.')).toBeNull();
  });

  it('una `cliente_propuesto` SIN nombre no pinta un formulario vacío — cae en burbuja', async () => {
    // Pedirle que tipee desde cero lo que ya dictó es peor que mostrarle el texto del copiloto.
    const mensajes: ChatMessage[] = [
      {
        id: 'assistant-1',
        role: 'assistant',
        text: 'No entendí el nombre.',
        card: { kind: 'cliente_propuesto', data: { nombre: null, origen: 'voz' } },
      },
    ];

    await envolver(mensajes);

    expect(screen.queryByTestId('cliente-propuesto')).toBeNull();
    expect(screen.getByText('No entendí el nombre.')).toBeTruthy();
  });

  it('una card con kind desconocido en un mensaje sin gate no rompe la pantalla', async () => {
    const mensajes: ChatMessage[] = [
      { id: 'assistant-1', role: 'assistant', text: 'todo bien', card: { kind: 'algo_futuro' } },
    ];

    await envolver(mensajes); // si algo rompiera, esto rechazaría la promesa.

    expect(screen.getByText('todo bien')).toBeTruthy();
    expect(screen.queryByTestId('tarjeta-confirmacion')).toBeNull();
  });

  it('un choices que NO es el par confirmar/cancelar no tiene UI dedicada -- se ve el texto igual', async () => {
    const mensajes: ChatMessage[] = [
      {
        id: 'assistant-1',
        role: 'assistant',
        text: '¿Cuál de estos clientes?',
        choices: [
          { label: 'Ana', value: 'ana' },
          { label: 'Beto', value: 'beto' },
          { label: 'Carla', value: 'carla' },
        ],
      },
    ];

    await envolver(mensajes);

    expect(screen.getByText('¿Cuál de estos clientes?')).toBeTruthy();
    expect(screen.queryByTestId('tarjeta-confirmacion')).toBeNull();
  });
});
