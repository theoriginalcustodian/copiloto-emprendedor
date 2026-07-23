/**
 * `ChatInteligencia` — la cáscara del chat de IN (§3.3). El cliente `preguntarInteligencia` se mockea
 * (partial, `...requireActual`) porque el endpoint todavía no está desplegado y es el único punto de
 * red. Lo que se fija acá son las tres cosas que un chat de datos no puede confundir:
 *  1. «todavía no está desplegado» (`no_disponible`) ≠ «el copiloto no supo qué contestar».
 *  2. una respuesta REAL vacía (`''`) se dice, no se pinta en blanco.
 *  3. un error de un endpoint desplegado-pero-fallando se muestra como error, no como ausencia.
 *
 * ⚠️ Todo `fireEvent`/`render` va con `await` — RNTL 14 + React 19 (ver `jest.config.js`).
 */
jest.mock('@copiloto/core', () => {
  const actual = jest.requireActual('@copiloto/core');
  return { ...actual, preguntarInteligencia: jest.fn() };
});

import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { preguntarInteligencia } from '@copiloto/core';

import { ChatInteligencia } from './ChatInteligencia';
import { ThemeProvider } from '../../theme/ThemeProvider';

const mockPreguntar = preguntarInteligencia as jest.MockedFunction<typeof preguntarInteligencia>;

async function montar() {
  return render(
    <ThemeProvider>
      <ChatInteligencia />
    </ThemeProvider>,
  );
}

async function preguntar(texto: string) {
  await fireEvent.changeText(screen.getByTestId('chat-composer'), texto);
  await fireEvent.press(screen.getByTestId('chat-enviar'));
}

beforeEach(() => {
  mockPreguntar.mockReset();
});

describe('ChatInteligencia — el camino bueno', () => {
  it('arranca con la invitación vacía y desaparece al preguntar', async () => {
    mockPreguntar.mockResolvedValue({ status: 'ok', respuesta: { respuesta: 'Gastaste $12.000 en nafta.', fuentes: [] } });
    await montar();

    expect(screen.getByTestId('chat-inteligencia-vacio')).toBeTruthy();

    await preguntar('¿cuánto gasté en nafta?');

    await waitFor(() => expect(screen.getByText('Gastaste $12.000 en nafta.')).toBeTruthy());
    expect(screen.getByText('¿cuánto gasté en nafta?')).toBeTruthy();
    expect(screen.queryByTestId('chat-inteligencia-vacio')).toBeNull();
    expect(mockPreguntar).toHaveBeenCalledWith('¿cuánto gasté en nafta?');
  });

  it('pinta las fuentes como chips debajo de la respuesta', async () => {
    mockPreguntar.mockResolvedValue({
      status: 'ok',
      respuesta: { respuesta: 'Te deben $30.000.', fuentes: [{ tipo: 'factura', ref: 'F-0006-00000015' }] },
    });
    await montar();
    await preguntar('¿quién me debe?');

    await waitFor(() => expect(screen.getByText('Te deben $30.000.')).toBeTruthy());
    expect(screen.getByText('factura · F-0006-00000015')).toBeTruthy();
  });
});

describe('ChatInteligencia — lo que NO confunde', () => {
  it('🔴 `no_disponible` dice «todavía no está disponible», NO una respuesta en blanco', async () => {
    mockPreguntar.mockResolvedValue({ status: 'no_disponible' });
    await montar();
    await preguntar('¿cómo vengo?');

    await waitFor(() => expect(screen.getByText(/todavía no está disponible/)).toBeTruthy());
  });

  it('🔴 una respuesta REAL vacía se dice «no tengo datos», no se pinta en blanco', async () => {
    // El par del anterior: el endpoint SÍ respondió, pero el grafo no tenía con qué. Es distinto de
    // «no está desplegado» y distinto de una burbuja vacía que se leería como un cuelgue.
    mockPreguntar.mockResolvedValue({ status: 'ok', respuesta: { respuesta: '   ', fuentes: [] } });
    await montar();
    await preguntar('¿cuánto facturé en 1999?');

    await waitFor(() => expect(screen.getByText(/no tengo datos para responder eso/)).toBeTruthy());
  });

  it('🔴 CONTROL — una respuesta real con texto SÍ se pinta tal cual', async () => {
    // Sin este control, un bug que reemplazara SIEMPRE por «no tengo datos» pasaría los dos de arriba.
    mockPreguntar.mockResolvedValue({ status: 'ok', respuesta: { respuesta: 'Facturaste $800.000.', fuentes: [] } });
    await montar();
    await preguntar('¿cuánto facturé?');

    await waitFor(() => expect(screen.getByText('Facturaste $800.000.')).toBeTruthy());
    expect(screen.queryByText(/no tengo datos/)).toBeNull();
  });

  it('🔴 un error de endpoint desplegado-pero-fallando se muestra como error, no como ausencia', async () => {
    // `preguntarInteligencia` propaga un 500 (no lo disfraza). Acá eso pinta el estado de error del
    // composer, no una burbuja de «todavía no está disponible».
    mockPreguntar.mockRejectedValue(new Error('boom 500'));
    await montar();
    await preguntar('¿cómo vengo?');

    await waitFor(() => expect(screen.getByTestId('composer-status')).toBeTruthy());
    expect(screen.queryByText(/todavía no está disponible/)).toBeNull();
  });
});
