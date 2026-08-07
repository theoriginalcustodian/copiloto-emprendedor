import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { setToken } from '../../auth/session';
import { AdminNoDisponibleError, adminSalud, adminUso } from './admin';
import { ForbiddenError, UnauthorizedError } from './client';

/** Mismo helper que `client.test.ts` — respuesta JSON normal. */
function mockResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as Response;
}

/**
 * 200 cuyo cuerpo NO es JSON: es lo que devuelve el catch-all de la SPA cuando `/admin/*` no está
 * montado. `res.json()` rechaza con SyntaxError, igual que en el navegador real.
 */
function mockCatchAllHtml(): Response {
  return {
    ok: true,
    status: 200,
    json: () => Promise.reject(new SyntaxError('Unexpected token < in JSON')),
  } as Response;
}

const SALUD_OK = {
  ok: true,
  workers: { task_queue: 'agent-emprendedor', pollers: 2, ok: true },
  schedules: { total: 4, pausados: 0, sin_proxima_corrida: 0, ok: true },
};

const USO_OK = {
  horas: 24,
  gasto_llm: [
    { cliente_id: 'c1', turnos_llm: 10, tokens_totales: 5000, modelo_mas_usado: 'sonnet' },
  ],
  uso_tools: [{ cliente_id: 'c1', tool: 'registrar_gasto', llamadas: 3 }],
  error_rate_tools: [
    { cliente_id: 'c1', errores: 1, llamadas_totales: 4, error_rate_pct: 25.0 },
  ],
};

describe('api admin (CONS5 — A1 salud + A3 uso)', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    window.localStorage.clear();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('adminSalud devuelve la forma real del endpoint', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse(200, SALUD_OK));
    await expect(adminSalud()).resolves.toEqual(SALUD_OK);
  });

  it('adminUso pasa las horas por querystring', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse(200, USO_OK));
    await adminUso(72);
    expect(fetchMock.mock.calls[0]?.[0]).toContain('/admin/uso?horas=72');
  });

  it('adminUso usa 24h por default', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse(200, USO_OK));
    await adminUso();
    expect(fetchMock.mock.calls[0]?.[0]).toContain('horas=24');
  });

  it('manda el Bearer (reusa apiClient, no un fetch propio)', async () => {
    setToken('tok-admin');
    fetchMock.mockResolvedValueOnce(mockResponse(200, SALUD_OK));
    await adminSalud();
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok-admin');
  });

  // ---- El modo de fallo que motivó esta capa ----

  it('un 200 con HTML (catch-all de la SPA) es AdminNoDisponible, no un error de parseo', async () => {
    fetchMock.mockResolvedValueOnce(mockCatchAllHtml());
    await expect(adminSalud()).rejects.toBeInstanceOf(AdminNoDisponibleError);
  });

  it('un 200 con JSON de OTRA forma tampoco se acepta como respuesta válida', async () => {
    // Sin esto, cualquier `{}` pasaría como AdminSalud y la UI mostraría ceros inventados.
    fetchMock.mockResolvedValueOnce(mockResponse(200, { cualquier: 'cosa' }));
    await expect(adminSalud()).rejects.toBeInstanceOf(AdminNoDisponibleError);
  });

  // ---- Controles NEGATIVOS: los errores REALES no deben quedar disfrazados ----
  // Si todo terminara en AdminNoDisponibleError, la consola diría "no está montado" cuando en
  // realidad al operador le faltan permisos, y se buscaría el problema en el lugar equivocado.

  it('un 403 sigue siendo ForbiddenError (permisos), no AdminNoDisponible', async () => {
    setToken('tok-sin-admin');
    fetchMock.mockResolvedValueOnce(mockResponse(403, { detail: 'no sos admin' }));
    await expect(adminSalud()).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('un 401 sigue siendo UnauthorizedError', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse(401, { detail: 'sin token' }));
    await expect(adminSalud()).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('un 503 REAL del backend conserva su detail (Temporal caído ≠ ruta ausente)', async () => {
    fetchMock.mockResolvedValueOnce(
      mockResponse(503, { detail: 'Temporal no conectado en este proceso' }),
    );
    await expect(adminSalud()).rejects.toMatchObject({
      status: 503,
      detail: 'Temporal no conectado en este proceso',
    });
  });
});
