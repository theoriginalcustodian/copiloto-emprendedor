import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert, StyleSheet } from 'react-native';

// Jest (jest-expo) -- describe/it/expect/jest son globales, no se importan de vitest.

jest.mock('../../adapters/almacen', () => ({
  almacenClave: {
    leer: jest.fn().mockResolvedValue(null),
    guardar: jest.fn().mockResolvedValue(undefined),
    borrar: jest.fn().mockResolvedValue(undefined),
  },
}));

/** Mismo criterio que `modules/chat/ChatView.test.tsx`: `useSession()` explota fuera de
 *  `<SessionProvider>` (que vive en `_layout.tsx`, ausente en este árbol de test). Fijo un
 *  `cliente_id` estable; no es lo que este archivo prueba. */
jest.mock('../auth/useSession', () => ({
  useSession: () => ({ me: { cliente_id: 'cli-pantallasoporte-test', email: 'usuario@copiloto.test' } }),
}));

/** `sendSoporteChat`/`sendSoporteAudio`/`getReply` mockeados -- mismo molde que
 *  `useChatSoporte.test.ts`. Sin esto, `useChatSoporte` pega contra la red real al montar. */
jest.mock('@copiloto/core', () => {
  const actual = jest.requireActual('@copiloto/core');
  return {
    ...actual,
    sendSoporteChat: jest.fn(),
    sendSoporteAudio: jest.fn(),
    listarMisTickets: jest.fn(),
    adjuntarFotoATicket: jest.fn(),
    apiReal: { ...actual.apiReal, getReply: jest.fn() },
  };
});

/** `deleteAsync` (`useChatSoporte.enviarAudio`, CERO retención) -- sin esto, la pantalla explota
 *  apenas monta `useVozComando` en la misma sesión. */
jest.mock('expo-file-system/legacy', () => ({
  deleteAsync: jest.fn().mockResolvedValue(undefined),
}));

/** El picker nativo (Alert Cámara/Galería + expo-image-picker) no existe en jest: se devuelve el archivo
 *  que cada test fije en `mockElegirFoto`. */
const mockElegirFoto = jest.fn();
jest.mock('../chat/useCapturaFoto', () => ({
  useCapturaFoto: () => ({ elegir: (...a: unknown[]) => mockElegirFoto(...a) }),
}));

/** `empujarUnaVez` empuja al `router` real de expo-router, ausente en este árbol: se observa la llamada. */
const mockEmpujarUnaVez = jest.fn();
const mockReabrirNavegacion = jest.fn();
jest.mock('../../navegacion/empujarUnaVez', () => ({
  empujarUnaVez: (...a: unknown[]) => mockEmpujarUnaVez(...a),
  reabrirNavegacion: () => mockReabrirNavegacion(),
}));

/**
 * `BotonVoz`/`ControlesFlotantes` MOCKEADOS acá -- mismo porqué que `ChatView.test.tsx`:
 * `GestureDetector` está mockeado GLOBAL a passthrough (`jest.setup.js`), así que el `BotonVoz` REAL
 * no tiene ningún `Pressable`/`onPress` que `fireEvent.press` pueda disparar. Lo que ESTE archivo
 * prueba no es el gesto (ya cubierto por `BotonVoz.test.tsx` + `useVozComando.test.ts`): es el
 * CABLEADO de `PantallaSoporte` -- qué le pasa a `voz`/`fijado`/`enviarAudio` cuando cada callback
 * dispara.
 */
