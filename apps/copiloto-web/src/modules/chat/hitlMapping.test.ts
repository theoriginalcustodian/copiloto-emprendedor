import { describe, expect, it, vi } from 'vitest';

import type { ReplyChoice } from '../../lib/api';
import {
  buildHitlCardProps,
  classifyChoices,
  extractHitlContent,
  isConfirmCancelPair,
} from './hitlMapping';
import type { ChatMessage } from './useChat';

const CONFIRM_CANCEL: ReplyChoice[] = [
  { label: 'Sí, cobrar $15.000', value: 'confirm_charge_1' },
  { label: 'Cancelar', value: 'cancel_charge_1' },
];

const DISAMBIGUATION: ReplyChoice[] = [
  { label: 'Juan Pérez', value: 'juan_perez' },
  { label: 'Juan Gómez', value: 'juan_gomez' },
];

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

  it('extractHitlContent infiere variante "cobro" y aísla nombre/monto', () => {
    const content = extractHitlContent('Preparé el cobro a **Juan Pérez** por $15.000, confirmá.');
    expect(content.variant).toBe('cobro');
    expect(content.name).toBe('Juan Pérez');
    expect(content.amount).toBe('15.000');
  });

  it('extractHitlContent infiere variante "agenda"', () => {
    const content = extractHitlContent('Preparé el turno con **María González** el jueves.');
    expect(content.variant).toBe('agenda');
    expect(content.name).toBe('María González');
  });

  it('extractHitlContent infiere variante "publicar"', () => {
    const content = extractHitlContent('Preparé la publicación para Instagram.');
    expect(content.variant).toBe('publicar');
  });

  it('extractHitlContent sin señales cae al default "agenda" (calmo)', () => {
    const content = extractHitlContent('Todo listo, confirmá cuando quieras.');
    expect(content.variant).toBe('agenda');
    expect(content.name).toBeUndefined();
    expect(content.amount).toBeUndefined();
  });

  it('buildHitlCardProps arma confirm/cancel labels y dispara onChoice con el value correcto', () => {
    const message: ChatMessage = {
      id: 'assistant-1',
      role: 'assistant',
      text: 'Preparé el cobro a **Juan Pérez** por $15.000.',
      choices: CONFIRM_CANCEL,
    };
    const onChoice = vi.fn();
    const props = buildHitlCardProps(message, onChoice);

    expect(props.confirmLabel).toBe('Sí, cobrar $15.000');
    expect(props.cancelLabel).toBe('Cancelar');
    expect(props.name).toBe('Juan Pérez');
    expect(props.amount).toBe('15.000');

    props.onConfirm();
    expect(onChoice).toHaveBeenCalledWith('confirm_charge_1');

    props.onCancel();
    expect(onChoice).toHaveBeenCalledWith('cancel_charge_1');
  });
});
