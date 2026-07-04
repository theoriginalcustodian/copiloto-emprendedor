import { useCallback, useEffect, useRef, useState } from 'react';

import { api, type ChatMessageKind, type ReplyChoice } from '../../lib/api';

/**
 * Hook reusable de lógica del chat (Task 8) — agnóstico de presentación, consumible por ambos
 * shells (mobile/desktop). Maneja: session_id persistido, historial de mensajes, envío, y el
 * polling que absorbe la naturaleza DURABLE del agente (el backend procesa en background vía
 * Temporal — la respuesta no llega en el POST /chat, llega después vía GET /reply).
 *
 * **Durabilidad real (fix de review adversarial):** el hook se remontaba LIMPIO (`messages=[]`,
 * cursor 0) cada vez que se montaba `ChatScreen`, y el polling solo arrancaba en un `send`. Eso
 * hacía que Chat→Apps→Chat (o cruzar el breakpoint mobile/desktop) mostrara un chat VACÍO, y una
 * respuesta durable que llegó mientras no se miraba no aparecía hasta el próximo envío —
 * contradice el pitch "podés cerrar la app, te sigo respondiendo". Fix: `messages` se persiste en
 * `localStorage` keyed por `session_id`, se rehidrata al montar, y al montar se dispara UN poll
 * (reusando `poll()` tal cual, sin duplicar cursor/dedupe) con `after_id` = el mayor id de
 * assistant ya visto entre los mensajes rehidratados.
 */

const SESSION_STORAGE_KEY = 'copiloto-chat-session-id';
const MESSAGES_STORAGE_PREFIX = 'copiloto-chat-msgs';
const POLL_INTERVAL_MS = 1500;
/** Cuánto esperar por una respuesta antes de rendirse y avisar al usuario (agente durable = lento). */
const WAIT_TIMEOUT_MS = 60_000;
/** No re-warmear la memoria si ya se warmeó esta sesión hace menos que esto. El enfriamiento del grafo
 * en el server es LRU del page-cache (no un timer) → re-warmear a los segundos no aporta; este throttle
 * evita martillar Graphity en remounts rápidos (cruzar el breakpoint mobile/desktop) o flicks de pestaña. */
const WARM_THROTTLE_MS = 5 * 60_000;

/** Última vez (ms) que se disparó el warm por session_id. A NIVEL DE MÓDULO a propósito: sobrevive a los
 * remounts de `useChat` (un `useRef` se reinicia al remontar) — sin esto, cruzar el breakpoint o volver a
 * la pestaña de chat re-warmearía en cada remonte. */
const lastWarmAtBySession = new Map<string, number>();

/** Precalienta la memoria de largo plazo (best-effort, fire-and-forget). NUNCA toca el estado del chat ni
 * propaga: un fallo (Graphity caído/lento, sin token, sin `fetch` en jsdom, o `api.warm` ausente en un
 * mock viejo) se traga en silencio — es latencia, no correctitud. Throttle por sesión (WARM_THROTTLE_MS). */
function warmMemory(sessionId: string): void {
  const now = Date.now();
  const last = lastWarmAtBySession.get(sessionId);
  if (last !== undefined && now - last < WARM_THROTTLE_MS) return;
  lastWarmAtBySession.set(sessionId, now); // optimista: marcá ANTES de la llamada para no reintentar en ráfaga
  void (async () => {
    try {
      await api.warm();
    } catch {
      // best-effort — ignorar cualquier fallo del warm
    }
  })();
}

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

function messagesStorageKey(sessionId: string): string {
  return `${MESSAGES_STORAGE_PREFIX}:${sessionId}`;
}

/** Rehidrata los mensajes persistidos de este `session_id` — best-effort (localStorage puede
 * fallar en modo privado/cuota llena, o traer basura si otro código escribió la key) y NUNCA debe
 * romper el mount: cualquier problema degrada a "sin historial", igual que `getToken` en
 * `auth/session.ts`. */
function loadPersistedMessages(sessionId: string): ChatMessage[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(messagesStorageKey(sessionId));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ChatMessage[]) : [];
  } catch {
    return [];
  }
}

function persistMessages(sessionId: string, messages: ChatMessage[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(messagesStorageKey(sessionId), JSON.stringify(messages));
  } catch {
    // Persistencia best-effort — no romper el chat si localStorage falla.
  }
}

/** IDs de `reply` (numéricos) ya vistos, derivados del formato `assistant-<id>` con el que `poll()`
 * arma el `id` del `ChatMessage` de abajo — es el único lugar que conoce ese formato. */
function parseAssistantReplyId(messageId: string): number | null {
  const match = /^assistant-(\d+)$/.exec(messageId);
  return match ? Number(match[1]) : null;
}

