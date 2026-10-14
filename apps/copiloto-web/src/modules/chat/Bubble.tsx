import type { ReactNode } from 'react';

import { formatearDuracion } from '@copiloto/core';

import { Surface } from '../../design-system';
import { Marca } from '../../design-system/Marca';
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
  /** BL-J7 (H-A3-7) — el mensaje llegó por dictado (`useChat().sendAudio`): chip «Por voz · m:ss»,
   * mismo criterio que `MicFuncion` fuera del chat. `undefined` en mensajes escritos: sin chip. */
  porVoz?: { duracionSeg: number };
}

// Detecta URLs sueltas en el texto plano (Task 17) — el LLM NO debería narrarlas (el artifact ya es
// el canal, ver ArtifactView), pero si aparece una queda clicable en vez de texto muerto. Un solo
// grupo de captura: `String.split` con ese patrón intercala [texto, match, texto, match, …], así que
// el índice impar identifica la URL sin re-testear el regex (evita el gotcha de estado de `lastIndex`
// con regex globales reusadas).
const URL_RE = /(https?:\/\/[^\s]+)/g;

/** El mismo tamaño que `.chat-header__avatar`: una sola geometría de avatar en el chat. */
const AVATAR_ASISTENTE = 36;

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
 *
 * AVATARASIST — el par por rol del prototipo (`index.html:3191`, helper `O`): la burbuja del asistente
 * lleva el isotipo a su izquierda (`.msg-row` + `.quien`, alineado al borde inferior) y la del
 * emprendedor lleva en cambio la meta «✓✓ recibido». Es el `Marca` del design system (el mismo del
 * vacío del chat y del login): acá NO hay un isotipo propio ni un asset.
 *
 * El disco es el MISMO del avatar del header (`.chat-header__avatar`): 36, redondo y con el set
 * `--avatar-*`. El prototipo pide la rima con el header («rima con el del usuario en el header»), no el
 * pixel del `.quien` (38 blanco con sombra); en web esa rima ES el set de tokens. Ver
 * `.chat-asistente__avatar` en `chat.css`.
 */
export function Bubble({ role, text, card, porVoz }: BubbleProps) {
  if (role === 'user') {
    return (
      <div className="chat-row chat-row--user">
        <div className="chat-bubble chat-bubble--user">
          <p className="chat-bubble__text">{text}</p>
          {porVoz && (
            <span className="chat-bubble__voz" data-testid="chat-bubble-voz">
              Por voz · {formatearDuracion(porVoz.duracionSeg)}
            </span>
          )}
        </div>
        <span className="chat-bubble__receipt" data-testid="chat-bubble-recibido">
          ✓✓ recibido
        </span>
      </div>
    );
  }

  const artifactCard = card && card.kind && card.kind !== 'confirm' ? card : undefined;

  return (
    <div className="chat-row chat-row--assistant">
      <div className="chat-asistente">
        <span className="chat-asistente__avatar" aria-hidden="true">
          <Marca size={AVATAR_ASISTENTE} />
        </span>
        <Surface variant="bubble" blur className="chat-bubble chat-bubble--assistant">
          <p className="chat-bubble__text">{linkifyText(text)}</p>
        </Surface>
      </div>
      {artifactCard && <ArtifactView card={artifactCard} />}
    </div>
  );
}
