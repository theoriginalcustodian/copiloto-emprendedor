import type { DatosCliente } from '../api/clientes';
import type { ContextoTranscripcion } from '../api/transcribir';
import type { ChatRequest, KindDictado, ReplyCard, ReplyResponse } from '../api/types';
import { leerClientePropuesto } from './clientePropuesto';
import { leerGastoPropuesto, type GastoPropuesto } from './gastoPropuesto';
import { leerIngresoPropuesto, type IngresoPropuesto } from './ingresoPropuesto';
import { leerPresupuestoPropuesto, type PresupuestoPropuesto } from './presupuestoPropuesto';

/**
 * `dictarPorChat` — el dictado que nace en una FUNCIÓN (Gastos/Ingresos/Presupuestos/Clientes) viaja a
 * `/chat` con un hint de destino y vuelve como la MISMA `*_propuesto` que ya sabe armar el motor
 * (`contrato_planificacion-a-backend-y-frontend1_el-dictado-desde-una-funcion-va-por-el-chat`, opción
 * (b)). Hasta ahora la pantalla precargaba la transcripción CRUDA en un solo campo; el prototipo muestra
 * la card con monto/categoría/proveedor ya extraídos, y esa extracción sólo existe del lado del chat.
 *
 * 🔴 **Una sola definición de la extracción.** Esto NO extrae nada: manda el texto y lee la card que el
 * backend devuelve. Cualquier heurística de «sacar el monto del texto» acá sería la segunda copia del
 * defecto (ver `memoria/el-mismo-defecto-vivia-dos-veces…`).
 *
 * 🔴 **Sesión aparte, derivada en UN solo lugar (`sessionIdDictado`).** El backend sirve las replies por
 * `(cliente_id, session_id)`; si el dictado viajara con la sesión del hilo, la card caería en el mismo
 * log que lee el chat con su cursor y aparecería en la conversación — el efecto que el DoD prohíbe. Ver
 * el `dato_frontend1-a-planificacion-y-backend_dictado-por-chat…`. Si backend prefiere otra forma, se
 * cambia esta función y nada más.
 *
 * 🔴 **La respuesta nueva se distingue por un cursor de BASE leído antes de enviar.** Sin él, una card
 * vieja del mismo log se leería como la respuesta del dictado de ahora. Límite conocido: una reply TARDÍA
 * de un dictado anterior que ya cayó a `timeout` puede llegar después de la base y leerse como propia —
 * la reply no trae un id de correlación. La pantalla serializa los dictados (no hay dos en vuelo), y la
 * card se REVISA antes de guardar (HITL), así que el costo de la colisión es una card equivocada que el
 * humano ve, no un dato guardado.
 *
 * 🔴 **Nunca lanza.** Todo fallo vuelve como `sin_propuesta` con su `motivo`, para que la pantalla caiga
 * al comportamiento de antes (precarga cruda) y LO DIGA — un degradado silencioso hacia el caso benigno
 * es exactamente lo que envenena la medición.
 */

/**
 * 🚩 Flag (default APAGADO). Mientras backend no confirme su mitad (`kind = "dictado:<destino>"` resuelve
 * la tool del destino, test de los 4 destinos + rechazo de uno fuera de lista), mergear el cliente no
 * debe cambiar lo que ve el usuario. Propietario: frontend-1. Cleanup: se borra el flag (y queda el
 * camino nuevo) cuando backend publique su `cierre_` — o se retira todo si planificación cambia el
 * mecanismo.
 */
export const DICTADO_POR_CHAT_ACTIVO = false;

export type DestinoDictado = ContextoTranscripcion;

export function kindDictado(destino: DestinoDictado): KindDictado {
  return `dictado:${destino}`;
}

/** Sesión del dictado de funciones, aparte de la del hilo. UN solo lugar donde se deriva. */
export function sessionIdDictado(sessionIdHilo: string): string {
  return `${sessionIdHilo}:dictado`;
}

export type PropuestaDictado =
  | { destino: 'gasto'; propuesta: GastoPropuesto }
  | { destino: 'ingreso'; propuesta: IngresoPropuesto }
  | { destino: 'presupuesto'; propuesta: PresupuestoPropuesto }
  | { destino: 'cliente'; propuesta: DatosCliente };

export type MotivoSinPropuesta =
  /** No se pudo ni enviar (red, 401, 5xx). */
  | 'error_envio'
  /** El backend contestó, pero sin la card del destino (p. ej. una pregunta). `texto` trae lo que dijo. */
  | 'respuesta_sin_card'
  /** No llegó ninguna reply dentro del plazo. */
  | 'timeout';