jest.mock('../chat/BotonVoz', () => {
  const { Pressable, Text } = require('react-native');
  return {
    BotonVoz: ({ onIniciar, onSoltarSinFijar, onFijar, onCancelando, onCerca, disabled }: any) => (
      <>
        <Pressable testID="boton-voz-cerca-test" onPress={() => onCerca?.(true)}>
          <Text>cerca de fijar (mock)</Text>
        </Pressable>
        <Pressable testID="boton-voz-cancelando-test" onPress={() => onCancelando?.(true)}>
          <Text>cancelando (mock)</Text>
        </Pressable>
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
jest.mock('../chat/ControlesFlotantes', () => {
  const { Pressable, Text } = require('react-native');
  return {
    ControlesFlotantes: ({ fase, niveles, alPausar, alReanudar, alEnviar, alEliminar }: any) => (
      <>
        <Text testID="controles-flotantes-fase">{fase}</Text>
        <Text testID="controles-flotantes-niveles">{Array.isArray(niveles) ? 'ok' : 'falta'}</Text>
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
 * `expo-audio`: mismo mínimo que `ChatView.test.tsx` -- alcanza para que tocar `BotonVoz` abra la
 * onda sin crashear. `useVozComando.test.ts` ya prueba la máquina de fases a fondo.
 */
const mockGrabadorVoz = {
  prepareToRecordAsync: jest.fn().mockResolvedValue(undefined),
  record: jest.fn(),
  pause: jest.fn(),
  stop: jest.fn().mockResolvedValue(undefined),
  getStatus: jest.fn(() => ({ durationMillis: 0, metering: -60 })),
  uri: null as string | null,
};
const mockRequestRecordingPermissionsAsync = jest.fn().mockResolvedValue({ granted: true });
jest.mock('expo-audio', () => ({
  RecordingPresets: { HIGH_QUALITY: {} },
  useAudioRecorder: () => mockGrabadorVoz,
  requestRecordingPermissionsAsync: (...args: unknown[]) => mockRequestRecordingPermissionsAsync(...args),
  setAudioModeAsync: jest.fn().mockResolvedValue(undefined),
}));

import {
  adjuntarFotoATicket,
  apiReal as api,
  listarMisTickets,
  sendSoporteAudio,
  sendSoporteChat,
} from '@copiloto/core';

import { ThemeProvider } from '../../theme/ThemeProvider';
import { PantallaSoporte } from './PantallaSoporte';

async function renderPantallaSoporte() {
  return render(
    <ThemeProvider>
      <PantallaSoporte funcion="soporte_tecnico" />
    </ThemeProvider>,
  );
}

describe('PantallaSoporte -- voz (ODOBI8 §C2): hold-graba / soltar-envía / deslizar-fija, mismo patrón que ChatView', () => {
  // D9 (frontend, 2026-08-13): 15000ms (el bump anterior, C6 2026-08-12) seguía sin alcanzar bajo
  // carga real -- discriminado con H1 vs H2 (experimento controlado: 0/10 sin carga extra, 2/10
  // con 4 procesos de CPU forzados encima del basal, mismo código/plataforma en ambos). No es una
  // carrera de lógica -- es margen insuficiente para montaje + efectos async de este flujo cuando
  // la CPU está genuinamente compartida (varios worktrees/sesiones corriendo tests en simultáneo).
  // Subir el umbral de nuevo no es tapar el flake: es la 2da vez que se ajusta a la contención real
  // de esta máquina, y esta vez se re-verificó bajo la MISMA carga forzada que lo reprodujo antes
  // de cerrar D9 -- ver `docs/copiloto-emprendedor/Auditorias/2026-08-12-DEUDA-diferidos-con-dueno-y-fecha.md` fila D9.
  jest.setTimeout(30000);

  // BL-V12 (2026-09-22): `useVozComando` corre un `setInterval` REAL de 100ms (muestreo de la
  // onda/cronómetro) todo el tiempo que `fase==='grabando'`, y este describe entra a esa fase y se
  // queda ahí durante varios `waitFor`/aserciones. Con el reloj real, bajo la contención de las
  // otras ~106 suites del job mobile, cada tick + 2 re-renders se encarece y el test degrada ~10x
  // (3,1s aislado -> >30000ms dentro del gate completo) -- tercera aparición del mismo patrón en el
  // año, ya cerrado dos veces subiendo el timeout (no vuelve a repetirse: el fix de raíz es sacar el
  // test del reloj real). Fake timers desacoplan la duración del test de la carga de la máquina.
  // Ningún test de este describe asserta sobre `segundos`/`niveles` cambiando con el tiempo -- sólo
  // presencia/ausencia de `onda-flotante`, que se renderiza incondicional según `fase` -- así que no
  // hace falta avanzar el reloj para que las aserciones existentes sigan viendo lo mismo.
  beforeEach(() => {
    jest.useFakeTimers({ legacyFakeTimers: false });
    jest.mocked(api.getReply).mockReset().mockResolvedValue({ replies: [], next_id: 0 });
    jest.mocked(sendSoporteAudio).mockReset().mockResolvedValue({
      wf_id: 'wf-1',
      accepted: true,
      session_id: 'sop:abc',
      transcript: 'no me deja facturar',
    });
    mockRequestRecordingPermissionsAsync.mockReset().mockResolvedValue({ granted: true });
    mockGrabadorVoz.uri = null;
  });

  // Teardown OBLIGATORIO -- `jest.setup.js` (líneas 58-68) ya documentó que un timer real sin
  // limpiar de un test se filtra al SIGUIENTE archivo del mismo worker de Jest. Un `useFakeTimers`
  // sin `useRealTimers` de vuelta es el mismo riesgo en la otra dirección.
  afterEach(() => {
    jest.useRealTimers();
  });

  it('monta sin crashear y termina con el composer editable', async () => {
    await renderPantallaSoporte();
    await waitFor(() => expect(screen.getByTestId('chat-composer').props.editable).toBe(true));
    expect(screen.getByTestId('boton-voz')).toBeTruthy();
  });

  it('mantener apretado (mock: tocar el botón) arranca -- con la onda flotante', async () => {
    await renderPantallaSoporte();
    await waitFor(() => expect(screen.getByTestId('chat-composer').props.editable).toBe(true));

    await fireEvent.press(screen.getByTestId('boton-voz'));

    await waitFor(() => expect(screen.getByTestId('onda-flotante')).toBeTruthy());
    // Sin fijar todavía: los controles flotantes no existen.
    expect(screen.queryByTestId('voz-enviar')).toBeNull();
  });

  // O1: el campo de Soporte invita a contar un problema, no a anotar un movimiento.
  it('el composer dice «Contame qué pasó…», no el texto del chat de negocio', async () => {
    await renderPantallaSoporte();
    await waitFor(() => expect(screen.getByTestId('chat-composer').props.placeholder).toBe('Contame qué pasó…'));
  });

  // D3 (contrato 2026-10-13): el vacío de Soporte NO hereda los ejemplos de gasto/facturación/cobro.
  //
  // ⚠️ VACIOSOPORTE — este test afirmaba `getByTestId('chat-vacio')` (estaba verde PORQUE Soporte
  // pintaba el vacío del chat general: isotipo de 96 + «¿En qué te ayudo?» + la promesa de confirmar
  // antes de ejecutar). Soporte ya dice quién es en `encabezadoExtra` (isotipo de 38, `soporte-quien`)
  // y no ejecuta nada: abre tickets. Un primer ingreso (cero mensajes) mostraba dos isotipos y una
  // promesa de un mecanismo que Soporte no tiene. Si lo dan vuelta de nuevo, ese es el defecto.
  it('el estado vacío NO pinta la identidad del chat general: ni isotipo de 96, ni «¿En qué te ayudo?», ni rodillo', async () => {
    await renderPantallaSoporte();
    await waitFor(() => expect(screen.getByTestId('chat-composer').props.editable).toBe(true));
    expect(screen.queryByTestId('chat-vacio')).toBeNull();
    expect(screen.queryByText('¿En qué te ayudo?')).toBeNull();
    expect(screen.queryByText(/Antes de ejecutar algo importante/)).toBeNull();
    expect(screen.queryByTestId('chat-vacio-rodillo', { includeHiddenElements: true })).toBeNull();
    // La identidad de Soporte sigue y es UNA: el isotipo de 38 del encabezado fijo, no uno de 96 más.
    expect(screen.getByTestId('soporte-quien')).toBeTruthy();
    expect(screen.getAllByTestId('marca-isotipo')).toHaveLength(1);
  });

  // PISTAFIJARSOPORTE: el gesto de fijar necesita su cartel (WCAG 2.5.1) también acá.
  it('grabando sin fijar: aparece la pista del candado; en reposo no hay ninguna', async () => {
    await renderPantallaSoporte();
    await waitFor(() => expect(screen.getByTestId('chat-composer').props.editable).toBe(true));
    expect(screen.queryByTestId('voz-pistas')).toBeNull();

    await fireEvent.press(screen.getByTestId('boton-voz'));

    await waitFor(() => expect(screen.getByTestId('voz-pista-candado')).toBeTruthy());
  });

  it('«cerca» tiñe el candado: el cableado `onCerca` de BotonVoz llega a la pista', async () => {
    await renderPantallaSoporte();
    await waitFor(() => expect(screen.getByTestId('chat-composer').props.editable).toBe(true));
    await fireEvent.press(screen.getByTestId('boton-voz'));
    await waitFor(() => expect(screen.getByTestId('voz-pista-candado')).toBeTruthy());
    const reposo = StyleSheet.flatten(screen.getByTestId('voz-pista-candado').props.style).backgroundColor;

    await fireEvent.press(screen.getByTestId('boton-voz-cerca-test'));

    await waitFor(() => {
      const cerca = StyleSheet.flatten(screen.getByTestId('voz-pista-candado').props.style).backgroundColor;
      expect(cerca).not.toBe(reposo);
    });
  });

  it('cancelando: el candado se va y el aviso queda en la barra', async () => {
    await renderPantallaSoporte();
    await waitFor(() => expect(screen.getByTestId('chat-composer').props.editable).toBe(true));
    await fireEvent.press(screen.getByTestId('boton-voz'));
    await waitFor(() => expect(screen.getByTestId('voz-pista-candado')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('boton-voz-cancelando-test'));

    await waitFor(() => expect(screen.queryByTestId('voz-pista-candado')).toBeNull());
    expect(screen.getByTestId('voz-cancelar-aviso')).toBeTruthy();
  });

  it('fijar apaga la pista del candado: ya no hay nada que deslizar', async () => {
    await renderPantallaSoporte();
    await waitFor(() => expect(screen.getByTestId('chat-composer').props.editable).toBe(true));
    await fireEvent.press(screen.getByTestId('boton-voz'));
    await waitFor(() => expect(screen.getByTestId('voz-pista-candado')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('boton-voz-fijar-test'));

    await waitFor(() => expect(screen.getByTestId('voz-enviar')).toBeTruthy());
    expect(screen.queryByTestId('voz-pista-candado')).toBeNull();
  });

  it('deslizar hacia arriba (mock: onFijar) muestra los controles flotantes y esconde el botón', async () => {
    await renderPantallaSoporte();
    await waitFor(() => expect(screen.getByTestId('chat-composer').props.editable).toBe(true));
    await fireEvent.press(screen.getByTestId('boton-voz'));
    await waitFor(() => expect(screen.getByTestId('onda-flotante')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('boton-voz-fijar-test'));

    await waitFor(() => expect(screen.getByTestId('voz-enviar')).toBeTruthy());
    expect(screen.getByTestId('voz-pausar')).toBeTruthy();
    expect(screen.getByTestId('voz-eliminar')).toBeTruthy();
    // G3: la onda vive en el centro de la barra fijada -- el componente tiene que recibir los niveles.
    expect(screen.getByTestId('controles-flotantes-niveles')).toHaveTextContent('ok');
    expect(screen.queryByTestId('boton-voz')).toBeNull();
  });

  it('🔴 fijado: soltar el dedo (mock: onSoltarSinFijar) NO hace nada -- se termina por Enviar/Eliminar', async () => {
    await renderPantallaSoporte();
    await waitFor(() => expect(screen.getByTestId('chat-composer').props.editable).toBe(true));
    await fireEvent.press(screen.getByTestId('boton-voz'));
    await fireEvent.press(screen.getByTestId('boton-voz-fijar-test'));
    await waitFor(() => expect(screen.getByTestId('voz-enviar')).toBeTruthy());

    // El mock de "soltar" ya no está montado (el botón se ocultó al fijar).
    expect(screen.queryByTestId('boton-voz-soltar-test')).toBeNull();
    expect(sendSoporteAudio).not.toHaveBeenCalled();
  });

  it('soltar SIN fijar envía directo -- corta, sube por sendSoporteAudio, vuelve al estado inicial', async () => {
    mockGrabadorVoz.uri = 'file:///cache/voz.m4a';
    await renderPantallaSoporte();
    await waitFor(() => expect(screen.getByTestId('chat-composer').props.editable).toBe(true));
    await fireEvent.press(screen.getByTestId('boton-voz'));
    await waitFor(() => expect(screen.getByTestId('onda-flotante')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('boton-voz-soltar-test'));

    await waitFor(() => expect(sendSoporteAudio).toHaveBeenCalledTimes(1));
    expect(sendSoporteAudio).toHaveBeenCalledWith(
      expect.any(String),
      { nombre: expect.any(String), mime: expect.any(String), datos: 'file:///cache/voz.m4a' },
      'soporte_tecnico',
    );
    // Vuelve al estado inicial -- ni onda, ni controles.
    await waitFor(() => expect(screen.queryByTestId('onda-flotante')).toBeNull());
    expect(screen.queryByTestId('voz-enviar')).toBeNull();
    expect(await screen.findByText('no me deja facturar')).toBeTruthy();
  });

  it('fijado, Enviar -- mismo camino que soltar-sin-fijar (una sola función "mandar")', async () => {
    mockGrabadorVoz.uri = 'file:///cache/voz.m4a';
    await renderPantallaSoporte();
    await waitFor(() => expect(screen.getByTestId('chat-composer').props.editable).toBe(true));
    await fireEvent.press(screen.getByTestId('boton-voz'));
    await fireEvent.press(screen.getByTestId('boton-voz-fijar-test'));
    await waitFor(() => expect(screen.getByTestId('voz-enviar')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('voz-enviar'));

    await waitFor(() => expect(sendSoporteAudio).toHaveBeenCalledTimes(1));
    // `fijado` se resetea solo cuando `voz.fase` vuelve a `inactivo`: el botón de mantener vuelve.
    await waitFor(() => expect(screen.getByTestId('boton-voz')).toBeTruthy());
    expect(screen.queryByTestId('voz-enviar')).toBeNull();
  });

  it('fijado, Eliminar -- cierra sin llamar a sendSoporteAudio, la única vía legítima de perder el audio', async () => {
    mockGrabadorVoz.uri = 'file:///cache/voz.m4a';
    await renderPantallaSoporte();
    await waitFor(() => expect(screen.getByTestId('chat-composer').props.editable).toBe(true));
    await fireEvent.press(screen.getByTestId('boton-voz'));
    await fireEvent.press(screen.getByTestId('boton-voz-fijar-test'));
    await waitFor(() => expect(screen.getByTestId('voz-eliminar')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('voz-eliminar'));

    await waitFor(() => expect(screen.queryByTestId('voz-enviar')).toBeNull());
    expect(sendSoporteAudio).not.toHaveBeenCalled();
    expect(screen.getByTestId('boton-voz')).toBeTruthy();
  });

  it('transcript vacío (STT no entendió) NO agrega mensaje -- vuelve al estado inicial sin error', async () => {
    jest.mocked(sendSoporteAudio).mockResolvedValue({
      wf_id: 'wf-1',
      accepted: true,
      session_id: 'sop:abc',
      transcript: '   ',
    });
    mockGrabadorVoz.uri = 'file:///cache/voz.m4a';
    await renderPantallaSoporte();
    await waitFor(() => expect(screen.getByTestId('chat-composer').props.editable).toBe(true));
    await fireEvent.press(screen.getByTestId('boton-voz'));

    await fireEvent.press(screen.getByTestId('boton-voz-soltar-test'));

    await waitFor(() => expect(sendSoporteAudio).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByTestId('boton-voz')).toBeTruthy());
  });

  it('permiso de micrófono denegado: aviso legible, sin crash ni controles', async () => {
    mockRequestRecordingPermissionsAsync.mockResolvedValue({ granted: false });
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);

    await renderPantallaSoporte();
    await waitFor(() => expect(screen.getByTestId('chat-composer').props.editable).toBe(true));

    await fireEvent.press(screen.getByTestId('boton-voz'));

    await waitFor(() => expect(alertSpy).toHaveBeenCalledTimes(1));
    expect(alertSpy.mock.calls[0]?.[0]).toBe('Sin acceso al micrófono');
    expect(screen.queryByTestId('onda-flotante')).toBeNull();

    alertSpy.mockRestore();
  });
});

describe('PantallaSoporte -- encabezado (BL-W10)', () => {
  it('dice el tiempo de respuesta y qué viaja con el ticket, sin prometer un número de horas', async () => {
    await renderPantallaSoporte();
    const detalle = screen.getByTestId('soporte-detalle');
    const texto = (Array.isArray(detalle.props.children) ? detalle.props.children.join('') : String(detalle.props.children));
    expect(texto).toContain('plazo de respuesta');
    expect(texto).toContain('asunto y un resumen');
    expect(texto).not.toMatch(/\d+\s*(h|hs|horas|hábiles)/i);
    // H-A4-4: SOPORTE_QUIEN (packages/core/src/ayuda/textosSoporte.ts) es compartido con web; el
    // cambio de "Soporte de Odobi" a "Soporte técnico" pegó acá sin tocar código de mobile.
    expect(screen.getByTestId('soporte-quien').props.children).toBe('Soporte técnico');
  });
});

// ---- PROTO4APP §D/§E: la tarjeta del ticket en el hilo + «Ver tickets anteriores (N)» + el clip ----

const ticket = (o: Record<string, unknown> = {}) => ({
  id: 9,
  codigo: 'SOP-0009',
  asunto: 'No me deja facturar',
  estado: 'abierto' as const,
  creadoEn: '2026-10-13T10:00:00Z',
  ...o,
});

function listaDe(items: ReturnType<typeof ticket>[], total = items.length, respuestaEstimada: string | null = null) {
  jest.mocked(listarMisTickets).mockResolvedValue({ status: 'ok', items, total, respuestaEstimada } as never);
}

describe('PantallaSoporte -- tickets propios y adjunto (PROTO4APP §D/§E)', () => {
  jest.setTimeout(30000);

  beforeEach(() => {
    jest.mocked(api.getReply).mockReset().mockResolvedValue({ replies: [], next_id: 0 });
    jest.mocked(listarMisTickets).mockReset().mockResolvedValue({ status: 'no_disponible' } as never);
    jest.mocked(adjuntarFotoATicket).mockReset();
    mockElegirFoto.mockReset();
    mockEmpujarUnaVez.mockReset();
    mockReabrirNavegacion.mockReset();
  });

  it('con un ticket en curso pinta la tarjeta con SU código, estado y asunto, y el pie es el de textosSoporte (no el del prototipo)', async () => {
    listaDe([ticket()]);
    await renderPantallaSoporte();

    await waitFor(() => expect(screen.getByTestId('soporte-ticket-card')).toBeTruthy());
    expect(screen.getByText('Ticket SOP-0009')).toBeTruthy();
    expect(screen.getByTestId('soporte-ticket-estado').props.children).toBe('Abierto');
    expect(screen.getByTestId('soporte-ticket-sobre').props.children).toBe('No me deja facturar');
    const arbol = JSON.stringify(screen.toJSON());
    expect(arbol).toContain('asunto y un resumen');
    // Los literales del prototipo están contradichos: ni plazo en horas ni «va con esta conversación».
    expect(arbol).not.toMatch(/4 h|hábiles|Va con esta conversación/i);
  });

  it('con `respuesta_estimada: null` la fila «Te contestan» NO se pinta', async () => {
    listaDe([ticket()]);
    await renderPantallaSoporte();
    await waitFor(() => expect(screen.getByTestId('soporte-ticket-card')).toBeTruthy());
    expect(screen.queryByTestId('soporte-ticket-contestan')).toBeNull();
  });

  it('con un plazo del backend la fila «Te contestan» SÍ se pinta, con ese plazo', async () => {
    listaDe([ticket()], 1, 'Antes de 24 h');
    await renderPantallaSoporte();
    await waitFor(() => expect(screen.getByTestId('soporte-ticket-contestan')).toBeTruthy());
    expect(screen.getByTestId('soporte-ticket-contestan').props.children).toBe('Antes de 24 h');
  });

  it('el último ticket CERRADO no es tarjeta: sólo queda «Ver tickets anteriores (N)» con N = lo que se despliega', async () => {
    listaDe([ticket({ estado: 'cerrado' }), ticket({ id: 7, codigo: 'SOP-0007', estado: 'cerrado' })]);
    await renderPantallaSoporte();

    await waitFor(() => expect(screen.getByTestId('soporte-tickets-anteriores')).toBeTruthy());
    expect(screen.queryByTestId('soporte-ticket-card')).toBeNull();
    expect(JSON.stringify(screen.toJSON())).toContain('Ver tickets anteriores (2)');
  });

  it('con tarjeta vigente, N descuenta el vigente y sale de `total` (no de items.length); tocar despliega las filas', async () => {
    listaDe([ticket(), ticket({ id: 7, codigo: 'SOP-0007', estado: 'cerrado' })], 5);
    await renderPantallaSoporte();

    await waitFor(() => expect(screen.getByTestId('soporte-tickets-anteriores')).toBeTruthy());
    expect(JSON.stringify(screen.toJSON())).toContain('Ver tickets anteriores (4)');
    expect(screen.queryByTestId('soporte-ticket-anterior-7')).toBeNull();
    await fireEvent.press(screen.getByTestId('soporte-tickets-anteriores'));
    expect(screen.getByTestId('soporte-ticket-anterior-7')).toBeTruthy();
  });

  it('un solo ticket vigente y ningún anterior: NO hay enlace «Ver tickets anteriores»', async () => {
    listaDe([ticket()]);
    await renderPantallaSoporte();
    await waitFor(() => expect(screen.getByTestId('soporte-ticket-card')).toBeTruthy());
    expect(screen.queryByTestId('soporte-tickets-anteriores')).toBeNull();
  });

  it('tocar la tarjeta abre ESE ticket (reabriendo la puerta de navegación primero)', async () => {
    listaDe([ticket()]);
    await renderPantallaSoporte();
    await waitFor(() => expect(screen.getByTestId('soporte-ticket-card')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('soporte-ticket-card'));

    expect(mockReabrirNavegacion).toHaveBeenCalledTimes(1);
    expect(mockEmpujarUnaVez).toHaveBeenCalledWith({ pathname: '/soporte-ticket', params: { ticketId: '9' } });
  });

  it('fail-soft: si la lista falla (red/5xx) no hay tarjeta y el chat queda usable', async () => {
    jest.mocked(listarMisTickets).mockRejectedValue(new Error('boom'));
    await renderPantallaSoporte();
    await waitFor(() => expect(screen.getByTestId('chat-composer').props.editable).toBe(true));
    expect(listarMisTickets).toHaveBeenCalled();
    expect(screen.queryByTestId('soporte-tickets')).toBeNull();
  });

  it('el clip SIN ticket en curso avisa con el motivo y NO abre el picker (no acepta una foto para perderla)', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    await renderPantallaSoporte();
    await waitFor(() => expect(screen.getByTestId('chat-foto')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('chat-foto'));

    expect(alertSpy).toHaveBeenCalledWith('Todavía no hay un ticket abierto', expect.stringContaining('se adjunta a un ticket'));
    expect(mockElegirFoto).not.toHaveBeenCalled();
    expect(adjuntarFotoATicket).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it('el clip CON ticket sube la foto a ESE ticket, avisa y borra el archivo local (cero retención)', async () => {
    const { deleteAsync } = require('expo-file-system/legacy');
    deleteAsync.mockClear();
    listaDe([ticket()]);
    const archivo = { nombre: 'ticket.jpg', mime: 'image/jpeg', datos: 'file:///cache/ticket.jpg' };
    mockElegirFoto.mockResolvedValue(archivo);
    jest.mocked(adjuntarFotoATicket).mockResolvedValue({
      status: 'ok',
      adjunto: { id: 5, nombre: 'ticket.jpg', tipo: 'image/jpeg', bytes: 10 },
    } as never);
    await renderPantallaSoporte();
    await waitFor(() => expect(screen.getByTestId('soporte-ticket-card')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('chat-foto'));

    await waitFor(() => expect(adjuntarFotoATicket).toHaveBeenCalledWith(9, archivo));
    await waitFor(() => expect(screen.getByTestId('soporte-adjunto-aviso')).toBeTruthy());
    expect(screen.getByTestId('soporte-adjunto-aviso').props.children).toBe('Listo, la foto quedó adjunta al ticket.');
    expect(deleteAsync).toHaveBeenCalledWith('file:///cache/ticket.jpg', { idempotent: true });
  });

  it('si el usuario cancela el picker no se sube nada', async () => {
    listaDe([ticket()]);
    mockElegirFoto.mockResolvedValue(null);
    await renderPantallaSoporte();
    await waitFor(() => expect(screen.getByTestId('soporte-ticket-card')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('chat-foto'));

    await waitFor(() => expect(mockElegirFoto).toHaveBeenCalledTimes(1));
    expect(adjuntarFotoATicket).not.toHaveBeenCalled();
  });

  it('un rechazo del backend (413) se dice en palabras y la foto igual se borra', async () => {
    const { deleteAsync } = require('expo-file-system/legacy');
    deleteAsync.mockClear();
    listaDe([ticket()]);
    mockElegirFoto.mockResolvedValue({ nombre: 'ticket.jpg', mime: 'image/jpeg', datos: 'file:///cache/grande.jpg' });
    jest.mocked(adjuntarFotoATicket).mockResolvedValue({ status: 'rechazado' } as never);
    await renderPantallaSoporte();
    await waitFor(() => expect(screen.getByTestId('soporte-ticket-card')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('chat-foto'));

    await waitFor(() => expect(screen.getByTestId('soporte-adjunto-aviso')).toBeTruthy());
    expect(String(screen.getByTestId('soporte-adjunto-aviso').props.children)).toMatch(/pesa demasiado/);
    expect(deleteAsync).toHaveBeenCalledWith('file:///cache/grande.jpg', { idempotent: true });
  });

  it('un error de red al subir cae en el aviso genérico (no crashea) y también borra el archivo', async () => {
    const { deleteAsync } = require('expo-file-system/legacy');
    deleteAsync.mockClear();
    listaDe([ticket()]);
    mockElegirFoto.mockResolvedValue({ nombre: 'ticket.jpg', mime: 'image/jpeg', datos: 'file:///cache/x.jpg' });
    jest.mocked(adjuntarFotoATicket).mockRejectedValue(new Error('red'));
    await renderPantallaSoporte();
    await waitFor(() => expect(screen.getByTestId('soporte-ticket-card')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('chat-foto'));

    await waitFor(() => expect(screen.getByTestId('soporte-adjunto-aviso')).toBeTruthy());
    expect(String(screen.getByTestId('soporte-adjunto-aviso').props.children)).toMatch(/No pudimos subir la foto/);
    expect(deleteAsync).toHaveBeenCalledWith('file:///cache/x.jpg', { idempotent: true });
  });

  it('al terminar un turno del chat vuelve a pedir los tickets (el agente pudo abrir uno)', async () => {
    jest.mocked(sendSoporteChat).mockReset().mockResolvedValue({ wf_id: 'wf-1', accepted: true, session_id: 'sop:abc' } as never);
    listaDe([]);
    await renderPantallaSoporte();
    await waitFor(() => expect(listarMisTickets).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByTestId('chat-composer').props.editable).toBe(true));

    // El turno SOLO termina (`sendStatus` vuelve a `idle`) cuando llega la respuesta del agente.
    jest.mocked(api.getReply).mockResolvedValue({ replies: [{ id: 1, text: 'Abrí el ticket SOP-0009' }], next_id: 1 });
    listaDe([ticket()]);
    await fireEvent.changeText(screen.getByTestId('chat-composer'), 'no me deja facturar');
    await fireEvent.press(screen.getByTestId('chat-enviar'));

    await waitFor(() => expect(screen.getByTestId('soporte-ticket-card')).toBeTruthy(), { timeout: 10000 });
    expect(jest.mocked(listarMisTickets).mock.calls.length).toBeGreaterThanOrEqual(2);
  });
});
