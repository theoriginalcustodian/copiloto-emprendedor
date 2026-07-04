import { useCallback, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';

import { RecordingOverlay } from './RecordingOverlay';
import './chat.css';

export interface MicButtonProps {
  /** Se llama con el blob grabado cuando el gesto termina en "enviar" (soltar sin fijar, o el
   * botón Enviar del overlay fijado). NUNCA se llama si se cancela o si no hubo audio. */
  onSendAudio: (blob: Blob) => void;
  disabled?: boolean;
}

/** Umbral de arrastre hacia arriba (px) que "fija" la grabación — EXTRACT §2.10 (verbatim: >46px). */
const LOCK_THRESHOLD_PX = 46;
const TIMER_TICK_MS = 100;

/** Candidatos de mimeType en orden de preferencia — Chrome soporta webm/opus, Safari mp4/aac
 * (EXTRACT §2.10 nota de implementación: "usá el mimeType soportado"). */
const CANDIDATE_MIME_TYPES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];

function pickSupportedMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
    return undefined;
  }
  return CANDIDATE_MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type));
}

/**
 * Mic del composer (Task 19, FASE 4) — gesto tipo WhatsApp real sobre Pointer Events:
 *   - `pointerdown` en el botón: pide permiso de mic (`getUserMedia`) y arranca `MediaRecorder`.
 *   - mientras se mantiene: overlay (`RecordingOverlay`) con waveform/dot/timer.
 *   - soltar SIN haber deslizado hacia arriba >46px = **envía** (contrato resuelto — el mock
 *     original dejaba esto ambiguo, EXTRACT §5 desviación #8; este componente NO cancela al
 *     soltar, siempre envía salvo que el usuario toque "Cancelar" explícito estando fijado).
 *   - deslizar hacia arriba >46px = **fija** (manos libres): aparecen los botones explícitos
 *     Cancelar / Enviar del overlay, el pointerup ya no hace nada por sí solo.
 *
 * `touch-action:none` en el botón (chat.css) evita que el gesto de grabar también scrollee el
 * chat por debajo (requisito explícito del task).
 */
export function MicButton({ onSendAudio, disabled }: MicButtonProps) {
  const [recording, setRecording] = useState(false);
  const [locked, setLocked] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [permissionError, setPermissionError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const mimeTypeRef = useRef<string | undefined>(undefined);
  const startYRef = useRef(0);
  // Espejo síncrono de `locked` — los listeners de `document` (pointermove/up) se registran una
  // sola vez por gesto y leen closures viejas; el estado de React no sirve para esa lectura.
  const lockedRef = useRef(false);
  const pendingSendRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef(0);

  const stopTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const releaseStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const resetState = useCallback(() => {
    setRecording(false);
    setLocked(false);
    lockedRef.current = false;
    setElapsedMs(0);
    chunksRef.current = [];
    mediaRecorderRef.current = null;
    stopTimer();
    releaseStream();
  }, [releaseStream, stopTimer]);

  /** Para la grabación; `shouldSend` decide si `onstop` (más abajo) despacha el blob o lo descarta. */
  const finishRecording = useCallback((shouldSend: boolean) => {
    pendingSendRef.current = shouldSend;
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === 'inactive') {
      resetState();
      return;
    }
    recorder.stop();
  }, [resetState]);

  const startRecording = useCallback(
    async (clientY: number) => {
      setPermissionError(null);

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch {
        setPermissionError('No pudimos acceder al micrófono. Revisá los permisos del navegador.');
        return;
      }

      streamRef.current = stream;
      const mimeType = pickSupportedMimeType();
      mimeTypeRef.current = mimeType;
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      chunksRef.current = [];

      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeTypeRef.current ?? 'audio/webm' });
        const shouldSend = pendingSendRef.current;
        resetState();
        if (shouldSend && blob.size > 0) onSendAudio(blob);
      };

      mediaRecorderRef.current = recorder;
      recorder.start();

      startYRef.current = clientY;
      lockedRef.current = false;
      setLocked(false);
      setRecording(true);
      startedAtRef.current = Date.now();
      setElapsedMs(0);
      timerRef.current = setInterval(() => {
        setElapsedMs(Date.now() - startedAtRef.current);
      }, TIMER_TICK_MS);
    },
    [onSendAudio, resetState],
  );

  function handlePointerDown(event: ReactPointerEvent<HTMLButtonElement>) {
    if (disabled) return;
    event.preventDefault();
    void startRecording(event.clientY);

    function handlePointerMove(moveEvent: PointerEvent) {
      const delta = startYRef.current - moveEvent.clientY;
      if (!lockedRef.current && delta > LOCK_THRESHOLD_PX) {
        lockedRef.current = true;
        setLocked(true);
      }
    }
    function handlePointerUp() {
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
      if (!lockedRef.current) {
        finishRecording(true); // soltó sin fijar -> envía (contrato del gesto)
      }
      // fijado: no hace nada acá — espera Cancelar/Enviar explícitos del overlay.
    }
    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);
  }

  return (
    <>
      <button
        type="button"
        className="composer__mic"
        onPointerDown={handlePointerDown}
        disabled={disabled}
        aria-label="Mantené presionado para grabar audio"
        data-testid="mic-button"
      >
        🎙
      </button>

      {recording && (
        <RecordingOverlay
          elapsedMs={elapsedMs}
          locked={locked}
          onCancel={() => finishRecording(false)}
          onSend={() => finishRecording(true)}
        />
      )}

      {permissionError && (
        <p className="composer__mic-error" role="alert">
          {permissionError}
        </p>
      )}
    </>
  );
}
