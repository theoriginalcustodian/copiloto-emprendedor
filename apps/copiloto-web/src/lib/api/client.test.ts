import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { setToken } from '../../auth/session';
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

  it('mapea 401 a UnauthorizedError y limpia el token propio', async () => {
    setToken('tok-expirado');
    fetchMock.mockResolvedValueOnce(mockResponse(401, { detail: 'expirado' }));

    await expect(apiClient.get('/me')).rejects.toBeInstanceOf(UnauthorizedError);
    expect(window.localStorage.getItem('copiloto-token')).toBeNull();
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
