import { useCallback, useEffect, useRef, useState } from 'react';

import {
  apiReal as api,
  dictarPorChat,
  type FacturaPropuesta,
  type MotivoSinPropuesta,
  type PuertosDictado,
} from '@copiloto/core';

import { generarId } from '../../util/id';

/**
 * SM-P13 (mobile) — el dictado de FACTURA desde la función. Par del `useDictadoFactura` de web: `POST /chat` con
 * `kind="dictado:factura"` → el backend PROPONE (`emitir_factura`, nunca emite) y devuelve `factura_propuesta`.
 *
 * 🔴 **Dictado incompleto = pregunta SIN card en el 1er turno; la card llega en el 2º turno de la MISMA sesión.**
 * Por eso, mientras haya una pregunta pendiente, el hilo queda ABIERTO: se conserva el `sessionId` y el `cursor`
 * del turno anterior (`desdeId` de core) y la respuesta del usuario viaja por el mismo hilo. Con un id nuevo por
 * turno el backend arrancaría de cero; sin el cursor se releería la pregunta vieja.
 *
 * 🔴 Un solo dictado en vuelo. Nunca se devuelve una card vacía: sin card, `dictar` devuelve `null` y deja la
 * `pregunta` o el `aviso` del degradado.
 */
export const AVISO_DICTADO_FACTURA: Record<MotivoSinPropuesta, string> = {
  error_envio: 'No pude consultar al asistente. Probá de nuevo.',
  respuesta_sin_card: 'No alcancé a armar la factura con lo que dijiste. Probá de nuevo.',
  timeout: 'Tardó demasiado en responder. Probá de nuevo.',
};

export const AVISO_DICTADO_NO_ENTENDIDO = 'No te escuché bien. Probá de nuevo.';

/** Un dictado de factura que abre hilo necesita al menos dos palabras («una factura»); una sola es ruido o un toque sin querer. */
export function dictadoPlausible(texto: string): boolean {
  return texto.trim().split(/\s+/).filter(Boolean).length >= 2;
}

const PUERTOS_REALES: PuertosDictado = {
  enviar: (req) => api.sendChat(req),
  leer: (sessionId, afterId) => api.getReply(sessionId, afterId),
};

export interface DictadoFacturaMobile {
  ocupado: boolean;
  /** La pregunta pendiente del copiloto (dictado incompleto), o `null`. */
  pregunta: string | null;
  /** Por qué no hubo propuesta (red / plazo / respuesta sin sentido), o `null`. */
  aviso: string | null;
  /** `FacturaPropuesta` si el motor armó el borrador; `null` si hay pregunta pendiente, aviso o ya había otro en vuelo. */
  dictar(texto: string): Promise<FacturaPropuesta | null>;
}

export function useDictadoFactura(puertos: PuertosDictado = PUERTOS_REALES): DictadoFacturaMobile {
  const [ocupado, setOcupado] = useState(false);
  const [pregunta, setPregunta] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const hilo = useRef<{ sessionId: string; cursor: number } | null>(null);
  const enVuelo = useRef(false);
  const vivo = useRef(true);

  useEffect(() => {
    vivo.current = true;
    return () => {
      vivo.current = false;
    };
  }, []);

  const dictar = useCallback(
    async (texto: string): Promise<FacturaPropuesta | null> => {
      if (enVuelo.current) return null;
      // SM-P14 — plausibilidad del 1er turno: un clip de ruido ambiente que el STT devolvió como UNA palabra («El») llegó a
      // ser un ítem de factura (1 × 0). Con el hilo abierto la respuesta corta («5000», «Pérez») es legítima; sin hilo no.
      if (hilo.current === null && !dictadoPlausible(texto)) {
        setPregunta(null);
        setAviso(AVISO_DICTADO_NO_ENTENDIDO);
        return null;
      }
      enVuelo.current = true;
      setOcupado(true);
      setAviso(null);
      try {
        const previo = hilo.current;
        const sessionId = previo?.sessionId ?? generarId();
        const r = await dictarPorChat({ destino: 'factura', texto, sessionId, desdeId: previo?.cursor }, puertos);
        if (r.status === 'ok' && r.resultado.destino === 'factura') {
          hilo.current = null;
          if (vivo.current) setPregunta(null);
          return r.resultado.propuesta;
        }
        if (r.status === 'sin_propuesta' && r.motivo === 'respuesta_sin_card' && r.texto != null && r.cursor != null) {
          hilo.current = { sessionId, cursor: r.cursor };
          if (vivo.current) setPregunta(r.texto);
          return null;
        }
        hilo.current = null;
        if (vivo.current) {
          setPregunta(null);
          setAviso(AVISO_DICTADO_FACTURA[r.status === 'sin_propuesta' ? r.motivo : 'respuesta_sin_card']);
        }
        return null;
      } finally {
        enVuelo.current = false;
        if (vivo.current) setOcupado(false);
      }
    },
    [puertos],
  );

  return { ocupado, pregunta, aviso, dictar };
}
