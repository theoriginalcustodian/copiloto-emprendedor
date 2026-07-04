import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getRefreshToken, getToken, setRefreshToken, setToken } from '../../auth/session';
import { ApiError, ForbiddenError, UnauthorizedError, apiClient } from './client';

function mockResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as Response;
}

describe('apiClient', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    window.localStorage.clear();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('inyecta el Bearer cuando hay token persistido', async () => {
    setToken('tok-123');
    fetchMock.mockResolvedValueOnce(mockResponse(200, { ok: true }));

    await apiClient.get('/me');

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer tok-123');
  });

  it('NO inyecta Bearer cuando la request pide auth:false (ej. login)', async () => {
    setToken('tok-123');
    fetchMock.mockResolvedValueOnce(mockResponse(200, { ok: true }));

    await apiClient.post('/auth/login', { email: 'a@a.com', password: 'x' }, { auth: false });

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
  });

  it('401 → refresca (200) y reintenta → resuelve; persiste tokens nuevos', async () => {
    setToken('tok-viejo');
    setRefreshToken('rt-viejo');
    fetchMock
      .mockResolvedValueOnce(mockResponse(401, { detail: 'expirado' })) // request original
      .mockResolvedValueOnce(
        mockResponse(200, { access_token: 'tok-nuevo', refresh_token: 'rt-nuevo' }),
      ) // POST /auth/refresh
      .mockResolvedValueOnce(mockResponse(200, { ok: true })); // reintento de la request original

    await expect(apiClient.get('/me')).resolves.toEqual({ ok: true });

    expect(getToken()).toBe('tok-nuevo');
    expect(getRefreshToken()).toBe('rt-nuevo');
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const refreshCallUrl = fetchMock.mock.calls[1]?.[0] as string;
    expect(refreshCallUrl).toContain('/auth/refresh');
  });

  it('401 y el refresh también da 401 → UnauthorizedError + limpia AMBOS tokens', async () => {
    setToken('tok-viejo');
    setRefreshToken('rt-viejo');
    fetchMock
      .mockResolvedValueOnce(mockResponse(401, { detail: 'expirado' })) // request original
      .mockResolvedValueOnce(mockResponse(401, { detail: 'refresh token invalido' })); // POST /auth/refresh

    await expect(apiClient.get('/me')).rejects.toBeInstanceOf(UnauthorizedError);

    expect(getToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
  });

  it('401 SIN refresh token (sesión legacy) → NO llama /auth/refresh, limpia token, UnauthorizedError', async () => {
    setToken('tok-viejo'); // sin refresh token persistido
    fetchMock.mockResolvedValueOnce(mockResponse(401, { detail: 'expirado' }));

    await expect(apiClient.get('/me')).rejects.toBeInstanceOf(UnauthorizedError);

    expect(getToken()).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('401 SIN Bearer (sin sesión) → 1 fetch, no interceptor', async () => {
    // Sin token no hay sesión que rescatar: el 401 es definitivo, no dispara el refresh flow.
    fetchMock.mockResolvedValueOnce(mockResponse(401, { detail: 'no auth' }));

    await expect(apiClient.get('/me')).rejects.toBeInstanceOf(UnauthorizedError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('single-flight: dos requests 401 concurrentes → UN solo /auth/refresh', async () => {
    setToken('tok-viejo');
    setRefreshToken('rt-viejo');
    let refreshCalls = 0;
    fetchMock.mockImplementation((url: unknown) => {
      if (typeof url === 'string' && url.includes('/auth/refresh')) {
        refreshCalls += 1;
        return Promise.resolve(
          mockResponse(200, { access_token: 'tok-nuevo', refresh_token: 'rt-nuevo' }),
        );
      }
      // Todas las requests que NO son el refresh (la original y su reintento) dan 401 siempre —
      // simplifica el mock; lo que importa es que /auth/refresh se dispare UNA sola vez.
      return Promise.resolve(mockResponse(401, { detail: 'expirado' }));
    });

    const results = await Promise.allSettled([apiClient.get('/me'), apiClient.get('/catalog')]);

    expect(refreshCalls).toBe(1);
    expect(results.every((r) => r.status === 'rejected')).toBe(true);
  });

  it('mapea 403 a ForbiddenError sin tocar el token', async () => {
    setToken('tok-valido');
    fetchMock.mockResolvedValueOnce(mockResponse(403, { detail: 'sin tenant' }));

    await expect(apiClient.get('/me')).rejects.toBeInstanceOf(ForbiddenError);
    expect(window.localStorage.getItem('copiloto-token')).toBe('tok-valido');
  });

  it('otros status no-ok mapean a ApiError genérico con el status HTTP', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse(500, { detail: 'boom' }));

    const error = (await apiClient.get('/catalog').catch((err: unknown) => err)) as ApiError;
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(500);
  });
});