export type ResultadoDictado =
  | { status: 'ok'; resultado: PropuestaDictado; siguienteId: number }
  | { status: 'sin_propuesta'; motivo: MotivoSinPropuesta; texto?: string; siguienteId: number };

export interface PuertosDictado {
  enviar(req: ChatRequest): Promise<unknown>;
  leer(sessionId: string, afterId: number): Promise<ReplyResponse>;
  /** Inyectable para que los tests no esperen de verdad. Default: `setTimeout`. */
  esperar?(ms: number): Promise<void>;
}

export interface PedidoDictado {
  destino: DestinoDictado;
  texto: string;
  /** Ya derivada con `sessionIdDictado`. */
  sessionId: string;
  /** Cursor persistido de esta sesión (0 la primera vez). */
  desde: number;
  timeoutMs?: number;
  intervaloMs?: number;
}

const TIMEOUT_MS = 20_000;
const INTERVALO_MS = 1_000;

/**
 * `Record<ContextoTranscripcion, …>`: si la whitelist de `/transcribir` suma un destino y nadie escribe
 * su lector, esto deja de compilar — no hay forma de tener un destino «aceptado» sin parser.
 */
const LECTORES: { [D in DestinoDictado]: (card: ReplyCard | undefined) => Extract<PropuestaDictado, { destino: D }>['propuesta'] | null } = {
  gasto: leerGastoPropuesto,
  ingreso: leerIngresoPropuesto,
  presupuesto: leerPresupuestoPropuesto,
  cliente: leerClientePropuesto,
};

function esperarReal(ms: number): Promise<void> {
  return new Promise<void>((resolver) => {
    setTimeout(() => resolver(), ms);
  });
}

function leerCard(destino: DestinoDictado, card: ReplyCard | undefined): PropuestaDictado | null {
  // El `switch` (y no `LECTORES[destino](card)`) es para que TS estreche el par destino↔propuesta.
  switch (destino) {
    case 'gasto': {
      const p = LECTORES.gasto(card);
      return p !== null ? { destino, propuesta: p } : null;
    }
    case 'ingreso': {
      const p = LECTORES.ingreso(card);
      return p !== null ? { destino, propuesta: p } : null;
    }
    case 'presupuesto': {
      const p = LECTORES.presupuesto(card);
      return p !== null ? { destino, propuesta: p } : null;
    }
    case 'cliente': {
      const p = LECTORES.cliente(card);
      return p !== null ? { destino, propuesta: p } : null;
    }
  }
}

export async function dictarPorChat(pedido: PedidoDictado, puertos: PuertosDictado): Promise<ResultadoDictado> {
  const { destino, texto, sessionId } = pedido;
  const esperar = puertos.esperar ?? esperarReal;
  const timeoutMs = pedido.timeoutMs ?? TIMEOUT_MS;
  const intervaloMs = pedido.intervaloMs ?? INTERVALO_MS;

  // Base: lo que ya había en el log ANTES de este dictado. Si no se puede leer, no se envía: sin base no
  // hay forma de distinguir la respuesta nueva de una vieja.
  let cursor = pedido.desde;
  try {
    cursor = (await puertos.leer(sessionId, pedido.desde)).next_id;
  } catch {
    return { status: 'sin_propuesta', motivo: 'error_envio', siguienteId: pedido.desde };
  }

  try {
    await puertos.enviar({ session_id: sessionId, text: texto, kind: kindDictado(destino) });
  } catch {
    return { status: 'sin_propuesta', motivo: 'error_envio', siguienteId: cursor };
  }

  let transcurrido = 0;
  while (transcurrido < timeoutMs) {
    await esperar(intervaloMs);
    transcurrido += intervaloMs;
    let respuesta: ReplyResponse;
    try {
      respuesta = await puertos.leer(sessionId, cursor);
    } catch {
      continue; // transitorio: el próximo tick reintenta, hasta el plazo.
    }
    cursor = respuesta.next_id;
    let ultimoTexto: string | undefined;
    for (const reply of respuesta.replies) {
      const encontrada = leerCard(destino, reply.card);
      if (encontrada !== null) return { status: 'ok', resultado: encontrada, siguienteId: cursor };
      if (reply.text.trim() !== '') ultimoTexto = reply.text;
    }
    if (respuesta.replies.length > 0) {
      return { status: 'sin_propuesta', motivo: 'respuesta_sin_card', texto: ultimoTexto, siguienteId: cursor };
    }
  }
  return { status: 'sin_propuesta', motivo: 'timeout', siguienteId: cursor };
}
