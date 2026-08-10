import { useCallback, useEffect, useRef, useState } from 'react';

import { api, sendSoporteChat, type ChatMessageKind, type ReplyCard, type ReplyChoice } from '../../lib/api';
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
 * Claves de storage y `session_id` separados del chat de negocio Y scoped por `clienteId` (a
 * diferencia del `useChat` de negocio, que usa una clave global) — mismo criterio que mobile
 * adoptó el 2026-07-23 tras un bug real de historial cruzado entre tenants en el mismo device.
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

function sessionStorageKey(clienteId: string): string {
  return `${SESSION_STORAGE_KEY_PREFIX}:${clienteId}`;
}

function messagesStorageKey(clienteId: string, sessionId: string): string {
  return `${MESSAGES_STORAGE_PREFIX}:${clienteId}:${sessionId}`;
}

function readOrCreateSessionId(clienteId: string): string {
  if (typeof window === 'undefined' || clienteId === '') return `sop:${generarId()}`;
  try {
    const key = sessionStorageKey(clienteId);
    const existing = window.localStorage.getItem(key);
    if (existing) return existing;
    const created = `sop:${generarId()}`;
    window.localStorage.setItem(key, created);
    return created;
  } catch {
    return `sop:${generarId()}`;
  }
}

function loadPersistedMessages(clienteId: string, sessionId: string): ChatMessageSoporte[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(messagesStorageKey(clienteId, sessionId));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ChatMessageSoporte[]) : [];
  } catch {
    return [];
  }
}

function persistMessages(clienteId: string, sessionId: string, messages: ChatMessageSoporte[]): void {
  if (typeof window === 'undefined' || clienteId === '') return;
  try {
    window.localStorage.setItem(messagesStorageKey(clienteId, sessionId), JSON.stringify(messages));
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
 * resolvió: degrada a sesión efímera sin persistir, nunca a una clave compartida. */
export function useChatSoporte(clienteId: string): UseChatSoporteResult {
  const sessionIdRef = useRef<string>(readOrCreateSessionId(clienteId));
  const persistedMessages = loadPersistedMessages(clienteId, sessionIdRef.current);
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
    persistMessages(clienteId, sessionIdRef.current, messages);
  }, [clienteId, messages]);

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
        await sendSoporteChat({
          session_id: sessionIdRef.current,
          text: trimmed,
          kind: opts?.kind ?? 'text',
        });
      } catch {
        setSendStatus('error');
        return;
      }

      startWaitingForReply();
    },
    [startWaitingForReply, stopPolling],
  );

  return { messages, sendStatus, send };
}
