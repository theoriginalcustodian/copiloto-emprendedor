/**
 * La máquina del chat. **Reducer puro: cero DOM, cero React, cero I/O.**
 *
 * Es la lógica que en el proyecto de origen vivía enredada con `localStorage`, `fetch` y los hooks de
 * React en el hook de chat de la web: qué mensaje se agrega y cuándo, qué cursor de polling usar, qué
 * respuestas ya se vieron (dedup), y qué transición de `sendStatus` corresponde a cada paso del ciclo
 * de envío — incluido cuál de esas respuestas dispara el gate de confirmación de negocio (ver
 * `hitl.ts`). Si esto se reescribiera en React Native quedaría escrito dos veces, y las dos versiones
 * divergirían justo en la parte que decide cuándo el usuario ve ese gate antes de que algo se escriba
 * en el registro. Acá las dos apps corren la MISMA máquina.
 *
 * Lo que se queda AFUERA a propósito — son efectos, no lógica — y lo resuelve el hook de cada
 * plataforma:
 *  - `fetch` (`sendChat` / `getReply` / `sendAudio` / `warm`) — I/O de red.
 *  - El `setInterval` del polling y el `setTimeout` de `WAIT_TIMEOUT_MS` — el reducer no sabe qué es
 *    un timer: sólo transiciona cuando alguien le manda el evento `tiempo_agotado`.
 *  - `localStorage` / `AsyncStorage` — detrás del puerto `AlmacenClave` (`ports.ts`), que tampoco
 *    conoce este reducer: es el hook de efectos el que lee/guarda y siembra el estado con
 *    `hidratarEstado`.
 *  - La generación de ids (`crypto.randomUUID`) y de `session_id` nuevos — el caller los genera y se
 *    los pasa ya resueltos (un reducer puro no tiene fuente de aleatoriedad propia).
 *  - El throttle de "warmear la memoria" (`warmMemory` en el hook original) — es un side-effect de
 *    perceived-latency contra Graphity, no una transición de estado del chat.
 */

import type { ChatContenido, ReplyCard, ReplyChoice, ReplyMessage } from '../api/types';

export type ChatRole = 'user' | 'assistant';

export interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
  choices?: ReplyChoice[];
  /** Metadata de presentación del reply (GATE 2 de negocio o artefacto terminal/launch-card) — la
   * consume `hitl.ts` (`kind==='confirm'`) o la vista de artefacto de cada plataforma
   * (`kind==='clinical_saved'` / `'start_recording'` / `'start_upload'`). */
  card?: ReplyCard;
}

export type SendStatus = 'idle' | 'sending' | 'waiting' | 'timeout' | 'error';

/**
 * Por qué falló el envío. **No es telemetría: decide qué se le dice al usuario.**
 *
 * 🔴 Nació de un incidente real en el proyecto de origen. El chat mostraba *"No pudimos enviar tu
 * mensaje"* para **todo** fallo, y el operador pasó 40 minutos convencido de que el audio estaba
 * roto — el audio estaba perfecto, lo que fallaba era un workflow del backend. El mensaje único no es
 * una simplificación inocente: **manda a diagnosticar lo que no es**. Y en dos de los casos de abajo
 * es directamente falso, porque el mensaje SÍ se envió.
 *
 * Cada valor existe porque **el usuario haría algo distinto** al leerlo. Si un motivo nuevo no cambia
 * lo que él haría, no merece un valor propio.
 */
export type MotivoFallo =
  /** No se pudo llegar al servidor (sin red, DNS, TLS, timeout de conexión). Reintentar sirve. */
  | 'red'
  /** 🔴 El envío SALIÓ BIEN y el STT no entendió nada (HTTP 422). Decirle "no se pudo enviar" acá es
   *  mentira: lo que tiene que repetir es el audio, no la conexión. */
  | 'audio_no_entendido'
  /** El audio excede el máximo del servidor (HTTP 413). Reintentar igual no sirve: hay que grabar más corto. */
  | 'audio_muy_grande'
  /** La sesión venció (HTTP 401). Reintentar no sirve; hay que volver a entrar. */
  | 'sesion_vencida'
  /** El servidor falló (5xx) o devolvió algo que no sabemos leer. Reintentar puede servir. */
  | 'servidor'
  /** 🔴 500 con `diferido:true` (ítem 2.5 del DLQ): el trauma YA quedó depositado y el sistema lo
   *  reintenta solo. Distinto de `'servidor'` porque acá reintentar a mano no ayuda — **duplica** un
   *  efecto que ya va a correr de nuevo (un cobro, un gasto). El texto se lo dice explícitamente. */
  | 'servidor_diferido';

