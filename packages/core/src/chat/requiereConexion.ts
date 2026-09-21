import { listarCatalogo } from '../api/catalogo';
import type { ReplyCard } from '../api/types';
import type { ChatMessage } from './chatMachine';

/**
 * K-11 / BL-J8 — `card.kind === 'requiere_conexion'`: el turno cayó en `ConnectionRequired` y el backend
 * devuelve el «conectá X» estructurado (`apps/copiloto/catalog.py:requiere_conexion_card`). `alcance` y
 * `connectPath` salen de `GET /catalog` (misma fuente: cero copy duplicado en el cliente).
 *
 * Aditivo: un cliente que no lo entiende sigue mostrando `reply.text`. Un `card` de otro tipo, o sin
 * `service`/`connect_path` (sin lo cual no hay acción posible), NO dispara el sheet.
 */
export interface RequiereConexion {
  service: string;
  label: string;
  alcance: string[];
  connectPath: string;
}

function texto(v: unknown): string | null {
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : null;
}

/** La card leída, o `null` si no es un `requiere_conexion` completo. */
export function leerRequiereConexion(card: ReplyCard | null | undefined): RequiereConexion | null {
  if (card?.kind !== 'requiere_conexion') return null;
  const raw = card as Record<string, unknown>;
  const service = texto(raw.service);
  const connectPath = texto(raw.connect_path);
  if (service == null || connectPath == null) return null;
  const alcance = Array.isArray(raw.alcance) ? raw.alcance.map(texto).filter((a): a is string => a != null) : [];
  return { service, label: texto(raw.label) ?? service, alcance, connectPath };
}

export interface ConexionPendiente {
  /** Id del mensaje del asistente que trajo la card — sirve para que «Ahora no» no la reabra. */
  mensajeId: string;
  conexion: RequiereConexion;
  /** Lo que el usuario había pedido: es lo que se reenvía tras conectar. `null` si no se encuentra. */
  textoOriginal: string | null;
}

/**
 * El gate vigente del hilo: sólo si el ÚLTIMO mensaje es del asistente con la card (si el usuario ya
 * siguió hablando, el sheet quedó viejo) y no fue descartado con «Ahora no». El texto original es el
 * último mensaje del usuario anterior a la card — el cliente ya lo tiene, el backend no lo devuelve.
 */
export function conexionPendienteDelHilo(
  messages: readonly ChatMessage[],
  descartados: ReadonlySet<string>,
): ConexionPendiente | null {
  const ultimo = messages[messages.length - 1];
  if (ultimo == null || ultimo.role !== 'assistant' || descartados.has(ultimo.id)) return null;
  const conexion = leerRequiereConexion(ultimo.card);
  if (conexion == null) return null;
  let textoOriginal: string | null = null;
  for (let i = messages.length - 2; i >= 0; i--) {
    const m = messages[i];
    if (m?.role === 'user') {
      textoOriginal = texto(m.text);
      break;
    }
  }
  return { mensajeId: ultimo.id, conexion, textoOriginal };
}

/**
 * ¿Quedó conectado `service`? — se RE-CONSULTA el catálogo y se le cree a `conectado`; haber tocado
 * «Conectar» (o volver del navegador) no prueba nada. Cualquier falla o catálogo no disponible es
 * `false`: ante la duda NO se reenvía el pedido (reenviar sin la conexión repetiría el gate).
 */
export async function conexionEstablecida(service: string): Promise<boolean> {
  try {
    const res = await listarCatalogo();
    if (res.status !== 'ok') return false;
    return res.servicios.some((s) => s.key === service && s.conectado);
  } catch {
    return false;
  }
}
