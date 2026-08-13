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
    apiReal: { ...actual.apiReal, getReply: jest.fn() },
  };
});

/** `deleteAsync` (`useChatSoporte.enviarAudio`, CERO retención) -- sin esto, la pantalla explota
 *  apenas monta `useVozComando` en la misma sesión. */
jest.mock('expo-file-system/legacy', () => ({
  deleteAsync: jest.fn().mockResolvedValue(undefined),
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
jest.mock('../chat/ControlesFlotantes', () => {
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

import { apiReal as api, sendSoporteAudio } from '@copiloto/core';

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

  beforeEach(() => {
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

  it('deslizar hacia arriba (mock: onFijar) muestra los controles flotantes y esconde el botón', async () => {
    await renderPantallaSoporte();
    await waitFor(() => expect(screen.getByTestId('chat-composer').props.editable).toBe(true));
    await fireEvent.press(screen.getByTestId('boton-voz'));
    await waitFor(() => expect(screen.getByTestId('onda-flotante')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('boton-voz-fijar-test'));

    await waitFor(() => expect(screen.getByTestId('voz-enviar')).toBeTruthy());
    expect(screen.getByTestId('voz-pausar')).toBeTruthy();
    expect(screen.getByTestId('voz-eliminar')).toBeTruthy();
    expect(screen.getByTestId('onda-flotante')).toBeTruthy();
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
