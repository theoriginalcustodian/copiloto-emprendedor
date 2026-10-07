import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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
import { api } from '../../lib/api';
import { setToken } from '../../auth/session';
import { SessionProvider } from '../../auth/SessionProvider';
import { ThemeProvider } from '../../design-system/ThemeProvider';
import { AccountScreen } from './AccountScreen';
import { LEGAL_VERSION } from '@copiloto/core';

/** Mismo criterio que `AccountScreen.test.tsx`: providers reales, sólo `lib/api` mockeado. */
function renderCuenta() {
  return render(
    <ThemeProvider>
      <SessionProvider>
        <AccountScreen />
      </SessionProvider>
    </ThemeProvider>,
  );
}

const BASE_ME = { cliente_id: 'cliente-123', mp_connected: false, composio_connected: [], es_admin: false };

describe('AccountScreen — versión legal aceptada (LEGALVERMICUENTA)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.mocked(api.me).mockReset();
    setToken('tok-valido');
  });

  it('antes de que llegue /me dice que está cargando, sin afirmar nada', () => {
    window.localStorage.clear();
    renderCuenta();
    expect(screen.getByTestId('account-legal-estado')).toHaveTextContent('Cargando tu versión aceptada…');
  });

  it('estado 1: aceptó la vigente → muestra su número', async () => {
    vi.mocked(api.me).mockResolvedValueOnce({
      ...BASE_ME,
      legal_aceptado: true,
      legal_version_aceptada: LEGAL_VERSION,
    });
    renderCuenta();
    await waitFor(() =>
      expect(screen.getByTestId('account-legal-estado')).toHaveTextContent(
        `Aceptaste la versión vigente (${LEGAL_VERSION}).`,
      ),
    );
  });

  it('estado 2: aceptó una versión VIEJA → muestra CUÁL y que ya no es la vigente', async () => {
    vi.mocked(api.me).mockResolvedValueOnce({
      ...BASE_ME,
      legal_aceptado: false,
      legal_version_aceptada: '2026-06-01',
    });
    renderCuenta();
    await waitFor(() =>
      expect(screen.getByTestId('account-legal-estado')).toHaveTextContent(
        'Aceptaste la versión 2026-06-01, que ya no es la vigente.',
      ),
    );
  });

  it('estado 3: nunca aceptó (null) → lo dice, y NO muestra una versión', async () => {
    vi.mocked(api.me).mockResolvedValueOnce({
      ...BASE_ME,
      legal_aceptado: false,
      legal_version_aceptada: null,
    });
    renderCuenta();
    await waitFor(() =>
      expect(screen.getByTestId('account-legal-estado')).toHaveTextContent(
        'Todavía no aceptaste ninguna versión.',
      ),
    );
    expect(screen.getByTestId('account-legal-estado')).not.toHaveTextContent('Aceptaste');
  });

  it('🐤 canario: campo AUSENTE (backend viejo) NO se confunde con «nunca aceptó»', async () => {
    // Sin `legal_version_aceptada` en la respuesta: el degradado prudente sería decir «nunca aceptó».
    vi.mocked(api.me).mockResolvedValueOnce({ ...BASE_ME, legal_aceptado: true } as never);
    renderCuenta();
    await waitFor(() =>
      expect(screen.getByTestId('account-legal-estado')).toHaveTextContent(
        'No pudimos verificar qué versión aceptaste.',
      ),
    );
    expect(screen.getByTestId('account-legal-estado')).not.toHaveTextContent('Todavía no aceptaste');
  });

  it('los textos legales se abren desde la fila y «Volver» regresa a Mi cuenta', async () => {
    vi.mocked(api.me).mockResolvedValueOnce({
      ...BASE_ME,
      legal_aceptado: true,
      legal_version_aceptada: LEGAL_VERSION,
    });
    renderCuenta();
    fireEvent.click(screen.getByTestId('account-legal-tos'));
    const legal = await screen.findByTestId('legal-screen-tos');
    expect(screen.queryByTestId('account-screen')).toBeNull();

    fireEvent.click(within(legal).getByRole('button'));
    expect(await screen.findByTestId('account-screen')).toBeInTheDocument();
  });

  it('la política de privacidad abre su propio texto, no el de términos', async () => {
    vi.mocked(api.me).mockResolvedValueOnce({
      ...BASE_ME,
      legal_aceptado: true,
      legal_version_aceptada: LEGAL_VERSION,
    });
    renderCuenta();
    fireEvent.click(screen.getByTestId('account-legal-privacidad'));
    expect(await screen.findByTestId('legal-screen-privacidad')).toBeInTheDocument();
    expect(screen.queryByTestId('legal-screen-tos')).toBeNull();
  });
});
