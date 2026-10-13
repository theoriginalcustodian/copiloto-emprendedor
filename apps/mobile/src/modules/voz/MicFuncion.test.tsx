import { render, screen, waitFor } from '@testing-library/react-native';
import { Gesture } from 'react-native-gesture-handler';

jest.mock('expo-file-system/legacy', () => ({
  deleteAsync: jest.fn().mockResolvedValue(undefined),
}));

const mockVoz: {
  fase: 'inactivo' | 'grabando' | 'pausado' | 'listo';
  niveles: number[];
  iniciar: jest.Mock;
  pausar: jest.Mock;
  reanudar: jest.Mock;
  detener: jest.Mock;
  descartar: jest.Mock;
  tomar: jest.Mock;
} = {
  fase: 'inactivo',
  niveles: [],
  iniciar: jest.fn().mockResolvedValue(true),
  pausar: jest.fn(),
  reanudar: jest.fn(),
  detener: jest.fn().mockResolvedValue(undefined),
  descartar: jest.fn().mockResolvedValue(undefined),
  tomar: jest.fn(),
};

jest.mock('../chat/useVozComando', () => ({
  useVozComando: () => mockVoz,
}));

// El `ControlesFlotantes` real anima con `FadeIn.duration` de Reanimated, que el mock global no
// exporta (mismo motivo que el override local de `ChatView.test.tsx`). Acá no se prueban los botones:
// eso es `ControlesFlotantes.test.tsx`; se prueba qué muestra `MicFuncion` ALREDEDOR de ellos.
jest.mock('../chat/ControlesFlotantes', () => ({ ControlesFlotantes: () => null }));

const mockTranscribir = jest.fn();
jest.mock('@copiloto/core', () => {
  const actual = jest.requireActual('@copiloto/core');
  return { ...actual, transcribir: (...args: unknown[]) => mockTranscribir(...args) };
});

import { deleteAsync } from 'expo-file-system/legacy';

import { ThemeProvider } from '../../theme/ThemeProvider';
import { UMBRAL_FIJAR_PX } from '../chat/BotonVoz';
import { MicFuncion } from './MicFuncion';

async function montar(props: Partial<React.ComponentProps<typeof MicFuncion>> = {}) {
  const onTranscripcion = props.onTranscripcion ?? jest.fn();
  const onError = props.onError ?? jest.fn();
  await render(
    <ThemeProvider>
      <MicFuncion onTranscripcion={onTranscripcion} contexto="gasto" onError={onError} {...props} />
    </ThemeProvider>,
  );
  return { onTranscripcion, onError };
}

/** Dispara el ciclo completo del gesto de `BotonVoz` sin device: captura el recognizer real
 * (`Gesture.Pan`, `GestureDetector` mockeado a passthrough — mismo mecanismo que `BotonVoz.test.tsx`)
 * y emite `onBegin`→`onFinalize` sin desplazamiento (apretar y soltar, camino "enviar directo"). */
async function grabarYSoltar() {
  const espiaPan = jest.spyOn(Gesture, 'Pan');
  await montarActual();
  const recognizer = espiaPan.mock.results[espiaPan.mock.results.length - 1]?.value as {
    handlers: { onBegin?: (e: unknown) => void; onFinalize?: (e: unknown, exito: boolean) => void };
  };
  espiaPan.mockRestore();
  return recognizer.handlers;

  function montarActual() {
    return Promise.resolve();
  }
}

