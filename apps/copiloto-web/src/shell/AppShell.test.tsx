import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/** Partial mock: sólo la red de Actividad/Clientes — mismo arnés que `TarjetaClientePropuesto.test.tsx`.
 * D14 necesita datos reales (una fila `cliente`, la ficha de `obtenerCliente`) para ejercitar el
 * camino fila -> `onAbrirCliente(id)` -> shell -> `ClientesScreen` de punta a punta. */
vi.mock('@copiloto/core', async (importOriginal) => {
  const original = await importOriginal<typeof import('@copiloto/core')>();
  return {
    ...original,
    listarActividad: vi.fn(),
    obtenerCliente: vi.fn(),
  };
});

import { listarActividad, obtenerCliente } from '@copiloto/core';

import { SessionProvider } from '../auth/SessionProvider';
import '../design-system/themes.css';
import { THEMES, ThemeProvider } from '../design-system/ThemeProvider';
import { AppShell } from './AppShell';
import { ModeProvider } from './modeStore';

const mockListarActividad = vi.mocked(listarActividad);
const mockObtenerCliente = vi.mocked(obtenerCliente);

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

  it('renderiza el frame + tab-bar y por default aterriza en Mi día (BL-X1)', () => {
    renderAppShell();
    expect(screen.getByTestId('app-shell')).toBeInTheDocument();
    expect(screen.getByTestId('tab-bar')).toBeInTheDocument();
    expect(screen.getByTestId('pantalla-midia')).toBeInTheDocument();
    expect(screen.queryByTestId('chat-screen')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mi día' })).toHaveAttribute('aria-current', 'page');
  });

  it('BETA-4b: `initialTab="connections"` aterriza en Conexiones, no en Chat', () => {
    // `connections` salió de `TABS` (depuración 2026-08-06, absorbido por Ajustes > Apps
    // conectadas) -- ya no hay botón "Conexiones" en la barra para asertar aria-current, pero
    // `activeTab` sigue siendo una key válida: la pantalla debe montar igual.
    renderAppShell('connections');
    expect(screen.getByTestId('connections-screen')).toBeInTheDocument();
    expect(screen.queryByTestId('chat-screen')).not.toBeInTheDocument();
  });

  // Reemplaza al "MOBILE GATE" que exigía `ajustes` en la barra (contrato depuración-barra
  // 2026-08-06). Aquel gate pedía un reemplazo y sólo contemplaba uno: montar `ChatHeader`. El
  // camino que SÍ existe es otro -- Funciones (que sigue en la barra) → tile Ajustes -- y este test
  // lo EJERCITA en vez de afirmarlo. Mientras pase, `ajustes` puede estar fuera de `TABS` sin dejar
  // la pantalla inalcanzable en el teléfono; si alguien rompe el wireo (`FUNCION_A_TAB.ajustes`) o
  // saca el tile, esto se pone rojo y la decisión se revisa.
  it('MOBILE: Ajustes se abre SÓLO por el avatar -- ni tab ni tile de Funciones (BL-X1)', () => {
    renderAppShell();
    expect(screen.queryByRole('button', { name: 'Ajustes' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Funciones' }));
    expect(screen.queryByTestId('tile-ajustes')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Mi día' }));
    fireEvent.click(screen.getByTestId('avatar-cuenta'));
    expect(screen.getByTestId('pantalla-ajustes')).toBeInTheDocument();
  });

  it('el avatar también está en Funciones y abre Ajustes', () => {
    renderAppShell();
    fireEvent.click(screen.getByRole('button', { name: 'Funciones' }));
    fireEvent.click(screen.getByTestId('avatar-cuenta'));
    expect(screen.getByTestId('pantalla-ajustes')).toBeInTheDocument();
  });

  it('navegar a Ajustes > Apps conectadas muestra ConnectionsScreen (camino real post-depuración)', () => {
    renderAppShell();
    fireEvent.click(screen.getByTestId('avatar-cuenta'));
    fireEvent.click(screen.getByTestId('ajuste-tile-apps'));
    expect(screen.getByTestId('connections-screen')).toBeInTheDocument();
  });

  it('navegar a Ajustes > Mi cuenta muestra AccountScreen (camino real post-depuración)', () => {
    renderAppShell();
    fireEvent.click(screen.getByTestId('avatar-cuenta'));
    fireEvent.click(screen.getByTestId('ajuste-tile-cuenta'));
    expect(screen.getByTestId('account-screen')).toBeInTheDocument();
  });

  it('BL-W9: «Cómo uso la app» muestra los temas y cada uno abre el chat principal con su pregunta', async () => {
    renderAppShell();
    fireEvent.click(screen.getByTestId('avatar-cuenta'));
    fireEvent.click(screen.getByTestId('ajuste-tile-cuenta'));
    fireEvent.click(screen.getByTestId('account-como-uso-la-app'));
    expect(screen.getByTestId('pantalla-como-usar')).toBeInTheDocument();
    expect(screen.queryByTestId('soporte-screen')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('como-usar-tema-2'));
    expect(screen.getByTestId('chat-screen')).toBeInTheDocument();
    expect(await screen.findByText('¿Cómo conecto Mercado Pago y qué vas a poder ver?')).toBeInTheDocument();
  });

  it('volver a Chat desde Mi día remonta ChatScreen', () => {
    renderAppShell();
    fireEvent.click(screen.getByRole('button', { name: 'Funciones' }));
    fireEvent.click(screen.getByRole('button', { name: 'Chat' }));
    expect(screen.getByTestId('chat-screen')).toBeInTheDocument();
  });

  it('el botón atrás desde otro tab vuelve a Mi día en vez de salir', () => {
    renderAppShell();
    fireEvent.click(screen.getByTestId('avatar-cuenta'));
    expect(screen.getByTestId('pantalla-ajustes')).toBeInTheDocument();

    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state }));
    });
    expect(screen.getByTestId('pantalla-midia')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mi día' })).toHaveAttribute('aria-current', 'page');
  });

  it.each(THEMES)('renderiza bajo el tema "%s" sin romper', (theme) => {
    document.documentElement.setAttribute('data-theme', theme);
    renderAppShell();
    expect(screen.getByTestId('app-shell')).toBeInTheDocument();
  });
});

