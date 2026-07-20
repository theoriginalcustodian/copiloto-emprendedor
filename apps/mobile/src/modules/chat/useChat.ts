import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import {
  apiReal as api,
  hidratarEstado,
  motivoDeError,
  reducirChat,
  type ChatMessage,
  type ChatMessageKind,
  type EstadoChat,
} from '@copiloto/core';

import { almacenClave } from '../../adapters/almacen';

/**
 * Hook de EFECTOS del chat mobile — fork del `useChat` de DocuMed
 * (`_staging/documed/apps/mobile/src/modules/chat/useChat.ts`), adaptado al copiloto de
 * emprendedores. Corre sobre la MISMA máquina PURA (`reducirChat`/`hidratarEstado`,
 * `@copiloto/core/chat`) en vez de reescribir su lógica acá. Lo que vive en este archivo es SÓLO lo
 * que el core no puede saber:
 *  - Red: `api.sendChat`/`api.getReply` (`apiReal` de `@copiloto/core`, configurado por
 *    `adapters/plataforma.ts`).
 *  - Timers del polling (`POLL_INTERVAL_MS`/`WAIT_TIMEOUT_MS`) — el reducer sólo reacciona al
 *    evento `tiempo_agotado`; arrancar/parar el `setInterval`/`setTimeout` es de acá.
 *  - Persistencia vía `AlmacenClave` (`AsyncStorage`). A diferencia del `localStorage` sincrónico de
 *    `apps/copiloto-web`, ACÁ ES ASYNC — no hay forma de leer sincrónicamente al primer render. Por
 *    eso `estado` arranca en `null` y sólo pasa a `EstadoChat` cuando la hidratación (sessionId +
 *    historial persistido) termina.
 *  - Generación de ids (`crypto.randomUUID` con fallback) — el reducer no tiene fuente de
 *    aleatoriedad propia.
 *
 * 🔴 **Alcance de este port (sprint mobile-first, cáscara glass).** Deliberadamente SIN:
 *  - **Voz-comando** (`enviarAudio`) — vive en `useVozComando.ts`/`GlassGrabacionCopiloto.tsx` en el
 *    origen, ninguno de los dos se portó (fase F6, todavía no le toca). Portar `enviarAudio` sin un
 *    grabador que lo invoque sería código muerto.
 *  - **`cliente_id`/`alcance`/`modo`** — los tres ejes exigen un selector de cliente activo / modo de
 *    negocio que hoy no existe en NINGÚN shell del copiloto, ni siquiera en
 *    `apps/copiloto-web/src/modules/chat/useChat.ts` (la versión YA EN PRODUCCIÓN — verificado leyendo
 *    ese archivo antes de portar: su `SendOptions` tampoco los manda). Inventar acá un valor
 *    "razonable" sería exactamente *codificar la esperanza*: se agregan cuando el selector exista, con
 *    su propio spike, no antes.
 *
 * Si acá aparece un `if` que decida QUÉ mensaje agregar, qué dispara qué gate, o si un id ya se vio —
 * está mal ubicado: eso es responsabilidad de `reducirChat` (`@copiloto/core`), no de este hook.
 */

/** MISMAS keys que `apps/copiloto-web/src/modules/chat/useChat.ts` (`SESSION_STORAGE_KEY`/
 * `MESSAGES_STORAGE_PREFIX`) — mismo criterio que `almacenTokens` en `adapters/almacen.ts` ("un
 * usuario que ya tenía sesión en la web no la pierde"). AsyncStorage nativo y el `localStorage` de un
 * origin web están físicamente aislados, así que no hay riesgo real de colisión — es sólo
 * consistencia de nombres entre plataformas del mismo producto. */
const CLAVE_SESSION = 'copiloto-chat-session-id';
const PREFIJO_MENSAJES = 'copiloto-chat-msgs';
const POLL_INTERVAL_MS = 1500;
/** Ritmo tras el timeout: se sigue preguntando, pero sin quemar una request cada 1.5s durante media
 *  hora. Esperar 20 minutos cuesta 120 requests en vez de 800. */
const POLL_INTERVAL_LENTO_MS = 10_000;
/** Cuánto esperar por una respuesta antes de avisar que está tardando (agente durable = lento). */
const WAIT_TIMEOUT_MS = 60_000;

