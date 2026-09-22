import { render, screen, waitFor, act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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

import { api } from '../lib/api';
import { setToken } from './session';
import { SessionProvider } from './SessionProvider';
import { useSession } from './useSession';

/**
 * BL-X12w — `cierreVoluntario`, gemelo del de mobile (`modules/auth/SessionProvider.tsx`).
 * Integración real (`SessionProvider` real, sólo `lib/api` mockeado), mismo criterio que
 * `AccountScreen.test.tsx`/`useSession.test.ts`.
 */
function Sonda() {
  const { status, cierreVoluntario, logout } = useSession();
  return (
    <div>
      <span data-testid="sonda-status">{status}</span>
      <span data-testid="sonda-cierre">{cierreVoluntario ? cierreVoluntario.email : 'null'}</span>
      <button type="button" data-testid="sonda-logout" onClick={logout}>
        salir
      </button>
    </div>
  );
}

describe('SessionProvider — cierreVoluntario (BL-X12w)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.mocked(api.me).mockReset();
  });

  it('logout con sesión válida deja cierreVoluntario con el mail de la cuenta que salió', async () => {
    setToken('tok-valido');
    vi.mocked(api.me).mockResolvedValueOnce({
      cliente_id: 'c1',
      email: 'ana@x.com',
      mp_connected: false,
      composio_connected: [],
      es_admin: false,
    });
    render(
      <SessionProvider>
        <Sonda />
      </SessionProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('sonda-status')).toHaveTextContent('authed'));

    act(() => screen.getByTestId('sonda-logout').click());

    expect(screen.getByTestId('sonda-status')).toHaveTextContent('anon');
    expect(screen.getByTestId('sonda-cierre')).toHaveTextContent('ana@x.com');
  });

  it('control negativo: arranque limpio (sin token) nunca tiene cierreVoluntario', async () => {
    render(
      <SessionProvider>
        <Sonda />
      </SessionProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('sonda-status')).toHaveTextContent('anon'));
    expect(screen.getByTestId('sonda-cierre')).toHaveTextContent('null');
  });
});
