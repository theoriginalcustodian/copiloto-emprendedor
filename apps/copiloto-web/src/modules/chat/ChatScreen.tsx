import { useCallback } from 'react';

import { StatusBar } from '../../design-system';
import { ChatHeader } from './ChatHeader';
import { DesktopChatHeader } from './DesktopChatHeader';
import { Composer } from './Composer';
import { MessageList } from './MessageList';
import { useChat } from './useChat';
import './chat.css';

const WELCOME_TEXT =
  'Contame qué necesitás y lo hago. Antes de tocar nada —cobrar, agendar, mandar un mail— siempre te pido que confirmes.';

/**
 * Pantalla de Chat completa (diseño final, EXTRACT §2.2/§2.5/§2.6/§2.7/§2.10 — reemplaza
 * `ChatSkeleton`). Toda la lógica de envío/polling/durabilidad vive en `useChat` (Task 8); acá
 * SOLO presentación, reusándolo tal cual. Sin AppShell/TabBar (Task 9) ni Cuenta (Task 21) todavía
 * construidos, esta es HOY la única pantalla autenticada — ver nota de `onLogout` en
 * `ChatHeader.tsx`.
 *
 * `handleSend` reenvía el 2do argumento de `Composer.onSend` (la `key` del modo activo, leída por
 * `Composer` desde `useMode()` — Feature addendum 2026-07-03) a `useChat().send(text, { mode })`,
 * que ya soportaba `opts.mode` desde Task 8. Sin endpoint nuevo (spec §5).
 *
 * `handleSendAudio` (Task 19, FASE 4) reenvía el blob grabado por `Composer`/`MicButton` a
 * `useChat().sendAudio(blob)` — mismo criterio de wiring que `handleSend`, es la única instancia
 * de `useChat()` (el estado de mensajes/polling vive acá, no se puede duplicar en `Composer`).
 */
export interface ChatScreenProps {
  /** Hide-on-scroll (EXTRACT §2.3): el shell lo usa para ocultar la tab-bar al scrollear el chat.
   * Opcional — el ChatScreen corre standalone (sin shell) sin él. */
  onHideChange?: (hidden: boolean) => void;
  /**
   * `'desktop'` monta el header de sesión (`DesktopChatHeader`: "SESIÓN ACTIVA · sess_… / Nueva
   * conversación", verbatim `Copiloto Web.dc.html:94-102`) + el hint del composer, y OMITE el
   * `StatusBar` de teléfono y el header de marca mobile (`ChatHeader`) — ninguno existe en el diseño
   * de escritorio. `'mobile'` (default) deja el chrome de teléfono intacto. Lo setea `DesktopShell`.
   */
  variant?: 'mobile' | 'desktop';
}

export function ChatScreen({ onHideChange, variant = 'mobile' }: ChatScreenProps = {}) {
  const { messages, sendStatus, send, sendAudio, sessionId, startNewSession } = useChat();
  const isDesktop = variant === 'desktop';

  const handleSend = useCallback(
    (text: string, mode: string | null) => void send(text, { mode }),
    [send],
  );
  const handleChoice = useCallback(
    (value: string) => void send(value, { kind: 'callback' }),
    [send],
  );
  const handleSendAudio = useCallback((blob: Blob) => void sendAudio(blob), [sendAudio]);

  return (
    <div className="app-frame chat-screen" data-testid="chat-screen">
      {isDesktop ? (
        <DesktopChatHeader sessionId={sessionId} onNewConversation={startNewSession} />
      ) : (
        <>
          <StatusBar />
          <ChatHeader />
        </>
      )}
      <MessageList
        messages={messages}
        onChoice={handleChoice}
        emptyHint={WELCOME_TEXT}
        onHideChange={onHideChange}
        sessionMarker={isDesktop ? undefined : 'SESIÓN ACTIVA · HOY'}
      />
      <Composer
        sendStatus={sendStatus}
        onSend={handleSend}
        onSendAudio={handleSendAudio}
        showHint={isDesktop}
      />
    </div>
  );
}
