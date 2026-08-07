import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { setToken } from '../../auth/session';
import {
  AdminNoDisponibleError,
  adminAuditoria,
  adminCambiarEstadoTenant,
  adminErrores,
  adminSalud,
  adminSoporte,
  adminUso,
} from './admin';
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

/**
 * CONS6 — A5/A4/A6 en la capa de TRANSPORTE.
 *
 * Estos tests van acá y no en `AdminScreen.test.tsx` por una razón medida: la pantalla mockea
 * `lib/api/admin`, así que el guard de forma (`tieneClave`) **nunca corre** en sus tests. Se
 * comprobó — cambiar `tieneClave('eventos')` por `tieneClave('auditoria')` deja los 23 tests de la
 * pantalla en verde. El borde del wire sólo se ejercita mockeando `fetch`, que es lo que hace este
 * archivo. Ver `memoria/tests-que-mockean-la-serializacion-son-ciegos-al-borde-del-wire`.
 */
describe('api admin (CONS6 — A5 errores + A4 soporte + A6 auditoría)', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    window.localStorage.clear();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('adminErrores acepta la forma real y pasa los filtros por querystring', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse(200, { errores: [] }));
    await adminErrores({ estado: 'pendiente', limite: 10 });
    const url = String(fetchMock.mock.calls[0]?.[0]);
    expect(url).toContain('estado=pendiente');
    expect(url).toContain('limite=10');
  });

  it('adminErrores sin filtros no manda querystring vacío', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse(200, { errores: [] }));
    await adminErrores();
    expect(String(fetchMock.mock.calls[0]?.[0])).not.toContain('?');
  });

  it('adminSoporte acepta la forma real', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse(200, { tickets: [] }));
    await expect(adminSoporte()).resolves.toEqual({ tickets: [] });
  });

  // ---- El guard de forma de A6, que es donde ya nos mordió una vez ----

  it('adminAuditoria acepta `{eventos, total}` — la clave que manda el handler', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse(200, { eventos: [], total: 0 }));
    await expect(adminAuditoria()).resolves.toEqual({ eventos: [], total: 0 });
  });

  it('adminAuditoria RECHAZA `{auditoria: [...]}` — el shape viejo se rompe ruidoso', async () => {
    // El 2026-08-07 el handler devolvía esta forma y se alineó al contrato unas horas después. Que
    // el cliente la rechace es lo QUERIDO: si la aceptara "por las dudas", un backend que vuelva
    // atrás mostraría un registro de auditoría vacío, indistinguible de "todavía no hubo acciones".
    fetchMock.mockResolvedValueOnce(mockResponse(200, { auditoria: [{ id: 1 }] }));
    await expect(adminAuditoria()).rejects.toBeInstanceOf(AdminNoDisponibleError);
  });

  it('adminAuditoria rechaza un `eventos` que no es lista', async () => {
    // Control del guard: `'eventos' in d` a secas dejaría pasar `{eventos: "algo"}` y el `.map` de
    // la pantalla explotaría con un error que no dice nada del problema real.
    fetchMock.mockResolvedValueOnce(mockResponse(200, { eventos: 'no soy una lista' }));
    await expect(adminAuditoria()).rejects.toBeInstanceOf(AdminNoDisponibleError);
  });

  it('adminAuditoria pasa sus tres filtros por querystring', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse(200, { eventos: [], total: 0 }));
    await adminAuditoria({ clienteId: 'c1', adminUserId: 'a1', limite: 500 });
    const url = String(fetchMock.mock.calls[0]?.[0]);
    expect(url).toContain('cliente_id=c1');
    expect(url).toContain('admin_user_id=a1');
    expect(url).toContain('limite=500');
  });

  it('las tres rutas nuevas también traducen el catch-all de la SPA', async () => {
    // Mismo modo de fallo que A1/A3: 200 con el index.html cuando `/admin/*` no está montado.
    for (const llamar of [adminErrores, adminSoporte, adminAuditoria]) {
      fetchMock.mockResolvedValueOnce(mockCatchAllHtml());
      await expect(llamar()).rejects.toBeInstanceOf(AdminNoDisponibleError);
    }
  });

  it('un 403 en las tres sigue siendo ForbiddenError, no "no está montado"', async () => {
    for (const llamar of [adminErrores, adminSoporte, adminAuditoria]) {
      fetchMock.mockResolvedValueOnce(mockResponse(403, { detail: 'no sos admin' }));
      await expect(llamar()).rejects.toBeInstanceOf(ForbiddenError);
    }
  });
});

