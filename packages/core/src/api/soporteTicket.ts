import { apiClient, postMultipart } from './client';
import { ApiError } from './errors';
import type { ArchivoSubida } from './http';

/**
 * `GET /soporte/tickets/{id}` — el hilo de UN ticket propio, del lado del USUARIO (no admin).
 *
 * ✅ **VERIFICADO** (2026-08-10, PR #372) — backend entregó el endpoint calcando la forma que
 * frontend propuso en `pedido_frontend-a-todos_S6-11-falta-endpoint-de-usuario-para-leer-su-propio-ticket.md`:
 * `require_tenant` en vez de `require_admin` de `GET /admin/soporte/tickets/{id}`, sin `cliente_id`
 * en la respuesta (ya lo sabe el token). Columnas de `TicketStore.obtener_ticket` (`apps/copiloto/soporte_store.py`)
 * confirmadas 1:1 contra `TicketPropio` leyendo el commit real (`77769c2c`), no autoevaluación.
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

/**
 * `GET /soporte/tickets` — la LISTA de los tickets propios (PROTO4DEPS §1, `apps/copiloto/web.py`
 * `soporte_tickets_propios`). Más recientes primero.
 *
 * 🔴 **`total` NO es `items.length`**: es el conteo del tenant bajo el mismo filtro de `estado`, sin el
 * tope de `limite`. Quien pinte «N tickets» usa `total`; quien pinte filas usa `items`.
 *
 * 🔴 **`respuestaEstimada` llega `null` hoy y la fila «Te contestan» no se pinta con `null`**: el «4 h
 * hábiles» del prototipo contradice un acta (`textosSoporte.ts`, BL-O7) y es decisión del operador. El
 * backend emite la clave igual para que la forma no se adivine cuando se decida; este parser la deja
 * pasar tal cual (string no vacío) o `null`, y NO inventa un literal.
 *
 * Mismo criterio de fail-soft que `obtenerMiTicket`: una ruta no desplegada cae en el catch-all del SPA
 * (`200` + HTML) o en un 404/405/501, y eso es `no_disponible`, no un error que tire la pantalla.
 */
export interface MisTicketsOk {
  status: 'ok';
  items: TicketPropio[];
  total: number;
  respuestaEstimada: string | null;
}

export type MisTicketsResult = MisTicketsOk | { status: 'no_disponible' };

const ESTADOS_TICKET: readonly string[] = ['abierto', 'respondido', 'cerrado'];

/** Una fila con la forma mínima para pintarla; lo que no la tiene se descarta (no se inventa). */
function ticketDe(v: unknown): TicketPropio | null {
  if (typeof v !== 'object' || v === null) return null;
  const r = v as Record<string, unknown>;
  if (typeof r.id !== 'number' || typeof r.codigo !== 'string' || typeof r.asunto !== 'string') return null;
  // Un estado fuera del enum cerrado no se pinta como otro: la fila se descarta antes que mentir.
  if (typeof r.estado !== 'string' || !ESTADOS_TICKET.includes(r.estado)) return null;
  return {
    id: r.id,
    codigo: r.codigo,
    canal: typeof r.canal === 'string' ? r.canal : '',
    estado: r.estado as EstadoTicketPropio,
    asunto: r.asunto,
    created_at: typeof r.created_at === 'string' ? r.created_at : '',
    updated_at: typeof r.updated_at === 'string' ? r.updated_at : '',
  };
}

export async function listarMisTickets(opts: { limite?: number } = {}): Promise<MisTicketsResult> {
  const limite = opts.limite ?? 50;
  try {
    const raw = await apiClient.get<unknown>(`/soporte/tickets?limite=${encodeURIComponent(limite)}`);
    if (typeof raw !== 'object' || raw === null) return { status: 'no_disponible' };
    const r = raw as Record<string, unknown>;
    if (!Array.isArray(r.items)) return { status: 'no_disponible' };
    const items = r.items.map(ticketDe).filter((t): t is TicketPropio => t !== null);
    // Sin `total` numérico se cae al largo de lo recibido: es lo único honesto que se sabe.
    const total = typeof r.total === 'number' && Number.isFinite(r.total) ? r.total : items.length;
    const est = r.respuesta_estimada;
    const respuestaEstimada = typeof est === 'string' && est.trim() !== '' ? est : null;
    return { status: 'ok', items, total, respuestaEstimada };
  } catch (err) {
    if (err instanceof ApiError && (err.status === 404 || err.status === 405 || err.status === 501)) {
      return { status: 'no_disponible' };
    }
    if (!(err instanceof ApiError)) return { status: 'no_disponible' };
    throw err;
  }
}

/**
 * `POST /soporte/tickets/{id}/adjuntos` (201) — UNA imagen (jpg/png) a UN ticket PROPIO (PROTO4DEPS §4).
 *
 * Los rechazos del backend son estructura por STATUS, no por el texto del `detail`:
 *  - `404` → `no_encontrado`: el ticket no existe o es de otro tenant (los dos dan el mismo 404, a propósito);
 *  - `415` → `formato`: no es jpg/png (el backend mira los bytes, no el `content_type` del cliente);
 *  - `413` → `rechazado`: pesa de más **o** el ticket ya tiene el máximo de adjuntos. Son dos causas con
 *    el mismo status y distinguirlas exigiría leer el texto del `detail`, que el backend puede cambiar:
 *    no se distingue, se dice con palabras que cubren las dos.
 * `no_disponible` es la ruta todavía no desplegada. Cualquier otro error se propaga.
 */
export interface AdjuntoGuardado {
  id: number;
  nombre: string;
  tipo: string;
  bytes: number;
}

export type AdjuntarResult =
  | { status: 'ok'; adjunto: AdjuntoGuardado }
  | { status: 'no_encontrado' }
  | { status: 'formato' }
  | { status: 'rechazado' }
  | { status: 'no_disponible' };

export async function adjuntarFotoATicket(ticketId: number, archivo: ArchivoSubida): Promise<AdjuntarResult> {
  try {
    const raw = await postMultipart<unknown>(
      `/soporte/tickets/${encodeURIComponent(ticketId)}/adjuntos`,
      {},
      'adjunto',
      archivo,
    );
    if (typeof raw !== 'object' || raw === null || typeof (raw as { id?: unknown }).id !== 'number') {
      return { status: 'no_disponible' };
    }
    const a = raw as Record<string, unknown>;
    return {
      status: 'ok',
      adjunto: {
        id: a.id as number,
        nombre: typeof a.nombre === 'string' ? a.nombre : '',
        tipo: typeof a.tipo === 'string' ? a.tipo : '',
        bytes: typeof a.bytes === 'number' ? a.bytes : 0,
      },
    };
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 404) return { status: 'no_encontrado' };
      if (err.status === 415) return { status: 'formato' };
      if (err.status === 413) return { status: 'rechazado' };
      if (err.status === 405 || err.status === 501) return { status: 'no_disponible' };
      throw err;
    }
    return { status: 'no_disponible' };
  }
}
