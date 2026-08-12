import { esParConfirmarCancelar, type TipoMensaje, clasificarChoices } from '@copiloto/core';
import type { BadgeVariant } from '../../design-system';
import type { ReplyChoice } from '../../lib/api';
import type { ChatMessage } from './useChat';

/**
 * Mapeo de un `ChatMessage` HITL (par confirmar/cancelar) a las props de `<HitlCard>`.
 *
 * La IDENTIDAD de la tarjeta (qué app: ícono + nombre) sale del `card` que manda el BACKEND
 * (`ChatMessage.card = {service, label}`), NO de adivinar keywords del texto — el diseño viejo caía
 * SIEMPRE en "AGENDA" para todo lo que no fuera un cobro/publicación. El texto del reply solo se usa
 * para el `concept` y para aislar el nombre (**negrita**) / el monto ($) cuando aplica.
 *
 * La CLASIFICACIÓN (¿es un gate HITL?) es la misma para las dos plataformas — converge a
 * `@copiloto/core` (`esParConfirmarCancelar`/`clasificarChoices`, ver `hitl.ts`; Pasada 3 de
 * auditoría, hallazgo H-2, la marcó reimplementada acá sin importarla). Lo que SÍ es específico de
 * esta plataforma es CONSTRUIR las props de `<HitlCard>` (badge de riesgo por servicio, nombre/monto
 * parseados del texto, los closures `onConfirm`/`onCancel`) — eso queda local, no tiene equivalente
 * en core.
 */

export const isConfirmCancelPair = esParConfirmarCancelar;
export type MessageKind = TipoMensaje;
export const classifyChoices: (choices?: ReplyChoice[] | null) => MessageKind = clasificarChoices;

/** Sólo para ubicar el confirmChoice/cancelChoice AL CONSTRUIR las props de `<HitlCard>` (badge,
 * nombre, monto) — la clasificación en sí ya no vive acá, ver arriba. */
const CONFIRM_VALUE_RE = /confirm|aceptar|^si[_-]|^yes\b|^ok[_-]/i;
const CANCEL_VALUE_RE = /cancel|^no[_-]|reject/i;

/** Nombre en **negrita** (destinatario) — opcional, aplica a cualquier servicio. */
const BOLD_NAME_RE = /\*\*(.+?)\*\*/;
// Empieza y termina en dígito (grupos de miles/decimales internos) — evita capturar puntuación de la
// oración ("$15.000, confirmá" no debe incluir la coma final).
const AMOUNT_RE = /\$\s?(\d+(?:[.,]\d+)*)/;

/**
 * Affordances de riesgo POR SERVICIO (intrínsecas al servicio, no al texto): Mercado Pago muestra el
 * monto + badge "REVISAR"; Instagram es irreversible (badge "IRREVERSIBLE" + borde de alerta). El
 * resto = tarjeta neutra (solo ícono + nombre + concepto). Servicios sin entrada acá caen a `{}`.
 */
const SERVICE_RISK: Record<
  string,
  { badge?: { variant: BadgeVariant; text: string }; dangerBorder?: boolean; showAmount?: boolean }
> = {
  mercadopago: { badge: { variant: 'warning', text: 'REVISAR' }, showAmount: true },
  instagram: { badge: { variant: 'danger', text: 'IRREVERSIBLE' }, dangerBorder: true },
};

const FALLBACK_CONFIRM: ReplyChoice = { label: 'Confirmar', value: 'confirm' };
const FALLBACK_CANCEL: ReplyChoice = { label: 'Cancelar', value: 'cancel' };

export interface HitlCardMappedProps {
  service: string;
  label: string;
  name?: string;
  amount?: string;
  concept: string;
  badge?: { variant: BadgeVariant; text: string };
  dangerBorder?: boolean;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Convierte un `ChatMessage` (ya clasificado como HITL vía `classifyChoices`) en las props que
 * consume `<HitlCard>`. `onChoice` dispara `send(value, {kind:'callback'})`.
 */
export function buildHitlCardProps(
  message: ChatMessage,
  onChoice: (value: string) => void,
): HitlCardMappedProps {
  const choices = message.choices ?? [];
  const confirmChoice =
    choices.find((choice) => CONFIRM_VALUE_RE.test(choice.value)) ?? choices[0] ?? FALLBACK_CONFIRM;
  const cancelChoice =
    choices.find((choice) => CANCEL_VALUE_RE.test(choice.value)) ?? choices[1] ?? FALLBACK_CANCEL;

  const service = (message.card?.service ?? '').toLowerCase();
  // Sin `card` (reply legacy o un par confirmar/cancelar sin servicio): tarjeta neutra, NUNCA "AGENDA".
  const label = message.card?.label || 'Confirmación';
  const risk = SERVICE_RISK[service] ?? {};
  const boldMatch = message.text.match(BOLD_NAME_RE);
  const amountMatch = risk.showAmount ? message.text.match(AMOUNT_RE) : null;

  return {
    service,
    label,
    name: boldMatch?.[1],
    amount: amountMatch?.[1],
    concept: message.text,
    badge: risk.badge,
    dangerBorder: risk.dangerBorder,
    confirmLabel: confirmChoice.label,
    cancelLabel: cancelChoice.label,
    onConfirm: () => onChoice(confirmChoice.value),
    onCancel: () => onChoice(cancelChoice.value),
  };
}
