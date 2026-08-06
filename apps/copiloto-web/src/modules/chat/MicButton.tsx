import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';

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
/** Umbral mínimo de "mantener presionado" (ms) para que soltar sin fijar cuente como intención de
 * grabar y envíe — hardening tap-corto: antes CUALQUIER pointerdown+pointerup (por más breve que
 * fuera) arrancaba a grabar y enviaba, incluso un toque accidental. */
const MIN_HOLD_MS = 350;
/** Duración del hint transitorio "Mantené presionado para grabar" tras descartar un tap corto. */
const HOLD_HINT_MS = 1600;

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
 *   - soltar antes de mantener `MIN_HOLD_MS` (350ms) sin fijar = **descarta** (tap corto, sin
 *     intención de grabar) y muestra un hint transitorio — no envía.
 *
 * `touch-action:none` en el botón (chat.css) evita que el gesto de grabar también scrollee el
 * chat por debajo (requisito explícito del task).
 *
 * Guard de race (hardening): `startRecording` es async (espera `getUserMedia`); si el `pointerup`
 * llega ANTES de que resuelva, `gestureActiveRef` ya está en `false` cuando el permiso finalmente
 * resuelve — el stream recién obtenido se libera de inmediato y NUNCA se arranca el recorder ni el
 * overlay. Sin este guard queda un overlay "unlocked" huérfano (sin botones, sin listeners de
 * gesto ya desenganchados) que el usuario no puede cerrar.
 */
export function MicButton({ onSendAudio, disabled }: MicButtonProps) {
  const [recording, setRecording] = useState(false);
  const [locked, setLocked] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [holdHint, setHoldHint] = useState(false);

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
  // Cleanup de los listeners de `document` del gesto en curso (si hay uno colgado) — lo llenan
  // `handlePointerDown`/`handlePointerUp` de abajo; lo lee el `useEffect` de desmontaje.
  const gestureCleanupRef = useRef<(() => void) | null>(null);
  // `true` mientras el dedo está apoyado (entre pointerdown y pointerup del gesto actual) — lo lee
  // `startRecording` tras el `await getUserMedia` para detectar si el gesto ya terminó (race).
  const gestureActiveRef = useRef(false);
  // Timestamp (`Date.now()`) del pointerdown — con esto `handlePointerUp` calcula cuánto se
  // mantuvo presionado para decidir tap-corto (descarta) vs hold real (envía).
  const pointerDownAtRef = useRef(0);
  const holdHintTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  /** Prende el hint transitorio "Mantené presionado para grabar" (tap corto descartado) y lo apaga
   * solo ~1600ms después; reinicia el timeout si se dispara de nuevo antes de apagarse. */
  const showHoldHint = useCallback(() => {
    setHoldHint(true);
    if (holdHintTimeoutRef.current !== null) {
      clearTimeout(holdHintTimeoutRef.current);
    }
    holdHintTimeoutRef.current = setTimeout(() => {
      setHoldHint(false);
      holdHintTimeoutRef.current = null;
    }, HOLD_HINT_MS);
  }, []);

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

      // Guard de race (defecto 1): el `pointerup` puede llegar ANTES de que `getUserMedia`
      // resuelva. Si el gesto ya terminó, no arrancamos el recorder ni el overlay — liberamos el
      // stream recién obtenido para no dejar encendido el indicador de grabación del browser.
      if (!gestureActiveRef.current) {
        stream.getTracks().forEach((track) => track.stop());
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
    // Sincrónico y ANTES de `startRecording` (que es async): marca el gesto como activo y guarda
    // el instante de inicio, para que tanto el guard de race como el cálculo de hold-time en
    // `handlePointerUp` tengan el dato aunque `getUserMedia` todavía no haya resuelto.
    gestureActiveRef.current = true;
    pointerDownAtRef.current = Date.now();
    void startRecording(event.clientY);

    function handlePointerMove(moveEvent: PointerEvent) {
      const delta = startYRef.current - moveEvent.clientY;
      if (!lockedRef.current && delta > LOCK_THRESHOLD_PX) {
        lockedRef.current = true;
        setLocked(true);
      }
    }
    function detachGestureListeners() {
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
      gestureCleanupRef.current = null;
    }
    function handlePointerUp() {
      detachGestureListeners();
      gestureActiveRef.current = false;
      if (lockedRef.current) {
        return; // fijado: no hace nada acá — espera Cancelar/Enviar explícitos del overlay.
      }
      const heldMs = Date.now() - pointerDownAtRef.current;
      if (heldMs < MIN_HOLD_MS) {
        finishRecording(false); // tap corto: sin intención de grabar -> descarta, no envía
        showHoldHint();
      } else {
        finishRecording(true); // soltó sin fijar tras mantener -> envía (contrato del gesto)
      }
    }
    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);
    // Si el componente se desmonta a mitad de gesto (antes del pointerup), el useEffect de abajo
    // usa esto para no dejar los listeners de `document` colgados apuntando a closures obsoletas.
    gestureCleanupRef.current = detachGestureListeners;
  }

  // Cleanup de desmontaje (finding de review adversarial): sin esto, fijar la grabación
  // (hands-free) y navegar a otro tab/cruzar el breakpoint 900px desmonta `MicButton` SIN liberar
  // el mic (el track nunca recibe `.stop()` -> el indicador de grabación del browser queda
  // encendido, problema de privacidad) ni el timer del overlay (setInterval vivo -> setState sobre
  // un componente ya desmontado). Se anula `onstop` ANTES de parar el `MediaRecorder`: el desmontaje
  // no es un "enviar" ni un "cancelar" del usuario, así que no debe disparar `onSendAudio` ni
  // pisar estado de un componente que ya no está.
  useEffect(() => {
    return () => {
      gestureCleanupRef.current?.();
      stopTimer();
      if (holdHintTimeoutRef.current !== null) {
        clearTimeout(holdHintTimeoutRef.current);
        holdHintTimeoutRef.current = null;
      }
      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state !== 'inactive') {
        recorder.onstop = null;
        recorder.stop();
      }
      releaseStream();
    };
  }, [releaseStream, stopTimer]);

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
        {/* Ícono mic — SVG verbatim del diseño (Copiloto App.dc.html:187), currentColor hereda
            `--input-fg` del botón. */}
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor" />
          <path
            d="M6 11a6 6 0 0 0 12 0M12 17v4"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      </button>

      {/* Overlay por PORTAL a <body>: `position:fixed` necesita no quedar atrapado dentro de un
          ancestro que cree containing-block (transform/filter/el difuminado de fondo que llevaba
          `.composer__row` hasta ODOBI hito 2, retirado — "sin glass"), y sin el portal el overlay se
          veía como una ventanita chica en vez de cubrir el viewport. El portal se mantiene: es
          robusto ante cualquier ancestro futuro, no sólo el que causó el bug original. */}
      {recording &&
        createPortal(
          <RecordingOverlay
            elapsedMs={elapsedMs}
            locked={locked}
            onCancel={() => finishRecording(false)}
            onSend={() => finishRecording(true)}
          />,
          document.body,
        )}

      {permissionError && (
        <p className="composer__mic-error" role="alert">
          {permissionError}
        </p>
      )}

      {holdHint && (
        <p className="composer__mic-hint" role="status">
          Mantené presionado para grabar
        </p>
      )}
    </>
  );
}