export interface EstadoChat {
  sessionId: string;
  messages: ChatMessage[];
  sendStatus: SendStatus;
  /** Cursor de polling: el `after_id` a mandar en el próximo `GET /reply` — el mayor `next_id` que
   * el servidor ya devolvió. */
  nextId: number;
  /** IDs de `reply` (numéricos) ya vistos — dedupe DEFENSIVO además del cursor `nextId` (ver
   * `respuestas_recibidas`: una carrera de polling, o un `after_id` viejo tras rehidratar, no
   * duplica mensajes). */
  seenIds: readonly number[];
  /**
   * Por qué falló el último envío, o `null` si el último no falló.
   *
   * Se limpia al arrancar cada envío nuevo: un motivo viejo sobreviviendo a un envío exitoso haría
   * que la pantalla explique un fallo que ya no existe.
   */
  motivoFallo: MotivoFallo | null;
}

export type EventoChat =
  /** Un mensaje de usuario que ya se sabe mostrar — optimista (`send`, ANTES de que la red
   * responda) o con el transcript ya resuelto (`sendAudio`, DESPUÉS del STT). No toca `sendStatus`:
   * el caller manda ese evento aparte (`envio_iniciado`), en el orden que corresponda a cada flujo. */
  | { tipo: 'mensaje_usuario_agregado'; mensaje: ChatMessage }
  /** Arranca el ciclo de envío. */
  | { tipo: 'envio_iniciado' }
  /** El POST se aceptó — el caller arranca el polling (efecto) y el reducer pasa a `waiting`. */
  | { tipo: 'envio_ok' }
  /**
   * El POST (o el STT de `sendAudio`) falló. El `motivo` decide QUÉ SE LE DICE al usuario — ver
   * `MotivoFallo`. Ausente = `'servidor'`, la degradación honesta: no sabemos por qué falló y no
   * inventamos una causa que mandaría a revisar lo que no es.
   */
  | { tipo: 'envio_fallo'; motivo?: MotivoFallo }
  /** Una tanda de `GET /reply`. `nextId` avanza SIEMPRE (incluso sin novedades); los `replies` que
   * el reducer ya vio (por `seenIds`) se descartan en silencio. */
  | { tipo: 'respuestas_recibidas'; replies: ReplyMessage[]; nextId: number }
  /** Venció `WAIT_TIMEOUT_MS` sin respuesta. */
  | { tipo: 'tiempo_agotado' }
  /** Arranca una conversación nueva: el caller ya generó el `session_id` y ya limpió la
   * persistencia vieja (efectos) — acá sólo se resetea el estado en memoria. */
  | { tipo: 'nueva_sesion'; sessionId: string };

/** IDs de `reply` (numéricos) derivados del formato `assistant-<id>` con el que `respuestas_recibidas`
 * arma el `id` del `ChatMessage` de abajo — es el único lugar que conoce ese formato. */
function parseAssistantReplyId(messageId: string): number | null {
  const match = /^assistant-(\d+)$/.exec(messageId);
  return match ? Number(match[1]) : null;
}

function collectSeenReplyIds(messages: readonly ChatMessage[]): number[] {
  return messages.reduce<number[]>((ids, message) => {
    const parsed = parseAssistantReplyId(message.id);
    if (parsed !== null) ids.push(parsed);
    return ids;
  }, []);
}

/**
 * Arranca (o rehidrata) el estado de una sesión. El cursor (`nextId`) y el set de dedupe (`seenIds`)
 * se DERIVAN de los mensajes persistidos que pase el caller — no se resetean a 0 salvo que no haya
 * historial. Es lo que hace que reabrir el chat rehidrate sin perder mensajes NI repetir en pantalla
 * la primera respuesta que ya estaba ahí cuando el hook de efectos dispare su primer poll con este
 * `nextId` como `after_id`.
 */
