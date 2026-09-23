import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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

  // HOJA — BIS2 paso (c): «Ahora no» tenía que sobrevivir a un reload y no lo hacía (memoria pura en
  // `useConexionRequerida.ts`). Este bloque ejercita el camino REAL (useChat + useConexionRequerida +
  // SheetRequiereConexion tal como los usa ChatScreen), no sólo cada pieza por separado.
  describe('HOJA: la hoja «conectá X» y su «Ahora no» sobreviven a un reload', () => {
    const SESSION_ID = 'sess-hoja-integracion-test';
    const MESSAGES_KEY = `copiloto-chat-msgs:${SESSION_ID}`;
    const HILO_PENDIENTE = [
      { id: 'user-1', role: 'user', text: 'mandale un mail a Juan' },
      {
        id: 'assistant-1',
        role: 'assistant',
        text: 'Para eso necesito que conectes Gmail primero.',
        card: { kind: 'requiere_conexion', service: 'gmail', label: 'Gmail', connect_path: '/x' },
      },
    ];

    function persistirHilo(mensajes: unknown[]) {
      window.localStorage.setItem('copiloto-chat-session-id', SESSION_ID);
      window.localStorage.setItem(MESSAGES_KEY, JSON.stringify(mensajes));
    }

    it('tocar «Ahora no» + reload (remount): el sheet NO vuelve a abrirse', async () => {
      persistirHilo(HILO_PENDIENTE);
      renderChatScreen();

      expect(await screen.findByTestId('sheet-requiere-conexion')).toBeInTheDocument();
      fireEvent.click(screen.getByTestId('sheet-requiere-conexion-ahora-no'));
      expect(screen.queryByTestId('sheet-requiere-conexion')).not.toBeInTheDocument();

      // La marca tiene que haber quedado en el MENSAJE persistido (no en memoria).
      const stored: unknown = JSON.parse(window.localStorage.getItem(MESSAGES_KEY) ?? '[]');
      expect(stored).toMatchObject([{ id: 'user-1' }, { id: 'assistant-1', conexionDescartada: true }]);

      cleanup(); // desmonta — simula el reload real (recarga = remount desde cero)
      renderChatScreen();
      expect(screen.queryByTestId('sheet-requiere-conexion')).not.toBeInTheDocument();
    });

    it('control negativo — el MISMO hilo pendiente SIN descarte previo sigue abriendo el sheet tras un remount', async () => {
      persistirHilo(HILO_PENDIENTE);
      renderChatScreen();
      expect(await screen.findByTestId('sheet-requiere-conexion')).toBeInTheDocument();

      cleanup();
      renderChatScreen();
      expect(await screen.findByTestId('sheet-requiere-conexion')).toBeInTheDocument();
    });
  });
});