function generarId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback para entornos sin Web Crypto.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function claveMensajes(sessionId: string): string {
  return `${PREFIJO_MENSAJES}:${sessionId}`;
}

/** Lee (o crea) el `session_id` activo. Best-effort: si `AlmacenClave` falla, degrada a una sesión
 * nueva en memoria — perder la persistencia no puede romper el chat. */
export async function leerOCrearSessionId(): Promise<string> {
  try {
    const existente = await almacenClave.leer(CLAVE_SESSION);
    if (existente) return existente;
    const creado = generarId();
    await almacenClave.guardar(CLAVE_SESSION, creado);
    return creado;
  } catch {
    return generarId();
  }
}

/** Rehidrata el historial de esta sesión — best-effort: cualquier problema (storage caído, JSON
 * corrupto) degrada a "sin historial", nunca rompe el mount. */
async function leerMensajesPersistidos(sessionId: string): Promise<ChatMessage[]> {
  try {
    const raw = await almacenClave.leer(claveMensajes(sessionId));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ChatMessage[]) : [];
  } catch {
    return [];
  }
}

function persistirMensajes(sessionId: string, messages: ChatMessage[]): void {
  void almacenClave.guardar(claveMensajes(sessionId), JSON.stringify(messages));
}

export interface SendOptions {
  kind?: ChatMessageKind;
  /** El confirm/cancel del gate de confirmación genérico (ver `mapearGate`, `@copiloto/core/chat`) —
   * viaja tal cual a `ChatRequest.payload`. `null`/ausente en cualquier otro turno. */
  payload?: Record<string, unknown> | null;
}

export interface UseChatResult {
  /** `null` mientras la sesión/historial todavía no terminaron de hidratarse desde `AlmacenClave`
   * (async — ver docstring del módulo). La vista deshabilita el composer mientras tanto. */
  estado: EstadoChat | null;
  send: (text: string, opts?: SendOptions) => Promise<void>;
}

