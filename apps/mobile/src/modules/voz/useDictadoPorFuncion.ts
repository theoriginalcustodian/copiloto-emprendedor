import { useCallback, useEffect, useRef, useState } from 'react';

import {
  apiReal as api,
  dictarPorChat,
  type DatosCliente,
  type DestinoDictado,
  type GastoPropuesto,
  type IngresoPropuesto,
  type MotivoSinPropuesta,
  type PresupuestoPropuesto,
  type PuertosDictado,
} from '@copiloto/core';

import { generarId } from '../../util/id';

/**
 * Qué propuesta devuelve cada destino. Tabla indexada y no `Extract<PropuestaDictado, …>`: con el
 * genérico `D` sin resolver, TS no estrecha el condicional y el `return` no compila.
 */
interface PropuestaPorDestino {
  gasto: GastoPropuesto;
  ingreso: IngresoPropuesto;
  presupuesto: PresupuestoPropuesto;
  cliente: DatosCliente;
}

/** La propuesta que devuelve el destino `D` (p. ej. `'gasto'` → `GastoPropuesto`). */
export type PropuestaDe<D extends DestinoDictado> = PropuestaPorDestino[D];

/**
 * Copy del degradado, por motivo. Distinto por motivo A PROPÓSITO: el caso benigno (precarga cruda) es
 * el mismo para el usuario, pero «no pude consultar» y «tardó demasiado» no se arreglan igual, y un
 * único texto genérico escondería cuál de las dos está pasando.
 */
export const AVISO_DICTADO: Record<MotivoSinPropuesta, string> = {
  error_envio: 'No pude consultar al asistente. Te dejé lo que dijiste para que lo completes a mano.',
  respuesta_sin_card: 'No alcancé a armar la propuesta con lo que dijiste. Te dejé tu texto para que lo completes a mano.',
  timeout: 'Tardó demasiado en responder. Te dejé lo que dijiste para que lo completes a mano.',
};

const PUERTOS_REALES: PuertosDictado = {
  enviar: (req) => api.sendChat(req),
  leer: (sessionId, afterId) => api.getReply(sessionId, afterId),
};

export interface OpcionesDictado {
  /** Default: el cliente real. Inyectable para que el test no toque la red. */
  puertos?: PuertosDictado;
}

export interface DictadoPorFuncion<D extends DestinoDictado> {
  /** Esperando la card. La pantalla deshabilita el mic y muestra el estado — `AvisoDictado`. */
  ocupado: boolean;
  /** Por qué se cayó a la precarga cruda; `null` si no pasó (o si todavía no se dictó nada). */
  aviso: string | null;
  /**
   * `PropuestaDe<D>` = lo que el motor entendió, listo para mapear a `iniciales`.
   * `null` = **la pantalla usa el texto crudo** (el comportamiento de antes): falló o ya había otro
   * dictado en vuelo — en el primer caso `aviso` dice por qué. Nunca lanza.
   */
  dictar(texto: string): Promise<PropuestaDe<D> | null>;
}

/**
 * El dictado desde una FUNCIÓN por el chat (contrato 2026-10-13, opción b). La pantalla le pasa el
 * transcript que ya devolvió `MicFuncion`; el hook lo manda a `/chat` con `kind="dictado:<destino>"`,
 * espera la card y la devuelve. La extracción no vive acá ni en la pantalla: es la del motor.
 *
 * 🔴 **El turno nunca toca el hilo del chat**: cada dictado usa un `session_id` nuevo y el backend lo
 * namespacea aparte (`dictado:<destino>:<sid>`), así que el log que lee `useChat` no lo ve. No se
 * persiste nada — ni sesión ni cursor — porque un dictado es de un turno.
 *
 * 🔴 **Un solo dictado en vuelo.** Si llega un segundo mientras espera, devuelve `null` (la pantalla
 * precarga el texto crudo): perder lo que el usuario dijo sería peor que mostrarlo sin extraer.
 */
export function useDictadoPorFuncion<D extends DestinoDictado>(
  destino: D,
  opciones: OpcionesDictado = {},
): DictadoPorFuncion<D> {
  const puertos = opciones.puertos ?? PUERTOS_REALES;
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const enVuelo = useRef(false);
  const vivo = useRef(true);

  useEffect(() => {
    vivo.current = true;
    return () => {
      vivo.current = false;
    };
  }, []);

  const dictar = useCallback(
    async (texto: string): Promise<PropuestaDe<D> | null> => {
      setAviso(null);
      if (enVuelo.current) return null;
      enVuelo.current = true;
      setOcupado(true);
      try {
        const r = await dictarPorChat({ destino, texto, sessionId: generarId() }, puertos);
        if (r.status === 'ok' && r.resultado.destino === destino) {
          return r.resultado.propuesta as PropuestaDe<D>;
        }
        // `ok` de OTRO destino no debería pasar (el lector filtra por destino); si pasa, es un degradado
        // como cualquier otro y no una propuesta ajena pintada en esta pantalla.
        const motivo: MotivoSinPropuesta = r.status === 'sin_propuesta' ? r.motivo : 'respuesta_sin_card';
        if (vivo.current) setAviso(AVISO_DICTADO[motivo]);
        return null;
      } finally {
        enVuelo.current = false;
        if (vivo.current) setOcupado(false);
      }
    },
    [destino, puertos],
  );

  return { ocupado, aviso, dictar };
}
