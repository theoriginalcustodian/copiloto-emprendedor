import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
// `deleteAsync` de la misma familia `/legacy` que usa `adapters/http.native.ts` para `uploadAsync` --
// consistencia de versión del SDK, no una preferencia (ver el porqué de `/legacy` en ese archivo).
import { deleteAsync } from 'expo-file-system/legacy';

import {
  apiReal as api,
  hidratarEstado,
  motivoDeError,
  reducirChat,
  type ArchivoSubida,
  type ChatMessage,
  type ChatMessageKind,
  type EstadoChat,
} from '@copiloto/core';

import { almacenClave } from '../../adapters/almacen';
// `generarId` vivía privado acá. Se movió a `util/id` cuando apareció el segundo consumidor (la
// `idem_key` de un cobro): un helper encerrado en un módulo se duplica en vez de reusarse.
import { generarId } from '../../util/id';

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
 * 🔴 **F6 agregó `enviarAudio`** (voz-comando corta, `useVozComando.ts`/`GlassGrabacionCopiloto.tsx`,
 * ambos en este mismo módulo). Sigue deliberadamente SIN:
 *  - **`cliente_id`/`alcance`/`modo`** — los tres ejes exigen un selector de cliente activo / modo de
 *    negocio que hoy no existe en NINGÚN shell del copiloto, ni siquiera en
 *    `apps/copiloto-web/src/modules/chat/useChat.ts` (la versión YA EN PRODUCCIÓN — verificado leyendo
 *    ese archivo antes de portar: su `SendOptions` tampoco los manda). Inventar acá un valor
 *    "razonable" sería exactamente *codificar la esperanza*: se agregan cuando el selector exista, con
 *    su propio spike, no antes. `enviarAudio` manda `cliente_id: ''` — el propio contrato de
 *    `sendAudio` (`packages/core/src/api/audio.ts`) documenta que se manda SIEMPRE, aunque venga
 *    vacío, para que un backend que lo exija responda 422 en vez de que un default silencioso
 *    esconda "sin cliente activo".
 *
 * Si acá aparece un `if` que decida QUÉ mensaje agregar, qué dispara qué gate, o si un id ya se vio —
 * está mal ubicado: eso es responsabilidad de `reducirChat` (`@copiloto/core`), no de este hook.
 */

/** MISMAS keys que `apps/copiloto-web/src/modules/chat/useChat.ts` (`SESSION_STORAGE_KEY`/
 * `MESSAGES_STORAGE_PREFIX`) — mismo criterio que `almacenTokens` en `adapters/almacen.ts` ("un
 * usuario que ya tenía sesión en la web no la pierde"). AsyncStorage nativo y el `localStorage` de un
 * origin web están físicamente aislados, así que no hay riesgo real de colisión — es sólo
 * consistencia de nombres entre plataformas del mismo producto. */
const PREFIJO_SESSION = 'copiloto-chat-session-id';
const PREFIJO_MENSAJES = 'copiloto-chat-msgs';
const POLL_INTERVAL_MS = 1500;
/** Ritmo tras el timeout: se sigue preguntando, pero sin quemar una request cada 1.5s durante media
 *  hora. Esperar 20 minutos cuesta 120 requests en vez de 800. */
const POLL_INTERVAL_LENTO_MS = 10_000;
/** Cuánto esperar por una respuesta antes de avisar que está tardando (agente durable = lento). */
const WAIT_TIMEOUT_MS = 60_000;

/**
 * 🔴 **Las claves de storage van scoped por `clienteId` (el tenant autenticado, `MeResponse.
 * cliente_id`) — hallazgo en device 2026-07-23.** Antes, `CLAVE_SESSION` era una clave GLOBAL: un
 * segundo login en el MISMO device (otro tenant) hidrataba el `sessionId` — y por lo tanto el
 * historial completo — de la sesión anterior, ajena. El `session_id` que viaja al servidor
 * (`api.sendChat`/`getReply`) NO cambia de forma por esto — sigue siendo el mismo opaco que siempre
 * fue; sólo cambia bajo qué clave se lo busca/guarda LOCALMENTE. `clienteId` vacío (sesión aún no
 * resuelta) degrada a NO persistir — ningún fallback a una clave compartida.
 */
function claveSession(clienteId: string): string {
  return `${PREFIJO_SESSION}:${clienteId}`;
}

function claveMensajes(clienteId: string, sessionId: string): string {
  return `${PREFIJO_MENSAJES}:${clienteId}:${sessionId}`;
}

/** Lee (o crea) el `session_id` activo PARA ESTE `clienteId`. Best-effort: si `AlmacenClave` falla,
 * degrada a una sesión nueva en memoria — perder la persistencia no puede romper el chat. */
export async function leerOCrearSessionId(clienteId: string): Promise<string> {
  if (clienteId === '') return generarId(); // sin identidad todavía -- efímero, nunca compartido.
  try {
    const clave = claveSession(clienteId);
    const existente = await almacenClave.leer(clave);
    if (existente) return existente;
    const creado = generarId();
    await almacenClave.guardar(clave, creado);
    return creado;
  } catch {
    return generarId();
  }
}

