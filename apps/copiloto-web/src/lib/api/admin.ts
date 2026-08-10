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
  /** `id` del trauma REPRESENTANTE que eligió el `DISTINCT ON`, no del grupo. Es con lo que se
   *  llama a `POST /admin/errores/{id}/reintentar`, y por eso el reintento afecta a UNA ocurrencia
   *  aunque la fila muestre `tenants_afectados: N` — ver el copy del botón. */
  id: number;
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
  /**
   * `null` → se puede reintentar. Con texto → NO, y ese texto es el motivo, calculado por el
   * backend con `dominio_prohibido` (la MISMA fuente que usa el ciclo automático).
   *
   * El frontend **no lo redacta ni lo interpreta**: lo muestra tal cual. Si lo redactara acá, el día
   * que cambie el criterio del gate la UI mentiría con cara de verdad. Y no podría calcularlo
   * aunque quisiera: `motivo_prohibido()` necesita `contexto.origen.archivo`, y traer `contexto` al
   * cliente está prohibido por el boundary de A5 (arrastraría el texto que tipeó el emprendedor).
   */
  motivo_prohibido: string | null;
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

// ---------------------------------------------------------------------------
// CONS7a — la única acción que MUTA que se puede construir hoy
// ---------------------------------------------------------------------------

/** Los dos únicos valores que el backend acepta (`ESTADOS_VALIDOS`); cualquier otro → 422. */
export type EstadoTenant = 'active' | 'suspended';

/** Respuesta de `POST /admin/tenants/{id}/estado` — `admin_web.py:103`. */
export interface CambioEstadoTenant {
  cliente_id: string;
  de: string;
  a: EstadoTenant;
}

/**
 * Suspende o reactiva un tenant. **POST**, no PATCH: `apiClient` sólo tipa `'GET' | 'POST'`
 * (`client.ts:36`) y el contrato es explícito en no agregar un verbo por esto.
 *
 * Es **idempotente** por diseño del backend: poner el estado que ya tenía responde 200 y audita
 * igual — "el intento es el hecho auditable". Por eso la UI no necesita saber el estado previo para
 * ofrecer la acción, y por eso alcanza un campo de `cliente_id` para reactivar algo que ya no
 * aparece en ninguna lista.
 *
 * ⚠️ Esto **no es** el control de acceso: el punto de aplicación real es `require_tenant`
 * (`auth.py:114`), que devuelve 403 cuando el `status` no es `active`. Acá sólo se escribe la
 * columna. Un tenant suspendido deja de operar por ese guard, no por esta pantalla.
 *
 * No pasa por `getAdmin`: ese helper traduce cualquier fallo a `AdminNoDisponibleError`, que para
 * una MUTACIÓN sería mentir — un 409/422/404 del backend tiene que llegar con su mensaje, que es
 * justamente lo que la UI muestra.
 */
export function adminCambiarEstadoTenant(
  clienteId: string,
  status: EstadoTenant,
): Promise<CambioEstadoTenant> {
  return apiClient.post<CambioEstadoTenant>(
    `/admin/tenants/${encodeURIComponent(clienteId)}/estado`,
    { status },
  );
}

// ---------------------------------------------------------------------------
// CTA1 — listar las cuentas que la consola gestiona
// ---------------------------------------------------------------------------

/**
 * Fila de `uc_factory.tenants`. Las columnas salen del contrato de CTA1, que a su vez las sacó de
 * la tabla viva — no de una convención de naming.
 *
 * **`composio_user_id` NO está, y su ausencia es parte del contrato**, no un olvido: es el
 * identificador con el que se opera contra un tercero y no tiene función en esta pantalla. Si algún
 * día el endpoint lo mandara igual, este tipo NO lo expone: el boundary se respeta en el borde.
 */
export interface FilaTenant {
  cliente_id: string;
  email: string | null;
  status: string;
  created_at: string;
}

