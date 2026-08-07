import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// `lib/api` mockeado para poder devolver un `/me` CON y SIN el claim; el resto (SessionProvider,
// ThemeProvider, ModeProvider, Rail, TabBar) es real a propósito — lo que se prueba acá es
// justamente el CABLEADO entre esas piezas, y mockear los shells lo daría por supuesto.
vi.mock('../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/api')>();
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

// La Consola pega a `/admin/*` en cuanto monta. Acá no interesa qué muestra (eso es
// AdminScreen.test.tsx): interesa SI monta. Se corta el transporte para no dejar fetch colgando.
vi.mock('../lib/api/admin', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/api/admin')>();
  return { ...actual, adminSalud: vi.fn(), adminUso: vi.fn() };
});

import '../design-system/themes.css';
import { SessionProvider } from '../auth/SessionProvider';
import { setToken } from '../auth/session';
import { ThemeProvider } from '../design-system/ThemeProvider';
import { api } from '../lib/api';
import { adminSalud, adminUso } from '../lib/api/admin';
import { AppShell } from './AppShell';
import { DesktopShell } from './DesktopShell';
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

const ME_BASE = { cliente_id: 'cliente-123', mp_connected: false, composio_connected: [] };

function darSesion(esAdmin: boolean) {
  setToken('tok-valido');
  vi.mocked(api.me).mockResolvedValue({ ...ME_BASE, es_admin: esAdmin });
}

function renderShell(cual: 'mobile' | 'desktop') {
  const Shell = cual === 'mobile' ? AppShell : DesktopShell;
  return render(
    <ThemeProvider>
      <SessionProvider>
        <ModeProvider>
          <Shell />
        </ModeProvider>
      </SessionProvider>
    </ThemeProvider>,
  );
}

/**
 * Contrato `es_admin en /me` (2026-08-07) — el enganche de la Consola al shell.
 *
 * Los dos sentidos y los dos shells, cuatro casos, a propósito. Un cableado que mostrara la entrada
 * SIEMPRE pasa el caso admin; uno que no la mostrara NUNCA pasa el caso no-admin; y un shell puede
 * estar bien cableado mientras el otro se olvidó de pasar el prop. Sólo la matriz completa distingue
 * "discrimina de verdad" de "acertó por casualidad".
 *
 * ⚠️ Nada de esto es control de acceso: el guard real es `require_admin` en el backend, con su
 * propio test adversarial (CONS8). Acá se prueba ergonomía — que no se le ofrezca a un emprendedor
 * una puerta que el backend le va a cerrar con 403.
 */
describe('Enganche de la Consola al shell (es_admin)', () => {
  beforeEach(() => {
    mockMatchMedia();
    window.localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    vi.mocked(api.me).mockReset();
    vi.mocked(adminSalud).mockReset().mockResolvedValue({
      ok: true,
      workers: { task_queue: 'agent-emprendedor', pollers: 1, ok: true },
      schedules: { total: 0, pausados: 0, sin_proxima_corrida: 0, ok: true },
    });
    vi.mocked(adminUso).mockReset().mockResolvedValue({
      horas: 24,
      gasto_llm: [],
      uso_tools: [],
      error_rate_tools: [],
    });
  });

  describe.each(['mobile', 'desktop'] as const)('shell %s', (cual) => {
    it('con es_admin=false la entrada NO está en el DOM (no es un display:none)', async () => {
      darSesion(false);
      const { container } = renderShell(cual);
      await waitFor(() => expect(vi.mocked(api.me)).toHaveBeenCalled());
      expect(screen.queryByRole('button', { name: 'Consola' })).not.toBeInTheDocument();
      expect(container.textContent).not.toContain('Consola');
    });

    it('con es_admin=true la entrada aparece y abre la Consola', async () => {
      darSesion(true);
      renderShell(cual);
      const entrada = await screen.findByRole('button', { name: 'Consola' });
      entrada.click();
      await waitFor(() => expect(screen.getByTestId('admin-screen')).toBeInTheDocument());
    });
  });

  it('sin sesión (anónimo, `me` undefined) tampoco se ofrece la Consola', async () => {
    // El caso que un `me!.es_admin` haría explotar y un truthy dejaría pasar: el fail-closed tiene
    // que valer también cuando NO hay respuesta de `/me`, no sólo cuando la respuesta dice `false`.
    vi.mocked(api.me).mockRejectedValue(new Error('sin token'));
    renderShell('desktop');
    await waitFor(() => expect(screen.getByTestId('rail')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Consola' })).not.toBeInTheDocument();
  });
});