/** Rehidrata el historial de esta sesión — best-effort: cualquier problema (storage caído, JSON
 * corrupto) degrada a "sin historial", nunca rompe el mount. */
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
  if (clienteId === '') return; // sin identidad resuelta todavía -- nunca a una clave compartida.
  void almacenClave.guardar(claveMensajes(clienteId, sessionId), JSON.stringify(messages));
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
  /** Sube un dictado corto (`useVozComando`) para transcribir y despachar -- ver el docstring de
   * `enviarAudio` más abajo. */
  enviarAudio: (audio: ArchivoSubida) => Promise<void>;
  /** Sube una foto de ticket (`useCapturaFoto`) para OCR y despachar -- ver el docstring de
   * `enviarFoto` más abajo. */
  enviarFoto: (foto: ArchivoSubida) => Promise<void>;
}

/**
 * Best-effort: borra el archivo (audio O foto) del filesystem tras usarlo. Nunca lanza -- un fallo
 * acá (permiso, archivo ya borrado, plataforma sin `deleteAsync`) no puede tumbar el envío que ya
 * terminó. `datos` es OPACO al core (`ArchivoSubida`, ver `packages/core/src/api/http.ts`): sólo el
 * adaptador nativo sabe que en esta plataforma es una URI de archivo (string) -- de ahí el guard de
 * tipo antes de intentar borrar. Genérico desde que `enviarFoto` lo sumó como segundo consumidor --
 * el nombre viejo (`borrarAudioLocal`) ya era una mentira parcial antes de renombrarlo.
 */
async function borrarArchivoLocal(archivo: ArchivoSubida): Promise<void> {
  if (typeof archivo.datos !== 'string') return;
  try {
    await deleteAsync(archivo.datos, { idempotent: true });
  } catch {
    // Best-effort: no hay ningún camino de negocio que dependa de que esto salga bien -- ver el
    // docstring de `enviarAudio`/`enviarFoto` sobre CERO retención y por qué el borrado es "mejor
    // esfuerzo", no una condición de éxito del envío.
  }
}

/**
 * `clienteId` — `MeResponse.cliente_id` del tenant autenticado (`useSession().me`), NO el "selector de
 * cliente activo" del docstring de arriba (ese es otro eje, todavía inexistente). Scopea DÓNDE se
 * persiste el chat, no QUÉ cliente-del-emprendedor está seleccionado.
 */