/**
 * CTA1 — las cuentas que la consola gestiona. `limite` lo **topea el backend** en 500 (mismo
 * criterio que A6): mandarlo más alto no es un error, simplemente devuelve menos.
 *
 * ⚠️ **Escrito contra la forma del contrato, no contra un endpoint corriendo.** Al momento de
 * escribirlo `GET /admin/tenants` NO existe en `main` (`admin_tenants.py` tiene una sola función y
 * es la que muta), así que esto vale exactamente lo que valga el contrato — y en A6 el handler y el
 * contrato ya discreparon una vez. Por eso el guard de forma de abajo NO es decorativo: si el
 * backend manda otra clave, esto tira `AdminNoDisponibleError` en vez de devolver `undefined` y que
 * la pantalla explote lejos de la causa. La verificación contra el entorno vivo es parte del DoD y
 * está pendiente hasta que backend publique el endpoint.
 */
export function adminTenants(
  opts: { estado?: string; limite?: number } = {},
): Promise<{ tenants: FilaTenant[]; total: number }> {
  const qs = new URLSearchParams();
  if (opts.estado) qs.set('estado', opts.estado);
  if (opts.limite !== undefined) qs.set('limite', String(opts.limite));
  const query = qs.toString();
  return getAdmin<{ tenants: FilaTenant[]; total: number }>(
    `/admin/tenants${query ? `?${query}` : ''}`,
    tieneClave('tenants'),
  );
}

/** Respuesta de `POST /admin/errores/{id}/reintentar` — `admin_web.py:134`. */
export interface ReintentoTrauma {
  trauma_id: number;
  estado: string;
}

// ---------------------------------------------------------------------------
// SOP6 — tickets del agente de soporte, respondidos desde la consola
//
// ⚠️ **Trampa de nombre real, no hipotética**: `FilaTicket`/`adminSoporte()` de arriba (A4) son
// **feedback** (`copiloto_feedback`, una línea, sin hilo) — un sistema sin relación con esto.
// `TicketSoporte` acá es SOP3/SOP6 (`copiloto_tickets`/`copiloto_mensajes`, con hilo y estado
// `abierto → respondido → cerrado`). Mismo nombre de dominio ("ticket"), dos tablas, dos módulos
// de backend (`soporte_store.py` vs `admin_soporte.py`). Ver `CONTEXT.md`.
//
// **Escrito contra la forma del contrato** (`SOP6-el-operador-responde-el-ticket-desde-la-
// consola.md`), mismo criterio que `adminTenants` (CTA1) de arriba: al momento de escribir esto
// backend todavía no publicó `/admin/soporte/tickets*` — el guard de forma (`getAdmin`) traduce
// cualquier discrepancia a `AdminNoDisponibleError` en vez de que la pantalla explote lejos de la
// causa. La verificación contra el entorno vivo queda pendiente hasta que backend despliegue.
// ---------------------------------------------------------------------------

/** Vocabulario cerrado del backend (`soporte_store.CANALES_VALIDOS`, SOP3) — mismo enum que
 * `packages/core/src/api/soporte.ts` define del lado del chat. */
export type CanalTicketSoporte = 'soporte_tecnico' | 'como_uso_la_app';

/** `TicketStore` sólo conoce estos tres — `soporte_store.py` (`ABIERTO`/`RESPONDIDO`/`CERRADO`). */
export type EstadoTicketSoporte = 'abierto' | 'respondido' | 'cerrado';

/** Fila de `TicketStore.listar_tickets` / `crear_ticket` — `apps/copiloto/soporte_store.py:116`. */
export interface TicketSoporte {
  id: number;
  codigo: string;
  canal: CanalTicketSoporte;
  estado: EstadoTicketSoporte;
  asunto: string;
  created_at: string;
  updated_at: string;
}

/** Fila de `TicketStore.listar_mensajes` — `apps/copiloto/soporte_store.py:140`. `autor` es
 * `'usuario' | 'operador'` (`crear_ticket`/`responder` los únicos dos que escriben), sin enum
 * cerrado en el cliente porque el contrato no lo cierra tampoco. */
