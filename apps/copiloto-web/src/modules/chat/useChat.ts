import { useCallback, useEffect, useRef, useState } from 'react';

import { api, type ChatMessageKind, type ReplyChoice } from '../../lib/api';

/**
 * Hook reusable de lógica del chat (Task 8) — agnóstico de presentación, consumible por ambos
 * shells (mobile/desktop). Maneja: session_id persistido, historial de mensajes, envío, y el
 * polling que absorbe la naturaleza DURABLE del agente (el backend procesa en background vía
 * Temporal — la respuesta no llega en el POST /chat, llega después vía GET /reply).
 */

const SESSION_STORAGE_KEY = 'copiloto-chat-session-id';
const POLL_INTERVAL_MS = 1500;
/** Cuánto esperar por una respuesta antes de rendirse y avisar al usuario (agente durable = lento). */
const WAIT_TIMEOUT_MS = 60_000;

function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback para entornos sin Web Crypto (no debería pasar en browsers modernos ni en jsdom
  // reciente, pero no romper si pasa).
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function readOrCreateSessionId(): string {
  if (typeof window === 'undefined') return generateId();
  try {
    const existing = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (existing) return existing;
    const created = generateId();
    window.localStorage.setItem(SESSION_STORAGE_KEY, created);
    return created;
  } catch {
    return generateId();
  }
}

export type ChatRole = 'user' | 'assistant';

export interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
  choices?: ReplyChoice[];
}

export type SendStatus = 'idle' | 'sending' | 'waiting' | 'timeout' | 'error';

export interface SendOptions {
  kind?: ChatMessageKind;
  mode?: string | null;
}

export interface UseChatResult {
  messages: ChatMessage[];
  sendStatus: SendStatus;
  send: (text: string, opts?: SendOptions) => Promise<void>;
  /** Sube una nota de voz grabada (Task 19, FASE 4) — ver doc arriba de la función. */
  sendAudio: (blob: Blob) => Promise<void>;
}

export function useChat(): UseChatResult {
  const sessionIdRef = useRef<string>(readOrCreateSessionId());
  const nextIdRef = useRef<number>(0);
  const seenIdsRef = useRef<Set<number>>(new Set());
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const waitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollingRef = useRef(false);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sendStatus, setSendStatus] = useState<SendStatus>('idle');

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

  // Cleanup al desmontar — nunca dejar timers corriendo contra un componente ya fuera de pantalla.
  useEffect(() => stopPolling, [stopPolling]);

  const poll = useCallback(async () => {
    if (pollingRef.current) return;
    pollingRef.current = true;
    try {
      const response = await api.getReply(sessionIdRef.current, nextIdRef.current);
      nextIdRef.current = response.next_id;
      if (response.replies.length === 0) return;

      const additions: ChatMessage[] = [];
      for (const reply of response.replies) {
        if (seenIdsRef.current.has(reply.id)) continue; // dedupe defensivo además del cursor next_id
        seenIdsRef.current.add(reply.id);
        additions.push({ id: `assistant-${reply.id}`, role: 'assistant', text: reply.text, choices: reply.choices });
      }
      if (additions.length > 0) {
        setMessages((prev) => [...prev, ...additions]);
        stopPolling();
        setSendStatus('idle');
      }
    } catch {
      // Error transitorio de red/servidor: el intervalo sigue reintentando hasta WAIT_TIMEOUT_MS.
    } finally {
      pollingRef.current = false;
    }
  }, [stopPolling]);

  /**
   * Arranca el ciclo de espera de la respuesta durable (intervalo de polling + timeout de
   * rendición) — extraído de `send` para que `sendAudio` (Task 19) lo reuse tal cual, en vez de
   * duplicar las mismas 3 líneas de timers.
   */
  const startWaitingForReply = useCallback(() => {
    setSendStatus('waiting');
    pollTimerRef.current = setInterval(() => {
      void poll();
    }, POLL_INTERVAL_MS);
    waitTimeoutRef.current = setTimeout(() => {
      stopPolling();
      setSendStatus((current) => (current === 'waiting' ? 'timeout' : current));
    }, WAIT_TIMEOUT_MS);

    void poll(); // primer intento inmediato — no esperar un intervalo completo para el 1er check.
  }, [poll, stopPolling]);

  const send = useCallback(
    async (text: string, opts?: SendOptions) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      stopPolling();
      const userMessage: ChatMessage = { id: `user-${generateId()}`, role: 'user', text: trimmed };
      setMessages((prev) => [...prev, userMessage]);
      setSendStatus('sending');

      try {
        await api.sendChat({
          session_id: sessionIdRef.current,
          text: trimmed,
          kind: opts?.kind ?? 'text',
          mode: opts?.mode ?? null,
        });
      } catch {
        setSendStatus('error');
        return;
      }

      startWaitingForReply();
    },
    [startWaitingForReply, stopPolling],
  );

  /**
   * Sube una nota de voz grabada (Task 19, FASE 4). A diferencia de `send`, el mensaje de usuario
   * NO se puede mostrar de forma optimista (todavía no sabemos qué dijo) — se agrega recién con el
   * `transcript` que devuelve el backend tras transcribir (STT, Task 18); el POST YA disparó el
   * dispatch server-side (mismo pipeline que `/chat`), así que después solo queda pollear /reply
   * igual que `send`.
   */
  const sendAudio = useCallback(
    async (blob: Blob) => {
      stopPolling();
      setSendStatus('sending');

      let transcript: string;
      try {
        const response = await api.sendAudio(sessionIdRef.current, blob);
        transcript = response.transcript;
      } catch {
        setSendStatus('error');
        return;
      }

      const userMessage: ChatMessage = { id: `user-${generateId()}`, role: 'user', text: transcript };
      setMessages((prev) => [...prev, userMessage]);

      startWaitingForReply();
    },
    [startWaitingForReply, stopPolling],
  );

  return { messages, sendStatus, send, sendAudio };
}
