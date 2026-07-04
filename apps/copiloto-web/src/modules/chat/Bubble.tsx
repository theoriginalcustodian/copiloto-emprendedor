import { Surface } from '../../design-system';
import './chat.css';

export type BubbleRole = 'user' | 'assistant';

export interface BubbleProps {
  role: BubbleRole;
  text: string;
}

/**
 * Burbuja de chat (Task 12, EXTRACT §2.5). Usuario: tokens `--user-*`, radio `20 20 6 20`, "✓✓
 * recibido" en `--ok-fg`. Asistente: `Surface variant="bubble" blur` (tokens `--bubble-*`, blur
 * real del mock), radio `20 20 20 6`. NO incluye el sub-header "SESIÓN ACTIVA · HOY" (decisión
 * congelada del plan — el diseño más reciente lo eliminó, ver prompt del Task 12).
 */
export function Bubble({ role, text }: BubbleProps) {
  if (role === 'user') {
    return (
      <div className="chat-row chat-row--user">
        <div className="chat-bubble chat-bubble--user">
          <p className="chat-bubble__text">{text}</p>
        </div>
        <span className="chat-bubble__receipt">✓✓ recibido</span>
      </div>
    );
  }

  return (
    <div className="chat-row chat-row--assistant">
      <Surface variant="bubble" blur className="chat-bubble chat-bubble--assistant">
        <p className="chat-bubble__text">{text}</p>
      </Surface>
    </div>
  );
}
