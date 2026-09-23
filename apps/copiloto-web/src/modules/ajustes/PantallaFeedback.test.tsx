import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { enviarFeedback, enviarFeedbackAudio, listarFeedbackPropio } = vi.hoisted(() => ({
  enviarFeedback: vi.fn(),
  enviarFeedbackAudio: vi.fn(),
  listarFeedbackPropio: vi.fn(),
}));

vi.mock('@copiloto/core', async (orig) => ({
  ...(await orig<typeof import('@copiloto/core')>()),
  enviarFeedback,
  enviarFeedbackAudio,
  listarFeedbackPropio,
}));

import { ApiError } from '@copiloto/core';

import { PantallaFeedback } from './PantallaFeedback';

describe('PantallaFeedback (BL-W3)', () => {
  beforeEach(() => {
    enviarFeedback.mockReset();
    enviarFeedbackAudio.mockReset();
    listarFeedbackPropio.mockReset();
    listarFeedbackPropio.mockResolvedValue([]);
  });

  it('pregunta guiada, no caja vacía', () => {
    render(<PantallaFeedback />);
    expect(screen.getByTestId('feedback-pregunta')).toHaveTextContent('¿Qué le cambiarías?');
  });

  it('A4 Criterio 3 fila 2: título de página «Contanos qué tal» + labels literales del proto', () => {
    render(<PantallaFeedback />);
    expect(screen.getByTestId('feedback-titulo')).toHaveTextContent('Contanos qué tal');
    expect(screen.getByText(/Lo lee el equipo que construye Odobi/)).toBeInTheDocument();
    // Verbatim `index.html:2203-2204` — «Dictarlo» / «Mandar» (antes «Grabar por voz» / «Enviar»).
    expect(screen.getByTestId('feedback-mic')).toHaveTextContent('Dictarlo');
    expect(screen.getByTestId('feedback-texto-enviar')).toHaveTextContent('Mandar');
  });

  it('Enviar está deshabilitado sin texto y habilitado con texto', () => {
    render(<PantallaFeedback />);
    expect(screen.getByTestId('feedback-texto-enviar')).toBeDisabled();
    fireEvent.change(screen.getByTestId('feedback-texto'), { target: { value: 'más rápido' } });
    expect(screen.getByTestId('feedback-texto-enviar')).toBeEnabled();
  });

  it('envía el texto recortado con el contexto, confirma y limpia', async () => {
    enviarFeedback.mockResolvedValue(undefined);
    render(<PantallaFeedback contexto="ajustes" />);
    fireEvent.change(screen.getByTestId('feedback-texto'), { target: { value: '  más rápido  ' } });
    fireEvent.click(screen.getByTestId('feedback-texto-enviar'));
    expect(await screen.findByTestId('feedback-texto-confirmado')).toBeInTheDocument();
    expect(enviarFeedback).toHaveBeenCalledWith('más rápido', 'ajustes');
    expect(screen.getByTestId('feedback-texto')).toHaveValue('');
  });

  it('si falla, muestra el detalle del backend y conserva el texto', async () => {
    enviarFeedback.mockRejectedValue(new ApiError(500, 'x', 'Servicio caído'));
    render(<PantallaFeedback />);
    fireEvent.change(screen.getByTestId('feedback-texto'), { target: { value: 'hola' } });
    fireEvent.click(screen.getByTestId('feedback-texto-enviar'));
    expect(await screen.findByTestId('feedback-texto-error')).toHaveTextContent('Servicio caído');
    expect(screen.getByTestId('feedback-texto')).toHaveValue('hola');
  });

  it('«¿Algo no funciona?» deriva a Soporte', () => {
    const onAbrirSoporte = vi.fn();
    render(<PantallaFeedback onAbrirSoporte={onAbrirSoporte} />);
    fireEvent.click(screen.getByTestId('feedback-a-soporte'));
    expect(onAbrirSoporte).toHaveBeenCalledTimes(1);
  });

  describe('voz', () => {
    let stopTrack: ReturnType<typeof vi.fn>;

    class FakeRecorder {
      static isTypeSupported = () => true;
      state: 'inactive' | 'recording' = 'inactive';
      mimeType = 'audio/webm';
      ondataavailable: ((e: { data: Blob }) => void) | null = null;
      onstop: (() => void) | null = null;
      static ultima: FakeRecorder | null = null;
      constructor() {
        FakeRecorder.ultima = this;
      }
      start() {
        this.state = 'recording';
      }
      stop() {
        this.state = 'inactive';
        this.ondataavailable?.({ data: new Blob(['audio'], { type: 'audio/webm' }) });
        this.onstop?.();
      }
    }

    beforeEach(() => {
      stopTrack = vi.fn();
      vi.stubGlobal('MediaRecorder', FakeRecorder);
      Object.defineProperty(navigator, 'mediaDevices', {
        configurable: true,
        value: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop: stopTrack }] }) },
      });
    });
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('tap graba, tap envía el blob como archivo y muestra la transcripción', async () => {
      enviarFeedbackAudio.mockResolvedValue({ transcripcion: 'me gusta' });
      render(<PantallaFeedback contexto="ajustes" />);
      fireEvent.click(screen.getByTestId('feedback-mic'));
      await waitFor(() => expect(FakeRecorder.ultima?.state).toBe('recording'));
      expect(screen.getByTestId('feedback-mic')).toHaveTextContent('Detener y enviar');

      fireEvent.click(screen.getByTestId('feedback-mic'));
      expect(await screen.findByTestId('feedback-audio-confirmado')).toHaveTextContent('me gusta');
      const [archivo, ctx] = enviarFeedbackAudio.mock.calls[0];
      expect(archivo.nombre).toBe('feedback.webm');
      expect(archivo.datos).toBeInstanceOf(Blob);
      expect(ctx).toBe('ajustes');
      expect(stopTrack).toHaveBeenCalled();
    });

    it('sin permiso de micrófono: error visible, no se rompe', async () => {
      (navigator.mediaDevices.getUserMedia as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('denied'),
      );
      render(<PantallaFeedback />);
      fireEvent.click(screen.getByTestId('feedback-mic'));
      expect(await screen.findByTestId('feedback-audio-error')).toBeInTheDocument();
    });

    it('si el envío de voz falla, muestra el error', async () => {
      enviarFeedbackAudio.mockRejectedValue(new ApiError(502, 'x', 'No transcribimos'));
      render(<PantallaFeedback />);
      fireEvent.click(screen.getByTestId('feedback-mic'));
      await waitFor(() => expect(FakeRecorder.ultima?.state).toBe('recording'));
      fireEvent.click(screen.getByTestId('feedback-mic'));
      expect(await screen.findByTestId('feedback-audio-error')).toHaveTextContent('No transcribimos');
    });
  });
});
