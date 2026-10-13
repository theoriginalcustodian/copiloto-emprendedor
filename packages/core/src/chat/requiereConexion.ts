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
  alcance: AlcanceItem[];
  /**
   * Lo que el usuario estaba pidiendo cuando se activó el gate («cuánto entró esta semana»): es del TURNO,
   * no del servicio, por eso viaja en la card y no en el catálogo. `null` = el backend no lo resumió (o es
   * previo al campo): la hoja se ve exactamente como antes.
   */
  pendiente: string | null;
  connectPath: string;
}

/**
 * El límite de cada permiso del `alcance`. Enum CERRADO del contrato (agregar un valor exige enmendarlo):
 * el backend manda semántica y la APP pinta la etiqueta. Un valor que esta versión no conoce llega como
 * `ninguna` — sin insignia, nunca un error.
 */
export const CONDICIONES_ALCANCE = ['solo_lectura', 'requiere_ok', 'ninguna'] as const;
export type CondicionAlcance = (typeof CONDICIONES_ALCANCE)[number];

export interface AlcanceItem {
  texto: string;
  condicion: CondicionAlcance;
}

const ETIQUETA_CONDICION: Record<CondicionAlcance, string | null> = {
  solo_lectura: 'Solo lectura',
  requiere_ok: 'Nunca sin tu OK',
  ninguna: null,
};

/** La insignia del permiso (`Solo lectura`, `Nunca sin tu OK`), o `null` si no lleva ninguna. */
export function etiquetaCondicion(condicion: CondicionAlcance): string | null {
  return ETIQUETA_CONDICION[condicion];
}

function texto(v: unknown): string | null {
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : null;
}

function condicionDe(v: unknown): CondicionAlcance {
  return (CONDICIONES_ALCANCE as readonly unknown[]).includes(v) ? (v as CondicionAlcance) : 'ninguna';
}

/**
 * Un ítem del `alcance` en CUALQUIERA de sus dos formas: el `string` plano (lo que emite producción hoy) o
 * el objeto `{texto, condicion}` del contrato nuevo. Leer sólo una dejaría la hoja de consentimiento sin
 * filas y SIN error en cuanto el backend cambie — o antes, si la app sale primero.
 */
function itemDeAlcance(v: unknown): AlcanceItem | null {
  const plano = texto(v);
  if (plano != null) return { texto: plano, condicion: 'ninguna' };
  if (typeof v !== 'object' || v === null) return null;
  const r = v as Record<string, unknown>;
  const t = texto(r.texto);
  return t == null ? null : { texto: t, condicion: condicionDe(r.condicion) };
}

/** `pendiente: {texto}` → el texto, o `null` si falta o viene sin texto (opcional por diseño). */
function pendienteDe(v: unknown): string | null {
  if (typeof v !== 'object' || v === null) return null;
  return texto((v as Record<string, unknown>).texto);
}

/** La card leída, o `null` si no es un `requiere_conexion` completo. */
export function leerRequiereConexion(card: ReplyCard | null | undefined): RequiereConexion | null {
  if (card?.kind !== 'requiere_conexion') return null;
  const raw = card as Record<string, unknown>;
  const service = texto(raw.service);
  const connectPath = texto(raw.connect_path);
  if (service == null || connectPath == null) return null;
  const alcance = Array.isArray(raw.alcance) ? raw.alcance.map(itemDeAlcance).filter((a): a is AlcanceItem => a != null) : [];
  return { service, label: texto(raw.label) ?? service, alcance, pendiente: pendienteDe(raw.pendiente), connectPath };
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
