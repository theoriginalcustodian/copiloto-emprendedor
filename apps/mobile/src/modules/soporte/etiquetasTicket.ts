import type { TicketPropio } from '@copiloto/core';

/** El rótulo de cada estado de un ticket propio. Un solo lugar: lo usan la pantalla del hilo
 *  (`PantallaTicket`) y la tarjeta del chat de Soporte (`TarjetaTicketSoporte`). */
export const ETIQUETA_ESTADO_TICKET: Record<TicketPropio['estado'], string> = {
  abierto: 'Abierto',
  respondido: 'Respondido',
  cerrado: 'Cerrado',
};
