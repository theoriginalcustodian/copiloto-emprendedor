import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/api')>();
  return {
    ...actual,
    api: {
      login: vi.fn(),
      me: vi.fn(),
      catalog: vi.fn(),
      connect: vi.fn(),
      disconnect: vi.fn(),
      sendChat: vi.fn(),
      getReply: vi.fn(),
    },
  };
});

import '../../design-system/themes.css';
import { SessionProvider } from '../../auth/SessionProvider';
import { THEMES } from '../../design-system/ThemeProvider';
import type { CatalogService } from '../../lib/api';
import { api } from '../../lib/api';
import { ConnectionsScreen } from './ConnectionsScreen';

/**
 * `ConnectionsScreen` consume `useSession()` (avatar del header, fiel al diseño) — necesita el
 * `<SessionProvider>` real (mismo criterio que `AccountScreen.test.tsx`: providers reales, solo
 * `lib/api` mockeado). Sin token persistido, la sesión resuelve a "anon" sin llamar `api.me()`.
 */
function renderConnectionsScreen() {
  return render(
    <SessionProvider>
      <ConnectionsScreen />
    </SessionProvider>,
  );
}

function makeService(overrides: Partial<CatalogService>): CatalogService {
  return {
    key: 'svc',
    display_name: 'Servicio',
    work_label: 'Hacer algo',
    category: 'comunicacion',
    kind: 'composio',
    description: 'Descripción del servicio.',
    capabilities: [],
    connected: false,
    connect_path: '/composio/connect?service=svc',
    ...overrides,
  };
}

const TWO_SERVICES: CatalogService[] = [
  makeService({ key: 'gmail', display_name: 'Gmail', category: 'comunicacion', connected: true }),
  makeService({ key: 'mercadopago', display_name: 'Mercado Pago', category: 'pagos', connect_path: '/mp/connect' }),
];

// 9 servicios (> SEARCH_THRESHOLD=8) para el caso "≥8 servicios se ven" + aparece el buscador.
const NINE_SERVICES: CatalogService[] = Array.from({ length: 9 }, (_, i) =>
  makeService({
    key: `svc-${i}`,
    display_name: `Servicio ${i}`,
    work_label: `Trabajo ${i}`,
    category: i % 2 === 0 ? 'comunicacion' : 'pagos',
    connected: i % 3 === 0,
  }),
);

function mockLocationAssign() {
  const assign = vi.fn();
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...window.location, assign },
  });
  return assign;
}

