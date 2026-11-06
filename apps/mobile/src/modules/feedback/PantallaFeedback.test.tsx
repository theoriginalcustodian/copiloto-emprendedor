import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), dismissAll: jest.fn() },
  useFocusEffect: jest.fn(),
}));

jest.mock('expo-file-system/legacy', () => ({
  deleteAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@copiloto/core', () => {
  const actual = jest.requireActual('@copiloto/core');
  return {
    ...actual,
    enviarFeedback: jest.fn(),
    enviarFeedbackAudio: jest.fn(),
    listarFeedbackPropio: jest.fn().mockResolvedValue([]),
  };
});

/** Mismo arnés que `modules/voz/DockFuncion.test.tsx`: el gesto del mic se reemplaza por un toque que suelta. */
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

import { router } from 'expo-router';

import { ApiError, enviarFeedback, enviarFeedbackAudio } from '@copiloto/core';

import { tomarPendiente } from '../chat/mensajePendiente';
import { ThemeProvider } from '../../theme/ThemeProvider';
import { PantallaFeedback } from './PantallaFeedback';

const AUDIO = { datos: 'file:///cache/voz.m4a', nombre: 'voz.m4a', tipo: 'audio/mp4' };

async function montar() {
  return render(
    <ThemeProvider>
      <PantallaFeedback contexto="Mi cuenta" />
    </ThemeProvider>,
  );
}

async function escribirYEnviar(texto: string) {
  await fireEvent.changeText(screen.getByTestId('chat-composer'), texto);
  await fireEvent.press(screen.getByTestId('chat-enviar'));
}

describe('PantallaFeedback — el campo y el mic del dock mandan a /feedback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(enviarFeedback).mockReset();
    jest.mocked(enviarFeedbackAudio).mockReset();
    // `inactivo`: con `grabando` el dock reemplaza el campo por la barra de captura y no hay dónde escribir.
    mockVoz.fase = 'inactivo';
    mockVoz.tomar.mockReturnValue(AUDIO);
    tomarPendiente();
  });

  it('renderiza el marco y el dock al pie', async () => {
    await montar();
    expect(screen.getByTestId('pantalla-feedback')).toBeTruthy();
    expect(screen.getByTestId('dock-funcion')).toBeTruthy();
  });

  it('🔴 el pie viejo ya no existe: sin «Dictarlo», sin «Mandar», sin textarea propio', async () => {
    await montar();
    expect(screen.queryByTestId('feedback-mic')).toBeNull();
    expect(screen.queryByTestId('feedback-texto-enviar')).toBeNull();
    expect(screen.queryByTestId('feedback-texto')).toBeNull();
    expect(screen.queryByText('Dictarlo')).toBeNull();
    expect(screen.queryByText('Mandar')).toBeNull();
  });

  describe('texto', () => {
    it('éxito: llama enviarFeedback con el texto+contexto y confirma', async () => {
      jest.mocked(enviarFeedback).mockResolvedValueOnce({ id: 1, ok: true });
      await montar();

      await escribirYEnviar('me encantó el picker de fotos');

      await waitFor(() =>
        expect(enviarFeedback).toHaveBeenCalledWith('me encantó el picker de fotos', 'Mi cuenta'),
      );
      await waitFor(() => expect(screen.getByTestId('feedback-texto-confirmado')).toBeTruthy());
    });

    it('422 (texto demasiado largo) muestra el `detail` del backend tal cual', async () => {
      jest.mocked(enviarFeedback).mockRejectedValueOnce(
        new ApiError(422, 'msg', 'feedback demasiado largo (máx 2000 caracteres)'),
      );
      await montar();

      await escribirYEnviar('x'.repeat(2001));

      await waitFor(() =>
        expect(screen.getByTestId('feedback-texto-error')).toHaveTextContent(
          'feedback demasiado largo (máx 2000 caracteres)',
        ),
      );
    });

    it('error de red sin `detail` muestra el aviso genérico', async () => {
      jest.mocked(enviarFeedback).mockRejectedValueOnce(new Error('network down'));
      await montar();

      await escribirYEnviar('algo');

      await waitFor(() =>
        expect(screen.getByTestId('feedback-texto-error')).toHaveTextContent('No pudimos enviar tu feedback.'),
      );
    });
  });

  describe('voz', () => {
    it('dictar manda el AUDIO CRUDO a enviarFeedbackAudio con el contexto, y muestra la transcripción', async () => {
      jest.mocked(enviarFeedbackAudio).mockResolvedValueOnce({ id: 2, ok: true, transcripcion: 'me encantó la app' });
      await montar();

      await fireEvent.press(screen.getByTestId('mock-soltar'));

      await waitFor(() => expect(enviarFeedbackAudio).toHaveBeenCalledWith(AUDIO, 'Mi cuenta'));
      await waitFor(() =>
        expect(screen.getByTestId('feedback-audio-confirmado')).toHaveTextContent('Guardamos: "me encantó la app"'),
      );
    });

    it('413 (audio muy grande) muestra el `detail` del backend', async () => {
      jest.mocked(enviarFeedbackAudio).mockRejectedValueOnce(new ApiError(413, 'msg', 'audio demasiado grande'));
      await montar();

      await fireEvent.press(screen.getByTestId('mock-soltar'));

      await waitFor(() =>
        expect(screen.getByTestId('feedback-audio-error')).toHaveTextContent('audio demasiado grande'),
      );
    });
  });

  describe('🔴 NO deriva al chat (el inverso de «Cómo usar la app»)', () => {
    it('escribir NO deja pendiente ni descarta la pila: el feedback se queda en /feedback', async () => {
      jest.mocked(enviarFeedback).mockResolvedValueOnce({ id: 3, ok: true });
      await montar();

      await escribirYEnviar('el feedback no es un mensaje al chat');

      await waitFor(() => expect(enviarFeedback).toHaveBeenCalledTimes(1));
      expect(tomarPendiente()).toBeNull();
      expect(router.dismissAll).not.toHaveBeenCalled();
      expect(router.back).not.toHaveBeenCalled();
    });

    it('dictar tampoco', async () => {
      jest.mocked(enviarFeedbackAudio).mockResolvedValueOnce({ id: 4, ok: true, transcripcion: 'hola' });
      await montar();

      await fireEvent.press(screen.getByTestId('mock-soltar'));

      await waitFor(() => expect(enviarFeedbackAudio).toHaveBeenCalledTimes(1));
      expect(tomarPendiente()).toBeNull();
      expect(router.dismissAll).not.toHaveBeenCalled();
    });

    it('la fuente (sin comentarios) no llama dejarPendiente/dismissAll ni monta un segundo grabador', () => {
      const fs = require('fs') as typeof import('fs');
      const path = require('path') as typeof import('path');
      const fuente = fs
        .readFileSync(path.join(__dirname, 'PantallaFeedback.tsx'), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '');
      expect(fuente).not.toMatch(/dejarPendiente|dismissAll|useVozComando/);
      // Control de que el instrumento mira: sí contiene lo que debe.
      expect(fuente).toMatch(/enviarFeedbackAudio\(archivo, contexto\)/);
      expect(fuente).toMatch(/enviarFeedback\(limpio, contexto\)/);
    });
  });
});