export function useChat(): UseChatResult {
  const [estado, setEstado] = useState<EstadoChat | null>(null);
  // Espejo síncrono de `estado` para que los callbacks de polling/envío (estables vía `useCallback`)
  // siempre lean el valor más reciente sin encadenar todo a las dependencias de React.
  const estadoRef = useRef<EstadoChat | null>(null);
  const montadoRef = useRef(true);

  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const waitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollingRef = useRef(false);

  const actualizarEstado = useCallback((next: EstadoChat) => {
    estadoRef.current = next;
    if (montadoRef.current) setEstado(next);
  }, []);

  const detenerPolling = useCallback(() => {
    if (pollTimerRef.current !== null) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    if (waitTimeoutRef.current !== null) {
      clearTimeout(waitTimeoutRef.current);
      waitTimeoutRef.current = null;
    }
  }, []);

  // Cleanup al desmontar — nunca dejar timers corriendo contra un componente ya fuera de pantalla.
  useEffect(() => {
    montadoRef.current = true;
    return () => {
      montadoRef.current = false;
      detenerPolling();
    };
  }, [detenerPolling]);

  const poll = useCallback(async () => {
    const actual = estadoRef.current;
    if (!actual || pollingRef.current) return;
    pollingRef.current = true;
    try {
      const response = await api.getReply(actual.sessionId, actual.nextId);
      // Se RELEE el estado después del `await` en vez de reusar la foto de antes: entre la request y
      // su respuesta pueden haber pasado cosas (un timeout marcando `timeout`, un envío nuevo
      // marcando `sending`) — derivar de la foto vieja las pisaría.
      const base = estadoRef.current ?? actual;
      const next = reducirChat(base, {
        tipo: 'respuestas_recibidas',
        replies: response.replies,
        nextId: response.next_id,
      });
      // Sólo si `reducirChat` efectivamente agregó mensajes nuevos (el dedup/cursor del reducer ya
      // descartó lo repetido) dejamos de pollear.
      if (next.messages.length > base.messages.length) {
        detenerPolling();
      }
      persistirMensajes(next.sessionId, next.messages);
      actualizarEstado(next);
    } catch {
      // Error transitorio de red/servidor: el intervalo sigue reintentando. No hay un momento en que
      // se deje de reintentar: tras el timeout el ritmo baja, pero nunca se abandona.
    } finally {
      pollingRef.current = false;
    }
  }, [actualizarEstado, detenerPolling]);

  // Hidratación inicial: resuelve sessionId + historial persistido (ASYNC — AsyncStorage), siembra
  // el reducer con `hidratarEstado`, y dispara UN poll para traer cualquier respuesta que haya
  // llegado mientras la app estaba cerrada (durabilidad real: la app en background no pierde
  // respuestas que ya llegaron server-side).
  useEffect(() => {
    void (async () => {
      const sessionId = await leerOCrearSessionId();
      const persistidos = await leerMensajesPersistidos(sessionId);
      if (!montadoRef.current) return;
      actualizarEstado(hidratarEstado(sessionId, persistidos));
      void poll();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sólo debe correr una vez al montar.
  }, []);

  const iniciarEsperaDeRespuesta = useCallback(() => {
    pollTimerRef.current = setInterval(() => {
      void poll();
    }, POLL_INTERVAL_MS);

    // 🔴 A los 60s NO se abandona: se BAJA EL RITMO. El backend ES durable (Temporal, ver
    // `conversacion-permanente-continue-as-new` en la memoria del proyecto) — el único que se podría
    // rendir es el cliente, y un cliente que deja de preguntar pierde una respuesta que ya existe en
    // el servidor. El intervalo lento existe para que esperar 20 minutos no cueste 800 requests.
    waitTimeoutRef.current = setTimeout(() => {
      const actual = estadoRef.current;
      if (actual) actualizarEstado(reducirChat(actual, { tipo: 'tiempo_agotado' }));

      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      pollTimerRef.current = setInterval(() => {
        void poll();
      }, POLL_INTERVAL_LENTO_MS);
    }, WAIT_TIMEOUT_MS);

    void poll(); // primer intento inmediato — no esperar un intervalo completo para el 1er check.
  }, [poll, actualizarEstado]);

  // Al volver a primer plano, preguntar YA. Android congela los timers de una app en background:
  // volver tras 10 minutos significaría esperar hasta un intervalo entero más para ver una respuesta
  // que ya está en el servidor desde hace rato.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (siguiente) => {
      if (siguiente !== 'active') return;
      const actual = estadoRef.current;
      if (actual && (actual.sendStatus === 'waiting' || actual.sendStatus === 'timeout')) void poll();
    });
    return () => sub.remove();
  }, [poll]);

  const send = useCallback(
    async (text: string, opts?: SendOptions) => {
      const trimmed = text.trim();
      const actual = estadoRef.current;
      if (!trimmed || !actual) return;

      detenerPolling();

      const mensajeUsuario: ChatMessage = { id: `user-${generarId()}`, role: 'user', text: trimmed };
      // Dos eventos separados: agregar el mensaje NO toca `sendStatus` — ese cambio es explícito vía
      // `envio_iniciado`, así el mensaje aparece OPTIMISTA (antes de que la red responda).
      let siguiente = reducirChat(actual, { tipo: 'mensaje_usuario_agregado', mensaje: mensajeUsuario });
      siguiente = reducirChat(siguiente, { tipo: 'envio_iniciado' });
      persistirMensajes(siguiente.sessionId, siguiente.messages);
      actualizarEstado(siguiente);

      try {
        await api.sendChat({
          session_id: siguiente.sessionId,
          text: trimmed,
          kind: opts?.kind ?? 'text',
          payload: opts?.payload ?? null,
        });
      } catch (e) {
        const conError = estadoRef.current ?? siguiente;
        // `motivoDeError` distingue sesión vencida (401) de un fallo genérico de servidor/red — un
        // solo mensaje para todo mandaría a diagnosticar lo que no es (ver `motivoFallo.ts`).
        actualizarEstado(reducirChat(conError, { tipo: 'envio_fallo', motivo: motivoDeError(e) }));
        return;
      }

      const enviado = estadoRef.current ?? siguiente;
      actualizarEstado(reducirChat(enviado, { tipo: 'envio_ok' }));
      iniciarEsperaDeRespuesta();
    },
    [detenerPolling, actualizarEstado, iniciarEsperaDeRespuesta],
  );

  return { estado, send };
}
