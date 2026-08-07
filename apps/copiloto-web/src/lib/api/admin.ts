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

function tieneClave(clave: string) {
  return (d: unknown): boolean =>
    typeof d === 'object' && d !== null && clave in d && Array.isArray((d as never)[clave]);
}

/** A1 — Salud (workers + schedules de Temporal). 503 real si Temporal no está conectado. */
export function adminSalud(): Promise<AdminSalud> {
  return getAdmin<AdminSalud>('/admin/salud', esSalud);
}

/** A3 — Uso y costo por tenant en las últimas `horas`. 503 real si falta `copiloto_consola`. */
export function adminUso(horas = 24): Promise<AdminUso> {
  return getAdmin<AdminUso>(`/admin/uso?horas=${encodeURIComponent(horas)}`, esUso);
}

// ---------------------------------------------------------------------------
// CONS6 — A5 Errores · A4 Soporte · A6 Auditoría
//
// Los tipos de las FILAS salen del SELECT de cada módulo, columna por columna. La ENVOLTURA sale
// del handler (`admin_web.py`), que es el que decide la clave — y en A6 los dos discreparon durante
// unas horas; ver el docstring de `adminAuditoria`.
// ---------------------------------------------------------------------------

/** Fila de `admin_errores.resumen_errores` — UNA por `fingerprint` (DISTINCT ON), cross-tenant. */
export interface FilaError {
  fingerprint: string;
  workflow: string | null;
  error_type: string | null;
  costura: string | null;
  estado: string;
  /** `contexto ->> 'ultima_nota'` — qué intentó la autosanación y en qué terminó. `null` si nunca
   *  se intentó. NO llega el `contexto` completo a propósito: puede traer el texto que tipeó el
   *  emprendedor, que está fuera del boundary de la consola (ver el docstring de `admin_errores.py`). */
  ultima_nota: string | null;
  dedupe_count: number;
  intentos: number;
  created_at: string;
  updated_at: string;
  /** Cuántos tenants distintos sufrieron ESTE mismo fingerprint. */
  tenants_afectados: number;
}

/** Fila de `admin_soporte.resumen_soporte` — feedback entrante y si derivó en autosanación. */
export interface FilaTicket {
  id: number;
  cliente_id: string;
  tipo: string | null;
  /** Acá el texto SÍ se muestra: "feedback y su clasificación" está declarado DENTRO del boundary
   *  (contraparte exacta de lo que A5 debe ocultar). */
  texto: string | null;
  created_at: string;
  derivo_en_autosanacion: boolean;
  /** `null` cuando no hay trauma asociado — y entonces NO se puede distinguir "esperando" de "el
   *  clasificador dijo que no": esa clasificación es efímera y no deja rastro durable
   *  (`soporte_feedback_activities.py`, "Por qué NO hay tabla de estado nueva"). */
  estado_reparacion: string | null;
  origen: Record<string, unknown> | null;
  ultima_nota: string | null;
  dedupe_count: number | null;
}

/** Fila de `AuditoriaStore.listar()` — append-only, quién hizo qué en la consola. */
export interface FilaAuditoria {
  id: number;
  cliente_id: string | null;
  admin_user_id: string | null;
  admin_email: string | null;
  accion: string;
  /** Objeto ARBITRARIO: su forma depende de la acción. Se renderiza sin asumir claves (DoD del
   *  contrato A6) — hoy `tenant.estado` manda `{de, a}`, mañana otra acción mandará otra cosa. */
  detalle: Record<string, unknown> | null;
  resultado: string | null;
  created_at: string;
}

/** A5 — DLQ agrupada por fingerprint. `estado` filtra (pendiente/reparado/…); sin él, todos. */
export function adminErrores(opts: { estado?: string; limite?: number } = {}): Promise<{
  errores: FilaError[];
}> {
  const q = new URLSearchParams();
  if (opts.estado) q.set('estado', opts.estado);
  if (opts.limite != null) q.set('limite', String(opts.limite));
  const qs = q.toString();
  return getAdmin(`/admin/errores${qs ? `?${qs}` : ''}`, tieneClave('errores'));
}

/** A4 — Feedback entrante y su clasificación. */
export function adminSoporte(limite?: number): Promise<{ tickets: FilaTicket[] }> {
  const qs = limite != null ? `?limite=${encodeURIComponent(limite)}` : '';
  return getAdmin(`/admin/soporte${qs}`, tieneClave('tickets'));
}

/**
 * A6 — Registro de auditoría de la consola.
 *
 * La respuesta es `{eventos, total}`. **Fue `{auditoria}` durante unas horas** el 2026-08-07: el
 * handler que se mergeó primero no seguía a su propio contrato, lo reporté al buzón, y backend
 * alineó el handler (`admin_web.py:69-80`, ahora también con el tope `min(limite, 500)` que el DoD
 * pedía). Se deja escrito porque explica por qué el guard de forma de acá no es paranoia: ese cambio
 * de shape convirtió esta llamada en `AdminNoDisponibleError` — la consola dijo "no está montada"
 * en vez de mostrar una tabla vacía, que es exactamente el modo de fallo que se quería. Un registro
 * de auditoría vacío es indistinguible de uno que no se está leyendo.
 *
 * `total` viene del backend y hoy es `len(eventos)`; se tipa igual porque es parte del contrato y
 * el día que el backend pagine, `eventos.length` dejaría de ser el total.
 */
export function adminAuditoria(
  opts: { clienteId?: string; adminUserId?: string; limite?: number } = {},
): Promise<{ eventos: FilaAuditoria[]; total: number }> {
  const q = new URLSearchParams();
  if (opts.clienteId) q.set('cliente_id', opts.clienteId);
  if (opts.adminUserId) q.set('admin_user_id', opts.adminUserId);
  if (opts.limite != null) q.set('limite', String(opts.limite));
  const qs = q.toString();
  return getAdmin(`/admin/auditoria${qs ? `?${qs}` : ''}`, tieneClave('eventos'));
}
