import { Button } from '../../design-system';
import type { ReplyCard } from '../../lib/api';
import './chat.css';

export interface ArtifactViewProps {
  card: ReplyCard;
}

/**
 * Render de un artefacto terminal por `card.kind` (Task 17, prioridad #1 = share button de
 * `payment_link`). Reusa el tipo `ReplyCard` del contrato de API (`lib/api/types.ts`) en vez de
 * duplicar un shape local — un solo lugar define "qué trae el card".
 *
 * `kind:'confirm'` (el gate HITL) NUNCA llega acá: lo sigue renderizando `HitlCard` — `Bubble` es
 * quien filtra ese kind antes de montar este componente (ver `Bubble.tsx`). Cualquier otro kind sin
 * `url` en `data`, o un kind no reconocido, no renderiza nada (degradación silenciosa: el texto del
 * bubble ya comunicó lo que pasó, el artifact es un plus, no la única fuente).
 */
export function ArtifactView({ card }: ArtifactViewProps) {
  const data = card.data ?? {};
  const url = typeof data.url === 'string' ? data.url : undefined;

  if (card.kind === 'payment_link' && url) {
    const share = () => {
      // Web Share API primero (prioridad #1 del spec — hoja nativa de compartir en mobile); sin
      // soporte (desktop viejo, o jsdom en test) degrada a copiar el link al portapapeles.
      if (navigator.share) void navigator.share({ title: 'Link de pago', url });
      else void navigator.clipboard?.writeText(url);
    };
    return (
      <div className="artifact artifact--payment">
        <Button onClick={share}>Compartir link de pago</Button>
        <a href={url} target="_blank" rel="noopener noreferrer">
          Pagar ${String(data.amount ?? '')}
        </a>
      </div>
    );
  }

  if (card.kind === 'calendar_event') {
    const fields = (data.fields as Record<string, unknown>) ?? {};
    return (
      <div className="artifact artifact--calendar">
        <span>{String(fields.title ?? 'Evento')}</span>
        {url && (
          <a href={url} target="_blank" rel="noopener noreferrer">
            Ver en Calendar
          </a>
        )}
      </div>
    );
  }

  if (url && card.kind && ['doc', 'sheet', 'file', 'email_draft'].includes(card.kind)) {
    const labels: Record<string, string> = {
      doc: 'Abrir documento',
      sheet: 'Abrir planilla',
      file: 'Abrir archivo',
      email_draft: 'Ver borrador',
    };
    return (
      <a className="artifact" href={url} target="_blank" rel="noopener noreferrer">
        {labels[card.kind]}
      </a>
    );
  }

  return null; // 'confirm' u otros kinds sin data reconocida: los maneja HitlCard, no ArtifactView.
}
