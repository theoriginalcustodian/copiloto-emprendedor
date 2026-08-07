import { ApiError, apiClient } from './client';

/**
 * Consola de operador — capa de transporte (CONS5, área A1 Salud + A3 Uso y costo).
 *
 * Reusa `apiClient` tal cual: Bearer, refresh-on-401 single-flight y la jerarquía
 * `ApiError`/`UnauthorizedError`/`ForbiddenError` ya están resueltos ahí y no se reimplementan.
 *
 * Los tipos NO se inventaron: salen del `return` de los endpoints reales —
 * `apps/copiloto/admin_salud.py:59-72` y `apps/copiloto/admin_uso.py:57`.
 */

/** `GET /admin/salud` — `apps/copiloto/admin_salud.py:59`. */
export interface AdminSalud {
  ok: boolean;
  workers: { task_queue: string; pollers: number; ok: boolean };
  schedules: { total: number; pausados: number; sin_proxima_corrida: number; ok: boolean };
}

/** Filas de `admin_uso.py` — una por `cliente_id` (cross-tenant vía rol `copiloto_consola`). */
export interface FilaGastoLlm {
  cliente_id: string;
  turnos_llm: number;
  tokens_totales: number;
  modelo_mas_usado: string | null;
}

export interface FilaUsoTool {
  cliente_id: string;
  tool: string;
  llamadas: number;
}

export interface FilaErrorRate {
  cliente_id: string;
  errores: number;
  llamadas_totales: number;
  /** `null` cuando no hubo llamadas en la ventana (el SQL divide por `nullif(...)`). */
  error_rate_pct: number | null;
}

/** `GET /admin/uso?horas=N` — `apps/copiloto/admin_uso.py:57`. */
export interface AdminUso {
  horas: number;
  gasto_llm: FilaGastoLlm[];
  uso_tools: FilaUsoTool[];
  error_rate_tools: FilaErrorRate[];
}

/**
 * `/admin/*` no está montado en el proceso vivo hasta que `serve.py` reciba `admin_app`
 * (`web.py:1021-1023`: "sin `admin_app`, `/admin/*` ni siquiera existe como ruta").
 *
 * Y cuando no existe, el front-door NO devuelve 404: el catch-all de la SPA responde **200 con el
 * `index.html`**. Medido contra producción el 2026-08-06 — `/admin/salud` y una ruta inventada
 * devolvieron respuestas byte a byte idénticas.
 *
 * Ese es el peor caso posible: `apiClient` ve `res.ok`, intenta `res.json()` y revienta con un
 * `SyntaxError` de parseo que no dice nada del problema real. Por eso la validación de forma vive
 * acá y no en `client.ts` — el cliente es de todas las pantallas, y este modo de fallo es propio de
 * `/admin/*`.
 */
export class AdminNoDisponibleError extends ApiError {
  constructor(ruta: string) {
    super(
      503,
      `El backend no está sirviendo ${ruta} todavía (la consola no está montada en este proceso).`,
    );
    this.name = 'AdminNoDisponibleError';
  }
}

/** Envuelve la llamada para que "la ruta no existe" no se disfrace de error de parseo. */
async function getAdmin<T>(ruta: string, esperado: (d: unknown) => boolean): Promise<T> {
  let data: unknown;
  try {
    data = await apiClient.get<unknown>(ruta);
  } catch (err) {
    // Un cuerpo HTML hace fallar el `res.json()` de `client.ts` con SyntaxError, no con ApiError.
    if (err instanceof ApiError) throw err;
    throw new AdminNoDisponibleError(ruta);
  }
  // 200 con JSON pero de otra forma: tampoco es nuestra respuesta.
  if (!esperado(data)) throw new AdminNoDisponibleError(ruta);
  return data as T;
}

function esSalud(d: unknown): boolean {
  return typeof d === 'object' && d !== null && 'workers' in d && 'schedules' in d;
}

function esUso(d: unknown): boolean {
  return typeof d === 'object' && d !== null && 'gasto_llm' in d && 'error_rate_tools' in d;
}

/** A1 — Salud (workers + schedules de Temporal). 503 real si Temporal no está conectado. */
export function adminSalud(): Promise<AdminSalud> {
  return getAdmin<AdminSalud>('/admin/salud', esSalud);
}

/** A3 — Uso y costo por tenant en las últimas `horas`. 503 real si falta `copiloto_consola`. */
export function adminUso(horas = 24): Promise<AdminUso> {
  return getAdmin<AdminUso>(`/admin/uso?horas=${encodeURIComponent(horas)}`, esUso);
}
