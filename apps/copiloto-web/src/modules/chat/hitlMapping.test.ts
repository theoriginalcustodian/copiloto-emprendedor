import { describe, expect, it, vi } from 'vitest';

import type { ReplyChoice } from '../../lib/api';
import { buildHitlCardProps, classifyChoices, isConfirmCancelPair } from './hitlMapping';
import type { ChatMessage } from './useChat';

const CONFIRM_CANCEL: ReplyChoice[] = [
  { label: 'Sí, cobrar $15.000', value: 'confirm_charge_1' },
  { label: 'Cancelar', value: 'cancel_charge_1' },
];

const DISAMBIGUATION: ReplyChoice[] = [
  { label: 'Juan Pérez', value: 'juan_perez' },
  { label: 'Juan Gómez', value: 'juan_gomez' },
];

function msg(overrides: Partial<ChatMessage>): ChatMessage {
  return { id: 'assistant-1', role: 'assistant', text: '', choices: CONFIRM_CANCEL, ...overrides };
}

describe('hitlMapping', () => {
  it('isConfirmCancelPair reconoce un par confirmar/cancelar', () => {
    expect(isConfirmCancelPair(CONFIRM_CANCEL)).toBe(true);
  });

  it('isConfirmCancelPair rechaza opciones de desambiguación', () => {
    expect(isConfirmCancelPair(DISAMBIGUATION)).toBe(false);
  });

  it('isConfirmCancelPair rechaza undefined/vacío', () => {
    expect(isConfirmCancelPair(undefined)).toBe(false);
    expect(isConfirmCancelPair([])).toBe(false);
  });

  it('classifyChoices: sin choices -> plain', () => {
    expect(classifyChoices(undefined)).toBe('plain');
    expect(classifyChoices([])).toBe('plain');
  });

  it('classifyChoices: confirmar/cancelar -> hitl', () => {
    expect(classifyChoices(CONFIRM_CANCEL)).toBe('hitl');
  });

  it('classifyChoices: opciones múltiples -> choices', () => {
    expect(classifyChoices(DISAMBIGUATION)).toBe('choices');
  });

  it('usa el `card` del backend para servicio/label (NO adivina del texto → nunca "AGENDA")', () => {
    const props = buildHitlCardProps(
      msg({
        text: 'Voy a crear el documento «Presupuesto eléctrico» en Docs. ¿Confirmás?',
        card: { service: 'googledocs', label: 'Google Docs' },
      }),
      vi.fn(),
    );
    expect(props.service).toBe('googledocs');
    expect(props.label).toBe('Google Docs');
    expect(props.badge).toBeUndefined(); // Docs no es una acción de riesgo
    expect(props.amount).toBeUndefined(); // no es un cobro
    expect(props.concept).toContain('Docs');
  });

  it('Mercado Pago: badge REVISAR + monto aislado', () => {
    const props = buildHitlCardProps(
      msg({
        text: 'Voy a generar un link de cobro de MercadoPago por $15.000. ¿Confirmás?',
        card: { service: 'mercadopago', label: 'Mercado Pago' },
      }),
      vi.fn(),
    );
    expect(props.service).toBe('mercadopago');
    expect(props.badge).toEqual({ variant: 'warning', text: 'REVISAR' });
    expect(props.amount).toBe('15.000');
  });

  it('Instagram: badge IRREVERSIBLE + dangerBorder', () => {
    const props = buildHitlCardProps(
      msg({ text: 'Voy a publicar el posteo. ¿Confirmás?', card: { service: 'instagram', label: 'Instagram' } }),
      vi.fn(),
    );
    expect(props.badge).toEqual({ variant: 'danger', text: 'IRREVERSIBLE' });
    expect(props.dangerBorder).toBe(true);
  });

  it('sin `card` (legacy): tarjeta neutra "Confirmación", NUNCA "AGENDA", sin badge', () => {
    const props = buildHitlCardProps(msg({ text: 'Todo listo, confirmá.', card: undefined }), vi.fn());
    expect(props.service).toBe('');
    expect(props.label).toBe('Confirmación');
    expect(props.badge).toBeUndefined();
  });

  it('aísla el nombre en **negrita**, arma los labels y dispara onChoice con el value correcto', () => {
    const onChoice = vi.fn();
    const props = buildHitlCardProps(
      msg({
        text: 'Cobro a **Juan Pérez** por $15.000.',
        card: { service: 'mercadopago', label: 'Mercado Pago' },
      }),
      onChoice,
    );
    expect(props.name).toBe('Juan Pérez');
    expect(props.confirmLabel).toBe('Sí, cobrar $15.000');
    expect(props.cancelLabel).toBe('Cancelar');

    props.onConfirm();
    expect(onChoice).toHaveBeenCalledWith('confirm_charge_1');

    props.onCancel();
    expect(onChoice).toHaveBeenCalledWith('cancel_charge_1');
  });
});
