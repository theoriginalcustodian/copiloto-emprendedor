import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SessionProvider } from '../auth/SessionProvider';
import '../design-system/themes.css';
import { THEMES, ThemeProvider } from '../design-system/ThemeProvider';
import { AppShell } from './AppShell';
import { ModeProvider } from './modeStore';

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

function renderAppShell() {
  return render(
    <ThemeProvider>
      <SessionProvider>
        {/* ModeProvider (Feature addendum 2026-07-03): `ChatScreen` -> `Composer` y `AppsScreen`
            leen `useMode()` — sin este wrapper el render tira "useMode debe usarse dentro de
            <ModeProvider>" (mismo criterio que `SessionProvider` acá arriba). */}
        <ModeProvider>
          <AppShell />
        </ModeProvider>
      </SessionProvider>
    </ThemeProvider>,
  );
}

describe('AppShell', () => {
  beforeEach(() => {
    mockMatchMedia();
    window.localStorage.clear();
  });

  it('renderiza el frame + tab-bar y por default muestra el tab Chat (ChatScreen)', () => {
    renderAppShell();
    expect(screen.getByTestId('app-shell')).toBeInTheDocument();
    expect(screen.getByTestId('tab-bar')).toBeInTheDocument();
    expect(screen.getByTestId('chat-screen')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Chat' })).toHaveAttribute('aria-current', 'page');
  });

  it('navegar a Apps muestra AppsScreen y desmonta ChatScreen', () => {
    renderAppShell();
    fireEvent.click(screen.getByRole('button', { name: 'Apps' }));
    expect(screen.getByTestId('apps-screen')).toBeInTheDocument();
    expect(screen.queryByTestId('chat-screen')).not.toBeInTheDocument();
  });

  it('navegar a Conexiones muestra ConnectionsScreen', () => {
    renderAppShell();
    fireEvent.click(screen.getByRole('button', { name: 'Conexiones' }));
    expect(screen.getByTestId('connections-screen')).toBeInTheDocument();
  });

  it('navegar a Cuenta muestra AccountScreen', () => {
    renderAppShell();
    fireEvent.click(screen.getByRole('button', { name: 'Cuenta' }));
    expect(screen.getByTestId('account-screen')).toBeInTheDocument();
  });

  it('volver a Chat desde otro tab remonta ChatScreen', () => {
    renderAppShell();
    fireEvent.click(screen.getByRole('button', { name: 'Cuenta' }));
    fireEvent.click(screen.getByRole('button', { name: 'Chat' }));
    expect(screen.getByTestId('chat-screen')).toBeInTheDocument();
  });

  it.each(THEMES)('renderiza bajo el tema "%s" sin romper', (theme) => {
    document.documentElement.setAttribute('data-theme', theme);
    renderAppShell();
    expect(screen.getByTestId('app-shell')).toBeInTheDocument();
  });
});
