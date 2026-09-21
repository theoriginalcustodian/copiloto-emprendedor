import { useState, type KeyboardEvent } from 'react';

import { dejarPendiente } from '@copiloto/core';

/**
 * `PreguntarInteligencia` — la solapa «Preguntar» de Inteligencia de Negocio (BL-X3). Port de
 * `apps/mobile/src/modules/inteligencia/PreguntarInteligencia.tsx`.
 *
 * Ya NO hay mini-chat propio (Q&A sincrónico paralelo al chat principal, sin durabilidad): la pregunta
 * se deja como mensaje pendiente (`dejarPendiente`, el mismo puente de «Cómo usar la app») y se abre el
 * chat principal, que la envía al montar. La respuesta llega en el hilo durable, con su contexto.
 */
export function PreguntarInteligencia({ onAbrirChat }: { onAbrirChat: () => void }) {
  const [draft, setDraft] = useState('');

  function submit() {
    const texto = draft.trim();
    if (texto === '') return;
    setDraft('');
    dejarPendiente(texto);
    onAbrirChat();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  }

  return (
    <div className="chat-inteligencia" data-testid="preguntar-inteligencia">
      <div className="chat-inteligencia__lista">
        <p className="chat-inteligencia__vacio" data-testid="preguntar-inteligencia-vacio">
          Preguntale a tu copiloto sobre tu negocio. Por ejemplo: «¿cuánto gasté este mes?» o «¿quién
          me debe?». La respuesta te espera en el chat.
        </p>
      </div>

      <form
        className="chat-inteligencia__composer"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <textarea
          className="chat-inteligencia__input"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Preguntale a tu copiloto…"
          rows={1}
          data-testid="preguntar-inteligencia-input"
        />
        <button
          type="submit"
          className="chat-inteligencia__enviar"
          disabled={draft.trim() === ''}
          aria-label="Enviar pregunta"
          data-testid="preguntar-inteligencia-enviar"
        >
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
