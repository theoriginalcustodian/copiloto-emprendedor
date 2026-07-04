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
  /** Hide-on-scroll (EXTRACT §2.3): reporta si la tab-bar debe ocultarse. `true` al scrollear hacia
   * abajo por el historial, `false` al subir o cerca del tope/fondo. Opcional — sin él, la lista
   * scrollea normal. Thresholds del diseño: 6px de delta, 26px del tope. */
  onHideChange?: (hidden: boolean) => void;
  /** Marcador mono al tope del scroll (verbatim `Copiloto App.dc.html:64` — "SESIÓN ACTIVA · HOY").
   * Sólo el shell mobile lo pasa; en escritorio la sesión vive en `DesktopChatHeader`, así que va
   * `undefined`. Se muestra únicamente cuando ya hay mensajes (si el chat está vacío manda el
   * `emptyHint`). */
  sessionMarker?: string;
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
export function MessageList({
  messages,
  onChoice,
  emptyHint,
  onHideChange,
  sessionMarker,
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastScrollTopRef = useRef(0);

  useEffect(() => {
    // `scrollIntoView` no existe en jsdom (entorno de test) — guard defensivo, no solo optional
    // chaining sobre `.current` (el método en sí puede faltar en el elemento).
    bottomRef.current?.scrollIntoView?.({ block: 'end' });
  }, [messages.length]);

  function handleScroll() {
    const el = scrollRef.current;
    if (!el || !onHideChange) return;
    const current = el.scrollTop;
    const delta = current - lastScrollTopRef.current;
    // Cerca del tope (26px, EXTRACT §2.3) o cerca del fondo (incluye el auto-scroll al último
    // mensaje) => siempre mostrar; scroll hacia abajo por el historial => ocultar; hacia arriba => mostrar.
    const atBottom = el.scrollHeight - current - el.clientHeight < 8;
    if (current < 26 || atBottom) {
      onHideChange(false);
    } else if (delta > 6) {
      onHideChange(true);
    } else if (delta < -6) {
      onHideChange(false);
    }
    lastScrollTopRef.current = current;
  }

  return (
    <div className="chat-messages" data-testid="message-list" ref={scrollRef} onScroll={handleScroll}>
      {messages.length === 0 && emptyHint && <p className="chat-messages__empty">{emptyHint}</p>}

      {sessionMarker && messages.length > 0 && (
        <div className="chat-messages__session-marker">{sessionMarker}</div>
      )}

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
