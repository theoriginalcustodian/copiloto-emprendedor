import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

// Jest (jest-expo) -- describe/it/expect/jest son globales, no se importan de vitest.

jest.mock('../../adapters/almacen', () => ({
  almacenClave: {
    leer: jest.fn().mockResolvedValue(null),
    guardar: jest.fn().mockResolvedValue(undefined),
    borrar: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('@copiloto/core', () => {
  const actual = jest.requireActual('@copiloto/core');
  return {
    ...actual,
    apiReal: {
      ...actual.apiReal,
      sendChat: jest.fn(),
      getReply: jest.fn(),
    },
  };
});

import { apiReal as api } from '@copiloto/core';

import { ThemeProvider } from '../../theme/ThemeProvider';
import { ChatView } from './ChatView';

async function renderChatView() {
  return render(
    <ThemeProvider>
      <ChatView />
    </ThemeProvider>,
  );
}

describe('ChatView (integración lista+composer+useChat -- cáscara de texto, sin voz ni cliente activo)', () => {
  beforeEach(() => {
    jest.mocked(api.sendChat).mockReset();
    jest.mocked(api.getReply).mockReset();
    jest.mocked(api.getReply).mockResolvedValue({ replies: [], next_id: 0 });
  });

  it('monta sin props obligatorias y termina con el composer editable', async () => {
    await renderChatView();
    await waitFor(() => expect(screen.getByTestId('chat-composer').props.editable).toBe(true));
  });

  it('el composer manda un mensaje y aparece de forma optimista en la lista', async () => {
    // La red nunca resuelve: si el mensaje sólo apareciera tras el POST, esta promesa colgada lo
    // dejaría afuera de la pantalla para siempre -- prueba que el "optimista" es real.
    jest.mocked(api.sendChat).mockReturnValue(new Promise(() => {}));

    await renderChatView();
    await waitFor(() => expect(screen.getByTestId('chat-composer').props.editable).toBe(true));

    // `fireEvent` de esta versión es `async` -- awaitear cada uno evita que el `press` corra antes de
    // que React procese el `setState` del `changeText`.
    await fireEvent.changeText(screen.getByTestId('chat-composer'), 'hola copiloto');
    await fireEvent.press(screen.getByTestId('chat-enviar'));

    expect(await screen.findByText('hola copiloto')).toBeTruthy();
    expect(screen.getByTestId('chat-composer').props.value).toBe(''); // el composer se vacía al enviar
    await waitFor(() => expect(screen.getByTestId('composer-status')).toHaveTextContent('Trabajando…'));
  });

  it('no se puede enviar con el composer vacío o sólo espacios', async () => {
    await renderChatView();
    await waitFor(() => expect(screen.getByTestId('chat-composer').props.editable).toBe(true));

    await fireEvent.changeText(screen.getByTestId('chat-composer'), '   ');
    expect(screen.getByTestId('chat-enviar').props.accessibilityState?.disabled).toBe(true);

    await fireEvent.press(screen.getByTestId('chat-enviar'));
    expect(api.sendChat).not.toHaveBeenCalled();
  });

  it('el mensaje NUNCA manda cliente_id/alcance/modo -- ningún selector de cliente activo existe todavía', async () => {
    jest.mocked(api.sendChat).mockResolvedValue({ wf_id: 'wf-1', accepted: true });

    await renderChatView();
    await waitFor(() => expect(screen.getByTestId('chat-composer').props.editable).toBe(true));

    await fireEvent.changeText(screen.getByTestId('chat-composer'), 'hola copiloto');
    await fireEvent.press(screen.getByTestId('chat-enviar'));

    await waitFor(() => expect(api.sendChat).toHaveBeenCalled());
    const llamada = jest.mocked(api.sendChat).mock.calls.at(-1)?.[0];
    expect(llamada).toMatchObject({ text: 'hola copiloto', kind: 'text' });
    expect(llamada).not.toHaveProperty('cliente_id');
    expect(llamada).not.toHaveProperty('alcance');
    expect(llamada).not.toHaveProperty('modo');
  });

  it('una card con kind desconocido en la respuesta del agente no rompe la pantalla', async () => {
    jest.mocked(api.getReply).mockResolvedValueOnce({
      replies: [{ id: 1, text: 'ya lo vi', card: { kind: 'kind_del_futuro' } }],
      next_id: 1,
    });

    await renderChatView();

    expect(await screen.findByText('ya lo vi')).toBeTruthy();
    expect(screen.queryByTestId(/^tarjeta-/)).toBeNull();
  });

  it('confirmar un gate reenvía el value como kind:"callback"', async () => {
    jest.mocked(api.getReply).mockResolvedValueOnce({
      replies: [
        {
          id: 1,
          text: 'Vas a enviarle este mail a Juan. ¿Confirmás?',
          choices: [
            { label: 'Enviar', value: 'confirm' },
            { label: 'Cancelar', value: 'cancel' },
          ],
        },
      ],
      next_id: 1,
    });
    jest.mocked(api.sendChat).mockResolvedValue({ wf_id: 'wf-2', accepted: true });

    await renderChatView();
    await waitFor(() => expect(screen.getByTestId('tarjeta-confirmacion')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('tarjeta-confirmacion-confirmar'));

    await waitFor(() =>
      expect(api.sendChat).toHaveBeenCalledWith(expect.objectContaining({ text: 'confirm', kind: 'callback' })),
    );
  });

  // ─── DoD: el componente vive DENTRO del cristal del panel, que ya aporta el chrome ─────────────
  it('no pinta fondo propio -- el vidrio lo aporta el panel que lo monta', async () => {
    await renderChatView();
    await waitFor(() => expect(screen.getByTestId('chat-composer').props.editable).toBe(true));

    const estilos = [screen.getByTestId('chat-view').props.style].flat(Infinity);
    for (const e of estilos) {
      expect(e?.backgroundColor).toBeUndefined();
    }
  });
});
