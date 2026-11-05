import { useCallback, useEffect, useRef, useState } from 'react';

import {
  listarMisTickets,
  type EstadoChat,
  type MisTicketsOk,
  type TicketPropio,
} from '@copiloto/core';

/** Tope de filas que se piden: alcanza para la tarjeta + la lista desplegable. `total` sigue siendo el del
 *  tenant (sin tope), así que el contador no miente aunque la lista esté acotada. */
const LIMITE_TICKETS = 20;

export interface UseTicketsSoporteResult {
  /** El ticket más reciente SI sigue en curso (`abierto`/`respondido`); `null` si no hay o ya está cerrado.
   *  Es el que la tarjeta pinta. */
  vigente: TicketPropio | null;
  /** Lo que despliega «Ver tickets anteriores»: el resto de la lista, sin el vigente. */
  anteriores: TicketPropio[];
  /** Cuántos tickets hay detrás del vigente. Sale de `total` (el del tenant), NO de `anteriores.length`. */
  cantidadAnteriores: number;
  /** `respuesta_estimada` del backend: `null` hoy, y con `null` la fila «Te contestan» no se pinta. */
  respuestaEstimada: string | null;
}

/**
 * Los tickets propios de Soporte (PROTO4APP §D).
 *
 * 🔴 **Fail-soft de punta a punta**: si la lista no carga (ruta no desplegada, red, 5xx) no hay tarjeta y
 * el chat sigue igual. La tarjeta es un agregado; que falte no puede romper la pantalla.
 *
 * 🔴 **Qué NO afirma**: que el ticket sea «de esta conversación». El backend no ata un ticket a una sesión
 * (`canal` es la función, no el hilo), así que lo único verificable es «tu ticket más reciente». Por eso el
 * pie de la tarjeta es `SOPORTE_QUE_VIAJA` y no el «Va con esta conversación» del prototipo.
 *
 * Refresca al montar y cada vez que un turno del chat termina (`sendStatus` vuelve a `idle`): es cuando el
 * agente pudo haber abierto un ticket.
 *
 * (El clip de adjuntos se sacó del composer de Soporte el 2026-11-04, decisión del operador.)
 */
export function useTicketsSoporte(sendStatus: EstadoChat['sendStatus']): UseTicketsSoporteResult {
  const [lista, setLista] = useState<MisTicketsOk | null>(null);
  const vivo = useRef(true);
  useEffect(() => {
    vivo.current = true;
    return () => {
      vivo.current = false;
    };
  }, []);

  const refrescar = useCallback(async () => {
    try {
      const r = await listarMisTickets({ limite: LIMITE_TICKETS });
      if (vivo.current && r.status === 'ok') setLista(r);
    } catch {
      // Fail-soft: se queda con lo último que supo (o sin tarjeta).
    }
  }, []);

  useEffect(() => {
    void refrescar();
  }, [refrescar]);

  const previo = useRef(sendStatus);
  useEffect(() => {
    if (previo.current !== 'idle' && sendStatus === 'idle') void refrescar();
    previo.current = sendStatus;
  }, [sendStatus, refrescar]);

  const items = lista?.items ?? [];
  const masReciente = items[0] ?? null;
  const vigente = masReciente !== null && masReciente.estado !== 'cerrado' ? masReciente : null;
  const anteriores = vigente !== null ? items.slice(1) : items;
  const cantidadAnteriores = lista === null ? 0 : Math.max(lista.total - (vigente !== null ? 1 : 0), 0);

  return {
    vigente,
    anteriores,
    cantidadAnteriores,
    respuestaEstimada: lista?.respuestaEstimada ?? null,
  };
}