export function useChat(clienteId: string): UseChatResult {
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
      persistirMensajes(clienteId, next.sessionId, next.messages);
      actualizarEstado(next);
    } catch {
      // Error transitorio de red/servidor: el intervalo sigue reintentando. No hay un momento en que
      // se deje de reintentar: tras el timeout el ritmo baja, pero nunca se abandona.
    } finally {
      pollingRef.current = false;
    }
  }, [actualizarEstado, detenerPolling, clienteId]);

  // Hidratación: resuelve sessionId + historial persistido (ASYNC — AsyncStorage), siembra el reducer
  // con `hidratarEstado`, y dispara UN poll para traer cualquier respuesta que haya llegado mientras
  // la app estaba cerrada (durabilidad real: la app en background no pierde respuestas que ya
  // llegaron server-side). Re-corre si `clienteId` cambia (cambio de tenant en un árbol que sigue
  // montado) — vuelve a hidratar contra las claves del tenant nuevo, nunca deja las del anterior.
  useEffect(() => {
    void (async () => {
      const sessionId = await leerOCrearSessionId(clienteId);
      const persistidos = await leerMensajesPersistidos(clienteId, sessionId);
      if (!montadoRef.current) return;
      actualizarEstado(hidratarEstado(sessionId, persistidos));
      void poll();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `poll` se omite: recrearlo en cada
    // render de `clienteId` reiniciaría el timer de espera en curso, y no cambia entre renders de la
    // MISMA sesión (sólo cuando cambia `clienteId`, que sí está en las deps).
  }, [clienteId]);

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
      persistirMensajes(clienteId, siguiente.sessionId, siguiente.messages);
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
    [detenerPolling, actualizarEstado, iniciarEsperaDeRespuesta, clienteId],
  );

  /**
   * VOZ-COMANDO. El usuario habla, el servidor transcribe y el copiloto responde.
   *
   * 🔴 A diferencia de `send`, acá NO hay mensaje optimista: hasta que el servidor no devuelve el
   * transcript, no sabemos qué dijo el usuario. Un placeholder ("🎤 audio…") reemplazado después
   * mostraría, por un instante, algo que el usuario nunca dijo. El mensaje aparece cuando existe la
   * palabra real, no antes -- mismo criterio que documed.
   *
   * 🔴 **CERO retención (D6): el archivo se borra del filesystem SIEMPRE que `sendAudio` termina**,
   * haya salido bien o mal -- por eso el `try/finally` envuelve sólo esa llamada, no el resto de la
   * función. Tiene que seguir existiendo mientras `uploadAsync` (`adapters/http.native.ts`) lo está
   * leyendo del disco; borrarlo antes rompería la subida, borrarlo nunca dejaría un archivo huérfano
   * en la caché de `expo-audio` por cada dictado.
   */
  const enviarAudio = useCallback(
    async (audio: ArchivoSubida) => {
      const actual = estadoRef.current;
      if (!actual) return;

      detenerPolling();
      actualizarEstado(reducirChat(actual, { tipo: 'envio_iniciado' }));

      let transcript: string;
      try {
        try {
          // `cliente_id` se manda SIEMPRE, aunque venga vacío -- ver el docstring del módulo.
          const respuesta = await api.sendAudio(actual.sessionId, audio, '');
          transcript = respuesta.transcript.trim();
        } finally {
          await borrarArchivoLocal(audio);
        }
      } catch (e) {
        const conError = estadoRef.current ?? actual;
        actualizarEstado(reducirChat(conError, { tipo: 'envio_fallo', motivo: motivoDeError(e) }));
        return;
      }

      if (transcript === '') {
        // El servidor respondió OK y el STT no entendió nada. El envío FUNCIONÓ: decirle "no
        // pudimos enviar" mandaría a revisar la conexión cuando lo que hay que repetir es el audio.
        // No se agrega un mensaje vacío ni se espera una respuesta que no viene.
        const vacio = estadoRef.current ?? actual;
        actualizarEstado(reducirChat(vacio, { tipo: 'envio_fallo', motivo: 'audio_no_entendido' }));
        return;
      }

      const mensajeUsuario: ChatMessage = { id: `user-${generarId()}`, role: 'user', text: transcript };
      const base = estadoRef.current ?? actual;
      let siguiente = reducirChat(base, { tipo: 'mensaje_usuario_agregado', mensaje: mensajeUsuario });
      siguiente = reducirChat(siguiente, { tipo: 'envio_ok' });
      persistirMensajes(clienteId, siguiente.sessionId, siguiente.messages);
      actualizarEstado(siguiente);

      iniciarEsperaDeRespuesta();
    },
    [detenerPolling, actualizarEstado, iniciarEsperaDeRespuesta, clienteId],
  );

  /**
   * FOTO DE TICKET (Gastos Fase 2, OCR). El usuario elige/saca una foto, el servidor la lee con
   * `gpt-4o` y arma el `gasto_propuesto` -- ver `contrato_..._POST-chat-foto-gastos-fase2.md`.
   *
   * 🔴 A diferencia de `enviarAudio`, acá NUNCA hay transcript que mostrar como mensaje del usuario
   * -- `SendFotoResponse` no lo trae (a propósito, ver su docstring en `packages/core`): la respuesta
   * de negocio es la card `gasto_propuesto` que llega por `/reply`, no un texto. El mensaje optimista
   * (`'📷 Foto del ticket enviada'`) se agrega recién cuando el upload YA confirmó `accepted`, mismo
   * criterio que `enviarAudio` esperando el transcript real: nunca mostrar algo antes de saber que
   * pasó de verdad.
   *
   * 🔴 **CERO retención**: mismo `try/finally` que `enviarAudio` alrededor de la llamada de red --
   * `borrarArchivoLocal` corre haya salido bien o mal.
   */
  const enviarFoto = useCallback(
    async (foto: ArchivoSubida) => {
      const actual = estadoRef.current;
      if (!actual) return;

      detenerPolling();
      actualizarEstado(reducirChat(actual, { tipo: 'envio_iniciado' }));

      try {
        try {
          // `cliente_id` vacío, mismo criterio que `enviarAudio`: es el "cliente del emprendedor"
          // opcional (ver docstring del módulo), no el tenant -- el chat general no tiene selector.
          await api.sendFoto(actual.sessionId, foto, '');
        } finally {
          await borrarArchivoLocal(foto);
        }
      } catch (e) {
        const conError = estadoRef.current ?? actual;
        actualizarEstado(reducirChat(conError, { tipo: 'envio_fallo', motivo: motivoDeError(e, 'foto') }));
        return;
      }

      const mensajeUsuario: ChatMessage = {
        id: `user-${generarId()}`,
        role: 'user',
        text: '📷 Foto del ticket enviada',
      };
      const base = estadoRef.current ?? actual;
      let siguiente = reducirChat(base, { tipo: 'mensaje_usuario_agregado', mensaje: mensajeUsuario });
      siguiente = reducirChat(siguiente, { tipo: 'envio_ok' });
      persistirMensajes(clienteId, siguiente.sessionId, siguiente.messages);
      actualizarEstado(siguiente);

      iniciarEsperaDeRespuesta();
    },
    [detenerPolling, actualizarEstado, iniciarEsperaDeRespuesta, clienteId],
  );

  return { estado, send, enviarAudio, enviarFoto };
}