// BL-D7 retiró el botón directo a "Actividad" de la barra ‹900px -- la ruta D14 original (fila de
// Actividad -> `onAbrirCliente` -> ficha) queda intacta y con cobertura COMPLETA en
// `DesktopShell.test.tsx` (mismo describe, vía Rail -- `tabsVisibles` sin filtrar, no tocado por
// BL-D7). En el shell angosto "Ver recientes" ya no abre `ActividadScreen`: abre `RecientesScreen`
// (`AppShell.tsx` -- `onVerRecientes={() => changeTab('recientes')}`), que reusa `FilaActividad`
// pero SIN pasarle `onAbrirCliente` -- a propósito ("Decisión B" en el docstring de
// `RecientesScreen.tsx`: *"nunca envuelve nada tocable [...] la actividad reciente es registro, no
// acción"*), igual que mobile (`PantallaPrincipal.tsx` navega a `/recientes`, no a una Actividad
// interactiva). Este describe pasa a cubrir ESE contrato -- el fila-a-ficha ya no es alcanzable
// desde acá, ni debe serlo.
describe('AppShell — BL-D7: "Ver recientes" abre Recientes (registro), no la Actividad interactiva', () => {
  beforeEach(() => {
    mockMatchMedia();
    window.localStorage.clear();
    vi.clearAllMocks();
    mockListarActividad.mockResolvedValue({
      status: 'ok',
      items: [
        {
          id: 'cliente:42',
          tipo: 'cliente',
          fecha: '2026-08-10T12:00:00-03:00',
          titulo: 'Nuevo cliente',
          detalle: 'Panadería La Esquina',
          monto: null,
          signo: 'neutro',
        },
      ],
      cursor: null,
    });
  });

  it('Funciones -> "Actividad reciente" monta RecientesScreen (no ActividadScreen)', async () => {
    renderAppShell();

    fireEvent.click(screen.getByRole('button', { name: 'Funciones' }));
    fireEvent.click(await screen.findByTestId('escritorio-encabezado-recientes'));

    expect(await screen.findByTestId('pantalla-recientes')).toBeInTheDocument();
    expect(screen.queryByTestId('pantalla-actividad')).not.toBeInTheDocument();
  });

  it('control negativo de Decisión B: tocar la fila en Recientes NO navega a Clientes (registro, no acción)', async () => {
    renderAppShell();

    fireEvent.click(screen.getByRole('button', { name: 'Funciones' }));
    fireEvent.click(await screen.findByTestId('escritorio-encabezado-recientes'));
    const fila = await screen.findByTestId('actividad-cliente:42');
    fireEvent.click(fila);

    // Doy un margen breve: si `FilaActividad` navegara acá por error, ya se habría disparado.
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByTestId('pantalla-clientes')).not.toBeInTheDocument();
    expect(mockObtenerCliente).not.toHaveBeenCalled();
  });
});
