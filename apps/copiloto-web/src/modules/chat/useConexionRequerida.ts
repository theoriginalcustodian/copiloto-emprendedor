import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  conexionEstablecida,
  conexionPendienteDelHilo,
  pedirLinkDeVinculacion,
  type ChatMessage as CoreChatMessage,
  type ConexionPendiente,
} from '@copiloto/core';

/** El campo `conexionDescartada` vive en `useChat.ts` (web), no en el `ChatMessage` de
 * `@copiloto/core` (que también usa mobile, fuera de este contrato) — misma duplicación ya
 * documentada para `hitlRespondido`. */
type ChatMessage = CoreChatMessage & { conexionDescartada?: true };

/**
 * K-11 / BL-J8 — la lógica del sheet «conectá X» del chat (web).
 *
 *  - El sheet aparece SÓLO con `card.kind==='requiere_conexion'` en el último mensaje (`conexionPendienteDelHilo`).
 *  - «Ahora no» lo descarta para ese mensaje, sin más acción.
 *  - «Conectar» pide el link (`pedirLinkDeVinculacion`, el mismo flujo que Onboarding) y navega a él. Al
 *    VOLVER (la página se recarga o la pestaña vuelve a estar visible) se re-consulta el catálogo: si el
 *    servicio quedó conectado, se reenvía el texto original por `send` sin intervención del usuario.
 *
 * El pedido original se guarda en `sessionStorage` antes de salir: el `location.assign` a Google
 * recarga la SPA al volver y el estado en memoria se pierde.
 *
 * **HOJA — «descartados» ya NO es memoria.** Antes: `useState<Set>` en este hook, perdido al
 * recargar (la hoja volvía a abrirse y tapaba el composer). Ahora se DERIVA de `messages` (patrón
 * B, como `hitlRespondido`): cada mensaje `conexionDescartada` cuenta, y `marcarConexionDescartada`
 * (de `useChat`) escribe la marca en el mensaje persistido — sobrevive al reload sin storage nuevo.
 */
const CLAVE = 'copiloto.conexion.pendiente';

interface Reintento {
  service: string;
  texto: string;
}

function guardar(r: Reintento | null) {
  try {
    if (r == null) sessionStorage.removeItem(CLAVE);
    else sessionStorage.setItem(CLAVE, JSON.stringify(r));
  } catch {
    // sin storage: se pierde el reenvío automático, el usuario reescribe — no es un error.
  }
}

function leer(): Reintento | null {
  try {
    const raw = sessionStorage.getItem(CLAVE);
    if (raw == null) return null;
    const r = JSON.parse(raw) as Partial<Reintento>;
    return typeof r.service === 'string' && typeof r.texto === 'string' ? { service: r.service, texto: r.texto } : null;
  } catch {
    return null;
  }
}

export interface ConexionRequerida {
  pendiente: ConexionPendiente | null;
  conectar: () => void;
  ahoraNo: () => void;
  ocupado: boolean;
  error: string | null;
}

export function useConexionRequerida(
  messages: readonly ChatMessage[],
  send: (texto: string, opts: { mode: string | null }) => unknown,
  irA: (url: string) => void = (url) => window.location.assign(url),
  marcarConexionDescartada: (mensajeId: string) => void = () => {},
): ConexionRequerida {
  // HOJA: derivado de `messages` (persistido), no un `useState<Set>` en memoria — sobrevive a un
  // reload porque `conexionDescartada` viaja DENTRO del mensaje ya guardado en localStorage.
  const descartados = useMemo(
    () => new Set(messages.filter((m) => m.conexionDescartada).map((m) => m.id)),
    [messages],
  );
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pendiente = useMemo(() => conexionPendienteDelHilo(messages, descartados), [messages, descartados]);

  const sendRef = useRef(send);
  sendRef.current = send;

  const reintentar = useCallback(async () => {
    const r = leer();
    if (r == null) return;
    if (!(await conexionEstablecida(r.service))) return;
    guardar(null); // primero limpiar: un segundo evento de foco no puede reenviar dos veces
    void sendRef.current(r.texto, { mode: null });
  }, []);

  useEffect(() => {
    void reintentar(); // al montar: la SPA se recargó al volver del navegador
    const alVolver = () => {
      if (document.visibilityState === 'visible') void reintentar();
    };
    document.addEventListener('visibilitychange', alVolver);
    return () => document.removeEventListener('visibilitychange', alVolver);
  }, [reintentar]);

  const ahoraNo = useCallback(() => {
    if (pendiente == null) return;
    marcarConexionDescartada(pendiente.mensajeId);
  }, [pendiente, marcarConexionDescartada]);

  const conectar = useCallback(() => {
    if (pendiente == null || ocupado) return;
    setOcupado(true);
    setError(null);
    void (async () => {
      try {
        const res = await pedirLinkDeVinculacion(pendiente.conexion.connectPath);
        if (res.status === 'no_disponible') {
          setError(`Conectar ${pendiente.conexion.label} todavía no está disponible.`);
          return;
        }
        if (pendiente.textoOriginal != null) guardar({ service: pendiente.conexion.service, texto: pendiente.textoOriginal });
        irA(res.url);
      } catch {
        setError(`No pudimos pedir el link de ${pendiente.conexion.label}. Probá de nuevo.`);
      } finally {
        setOcupado(false);
      }
    })();
  }, [pendiente, ocupado, irA]);

  return { pendiente, conectar, ahoraNo, ocupado, error };
}
