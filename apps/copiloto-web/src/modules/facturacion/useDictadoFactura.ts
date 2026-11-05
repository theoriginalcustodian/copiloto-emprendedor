import { useCallback, useEffect, useRef, useState } from 'react';

import {
  dictarPorChat,
  getReply,
  sendChat,
  type FacturaPropuesta,
  type MotivoSinPropuesta,
  type PuertosDictado,
} from '@copiloto/core';

import { generarId } from '../../util/id';

/**
 * SM-P13 — el dictado de FACTURA desde la función (no manda al chat): `POST /chat` con
 * `kind="dictado:factura"` → el backend PROPONE (`emitir_factura`, nunca emite) y devuelve la card
 * `factura_propuesta`. Misma maquinaria que Gastos/Ingresos/Presupuestos/Clientes en mobile
 * (`dictarPorChat`); acá sólo se agrega lo que difiere en el caso INCOMPLETO.
 *
 * 🔴 **El dictado incompleto contesta con una PREGUNTA SIN CARD en el 1er turno, y la card llega en el 2º
 * turno de la MISMA sesión** (`_run_emitir_factura`, dos pasos). Por eso el hilo queda ABIERTO mientras
 * haya una pregunta pendiente: se conserva el `sessionId` y el cursor del turno anterior, y la
 * respuesta del usuario viaja por el mismo hilo. Con un id nuevo por turno el backend arrancaría de
 * cero y la pregunta quedaría sin contexto; sin el cursor se releería la pregunta vieja.
 *
 * 🔴 **Nunca se pinta una card vacía**: sin `factura_propuesta` no hay `propuesta`; lo que hay es la
 * pregunta (`pregunta`) o un aviso del degradado (`aviso`).
 *
 * 🔴 **Un solo dictado en vuelo**; perder lo que dijo el usuario sería peor que ignorar el segundo.
 */

/** Copy por motivo — distinto a propósito: «no pude consultar» y «tardó» no se arreglan igual. */
export const AVISO_DICTADO_FACTURA: Record<MotivoSinPropuesta, string> = {
  error_envio: 'No pude consultar al asistente. Probá de nuevo.',
  respuesta_sin_card: 'No alcancé a armar la factura con lo que dijiste. Probá de nuevo.',
  timeout: 'Tardó demasiado en responder. Probá de nuevo.',
};

const PUERTOS_REALES: PuertosDictado = {
  enviar: (req) => sendChat(req),
  leer: (sessionId, afterId) => getReply(sessionId, afterId),
};

export interface DictadoFactura {
  /** Esperando la respuesta del backend. */
  ocupado: boolean;
  /** La pregunta pendiente del copiloto (dictado incompleto, 1er turno sin card), o `null`. */
  pregunta: string | null;
  /** Por qué no hubo propuesta (red / plazo / respuesta sin sentido), o `null`. */
  aviso: string | null;
  /** Lo que el copiloto entendió de la factura, de sólo lectura; `null` mientras no haya card. */
  propuesta: FacturaPropuesta | null;
  dictar(texto: string): Promise<void>;
  /** Descarta la propuesta (p. ej. tras «Completar a mano», que la adopta como borrador). */
  limpiar(): void;
}

export function useDictadoFactura(puertos: PuertosDictado = PUERTOS_REALES): DictadoFactura {
  const [ocupado, setOcupado] = useState(false);
  const [pregunta, setPregunta] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [propuesta, setPropuesta] = useState<FacturaPropuesta | null>(null);
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
    async (texto: string) => {
      if (enVuelo.current) return;
      enVuelo.current = true;
      setOcupado(true);
      setAviso(null);
      setPropuesta(null);
      try {
        const previo = hilo.current;
        const sessionId = previo?.sessionId ?? generarId();
        const r = await dictarPorChat({ destino: 'factura', texto, sessionId, desdeId: previo?.cursor }, puertos);
        if (!vivo.current) return;
        if (r.status === 'ok' && r.resultado.destino === 'factura') {
          hilo.current = null;
          setPregunta(null);
          setPropuesta(r.resultado.propuesta);
          return;
        }
        if (r.status === 'sin_propuesta' && r.motivo === 'respuesta_sin_card' && r.texto != null && r.cursor != null) {
          // Dictado incompleto: el hilo sigue abierto, la próxima frase del usuario contesta esta pregunta.
          hilo.current = { sessionId, cursor: r.cursor };
          setPregunta(r.texto);
          return;
        }
        hilo.current = null;
        setPregunta(null);
        setAviso(AVISO_DICTADO_FACTURA[r.status === 'sin_propuesta' ? r.motivo : 'respuesta_sin_card']);
      } finally {
        enVuelo.current = false;
        if (vivo.current) setOcupado(false);
      }
    },
    [puertos],
  );

  const limpiar = useCallback(() => {
    hilo.current = null;
    setPregunta(null);
    setAviso(null);
    setPropuesta(null);
  }, []);

  return { ocupado, pregunta, aviso, propuesta, dictar, limpiar };
}
