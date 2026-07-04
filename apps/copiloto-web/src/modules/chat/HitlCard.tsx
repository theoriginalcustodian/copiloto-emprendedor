import { Badge, Button, MonoLabel, Surface, type BadgeVariant } from '../../design-system';
import { ServiceIcon } from '../../design-system/serviceIcons';
import './chat.css';

export type HitlVariant = 'cobro' | 'agenda' | 'publicar';

export interface HitlPreview {
  title: string;
  caption: string;
}

export interface HitlCardProps {
  variant: HitlVariant;
  /** Nombre de la persona (Clash 22px) — ausente en `publicar` (no hay destinatario). */
  name?: string;
  /** Monto aislado (solo `cobro`), SIN el signo `$` (se renderiza aparte con su propio token). */
  amount?: string;
  /** Cuerpo descriptivo (concepto/contexto de la acción). */
  concept: string;
  /** Preview WYSIWYG del post (solo `publicar`, EXTRACT §2.6 "único caso de vista previa"). */
  preview?: HitlPreview;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

interface VariantConfig {
  /** `key` de servicio para el ícono de marca (EXTRACT §2.6: MP/Calendar/Instagram en caja 30×30). */
  serviceKey: string;
  headerLabel: string;
  badge?: { variant: BadgeVariant; text: string };
  fieldLabel?: string;
  note?: string;
  dangerBorder?: boolean;
}

/**
 * Config FIJA por variante (EXTRACT §2.6, tabla de las 3 variantes de riesgo) — no la decide
 * quien llama al componente, es intrínseca a la variante: ícono de marca/badge/label/border-de-alerta
 * son siempre los mismos para "cobro"/"agenda"/"publicar".
 */
const VARIANT_CONFIG: Record<HitlVariant, VariantConfig> = {
  cobro: {
    serviceKey: 'mercadopago',
    headerLabel: 'COBRO',
    badge: { variant: 'warning', text: 'REVISAR' },
    fieldLabel: 'PARA',
  },
  agenda: {
    serviceKey: 'googlecalendar',
    headerLabel: 'AGENDA',
    fieldLabel: 'CON',
    note: 'Los turnos duran 60 min.',
  },
  publicar: {
    serviceKey: 'instagram',
    headerLabel: 'PUBLICAR',
    badge: { variant: 'danger', text: 'IRREVERSIBLE' },
    dangerBorder: true,
  },
};

/**
 * Tarjeta HITL canónica (Task 13, EXTRACT §2.6) — mismo layout, 3 variantes de riesgo. Recibe
 * datos YA resueltos (nombre/monto/concept/labels) — no `choices` crudo. El mapeo desde un
 * `ChatMessage` real (heurística sobre `choices`/`text`, ver ASUNCIÓN en el report) vive en
 * `hitlMapping.ts`, para mantener este componente puramente presentacional y testeable con props
 * explícitas.
 */
export function HitlCard({
  variant,
  name,
  amount,
  concept,
  preview,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: HitlCardProps) {
  const config = VARIANT_CONFIG[variant];

  return (
    <div className="chat-row chat-row--assistant" data-testid={`hitl-card-${variant}`}>
      <Surface
        variant="card"
        blur
        className="hitl-card"
        role="group"
        aria-label={`Confirmación de ${config.headerLabel.toLowerCase()}`}
        style={config.dangerBorder ? { border: 'var(--danger-border)' } : undefined}
      >
        <div className="hitl-card__header">
          <div className="hitl-card__header-brand">
            <ServiceIcon serviceKey={config.serviceKey} name={config.headerLabel} size={30} radius={9} />
            <MonoLabel className="hitl-card__header-label">{config.headerLabel}</MonoLabel>
          </div>
          {config.badge && <Badge variant={config.badge.variant}>{config.badge.text}</Badge>}
        </div>

        {name && config.fieldLabel && (
          <div className="hitl-card__field">
            <MonoLabel>{config.fieldLabel}</MonoLabel>
            <p className="hitl-card__name">{name}</p>
          </div>
        )}

        {variant === 'cobro' && amount && (
          <div className="hitl-card__field">
            <MonoLabel>MONTO</MonoLabel>
            <p className="hitl-card__amount">
              <span className="hitl-card__amount-sign">$</span>
              {amount}
            </p>
          </div>
        )}

        <p className="hitl-card__concept">{concept}</p>

        {config.note && <p className="hitl-card__note">{config.note}</p>}

        {preview && (
          <div className="hitl-card__preview" data-testid="hitl-preview">
            <p className="hitl-card__preview-title">{preview.title}</p>
            <p className="hitl-card__preview-caption">{preview.caption}</p>
          </div>
        )}

        {variant === 'publicar' && (
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
