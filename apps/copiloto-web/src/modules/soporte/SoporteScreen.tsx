import { useCallback } from 'react';

import { useSession } from '../../auth/useSession';
import { MessageList } from '../chat/MessageList';
import { ComposerSoporte } from './ComposerSoporte';
import { useChatSoporte } from './useChatSoporte';
import '../chat/chat.css';

const WELCOME_TEXT = 'Preguntale al agente de soporte, o contanos si algo no funciona.';

/**
 * Pantalla del chat de SOPORTE (SOP5) — hermana de `modules/chat/ChatScreen.tsx`: misma
 * presentación (`MessageList` reusado tal cual), toda la lógica en `useChatSoporte`. NO reusa
 * `Composer` (ver el docstring de `ComposerSoporte` para el porqué), NO tiene variant desktop/mobile
 * propio — el chat de soporte no necesita el hide-on-scroll ni el marker de sesión del chat
 * principal (es una pantalla secundaria, no la de arranque de la app).
 *
 * `chat-screen` (clase CSS reusada de `chat.css`) da el layout de columna a pantalla completa —
 * presentación, no lógica de negocio, safe de compartir.
 */
export function SoporteScreen() {
  const { me } = useSession();
  const { messages, sendStatus, send } = useChatSoporte(me?.cliente_id ?? '');

  const handleSend = useCallback((text: string) => void send(text, { kind: 'text' }), [send]);
  const handleChoice = useCallback(
    (value: string) => void send(value, { kind: 'callback' }),
    [send],
  );

  return (
    <div className="app-frame chat-screen" data-testid="soporte-screen">
      <MessageList messages={messages} onChoice={handleChoice} emptyHint={WELCOME_TEXT} />
      <ComposerSoporte sendStatus={sendStatus} onSend={handleSend} />
    </div>
  );
}
