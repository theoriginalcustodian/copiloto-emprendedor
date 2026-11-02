import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

// Jest (jest-expo) -- describe/it/expect/jest son globales, no se importan de vitest.

jest.mock('expo-file-system/legacy', () => ({
  deleteAsync: jest.fn().mockResolvedValue(undefined),
}));

const mockVoz = {
  fase: 'grabando' as const,
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
import { DockFuncion } from './DockFuncion';

const AUDIO = { datos: 'file:///cache/voz.m4a', nombre: 'voz.m4a', tipo: 'audio/mp4' };

async function montar() {
  const onTexto = jest.fn();
  const onError = jest.fn();
  await render(
    <ThemeProvider>
      <DockFuncion onTexto={onTexto} contexto="gasto" placeholder="Anotá un gasto, o hablá…" onError={onError} />
    </ThemeProvider>,
  );
  return { onTexto, onError };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockVoz.tomar.mockReturnValue(AUDIO);
});

describe('DockFuncion -- SM-I2: escrito y dictado caen en el mismo camino', () => {
  it('el dictado se transcribe con su contexto, llega como texto y deja el chip', async () => {
    mockTranscribir.mockResolvedValue({ transcript: '  café 1500  ' });
    const { onTexto, onError } = await montar();

    await fireEvent.press(screen.getByTestId('mock-soltar'));

    await waitFor(() => expect(onTexto).toHaveBeenCalledWith('café 1500'));
    expect(mockTranscribir).toHaveBeenCalledWith(AUDIO, 'gasto');
    expect(screen.getByTestId('dock-funcion-chip')).toHaveTextContent(/^Por voz · /);
    expect(onError).not.toHaveBeenCalled();
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
