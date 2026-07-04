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
      sendChat: vi.fn(),
      getReply: vi.fn(),
    },
  };
});

import '../../design-system/themes.css';
import { THEMES } from '../../design-system/ThemeProvider';
import type { CatalogService } from '../../lib/api';
import { api } from '../../lib/api';
import { ConnectionsScreen } from './ConnectionsScreen';

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
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loading -> ready: muestra skeleton y después la grilla con los servicios', async () => {
    vi.mocked(api.catalog).mockResolvedValueOnce({ services: TWO_SERVICES });

    render(<ConnectionsScreen />);

    expect(screen.getByTestId('connections-loading')).toBeInTheDocument();

    await waitFor(() => expect(screen.queryByTestId('connections-loading')).not.toBeInTheDocument());

    expect(screen.getByTestId('service-card-gmail')).toBeInTheDocument();
    expect(screen.getByTestId('service-card-mercadopago')).toBeInTheDocument();
    expect(screen.getByText('1 conectados · 2 disponibles')).toBeInTheDocument();
  });

  it('agrupa los servicios por category con su label es-AR', async () => {
    vi.mocked(api.catalog).mockResolvedValueOnce({ services: TWO_SERVICES });
    render(<ConnectionsScreen />);

    await waitFor(() => expect(screen.getByText('Comunicación')).toBeInTheDocument());
    expect(screen.getByText('Pagos')).toBeInTheDocument();
  });

  it('con >8 servicios aparece el buscador y se ven todos', async () => {
    vi.mocked(api.catalog).mockResolvedValueOnce({ services: NINE_SERVICES });
    render(<ConnectionsScreen />);

    await waitFor(() => expect(screen.getByLabelText('Buscar servicio')).toBeInTheDocument());
    for (const service of NINE_SERVICES) {
      expect(screen.getByTestId(`service-card-${service.key}`)).toBeInTheDocument();
    }
  });

  it('conectar un servicio pide la url y navega ahí (redirect full-page)', async () => {
    const assign = mockLocationAssign();
    vi.mocked(api.catalog).mockResolvedValueOnce({ services: TWO_SERVICES });
    vi.mocked(api.connect).mockResolvedValueOnce({ url: 'https://mp.example/oauth/abc' });

    render(<ConnectionsScreen />);
    await waitFor(() => expect(screen.getByTestId('service-card-mercadopago')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Conectar' }));

    await waitFor(() => expect(assign).toHaveBeenCalledWith('https://mp.example/oauth/abc'));
    expect(api.connect).toHaveBeenCalledWith('/mp/connect');
  });

  it('catalog que falla muestra error con botón Reintentar', async () => {
    vi.mocked(api.catalog).mockRejectedValueOnce(new Error('down'));
    render(<ConnectionsScreen />);

    await waitFor(() => expect(screen.getByTestId('connections-error')).toBeInTheDocument());

    vi.mocked(api.catalog).mockResolvedValueOnce({ services: TWO_SERVICES });
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

    await waitFor(() => expect(screen.getByTestId('service-card-gmail')).toBeInTheDocument());
  });

  it.each(THEMES)('renderiza bajo el tema "%s" sin romper', async (theme) => {
    vi.mocked(api.catalog).mockResolvedValueOnce({ services: TWO_SERVICES });
    document.documentElement.setAttribute('data-theme', theme);
    render(<ConnectionsScreen />);
    await waitFor(() => expect(screen.getByTestId('connections-screen')).toBeInTheDocument());
  });
});
