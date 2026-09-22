import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Linking } from 'react-native';

import {
  conexionEstablecida,
  conexionPendienteDelHilo,
  pedirLinkDeVinculacion,
  type ChatMessage,
  type ConexionPendiente,
} from '@copiloto/core';

/**
 * K-11 / BL-J8 — la lógica del sheet «conectá X» del chat (mobile). Misma máquina que la web
 * (`copiloto-web/.../useConexionRequerida.ts`); cambia cómo se sale y cómo se vuelve:
 *
 *  - «Conectar» pide el link (`pedirLinkDeVinculacion`, igual que `PantallaApps`) y lo abre con `Linking`.
 *  - Al volver del navegador —`AppState` `background`→`active`, no `useFocusEffect`: el navegador es otra
 *    APP y esta pantalla nunca pierde el foco de navegación— se RE-CONSULTA el catálogo; si el servicio
 *    quedó conectado se reenvía el texto original por `send`, sin acción manual.
 *  - «Ahora no» descarta el gate de ese mensaje, sin más acción.
 *
 * El pedido a reenviar vive en un ref: la app sigue viva mientras el usuario autoriza (no se recarga
 * como la SPA web).
 */
interface Reintento {
  service: string;
  texto: string;
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
  send: (texto: string) => unknown,
): ConexionRequerida {
  const [descartados, setDescartados] = useState<ReadonlySet<string>>(new Set());
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pendiente = useMemo(() => conexionPendienteDelHilo(messages, descartados), [messages, descartados]);

  const reintento = useRef<Reintento | null>(null);
  const sendRef = useRef(send);
  sendRef.current = send;

  useEffect(() => {
    const sub = AppState.addEventListener('change', (siguiente) => {
      if (siguiente !== 'active') return;
      const r = reintento.current;
      if (r == null) return;
      void (async () => {
        if (!(await conexionEstablecida(r.service))) return;
        // Sólo el primero que llega reenvía: un segundo `active` durante la re-consulta no duplica.
        if (reintento.current !== r) return;
        reintento.current = null;
        void sendRef.current(r.texto);
      })();
    });
    return () => sub.remove();
  }, []);

  const ahoraNo = useCallback(() => {
    if (pendiente == null) return;
    setDescartados((prev) => new Set(prev).add(pendiente.mensajeId));
  }, [pendiente]);

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
        if (!(await Linking.canOpenURL(res.url))) {
          setError('No pudimos abrir el navegador en este teléfono.');
          return;
        }
        if (pendiente.textoOriginal != null) {
          reintento.current = { service: pendiente.conexion.service, texto: pendiente.textoOriginal };
        }
        await Linking.openURL(res.url);
      } catch {
        setError(`No pudimos pedir el link de ${pendiente.conexion.label}. Probá de nuevo.`);
      } finally {
        setOcupado(false);
      }
    })();
  }, [pendiente, ocupado]);

  return { pendiente, conectar, ahoraNo, ocupado, error };
}
