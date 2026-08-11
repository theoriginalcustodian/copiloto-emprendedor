import { useCallback } from 'react';

import type { FuncionSoporte } from '../../lib/api';
import { useSession } from '../../auth/useSession';
import { MessageList } from '../chat/MessageList';
import { ComposerSoporte } from './ComposerSoporte';
import { useChatSoporte } from './useChatSoporte';
import '../chat/chat.css';

const WELCOME_TEXT: Record<FuncionSoporte, string> = {
  soporte_tecnico: 'Algo no funciona como debería — contale al agente qué pasó.',
  como_uso_la_app: 'Preguntale al agente cómo hacer algo puntual.',
};

export interface SoporteScreenProps {
  /** Fija para toda la vida de la pantalla — dos entradas separadas en `AccountScreen` la fijan de
   * antemano (ver el docstring de `useChatSoporte` sobre por qué no cambia a mitad de conversación). */
  funcion: FuncionSoporte;
}

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
export function SoporteScreen({ funcion }: SoporteScreenProps) {
  const { me } = useSession();
  const { messages, sendStatus, send, sendAudio } = useChatSoporte(me?.cliente_id ?? '', funcion);

  const handleSend = useCallback((text: string) => void send(text, { kind: 'text' }), [send]);
  const handleSendAudio = useCallback((blob: Blob) => void sendAudio(blob), [sendAudio]);
  const handleChoice = useCallback(
    (value: string) => void send(value, { kind: 'callback' }),
    [send],
  );

  return (
    <div className="app-frame chat-screen" data-testid="soporte-screen">
      <MessageList messages={messages} onChoice={handleChoice} emptyHint={WELCOME_TEXT[funcion]} />
      <ComposerSoporte sendStatus={sendStatus} onSend={handleSend} onSendAudio={handleSendAudio} />
    </div>
  );
}