/** CONS7a — la única acción que MUTA. Acá se prueba el borde del wire; la UI, en AdminScreen. */
describe('api admin (CONS7a — suspender / reactivar tenant)', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    window.localStorage.clear();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('manda POST con el body {status} y devuelve el cambio', async () => {
    fetchMock.mockResolvedValueOnce(
      mockResponse(200, { cliente_id: 'c1', de: 'active', a: 'suspended' }),
    );
    await expect(adminCambiarEstadoTenant('c1', 'suspended')).resolves.toEqual({
      cliente_id: 'c1',
      de: 'active',
      a: 'suspended',
    });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/admin/tenants/c1/estado');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({ status: 'suspended' });
  });

  it('escapa el cliente_id en la ruta', async () => {
    // Un id con `/` partiría la ruta y pegaría a otro endpoint sin que nadie lo note.
    fetchMock.mockResolvedValueOnce(mockResponse(200, { cliente_id: 'a/b', de: 'active', a: 'active' }));
    await adminCambiarEstadoTenant('a/b', 'active');
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/admin/tenants/a%2Fb/estado');
  });

  it('un 404 llega con el detail del backend, NO como AdminNoDisponible', async () => {
    // Una mutación no puede reportar "la consola no está montada" cuando el backend contestó que
    // ese tenant no existe: mandaría a buscar el problema al lugar equivocado. Por eso esta función
    // no pasa por `getAdmin`.
    fetchMock.mockResolvedValueOnce(mockResponse(404, { detail: 'tenant no encontrado' }));
    await expect(adminCambiarEstadoTenant('fantasma', 'suspended')).rejects.toMatchObject({
      status: 404,
      detail: 'tenant no encontrado',
    });
    await expect(adminCambiarEstadoTenant('fantasma', 'suspended')).rejects.not.toBeInstanceOf(
      AdminNoDisponibleError,
    );
  });

  it('un 422 conserva su detail (status inválido)', async () => {
    fetchMock.mockResolvedValueOnce(
      mockResponse(422, { detail: "status debe ser uno de {'active', 'suspended'}, recibí 'x'" }),
    );
    await expect(adminCambiarEstadoTenant('c1', 'active')).rejects.toMatchObject({ status: 422 });
  });

  it('un 409 con `detail` OBJETO expone su `mensaje` — no el texto genérico del status', async () => {
    // `errores_web.conflicto()` manda `{codigo, mensaje, ...}`. Hasta el 2026-08-07 `client.ts`
    // sólo leía `detail` cuando era string y este mensaje se caía al piso, así que la UI mostraba
    // "Conflicto" en vez del motivo real. Este test fija el arreglo.
    fetchMock.mockResolvedValueOnce(
      mockResponse(409, {
        detail: { codigo: 'TRAUMA_DOMINIO_PROHIBIDO', mensaje: 'dominio DIAGNOSTIC_ONLY: afip_gateway', dominio: 'afip_gateway' },
      }),
    );
    await expect(adminCambiarEstadoTenant('c1', 'suspended')).rejects.toMatchObject({
      status: 409,
      detail: 'dominio DIAGNOSTIC_ONLY: afip_gateway',
    });
  });

  it('un `detail` objeto SIN `mensaje` no inventa texto — cae al genérico', async () => {
    // Control del anterior: si cualquier objeto devolviera algo, un `{detail: {}}` produciría
    // `undefined`/"[object Object]" en la UI. Sin `mensaje` string, no hay detail.
    fetchMock.mockResolvedValueOnce(mockResponse(409, { detail: { codigo: 'X' } }));
    await expect(adminCambiarEstadoTenant('c1', 'suspended')).rejects.toMatchObject({
      status: 409,
      detail: undefined,
    });
  });
});