export interface MensajeTicketSoporte {
  id: number;
  autor: string;
  texto: string;
  created_at: string;
}

/** `GET /admin/soporte/tickets?estado=&codigo=&limite=` — contrato SOP6 §BACKEND. `limite` lo
 * topea el backend en 500 (mismo criterio que A6/CTA1); pedir más no es error, devuelve menos. */
export function adminListarTicketsSoporte(
  opts: { estado?: EstadoTicketSoporte; codigo?: string; limite?: number } = {},
): Promise<{ tickets: TicketSoporte[]; total: number }> {
  const qs = new URLSearchParams();
  if (opts.estado) qs.set('estado', opts.estado);
  if (opts.codigo) qs.set('codigo', opts.codigo);
  if (opts.limite !== undefined) qs.set('limite', String(opts.limite));
  const query = qs.toString();
  return getAdmin<{ tickets: TicketSoporte[]; total: number }>(
    `/admin/soporte/tickets${query ? `?${query}` : ''}`,
    tieneClave('tickets'),
  );
}

function esDetalleTicket(d: unknown): boolean {
  return typeof d === 'object' && d !== null && 'ticket' in d && 'mensajes' in d;
}

/** `GET /admin/soporte/tickets/{id}` — contrato SOP6 §BACKEND. */
export function adminDetalleTicketSoporte(
  ticketId: number,
): Promise<{ ticket: TicketSoporte; mensajes: MensajeTicketSoporte[] }> {
  return getAdmin(`/admin/soporte/tickets/${encodeURIComponent(ticketId)}`, esDetalleTicket);
}

/** Respuesta de `POST /admin/soporte/tickets/{id}/responder` — contrato SOP6 §BACKEND. */
export interface RespuestaTicketSoporte {
  mensaje_id: number;
  estado: EstadoTicketSoporte;
}

/**
 * Responde un ticket (y opcionalmente lo cierra) desde la consola. `cerrar: true` ⇒ el ticket
 * pasa a `cerrado`; si no, a `respondido` (lo decide el backend, no la UI — el `estado` que se
 * muestra después es el que devuelve ESTA respuesta, nunca uno asumido).
 *
 * Sin `getAdmin`, mismo criterio que `adminCambiarEstadoTenant`/`adminReintentarError`: es una
 * MUTACIÓN, y un 404/422 real tiene que llegar con su mensaje, no disfrazarse de "no disponible".
 */
export function adminResponderTicketSoporte(
  ticketId: number,
  texto: string,
  cerrar = false,
): Promise<RespuestaTicketSoporte> {
  return apiClient.post<RespuestaTicketSoporte>(
    `/admin/soporte/tickets/${encodeURIComponent(ticketId)}/responder`,
    { texto, cerrar },
  );
}

/**
 * Reintenta **UN** trauma. La acción de más riesgo del sprint y **no reversible**: el efecto ya
 * ocurrió o no ocurrió, y reintentar algo que sí se ejecutó lo duplica — en este repo eso ya costó
 * dos CAE por una factura.
 *
 * **No existe reintento en lote, y su ausencia es parte del diseño**: no hay endpoint, no hay
 * selección múltiple, y no se agrega "por comodidad".
 *
 * Un dominio `DIAGNOSTIC_ONLY` responde **409** y NO cambia el estado del trauma. La UI no debería
 * llegar a ese 409 (deshabilita el botón con `motivo_prohibido`), pero se maneja igual: el listado
 * puede estar desactualizado respecto del criterio del gate, y esconder el botón es ergonomía —
 * el guard real es el backend.
 *
 * Sin `getAdmin`, por lo mismo que la otra mutación: un 409/404 tiene que llegar con su mensaje.
 */
export function adminReintentarError(traumaId: number): Promise<ReintentoTrauma> {
  return apiClient.post<ReintentoTrauma>(
    `/admin/errores/${encodeURIComponent(traumaId)}/reintentar`,
  );
}
