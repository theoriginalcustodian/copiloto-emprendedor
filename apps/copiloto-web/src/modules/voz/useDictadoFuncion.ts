import { useCallback, useEffect, useRef, useState } from 'react';

import {
  dictarPorChat,
  type DatosCliente,
  type DestinoDictado,
  type FacturaPropuesta,
  type GastoPropuesto,
  type IngresoPropuesto,
  type MotivoSinPropuesta,
  type PresupuestoPropuesto,
  type PuertosDictado,
} from '@copiloto/core';

import { api } from '../../lib/api';
import { generarId } from '../../util/id';

/**
 * ORDEN NUEVA 2026-11-06 (SM-P19, mitad A) — el dictado desde una FUNCIÓN se prellena EN la función y
 * NO depende del chat. `POST /chat` con `kind="dictado:<destino>"` → el backend PROPONE (nunca guarda
 * ni emite) y devuelve la card del destino; el hilo del dictado está namespaceado aparte
 * (`dictado:<destino>:<sid>`), así que no toca el del chat. Es la generalización de lo que SM-P13 hizo
 * sólo para Facturación (`useDictadoFactura`, ahora un envoltorio de este hook): UNA definición para los
 * 5 destinos, no un hook por función.
 *
 * Por qué importa que no dependa del chat: el dock que remitía al chat necesitaba el chat hidratado
 * (`CHAT_NO_LISTO` → el audio no llegaba a ninguna parte). Acá el dock sólo habla con `/chat` de dictado
 * y no hay ninguna dependencia con el hilo principal.
 *
 * 🔴 **El dictado incompleto contesta con una PREGUNTA SIN CARD en el 1er turno, y la card llega en el 2º
 * turno de la MISMA sesión** (hoy sólo lo hace `emitir_factura`, pero el hilo abierto es inocuo para el
 * resto). Mientras haya una pregunta pendiente se conserva el `sessionId` y el cursor del turno anterior:
 * con un id nuevo por turno el backend arrancaría de cero y la pregunta quedaría sin contexto; sin el
 * cursor se releería la pregunta vieja.
 *
 * 🔴 **Nunca se pinta una card vacía**: sin card del destino no hay `propuesta`; lo que hay es la
 * pregunta (`pregunta`) o un aviso del degradado (`aviso`).
 *
 * 🔴 **Un solo dictado en vuelo**; perder lo que dijo el usuario sería peor que ignorar el segundo.
 */

/** Qué propuesta devuelve cada destino. Tabla indexada: con `D` sin resolver TS no estrecha un `Extract`. */
interface PropuestaPorDestino {
  gasto: GastoPropuesto;
  ingreso: IngresoPropuesto;
  presupuesto: PresupuestoPropuesto;
  cliente: DatosCliente;
  factura: FacturaPropuesta;
}

/** La propuesta que devuelve el destino `D` (p. ej. `'gasto'` → `GastoPropuesto`). */
export type PropuestaDe<D extends DestinoDictado> = PropuestaPorDestino[D];

/** Cómo se nombra lo que se iba a armar en el aviso. `Record`: un destino nuevo sin nombre no compila. */
const NOMBRE_DESTINO: Record<DestinoDictado, string> = {
  gasto: 'el gasto',
  ingreso: 'el cobro',
  presupuesto: 'el presupuesto',
  cliente: 'el cliente',
  factura: 'la factura',
};

/** Copy por motivo — distinto a propósito: «no pude consultar» y «tardó» no se arreglan igual. */
export function avisoDictado(destino: DestinoDictado, motivo: MotivoSinPropuesta): string {
  const que = NOMBRE_DESTINO[destino];
  switch (motivo) {
    case 'error_envio':
      return 'No pude consultar al asistente. Probá de nuevo.';
    case 'respuesta_sin_card':
      return `No alcancé a armar ${que} con lo que dijiste. Probá de nuevo.`;
    case 'timeout':
      return 'Tardó demasiado en responder. Probá de nuevo.';
  }
}

const PUERTOS_REALES: PuertosDictado = {
  enviar: (req) => api.sendChat(req),
  leer: (sessionId, afterId) => api.getReply(sessionId, afterId),
};

export interface DictadoFuncion<D extends DestinoDictado> {
  /** Esperando la respuesta del backend. */
  ocupado: boolean;
  /** La pregunta pendiente del copiloto (dictado incompleto, 1er turno sin card), o `null`. */
  pregunta: string | null;
  /** Por qué no hubo propuesta (red / plazo / respuesta sin sentido), o `null`. */
  aviso: string | null;
  /** Lo que el copiloto entendió, de sólo lectura; `null` mientras no haya card. */
  propuesta: PropuestaDe<D> | null;
  dictar(texto: string): Promise<void>;
  /** Descarta la propuesta (p. ej. tras adoptarla como borrador en el formulario). */
  limpiar(): void;
}

export function useDictadoFuncion<D extends DestinoDictado>(
  destino: D,
  puertos: PuertosDictado = PUERTOS_REALES,
): DictadoFuncion<D> {
  const [ocupado, setOcupado] = useState(false);
  const [pregunta, setPregunta] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [propuesta, setPropuesta] = useState<PropuestaDe<D> | null>(null);
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
        const r = await dictarPorChat({ destino, texto, sessionId, desdeId: previo?.cursor }, puertos);
        if (!vivo.current) return;
        if (r.status === 'ok' && r.resultado.destino === destino) {
          hilo.current = null;
          setPregunta(null);
          setPropuesta(r.resultado.propuesta as PropuestaDe<D>);
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
        setAviso(avisoDictado(destino, r.status === 'sin_propuesta' ? r.motivo : 'respuesta_sin_card'));
      } finally {
        enVuelo.current = false;
        if (vivo.current) setOcupado(false);
      }
    },
    [destino, puertos],
  );

  const limpiar = useCallback(() => {
    hilo.current = null;
    setPregunta(null);
    setAviso(null);
    setPropuesta(null);
  }, []);

  return { ocupado, pregunta, aviso, propuesta, dictar, limpiar };
}
