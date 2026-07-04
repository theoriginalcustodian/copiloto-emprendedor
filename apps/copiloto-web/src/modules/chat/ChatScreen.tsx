import { useCallback } from 'react';

import { StatusBar } from '../../design-system';
import { useSession } from '../../auth/useSession';
import { ChatHeader } from './ChatHeader';
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
 */
export function ChatScreen() {
  const { messages, sendStatus, send } = useChat();
  const { logout } = useSession();

  const handleSend = useCallback((text: string) => void send(text), [send]);
  const handleChoice = useCallback(
    (value: string) => void send(value, { kind: 'callback' }),
    [send],
  );

  return (
    <div className="app-frame chat-screen" data-testid="chat-screen">
      <StatusBar />
      <ChatHeader onLogout={logout} />
      <MessageList messages={messages} onChoice={handleChoice} emptyHint={WELCOME_TEXT} />
      <Composer sendStatus={sendStatus} onSend={handleSend} />
    </div>
  );
}
