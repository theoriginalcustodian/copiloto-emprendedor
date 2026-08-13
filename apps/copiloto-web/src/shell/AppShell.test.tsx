import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
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

import { listarActividad, obtenerCliente, type Cliente } from '@copiloto/core';

import { SessionProvider } from '../auth/SessionProvider';
import '../design-system/themes.css';
import { THEMES, ThemeProvider } from '../design-system/ThemeProvider';
import { AppShell } from './AppShell';
import { ModeProvider } from './modeStore';

const mockListarActividad = vi.mocked(listarActividad);
const mockObtenerCliente = vi.mocked(obtenerCliente);

function clienteFixture(id: number, nombre: string): Cliente {
  return {
    id,
    nombre,
    docTipo: null,
    docNro: null,
    condicionIva: null,
    domicilio: null,
    email: null,
    telefono: null,
    notas: null,
    origen: 'derivado',
    creadoEn: '2026-08-01T00:00:00Z',
  };
}

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

  // Reemplaza al "MOBILE GATE" que exigía `ajustes` en la barra (contrato depuración-barra
  // 2026-08-06). Aquel gate pedía un reemplazo y sólo contemplaba uno: montar `ChatHeader`. El
  // camino que SÍ existe es otro -- Funciones (que sigue en la barra) → tile Ajustes -- y este test
  // lo EJERCITA en vez de afirmarlo. Mientras pase, `ajustes` puede estar fuera de `TABS` sin dejar
  // la pantalla inalcanzable en el teléfono; si alguien rompe el wireo (`FUNCION_A_TAB.ajustes`) o
  // saca el tile, esto se pone rojo y la decisión se revisa.
  it('MOBILE: Ajustes es alcanzable sin tab propio -- Funciones > tile Ajustes abre la pantalla', () => {
    renderAppShell();
    expect(screen.queryByRole('button', { name: 'Ajustes' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Funciones' }));
    fireEvent.click(screen.getByTestId('tile-ajustes'));
    expect(screen.getByTestId('pantalla-ajustes')).toBeInTheDocument();
  });

  it('navegar a Ajustes > Apps conectadas muestra ConnectionsScreen (camino real post-depuración)', () => {
    renderAppShell();
    fireEvent.click(screen.getByRole('button', { name: 'Funciones' }));
    fireEvent.click(screen.getByTestId('tile-ajustes'));
    fireEvent.click(screen.getByTestId('ajuste-tile-apps'));
    expect(screen.getByTestId('connections-screen')).toBeInTheDocument();
  });

  it('navegar a Ajustes > Mi cuenta muestra AccountScreen (camino real post-depuración)', () => {
    renderAppShell();
    fireEvent.click(screen.getByRole('button', { name: 'Funciones' }));
    fireEvent.click(screen.getByTestId('tile-ajustes'));
    fireEvent.click(screen.getByTestId('ajuste-tile-cuenta'));
    expect(screen.getByTestId('account-screen')).toBeInTheDocument();
  });

  it('volver a Chat desde otro tab remonta ChatScreen', () => {
    renderAppShell();
    fireEvent.click(screen.getByRole('button', { name: 'Funciones' }));
    fireEvent.click(screen.getByRole('button', { name: 'Chat' }));
    expect(screen.getByTestId('chat-screen')).toBeInTheDocument();
  });

  it('el botón atrás desde otro tab vuelve a Chat en vez de salir', () => {
    renderAppShell();
    fireEvent.click(screen.getByRole('button', { name: 'Funciones' }));
    fireEvent.click(screen.getByTestId('tile-ajustes'));
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

describe('AppShell — D14 (fila de Actividad "cliente" abre la ficha por id)', () => {
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

  it('tocar la fila navega a Clientes y el id llega a la capa de datos (obtenerCliente) -- abre ESA ficha', async () => {
    mockObtenerCliente.mockResolvedValue({
      status: 'ok',
      ficha: { cliente: clienteFixture(42, 'Panadería La Esquina'), presupuestos: [], facturas: [] },
    });
    renderAppShell();

    fireEvent.click(screen.getByRole('button', { name: 'Actividad' }));
    const fila = await screen.findByTestId('actividad-cliente:42');
    fireEvent.click(fila);

    // El tab cambia solo (no hace falta tocar la barra): `abrirCliente` hace `changeTab` + setea el id.
    expect(await screen.findByTestId('pantalla-clientes')).toBeInTheDocument();
    // `FichaCliente` repite su propio `obtenerCliente` al montar (presupuestos/facturas) -- ver el
    // mismo comentario en `ClientesScreen.test.tsx`. Lo que importa acá es que TODAS las llamadas
    // sean con el id de ESTA fila (42), no con uno viejo o pegado.
    await waitFor(() => expect(mockObtenerCliente).toHaveBeenCalledWith(42));
    expect(mockObtenerCliente.mock.calls.every(([id]) => id === 42)).toBe(true);
    expect(await screen.findByTestId('ficha-cliente-nombre')).toHaveTextContent('Panadería La Esquina');
  });

  it('control negativo del reset: volver a Clientes por la BARRA (no por la fila) no reabre la última ficha', async () => {
    mockObtenerCliente.mockResolvedValue({
      status: 'ok',
      ficha: { cliente: clienteFixture(42, 'Panadería La Esquina'), presupuestos: [], facturas: [] },
    });
    renderAppShell();

    fireEvent.click(screen.getByRole('button', { name: 'Actividad' }));
    fireEvent.click(await screen.findByTestId('actividad-cliente:42'));
    await waitFor(() => expect(screen.getByTestId('ficha-cliente-nombre')).toHaveTextContent('Panadería La Esquina'));
    const llamadasPrevias = mockObtenerCliente.mock.calls.length;

    // Salgo por la barra (Chat) y vuelvo a Clientes por la barra -- NO por `abrirCliente`.
    fireEvent.click(screen.getByRole('button', { name: 'Chat' }));
    fireEvent.click(screen.getByRole('button', { name: 'Clientes' }));

    expect(await screen.findByTestId('pantalla-clientes')).toBeInTheDocument();
    expect(screen.queryByTestId('ficha-cliente')).not.toBeInTheDocument();
    // `changeTab` limpió `clienteIdAbierto` -- sin el reset, este remount volvería a pedir el 42 de
    // nuevo (más llamadas que las de la apertura original). Doy un margen breve para que, si el
    // reset fallara, el pedido espurio ya se haya disparado antes de leer el conteo.
    await new Promise((r) => setTimeout(r, 50));
    expect(mockObtenerCliente.mock.calls.length).toBe(llamadasPrevias);
  });
});
