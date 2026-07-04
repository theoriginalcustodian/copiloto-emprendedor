import { useEffect, useRef, type MouseEvent as ReactMouseEvent } from 'react';

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
  /** Tap en el área de mensajes que NO cae sobre un control (botón/chip/HITL/textarea/link): el
   * shell lo usa para togglear el chrome (tab-bar + composer). Opcional. */
  onSurfaceTap?: () => void;
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
  onSurfaceTap,
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
    lastScrollTopRef.current = current;
    // SOLO-OCULTAR: un scroll genuino hacia abajo, lejos del tope, oculta el chrome. NO se muestra
    // desde el scroll (el reveal es el tap en el centro). Mostrar desde el scroll causaba un loop:
    // al ocultarse, el composer se desliza -> cambia el alto del scroller -> dispara un scroll ->
    // volvía a mostrar -> se deslizaba... (oscilación "subiendo y bajando"), y dejaba al composer
    // trabado arriba.
    if (delta > 6 && current > 26) {
      onHideChange(true);
    }
  }

  function handleSurfaceClick(event: ReactMouseEvent<HTMLDivElement>) {
    if (!onSurfaceTap) return;
    // Sólo un tap "vacío" sobre el área de lectura togglea el chrome — ignorá taps sobre controles
    // (chips de desambiguación, botones de la tarjeta HITL, links) para no robarles el click.
    if ((event.target as HTMLElement).closest('button, a, textarea, input, [role="button"]')) {
      return;
    }
    onSurfaceTap();
  }

  return (
    <div
      className="chat-messages"
      data-testid="message-list"
      ref={scrollRef}
      onScroll={handleScroll}
      onClick={handleSurfaceClick}
    >
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
