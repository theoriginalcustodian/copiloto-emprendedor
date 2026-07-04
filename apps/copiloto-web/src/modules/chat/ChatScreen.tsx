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
 *
 * `handleSend` reenvía el 2do argumento de `Composer.onSend` (la `key` del modo activo, leída por
 * `Composer` desde `useMode()` — Feature addendum 2026-07-03) a `useChat().send(text, { mode })`,
 * que ya soportaba `opts.mode` desde Task 8. Sin endpoint nuevo (spec §5).
 *
 * `handleSendAudio` (Task 19, FASE 4) reenvía el blob grabado por `Composer`/`MicButton` a
 * `useChat().sendAudio(blob)` — mismo criterio de wiring que `handleSend`, es la única instancia
 * de `useChat()` (el estado de mensajes/polling vive acá, no se puede duplicar en `Composer`).
 */
export function ChatScreen() {
  const { messages, sendStatus, send, sendAudio } = useChat();
  const { logout } = useSession();

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
      <StatusBar />
      <ChatHeader onLogout={logout} />
      <MessageList messages={messages} onChoice={handleChoice} emptyHint={WELCOME_TEXT} />
      <Composer sendStatus={sendStatus} onSend={handleSend} onSendAudio={handleSendAudio} />
    </div>
  );
}
