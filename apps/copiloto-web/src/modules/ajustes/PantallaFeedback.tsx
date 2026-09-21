import { useCallback, useEffect, useRef, useState } from 'react';

import { ApiError, enviarFeedback, enviarFeedbackAudio } from '@copiloto/core';

import { Button } from '../../design-system';
import './ajustes.css';

/**
 * `PantallaFeedback` — «Contanos qué tal» en web (BL-W3), port de
 * `apps/mobile/src/modules/feedback/PantallaFeedback.tsx`. Texto y voz son dos caminos
 * independientes (`/feedback`, `/feedback/audio`); el registro lo lee el panel admin.
 *
 * 🔴 **Pregunta guiada, no caja vacía**: «¿Qué le cambiarías?» devuelve respuestas concretas; una
 * etiqueta «Tu feedback» pide una evaluación general, lo más difícil de contestar y lo menos accionable.
 *
 * 🔴 **La derivación a Soporte es lo importante**: sin ella un problema real cae en la caja de
 * sugerencias, que por diseño nadie contesta. Acá se dice de frente cuál es cada camino.
 *
 * La voz es tap-para-grabar / tap-para-enviar (no mantener): el feedback es una acción deliberada y poco
 * frecuente. Cero retención: el blob sólo vive hasta que se sube; el backend transcribe.
 */
export interface PantallaFeedbackProps {
  /** Lleva a Soporte técnico. Lo inyecta el shell. */
  onAbrirSoporte?: () => void;
  /** Pantalla de origen — viaja como `contexto`, sólo informativo para el backend. */
  contexto?: string;
}

type Envio = 'idle' | 'enviando' | 'confirmado' | 'error';

const LIMITE_TEXTO = 2000;
const CANDIDATE_MIME_TYPES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'];

function elegirMime(): string | undefined {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
    return undefined;
  }
  return CANDIDATE_MIME_TYPES.find((t) => MediaRecorder.isTypeSupported(t));
}

function detalleDe(err: unknown, porDefecto: string): string {
  const d = err instanceof ApiError ? err.detail : null;
  return d != null && d !== '' ? d : porDefecto;
}

function extensionDe(mime: string): string {
  if (mime.includes('mp4')) return 'm4a';
  if (mime.includes('ogg')) return 'ogg';
  return 'webm';
}

