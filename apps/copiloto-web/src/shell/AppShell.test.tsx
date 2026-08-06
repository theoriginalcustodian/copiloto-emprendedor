import { act, fireEvent, render, screen } from '@testing-library/react';
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

function renderAppShell(initialTab?: 'chat' | 'connections' | 'account') {
  return render(
    <ThemeProvider>
      <SessionProvider>
        {/* ModeProvider (Feature addendum 2026-07-03): `ChatScreen` -> `Composer` y `AppsScreen`
            leen `useMode()` — sin este wrapper el render tira "useMode debe usarse dentro de
            <ModeProvider>" (mismo criterio que `SessionProvider` acá arriba). */}
        <ModeProvider>
          <AppShell initialTab={initialTab} />
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

  it('BETA-4b: `initialTab="connections"` aterriza en Conexiones, no en Chat', () => {
    // `connections` salió de `TABS` (depuración 2026-08-06, absorbido por Ajustes > Apps
    // conectadas) -- ya no hay botón "Conexiones" en la barra para asertar aria-current, pero
    // `activeTab` sigue siendo una key válida: la pantalla debe montar igual.
    renderAppShell('connections');
    expect(screen.getByTestId('connections-screen')).toBeInTheDocument();
    expect(screen.queryByTestId('chat-screen')).not.toBeInTheDocument();
  });

  it('MOBILE GATE: Ajustes sigue en la barra -- el reemplazo por "ícono del usuario" no existe en mobile (ChatHeader sin montar)', () => {
    // Contrato depuración-barra 2026-08-06, control positivo: si esto alguna vez deja de fallar
    // (porque alguien monta ChatHeader o agrega otro camino a Ajustes en mobile), recién ahí
    // `ajustes` puede salir de `TABS` sin dejar la pantalla inalcanzable en el teléfono.
    renderAppShell();
    expect(screen.getByRole('button', { name: 'Ajustes' })).toBeInTheDocument();
    expect(screen.queryByTestId('chat-header')).not.toBeInTheDocument();
  });

  it('navegar a Ajustes > Apps conectadas muestra ConnectionsScreen (camino real post-depuración)', () => {
    renderAppShell();
    fireEvent.click(screen.getByRole('button', { name: 'Ajustes' }));
    fireEvent.click(screen.getByTestId('ajuste-tile-apps'));
    expect(screen.getByTestId('connections-screen')).toBeInTheDocument();
  });

  it('navegar a Ajustes > Mi cuenta muestra AccountScreen (camino real post-depuración)', () => {
    renderAppShell();
    fireEvent.click(screen.getByRole('button', { name: 'Ajustes' }));
    fireEvent.click(screen.getByTestId('ajuste-tile-cuenta'));
    expect(screen.getByTestId('account-screen')).toBeInTheDocument();
  });

  it('volver a Chat desde otro tab remonta ChatScreen', () => {
    renderAppShell();
    fireEvent.click(screen.getByRole('button', { name: 'Ajustes' }));
    fireEvent.click(screen.getByRole('button', { name: 'Chat' }));
    expect(screen.getByTestId('chat-screen')).toBeInTheDocument();
  });

  it('el botón atrás desde otro tab vuelve a Chat en vez de salir', () => {
    renderAppShell();
    fireEvent.click(screen.getByRole('button', { name: 'Ajustes' }));
    expect(screen.getByTestId('pantalla-ajustes')).toBeInTheDocument();

    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state }));
    });
    expect(screen.getByTestId('chat-screen')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Chat' })).toHaveAttribute('aria-current', 'page');
  });

  it.each(THEMES)('renderiza bajo el tema "%s" sin romper', (theme) => {
    document.documentElement.setAttribute('data-theme', theme);
    renderAppShell();
    expect(screen.getByTestId('app-shell')).toBeInTheDocument();
  });
});
