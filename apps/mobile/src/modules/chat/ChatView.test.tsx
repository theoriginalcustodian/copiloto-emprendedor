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
      sendFoto: jest.fn(),
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
    BotonVoz: ({ onIniciar, onSoltarSinFijar, onFijar, onCancelando, onCerca, disabled }: any) => (
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
        <Pressable testID="boton-voz-cancelando-test" onPress={() => onCancelando?.(true)}>
          <Text>armar cancelación (mock del deslizar a la izquierda)</Text>
        </Pressable>
        <Pressable testID="boton-voz-cerca-test" onPress={() => onCerca?.(true)}>
          <Text>cerca de fijar (mock del deslizar hacia arriba)</Text>
        </Pressable>
      </>
    ),
  };
});
jest.mock('./ControlesFlotantes', () => {
  const { Pressable, Text } = require('react-native');
  return {
    ControlesFlotantes: ({ fase, segundos, niveles, alPausar, alReanudar, alEnviar, alEliminar }: any) => (
      <>
        <Text testID="controles-flotantes-fase">{fase}</Text>
        <Text testID="controles-flotantes-niveles">{Array.isArray(niveles) ? 'ok' : 'falta'}</Text>
        <Text testID="controles-flotantes-segundos">{String(segundos)}</Text>
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
  // `Text` lo necesita el rodillo de ejemplos del vacío, que ChatView monta.
  const { View, Text } = require('react-native');
  const entradaSalida = { duration: () => ({}) };
  return {
    __esModule: true,
    default: { View, Text, createAnimatedComponent: (Comp: unknown) => Comp },
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
// `expo-image-picker` (Gastos Fase 2) -- `useCapturaFoto` NO se mockea (a diferencia de `BotonVoz`):
// no tiene gesto que un `GestureDetector` mockeado se coma, así que se ejercita REAL a través de su
// `Alert.alert` (mismo criterio que `useCapturaFoto.test.ts`).
const mockRequestCameraPermissionsAsync = jest.fn().mockResolvedValue({ granted: true });
const mockLaunchCameraAsync = jest.fn();
jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: (...args: unknown[]) => mockRequestCameraPermissionsAsync(...args),
  requestMediaLibraryPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
  launchCameraAsync: (...args: unknown[]) => mockLaunchCameraAsync(...args),
  launchImageLibraryAsync: jest.fn().mockResolvedValue({ canceled: true, assets: null }),
}));

// Expuesto aparte (y no inline en el factory) para que el test de permiso denegado pueda pisarlo con
// `mockResolvedValueOnce({granted:false})` sin tocar el resto de la suite.
const mockRequestRecordingPermissionsAsync = jest.fn().mockResolvedValue({ granted: true });
jest.mock('expo-audio', () => ({
  RecordingPresets: { HIGH_QUALITY: {} },
  useAudioRecorder: () => mockGrabadorVoz,
  requestRecordingPermissionsAsync: (...args: unknown[]) => mockRequestRecordingPermissionsAsync(...args),
  setAudioModeAsync: jest.fn().mockResolvedValue(undefined),
}));

import { apiReal as api, dejarPendiente, tomarPendiente } from '@copiloto/core';

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

  // Fila `onb-cumplida` #5: el onboarding se renderiza EN LUGAR del chat; al cerrarse, el chat se monta de
  // cero con el pedido YA en el buzón. `useChat` arranca con `estado === null` y `send` descarta en
  // silencio: sin esperar la hidratación, `tomarPendiente()` vaciaba el buzón y el pedido se perdía.
  it('🔴 un pedido que ya estaba en el buzón al MONTAR se manda UNA vez, tras hidratar (no se pierde)', async () => {
    tomarPendiente();
    jest.mocked(api.sendChat).mockResolvedValue({ wf_id: 'wf-p', accepted: true });
    dejarPendiente('Armame el detalle de quiénes son los clientes con facturas sin cobrar.');

    await renderChatView();

    await waitFor(() => expect(api.sendChat).toHaveBeenCalledTimes(1));
    expect(jest.mocked(api.sendChat).mock.calls[0]?.[0]).toMatchObject({
      text: 'Armame el detalle de quiénes son los clientes con facturas sin cobrar.',
      kind: 'text',
    });
    expect(tomarPendiente()).toBeNull();
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
  // Mismo margen insuficiente que `PantallaSoporte.test.tsx` -- ver el comentario ahí (D9,
  // frontend, 2026-08-13): 15000ms seguía sin alcanzar bajo carga real, discriminado H1 vs H2 con
  // experimento controlado. No es una carrera de lógica.
  jest.setTimeout(30000);

  // BL-V12 (2026-09-22): mismo hook (`useVozComando`), mismo `setInterval` real de 100ms mientras
  // `fase==='grabando'`, mismo riesgo de degradación bajo contención que `PantallaSoporte.test.tsx`
  // (ver el comentario ahí para el detalle completo) -- decisión de alcance: se arregla también acá
  // porque es el describe hermano con el patrón idéntico, no porque este archivo haya fallado todavía.
  beforeEach(() => {
    jest.useFakeTimers({ legacyFakeTimers: false });
    jest.mocked(api.sendChat).mockReset();
    jest.mocked(api.sendAudio).mockReset();
    jest.mocked(api.sendAudio).mockResolvedValue({ replies: [], next_id: 0 } as any);
    jest.mocked(api.getReply).mockReset();
    jest.mocked(api.getReply).mockResolvedValue({ replies: [], next_id: 0 });
    mockRequestRecordingPermissionsAsync.mockReset().mockResolvedValue({ granted: true });
    mockGrabadorVoz.uri = null;
  });

  // Teardown OBLIGATORIO -- ver el mismo comentario en `PantallaSoporte.test.tsx` (riesgo de fuga de
  // timer entre archivos del mismo worker de Jest, documentado en `jest.setup.js:58-68`).
  afterEach(() => {
    jest.useRealTimers();
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

  // Filas `bloqueado`/`grabando` (TRIAJE15): el usuario no tiene que ADIVINAR el gesto.
  it('grabando sin fijar: pistas de candado y de cancelar; en reposo no hay ninguna', async () => {
    await renderChatView();
    await waitFor(() => expect(screen.getByTestId('chat-composer').props.editable).toBe(true));
    expect(screen.queryByTestId('voz-pistas')).toBeNull();

    await fireEvent.press(screen.getByTestId('boton-voz'));

    await waitFor(() => expect(screen.getByTestId('voz-pistas')).toBeTruthy());
    expect(screen.getByTestId('voz-pista-cancelar')).toBeTruthy();
    expect(screen.getByTestId('voz-pista-candado')).toBeTruthy();
    expect(screen.queryByTestId('voz-cancelar-aviso')).toBeNull();
  });

  // Fila `grabando`, G2 (contrato «el prototipo GANA», 2026-10-13): el reloj `0:07` del prototipo. El dato
  // es `voz.segundos` (el reloj del propio grabador, que no cuenta la pausa), no un contador paralelo.
  it('grabando sin fijar: el reloj de las pistas es el tiempo que dice el grabador', async () => {
    mockGrabadorVoz.getStatus.mockImplementation(() => ({ durationMillis: 7500, metering: -60 }));
    try {
      await renderChatView();
      await waitFor(() => expect(screen.getByTestId('chat-composer').props.editable).toBe(true));

      await fireEvent.press(screen.getByTestId('boton-voz'));

      await waitFor(() => expect(screen.getByTestId('voz-reloj')).toHaveTextContent('0:07'));
    } finally {
      mockGrabadorVoz.getStatus.mockImplementation(() => ({ durationMillis: 0, metering: -60 }));
    }
  });

  it('fijado: los controles reciben los MISMOS segundos que el grabador (no arrancan de cero)', async () => {
    mockGrabadorVoz.getStatus.mockImplementation(() => ({ durationMillis: 7500, metering: -60 }));
    try {
      await renderChatView();
      await waitFor(() => expect(screen.getByTestId('chat-composer').props.editable).toBe(true));
      await fireEvent.press(screen.getByTestId('boton-voz'));
      await waitFor(() => expect(screen.getByTestId('voz-reloj')).toHaveTextContent('0:07'));

      await fireEvent.press(screen.getByTestId('boton-voz-fijar-test'));

      await waitFor(() => expect(screen.getByTestId('controles-flotantes-segundos')).toHaveTextContent('7'));
    } finally {
      mockGrabadorVoz.getStatus.mockImplementation(() => ({ durationMillis: 0, metering: -60 }));
    }
  });

  it('al armar la cancelación el aviso «Soltá para cancelar» REEMPLAZA a las pistas', async () => {
    await renderChatView();
    await waitFor(() => expect(screen.getByTestId('chat-composer').props.editable).toBe(true));
    await fireEvent.press(screen.getByTestId('boton-voz'));
    await waitFor(() => expect(screen.getByTestId('voz-pistas')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('boton-voz-cancelando-test'));

    await waitFor(() => expect(screen.getByTestId('voz-cancelar-aviso')).toBeTruthy());
    expect(screen.queryByTestId('voz-pistas')).toBeNull();
  });

  it('fijar apaga las pistas del gesto: ya no hay nada que deslizar', async () => {
    await renderChatView();
    await waitFor(() => expect(screen.getByTestId('chat-composer').props.editable).toBe(true));
    await fireEvent.press(screen.getByTestId('boton-voz'));
    await waitFor(() => expect(screen.getByTestId('voz-pistas')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('boton-voz-fijar-test'));

    await waitFor(() => expect(screen.getByTestId('voz-enviar')).toBeTruthy());
    expect(screen.queryByTestId('voz-pistas')).toBeNull();
  });

  it('en pausa: la fase «pausado» le llega a la barra fijada (ella pinta «En pausa»); al reanudar vuelve «grabando»', async () => {
    await renderChatView();
    await waitFor(() => expect(screen.getByTestId('chat-composer').props.editable).toBe(true));
    await fireEvent.press(screen.getByTestId('boton-voz'));
    await fireEvent.press(screen.getByTestId('boton-voz-fijar-test'));
    await waitFor(() => expect(screen.getByTestId('voz-pausar')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('voz-pausar'));

    // «En pausa» en texto y la onda que se apaga son del componente real: `ControlesFlotantes.test.tsx`.
    await waitFor(() => expect(screen.getByTestId('controles-flotantes-fase')).toHaveTextContent('pausado'));

    await fireEvent.press(screen.getByTestId('voz-reanudar'));

    await waitFor(() => expect(screen.getByTestId('controles-flotantes-fase')).toHaveTextContent('grabando'));
  });

  it('deslizar hacia arriba (mock: onFijar) muestra los controles flotantes y esconde el botón', async () => {
    await renderChatView();
    await waitFor(() => expect(screen.getByTestId('chat-composer').props.editable).toBe(true));
    await fireEvent.press(screen.getByTestId('boton-voz'));
    await waitFor(() => expect(screen.getByTestId('onda-flotante')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('boton-voz-fijar-test'));

    await waitFor(() => expect(screen.getByTestId('voz-enviar')).toBeTruthy());
    expect(screen.getByTestId('voz-eliminar')).toBeTruthy();
    // 🔴 NO alcanza con `getByTestId('voz-pausar')`: el stand-in de `ControlesFlotantes` (arriba)
    // renderiza los cuatro botones SIEMPRE, sin la guarda `grabando &&` del componente real. Ese
    // assert pasaba con el bug #468 puesto -- confirmaba en vez de verificar. Lo que hay que mirar
    // es la FASE que le llega al componente, que es lo ÚNICO que el mock transmite fiel: si al
    // fijar la fase fuera `'listo'`, el componente REAL no pintaría Pausar (ver
    // `ControlesFlotantes.tsx:37` y su propio test) y el usuario se queda sin pausar.
    expect(screen.getByTestId('controles-flotantes-fase')).toHaveTextContent('grabando');
    expect(screen.getByTestId('voz-pausar')).toBeTruthy();
    // G3: la onda ya no flota aparte, vive en el centro de la barra -- el componente tiene que
    // recibir los niveles para dibujarla.
    expect(screen.getByTestId('controles-flotantes-niveles')).toHaveTextContent('ok');
    expect(screen.queryByTestId('overlay-voz-fijado')).toBeNull();
    // El botón de mantener-apretado ya no está: los controles flotantes tomaron el mando.
    expect(screen.queryByTestId('boton-voz')).toBeNull();
  });

  it('G3: mientras graba, la BARRA de grabación ocupa el lugar del composer (que sigue montado, oculto)', async () => {
    await renderChatView();
    await waitFor(() => expect(screen.getByTestId('chat-composer').props.editable).toBe(true));
    expect(screen.queryByTestId('voz-barra-sostenida')).toBeNull();
    expect(screen.getByTestId('chat-composer-contenedor', { includeHiddenElements: true })).not.toHaveStyle({ display: 'none' });

    await fireEvent.press(screen.getByTestId('boton-voz'));

    await waitFor(() => expect(screen.getByTestId('voz-barra-sostenida')).toBeTruthy());
    expect(screen.getByTestId('chat-composer', { includeHiddenElements: true })).toBeTruthy(); // montado: el borrador no se pierde
    expect(screen.getByTestId('chat-composer-contenedor', { includeHiddenElements: true })).toHaveStyle({ display: 'none' });
  });

  it('G3: al terminar la captura el composer vuelve y la barra se va', async () => {
    mockGrabadorVoz.uri = 'file:///cache/voz.m4a';
    await renderChatView();
    await waitFor(() => expect(screen.getByTestId('chat-composer').props.editable).toBe(true));
    await fireEvent.press(screen.getByTestId('boton-voz'));
    await waitFor(() => expect(screen.getByTestId('voz-barra-sostenida')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('boton-voz-soltar-test'));

    await waitFor(() => expect(screen.queryByTestId('voz-barra-sostenida')).toBeNull());
    expect(screen.getByTestId('chat-composer-contenedor', { includeHiddenElements: true })).not.toHaveStyle({ display: 'none' });
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

describe('ChatView -- foto de ticket (Gastos Fase 2, OCR)', () => {
  beforeEach(() => {
    jest.mocked(api.sendChat).mockReset();
    jest.mocked(api.sendFoto).mockReset();
    jest.mocked(api.getReply).mockReset();
    jest.mocked(api.getReply).mockResolvedValue({ replies: [], next_id: 0 });
    mockRequestCameraPermissionsAsync.mockReset().mockResolvedValue({ granted: true });
    mockLaunchCameraAsync.mockReset();
  });

  /** Simula al usuario tocando el botón `texto` de la última llamada a `Alert.alert` -- mismo
   *  helper que `useCapturaFoto.test.ts` (acá no se puede importar: depende del spy local). */
  function tocarBoton(spy: jest.SpyInstance, texto: string) {
    const llamada = spy.mock.calls.at(-1);
    const botones = llamada?.[2] as { text: string; onPress?: () => void }[] | undefined;
    botones?.find((b) => b.text === texto)?.onPress?.();
  }

  it('el botón de cámara existe y dispara el picker Cámara/Galería/Cancelar', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    await renderChatView();
    await waitFor(() => expect(screen.getByTestId('chat-composer').props.editable).toBe(true));

    await fireEvent.press(screen.getByTestId('chat-foto'));

    expect(alertSpy).toHaveBeenCalledWith(
      'Foto del ticket',
      expect.any(String),
      expect.arrayContaining([expect.objectContaining({ text: 'Cámara' })]),
    );
    alertSpy.mockRestore();
  });

  it('Cámara -> sube la foto y agrega el mensaje optimista fijo en la lista', async () => {
    mockLaunchCameraAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///cache/ticket.jpg', mimeType: 'image/jpeg' }],
    });
    jest.mocked(api.sendFoto).mockResolvedValue({ wf_id: 'wf-foto-1', accepted: true } as any);
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    await renderChatView();
    await waitFor(() => expect(screen.getByTestId('chat-composer').props.editable).toBe(true));

    await fireEvent.press(screen.getByTestId('chat-foto'));
    tocarBoton(alertSpy, 'Cámara');

    await waitFor(() => expect(api.sendFoto).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('📷 Foto del ticket enviada')).toBeTruthy();
    // `cliente_id` viaja vacío, mismo criterio que `enviarAudio` -- ver el docstring de `useChat.ts`.
    expect(api.sendFoto).toHaveBeenCalledWith(
      expect.any(String),
      { nombre: 'ticket.jpg', mime: 'image/jpeg', datos: 'file:///cache/ticket.jpg' },
      '',
    );
    alertSpy.mockRestore();
  });

  it('permiso de cámara denegado: aviso legible, sin llamar a sendFoto', async () => {
    mockRequestCameraPermissionsAsync.mockResolvedValue({ granted: false });
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    await renderChatView();
    await waitFor(() => expect(screen.getByTestId('chat-composer').props.editable).toBe(true));

    await fireEvent.press(screen.getByTestId('chat-foto'));
    tocarBoton(alertSpy, 'Cámara');

    await waitFor(() => expect(alertSpy.mock.calls.length).toBeGreaterThanOrEqual(2));
    expect(alertSpy.mock.calls[1]?.[0]).toMatch(/cámara/i);
    expect(api.sendFoto).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it('Cancelar en el picker no llama a sendFoto ni pide ningún permiso', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    await renderChatView();
    await waitFor(() => expect(screen.getByTestId('chat-composer').props.editable).toBe(true));

    await fireEvent.press(screen.getByTestId('chat-foto'));
    tocarBoton(alertSpy, 'Cancelar');

    expect(mockRequestCameraPermissionsAsync).not.toHaveBeenCalled();
    expect(api.sendFoto).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });
});

describe('ChatView -- hitl (a): el aviso de una tarjeta de Mi día entra sembrado', () => {
  const AVISO = {
    aviso: {
      texto: 'Sobre este aviso de Mi día: «Hace 12 días que le mandaste el presupuesto a Lucía». Acción: Mandarle un recordatorio',
      contexto: 'Desde tu aviso · Presupuestos · Lucía',
    },
    id: 1,
  };

  beforeEach(() => {
    jest.mocked(api.sendChat).mockReset();
    jest.mocked(api.getReply).mockReset();
    jest.mocked(api.getReply).mockResolvedValue({ replies: [], next_id: 0 });
  });

  it('🔴 siembra el texto en el composer y NO lo manda solo: la card de confirmación viene DESPUÉS de que lo lea', async () => {
    await render(
      <ThemeProvider>
        <ChatView avisoEntrante={AVISO} onVolverAlTablero={jest.fn()} />
      </ThemeProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('chat-composer').props.value).toBe(AVISO.aviso.texto));
    expect(api.sendChat).not.toHaveBeenCalled();
    expect(screen.getByTestId('chat-contexto-aviso-texto')).toHaveTextContent('Desde tu aviso · Presupuestos · Lucía');
  });

  it('lo que viaja es el texto del composer; el chip es sólo UI y no entra al request', async () => {
    jest.mocked(api.sendChat).mockResolvedValue({ wf_id: 'wf-aviso', accepted: true });
    await render(
      <ThemeProvider>
        <ChatView avisoEntrante={AVISO} onVolverAlTablero={jest.fn()} />
      </ThemeProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('chat-composer').props.editable).toBe(true));
    await waitFor(() => expect(screen.getByTestId('chat-composer').props.value).toBe(AVISO.aviso.texto));
    await fireEvent.press(screen.getByTestId('chat-enviar'));

    await waitFor(() => expect(api.sendChat).toHaveBeenCalledTimes(1));
    const llamada = jest.mocked(api.sendChat).mock.calls[0]?.[0];
    expect(llamada).toMatchObject({ text: AVISO.aviso.texto, kind: 'text' });
    expect(JSON.stringify(llamada)).not.toContain('Desde tu aviso');
  });

  it('«Volver al tablero» llama a la salida', async () => {
    const onVolver = jest.fn();
    await render(
      <ThemeProvider>
        <ChatView avisoEntrante={AVISO} onVolverAlTablero={onVolver} />
      </ThemeProvider>,
    );
    await fireEvent.press(await screen.findByTestId('chat-contexto-aviso-volver'));
    expect(onVolver).toHaveBeenCalledTimes(1);
  });

  it('sin aviso no hay chip ni salida (el chat de siempre); sin salida el chip no ofrece un botón muerto', async () => {
    const sin = await render(
      <ThemeProvider>
        <ChatView />
      </ThemeProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('chat-composer').props.editable).toBe(true));
    expect(screen.queryByTestId('chat-contexto-aviso')).toBeNull();
    sin.unmount();

    await render(
      <ThemeProvider>
        <ChatView avisoEntrante={AVISO} />
      </ThemeProvider>,
    );
    expect(await screen.findByTestId('chat-contexto-aviso')).toBeTruthy();
    expect(screen.queryByTestId('chat-contexto-aviso-volver')).toBeNull();
  });
});

// fact-voz (d) — la COSTURA: `ChatView` le pasa a la lista el `sendStatus` real de `useChat`. Un test de
// `ListaMensajes` con `sendStatus` armado a mano no ve un cableado roto acá (la prop se pierde y la lista
// asume «nada en vuelo» → «recibido» sobre un mensaje que todavía no salió).
describe('ChatView — fact-voz (d): «✓✓ recibido» sólo cuando el servidor aceptó el envío', () => {
  beforeEach(() => {
    jest.mocked(api.sendChat).mockReset();
    jest.mocked(api.getReply).mockReset();
    jest.mocked(api.getReply).mockResolvedValue({ replies: [], next_id: 0 });
  });

  async function enviar(texto: string) {
    await renderChatView();
    await waitFor(() => expect(screen.getByTestId('chat-composer').props.editable).toBe(true));
    await fireEvent.changeText(screen.getByTestId('chat-composer'), texto);
    await fireEvent.press(screen.getByTestId('chat-enviar'));
    return screen.findByText(texto);
  }

  it('🔴 con el POST todavía en vuelo el mensaje está en pantalla SIN «recibido»', async () => {
    jest.mocked(api.sendChat).mockReturnValue(new Promise(() => {}));
    await enviar('hola copiloto');
    expect(screen.queryByTestId('chat-bubble-recibido')).toBeNull();
  });

  it('cuando el POST lo aceptó, el mismo mensaje pasa a «<hora> ✓✓ recibido»', async () => {
    jest.mocked(api.sendChat).mockResolvedValue({ wf_id: 'wf-r', accepted: true });
    await enviar('hola copiloto');
    await waitFor(() => expect(screen.getByTestId('chat-bubble-recibido')).toHaveTextContent(/^\d{1,2}:\d{2} ✓✓ recibido$/));
  });

  it('🔴 si el envío falla, el mensaje queda en pantalla y NO dice «recibido»', async () => {
    jest.mocked(api.sendChat).mockRejectedValue(new Error('sin red'));
    await enviar('hola copiloto');
    await waitFor(() => expect(screen.getByTestId('composer-status')).not.toHaveTextContent('Trabajando…'));
    expect(screen.queryByTestId('chat-bubble-recibido')).toBeNull();
  });
});
