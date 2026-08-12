import { useEffect, useRef, type MouseEvent as ReactMouseEvent } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

import { leerPresupuestoPropuesto } from '@copiloto/core';

import { Bubble } from './Bubble';
import { DisambiguationChips } from './DisambiguationChips';
import { HitlCard } from './HitlCard';
import { buildHitlCardProps, classifyChoices } from './hitlMapping';
import { TarjetaPresupuestoPropuesto } from './TarjetaPresupuestoPropuesto';
import type { ChatMessage } from './useChat';
import './chat.css';

/** Altura estimada de una fila (`chat.css`, burbuja de una línea + paddings) antes de que
 * `measureElement` la corrija con la altura real — sólo afecta el tamaño inicial del scrollbar/salto
 * de posición mientras se asientan las primeras filas, nunca el layout final. */
const ALTO_FILA_ESTIMADO_PX = 88;
/** Filas de colchón fuera del viewport (arriba y abajo) — evita el "pop-in" de texto sin renderizar
 * durante un scroll rápido; ver `js-lists-flatlist-flashlist.md` (mismo criterio que `windowSize`). */
const OVERSCAN_FILAS = 6;

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
 *  - asistente sin `choices` -> burbuja simple; si además trae `card` con un artefacto terminal
 *    (`kind` != 'confirm', Task 17), la burbuja monta `ArtifactView` debajo (link/share button).
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
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastScrollTopRef = useRef(0);
  // ¿El dedo está APOYADO sobre el scroller ahora mismo? Sólo un scroll con el dedo apoyado cuenta
  // como gesto real del usuario (ver handleScroll). Se levanta en pointerdown y se baja al soltar.
  const pointerDownRef = useRef(false);

  // C6 (cotas de chat y listas): antes esto era un `.map()` liso + un `div` sentinela al fondo con
  // `scrollIntoView` — con `messages` ya acotado a `MAX_MENSAJES_HISTORIAL` (`chatMachine.ts`) igual
  // montaba hasta 300 burbujas/cards vivas en el DOM sin importar cuántas entraran en pantalla.
  // `useVirtualizer` sólo monta lo visible + el colchón de `OVERSCAN_FILAS`. `getItemKey` usa el
  // `id` del mensaje (no el índice) para que la identidad de cada fila sobreviva al agregado de
  // mensajes nuevos — mismo criterio que el `key={message.id}` que reemplaza.
  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ALTO_FILA_ESTIMADO_PX,
    overscan: OVERSCAN_FILAS,
    getItemKey: (index) => messages[index].id,
  });

  useEffect(() => {
    // Con la lista virtualizada ya no hay un sentinela al fondo que `scrollIntoView` — el propio
    // virtualizer sabe llevar el scroll al último índice, midiendo su offset real.
    if (messages.length === 0) return;
    virtualizer.scrollToIndex(messages.length - 1, { align: 'end' });
  }, [messages.length, virtualizer]);

  function handlePointerDown() {
    pointerDownRef.current = true;
    // El pointerup/cancel suele caer FUERA del scroller (el dedo se levanta en cualquier lado), así
    // que se escucha en document, no en el div. Auto-desregistra al soltar.
    const release = () => {
      pointerDownRef.current = false;
      document.removeEventListener('pointerup', release);
      document.removeEventListener('pointercancel', release);
    };
    document.addEventListener('pointerup', release);
    document.addEventListener('pointercancel', release);
  }

  function handleScroll() {
    const el = scrollRef.current;
    if (!el || !onHideChange) return;
    const current = el.scrollTop;
    const delta = current - lastScrollTopRef.current;
    lastScrollTopRef.current = current; // baseline SIEMPRE al día, aunque ignoremos este scroll.
    // RAÍZ del loop "mostrar chrome -> resize -> scroll -> ocultar": al mostrar el chrome, el
    // clearance de la tab-bar (padding-bottom animado del ancestro `.app-shell__content`) achica el
    // alto de este scroller y el navegador emite un scroll que NO hizo el usuario. Ese scroll
    // inducido por layout ocurre SIEMPRE con el dedo levantado. Por eso el hide-on-scroll sólo
    // cuenta con el dedo APOYADO: no reaccionamos al eco de nuestra propia acción. Es por
    // construcción (no depende de timings de transición): ningún cambio de chrome pasa con el dedo
    // abajo (el tap togglea en `onClick`, ya con el dedo arriba; el cambio de tab es un botón; el
    // idle no toca la pantalla).
    if (!pointerDownRef.current) return;
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
      onPointerDown={handlePointerDown}
      onClick={handleSurfaceClick}
    >
      {messages.length === 0 && emptyHint && <p className="chat-messages__empty">{emptyHint}</p>}

      {sessionMarker && messages.length > 0 && (
        <div className="chat-messages__session-marker">{sessionMarker}</div>
      )}

      <div style={{ position: 'relative', height: virtualizer.getTotalSize(), width: '100%' }}>
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const message = messages[virtualRow.index];
          return (
            <div
              key={virtualRow.key}
              ref={virtualizer.measureElement}
              data-index={virtualRow.index}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <FilaMensaje message={message} onChoice={onChoice} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface FilaMensajeProps {
  message: ChatMessage;
  onChoice: (value: string) => void;
}

/** Una fila de la lista — mismo árbol de decisión que antes, ahora aislado para que `measureElement`
 * mida exactamente el contenido de ESTA fila (no el scroller entero). */
function FilaMensaje({ message, onChoice }: FilaMensajeProps) {
  if (message.role === 'user') {
    return <Bubble role="user" text={message.text} />;
  }

  // `presupuesto_propuesto` NO lleva `choices` (mismo motivo que el resto de las cards `*_propuesto`
  // de mobile): `classifyChoices` la ignoraría y esto caería en `Bubble` lisa — el emprendedor vería
  // sólo el texto y ningún lugar donde corregir el monto antes de guardar. Se chequea ANTES del gate
  // HITL, igual que `apps/mobile/src/modules/chat/ListaMensajes.tsx`.
  const presupuestoPropuesto = leerPresupuestoPropuesto(message.card);
  if (presupuestoPropuesto) {
    return <TarjetaPresupuestoPropuesto propuesta={presupuestoPropuesto} mensajeId={message.id} />;
  }

  const kind = classifyChoices(message.choices);

  if (kind === 'hitl') {
    const hitlProps = buildHitlCardProps(message, onChoice);
    return <HitlCard {...hitlProps} />;
  }

  return (
    <div className="chat-message-group">
      <Bubble role="assistant" text={message.text} card={message.card} />
      {kind === 'choices' && message.choices && (
        <DisambiguationChips choices={message.choices} onSelect={onChoice} />
      )}
    </div>
  );
}