function collectSeenReplyIds(messages: ChatMessage[]): number[] {
  return messages.reduce<number[]>((ids, message) => {
    const parsed = parseAssistantReplyId(message.id);
    if (parsed !== null) ids.push(parsed);
    return ids;
  }, []);
}

/** `after_id` de arranque tras rehidratar: el mayor id de `assistant` ya visto, o 0 si no hay
 * historial (sesión nueva o solo hay mensajes de `user` todavía sin respuesta). */
function highestSeenReplyId(messages: ChatMessage[]): number {
  return collectSeenReplyIds(messages).reduce((max, id) => Math.max(max, id), 0);
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
  /** `session_id` activo (para mostrar un fragmento en el header de escritorio, ej. `sess_9f2a`). */
  sessionId: string;
  /** Arranca una conversación nueva: genera un `session_id` fresco, lo persiste, descarta el
   * historial viejo y vacía los mensajes. Lo consume el botón "Nueva conversación" del header
   * de escritorio (`Copiloto Web.dc.html:98-101`); el shell mobile no lo usa. */
  startNewSession: () => void;
}

export function useChat(): UseChatResult {
  const sessionIdRef = useRef<string>(readOrCreateSessionId());
  // Rehidratación (fix de review): mensajes persistidos de este `session_id`, leídos una vez para
  // sembrar el estado inicial — mismo criterio "eager pero idempotente" que `readOrCreateSessionId`
  // arriba (barato: solo corre de nuevo en re-renders, el valor post-primer-render no se usa).
  const persistedMessages = loadPersistedMessages(sessionIdRef.current);
  const nextIdRef = useRef<number>(highestSeenReplyId(persistedMessages));
  const seenIdsRef = useRef<Set<number>>(new Set(collectSeenReplyIds(persistedMessages)));
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const waitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollingRef = useRef(false);

  const [messages, setMessages] = useState<ChatMessage[]>(persistedMessages);
  const [sendStatus, setSendStatus] = useState<SendStatus>('idle');
  // `sessionId` es estado (no solo el ref) para que el header de escritorio re-renderice al
  // arrancar una conversación nueva; el ref sigue siendo la fuente de verdad de los callbacks
  // de polling (identidad estable), y `startNewSession` mantiene ambos en sync.
  const [sessionId, setSessionId] = useState<string>(sessionIdRef.current);

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

  // Persistencia (fix de review): cada cambio de `messages` (rehidratación inicial incluida, sin
  // efecto porque es un round-trip idéntico) se guarda bajo el `session_id` activo.
  useEffect(() => {
    persistMessages(sessionIdRef.current, messages);
  }, [messages]);

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

  // Poll-on-mount (fix de review — durabilidad real): reusa `poll()` tal cual (mismo cursor
  // `nextIdRef`, mismo dedupe `seenIdsRef` — ya sembrados arriba desde los mensajes rehidratados)
  // para traer, apenas se monta el componente, cualquier respuesta que haya llegado mientras
  // estaba desmontado (Chat→Apps→Chat, cruzar el breakpoint mobile/desktop). `poll` es estable
  // (depende solo de `stopPolling`, sin deps) así que esto corre una única vez al montar.
  useEffect(() => {
    void poll();
  }, [poll]);

  // Warm de la memoria dirigido por el ciclo de vida del front (perceived latency): precalentar el grafo
  // del emprendedor al ENTRAR al chat (este efecto corre al montar — abrir la app en chat, o volver
  // Apps→Chat que remonta `useChat`) y al volver la pestaña a VISIBLE tras estar oculta. Así el grafo
  // está caliente cuando el usuario empieza a tipear, en vez de que el 1er mensaje pague el cache-miss.
  // El warm apunta al grafo del TENANT (no a la sesión) → no depende de `session_id`, corre una vez al
  // montar (`[]`) + en cada visibilitychange. El throttle de `warmMemory` absorbe los disparos redundantes.
  useEffect(() => {
    warmMemory(sessionIdRef.current);
    if (typeof document === 'undefined') return undefined;
    const onVisibility = () => {
      if (document.visibilityState === 'visible') warmMemory(sessionIdRef.current);
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

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

  const startNewSession = useCallback(() => {
    stopPolling();
    const previous = sessionIdRef.current;
    const created = generateId();
    sessionIdRef.current = created;
    nextIdRef.current = 0;
    seenIdsRef.current = new Set();
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(SESSION_STORAGE_KEY, created);
        window.localStorage.removeItem(messagesStorageKey(previous));
      } catch {
        // best-effort — si localStorage falla, igual reseteamos el estado en memoria.
      }
    }
    setMessages([]);
    setSessionId(created);
    setSendStatus('idle');
  }, [stopPolling]);

  return { messages, sendStatus, send, sendAudio, sessionId, startNewSession };
}
