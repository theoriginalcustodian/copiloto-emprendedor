import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import '../../design-system/themes.css';
import type { ReplyChoice } from '../../lib/api';
import { MessageList } from './MessageList';
import type { ChatMessage } from './useChat';

const CONFIRM_CANCEL: ReplyChoice[] = [
  { label: 'Sí, cobrar $15.000', value: 'confirm_charge_1' },
  { label: 'Cancelar', value: 'cancel_charge_1' },
];

const DISAMBIGUATION: ReplyChoice[] = [
  { label: 'Juan Pérez', value: 'juan_perez' },
  { label: 'Juan Gómez', value: 'juan_gomez' },
];

describe('MessageList', () => {
  it('muestra el mensaje de bienvenida cuando no hay mensajes', () => {
    render(<MessageList messages={[]} onChoice={vi.fn()} emptyHint="Contame qué necesitás." />);
    expect(screen.getByText('Contame qué necesitás.')).toBeInTheDocument();
  });

  it('renderiza burbuja de usuario y de asistente sin choices', () => {
    const messages: ChatMessage[] = [
      { id: 'u1', role: 'user', text: 'Hola' },
      { id: 'a1', role: 'assistant', text: 'Hola, en qué te ayudo?' },
    ];
    render(<MessageList messages={messages} onChoice={vi.fn()} />);
    expect(screen.getByText('Hola')).toBeInTheDocument();
    expect(screen.getByText('Hola, en qué te ayudo?')).toBeInTheDocument();
  });

  it('choices de desambiguación -> burbuja + chips (no HitlCard)', () => {
    const messages: ChatMessage[] = [
      { id: 'a1', role: 'assistant', text: 'Tenés dos "Juan". ¿A cuál le cobro?', choices: DISAMBIGUATION },
    ];
    render(<MessageList messages={messages} onChoice={vi.fn()} />);
    expect(screen.getByText('Tenés dos "Juan". ¿A cuál le cobro?')).toBeInTheDocument();
    expect(screen.getByTestId('disambiguation-chips')).toBeInTheDocument();
    expect(screen.queryByTestId(/hitl-card-/)).not.toBeInTheDocument();
  });

  it('choices confirmar/cancelar -> SOLO HitlCard (sin burbuja duplicada)', () => {
    const messages: ChatMessage[] = [
      {
        id: 'a1',
        role: 'assistant',
        text: 'Preparé el cobro a **Juan Pérez** por $15.000.',
        choices: CONFIRM_CANCEL,
      },
    ];
    render(<MessageList messages={messages} onChoice={vi.fn()} />);
    expect(screen.getByTestId('hitl-card-cobro')).toBeInTheDocument();
    expect(screen.queryByTestId('disambiguation-chips')).not.toBeInTheDocument();
  });

  it('elegir un chip de desambiguación dispara onChoice con el value', () => {
    const onChoice = vi.fn();
    const messages: ChatMessage[] = [
      { id: 'a1', role: 'assistant', text: '¿Cuál Juan?', choices: DISAMBIGUATION },
    ];
    render(<MessageList messages={messages} onChoice={onChoice} />);
    fireEvent.click(screen.getByRole('button', { name: 'Juan Gómez' }));
    expect(onChoice).toHaveBeenCalledWith('juan_gomez');
  });
});
