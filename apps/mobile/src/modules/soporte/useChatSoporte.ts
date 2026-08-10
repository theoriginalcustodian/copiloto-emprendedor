import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import {
  apiReal as api,
  hidratarEstado,
  motivoDeError,
  reducirChat,
  sendSoporteChat,
  type ChatMessage,
  type ChatMessageKind,
  type EstadoChat,
} from '@copiloto/core';

import { almacenClave } from '../../adapters/almacen';
import { generarId } from '../../util/id';

/**
 * Hook de EFECTOS del chat de SOPORTE (SOP5) — hermano de `modules/chat/useChat.ts`, mismo patrón:
 * corre sobre la MISMA máquina pura (`reducirChat`/`hidratarEstado` de `@copiloto/core`), y acá sólo
 * vive lo que el core no puede saber (red, timers, `AlmacenClave`, generación de ids). La máquina es
 * agnóstica de dominio (no sabe de gastos/facturas/soporte), así que no hace falta bifurcarla — sólo
 * el TRANSPORTE cambia: `sendSoporteChat` en vez de `sendChat`, `POST /soporte/chat` en vez de
 * `/chat`. `GET /reply` es el MISMO endpoint que ya usa el chat de negocio (contrato SOP5: sin
 * cambios), así que se reusa `getReply` tal cual.
 *
 * Deliberadamente SIN `enviarAudio`/`enviarFoto`: el contrato SOP5 declara la voz fuera de alcance
 * de v1 ("si al probarlo resulta que se necesita, es un hito aparte, no un agregado silencioso").
 *
 * Claves de storage y `session_id` **separados** de los del chat de negocio (nunca comparten
 * prefijo) — dos conversaciones del mismo usuario que compartieran `session_id` harían que
 * `GET /reply` mezcle las respuestas de un dominio en el chat del otro (ver el "Control negativo
 * obligatorio" del contrato SOP5). Prefijo `sop:` en el `session_id` que viaja al servidor, como
 * pide el contrato — es convención, no el control de aislamiento real (ese es `cliente_id`).
 */
const PREFIJO_SESSION = 'copiloto-soporte-session-id';
const PREFIJO_MENSAJES = 'copiloto-soporte-msgs';
const POLL_INTERVAL_MS = 1500;
const POLL_INTERVAL_LENTO_MS = 10_000;
const WAIT_TIMEOUT_MS = 60_000;

function claveSession(clienteId: string): string {
  return `${PREFIJO_SESSION}:${clienteId}`;
}

function claveMensajes(clienteId: string, sessionId: string): string {
  return `${PREFIJO_MENSAJES}:${clienteId}:${sessionId}`;
}

/** Lee (o crea) el `session_id` de SOPORTE para este `clienteId` — con el prefijo `sop:` que pide
 * el contrato. Best-effort: si `AlmacenClave` falla, degrada a una sesión nueva en memoria. */
export async function leerOCrearSessionIdSoporte(clienteId: string): Promise<string> {
  if (clienteId === '') return `sop:${generarId()}`;
  try {
    const clave = claveSession(clienteId);
    const existente = await almacenClave.leer(clave);
    if (existente) return existente;
    const creado = `sop:${generarId()}`;
    await almacenClave.guardar(clave, creado);
    return creado;
  } catch {
    return `sop:${generarId()}`;
  }
}

async function leerMensajesPersistidos(clienteId: string, sessionId: string): Promise<ChatMessage[]> {
  try {
    const raw = await almacenClave.leer(claveMensajes(clienteId, sessionId));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ChatMessage[]) : [];
  } catch {
    return [];
  }
}

function persistirMensajes(clienteId: string, sessionId: string, messages: ChatMessage[]): void {
  if (clienteId === '') return;
  void almacenClave.guardar(claveMensajes(clienteId, sessionId), JSON.stringify(messages));
}

export interface SendOptionsSoporte {
  kind?: ChatMessageKind;
}

