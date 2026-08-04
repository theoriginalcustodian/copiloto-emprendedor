import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

jest.mock('@copiloto/core', () => {
  const actual = jest.requireActual('@copiloto/core');
  return {
    ...actual,
    enviarFeedback: jest.fn(),
    enviarFeedbackAudio: jest.fn(),
  };
});

/**
 * Mock LOCAL de `expo-audio` (pisa el global de `jest.setup.js`, que no trae `getStatus` — mismo
 * criterio que `useVozComando.test.ts`, molde de este mock). `uri` es MUTABLE: arranca `null`
 * (nada grabado) y el test que simula una grabación exitosa lo pisa antes de "detener".
 */
const mockGrabador = {
  prepareToRecordAsync: jest.fn().mockResolvedValue(undefined),
  record: jest.fn(),
  pause: jest.fn(),
  stop: jest.fn().mockResolvedValue(undefined),
  getStatus: jest.fn(() => ({ durationMillis: 0, metering: -60 })),
  uri: null as string | null,
};

jest.mock('expo-audio', () => ({
  RecordingPresets: { HIGH_QUALITY: {} },
  useAudioRecorder: () => mockGrabador,
  requestRecordingPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
  setAudioModeAsync: jest.fn().mockResolvedValue(undefined),
}));

import { ApiError, enviarFeedback, enviarFeedbackAudio } from '@copiloto/core';

import { ThemeProvider } from '../../theme/ThemeProvider';
import { PantallaFeedback } from './PantallaFeedback';

async function montar() {
  return render(
    <ThemeProvider>
      <PantallaFeedback contexto="Mi cuenta" />
    </ThemeProvider>,
  );
}

describe('PantallaFeedback', () => {
  beforeEach(() => {
    jest.mocked(enviarFeedback).mockReset();
    jest.mocked(enviarFeedbackAudio).mockReset();
    mockGrabador.uri = null;
  });

  it('renderiza el marco con título "Feedback"', async () => {
    await montar();
    expect(screen.getByTestId('pantalla-feedback')).toBeTruthy();
  });

  describe('texto', () => {
    it('"Enviar" arranca deshabilitado — texto vacío', async () => {
      await montar();
      expect(screen.getByTestId('feedback-texto-enviar')).toBeDisabled();
    });

    it('éxito: llama enviarFeedback con el texto+contexto, confirma y limpia el campo', async () => {
      jest.mocked(enviarFeedback).mockResolvedValueOnce({ id: 1, ok: true });
      await montar();

      await fireEvent.changeText(screen.getByTestId('feedback-texto-input'), 'me encantó el picker de fotos');
      await fireEvent.press(screen.getByTestId('feedback-texto-enviar'));

      await waitFor(() =>
        expect(enviarFeedback).toHaveBeenCalledWith('me encantó el picker de fotos', 'Mi cuenta'),
      );
      expect(screen.getByTestId('feedback-texto-confirmado')).toBeTruthy();
      expect(screen.getByTestId('feedback-texto-input').props.value).toBe('');
    });

    it('422 (texto demasiado largo) muestra el `detail` del backend tal cual', async () => {
      jest.mocked(enviarFeedback).mockRejectedValueOnce(
        new ApiError(422, 'msg', 'feedback demasiado largo (máx 2000 caracteres)'),
      );
      await montar();

      await fireEvent.changeText(screen.getByTestId('feedback-texto-input'), 'x'.repeat(2001));
      await fireEvent.press(screen.getByTestId('feedback-texto-enviar'));

      await waitFor(() =>
        expect(screen.getByTestId('feedback-texto-error')).toHaveTextContent(
          'feedback demasiado largo (máx 2000 caracteres)',
        ),
      );
    });

    it('error de red sin `detail` muestra el aviso genérico', async () => {
      jest.mocked(enviarFeedback).mockRejectedValueOnce(new Error('network down'));
      await montar();

      await fireEvent.changeText(screen.getByTestId('feedback-texto-input'), 'algo');
      await fireEvent.press(screen.getByTestId('feedback-texto-enviar'));

      await waitFor(() =>
        expect(screen.getByTestId('feedback-texto-error')).toHaveTextContent('No pudimos enviar tu feedback.'),
      );
    });
  });

  describe('voz', () => {
    it('tocar el mic arranca la grabación — muestra "Grabando…"', async () => {
      await montar();
      await fireEvent.press(screen.getByTestId('feedback-mic'));
      expect(mockGrabador.record).toHaveBeenCalled();
      expect(screen.getByText(/Grabando…/)).toBeTruthy();
    });

    it('grabar y volver a tocar envía el audio y muestra la transcripción como confirmación', async () => {
      jest.mocked(enviarFeedbackAudio).mockResolvedValueOnce({
        id: 2,
        ok: true,
        transcripcion: 'me encantó la app',
      });
      await montar();

      await fireEvent.press(screen.getByTestId('feedback-mic')); // iniciar
      mockGrabador.uri = 'file:///cache/voz.m4a'; // simula que el grabador YA tiene audio
      await fireEvent.press(screen.getByTestId('feedback-mic')); // detener + enviar

      await waitFor(() =>
        expect(enviarFeedbackAudio).toHaveBeenCalledWith(
          { nombre: 'voz.m4a', mime: 'audio/mp4', datos: 'file:///cache/voz.m4a' },
          'Mi cuenta',
        ),
      );
      expect(screen.getByTestId('feedback-audio-confirmado')).toHaveTextContent(
        'Guardamos: "me encantó la app"',
      );
    });

    it('413 (audio muy grande) muestra el `detail` del backend', async () => {
      jest.mocked(enviarFeedbackAudio).mockRejectedValueOnce(
        new ApiError(413, 'msg', 'audio demasiado grande'),
      );
      await montar();

      await fireEvent.press(screen.getByTestId('feedback-mic'));
      mockGrabador.uri = 'file:///cache/voz.m4a';
      await fireEvent.press(screen.getByTestId('feedback-mic'));

      await waitFor(() =>
        expect(screen.getByTestId('feedback-audio-error')).toHaveTextContent('audio demasiado grande'),
      );
    });
  });
});
