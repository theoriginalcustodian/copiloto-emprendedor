import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/** Partial mock: sólo la red de Actividad/Clientes — ver el mismo arnés en `AppShell.test.tsx`. */
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
import { DesktopShell } from './DesktopShell';
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

describe('DesktopShell — D14 (fila de Actividad "cliente" abre la ficha por id)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
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
    renderDesktopShell();

    fireEvent.click(screen.getByRole('button', { name: 'Actividad' }));
    const fila = await screen.findByTestId('actividad-cliente:42');
    fireEvent.click(fila);

    expect(await screen.findByTestId('pantalla-clientes')).toBeInTheDocument();
    // `FichaCliente` repite su propio `obtenerCliente` al montar -- ver el mismo comentario en
    // `ClientesScreen.test.tsx`. Lo que importa es que TODAS las llamadas sean con 42.
    await waitFor(() => expect(mockObtenerCliente).toHaveBeenCalledWith(42));
    expect(mockObtenerCliente.mock.calls.every(([id]) => id === 42)).toBe(true);
    expect(await screen.findByTestId('ficha-cliente-nombre')).toHaveTextContent('Panadería La Esquina');
  });

  it('control negativo del reset: volver a Clientes por el RAIL (no por la fila) no reabre la última ficha', async () => {
    mockObtenerCliente.mockResolvedValue({
      status: 'ok',
      ficha: { cliente: clienteFixture(42, 'Panadería La Esquina'), presupuestos: [], facturas: [] },
    });
    renderDesktopShell();

    fireEvent.click(screen.getByRole('button', { name: 'Actividad' }));
    fireEvent.click(await screen.findByTestId('actividad-cliente:42'));
    await waitFor(() => expect(screen.getByTestId('ficha-cliente-nombre')).toHaveTextContent('Panadería La Esquina'));
    const llamadasPrevias = mockObtenerCliente.mock.calls.length;

    fireEvent.click(screen.getByRole('button', { name: 'Chat' }));
    fireEvent.click(screen.getByRole('button', { name: 'Clientes' }));

    expect(await screen.findByTestId('pantalla-clientes')).toBeInTheDocument();
    expect(screen.queryByTestId('ficha-cliente')).not.toBeInTheDocument();
    await new Promise((r) => setTimeout(r, 50));
    expect(mockObtenerCliente.mock.calls.length).toBe(llamadasPrevias);
  });
});