export interface UseChatSoporteResult {
  /** `null` mientras la sesión/historial todavía no terminaron de hidratarse desde `AlmacenClave`. */
  estado: EstadoChat | null;
  send: (text: string, opts?: SendOptionsSoporte) => Promise<void>;
}

/** `clienteId` — `MeResponse.cliente_id` del tenant autenticado, mismo criterio de scoping que
 * `useChat` de negocio: aísla DÓNDE se persiste, no decide nada del lado del servidor. */
export function useChatSoporte(clienteId: string): UseChatSoporteResult {
  const [estado, setEstado] = useState<EstadoChat | null>(null);
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
      const base = estadoRef.current ?? actual;
      const next = reducirChat(base, {
        tipo: 'respuestas_recibidas',
        replies: response.replies,
        nextId: response.next_id,
      });
      if (next.messages.length > base.messages.length) {
        detenerPolling();
      }
      persistirMensajes(clienteId, next.sessionId, next.messages);
      actualizarEstado(next);
    } catch {
      // Error transitorio: el intervalo sigue reintentando — mismo criterio que el chat de negocio.
    } finally {
      pollingRef.current = false;
    }
  }, [actualizarEstado, detenerPolling, clienteId]);

  useEffect(() => {
    void (async () => {
      const sessionId = await leerOCrearSessionIdSoporte(clienteId);
      const persistidos = await leerMensajesPersistidos(clienteId, sessionId);
      if (!montadoRef.current) return;
      actualizarEstado(hidratarEstado(sessionId, persistidos));
      void poll();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `poll` se omite a propósito, mismo
    // criterio documentado en `modules/chat/useChat.ts`.
  }, [clienteId]);

  const iniciarEsperaDeRespuesta = useCallback(() => {
    pollTimerRef.current = setInterval(() => {
      void poll();
    }, POLL_INTERVAL_MS);

    waitTimeoutRef.current = setTimeout(() => {
      const actual = estadoRef.current;
      if (actual) actualizarEstado(reducirChat(actual, { tipo: 'tiempo_agotado' }));

      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      pollTimerRef.current = setInterval(() => {
        void poll();
      }, POLL_INTERVAL_LENTO_MS);
    }, WAIT_TIMEOUT_MS);

    void poll();
  }, [poll, actualizarEstado]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (siguiente) => {
      if (siguiente !== 'active') return;
      const actual = estadoRef.current;
      if (actual && (actual.sendStatus === 'waiting' || actual.sendStatus === 'timeout')) void poll();
    });
    return () => sub.remove();
  }, [poll]);

  const send = useCallback(
    async (text: string, opts?: SendOptionsSoporte) => {
      const trimmed = text.trim();
      const actual = estadoRef.current;
      if (!trimmed || !actual) return;

      detenerPolling();

      const mensajeUsuario: ChatMessage = { id: `user-${generarId()}`, role: 'user', text: trimmed };
      let siguiente = reducirChat(actual, { tipo: 'mensaje_usuario_agregado', mensaje: mensajeUsuario });
      siguiente = reducirChat(siguiente, { tipo: 'envio_iniciado' });
      persistirMensajes(clienteId, siguiente.sessionId, siguiente.messages);
      actualizarEstado(siguiente);

      try {
        await sendSoporteChat({
          session_id: siguiente.sessionId,
          text: trimmed,
          kind: opts?.kind ?? 'text',
        });
      } catch (e) {
        const conError = estadoRef.current ?? siguiente;
        actualizarEstado(reducirChat(conError, { tipo: 'envio_fallo', motivo: motivoDeError(e) }));
        return;
      }

      const enviado = estadoRef.current ?? siguiente;
      actualizarEstado(reducirChat(enviado, { tipo: 'envio_ok' }));
      iniciarEsperaDeRespuesta();
    },
    [detenerPolling, actualizarEstado, iniciarEsperaDeRespuesta, clienteId],
  );

  return { estado, send };
}