describe('MicFuncion (mobile)', () => {
  beforeEach(() => {
    mockVoz.fase = 'inactivo';
    mockVoz.niveles = [];
    mockVoz.iniciar.mockClear().mockResolvedValue(true);
    mockVoz.detener.mockClear().mockResolvedValue(undefined);
    mockVoz.descartar.mockClear().mockResolvedValue(undefined);
    mockVoz.tomar.mockReset();
    mockTranscribir.mockReset();
    (deleteAsync as jest.Mock).mockClear();
  });

  it('sin `scrollRef`, BotonVoz igual monta (arbitraje del gesto se declara sin él)', async () => {
    await montar();
    expect(screen.getByTestId('boton-voz')).toBeTruthy();
  });

  it('un dictado llama onTranscripcion UNA sola vez y borra el archivo local (D6)', async () => {
    const espiaPan = jest.spyOn(Gesture, 'Pan');
    mockVoz.tomar.mockReturnValue({ nombre: 'voz.m4a', mime: 'audio/m4a', datos: 'file:///cache/voz.m4a' });
    mockTranscribir.mockResolvedValue({ transcript: 'compré cuarenta litros de nafta' });
    const { onTranscripcion } = await montar();

    const recognizer = espiaPan.mock.results[0].value as {
      handlers: { onBegin?: (e: unknown) => void; onFinalize?: (e: unknown, exito: boolean) => void };
    };
    espiaPan.mockRestore();
    let ahora = 1_000_000;
    const relojEspia = jest.spyOn(Date, 'now').mockImplementation(() => ahora);
    recognizer.handlers.onBegin?.({});
    ahora += 400; // supera DURACION_MINIMA_MS (350ms) de BotonVoz -- soltar cuenta como intención de grabar
    recognizer.handlers.onFinalize?.({}, true);
    relojEspia.mockRestore();

    await waitFor(() => expect(onTranscripcion).toHaveBeenCalledTimes(1));
    expect(onTranscripcion).toHaveBeenCalledWith('compré cuarenta litros de nafta');
    expect(mockTranscribir).toHaveBeenCalledWith(
      { nombre: 'voz.m4a', mime: 'audio/m4a', datos: 'file:///cache/voz.m4a' },
      'gasto',
    );
    expect(deleteAsync).toHaveBeenCalledWith('file:///cache/voz.m4a', { idempotent: true });
  });

  it('tras un dictado exitoso muestra el chip «Por voz · m:ss» con la duración (DoD FE1 #5)', async () => {
    const espiaPan = jest.spyOn(Gesture, 'Pan');
    mockVoz.tomar.mockReturnValue({ nombre: 'voz.m4a', mime: 'audio/m4a', datos: 'file:///cache/voz.m4a' });
    mockTranscribir.mockResolvedValue({ transcript: 'compré cuarenta litros de nafta' });
    await montar();

    expect(screen.queryByTestId('mic-funcion-chip')).toBeNull();

    const recognizer = espiaPan.mock.results[0].value as {
      handlers: { onBegin?: (e: unknown) => void; onFinalize?: (e: unknown, exito: boolean) => void };
    };
    espiaPan.mockRestore();
    let ahora = 1_000_000;
    const relojEspia = jest.spyOn(Date, 'now').mockImplementation(() => ahora);
    recognizer.handlers.onBegin?.({});
    ahora += 3200; // ~3s de dictado
    recognizer.handlers.onFinalize?.({}, true);
    relojEspia.mockRestore();

    await waitFor(() => expect(screen.getByTestId('mic-funcion-chip')).toBeTruthy());
    expect(screen.getByTestId('mic-funcion-chip')).toHaveTextContent('Por voz · 0:03');
  });

  it('sin audio grabado (tomar devuelve null), no llama a transcribir', async () => {
    const espiaPan = jest.spyOn(Gesture, 'Pan');
    mockVoz.tomar.mockReturnValue(null);
    const { onTranscripcion } = await montar();
    const recognizer = espiaPan.mock.results[0].value as {
      handlers: { onBegin?: (e: unknown) => void; onFinalize?: (e: unknown, exito: boolean) => void };
    };
    espiaPan.mockRestore();
    recognizer.handlers.onBegin?.({});
    recognizer.handlers.onFinalize?.({}, true);

    await new Promise((r) => setTimeout(r, 0));
    expect(mockTranscribir).not.toHaveBeenCalled();
    expect(onTranscripcion).not.toHaveBeenCalled();
  });

  it('un error del backend llega a onError en español y borra el archivo igual (finally)', async () => {
    const espiaPan = jest.spyOn(Gesture, 'Pan');
    mockVoz.tomar.mockReturnValue({ nombre: 'voz.m4a', mime: 'audio/m4a', datos: 'file:///cache/voz.m4a' });
    const { ApiError } = jest.requireActual('@copiloto/core');
    mockTranscribir.mockRejectedValue(new ApiError(422, 'unprocessable', 'audio_mudo'));
    const { onError } = await montar();
    const recognizer = espiaPan.mock.results[0].value as {
      handlers: { onBegin?: (e: unknown) => void; onFinalize?: (e: unknown, exito: boolean) => void };
    };
    espiaPan.mockRestore();
    let ahora = 1_000_000;
    const relojEspia = jest.spyOn(Date, 'now').mockImplementation(() => ahora);
    recognizer.handlers.onBegin?.({});
    ahora += 400;
    recognizer.handlers.onFinalize?.({}, true);
    relojEspia.mockRestore();

    await waitFor(() => expect(onError).toHaveBeenCalledWith('No se entendió el audio. Probá de nuevo.'));
    expect(deleteAsync).toHaveBeenCalledWith('file:///cache/voz.m4a', { idempotent: true });
  });

  // Filas `bloqueado`/`grabando` (TRIAJE15): el mismo composer, en contexto de formulario, tampoco deja
  // que el usuario adivine el gesto ni que «en pausa» dependa de que la onda deje de moverse.
  it('grabando sin fijar: pistas de cancelar y de candado (el mismo composer que el chat)', async () => {
    mockVoz.fase = 'grabando';
    await montar();

    expect(screen.getByTestId('voz-pistas')).toBeTruthy();
    expect(screen.getByTestId('voz-pista-candado')).toBeTruthy();
  });

  it('en reposo no hay pistas: el botón solo', async () => {
    await montar();

    expect(screen.queryByTestId('voz-pistas')).toBeNull();
    expect(screen.queryByTestId('voz-en-pausa')).toBeNull();
  });

  it('fijado y en pausa: «En pausa» en texto, sin pistas del gesto', async () => {
    const espiaPan = jest.spyOn(Gesture, 'Pan');
    mockVoz.fase = 'grabando';
    await montar();
    const recognizer = espiaPan.mock.results[0].value as {
      handlers: {
        onBegin?: (e: unknown) => void;
        onUpdate?: (e: { translationX: number; translationY: number }) => void;
      };
    };
    espiaPan.mockRestore();
    recognizer.handlers.onBegin?.({});
    recognizer.handlers.onUpdate?.({ translationX: 0, translationY: -(UMBRAL_FIJAR_PX + 1) });
    await waitFor(() => expect(screen.getByTestId('mic-funcion-fijado')).toBeTruthy());

    mockVoz.fase = 'pausado';
    await screen.rerender(
      <ThemeProvider>
        <MicFuncion onTranscripcion={jest.fn()} contexto="gasto" />
      </ThemeProvider>,
    );

    expect(screen.getByTestId('voz-en-pausa')).toHaveTextContent('En pausa');
    expect(screen.queryByTestId('voz-pistas')).toBeNull();
  });
});
