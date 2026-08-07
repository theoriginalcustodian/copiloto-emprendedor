import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { SessionProvider } from '../auth/SessionProvider';
import '../design-system/themes.css';
import { THEMES, ThemeProvider } from '../design-system/ThemeProvider';
import { DesktopShell } from './DesktopShell';
import { ModeProvider } from './modeStore';

function renderDesktopShell(initialTab?: 'chat' | 'connections' | 'account') {
  return render(
    <ThemeProvider>
      <SessionProvider>
        <ModeProvider>
          <DesktopShell initialTab={initialTab} />
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

  it('BETA-4b: `initialTab="connections"` aterriza en Conexiones, no en Chat', () => {
    // `connections` salió de `TABS` (depuración 2026-08-06) -- sin botón "Conexiones" en el rail
    // para asertar aria-current, pero `activeTab` sigue siendo una key válida.
    renderDesktopShell('connections');
    expect(screen.getByTestId('connections-screen')).toBeInTheDocument();
    expect(screen.queryByTestId('chat-screen')).not.toBeInTheDocument();
  });

  it('setea data-shell="desktop" en la raíz (hook de tipografía web, ver fonts-web.css)', () => {
    renderDesktopShell();
    expect(screen.getByTestId('desktop-shell')).toHaveAttribute('data-shell', 'desktop');
  });

  it('DESKTOP GATE: el bloque de usuario (reemplazo de Ajustes) sigue presente en el rail', () => {
    renderDesktopShell();
    expect(screen.getByTestId('rail-user')).toBeInTheDocument();
  });

  // `ajustes` salió de `TABS` el 2026-08-07: en escritorio la puerta es el bloque de usuario del
  // rail (`rail-user`, PR 299), no un ítem de la lista. Estos tests navegan por esa puerta real --
  // si alguien la vuelve a romper, se ponen rojos acá y no recién en producción.
  it('ESCRITORIO: Ajustes es alcanzable sin ítem propio -- el bloque de usuario del rail lo abre', () => {
    renderDesktopShell();
    expect(screen.queryByRole('button', { name: 'Ajustes' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('rail-user'));
    expect(screen.getByTestId('pantalla-ajustes')).toBeInTheDocument();
  });

  it('navegar a Ajustes > Apps conectadas monta ConnectionsScreen (camino real post-depuración)', () => {
    renderDesktopShell();
    fireEvent.click(screen.getByTestId('rail-user'));
    fireEvent.click(screen.getByTestId('ajuste-tile-apps'));
    expect(screen.getByTestId('connections-screen')).toBeInTheDocument();
  });

  it('navegar a Ajustes > Mi cuenta monta AccountScreen (camino real post-depuración)', () => {
    renderDesktopShell();
    fireEvent.click(screen.getByTestId('rail-user'));
    fireEvent.click(screen.getByTestId('ajuste-tile-cuenta'));
    expect(screen.getByTestId('account-screen')).toBeInTheDocument();
  });

  it('volver a Chat desde otro tab remonta ChatScreen', () => {
    renderDesktopShell();
    fireEvent.click(screen.getByTestId('rail-user'));
    fireEvent.click(screen.getByRole('button', { name: 'Chat' }));
    expect(screen.getByTestId('chat-screen')).toBeInTheDocument();
  });

  it.each(THEMES)('renderiza bajo el tema "%s" sin romper', (theme) => {
    document.documentElement.setAttribute('data-theme', theme);
    renderDesktopShell();
    expect(screen.getByTestId('desktop-shell')).toBeInTheDocument();
  });
});
