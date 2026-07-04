import { Badge, Button, MonoLabel, Surface, type BadgeVariant } from '../../design-system';
import { ServiceIcon } from '../../design-system/serviceIcons';
import './chat.css';

export interface HitlPreview {
  title: string;
  caption: string;
}

export interface HitlCardProps {
  /** key del servicio (googledocs/gmail/mercadopago/…) → ícono de marca real. '' = neutro (marca-letra). */
  service: string;
  /** Nombre real de la app en el header (ej "Google Docs" / "Mercado Pago"). */
  label: string;
  /** Nombre de la persona / destinatario (opcional, aislado de **negrita**). */
  name?: string;
  /** Monto aislado (solo cobros MP), SIN el signo `$` (se renderiza aparte con su propio token). */
  amount?: string;
  /** Cuerpo descriptivo: el texto del reply (qué se va a hacer). */
  concept: string;
  /** Badge de riesgo opcional (REVISAR para cobros, IRREVERSIBLE para publicar). */
  badge?: { variant: BadgeVariant; text: string };
  /** Borde de alerta + advertencia (acciones irreversibles, ej publicar en Instagram). */
  dangerBorder?: boolean;
  /** Preview WYSIWYG (solo publicar, EXTRACT §2.6 "único caso de vista previa"). */
  preview?: HitlPreview;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Tarjeta HITL de confirmación (Task 13, EXTRACT §2.6). La IDENTIDAD (ícono + nombre en el header)
 * sale del SERVICIO REAL que manda el backend (`card.service`/`card.label`) — Google Docs, Gmail,
 * Mercado Pago, Google Sheets, etc. — NO de adivinar el texto (el diseño viejo mostraba "AGENDA"
 * siempre). Las affordances de riesgo (badge, monto, borde de alerta) las decide `hitlMapping` según
 * el servicio. Recibe datos YA resueltos (nombre/monto/labels): es puramente presentacional. SIN nota
 * de contexto y SIN descripción — la card es compacta.
 */
export function HitlCard({
  service,
  label,
  name,
  amount,
  concept,
  badge,
  dangerBorder,
  preview,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: HitlCardProps) {
  return (
    <div className="chat-row chat-row--assistant" data-testid={`hitl-card-${service || 'plain'}`}>
      <Surface
        variant="card"
        blur
        className="hitl-card"
        role="group"
        aria-label={`Confirmación · ${label}`}
        style={dangerBorder ? { border: 'var(--danger-border)' } : undefined}
      >
        <div className="hitl-card__header">
          <div className="hitl-card__header-brand">
            <ServiceIcon serviceKey={service} name={label} size={30} radius={9} />
            <MonoLabel className="hitl-card__header-label">{label}</MonoLabel>
          </div>
          {badge && <Badge variant={badge.variant}>{badge.text}</Badge>}
        </div>

        {name && (
          <div className="hitl-card__field">
            <MonoLabel>PARA</MonoLabel>
            <p className="hitl-card__name">{name}</p>
          </div>
        )}

        {amount && (
          <div className="hitl-card__field">
            <MonoLabel>MONTO</MonoLabel>
            <p className="hitl-card__amount">
              <span className="hitl-card__amount-sign">$</span>
              {amount}
            </p>
          </div>
        )}

        <p className="hitl-card__concept">{concept}</p>

        {preview && (
          <div className="hitl-card__preview" data-testid="hitl-preview">
            <p className="hitl-card__preview-title">{preview.title}</p>
            <p className="hitl-card__preview-caption">{preview.caption}</p>
          </div>
        )}

        {dangerBorder && (
          <p className="hitl-card__warning" role="alert">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M12 9v4M12 17h.01M10.3 3.9L2 18a2 2 0 0 0 1.7 3h16.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            No se puede deshacer · queda público
          </p>
        )}

        <div className="hitl-card__actions">
          <Button variant="primary" onClick={onConfirm}>
            {confirmLabel}
          </Button>
          <Button variant="cancel" onClick={onCancel}>
            {cancelLabel}
          </Button>
        </div>
      </Surface>
    </div>
  );
}
