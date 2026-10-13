import type { DatosCliente } from '../api/clientes';
import type { ContextoTranscripcion } from '../api/transcribir';
import type { ChatRequest, ChatResponse, KindDictado, ReplyCard, ReplyResponse } from '../api/types';
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
 * 🔴 **El `session_id` con el que se pollea es el que DEVUELVE `/chat`, no uno derivado acá.** El
 * front-door namespacea el hilo del dictado (`dictado:<destino>:<sid>`, backend #1050) y ESE id es el que
 * vuelve en la respuesta. Re-derivarlo en el cliente sería la segunda copia de una regla del backend, y
 * la que se desactualiza en silencio. Una respuesta sin `session_id` = backend sin esta capacidad: se
 * degrada (visible), no se adivina.
 *
 * 🔴 **Un id FRESCO por dictado (lo pone quien llama).** El hilo es por (destino, sesión): con un id nuevo
 * cada dictado tiene su propio log y arranca en cursor 0, así que una card vieja —o la reply tardía de un
 * dictado anterior que ya cayó a `timeout`— no se puede confundir con la respuesta de ahora. Sin cursor
 * persistido ni lectura de base. Costo: un workflow por dictado, que el backend termina por idle-timeout.
 *
 * 🔴 **Nunca lanza.** Todo fallo vuelve como `sin_propuesta` con su `motivo`, para que la pantalla caiga
 * al comportamiento de antes (precarga cruda) y LO DIGA — un degradado silencioso hacia el caso benigno
 * es exactamente lo que envenena la medición.
 */

export type DestinoDictado = ContextoTranscripcion;

export function kindDictado(destino: DestinoDictado): KindDictado {
  return `dictado:${destino}`;
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
  | { status: 'ok'; resultado: PropuestaDictado }
  | { status: 'sin_propuesta'; motivo: MotivoSinPropuesta; texto?: string };

export interface PuertosDictado {
  enviar(req: ChatRequest): Promise<ChatResponse>;
  leer(sessionId: string, afterId: number): Promise<ReplyResponse>;
  /** Inyectable para que los tests no esperen de verdad. Default: `setTimeout`. */
  esperar?(ms: number): Promise<void>;
}

export interface PedidoDictado {
  destino: DestinoDictado;
  texto: string;
  /** Id NUEVO por dictado (ver el docstring del módulo). El backend lo namespacea y devuelve el efectivo. */
  sessionId: string;
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

  let sesionEfectiva: string;
  try {
    const res = await puertos.enviar({ session_id: sessionId, text: texto, kind: kindDictado(destino) });
    // `accepted: false` = el workflow no arrancó; sin `session_id` = backend anterior al namespace.
    // En ambos casos no hay hilo que pollear, y adivinarlo sería leer el de otro.
    if (!res.accepted || typeof res.session_id !== 'string' || res.session_id === '') {
      return { status: 'sin_propuesta', motivo: 'error_envio' };
    }
    sesionEfectiva = res.session_id;
  } catch {
    return { status: 'sin_propuesta', motivo: 'error_envio' };
  }

  // Hilo propio y nuevo: se lee desde 0 y todo lo que aparezca es de ESTE dictado.
  let cursor = 0;
  let transcurrido = 0;
  while (transcurrido < timeoutMs) {
    await esperar(intervaloMs);
    transcurrido += intervaloMs;
    let respuesta: ReplyResponse;
    try {
      respuesta = await puertos.leer(sesionEfectiva, cursor);
    } catch {
      continue; // transitorio: el próximo tick reintenta, hasta el plazo.
    }
    cursor = respuesta.next_id;
    let ultimoTexto: string | undefined;
    for (const reply of respuesta.replies) {
      const encontrada = leerCard(destino, reply.card);
      if (encontrada !== null) return { status: 'ok', resultado: encontrada };
      if (reply.text.trim() !== '') ultimoTexto = reply.text;
    }
    if (respuesta.replies.length > 0) {
      return { status: 'sin_propuesta', motivo: 'respuesta_sin_card', texto: ultimoTexto };
    }
  }
  return { status: 'sin_propuesta', motivo: 'timeout' };
}
