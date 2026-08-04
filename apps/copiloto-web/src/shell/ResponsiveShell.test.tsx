import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SessionProvider } from '../auth/SessionProvider';
import '../design-system/themes.css';
import { ThemeProvider } from '../design-system/ThemeProvider';
import { ModeProvider } from './modeStore';
import { ResponsiveShell } from './ResponsiveShell';

/** Mockea `matchMedia` para que la media query desktop (`(min-width: 900px)`) matchee o no —
 * mismo patrón que `AppShell.test.tsx` (ahí siempre `matches:false`, acá parametrizable). */
function mockMatchMedia(matches: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

function renderResponsiveShell(initialTab?: 'chat' | 'connections' | 'account') {
  return render(
    <ThemeProvider>
      <SessionProvider>
        <ModeProvider>
          <ResponsiveShell initialTab={initialTab} />
        </ModeProvider>
      </SessionProvider>
    </ThemeProvider>,
  );
}

describe('ResponsiveShell', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  it('viewport angosto (<900px) monta AppShell (tab-bar mobile visible, rail ausente)', () => {
    mockMatchMedia(false);
    renderResponsiveShell();
    expect(screen.getByTestId('app-shell')).toBeInTheDocument();
    expect(screen.getByTestId('tab-bar')).toBeInTheDocument();
    expect(screen.queryByTestId('desktop-shell')).not.toBeInTheDocument();
    expect(screen.queryByTestId('rail')).not.toBeInTheDocument();
  });

  it('viewport ancho (>=900px) monta DesktopShell (rail visible, tab-bar ausente)', () => {
    mockMatchMedia(true);
    renderResponsiveShell();
    expect(screen.getByTestId('desktop-shell')).toBeInTheDocument();
    expect(screen.getByTestId('rail')).toBeInTheDocument();
    expect(screen.queryByTestId('app-shell')).not.toBeInTheDocument();
    expect(screen.queryByTestId('tab-bar')).not.toBeInTheDocument();
  });

  it('en ambos breakpoints monta la misma pantalla de módulo (Chat) por default', () => {
    mockMatchMedia(false);
    const { unmount } = renderResponsiveShell();
    expect(screen.getByTestId('chat-screen')).toBeInTheDocument();
    unmount();

    mockMatchMedia(true);
    renderResponsiveShell();
    expect(screen.getByTestId('chat-screen')).toBeInTheDocument();
  });

  it('BETA-4b: `initialTab` se propaga tal cual al shell montado en ambos breakpoints', () => {
    mockMatchMedia(false);
    const { unmount } = renderResponsiveShell('connections');
    expect(screen.getByTestId('connections-screen')).toBeInTheDocument();
    unmount();

    mockMatchMedia(true);
    renderResponsiveShell('connections');
    expect(screen.getByTestId('connections-screen')).toBeInTheDocument();
  });
});
