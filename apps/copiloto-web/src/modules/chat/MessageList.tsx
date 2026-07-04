import { useEffect, useRef } from 'react';

import { Bubble } from './Bubble';
import { DisambiguationChips } from './DisambiguationChips';
import { HitlCard } from './HitlCard';
import { buildHitlCardProps, classifyChoices } from './hitlMapping';
import type { ChatMessage } from './useChat';
import './chat.css';

export interface MessageListProps {
  messages: ChatMessage[];
  onChoice: (value: string) => void;
  emptyHint?: string;
}

/**
 * Lista de mensajes (Task 12) — decide por mensaje qué renderizar:
 *  - usuario -> burbuja simple.
 *  - asistente con `choices` HITL-shaped -> SOLO la tarjeta HITL (el texto del mensaje se embebe
 *    como `concept` dentro de la card, ver hitlMapping — evita duplicar el mismo contenido en
 *    una burbuja Y una card).
 *  - asistente con `choices` de opciones múltiples -> burbuja + chips de desambiguación debajo
 *    (EXTRACT §2.5 "burbuja de texto + fila de chips").
 *  - asistente sin `choices` -> burbuja simple.
 * Auto-scroll al último mensaje en cada cambio.
 */
export function MessageList({ messages, onChoice, emptyHint }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // `scrollIntoView` no existe en jsdom (entorno de test) — guard defensivo, no solo optional
    // chaining sobre `.current` (el método en sí puede faltar en el elemento).
    bottomRef.current?.scrollIntoView?.({ block: 'end' });
  }, [messages.length]);

  return (
    <div className="chat-messages" data-testid="message-list">
      {messages.length === 0 && emptyHint && <p className="chat-messages__empty">{emptyHint}</p>}

      {messages.map((message) => {
        if (message.role === 'user') {
          return <Bubble key={message.id} role="user" text={message.text} />;
        }

        const kind = classifyChoices(message.choices);

        if (kind === 'hitl') {
          const hitlProps = buildHitlCardProps(message, onChoice);
          return <HitlCard key={message.id} {...hitlProps} />;
        }

        return (
          <div key={message.id} className="chat-message-group">
            <Bubble role="assistant" text={message.text} />
            {kind === 'choices' && message.choices && (
              <DisambiguationChips choices={message.choices} onSelect={onChoice} />
            )}
          </div>
        );
      })}

      <div ref={bottomRef} aria-hidden="true" />
    </div>
  );
}
