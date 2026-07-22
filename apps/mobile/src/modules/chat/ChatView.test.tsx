import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

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
      sendAudio: jest.fn(),
      getReply: jest.fn(),
    },
  };
});

/** `deleteAsync` (`useChat.enviarAudio`, CERO retención) -- sin esto, F6 haría explotar cualquier
 *  test de este archivo apenas ChatView monta `useVozComando`/`useChat` en la misma sesión. */
jest.mock('expo-file-system/legacy', () => ({
  deleteAsync: jest.fn().mockResolvedValue(undefined),
}));

/**
 * Override LOCAL de `react-native-reanimated`: el mock GLOBAL (`jest.setup.js`) no exporta
 * `SlideInDown`/`SlideOutDown` porque, hasta F6, nada en el árbol de `ChatView` los usaba.
 * `GlassGrabacionCopiloto` sí (la entrada/salida del HUD de voz) -- sin este override, CUALQUIER test
 * que abra el HUD revienta con "Cannot read properties of undefined (reading 'duration')". El resto
 * de la superficie mockeada es idéntica a la global (documentado ahí mismo, "los tests que necesitan
 * controlar X declaran su propio jest.mock").
 */
jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  const entradaSalida = { duration: () => ({}) };
  return {
    __esModule: true,
    default: { View, createAnimatedComponent: (Comp: unknown) => Comp },
    createAnimatedComponent: (Comp: unknown) => Comp,
    useSharedValue: (inicial: unknown) => ({ value: inicial }),
    useAnimatedStyle: () => ({}),
    withTiming: (destino: unknown) => destino,
    withSpring: (destino: unknown) => destino,
    runOnJS: (fn: unknown) => fn,
    Extrapolation: { CLAMP: 'clamp' },
    interpolate: (x: unknown) => x,
    Easing: { bezier: () => () => 0, out: (fn: unknown) => fn, ease: () => 0 },
    SlideInDown: entradaSalida,
    SlideOutDown: entradaSalida,
  };
});

/**
 * Override LOCAL de `expo-audio`: el mock GLOBAL le falta `getStatus`/`pause` (documentado en
 * `jest.setup.js`) -- suficiente para que importar la lib no explote, insuficiente para ejercitar una
 * grabación de verdad. `useVozComando.test.ts` ya prueba la máquina de fases a fondo con su propio
 * mock; acá sólo hace falta lo mínimo para que tocar `BotonVoz` abra el HUD sin crashear.
 */
const mockGrabadorVoz = {
  prepareToRecordAsync: jest.fn().mockResolvedValue(undefined),
  record: jest.fn(),
  pause: jest.fn(),
  stop: jest.fn().mockResolvedValue(undefined),
  getStatus: jest.fn(() => ({ durationMillis: 0, metering: -60 })),
  uri: null as string | null,
};
// Expuesto aparte (y no inline en el factory) para que el test de permiso denegado pueda pisarlo con
// `mockResolvedValueOnce({granted:false})` sin tocar el resto de la suite.
const mockRequestRecordingPermissionsAsync = jest.fn().mockResolvedValue({ granted: true });
jest.mock('expo-audio', () => ({
  RecordingPresets: { HIGH_QUALITY: {} },
  useAudioRecorder: () => mockGrabadorVoz,
  requestRecordingPermissionsAsync: (...args: unknown[]) => mockRequestRecordingPermissionsAsync(...args),
  setAudioModeAsync: jest.fn().mockResolvedValue(undefined),
}));

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

describe('ChatView (integración lista+composer+useChat -- cáscara de texto, sin cliente activo)', () => {
  beforeEach(() => {
    jest.mocked(api.sendChat).mockReset();
    jest.mocked(api.sendAudio).mockReset();
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

describe('ChatView -- voz-comando (F6): BotonVoz + GlassGrabacionCopiloto', () => {
  beforeEach(() => {
    jest.mocked(api.sendChat).mockReset();
    jest.mocked(api.sendAudio).mockReset();
    jest.mocked(api.getReply).mockReset();
    jest.mocked(api.getReply).mockResolvedValue({ replies: [], next_id: 0 });
    mockRequestRecordingPermissionsAsync.mockReset().mockResolvedValue({ granted: true });
    mockGrabadorVoz.uri = null;
  });

  it('tocar el botón de voz abre el HUD de grabación', async () => {
    await renderChatView();
    await waitFor(() => expect(screen.getByTestId('chat-composer').props.editable).toBe(true));

    await fireEvent.press(screen.getByTestId('boton-voz'));

    await waitFor(() => expect(screen.getByTestId('glass-grabacion-copiloto')).toBeTruthy());
    expect(screen.getByTestId('hud-copiloto')).toBeTruthy();
  });

  it('Descartar cierra el HUD sin llamar a sendAudio -- es la única vía legítima de perder el audio', async () => {
    await renderChatView();
    await waitFor(() => expect(screen.getByTestId('chat-composer').props.editable).toBe(true));

    await fireEvent.press(screen.getByTestId('boton-voz'));
    await waitFor(() => expect(screen.getByTestId('glass-grabacion-copiloto')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('copiloto-descartar'));

    await waitFor(() => expect(screen.queryByTestId('glass-grabacion-copiloto')).toBeNull());
    expect(api.sendAudio).not.toHaveBeenCalled();
  });

  it('permiso de micrófono denegado: aviso legible, sin crash ni HUD', async () => {
    mockRequestRecordingPermissionsAsync.mockResolvedValueOnce({ granted: false });
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);

    await renderChatView();
    await waitFor(() => expect(screen.getByTestId('chat-composer').props.editable).toBe(true));

    await fireEvent.press(screen.getByTestId('boton-voz'));

    await waitFor(() => expect(alertSpy).toHaveBeenCalledTimes(1));
    expect(alertSpy.mock.calls[0]?.[0]).toBe('Sin acceso al micrófono');
    expect(screen.queryByTestId('glass-grabacion-copiloto')).toBeNull();

    alertSpy.mockRestore();
  });
});