export function PantallaFeedback({ onAbrirSoporte, contexto }: PantallaFeedbackProps = {}) {
  const [texto, setTexto] = useState('');
  const [envioTexto, setEnvioTexto] = useState<Envio>('idle');
  const [errorTexto, setErrorTexto] = useState<string | null>(null);

  const [grabando, setGrabando] = useState(false);
  const [envioAudio, setEnvioAudio] = useState<Envio>('idle');
  const [errorAudio, setErrorAudio] = useState<string | null>(null);
  const [transcripcion, setTranscripcion] = useState<string | null>(null);

  const recRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  const soltarMic = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  // Salir de la pantalla con el mic abierto lo dejaría prendido: se suelta al desmontar.
  useEffect(
    () => () => {
      if (recRef.current && recRef.current.state !== 'inactive') {
        recRef.current.onstop = null;
        recRef.current.stop();
      }
      soltarMic();
    },
    [soltarMic],
  );

  const puedeEnviarTexto = texto.trim() !== '' && envioTexto !== 'enviando';

  async function enviarTextoAhora() {
    setEnvioTexto('enviando');
    setErrorTexto(null);
    try {
      await enviarFeedback(texto.trim(), contexto);
      setEnvioTexto('confirmado');
      setTexto('');
    } catch (err) {
      setErrorTexto(detalleDe(err, 'No pudimos enviar tu feedback.'));
      setEnvioTexto('error');
    }
  }

  async function subirAudio(blob: Blob, mime: string) {
    setEnvioAudio('enviando');
    setErrorAudio(null);
    setTranscripcion(null);
    try {
      const res = await enviarFeedbackAudio(
        { nombre: `feedback.${extensionDe(mime)}`, mime, datos: blob },
        contexto,
      );
      setEnvioAudio('confirmado');
      setTranscripcion(res.transcripcion);
    } catch (err) {
      setErrorAudio(detalleDe(err, 'No pudimos enviar tu feedback por voz.'));
      setEnvioAudio('error');
    }
  }

  async function alTocarMic() {
    if (grabando) {
      // `onstop` sube el blob: MediaRecorder entrega el último chunk recién al detenerse.
      recRef.current?.stop();
      return;
    }
    setErrorAudio(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = elegirMime();
      const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e: BlobEvent) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        setGrabando(false);
        soltarMic();
        const tipo = rec.mimeType || mime || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type: tipo });
        chunksRef.current = [];
        if (blob.size > 0) void subirAudio(blob, tipo);
      };
      recRef.current = rec;
      rec.start();
      setGrabando(true);
    } catch {
      soltarMic();
      setErrorAudio('No pudimos usar el micrófono. Revisá el permiso del navegador o escribinos el feedback.');
      setEnvioAudio('error');
    }
  }

  return (
    <div className="feedback-screen" data-testid="pantalla-feedback">
      <h1 className="como-hablarle-screen__title" data-testid="feedback-pregunta">
        ¿Qué le cambiarías?
      </h1>
      <p className="como-hablarle-screen__intro">
        Contanos qué te gustaría que mejoremos, o grabá un audio si preferís hablarlo.
      </p>

      <label className="feedback-screen__label" htmlFor="feedback-texto">
        Tu feedback
      </label>
      <textarea
        id="feedback-texto"
        className="feedback-screen__texto"
        data-testid="feedback-texto"
        value={texto}
        maxLength={LIMITE_TEXTO}
        rows={5}
        placeholder="Qué funcionó, qué no, qué te gustaría que exista…"
        onChange={(e) => setTexto(e.target.value)}
      />
      <div aria-live="polite">
        {envioTexto === 'error' && errorTexto != null && (
          <p className="feedback-screen__error" role="alert" data-testid="feedback-texto-error">
            {errorTexto}
          </p>
        )}
        {envioTexto === 'confirmado' && (
          <p className="feedback-screen__ok" data-testid="feedback-texto-confirmado">
            ¡Gracias! Guardamos tu feedback.
          </p>
        )}
      </div>
      <Button
        onClick={() => void enviarTextoAhora()}
        disabled={!puedeEnviarTexto}
        data-testid="feedback-texto-enviar"
      >
        {envioTexto === 'enviando' ? 'Enviando…' : 'Enviar'}
      </Button>

      <button
        type="button"
        className="feedback-screen__soporte"
        data-testid="feedback-a-soporte"
        onClick={onAbrirSoporte}
      >
        <span className="feedback-screen__soporte-titulo">¿Algo no funciona?</span>
        <span className="feedback-screen__soporte-detalle">
          Contalo en Soporte técnico: ahí te contestamos y, si hace falta, abrimos un ticket. Esto de acá lo
          leemos, pero no lo respondemos.
        </span>
      </button>

      <div className="feedback-screen__voz">
        <Button
          onClick={() => void alTocarMic()}
          disabled={envioAudio === 'enviando'}
          data-testid="feedback-mic"
          aria-label={grabando ? 'Detener grabación y enviar' : 'Grabar feedback por voz'}
        >
          {grabando ? 'Detener y enviar' : 'Grabar por voz'}
        </Button>
        <div aria-live="polite">
          <p className="feedback-screen__estado">
            {grabando ? 'Grabando… tocá de nuevo para enviar' : envioAudio === 'enviando' ? 'Enviando…' : ''}
          </p>
          {envioAudio === 'error' && errorAudio != null && (
            <p className="feedback-screen__error" role="alert" data-testid="feedback-audio-error">
              {errorAudio}
            </p>
          )}
          {envioAudio === 'confirmado' && transcripcion != null && (
            <p className="feedback-screen__ok" data-testid="feedback-audio-confirmado">
              Guardamos: «{transcripcion}»
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
