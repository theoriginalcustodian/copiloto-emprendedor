import type { ReactNode } from 'react';

import { Surface } from '../../design-system';
import type { ReplyCard } from '../../lib/api';
import { ArtifactView } from './ArtifactView';
import './chat.css';

export type BubbleRole = 'user' | 'assistant';

export interface BubbleProps {
  role: BubbleRole;
  text: string;
  /** Card del reply (Task 17): si trae un `kind` que NO sea 'confirm', se monta `ArtifactView`
   * debajo del texto. El gate `kind:'confirm'` lo sigue renderizando `HitlCard` (mensajes HITL no
   * pasan por `Bubble` en `MessageList` de todos modos) — este chequeo es la red de seguridad. */
  card?: ReplyCard;
}

// Detecta URLs sueltas en el texto plano (Task 17) — el LLM NO debería narrarlas (el artifact ya es
// el canal, ver ArtifactView), pero si aparece una queda clicable en vez de texto muerto. Un solo
// grupo de captura: `String.split` con ese patrón intercala [texto, match, texto, match, …], así que
// el índice impar identifica la URL sin re-testear el regex (evita el gotcha de estado de `lastIndex`
// con regex globales reusadas).
const URL_RE = /(https?:\/\/[^\s]+)/g;

function linkifyText(text: string): ReactNode {
  const parts = text.split(URL_RE);
  if (parts.length === 1) return text;
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <a key={i} href={part} target="_blank" rel="noopener noreferrer">
        {part}
      </a>
    ) : (
      part
    ),
  );
}

/**
 * Burbuja de chat (Task 12, EXTRACT §2.5). Usuario: tokens `--user-*`, radio `20 20 6 20`, "✓✓
 * recibido" en `--ok-fg`. Asistente: `Surface variant="bubble" blur` (tokens `--bubble-*`, blur
 * real del mock), radio `20 20 20 6`. NO incluye el sub-header "SESIÓN ACTIVA · HOY" (decisión
 * congelada del plan — el diseño más reciente lo eliminó, ver prompt del Task 12).
 */
export function Bubble({ role, text, card }: BubbleProps) {
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

  const artifactCard = card && card.kind && card.kind !== 'confirm' ? card : undefined;

  return (
    <div className="chat-row chat-row--assistant">
      <Surface variant="bubble" blur className="chat-bubble chat-bubble--assistant">
        <p className="chat-bubble__text">{linkifyText(text)}</p>
      </Surface>
      {artifactCard && <ArtifactView card={artifactCard} />}
    </div>
  );
}
