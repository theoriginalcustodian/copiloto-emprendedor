/**
 * CTA7 en la web — **el mismo defecto vivía DOS veces**.
 *
 * El fix se hizo primero en `@copiloto/core`, y al verificarlo en el navegador la app igual terminaba
 * en el login: chat, conexiones y cuenta no usan el cliente del core sino ESTE (`lib/api/client.ts`),
 * que es una copia con la lógica vieja. El código viajó; el razonamiento que lo corrigió, no.
 *
 * Medido en el sitio desplegado antes de este arreglo: borrando sólo `copiloto-token` y recargando →
 * `copiloto-refresh` BORRADO y pantalla de login, con el refresh token todavía sano.
 *
 * Cada test dice qué hay que revertir para verlo en rojo: un test de sesión que pasa con el fix
 * revertido no prueba nada, porque "deslogueado" se parece demasiado a un estado legítimo.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getRefreshToken, getToken, setRefreshToken, setToken } from '../../auth/session';
import { UnauthorizedError, apiClient } from './client';

function respuesta(status: number, body: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) } as Response;
}

/** Cuántas veces se pidió renovar — el numerador del single-flight. */
function refrescos(mock: ReturnType<typeof vi.fn>): number {
  return mock.mock.calls.filter((c) => String(c[0]).includes('/auth/refresh')).length;
}

describe('access token AUSENTE con refresh guardado — el caso que dejó al operador afuera', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    window.localStorage.clear();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('EL QUE IMPORTA: renueva ANTES de mandar la request y la acción funciona', async () => {
    // Revertí `bearerVigente` (volver a `const token = getToken()`) y esto se pone rojo.
    setRefreshToken('rt-vivo');
    fetchMock
      .mockResolvedValueOnce(respuesta(200, { access_token: 'tok-nuevo', refresh_token: 'rt-rotado' }))
      .mockResolvedValueOnce(respuesta(200, { items: [] }));

    await expect(apiClient.get('/clientes')).resolves.toEqual({ items: [] });

    expect(refrescos(fetchMock)).toBe(1);
    const init = fetchMock.mock.calls[1]?.[1] as RequestInit;
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok-nuevo');
    expect(getToken()).toBe('tok-nuevo');
    expect(getRefreshToken()).toBe('rt-rotado'); // GoTrue rota: se persistió el nuevo
  });

  it('si el refresh TAMBIÉN está muerto → UnauthorizedError y ahí sí se limpia (logout real)', async () => {
    setRefreshToken('rt-muerto');
    fetchMock
      .mockResolvedValueOnce(respuesta(401, { detail: 'refresh vencido' }))
      .mockResolvedValueOnce(respuesta(401, { detail: 'missing or malformed Authorization header' }));

    await expect(apiClient.get('/clientes')).rejects.toBeInstanceOf(UnauthorizedError);
    expect(getRefreshToken()).toBeNull(); // única situación que autoriza a borrar
  });

  it('control: sin NADA guardado (nunca logueado) no se pide refresh', async () => {
    // Sin este control, el test de arriba pasaría igual con un `clearToken()` incondicional.
    fetchMock.mockResolvedValueOnce(respuesta(401, { detail: 'no logueado' }));

    await expect(apiClient.get('/clientes')).rejects.toBeInstanceOf(UnauthorizedError);
    expect(refrescos(fetchMock)).toBe(0);
  });
});

describe('un 401 sólo destruye la sesión cuando la sesión es el problema', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    window.localStorage.clear();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('401 que persiste DESPUÉS de un refresh exitoso → NO borra los tokens', async () => {
    // El access token tiene un instante de vida: si el endpoint igual contesta 401, el problema es
    // del endpoint. Revertí `if (sesionMuerta)` a `if (auth)` y esto se pone rojo.
    setToken('tok-viejo');
    setRefreshToken('rt-vivo');
    fetchMock
      .mockResolvedValueOnce(respuesta(401, { detail: 'algo raro' }))
      .mockResolvedValueOnce(respuesta(200, { access_token: 'tok-nuevo', refresh_token: 'rt-rotado' }))
      .mockResolvedValueOnce(respuesta(401, { detail: 'algo raro' }));

    await expect(apiClient.get('/algo')).rejects.toBeInstanceOf(UnauthorizedError);

    expect(getToken()).toBe('tok-nuevo');
    expect(getRefreshToken()).toBe('rt-rotado'); // la sesión sigue viva y usable
  });

  it('control positivo: token vencido + refresh sano → renueva, reintenta y resuelve', async () => {
    // Si el reintento se rompiera, el test de arriba pasaría igual (sigue habiendo un 401 final).
    setToken('tok-viejo');
    setRefreshToken('rt-vivo');
    fetchMock
      .mockResolvedValueOnce(respuesta(401, { detail: 'expirado' }))
      .mockResolvedValueOnce(respuesta(200, { access_token: 'tok-nuevo', refresh_token: 'rt-rotado' }))
      .mockResolvedValueOnce(respuesta(200, { ok: true }));

    await expect(apiClient.get('/algo')).resolves.toEqual({ ok: true });
    expect(getToken()).toBe('tok-nuevo');
  });
});
