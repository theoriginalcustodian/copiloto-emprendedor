import { useCallback, useEffect, useRef, useState } from 'react';

import {
  api,
  sendSoporteChat,
  type ChatMessageKind,
  type FuncionSoporte,
  type ReplyCard,
  type ReplyChoice,
} from '../../lib/api';
import { generarId } from '../../util/id';

/**
 * Hook de lógica del chat de SOPORTE (SOP5) — hermano de `modules/chat/useChat.ts`, MISMO patrón
 * (session_id persistido + polling que absorbe la naturaleza durable del agente), pero NO reusa ese
 * hook ni la máquina de `@copiloto/core`: se midió antes de escribir (`soporteChat.ts` tiene el
 * porqué) — `ReplyCard`/`ReplyChoice` de este barrel ya divergieron de los del core, y forzar el
 * tipo ajeno a través de `MessageList` sería la misma trampa que CTA7 pagó un nivel más abajo.
 *
 * Lo que SÍ se deja afuera a propósito, a diferencia del chat de negocio:
 *  - `mode` (`useMode()`) — es un concepto de negocio ("Modo Mail"), sin sentido en soporte.
 *  - `sendAudio`/`warmMemory` — voz fuera de alcance de SOP5 v1; `warmMemory` precalienta la
 *    memoria de Graphity del EMPRENDEDOR, que el agente de soporte no consulta.
 *
 * Claves de storage y `session_id` separados del chat de negocio Y scoped por `(clienteId, funcion)`
 * (a diferencia del `useChat` de negocio, que usa una clave global) — mismo criterio que mobile
 * adoptó el 2026-07-23 tras un bug real de historial cruzado entre tenants en el mismo device, más
 * `funcion` porque "soporte técnico" y "cómo uso la app" son DOS hilos, no uno.
 *
 * **`funcion` es fija por instancia del hook, no por `send()`** — una conversación entera pertenece
 * a una función; cambiarla a mitad de camino no tiene equivalente semántico del lado del servidor
 * (el `channel_ref` la namespacea). El caller (`SoporteScreen`) la fija antes de montar.
 *
 * **`session_id` migra al valor que devuelve el SERVIDOR** apenas llega la respuesta de `send()` —
 * el body real es `soporte:{funcion}:{session_id}`, no el `sop:<uuid>` local. Sin esta migración el
 * polling siguiente pega contra un `session_id` que el servidor nunca usó: el chat queda MUDO para
 * siempre sin ningún error que lo delate (el fallo silencioso que el propio DoD advierte).
 */
const SESSION_STORAGE_KEY_PREFIX = 'copiloto-soporte-session-id';
const MESSAGES_STORAGE_PREFIX = 'copiloto-soporte-msgs';
const POLL_INTERVAL_MS = 1500;
const WAIT_TIMEOUT_MS = 60_000;

export type ChatRole = 'user' | 'assistant';

export interface ChatMessageSoporte {
  id: string;
  role: ChatRole;
  text: string;
  choices?: ReplyChoice[];
  card?: ReplyCard;
}

export type SendStatusSoporte = 'idle' | 'sending' | 'waiting' | 'timeout' | 'error';

function sessionStorageKey(clienteId: string, funcion: FuncionSoporte): string {
  return `${SESSION_STORAGE_KEY_PREFIX}:${clienteId}:${funcion}`;
}

function messagesStorageKey(clienteId: string, funcion: FuncionSoporte, sessionId: string): string {
  return `${MESSAGES_STORAGE_PREFIX}:${clienteId}:${funcion}:${sessionId}`;
}

function readOrCreateSessionId(clienteId: string, funcion: FuncionSoporte): string {
  if (typeof window === 'undefined' || clienteId === '') return `sop:${generarId()}`;
  try {
    const key = sessionStorageKey(clienteId, funcion);
    const existing = window.localStorage.getItem(key);
    if (existing) return existing;
    const created = `sop:${generarId()}`;
    window.localStorage.setItem(key, created);
    return created;
  } catch {
    return `sop:${generarId()}`;
  }
}

function loadPersistedMessages(
  clienteId: string,
  funcion: FuncionSoporte,
  sessionId: string,
): ChatMessageSoporte[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(messagesStorageKey(clienteId, funcion, sessionId));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ChatMessageSoporte[]) : [];
  } catch {
    return [];
  }
}

function persistMessages(
  clienteId: string,
  funcion: FuncionSoporte,
  sessionId: string,
  messages: ChatMessageSoporte[],
): void {
  if (typeof window === 'undefined' || clienteId === '') return;
  try {
    window.localStorage.setItem(messagesStorageKey(clienteId, funcion, sessionId), JSON.stringify(messages));
  } catch {
    // Persistencia best-effort — no romper el chat si localStorage falla.
  }
}

function persistSessionId(clienteId: string, funcion: FuncionSoporte, sessionId: string): void {
  if (typeof window === 'undefined' || clienteId === '') return;
  try {
    window.localStorage.setItem(sessionStorageKey(clienteId, funcion), sessionId);
  } catch {
    // Persistencia best-effort — no romper el chat si localStorage falla.
  }
}

