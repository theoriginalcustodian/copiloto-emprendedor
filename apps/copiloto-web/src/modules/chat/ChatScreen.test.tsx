import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SessionProvider } from '../../auth/SessionProvider';
import '../../design-system/themes.css';
import { THEMES, ThemeProvider } from '../../design-system/ThemeProvider';
import { ModeProvider } from '../../shell/modeStore';
import { ChatScreen } from './ChatScreen';

function mockMatchMedia() {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

function renderChatScreen() {
  return render(
    <ThemeProvider>
      <SessionProvider>
        {/* ModeProvider (Feature addendum 2026-07-03): `Composer` lee `useMode()` para el
            placeholder/chip de modo — sin este wrapper el render tira. */}
        <ModeProvider>
          <ChatScreen />
        </ModeProvider>
      </SessionProvider>
    </ThemeProvider>,
  );
}

describe('ChatScreen', () => {
  beforeEach(() => {
    mockMatchMedia();
    window.localStorage.clear();
  });

  it('en móvil renderiza SIN header (ni StatusBar ni marca), sólo mensajes + composer', () => {
    renderChatScreen();
    expect(screen.getByTestId('chat-screen')).toBeInTheDocument();
    // El móvil ya no lleva header (pedido operador 2026-07-04): ni el mock de hora/batería
    // (StatusBar) ni la marca "Copiloto"/ES-AR/contador (ChatHeader).
    expect(screen.queryByTestId('status-bar')).not.toBeInTheDocument();
    expect(screen.queryByTestId('chat-header')).not.toBeInTheDocument();
    expect(screen.getByTestId('message-list')).toBeInTheDocument();
    expect(screen.getByTestId('composer')).toBeInTheDocument();
    expect(screen.getByText(/Antes de tocar nada/)).toBeInTheDocument();
  });

  it.each(THEMES)('renderiza bajo el tema "%s" sin romper', (theme) => {
    document.documentElement.setAttribute('data-theme', theme);
    renderChatScreen();
    expect(screen.getByTestId('chat-screen')).toBeInTheDocument();
  });
});