export function hidratarEstado(
  sessionId: string,
  mensajesPersistidos: readonly ChatMessage[] = [],
): EstadoChat {
  const seenIds = collectSeenReplyIds(mensajesPersistidos);
  return {
    sessionId,
    messages: [...mensajesPersistidos],
    sendStatus: 'idle',
    nextId: seenIds.reduce((max, id) => Math.max(max, id), 0),
    seenIds,
    motivoFallo: null,
  };
}

/**
 * Mapea las 2 fuentes de un turno a los 2 carriles del contrato, que son **hermanos de primer
 * nivel**, no anidados: GATE 2 (`payload`, ej. `{markdown}`, el confirm del informe editable) y
 * GATE 1 (`contenido`, el texto de negocio FIRMADO por el usuario).
 *
 * **Por qué existe esta función y no se arma el request inline.** El front-door lee `msg.contenido`
 * de la RAÍZ del body y lo mueve a `context.contenido` — el único lugar de donde el executor lo lee.
 * Un `contenido` anidado adentro de `payload` le llega al backend como `None`, y el síntoma no es un
 * error: el executor no encuentra la entrada firmada y le vuelve a abrir el panel de grabación al
 * usuario, en loop, sin que nada falle a la vista. Un solo lugar arma los dos carriles, y un test
 * pin-ea el invariante.
 */
export function construirEnvioClinico(opts?: {
  payload?: Record<string, unknown> | null;
  contenido?: ChatContenido | null;
}): { payload: Record<string, unknown> | null; contenido: ChatContenido | null } {
  return {
    payload: opts?.payload ?? null,
    contenido: opts?.contenido ?? null,
  };
}

export function reducirChat(estado: EstadoChat, evento: EventoChat): EstadoChat {
  switch (evento.tipo) {
    case 'nueva_sesion':
      // Rotar el session_id estrena hilo en el backend: el historial viejo queda desconectado del
      // hilo que responde. El caller es quien ya limpió la persistencia vieja (efecto); acá sólo se
      // resetea el estado en memoria — mismo criterio que `startNewSession` en el hook original.
      return {
        sessionId: evento.sessionId,
        messages: [],
        sendStatus: 'idle',
        nextId: 0,
        seenIds: [],
        motivoFallo: null,
      };

    case 'mensaje_usuario_agregado':
      return { ...estado, messages: [...estado.messages, evento.mensaje] };

    case 'envio_iniciado':
      // Limpia el motivo del fallo anterior: si sobreviviera, la pantalla explicaría un fallo que ya
      // no existe mientras el envío nuevo está en vuelo.
      return { ...estado, sendStatus: 'sending', motivoFallo: null };

    case 'envio_ok':
      return { ...estado, sendStatus: 'waiting', motivoFallo: null };

    case 'envio_fallo':
      // Sin motivo -> 'servidor'. NUNCA se adivina 'red': mandar a revisar la conexión cuando el
      // problema era otro es exactamente el error que este campo existe para no repetir.
      return { ...estado, sendStatus: 'error', motivoFallo: evento.motivo ?? 'servidor' };

    case 'tiempo_agotado':
      // Sólo degrada 'waiting' -> 'timeout' (mismo guard que el `setSendStatus((current) => ...)`
      // del hook original): si ya llegó la respuesta (idle) o ya arrancó un envío nuevo (sending),
      // un timeout tardío no debe pisar un estado más reciente.
      return estado.sendStatus === 'waiting' ? { ...estado, sendStatus: 'timeout' } : estado;

    case 'respuestas_recibidas': {
      const seen = new Set(estado.seenIds);
      const additions: ChatMessage[] = [];
      for (const reply of evento.replies) {
        if (seen.has(reply.id)) continue; // dedupe defensivo además del cursor next_id
        seen.add(reply.id);
        additions.push({
          id: `assistant-${reply.id}`,
          role: 'assistant',
          text: reply.text,
          choices: reply.choices,
          card: reply.card,
        });
      }
      if (additions.length === 0) {
        // El cursor avanza igual aunque no haya novedades — un poll vacío no es un no-op completo.
        return { ...estado, nextId: evento.nextId };
      }
      return {
        ...estado,
        messages: [...estado.messages, ...additions],
        nextId: evento.nextId,
        seenIds: [...seen],
        sendStatus: 'idle',
      };
    }

    default:
      return estado;
  }
}
