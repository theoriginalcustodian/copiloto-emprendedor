import { useCallback } from 'react';

import { DesktopChatHeader } from './DesktopChatHeader';
import { Composer } from './Composer';
import { MessageList } from './MessageList';
import { useChat } from './useChat';
import './chat.css';

const WELCOME_TEXT =
  'Contame qué necesitás y lo hago. Antes de tocar nada —cobrar, agendar, mandar un mail— siempre te pido que confirmes.';

/**
 * Pantalla de Chat completa. Toda la lógica de envío/polling/durabilidad vive en `useChat`; acá
 * SOLO presentación, reusándolo tal cual.
 *
 * Chrome del MÓVIL (pedido del operador 2026-07-04): el móvil NO lleva header — ni el `StatusBar`
 * mock (hora/batería; ya la pinta el OS) ni el header de marca `ChatHeader` ("Copiloto" · ES-AR ·
 * "en línea · durable" · avatar/contador). La interfaz arranca lo más limpia posible: directo con
 * los mensajes + el composer. El logout vive en Cuenta (AccountScreen). El header de ESCRITORIO
 * (`DesktopChatHeader`, otro diseño) sí se mantiene.
 *
 * `handleSend` reenvía la `key` del modo activo (leída por `Composer` desde `useMode()`) a
 * `useChat().send(text, { mode })`. `handleSendAudio` reenvía el blob grabado por `Composer`/
 * `MicButton` a `useChat().sendAudio(blob)` — es la única instancia de `useChat()` (el estado
 * de mensajes/polling vive acá).
 */
export interface ChatScreenProps {
  /** Hide-on-scroll (EXTRACT §2.3): el shell lo usa para ocultar la tab-bar al scrollear el chat.
   * Opcional — el ChatScreen corre standalone (sin shell) sin él. */
  onHideChange?: (hidden: boolean) => void;
  /** Tap en el área de mensajes que NO cae sobre un control: el shell lo usa para togglear el chrome
   * (tab-bar + composer). Sólo el shell mobile lo pasa. */
  onSurfaceTap?: () => void;
  /**
   * `'desktop'` monta el header de sesión (`DesktopChatHeader`: "SESIÓN ACTIVA · sess_… / Nueva
   * conversación", verbatim `Copiloto Web.dc.html:94-102`) + el hint del composer. `'mobile'`
   * (default) NO monta ningún header (ver arriba). Lo setea `DesktopShell`.
   */
  variant?: 'mobile' | 'desktop';
}

export function ChatScreen({
  onHideChange,
  onSurfaceTap,
  variant = 'mobile',
}: ChatScreenProps = {}) {
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
      {isDesktop && (
        <DesktopChatHeader sessionId={sessionId} onNewConversation={startNewSession} />
      )}
      <MessageList
        messages={messages}
        onChoice={handleChoice}
        emptyHint={WELCOME_TEXT}
        onHideChange={onHideChange}
        onSurfaceTap={isDesktop ? undefined : onSurfaceTap}
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
