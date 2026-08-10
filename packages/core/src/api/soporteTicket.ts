import { apiClient } from './client';
import { ApiError } from './errors';

/**
 * `GET /soporte/tickets/{id}` — el hilo de UN ticket propio, del lado del USUARIO (no admin).
 *
 * 🔴 **[ASSUMED_PENDING_VERIFY]** — este endpoint todavía NO existe en `main` al escribir esto
 * (S6-11, ver `coordinacion/abierto/2026-08-10_pedido_frontend-a-todos_S6-11-falta-endpoint-de-usuario-para-leer-su-propio-ticket.md`).
 * La forma la propuso frontend calcando el patrón ya vivo de `GET /admin/soporte/tickets/{id}`
 * (`apps/copiloto-web/src/lib/api/admin.ts`) con `require_tenant` en vez de `require_admin`, sin
 * `cliente_id` en la respuesta (ya lo sabe el token, no hace falta exponerlo). Si backend entrega
 * una forma distinta, **el que no coincide es este archivo, no el contrato** — mismo criterio que
 * SOP5 (`respuesta_planificacion-a-backend_SOP5-va-la-B...md`).
 *
 * Se valida por FORMA, no por status — mismo motivo que `listarActividad`: una ruta no desplegada
 * cae en el catch-all del SPA (`200` + HTML), nunca en un 404 limpio (COORDINACION.md §3.bis).
 */
export type EstadoTicketPropio = 'abierto' | 'respondido' | 'cerrado';

/** Fila de `TicketStore.listar_tickets`/`crear_ticket` — `apps/copiloto/soporte_store.py:116`,
 *  vista del lado del tenant dueño (sin `cliente_id`: el borde ya lo sabe). */
export interface TicketPropio {
  id: number;
  codigo: string;
  canal: string;
  estado: EstadoTicketPropio;
  asunto: string;
  created_at: string;
  updated_at: string;
}

/** Fila de `TicketStore.listar_mensajes` — `apps/copiloto/soporte_store.py:165`. `autor` es
 *  `'usuario' | 'operador'`, sin enum cerrado en el cliente porque el store tampoco lo cierra. */
export interface MensajeTicketPropio {
  id: number;
  autor: string;
  texto: string;
  created_at: string;
}

export type MiTicketResult =
  | { status: 'ok'; ticket: TicketPropio; mensajes: MensajeTicketPropio[] }
  | { status: 'no_encontrado' }
  | { status: 'no_disponible' };

function esRespuestaDelEndpoint(raw: unknown): boolean {
  return typeof raw === 'object' && raw !== null && 'ticket' in raw && 'mensajes' in raw;
}

/**
 * El ticket propio + su hilo completo, más reciente primero en `mensajes` NO — cronológico
 * ascendente, igual que `TicketStore.listar_mensajes` los devuelve.
 *
 * `no_encontrado` (404 real, endpoint YA desplegado) es un estado DISTINTO de `no_disponible`
 * (endpoint todavía no desplegado, o 405/501) — no se colapsan: uno dice "ese ticket no es tuyo o
 * no existe", el otro dice "esta función todavía no está", y son mensajes distintos para el
 * usuario.
 */
export async function obtenerMiTicket(ticketId: number): Promise<MiTicketResult> {
  try {
    const raw = await apiClient.get<{ ticket: TicketPropio; mensajes: MensajeTicketPropio[] }>(
      `/soporte/tickets/${encodeURIComponent(ticketId)}`,
    );
    if (!esRespuestaDelEndpoint(raw)) return { status: 'no_disponible' };
    return { status: 'ok', ticket: raw.ticket, mensajes: raw.mensajes ?? [] };
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return { status: 'no_encontrado' };
    if (err instanceof ApiError && (err.status === 501 || err.status === 405)) {
      return { status: 'no_disponible' };
    }
    // Un `200` con HTML del catch-all explota en `res.json()`, no en `mapearError`: llega acá como
    // error de parseo y NO como `ApiError`. Mismo caso que la guarda de forma, visto del otro lado.
    if (!(err instanceof ApiError)) return { status: 'no_disponible' };
    throw err;
  }
}
