import type { ReplyChoice } from '../../lib/api';
import type { HitlVariant } from './HitlCard';
import type { ChatMessage } from './useChat';

/**
 * Heurística de clasificación/mapeo de `choices` -> HITL vs. chips de desambiguación (Tasks
 * 13/14). El contrato ACTUAL de `/reply` (`ReplyChoice = {label, value}`, ver
 * `lib/api/types.ts`) NO trae un campo explícito de "tipo de acción" ni datos estructurados de
 * HITL (variante de riesgo, monto, nombre, preview) — mientras el backend no lo agregue, esto
 * infiere:
 *
 *   1) si el choice-set es un par confirmar/cancelar (por patrón en `value`) -> HITL card.
 *   2) si no, pero hay >=1 choice -> chips de desambiguación.
 *   3) la VARIANTE de riesgo (cobro/agenda/publicar) y el nombre/monto aislado se infieren del
 *      `text` del mensaje (keywords + regex de `$monto` + `**nombre**` en negrita markdown).
 *
 * ASUNCIÓN A VALIDAR (ver report del Task 13/14): esto es best-effort, NO un contrato. El diseño
 * ideal es que el backend evolucione `ReplyMessage`/`ReplyChoice` para traer `kind: 'hitl' |
 * 'choices'`, `variant`, `name`, `amount`, `preview` explícitos — remover esta heurística ese
 * día (reemplazar `buildHitlCardProps` por un mapeo directo campo-a-campo, sin regex).
 */

const CONFIRM_VALUE_RE = /confirm|aceptar|^si[_-]|^yes\b|^ok[_-]/i;
const CANCEL_VALUE_RE = /cancel|^no[_-]|reject/i;

export function isConfirmCancelPair(choices?: ReplyChoice[] | null): boolean {
  if (!choices || choices.length !== 2) return false;
  const hasConfirm = choices.some((choice) => CONFIRM_VALUE_RE.test(choice.value));
  const hasCancel = choices.some((choice) => CANCEL_VALUE_RE.test(choice.value));
  return hasConfirm && hasCancel;
}

export type MessageKind = 'plain' | 'choices' | 'hitl';

export function classifyChoices(choices?: ReplyChoice[] | null): MessageKind {
  if (!choices || choices.length === 0) return 'plain';
  return isConfirmCancelPair(choices) ? 'hitl' : 'choices';
}

const VARIANT_PATTERNS: Array<[RegExp, HitlVariant]> = [
  [/public|instagram|\bpost(?:eo)?\b/i, 'publicar'],
  [/agend|turno|reuni[oó]n|calendar/i, 'agenda'],
  [/cobr|pago|monto|\$/i, 'cobro'],
];

function inferVariant(text: string): HitlVariant {
  for (const [pattern, variant] of VARIANT_PATTERNS) {
    if (pattern.test(text)) return variant;
  }
  return 'agenda'; // default "calmo": no asumir riesgo (cobro/irreversible) sin señal clara.
}

const BOLD_NAME_RE = /\*\*(.+?)\*\*/;
// Empieza y termina en dígito (grupos de miles/decimales internos) — evita capturar puntuación
// de la oración ("$15.000, confirmá" no debe incluir la coma final).
const AMOUNT_RE = /\$\s?(\d+(?:[.,]\d+)*)/;

export interface HitlContent {
  variant: HitlVariant;
  name?: string;
  amount?: string;
  concept: string;
}

export function extractHitlContent(text: string): HitlContent {
  const boldMatch = text.match(BOLD_NAME_RE);
  const amountMatch = text.match(AMOUNT_RE);
  return {
    variant: inferVariant(text),
    name: boldMatch?.[1],
    amount: amountMatch?.[1],
    concept: text,
  };
}

const FALLBACK_CONFIRM: ReplyChoice = { label: 'Confirmar', value: 'confirm' };
const FALLBACK_CANCEL: ReplyChoice = { label: 'Cancelar', value: 'cancel' };

export interface HitlCardMappedProps {
  variant: HitlVariant;
  name?: string;
  amount?: string;
  concept: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Convierte un `ChatMessage` (ya clasificado como HITL vía `classifyChoices`) en las props que
 * consume `<HitlCard>`. `onChoice` es el callback que dispara `send(value, {kind:'callback'})`.
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
  const content = extractHitlContent(message.text);

  return {
    variant: content.variant,
    name: content.name,
    amount: content.amount,
    concept: content.concept,
    confirmLabel: confirmChoice.label,
    cancelLabel: cancelChoice.label,
    onConfirm: () => onChoice(confirmChoice.value),
    onCancel: () => onChoice(cancelChoice.value),
  };
}
