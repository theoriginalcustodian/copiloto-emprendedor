/**
 * `PreguntarInteligencia` (BL-X3) — la pregunta libre ya NO se contesta en un mini-chat propio: se deja
 * como mensaje pendiente y se vuelve al chat principal durable, que la envía al enfocar.
 *
 * ⚠️ Todo `fireEvent`/`render` va con `await` — RNTL 14 + React 19 (ver `jest.config.js`).
 */
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn() },
}));

import { router } from 'expo-router';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { PreguntarInteligencia } from './PreguntarInteligencia';
import { tomarPendiente } from '../chat/mensajePendiente';
import { ThemeProvider } from '../../theme/ThemeProvider';

async function montar() {
  return render(
    <ThemeProvider>
      <PreguntarInteligencia />
    </ThemeProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  tomarPendiente();
});

describe('PreguntarInteligencia', () => {
  it('enviar deja la pregunta pendiente para el chat principal y vuelve a él', async () => {
    await montar();
    await fireEvent.changeText(screen.getByTestId('chat-composer'), '  ¿cuánto gasté este mes?  ');
    await fireEvent.press(screen.getByTestId('chat-enviar'));

    expect(router.back).toHaveBeenCalledTimes(1);
    expect(tomarPendiente()).toBe('¿cuánto gasté este mes?');
  });

  it('sin texto no deja nada pendiente ni navega', async () => {
    await montar();
    await fireEvent.press(screen.getByTestId('chat-enviar'));

    expect(router.back).not.toHaveBeenCalled();
    expect(tomarPendiente()).toBeNull();
  });

  it('no hay mini-chat: no se pinta ninguna burbuja ni «pensando»', async () => {
    await montar();
    expect(screen.getByTestId('preguntar-inteligencia-vacio')).toBeTruthy();
    expect(screen.queryByTestId('chat-inteligencia')).toBeNull();
  });
});
