import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { DesktopChatHeader } from './DesktopChatHeader';

describe('DesktopChatHeader', () => {
  it('muestra el fragmento corto de la sesión (sess_XXXX)', () => {
    render(<DesktopChatHeader sessionId="9f2a1234-abcd-0000-1111-222233334444" onNewConversation={() => {}} />);
    // Primeros 4 chars del uuid sin guiones -> "9f2a".
    expect(screen.getByText(/SESIÓN ACTIVA · sess_9f2a/)).toBeInTheDocument();
  });

  it('degrada a un placeholder si no hay sessionId', () => {
    render(<DesktopChatHeader sessionId="" onNewConversation={() => {}} />);
    expect(screen.getByTestId('desktop-chat-header')).toBeInTheDocument();
  });

  it('dispara onNewConversation al tocar "Nueva conversación"', () => {
    const onNew = vi.fn();
    render(<DesktopChatHeader sessionId="abcd0000" onNewConversation={onNew} />);
    fireEvent.click(screen.getByTestId('new-conversation'));
    expect(onNew).toHaveBeenCalledTimes(1);
  });
});
