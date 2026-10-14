import { useState, type KeyboardEvent } from 'react';

import { MicButton } from './MicButton';
import type { SendStatus } from './useChat';
import './chat.css';

export interface ComposerProps {
  sendStatus: SendStatus;
  onSend: (text: string) => void;
  /** Blob grabado por `MicButton` (Task 19) — el caller lo reenvía a `useChat().sendAudio(blob)`. */
  onSendAudio: (blob: Blob) => void;
  /** BL-J7 (H-A3-7) — pasthrough del `onRecordingStart` de `MicButton`: el caller (`ChatScreen`)
   * lo usa para arrancar el cronómetro y calcular la duración del chip «Por voz · m:ss». */
  onRecordingStart?: () => void;
}

function StatusHint({ sendStatus }: { sendStatus: SendStatus }) {
  if (sendStatus === 'sending') {
    return (
      <p className="composer__status" role="status">
        Procesando…
      </p>
    );
  }
  if (sendStatus === 'waiting') {
    return (
      <p className="composer__status" role="status">
        Pensando… · Podés cerrar la app, te sigo respondiendo.
      </p>
    );
  }
  if (sendStatus === 'timeout') {
    return (
      <p className="composer__status composer__status--alert" role="alert">
        Está tardando más de lo normal. Podés esperar o volver a intentar.
      </p>
    );
  }
  if (sendStatus === 'error') {
    return (
      <p className="composer__status composer__status--alert" role="alert">
        No pudimos enviar tu mensaje. Probá de nuevo.
      </p>
    );
  }
  return null;
}

const DEFAULT_PLACEHOLDER = 'Escribí, o hablá…';

/**
 * Composer de texto (Task 15, EXTRACT §2.10 — solo la parte texto-only; el mic/voz es Task 19,
 * FASE 4, fuera de este scope: acá solo el slot deshabilitado, sin lógica de grabación). Enter
 * envía, Shift+Enter salta línea, vacío/solo-espacios no envía. Indicador de `sendStatus`
 * (procesando/pensando/tardando/error) + copy de durabilidad en `waiting`.
 *
 * Mic (Task 19, FASE 4): `MicButton` reemplaza el slot deshabilitado — se deshabilita mientras
 * `sendStatus==='sending'`, mismo criterio que el textarea, para no superponer un envío de texto
 * con uno de audio.
 */
export function Composer({ sendStatus, onSend, onSendAudio, onRecordingStart }: ComposerProps) {
  const [draft, setDraft] = useState('');
  const canSend = draft.trim() !== '' && sendStatus !== 'sending';

  function submit() {
    if (!canSend) return;
    const text = draft;
    setDraft('');
    onSend(text);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  }

  return (
    <div className="composer" data-testid="composer">
      <StatusHint sendStatus={sendStatus} />
      <form
        className="composer__row"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <textarea
          className="composer__input"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={DEFAULT_PLACEHOLDER}
          rows={1}
          disabled={sendStatus === 'sending'}
        />
        <MicButton
          onSendAudio={onSendAudio}
          onRecordingStart={onRecordingStart}
          disabled={sendStatus === 'sending'}
        />
        <button
          type="submit"
          className="composer__send"
          disabled={!canSend}
          aria-label="Enviar mensaje"
        >
          {/* Flecha "enviar" — SVG verbatim del diseño (Copiloto App.dc.html:190), currentColor
              hereda `--send-fg` del botón (EXTRACT §2.10). */}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M12 19V5M5 12l7-7 7 7"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </form>
    </div>
  );
}
