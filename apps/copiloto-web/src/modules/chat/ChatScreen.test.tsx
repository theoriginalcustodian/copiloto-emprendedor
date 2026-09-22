import { render, screen } from '@testing-library/react';
import { dejarPendiente, tomarPendiente } from '@copiloto/core';
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
    // Matriz web A4 Criterio 3 fila 1: texto literal de
    // `Prototipo frontend/odobi-ui/prototipo/index.html:1886` (`.contrato`).
    expect(screen.getByText('Antes de ejecutar algo importante, te lo muestro para que lo confirmes.')).toBeInTheDocument();
  });

  it('A4 Criterio 3 fila 1: vacío del chat general con isotipo + headline centrados (proto `#vacio`)', () => {
    renderChatScreen();
    expect(screen.getByTestId('chat-vacio')).toBeInTheDocument();
    expect(screen.getByTestId('marca')).toBeInTheDocument();
    expect(screen.getByText('¿En qué te ayudo?')).toBeInTheDocument();
    // BL-W4 (decisión de planificación, se queda a propósito aunque el proto no lo tenga).
    expect(screen.getByTestId('rodillo-pausa')).toBeInTheDocument();
  });

  it.each(THEMES)('renderiza bajo el tema "%s" sin romper', (theme) => {
    document.documentElement.setAttribute('data-theme', theme);
    renderChatScreen();
    expect(screen.getByTestId('chat-screen')).toBeInTheDocument();
  });

  it('BL-W9: manda al montar la pregunta que dejó una pantalla de ayuda, y vacía el buzón', async () => {
    dejarPendiente('¿Cómo emito mi primera factura?');
    renderChatScreen();
    expect(await screen.findByText('¿Cómo emito mi primera factura?')).toBeInTheDocument();
    expect(tomarPendiente()).toBeNull();
  });
});
