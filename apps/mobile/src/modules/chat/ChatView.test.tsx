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

/** `ChatView` lee `useSession()` para scopear el chat por tenant (hallazgo 2026-07-23, cross-tenant
 *  leak) -- fuera de `<SessionProvider>` (que vive en `_layout.tsx`, no en este árbol de test) el hook
 *  real explota. Fijo un `cliente_id` estable; no es lo que este archivo prueba. */
jest.mock('../auth/useSession', () => ({
  useSession: () => ({ me: { cliente_id: 'cli-chatview-test', email: 'usuario@copiloto.test' } }),
}));

/** `leerPerfilNegocio` mockeado — `IndicadorModoCeremonia` la llama al montar (vía `useFocusEffect`,
 *  passthrough en `jest.setup.js`); sin mock intentaría un `fetch` real en cada test de este archivo,
 *  que no es lo que ninguno de ellos prueba. `no_disponible` deja el indicador en su default
 *  fail-closed ("Pedir confirmación"), invisible para las aserciones existentes. */
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
    leerPerfilNegocio: jest.fn().mockResolvedValue({ status: 'no_disponible' }),
  };
});

/** `deleteAsync` (`useChat.enviarAudio`, CERO retención) -- sin esto, F6 haría explotar cualquier
 *  test de este archivo apenas ChatView monta `useVozComando`/`useChat` en la misma sesión. */
jest.mock('expo-file-system/legacy', () => ({
  deleteAsync: jest.fn().mockResolvedValue(undefined),
}));

/**
 * `BotonVoz`/`ControlesFlotantes` MOCKEADOS acá -- no en general, sólo en este archivo de
 * integración. `GestureDetector` está mockeado GLOBAL a passthrough (`jest.setup.js`: "no
 * ejercitamos el gesto -- se valida en el device"), así que el `BotonVoz` REAL no tiene ningún
 * `Pressable`/`onPress` que `fireEvent.press` pueda disparar -- el gesto entero (mantener/deslizar/
 * soltar) es intocable desde jsdom. Lo que ESTE archivo prueba no es el gesto (ya cubierto por
 * `BotonVoz.test.tsx` a nivel render + por `useVozComando.test.ts` a nivel máquina de fases): es el
 * CABLEADO de `ChatView` -- qué le pasa a `voz`/`fijado`/`enviarAudio` cuando cada callback dispara.
 * Los stand-ins exponen un `Pressable` por callback, wireados a las MISMAS props que el componente
 * real recibiría de un gesto real.
 */
jest.mock('./BotonVoz', () => {
  const { Pressable, Text } = require('react-native');
  return {
    BotonVoz: ({ onIniciar, onSoltarSinFijar, onFijar, disabled }: any) => (
      <>
        <Pressable testID="boton-voz" disabled={disabled} onPress={onIniciar}>
          <Text>mic</Text>
        </Pressable>
        <Pressable testID="boton-voz-fijar-test" onPress={onFijar}>
          <Text>fijar (mock del deslizar)</Text>
        </Pressable>
        <Pressable testID="boton-voz-soltar-test" onPress={onSoltarSinFijar}>
          <Text>soltar sin fijar (mock)</Text>
        </Pressable>
      </>
    ),
  };
});
jest.mock('./ControlesFlotantes', () => {
  const { Pressable, Text } = require('react-native');
  return {
    ControlesFlotantes: ({ fase, alPausar, alReanudar, alEnviar, alEliminar }: any) => (
      <>
        <Text testID="controles-flotantes-fase">{fase}</Text>
        <Pressable testID="voz-pausar" onPress={alPausar}>
          <Text>Pausar</Text>
        </Pressable>
        <Pressable testID="voz-reanudar" onPress={alReanudar}>
          <Text>Reanudar</Text>
        </Pressable>
        <Pressable testID="voz-enviar" onPress={alEnviar}>
          <Text>Enviar</Text>
        </Pressable>
        <Pressable testID="voz-eliminar" onPress={alEliminar}>
          <Text>Eliminar</Text>
        </Pressable>
      </>
    ),
  };
});

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

