import { useState, type KeyboardEvent } from 'react';

import { MicButton } from '../chat/MicButton';
import type { SendStatusSoporte } from './useChatSoporte';
import '../chat/chat.css';

export interface ComposerSoporteProps {
  sendStatus: SendStatusSoporte;
  onSend: (text: string) => void;
  /** Blob grabado por `MicButton` (ODOBI8 §C3) -- el caller lo reenvía a `useChatSoporte().sendAudio`. */
  onSendAudio: (blob: Blob) => void;
}

/**
 * Composer del chat de SOPORTE — NO reusa `modules/chat/Composer.tsx` a propósito: ese componente
 * llama `useMode()` internamente (el chip "Modo Mail…" de negocio), un acoplamiento que no aplica
 * acá y que forzar con una prop opcional convertiría el componente compartido en un `if` de dos
 * dominios (la misma trampa que el propio contrato SOP5 evita del lado del servidor). `MicButton`
 * en cambio SÍ se reusa tal cual (ODOBI8 §C3, opción (a) del contrato): es genérico del gesto, no
 * sabe de negocio ni de soporte. Reusa las clases CSS de `chat.css`
 * (`composer`/`composer__row`/`composer__input`/`composer__send`) para la MISMA apariencia.
 */
function textoEstado(sendStatus: SendStatusSoporte): string | null {
  switch (sendStatus) {
    case 'sending':
      return 'Enviando…';
    case 'waiting':
      return 'Pensando… · Podés cerrar la app, te sigo respondiendo.';
    case 'timeout':
      return 'Está tardando más de lo normal. Podés esperar o volver a intentar.';
    case 'error':
      return 'No pudimos enviar tu mensaje. Probá de nuevo.';
    default:
      return null;
  }
}

export function ComposerSoporte({ sendStatus, onSend, onSendAudio }: ComposerSoporteProps) {
  const [draft, setDraft] = useState('');
  const canSend = draft.trim() !== '' && sendStatus !== 'sending';
  const hint = textoEstado(sendStatus);

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
    <div className="composer" data-testid="composer-soporte">
      {hint && (
        <p
          className={['composer__status', sendStatus === 'timeout' || sendStatus === 'error' ? 'composer__status--alert' : '']
            .filter(Boolean)
            .join(' ')}
          role={sendStatus === 'timeout' || sendStatus === 'error' ? 'alert' : 'status'}
        >
          {hint}
        </p>
      )}
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
          placeholder="Contanos qué necesitás…"
          rows={1}
          disabled={sendStatus === 'sending'}
        />
        <MicButton onSendAudio={onSendAudio} disabled={sendStatus === 'sending'} />
        <button type="submit" className="composer__send" disabled={!canSend} aria-label="Enviar mensaje">
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
