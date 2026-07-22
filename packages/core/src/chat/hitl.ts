import type { ReplyChoice } from '../api/types';
import type { ChatMessage } from './chatMachine';

/**
 * Detección del gate de negocio (confirmar/cancelar) — adaptado del `hitlMapping.ts` de origen.
 * Mecanismo GENÉRICO heredado del copiloto de emprendedores original
 * (`isConfirmCancelPair`/`classifyChoices` allá, sin cambios de comportamiento acá): un reply con
 * EXACTAMENTE 2 choices, uno que matchea confirmar y otro cancelar, es un gate. En el proyecto de
 * origen (DocuMed) el ÚNICO gate que existía era el clínico; acá cualquier confirm/cancel de negocio
 * se mapea igual, nunca a una tarjeta de HITL genérica separada.
 *
 * **Cero React, cero DOM.** A diferencia del `hitlMapping.ts` original —que recibía un callback
 * `onChoice` y devolvía closures `onConfirm`/`onCancel` listos para pasarle a la vista— acá
 * `mapearGate` devuelve sólo DATOS (markdown + labels + los `value` de confirmar/cancelar). Armar el
 * callback que efectivamente dispara el envío (`send`/`dispatch` de cada plataforma) es
 * responsabilidad de la vista, no de esta capa: así `mapearGate` es reusable tal cual desde
 * cualquier UI, sin que el core conozca la firma de `onChoice` de ninguna de las dos apps.
 */

const CONFIRM_VALUE_RE = /confirm|aceptar|^si[_-]|^yes\b|^ok[_-]/i;
const CANCEL_VALUE_RE = /cancel|^no[_-]|reject/i;

export function esParConfirmarCancelar(choices?: ReplyChoice[] | null): boolean {
  if (!choices || choices.length !== 2) return false;
  const hasConfirm = choices.some((choice) => CONFIRM_VALUE_RE.test(choice.value));
  const hasCancel = choices.some((choice) => CANCEL_VALUE_RE.test(choice.value));
  return hasConfirm && hasCancel;
}

export type TipoMensaje = 'plain' | 'choices' | 'hitl';

export function clasificarChoices(choices?: ReplyChoice[] | null): TipoMensaje {
  if (!choices || choices.length === 0) return 'plain';
  return esParConfirmarCancelar(choices) ? 'hitl' : 'choices';
}

const CONFIRM_FALLBACK: ReplyChoice = { label: 'Confirmar', value: 'confirm' };
const CANCEL_FALLBACK: ReplyChoice = { label: 'Cancelar', value: 'cancel' };

export interface Gate {
  markdown: string;
  confirmLabel: string;
  cancelLabel: string;
  /** El `value` que hay que mandar (en `onChoice` / `ChatRequest`) para confirmar el gate. */
  confirmValue: string;
  /** El `value` que hay que mandar para cancelarlo. */
  cancelValue: string;
}

/**
 * Convierte un `ChatMessage` en el gate de negocio a mostrar, o `null` si no lo es
 * (`clasificarChoices(mensaje.choices) !== 'hitl'`).
 *
 * El markdown a editar viaja PRIMARIO en `mensaje.text` (el motor manda el preview como texto del
 * reply en el gate de negocio; la card del gate es sólo `{kind:'confirm', service, label}`, NUNCA
 * lleva el MD). `mensaje.card?.markdown` es un fallback defensivo por si un reply futuro empieza a
 * incluirlo ahí — nunca la fuente hoy.
 */
export function mapearGate(mensaje: ChatMessage): Gate | null {
  if (clasificarChoices(mensaje.choices) !== 'hitl') return null;

  const choices = mensaje.choices ?? [];
  const confirmChoice =
    choices.find((choice) => CONFIRM_VALUE_RE.test(choice.value)) ?? choices[0] ?? CONFIRM_FALLBACK;
  const cancelChoice =
    choices.find((choice) => CANCEL_VALUE_RE.test(choice.value)) ?? choices[1] ?? CANCEL_FALLBACK;

  return {
    markdown: mensaje.card?.markdown ?? mensaje.text,
    confirmLabel: confirmChoice.label,
    cancelLabel: cancelChoice.label,
    confirmValue: confirmChoice.value,
    cancelValue: cancelChoice.value,
  };
}