describe('ChatView -- voz-comando (F6): hold-graba / soltar-envía / deslizar-fija, SIN glass', () => {
  beforeEach(() => {
    jest.mocked(api.sendChat).mockReset();
    jest.mocked(api.sendAudio).mockReset();
    jest.mocked(api.sendAudio).mockResolvedValue({ replies: [], next_id: 0 } as any);
    jest.mocked(api.getReply).mockReset();
    jest.mocked(api.getReply).mockResolvedValue({ replies: [], next_id: 0 });
    mockRequestRecordingPermissionsAsync.mockReset().mockResolvedValue({ granted: true });
    mockGrabadorVoz.uri = null;
  });

  it('mantener apretado (mock: tocar el botón) arranca -- SIN glass, con la onda flotante', async () => {
    await renderChatView();
    await waitFor(() => expect(screen.getByTestId('chat-composer').props.editable).toBe(true));

    await fireEvent.press(screen.getByTestId('boton-voz'));

    await waitFor(() => expect(screen.getByTestId('onda-flotante')).toBeTruthy());
    // No hay glass: ni el HUD viejo, ni ningún `MarcoGlass` de por medio -- el botón sigue de pie.
    expect(screen.queryByTestId('glass-grabacion-copiloto')).toBeNull();
    expect(screen.getByTestId('boton-voz')).toBeTruthy();
    // Sin fijar todavía: los controles flotantes no existen.
    expect(screen.queryByTestId('voz-enviar')).toBeNull();
  });

  it('deslizar hacia arriba (mock: onFijar) muestra los controles flotantes y esconde el botón', async () => {
    await renderChatView();
    await waitFor(() => expect(screen.getByTestId('chat-composer').props.editable).toBe(true));
    await fireEvent.press(screen.getByTestId('boton-voz'));
    await waitFor(() => expect(screen.getByTestId('onda-flotante')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('boton-voz-fijar-test'));

    await waitFor(() => expect(screen.getByTestId('voz-enviar')).toBeTruthy());
    expect(screen.getByTestId('voz-pausar')).toBeTruthy();
    expect(screen.getByTestId('voz-eliminar')).toBeTruthy();
    // La onda sigue -- es el ÚNICO feedback, contrato §1: "sin contador, la onda flotante".
    expect(screen.getByTestId('onda-flotante')).toBeTruthy();
    // El botón de mantener-apretado ya no está: los controles flotantes tomaron el mando.
    expect(screen.queryByTestId('boton-voz')).toBeNull();
  });

  it('🔴 fijado: soltar el dedo (mock: onSoltarSinFijar) NO hace nada -- se termina por Enviar/Eliminar', async () => {
    await renderChatView();
    await waitFor(() => expect(screen.getByTestId('chat-composer').props.editable).toBe(true));
    await fireEvent.press(screen.getByTestId('boton-voz'));
    await fireEvent.press(screen.getByTestId('boton-voz-fijar-test'));
    await waitFor(() => expect(screen.getByTestId('voz-enviar')).toBeTruthy());

    // El mock de "soltar" ya no está montado (el botón se ocultó al fijar) -- soltar el dedo
    // literalmente no tiene ningún control al que llegarle, que es la MISMA garantía que el contrato
    // pide ("ya NO detiene"): no hay callback de soltar disponible una vez fijado.
    expect(screen.queryByTestId('boton-voz-soltar-test')).toBeNull();
    expect(api.sendAudio).not.toHaveBeenCalled();
  });

  it('soltar SIN fijar envía directo -- corta, sube, entra como mensaje', async () => {
    mockGrabadorVoz.uri = 'file:///cache/voz.m4a';
    await renderChatView();
    await waitFor(() => expect(screen.getByTestId('chat-composer').props.editable).toBe(true));
    await fireEvent.press(screen.getByTestId('boton-voz'));
    await waitFor(() => expect(screen.getByTestId('onda-flotante')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('boton-voz-soltar-test'));

    await waitFor(() => expect(api.sendAudio).toHaveBeenCalledTimes(1));
    // Vuelve al estado inicial -- ni glass, ni controles, ni onda.
    await waitFor(() => expect(screen.queryByTestId('onda-flotante')).toBeNull());
    expect(screen.queryByTestId('voz-enviar')).toBeNull();
  });

  it('fijado, Enviar -- mismo camino que soltar-sin-fijar (una sola función "mandar")', async () => {
    mockGrabadorVoz.uri = 'file:///cache/voz.m4a';
    await renderChatView();
    await waitFor(() => expect(screen.getByTestId('chat-composer').props.editable).toBe(true));
    await fireEvent.press(screen.getByTestId('boton-voz'));
    await fireEvent.press(screen.getByTestId('boton-voz-fijar-test'));
    await waitFor(() => expect(screen.getByTestId('voz-enviar')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('voz-enviar'));

    await waitFor(() => expect(api.sendAudio).toHaveBeenCalledTimes(1));
    // `fijado` se resetea solo cuando `voz.fase` vuelve a `inactivo`: el botón de mantener vuelve.
    await waitFor(() => expect(screen.getByTestId('boton-voz')).toBeTruthy());
    expect(screen.queryByTestId('voz-enviar')).toBeNull();
  });

  it('fijado, Eliminar -- cierra sin llamar a sendAudio, la única vía legítima de perder el audio', async () => {
    mockGrabadorVoz.uri = 'file:///cache/voz.m4a';
    await renderChatView();
    await waitFor(() => expect(screen.getByTestId('chat-composer').props.editable).toBe(true));
    await fireEvent.press(screen.getByTestId('boton-voz'));
    await fireEvent.press(screen.getByTestId('boton-voz-fijar-test'));
    await waitFor(() => expect(screen.getByTestId('voz-eliminar')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('voz-eliminar'));

    await waitFor(() => expect(screen.queryByTestId('voz-enviar')).toBeNull());
    expect(api.sendAudio).not.toHaveBeenCalled();
    expect(screen.getByTestId('boton-voz')).toBeTruthy();
  });

  it('permiso de micrófono denegado: aviso legible, sin crash ni controles', async () => {
    // 🔴 `mockResolvedValue` (persistente), NO `...Once`: con el pre-warm (useVozComando §2.bis) el
    // permiso se consulta YA al montar (precalentar), no recién al tocar el botón — un mock de un
    // solo uso lo consumiría el montaje y el press vería el default (`granted: true`) del `beforeEach`.
    mockRequestRecordingPermissionsAsync.mockResolvedValue({ granted: false });
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);

    await renderChatView();
    await waitFor(() => expect(screen.getByTestId('chat-composer').props.editable).toBe(true));

    await fireEvent.press(screen.getByTestId('boton-voz'));

    await waitFor(() => expect(alertSpy).toHaveBeenCalledTimes(1));
    expect(alertSpy.mock.calls[0]?.[0]).toBe('Sin acceso al micrófono');
    expect(screen.queryByTestId('onda-flotante')).toBeNull();

    alertSpy.mockRestore();
  });
});
