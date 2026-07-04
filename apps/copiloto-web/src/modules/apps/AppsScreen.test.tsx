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
import type { CatalogService } from '../../lib/api';
import { api } from '../../lib/api';
import { ModeProvider, useMode } from '../../shell/modeStore';
import { AppsScreen } from './AppsScreen';

function makeService(overrides: Partial<CatalogService>): CatalogService {
  return {
    key: 'svc',
    display_name: 'Servicio',
    work_label: 'Trabajo',
    category: 'comunicacion',
    kind: 'composio',
    description: 'Descripción.',
    capabilities: [],
    connected: false,
    connect_path: '/composio/connect?service=svc',
    ...overrides,
  };
}

const GMAIL = makeService({
  key: 'gmail',
  display_name: 'Gmail',
  work_label: 'Mail',
  category: 'comunicacion',
  connected: true,
});
const CALENDAR = makeService({
  key: 'google-calendar',
  display_name: 'Google Calendar',
  work_label: 'Agenda',
  category: 'agenda',
  connected: true,
});
const DRIVE_DISCONNECTED = makeService({
  key: 'drive',
  display_name: 'Google Drive',
  work_label: 'Archivos',
  category: 'archivos',
  connected: false,
});

/** Lee el `mode` compartido desde afuera del árbol de `AppsScreen` (mismo criterio que probar un
 * Context: un consumidor hermano expone el valor actual para la aserción). */
function ModeProbe() {
  const { mode } = useMode();
  return <p data-testid="mode-probe">{mode ? `${mode.key}:${mode.label}:${mode.category}` : 'none'}</p>;
}

function renderAppsScreen(onGoToConnections?: () => void) {
  return render(
    <ModeProvider>
      <AppsScreen onGoToConnections={onGoToConnections} />
      <ModeProbe />
    </ModeProvider>,
  );
}

