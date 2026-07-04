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

  it('tocar "Apps" abre el modal centrado SOBRE el Chat (no navega, gap #1 del audit desktop)', () => {
    renderDesktopShell();
    fireEvent.click(screen.getByRole('button', { name: 'Apps' }));
    expect(screen.getByTestId('apps-screen')).toBeInTheDocument();
    // Chat sigue montado detrás del modal — Apps es un overlay, no una pantalla de tab.
    expect(screen.getByTestId('chat-screen')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Chat' })).toHaveAttribute('aria-current', 'page');
  });

  it('cierra el modal de Apps al click en el botón X', () => {
    renderDesktopShell();
    fireEvent.click(screen.getByRole('button', { name: 'Apps' }));
    expect(screen.getByTestId('apps-modal-root')).toHaveClass('apps-modal-root--open');

    fireEvent.click(screen.getByTestId('apps-modal-close'));
    expect(screen.getByTestId('apps-modal-root')).not.toHaveClass('apps-modal-root--open');
  });

  it('cierra el modal de Apps al click en el scrim', () => {
    renderDesktopShell();
    fireEvent.click(screen.getByRole('button', { name: 'Apps' }));

    fireEvent.click(screen.getByTestId('apps-modal-scrim'));
    expect(screen.getByTestId('apps-modal-root')).not.toHaveClass('apps-modal-root--open');
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
