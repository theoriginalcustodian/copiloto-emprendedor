import { useCallback } from 'react';

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
 * los mensajes + el composer. El logout vive en Cuenta (AccountScreen). El ESCRITORIO también
 * arranca sin header (pedido operador 2026-07-04): solo el chat, sin la barra de sesión ni el botón
 * "Nueva conversación".
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
   * `'desktop'` aplica ajustes de escritorio (sin `onSurfaceTap` ni marker de sesión); NINGÚN
   * variant monta header ni hint del composer (pedido operador 2026-07-04: solo el chat). Lo setea
   * `DesktopShell`.
   */
  variant?: 'mobile' | 'desktop';
  /** D14 — id de cliente a abrir en el tab Clientes (botón "Ver cliente" de
   * `TarjetaClientePropuesto` en `ya_existe`). Lo pasan ambos shells (`abrirCliente`). */
  onAbrirCliente?: (id: number) => void;
}

export function ChatScreen({
  onHideChange,
  onSurfaceTap,
  variant = 'mobile',
  onAbrirCliente,
}: ChatScreenProps = {}) {
  const { messages, sendStatus, send, sendAudio } = useChat();
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
      <MessageList
        messages={messages}
        onChoice={handleChoice}
        emptyHint={WELCOME_TEXT}
        onHideChange={onHideChange}
        onSurfaceTap={isDesktop ? undefined : onSurfaceTap}
        sessionMarker={isDesktop ? undefined : 'SESIÓN ACTIVA · HOY'}
        onAbrirCliente={onAbrirCliente}
      />
      <Composer
        sendStatus={sendStatus}
        onSend={handleSend}
        onSendAudio={handleSendAudio}
      />
    </div>
  );
}
