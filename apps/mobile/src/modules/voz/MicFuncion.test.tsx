import { useEffect } from 'react';
import { StyleSheet, Text } from 'react-native';
import { act, render, screen, waitFor, within } from '@testing-library/react-native';
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

  it('fijado y en pausa: sin pistas ni barra sostenida del gesto (los controles tomaron el mando)', async () => {
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

    // «En pausa» en texto lo pinta `ControlesFlotantes` (su propio test); acá, que MicFuncion no
    // deje la barra del gesto ni el candado encima de los controles.
    expect(screen.queryByTestId('voz-pistas')).toBeNull();
    expect(screen.queryByTestId('voz-barra-sostenida')).toBeNull();
  });
});

/**
 * N8 (relevamiento 2026-10-16). Medido en device: en Gastos la barra de grabación (punto + reloj + «Deslizá para
 * cancelar») crecía DENTRO de la columna angosta del mic y le robaba el ancho a «Anotar un gasto» (~38 dp,
 * «An·o·tar·un·ga·sto»), el reloj pisaba al chevron, y al fijar los controles flotaban a media pantalla con una
 * onda de ~20 dp. jsdom no mide píxeles: lo que se fija acá es la ESTRUCTURA que lo evita (quién comparte fila con
 * quién, qué se reemplaza, qué sólo se esconde); que se vea bien en el teléfono se prueba en device.
 */
describe('MicFuncion — la fila del dictado se transforma, no se apila (N8)', () => {
  const montajesDelAlta = jest.fn();
  /** Un `alLado` con estado propio: si `MicFuncion` lo desmontara al fijar, `montajesDelAlta` contaría 2. */
  function Alta() {
    useEffect(() => {
      montajesDelAlta();
    }, []);
    return <Text testID="alta-de-prueba">Anotar un gasto</Text>;
  }
  const alLado = <Alta />;
  const antes = <Text testID="antes-de-prueba">foto</Text>;

  /** El ancestro más bajo de `a` que también contiene a `b`: dónde se separan en el árbol. */
  function ancestroComun(a: ReturnType<typeof screen.getByTestId>, testIDDeB: string) {
    for (let n = a.parent; n != null; n = n.parent) {
      if (within(n).queryByTestId(testIDDeB) != null) return n;
    }
    return null;
  }

  beforeEach(() => {
    mockVoz.fase = 'inactivo';
    mockVoz.niveles = [];
    montajesDelAlta.mockClear();
  });

  it('en reposo: [antes] [mic] [alLado] a la vista, y ninguna barra de grabación', async () => {
    await montar({ antes, alLado });

    expect(screen.getByTestId('antes-de-prueba')).toBeTruthy();
    expect(screen.getByTestId('boton-voz')).toBeTruthy();
    expect(screen.getByTestId('alta-de-prueba')).toBeTruthy();
    expect(screen.queryByTestId('voz-barra-sostenida')).toBeNull();
  });

  it('sosteniendo el mic: la barra TOMA EL LUGAR del botón de alta, y la foto sigue donde estaba', async () => {
    mockVoz.fase = 'grabando';
    await montar({ antes, alLado });

    expect(screen.getByTestId('voz-barra-sostenida')).toBeTruthy();
    expect(screen.getByTestId('voz-reloj')).toBeTruthy();
    // Es un REEMPLAZO en su misma ranura, no un agregado: el botón de alta sale del árbol mientras dura el gesto.
    expect(screen.queryByTestId('alta-de-prueba')).toBeNull();
    expect(screen.getByTestId('antes-de-prueba')).toBeTruthy();
  });

  it('la barra y el mic son HERMANOS de una FILA: ya no crece adentro de la columna del botón', async () => {
    mockVoz.fase = 'grabando';
    await montar({ antes, alLado });

    const comun = ancestroComun(screen.getByTestId('boton-voz'), 'voz-barra-sostenida');

    expect(comun).not.toBeNull();
    // Antes el ancestro común era la columna del mic (alineada al centro, ancho = lo que mide su contenido):
    // por eso el reloj + la pista le comían el ancho a todo lo demás. Ahora comparten una fila.
    expect(StyleSheet.flatten(comun!.props.style)?.flexDirection).toBe('row');
  });

  it('la onda y el candado FLOTAN encima del mic (absolutos): no suman alto a la fila', async () => {
    mockVoz.fase = 'grabando';
    await montar({ antes, alLado });

    const sobre = screen.getByTestId('voz-pistas').parent;
    let n = sobre;
    let flota: Record<string, unknown> | undefined;
    while (n != null && flota == null) {
      const estilo = StyleSheet.flatten(n.props.style) as Record<string, unknown> | undefined;
      if (estilo?.position === 'absolute') flota = estilo;
      n = n.parent;
    }

    expect(flota).toBeDefined();
    // Sin `elevation` el bloque oscuro (que la tiene) se dibuja ENCIMA en Android aunque venga antes en el árbol.
    expect(flota!.elevation).toBeGreaterThan(0);
  });

  it('fijado: los controles ocupan TODA la fila y antes/alLado se ESCONDEN sin desmontarse', async () => {
    const espiaPan = jest.spyOn(Gesture, 'Pan');
    mockVoz.fase = 'grabando';
    await montar({ antes, alLado });
    const recognizer = espiaPan.mock.results[0].value as {
      handlers: {
        onBegin?: (e: unknown) => void;
        onUpdate?: (e: { translationX: number; translationY: number }) => void;
      };
    };
    espiaPan.mockRestore();
    await act(async () => {
      recognizer.handlers.onBegin?.({});
      recognizer.handlers.onUpdate?.({ translationX: 0, translationY: -(UMBRAL_FIJAR_PX + 1) });
    });
    await waitFor(() => expect(screen.getByTestId('mic-funcion-fijado')).toBeTruthy());

    const fijado = screen.getByTestId('mic-funcion-fijado');
    expect(StyleSheet.flatten(fijado.props.style)?.alignSelf).toBe('stretch');
    // Esconder ≠ desmontar: lo que llega por `alLado` conserva su estado (un solo montaje en toda la sesión).
    expect(montajesDelAlta).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('alta-de-prueba', { includeHiddenElements: true })).not.toBeVisible();
    expect(screen.getByTestId('antes-de-prueba', { includeHiddenElements: true })).not.toBeVisible();
    // Y la barra del gesto ya no está: los controles tomaron el mando.
    expect(screen.queryByTestId('voz-barra-sostenida')).toBeNull();
  });

  it('sin antes/alLado (uso suelto, como antes de N8) monta igual y sin ranuras vacías', async () => {
    mockVoz.fase = 'grabando';
    await montar();

    expect(screen.getByTestId('boton-voz')).toBeTruthy();
    expect(screen.getByTestId('voz-barra-sostenida')).toBeTruthy();
  });
});
