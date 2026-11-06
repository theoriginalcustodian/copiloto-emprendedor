import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

// Jest (jest-expo) -- describe/it/expect/jest son globales, no se importan de vitest.

jest.mock('expo-file-system/legacy', () => ({
  deleteAsync: jest.fn().mockResolvedValue(undefined),
}));

const mockVoz = {
  fase: 'grabando' as 'grabando' | 'inactivo',
  niveles: [] as number[],
  segundos: 0,
  iniciar: jest.fn().mockResolvedValue(true),
  pausar: jest.fn(),
  reanudar: jest.fn(),
  detener: jest.fn().mockResolvedValue(undefined),
  descartar: jest.fn().mockResolvedValue(undefined),
  tomar: jest.fn(),
};
jest.mock('../chat/useVozComando', () => ({ useVozComando: () => mockVoz }));

jest.mock('../chat/BotonVoz', () => {
  const { Pressable, Text } = require('react-native');
  return {
    BotonVoz: ({ onSoltarSinFijar }: any) => (
      <Pressable testID="mock-soltar" onPress={onSoltarSinFijar}>
        <Text>soltar</Text>
      </Pressable>
    ),
  };
});

const mockTranscribir = jest.fn();
jest.mock('@copiloto/core', () => {
  const actual = jest.requireActual('@copiloto/core');
  return { ...actual, transcribir: (...args: unknown[]) => mockTranscribir(...args) };
});

import { deleteAsync } from 'expo-file-system/legacy';

import { ThemeProvider } from '../../theme/ThemeProvider';
import { CHIP_VOZ_MS, DockFuncion } from './DockFuncion';

const AUDIO = { datos: 'file:///cache/voz.m4a', nombre: 'voz.m4a', tipo: 'audio/mp4' };

async function montar() {
  const onTexto = jest.fn();
  const onError = jest.fn();
  const arbol = () => (
    <ThemeProvider>
      <DockFuncion onTexto={onTexto} contexto="gasto" placeholder="Anotá un gasto, o hablá…" onError={onError} />
    </ThemeProvider>
  );
  const { rerender } = await render(arbol());
  return { onTexto, onError, remontar: () => rerender(arbol()) };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockVoz.fase = 'grabando';
  mockVoz.tomar.mockReturnValue(AUDIO);
});

describe('DockFuncion -- SM-I2: escrito y dictado caen en el mismo camino', () => {
  it('el dictado se transcribe con su contexto, llega como texto y deja el chip', async () => {
    mockTranscribir.mockResolvedValue({ transcript: '  café 1500  ' });
    const { onTexto, onError } = await montar();

    await fireEvent.press(screen.getByTestId('mock-soltar'));

    await waitFor(() => expect(onTexto).toHaveBeenCalledWith('café 1500', 'dictado'));
    expect(mockTranscribir).toHaveBeenCalledWith(AUDIO, 'gasto');
    expect(screen.getByTestId('dock-funcion-chip')).toHaveTextContent(/^Por voz · /);
    expect(onError).not.toHaveBeenCalled();
  });

  it('lo escrito llega marcado como escrito, sin transcribir y sin chip', async () => {
    mockVoz.fase = 'inactivo';
    const { onTexto } = await montar();

    await fireEvent.changeText(screen.getByTestId('chat-composer'), 'café 1500');
    await fireEvent.press(screen.getByTestId('chat-enviar'));

    await waitFor(() => expect(onTexto).toHaveBeenCalledWith('café 1500', 'escrito'));
    expect(mockTranscribir).not.toHaveBeenCalled();
    expect(screen.queryByTestId('dock-funcion-chip')).toBeNull();
  });

  it('🔴 cero retención: el archivo se borra también cuando la transcripción falla', async () => {
    mockTranscribir.mockRejectedValue(new Error('caída'));
    const { onTexto, onError } = await montar();

    await fireEvent.press(screen.getByTestId('mock-soltar'));

    await waitFor(() => expect(deleteAsync).toHaveBeenCalledWith(AUDIO.datos, { idempotent: true }));
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onTexto).not.toHaveBeenCalled();
    expect(screen.queryByTestId('dock-funcion-chip')).toBeNull();
  });

  it('un audio que no se entendió avisa y no entrega texto vacío', async () => {
    mockTranscribir.mockResolvedValue({ transcript: '   ' });
    const { onTexto, onError } = await montar();

    await fireEvent.press(screen.getByTestId('mock-soltar'));

    await waitFor(() => expect(onError).toHaveBeenCalledWith('No se entendió el audio. Probá de nuevo.'));
    expect(onTexto).not.toHaveBeenCalled();
    expect(deleteAsync).toHaveBeenCalledTimes(1);
  });
});

describe('DockFuncion -- SM-P14: sin barra de confirmación, y el chip no queda colgado', () => {
  it('🔴 un dictado NO deja barra «Entendí / Descartar / Enviar»: el texto llega directo a onTexto (el chat lo muestra)', async () => {
    mockTranscribir.mockResolvedValue({ transcript: 'El' });
    const { onTexto } = await montar();

    await fireEvent.press(screen.getByTestId('mock-soltar'));

    await waitFor(() => expect(onTexto).toHaveBeenCalledWith('El', 'dictado'));
    expect(screen.queryByTestId('dock-funcion-confirmar')).toBeNull();
    expect(screen.queryByText(/Entendí/)).toBeNull();
  });

  it('el chip «Por voz» se limpia solo a los CHIP_VOZ_MS: no afirma un dictado que ya pasó', async () => {
    jest.useFakeTimers();
    try {
      mockTranscribir.mockResolvedValue({ transcript: 'café 1500' });
      await montar();
      await fireEvent.press(screen.getByTestId('mock-soltar'));
      await waitFor(() => expect(screen.getByTestId('dock-funcion-chip')).toBeTruthy());

      await act(async () => {
        jest.advanceTimersByTime(CHIP_VOZ_MS - 1);
      });
      expect(screen.getByTestId('dock-funcion-chip')).toBeTruthy();

      await act(async () => {
        jest.advanceTimersByTime(2);
      });
      expect(screen.queryByTestId('dock-funcion-chip')).toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });

  it('el chip se limpia al ENVIAR un texto escrito', async () => {
    mockTranscribir.mockResolvedValue({ transcript: 'café 1500' });
    const { onTexto, remontar } = await montar();
    await fireEvent.press(screen.getByTestId('mock-soltar'));
    await waitFor(() => expect(screen.getByTestId('dock-funcion-chip')).toBeTruthy());
    mockVoz.fase = 'inactivo';
    await remontar();

    await fireEvent.changeText(screen.getByTestId('chat-composer'), 'otro gasto');
    await fireEvent.press(screen.getByTestId('chat-enviar'));

    await waitFor(() => expect(onTexto).toHaveBeenCalledWith('otro gasto', 'escrito'));
    expect(screen.queryByTestId('dock-funcion-chip')).toBeNull();
  });
});