describe('ConnectionsScreen', () => {
  beforeEach(() => {
    vi.mocked(api.catalog).mockReset();
    vi.mocked(api.connect).mockReset();
    vi.mocked(api.disconnect).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('BL-D8: el título es "Apps" (alineado con mobile, no "Conexiones")', async () => {
    vi.mocked(api.catalog).mockResolvedValueOnce({ services: TWO_SERVICES });
    renderConnectionsScreen();

    expect(await screen.findByRole('heading', { name: 'Apps' })).toBeInTheDocument();
    expect(screen.queryByText('Conexiones')).not.toBeInTheDocument();
  });

  it('loading -> ready: muestra skeleton y después la grilla con los servicios', async () => {
    vi.mocked(api.catalog).mockResolvedValueOnce({ services: TWO_SERVICES });

    renderConnectionsScreen();

    expect(screen.getByTestId('connections-loading')).toBeInTheDocument();

    await waitFor(() => expect(screen.queryByTestId('connections-loading')).not.toBeInTheDocument());

    expect(screen.getByTestId('service-card-gmail')).toBeInTheDocument();
    expect(screen.getByTestId('service-card-mercadopago')).toBeInTheDocument();
    // gmail=connected, mercadopago=disconnected -> "1 activas · 1 disponibles" (contador derivado
    // de los datos reales, ver diseño §3.3: "N activas · M disponibles").
    expect(screen.getByText('1 activas · 1 disponibles')).toBeInTheDocument();
  });

  it('grid PLANO: NO agrupa por category (sin headers) y respeta el orden del catálogo', async () => {
    vi.mocked(api.catalog).mockResolvedValueOnce({ services: TWO_SERVICES });
    renderConnectionsScreen();

    await waitFor(() => expect(screen.getByTestId('service-card-gmail')).toBeInTheDocument());

    // El diseño (líneas 312-370) es un grid 2 columnas SIN agrupar por categoría — no hay más
    // headers de sección tipo "Comunicación"/"Pagos".
    expect(screen.queryByText('Comunicación')).not.toBeInTheDocument();
    expect(screen.queryByText('Pagos')).not.toBeInTheDocument();

    // Las 2 cards viven en el MISMO contenedor grid, en el orden que entrega el catálogo.
    const grid = screen.getByTestId('service-card-gmail').parentElement;
    expect(grid).toBe(screen.getByTestId('service-card-mercadopago').parentElement);
    const cardKeys = Array.from(grid?.children ?? []).map((el) => el.getAttribute('data-testid'));
    expect(cardKeys).toEqual(['service-card-gmail', 'service-card-mercadopago']);
  });

  it('con >8 servicios aparece el buscador y se ven todos', async () => {
    vi.mocked(api.catalog).mockResolvedValueOnce({ services: NINE_SERVICES });
    renderConnectionsScreen();

    await waitFor(() => expect(screen.getByLabelText('Buscar servicio')).toBeInTheDocument());
    for (const service of NINE_SERVICES) {
      expect(screen.getByTestId(`service-card-${service.key}`)).toBeInTheDocument();
    }
  });

  it('conectar un servicio pide la url y navega ahí (redirect full-page)', async () => {
    const assign = mockLocationAssign();
    vi.mocked(api.catalog).mockResolvedValueOnce({ services: TWO_SERVICES });
    vi.mocked(api.connect).mockResolvedValueOnce({ url: 'https://mp.example/oauth/abc' });

    renderConnectionsScreen();
    await waitFor(() => expect(screen.getByTestId('service-card-mercadopago')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Conectar' }));

    await waitFor(() => expect(assign).toHaveBeenCalledWith('https://mp.example/oauth/abc'));
    expect(api.connect).toHaveBeenCalledWith('/mp/connect');
  });

  it('BL-C1: desconectar llama al disconnect_path del catálogo y la tarjeta vuelve a «Conectar» sin recargar', async () => {
    const conectado = makeService({
      key: 'mercadopago',
      display_name: 'Mercado Pago',
      category: 'pagos',
      kind: 'payments',
      connected: true,
      connect_path: '/mp/connect',
      disconnect_path: '/mp/connection',
    });
    vi.mocked(api.catalog)
      .mockResolvedValueOnce({ services: [conectado] })
      .mockResolvedValueOnce({ services: [{ ...conectado, connected: false }] });
    vi.mocked(api.disconnect).mockResolvedValueOnce(undefined);

    renderConnectionsScreen();
    await waitFor(() => expect(screen.getByTestId('service-card-mercadopago')).toHaveAttribute('data-state', 'connected'));

    fireEvent.click(screen.getByRole('button', { name: 'Desconectar Mercado Pago' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sí, desconectar' }));

    await waitFor(() => expect(screen.getByTestId('service-card-mercadopago')).toHaveAttribute('data-state', 'disconnected'));
    expect(api.disconnect).toHaveBeenCalledWith('/mp/connection'); // el path lo decide el backend, no el cliente
    expect(screen.getByRole('button', { name: 'Conectar' })).toBeInTheDocument();
  });

  it('BL-C1: si el DELETE falla la tarjeta sigue conectada (no hay flip optimista)', async () => {
    const conectado = makeService({ key: 'gmail', display_name: 'Gmail', connected: true, disconnect_path: '/composio/connection?service=gmail' });
    vi.mocked(api.catalog).mockResolvedValueOnce({ services: [conectado] });
    vi.mocked(api.disconnect).mockRejectedValueOnce(new Error('404'));

    renderConnectionsScreen();
    await waitFor(() => expect(screen.getByTestId('service-card-gmail')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Desconectar Gmail' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sí, desconectar' }));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByTestId('service-card-gmail')).toHaveAttribute('data-state', 'connected');
    expect(api.catalog).toHaveBeenCalledTimes(1); // no relee ni cambia estado tras un fallo
  });

  it('catalog que falla muestra error con botón Reintentar', async () => {
    vi.mocked(api.catalog).mockRejectedValueOnce(new Error('down'));
    renderConnectionsScreen();

    await waitFor(() => expect(screen.getByTestId('connections-error')).toBeInTheDocument());

    vi.mocked(api.catalog).mockResolvedValueOnce({ services: TWO_SERVICES });
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

    await waitFor(() => expect(screen.getByTestId('service-card-gmail')).toBeInTheDocument());
  });

  it.each(THEMES)('renderiza bajo el tema "%s" sin romper', async (theme) => {
    vi.mocked(api.catalog).mockResolvedValueOnce({ services: TWO_SERVICES });
    document.documentElement.setAttribute('data-theme', theme);
    renderConnectionsScreen();
    await waitFor(() => expect(screen.getByTestId('connections-screen')).toBeInTheDocument());
  });
});