describe('AppsScreen', () => {
  beforeEach(() => {
    vi.mocked(api.catalog).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('título y subtítulo son fieles al diseño ("Tus apps")', async () => {
    vi.mocked(api.catalog).mockResolvedValueOnce({ services: [GMAIL] });

    renderAppsScreen();
    await waitFor(() => expect(screen.getByTestId('mode-bar')).toBeInTheDocument());

    expect(screen.getByRole('heading', { name: 'Tus apps' })).toBeInTheDocument();
    expect(screen.getByText('Elegí un modo para enfocar al copiloto')).toBeInTheDocument();
  });

  it('sin modo activo NO muestra la píldora "Salir del modo"', async () => {
    vi.mocked(api.catalog).mockResolvedValueOnce({ services: [GMAIL] });

    renderAppsScreen();
    await waitFor(() => expect(screen.getByTestId('mode-bar')).toBeInTheDocument());

    expect(screen.queryByTestId('apps-exit-mode')).not.toBeInTheDocument();
  });

  it('con modo activo, "Salir del modo" vuelve a modo general (spec §3.3)', async () => {
    vi.mocked(api.catalog).mockResolvedValueOnce({ services: [GMAIL] });

    renderAppsScreen();
    await waitFor(() => expect(screen.getByTestId('mode-button-gmail')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('mode-button-gmail'));
    expect(screen.getByTestId('mode-probe')).toHaveTextContent('gmail:Mail:comunicacion');

    const exitButton = screen.getByTestId('apps-exit-mode');
    expect(exitButton).toHaveTextContent('Salir del modo');

    fireEvent.click(exitButton);
    expect(screen.getByTestId('mode-probe')).toHaveTextContent('none');
    expect(screen.queryByTestId('apps-exit-mode')).not.toBeInTheDocument();
  });

  it('lista SOLO los servicios conectados (data-driven de /catalog)', async () => {
    vi.mocked(api.catalog).mockResolvedValueOnce({
      services: [GMAIL, CALENDAR, DRIVE_DISCONNECTED],
    });

    renderAppsScreen();

    await waitFor(() => expect(screen.getByTestId('mode-bar')).toBeInTheDocument());

    expect(screen.getByTestId('mode-button-gmail')).toBeInTheDocument();
    expect(screen.getByTestId('mode-button-google-calendar')).toBeInTheDocument();
    expect(screen.queryByTestId('mode-button-drive')).not.toBeInTheDocument();
  });

  it('tocar un botón de modo setea `mode` (key/label/category del servicio)', async () => {
    vi.mocked(api.catalog).mockResolvedValueOnce({ services: [GMAIL, CALENDAR] });

    renderAppsScreen();
    await waitFor(() => expect(screen.getByTestId('mode-button-gmail')).toBeInTheDocument());

    expect(screen.getByTestId('mode-probe')).toHaveTextContent('none');

    fireEvent.click(screen.getByTestId('mode-button-gmail'));

    expect(screen.getByTestId('mode-probe')).toHaveTextContent('gmail:Mail:comunicacion');
    expect(screen.getByTestId('mode-button-gmail')).toHaveAttribute('aria-pressed', 'true');
  });

  it('tocar el modo YA activo vuelve a modo general (toggle, spec §3.3)', async () => {
    vi.mocked(api.catalog).mockResolvedValueOnce({ services: [GMAIL] });

    renderAppsScreen();
    await waitFor(() => expect(screen.getByTestId('mode-button-gmail')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('mode-button-gmail'));
    expect(screen.getByTestId('mode-probe')).toHaveTextContent('gmail:Mail:comunicacion');

    fireEvent.click(screen.getByTestId('mode-button-gmail'));
    expect(screen.getByTestId('mode-probe')).toHaveTextContent('none');
  });

  it('tocar otro botón reemplaza el modo activo (uno solo a la vez, spec §3.2)', async () => {
    vi.mocked(api.catalog).mockResolvedValueOnce({ services: [GMAIL, CALENDAR] });

    renderAppsScreen();
    await waitFor(() => expect(screen.getByTestId('mode-button-gmail')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('mode-button-gmail'));
    expect(screen.getByTestId('mode-probe')).toHaveTextContent('gmail:Mail:comunicacion');

    fireEvent.click(screen.getByTestId('mode-button-google-calendar'));
    expect(screen.getByTestId('mode-probe')).toHaveTextContent('google-calendar:Agenda:agenda');
  });

  it('sin servicios conectados: la barra muestra SOLO el "+" con el copy de vacío', async () => {
    vi.mocked(api.catalog).mockResolvedValueOnce({ services: [DRIVE_DISCONNECTED] });

    renderAppsScreen();
    await waitFor(() => expect(screen.getByTestId('mode-bar')).toBeInTheDocument());

    expect(screen.queryByTestId('mode-button-drive')).not.toBeInTheDocument();
    expect(screen.getByTestId('apps-add-button')).toHaveTextContent('Conectá una app para empezar');
  });

  it('con servicios conectados el "+" ofrece "Conectar más" y navega a Conexiones', async () => {
    vi.mocked(api.catalog).mockResolvedValueOnce({ services: [GMAIL] });
    const onGoToConnections = vi.fn();

    renderAppsScreen(onGoToConnections);
    await waitFor(() => expect(screen.getByTestId('apps-add-button')).toBeInTheDocument());

    expect(screen.getByTestId('apps-add-button')).toHaveTextContent('Conectar más');
    fireEvent.click(screen.getByTestId('apps-add-button'));
    expect(onGoToConnections).toHaveBeenCalledTimes(1);
  });

  it('catalog que falla muestra error con botón Reintentar', async () => {
    vi.mocked(api.catalog).mockRejectedValueOnce(new Error('down'));

    renderAppsScreen();
    await waitFor(() => expect(screen.getByTestId('apps-error')).toBeInTheDocument());

    vi.mocked(api.catalog).mockResolvedValueOnce({ services: [GMAIL] });
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

    await waitFor(() => expect(screen.getByTestId('mode-button-gmail')).toBeInTheDocument());
  });
});
