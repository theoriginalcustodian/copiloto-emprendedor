import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { SessionProvider } from '../auth/SessionProvider';
import '../design-system/themes.css';
import { THEMES, ThemeProvider } from '../design-system/ThemeProvider';
import { DesktopShell } from './DesktopShell';
import { ModeProvider } from './modeStore';

function renderDesktopShell() {
  return render(
    <ThemeProvider>
      <SessionProvider>
        <ModeProvider>
          <DesktopShell />
        </ModeProvider>
      </SessionProvider>
    </ThemeProvider>,
  );
}

describe('DesktopShell', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  it('renderiza el rail + por default monta la pantalla del tab Chat (ChatScreen)', () => {
    renderDesktopShell();
    expect(screen.getByTestId('desktop-shell')).toBeInTheDocument();
    expect(screen.getByTestId('rail')).toBeInTheDocument();
    expect(screen.getByTestId('chat-screen')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Chat' })).toHaveAttribute('aria-current', 'page');
  });

  it('setea data-shell="desktop" en la raíz (hook de tipografía web, ver fonts-web.css)', () => {
    renderDesktopShell();
    expect(screen.getByTestId('desktop-shell')).toHaveAttribute('data-shell', 'desktop');
  });

  it('navegar a Apps monta AppsScreen y desmonta ChatScreen', () => {
    renderDesktopShell();
    fireEvent.click(screen.getByRole('button', { name: 'Apps' }));
    expect(screen.getByTestId('apps-screen')).toBeInTheDocument();
    expect(screen.queryByTestId('chat-screen')).not.toBeInTheDocument();
  });

  it('navegar a Conexiones monta ConnectionsScreen', () => {
    renderDesktopShell();
    fireEvent.click(screen.getByRole('button', { name: 'Conexiones' }));
    expect(screen.getByTestId('connections-screen')).toBeInTheDocument();
  });

  it('navegar a Cuenta monta AccountScreen', () => {
    renderDesktopShell();
    fireEvent.click(screen.getByRole('button', { name: 'Cuenta' }));
    expect(screen.getByTestId('account-screen')).toBeInTheDocument();
  });

  it('volver a Chat desde otro tab remonta ChatScreen', () => {
    renderDesktopShell();
    fireEvent.click(screen.getByRole('button', { name: 'Cuenta' }));
    fireEvent.click(screen.getByRole('button', { name: 'Chat' }));
    expect(screen.getByTestId('chat-screen')).toBeInTheDocument();
  });

  it.each(THEMES)('renderiza bajo el tema "%s" sin romper', (theme) => {
    document.documentElement.setAttribute('data-theme', theme);
    renderDesktopShell();
    expect(screen.getByTestId('desktop-shell')).toBeInTheDocument();
  });
});
