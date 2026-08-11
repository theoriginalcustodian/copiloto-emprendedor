import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
// `deleteAsync` de la misma familia `/legacy` que `modules/chat/useChat.ts` -- consistencia de
// versión del SDK, no una preferencia (ver el porqué de `/legacy` en ese archivo).
import { deleteAsync } from 'expo-file-system/legacy';

import {
  apiReal as api,
  hidratarEstado,
  motivoDeError,
  reducirChat,
  sendSoporteAudio,
  sendSoporteChat,
  type ArchivoSubida,
  type ChatMessage,
  type ChatMessageKind,
  type EstadoChat,
  type FuncionSoporte,
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
 * `enviarAudio` (ODOBI8 §C2) — mismo patrón que `enviarAudio` de `modules/chat/useChat.ts`
 * (negocio): sube a `sendSoporteAudio` (`/soporte/chat/audio`, namespaced por `funcion`, NO
 * `/chat/audio`), borra el archivo local SIEMPRE (CERO retención, D6) y adopta el `session_id`
 * efectivo que devuelve el servidor antes de pollear -- mismo cuidado que `send()` más abajo. La
 * voz estaba deliberadamente fuera de alcance en SOP5 v1 ("si al probarlo resulta que se necesita,
 * es un hito aparte") -- este es ese hito. Sigue SIN `enviarFoto`: nadie pidió foto en soporte.
 *
 * 🔴 **`funcion` es FIJA por instancia del hook, no por `send()`** — corregido 2026-08-10 junto con
 * el shape (`respuesta_planificacion-a-backend_SOP5-va-la-B`). Una conversación entera pertenece a
 * UNA función: el servidor arma `channel_ref = f"soporte:{funcion}:{session_id}"` en el primer
 * mensaje, así que cambiar de función a mitad de charla no tiene equivalente semántico del lado del
 * servidor — sería otro hilo, no un giro de la misma conversación. Storage y `session_id` locales
 * están scoped por `(clienteId, funcion)`: "soporte técnico" y "cómo uso la app" son DOS hilos
 * persistidos por separado, nunca comparten historial ni cursor de polling.
 *
 * 🔴 **El `session_id` que vuelve en la RESPUESTA del POST no es el que mandó el cliente.** El
 * servidor namespacea (`channel_ref`) y lo devuelve — hay que adoptarlo ANTES de arrancar a pollear,
 * o `GET /reply` consulta con un id que el servidor no reconoce y el chat se queda mudo para
 * siempre, sin ningún error que lo delate (el fallo MUDO que el propio DoD advierte). Por eso `send`
 * migra `sessionId` (estado + storage) apenas la respuesta llega, antes de `iniciarEsperaDeRespuesta`.
 */
const PREFIJO_SESSION = 'copiloto-soporte-session-id';
const PREFIJO_MENSAJES = 'copiloto-soporte-msgs';
const POLL_INTERVAL_MS = 1500;
const POLL_INTERVAL_LENTO_MS = 10_000;
const WAIT_TIMEOUT_MS = 60_000;

function claveSession(clienteId: string, funcion: FuncionSoporte): string {
  return `${PREFIJO_SESSION}:${clienteId}:${funcion}`;
}

function claveMensajes(clienteId: string, funcion: FuncionSoporte, sessionId: string): string {
  return `${PREFIJO_MENSAJES}:${clienteId}:${funcion}:${sessionId}`;
}

/** Lee (o crea) el `session_id` LOCAL de arranque para `(clienteId, funcion)` — con el prefijo
 * `sop:` que el cliente propone al servidor. El servidor puede devolver otro (`channel_ref`) en la
 * respuesta del primer envío; ver el docstring del módulo. Best-effort: si `AlmacenClave` falla,
 * degrada a una sesión nueva en memoria. */
export async function leerOCrearSessionIdSoporte(clienteId: string, funcion: FuncionSoporte): Promise<string> {
  if (clienteId === '') return `sop:${generarId()}`;
  try {
    const clave = claveSession(clienteId, funcion);
    const existente = await almacenClave.leer(clave);
    if (existente) return existente;
    const creado = `sop:${generarId()}`;
    await almacenClave.guardar(clave, creado);
    return creado;
  } catch {
    return `sop:${generarId()}`;
  }
}

async function leerMensajesPersistidos(
  clienteId: string,
  funcion: FuncionSoporte,
  sessionId: string,
): Promise<ChatMessage[]> {
  try {
    const raw = await almacenClave.leer(claveMensajes(clienteId, funcion, sessionId));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ChatMessage[]) : [];
  } catch {
    return [];
  }
}

function persistirMensajes(
  clienteId: string,
  funcion: FuncionSoporte,
  sessionId: string,
  messages: ChatMessage[],
): void {
  if (clienteId === '') return;
  void almacenClave.guardar(claveMensajes(clienteId, funcion, sessionId), JSON.stringify(messages));
}

/** Best-effort: borra el audio del filesystem tras usarlo. Nunca lanza -- mismo criterio (y mismo
 * porqué) que `borrarArchivoLocal` de `modules/chat/useChat.ts`. */
async function borrarArchivoLocal(archivo: ArchivoSubida): Promise<void> {
  if (typeof archivo.datos !== 'string') return;
  try {
    await deleteAsync(archivo.datos, { idempotent: true });
  } catch {
    // Best-effort -- ver el docstring del módulo sobre CERO retención.
  }
}

export interface SendOptionsSoporte {
  kind?: ChatMessageKind;
}

export interface UseChatSoporteResult {
  /** `null` mientras la sesión/historial todavía no terminaron de hidratarse desde `AlmacenClave`. */
  estado: EstadoChat | null;
  send: (text: string, opts?: SendOptionsSoporte) => Promise<void>;
  /** Sube un dictado corto (`useVozComando`) al soporte -- ver el docstring de `enviarAudio` abajo. */
  enviarAudio: (audio: ArchivoSubida) => Promise<void>;
}

/** `clienteId` — `MeResponse.cliente_id` del tenant autenticado, mismo criterio de scoping que
 * `useChat` de negocio: aísla DÓNDE se persiste, no decide nada del lado del servidor.
 * `funcion` — `'soporte_tecnico' | 'como_uso_la_app'`, fija para toda la vida de esta instancia
 * (ver el docstring del módulo sobre por qué no es un argumento de `send`). */
export function useChatSoporte(clienteId: string, funcion: FuncionSoporte): UseChatSoporteResult {
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
      persistirMensajes(clienteId, funcion, next.sessionId, next.messages);
      actualizarEstado(next);
    } catch {
      // Error transitorio: el intervalo sigue reintentando — mismo criterio que el chat de negocio.
    } finally {
      pollingRef.current = false;
    }
  }, [actualizarEstado, detenerPolling, clienteId, funcion]);

  useEffect(() => {
    void (async () => {
      const sessionId = await leerOCrearSessionIdSoporte(clienteId, funcion);
      const persistidos = await leerMensajesPersistidos(clienteId, funcion, sessionId);
      if (!montadoRef.current) return;
      actualizarEstado(hidratarEstado(sessionId, persistidos));
      void poll();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `poll` se omite a propósito, mismo
    // criterio documentado en `modules/chat/useChat.ts`.
  }, [clienteId, funcion]);

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
      persistirMensajes(clienteId, funcion, siguiente.sessionId, siguiente.messages);
      actualizarEstado(siguiente);

      let sessionIdEfectivo = siguiente.sessionId;
      try {
        const res = await sendSoporteChat({
          session_id: siguiente.sessionId,
          text: trimmed,
          funcion,
          kind: opts?.kind ?? 'text',
        });
        sessionIdEfectivo = res.session_id;
      } catch (e) {
        const conError = estadoRef.current ?? siguiente;
        actualizarEstado(reducirChat(conError, { tipo: 'envio_fallo', motivo: motivoDeError(e) }));
        return;
      }

      let enviado = estadoRef.current ?? siguiente;
      if (sessionIdEfectivo !== enviado.sessionId) {
        // El servidor namespaceó (`channel_ref`) -- adoptarlo ANTES de pollear (ver docstring del
        // módulo) y persistir la migración: la PRÓXIMA vez que se abra este chat, `leerOCrear
        // SessionIdSoporte` tiene que devolver el channel_ref real, no el `sop:` local que ya quedó
        // desconectado del hilo.
        enviado = { ...enviado, sessionId: sessionIdEfectivo };
        await almacenClave.guardar(claveSession(clienteId, funcion), sessionIdEfectivo);
        persistirMensajes(clienteId, funcion, sessionIdEfectivo, enviado.messages);
      }
      enviado = reducirChat(enviado, { tipo: 'envio_ok' });
      actualizarEstado(enviado);
      iniciarEsperaDeRespuesta();
    },
    [detenerPolling, actualizarEstado, iniciarEsperaDeRespuesta, clienteId, funcion],
  );

  /**
   * VOZ (ODOBI8 §C2). A diferencia de `send`, no hay mensaje optimista: hasta que el servidor no
   * devuelve el transcript, no sabemos qué dijo el usuario -- mismo criterio que `enviarAudio` de
   * `modules/chat/useChat.ts`. `funcion` namespacea igual que `send` (ver docstring del módulo).
   */
  const enviarAudio = useCallback(
    async (audio: ArchivoSubida) => {
      const actual = estadoRef.current;
      if (!actual) return;

      detenerPolling();
      actualizarEstado(reducirChat(actual, { tipo: 'envio_iniciado' }));

      let transcript: string;
      let sessionIdEfectivo = actual.sessionId;
      try {
        try {
          const respuesta = await sendSoporteAudio(actual.sessionId, audio, funcion);
          transcript = respuesta.transcript.trim();
          sessionIdEfectivo = respuesta.session_id;
        } finally {
          await borrarArchivoLocal(audio);
        }
      } catch (e) {
        const conError = estadoRef.current ?? actual;
        actualizarEstado(reducirChat(conError, { tipo: 'envio_fallo', motivo: motivoDeError(e) }));
        return;
      }

      if (transcript === '') {
        // El servidor respondió OK y el STT no entendió nada -- el envío FUNCIONÓ, mismo criterio
        // que el chat de negocio: no se agrega un mensaje vacío ni se espera una respuesta que no viene.
        const vacio = estadoRef.current ?? actual;
        actualizarEstado(reducirChat(vacio, { tipo: 'envio_fallo', motivo: 'audio_no_entendido' }));
        return;
      }

      let base = estadoRef.current ?? actual;
      if (sessionIdEfectivo !== base.sessionId) {
        // El servidor namespaceó (`channel_ref`) -- adoptarlo ANTES de pollear, mismo cuidado que `send`.
        base = { ...base, sessionId: sessionIdEfectivo };
        await almacenClave.guardar(claveSession(clienteId, funcion), sessionIdEfectivo);
      }

      const mensajeUsuario: ChatMessage = { id: `user-${generarId()}`, role: 'user', text: transcript };
      let siguiente = reducirChat(base, { tipo: 'mensaje_usuario_agregado', mensaje: mensajeUsuario });
      siguiente = reducirChat(siguiente, { tipo: 'envio_ok' });
      persistirMensajes(clienteId, funcion, siguiente.sessionId, siguiente.messages);
      actualizarEstado(siguiente);

      iniciarEsperaDeRespuesta();
    },
    [detenerPolling, actualizarEstado, iniciarEsperaDeRespuesta, clienteId, funcion],
  );

  return { estado, send, enviarAudio };
}
