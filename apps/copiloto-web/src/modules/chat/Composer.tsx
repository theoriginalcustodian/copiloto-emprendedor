import { useState, type KeyboardEvent } from 'react';

import type { SendStatus } from './useChat';
import './chat.css';

export interface ComposerProps {
  sendStatus: SendStatus;
  onSend: (text: string) => void;
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

/**
 * Composer de texto (Task 15, EXTRACT §2.10 — solo la parte texto-only; el mic/voz es Task 19,
 * FASE 4, fuera de este scope: acá solo el slot deshabilitado, sin lógica de grabación). Enter
 * envía, Shift+Enter salta línea, vacío/solo-espacios no envía. Indicador de `sendStatus`
 * (procesando/pensando/tardando/error) + copy de durabilidad en `waiting`.
 */
export function Composer({ sendStatus, onSend }: ComposerProps) {
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
        <button
          type="button"
          className="composer__mic"
          disabled
          aria-label="Grabar audio (próximamente)"
        >
          🎙
        </button>
        <textarea
          className="composer__input"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Escribí tu mensaje…"
          rows={1}
          disabled={sendStatus === 'sending'}
        />
        <button
          type="submit"
          className="composer__send"
          disabled={!canSend}
          aria-label="Enviar mensaje"
        >
          ↑
        </button>
      </form>
    </div>
  );
}
