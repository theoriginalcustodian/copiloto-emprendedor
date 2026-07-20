import { act, renderHook, waitFor } from '@testing-library/react-native';

// Jest (jest-expo) — describe/it/expect/jest son globales, no se importan de vitest.

/**
 * Partial mock de `@copiloto/core`: reusa las clases de error REALES (`UnauthorizedError` /
 * `ForbiddenError`) para que el `instanceof` que hace `SessionProvider` contra el MISMO módulo
 * mockeado siga funcionando — sólo se reemplazan `login`/`me` por fns espiables. Port de
 * `_staging/documed/apps/mobile/src/modules/auth/session.test.tsx` (mismo patrón).
 */
jest.mock('@copiloto/core', () => {
  const actual = jest.requireActual('@copiloto/core');
  return {
    ...actual,
    apiReal: {
      ...actual.apiReal,
      login: jest.fn(),
      me: jest.fn(),
    },
  };
});

import { apiReal as api, ForbiddenError, UnauthorizedError } from '@copiloto/core';

import { almacenTokens } from '../../adapters/almacen';
import { SessionProvider } from './SessionProvider';
import { useSession } from './useSession';

// La sesión es compartida vía contexto: el hook se consume SIEMPRE dentro de <SessionProvider>.
const wrapper = SessionProvider;

describe('useSession (vía SessionProvider)', () => {
  beforeEach(async () => {
    await almacenTokens.limpiar();
    jest.mocked(api.login).mockReset();
    jest.mocked(api.me).mockReset();
  });

  it('sin token persistido -> anon (nunca llama a /me)', async () => {
    const { result } = await renderHook(() => useSession(), { wrapper });
    await waitFor(() => expect(result.current.estado).toBe('anon'));
    expect(api.me).not.toHaveBeenCalled();
  });

  it('con token persistido válido -> autenticado (chequeo de montaje vía /me) y expone la identidad', async () => {
    await almacenTokens.guardarToken('tok-valido');
    jest.mocked(api.me).mockResolvedValueOnce({ cliente_id: 'cli-1', email: 'emprendedor@copiloto.test' });

    const { result } = await renderHook(() => useSession(), { wrapper });

    await waitFor(() => expect(result.current.estado).toBe('autenticado'));
    expect(api.me).toHaveBeenCalled();
    expect(result.current.me).toEqual({ cliente_id: 'cli-1', email: 'emprendedor@copiloto.test' });
  });

  it('login exitoso -> autenticado', async () => {
    jest.mocked(api.login).mockResolvedValueOnce({
      access_token: 'nuevo-token',
      token_type: 'bearer',
      expires_in: 3600,
      refresh_token: 'r',
      user: {},
    });
    jest.mocked(api.me).mockResolvedValueOnce({ cliente_id: 'cli-1', email: 'emprendedor@copiloto.test' });

    const { result } = await renderHook(() => useSession(), { wrapper });
    await waitFor(() => expect(result.current.estado).toBe('anon'));

    let loginResult: Awaited<ReturnType<typeof result.current.login>> | undefined;
    await act(async () => {
      loginResult = await result.current.login('a@a.com', 'secreta');
    });

    expect(loginResult).toEqual({ ok: true });
    expect(result.current.estado).toBe('autenticado');
  });

  it('login con 401 -> error de credenciales, estado queda anon', async () => {
    jest.mocked(api.login).mockRejectedValueOnce(new UnauthorizedError('bad creds'));

    const { result } = await renderHook(() => useSession(), { wrapper });
    await waitFor(() => expect(result.current.estado).toBe('anon'));

    let loginResult: Awaited<ReturnType<typeof result.current.login>> | undefined;
    await act(async () => {
      loginResult = await result.current.login('a@a.com', 'mala');
    });

    expect(loginResult).toEqual({ ok: false, error: 'credenciales' });
    expect(result.current.estado).toBe('anon');
  });

  it('un 403 en /me NO es lo mismo que un 401: login ok pero /me responde 403 -> no-habilitada', async () => {
    // 401 -> 'anon' (mostrar login); 403 -> 'no-habilitada' (mostrar login CON aviso: la cuenta
    // existe pero no está habilitada). Confundirlos deja al usuario mirando un login que "no
    // funciona", tipeando la contraseña correcta una y otra vez, sin ninguna pista de que el
    // problema no es su contraseña.
    jest.mocked(api.login).mockResolvedValueOnce({
      access_token: 'tok',
      token_type: 'bearer',
      expires_in: 3600,
      refresh_token: 'r',
      user: {},
    });
    jest.mocked(api.me).mockRejectedValueOnce(new ForbiddenError('sin tenant'));

    const { result } = await renderHook(() => useSession(), { wrapper });
    await waitFor(() => expect(result.current.estado).toBe('anon'));

    let loginResult: Awaited<ReturnType<typeof result.current.login>> | undefined;
    await act(async () => {
      loginResult = await result.current.login('a@a.com', 'secreta');
    });

    expect(loginResult).toEqual({ ok: false, error: 'no-habilitada' });
    expect(result.current.estado).toBe('no-habilitada');
  });

  it('error de red en login -> aviso genérico, estado queda anon', async () => {
    jest.mocked(api.login).mockRejectedValueOnce(new Error('network down'));

    const { result } = await renderHook(() => useSession(), { wrapper });
    await waitFor(() => expect(result.current.estado).toBe('anon'));

    let loginResult: Awaited<ReturnType<typeof result.current.login>> | undefined;
    await act(async () => {
      loginResult = await result.current.login('a@a.com', 'secreta');
    });

    expect(loginResult).toEqual({ ok: false, error: 'red' });
    expect(result.current.estado).toBe('anon');
  });

  it('logout limpia token, identidad y vuelve a anon', async () => {
    await almacenTokens.guardarToken('tok-valido');
    jest.mocked(api.me).mockResolvedValueOnce({ cliente_id: 'cli-1', email: 'emprendedor@copiloto.test' });

    const { result } = await renderHook(() => useSession(), { wrapper });
    await waitFor(() => expect(result.current.estado).toBe('autenticado'));

    await act(() => {
      result.current.logout();
    });

    expect(result.current.estado).toBe('anon');
    expect(result.current.me).toBeNull();
  });
});