function parseAssistantReplyId(messageId: string): number | null {
  const match = /^assistant-(\d+)$/.exec(messageId);
  return match ? Number(match[1]) : null;
}

function collectSeenReplyIds(messages: ChatMessageSoporte[]): number[] {
  return messages.reduce<number[]>((ids, message) => {
    const parsed = parseAssistantReplyId(message.id);
    if (parsed !== null) ids.push(parsed);
    return ids;
  }, []);
}

function highestSeenReplyId(messages: ChatMessageSoporte[]): number {
  return collectSeenReplyIds(messages).reduce((max, id) => Math.max(max, id), 0);
}

export interface SendOptionsSoporte {
  kind?: ChatMessageKind;
}

export interface UseChatSoporteResult {
  messages: ChatMessageSoporte[];
  sendStatus: SendStatusSoporte;
  send: (text: string, opts?: SendOptionsSoporte) => Promise<void>;
}

/** `clienteId` — `MeResponse.cliente_id` del tenant autenticado. `''` mientras la sesión no
 * resolvió: degrada a sesión efímera sin persistir, nunca a una clave compartida.
 * `funcion` — fija para toda la vida del hook, ver docstring de arriba. */
export function useChatSoporte(clienteId: string, funcion: FuncionSoporte): UseChatSoporteResult {
  const sessionIdRef = useRef<string>(readOrCreateSessionId(clienteId, funcion));
  const persistedMessages = loadPersistedMessages(clienteId, funcion, sessionIdRef.current);
  const nextIdRef = useRef<number>(highestSeenReplyId(persistedMessages));
  const seenIdsRef = useRef<Set<number>>(new Set(collectSeenReplyIds(persistedMessages)));
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const waitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollingRef = useRef(false);

  const [messages, setMessages] = useState<ChatMessageSoporte[]>(persistedMessages);
  const [sendStatus, setSendStatus] = useState<SendStatusSoporte>('idle');

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current !== null) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    if (waitTimeoutRef.current !== null) {
      clearTimeout(waitTimeoutRef.current);
      waitTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => stopPolling, [stopPolling]);

  useEffect(() => {
    persistMessages(clienteId, funcion, sessionIdRef.current, messages);
  }, [clienteId, funcion, messages]);

  const poll = useCallback(async () => {
    if (pollingRef.current) return;
    pollingRef.current = true;
    try {
      const response = await api.getReply(sessionIdRef.current, nextIdRef.current);
      nextIdRef.current = response.next_id;
      if (response.replies.length === 0) return;

      const additions: ChatMessageSoporte[] = [];
      for (const reply of response.replies) {
        if (seenIdsRef.current.has(reply.id)) continue;
        seenIdsRef.current.add(reply.id);
        additions.push({ id: `assistant-${reply.id}`, role: 'assistant', text: reply.text,
                         choices: reply.choices, card: reply.card });
      }
      if (additions.length > 0) {
        setMessages((prev) => [...prev, ...additions]);
        stopPolling();
        setSendStatus('idle');
      }
    } catch {
      // Error transitorio: el intervalo sigue reintentando hasta WAIT_TIMEOUT_MS.
    } finally {
      pollingRef.current = false;
    }
  }, [stopPolling]);

  // Poll-on-mount — misma durabilidad real que el chat de negocio: trae respuestas llegadas
  // mientras el componente estaba desmontado (cambiar de tab y volver a Soporte).
  useEffect(() => {
    void poll();
  }, [poll]);

  const startWaitingForReply = useCallback(() => {
    setSendStatus('waiting');
    pollTimerRef.current = setInterval(() => {
      void poll();
    }, POLL_INTERVAL_MS);
    waitTimeoutRef.current = setTimeout(() => {
      stopPolling();
      setSendStatus((current) => (current === 'waiting' ? 'timeout' : current));
    }, WAIT_TIMEOUT_MS);

    void poll();
  }, [poll, stopPolling]);

  const send = useCallback(
    async (text: string, opts?: SendOptionsSoporte) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      stopPolling();
      const userMessage: ChatMessageSoporte = { id: `user-${generarId()}`, role: 'user', text: trimmed };
      setMessages((prev) => [...prev, userMessage]);
      setSendStatus('sending');

      try {
        const res = await sendSoporteChat({
          session_id: sessionIdRef.current,
          text: trimmed,
          funcion,
          kind: opts?.kind ?? 'text',
        });
        // El servidor devuelve el channel_ref EFECTIVO (`soporte:{funcion}:{session_id}`), no un
        // eco — adoptarlo antes de pollear, si no `GET /reply` pega contra un id que el servidor
        // nunca usó y el chat queda mudo (ver docstring del hook).
        if (res.session_id !== sessionIdRef.current) {
          sessionIdRef.current = res.session_id;
          persistSessionId(clienteId, funcion, res.session_id);
        }
      } catch {
        setSendStatus('error');
        return;
      }

      startWaitingForReply();
    },
    [startWaitingForReply, stopPolling, clienteId, funcion],
  );

  return { messages, sendStatus, send };
}
