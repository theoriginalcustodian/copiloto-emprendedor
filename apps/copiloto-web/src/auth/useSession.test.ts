import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Partial mock: reusa las clases de error reales (UnauthorizedError/ForbiddenError) — así el
// `instanceof` que hace useSession.ts contra el MISMO módulo mockeado sigue funcionando, solo se
// reemplaza `api` por fns espiables.
vi.mock('../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/api')>();
  return {
    ...actual,
    api: {
      login: vi.fn(),
      me: vi.fn(),
      catalog: vi.fn(),
      sendChat: vi.fn(),
      getReply: vi.fn(),
    },
  };
});

import { api, ForbiddenError, UnauthorizedError } from '../lib/api';
import { setToken } from './session';
import { useSession } from './useSession';

describe('useSession', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.mocked(api.login).mockReset();
    vi.mocked(api.me).mockReset();
  });

  it('sin token persistido -> anon', async () => {
    const { result } = renderHook(() => useSession());
    await waitFor(() => expect(result.current.status).toBe('anon'));
  });

  it('con token persistido válido -> authed + me (chequeo de montaje)', async () => {
    setToken('tok-valido');
    vi.mocked(api.me).mockResolvedValueOnce({ cliente_id: 'c1', mp_connected: false, composio_connected: [] });

    const { result } = renderHook(() => useSession());

    await waitFor(() => expect(result.current.status).toBe('authed'));
    expect(result.current.me?.cliente_id).toBe('c1');
  });

  it('login exitoso -> authed + me', async () => {
    vi.mocked(api.login).mockResolvedValueOnce({
      access_token: 'nuevo-token',
      token_type: 'bearer',
      expires_in: 3600,
      refresh_token: 'r',
      user: {},
    });
    vi.mocked(api.me).mockResolvedValueOnce({ cliente_id: 'c1', mp_connected: false, composio_connected: [] });

    const { result } = renderHook(() => useSession());
    await waitFor(() => expect(result.current.status).toBe('anon'));

    let loginResult: Awaited<ReturnType<typeof result.current.login>> | undefined;
    await act(async () => {
      loginResult = await result.current.login('a@a.com', 'secreta');
    });

    expect(loginResult).toEqual({ ok: true });
    expect(result.current.status).toBe('authed');
  });

  it('login con 401 -> error de credenciales, status queda anon', async () => {
    vi.mocked(api.login).mockRejectedValueOnce(new UnauthorizedError('bad creds'));

    const { result } = renderHook(() => useSession());
    await waitFor(() => expect(result.current.status).toBe('anon'));

    let loginResult: Awaited<ReturnType<typeof result.current.login>> | undefined;
    await act(async () => {
      loginResult = await result.current.login('a@a.com', 'mala');
    });

    expect(loginResult).toEqual({ ok: false, error: 'credenciales' });
    expect(result.current.status).toBe('anon');
  });

  it('login ok pero /me responde 403 -> no-habilitada', async () => {
    vi.mocked(api.login).mockResolvedValueOnce({
      access_token: 'tok',
      token_type: 'bearer',
      expires_in: 3600,
      refresh_token: 'r',
      user: {},
    });
    vi.mocked(api.me).mockRejectedValueOnce(new ForbiddenError('sin tenant'));

    const { result } = renderHook(() => useSession());
    await waitFor(() => expect(result.current.status).toBe('anon'));

    let loginResult: Awaited<ReturnType<typeof result.current.login>> | undefined;
    await act(async () => {
      loginResult = await result.current.login('a@a.com', 'secreta');
    });

    expect(loginResult).toEqual({ ok: false, error: 'no-habilitada' });
    expect(result.current.status).toBe('no-habilitada');
  });

  it('logout limpia token y vuelve a anon', async () => {
    setToken('tok-valido');
    vi.mocked(api.me).mockResolvedValueOnce({ cliente_id: 'c1', mp_connected: false, composio_connected: [] });

    const { result } = renderHook(() => useSession());
    await waitFor(() => expect(result.current.status).toBe('authed'));

    act(() => {
      result.current.logout();
    });

    expect(result.current.status).toBe('anon');
    expect(result.current.me).toBeUndefined();
  });
});
