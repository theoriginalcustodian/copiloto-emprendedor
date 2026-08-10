import { describe, expect, it } from 'vitest';

import type { ActividadItem } from '@copiloto/core';

import { destinoDe } from './destinoActividad';

function item(over: Partial<ActividadItem> = {}): ActividadItem {
  return {
    id: 'gasto:21',
    tipo: 'gasto',
    fecha: '2026-07-22T14:30:00Z',
    titulo: 'Nafta',
    detalle: 'Shell',
    monto: '8500.00',
    signo: 'sale',
    ...over,
  };
}

describe('destinoDe', () => {
  it('rutea gasto y cliente, los dos módulos web que ya existen', () => {
    expect(destinoDe(item())).toEqual({ pathname: '/gastos', params: { gastoId: '21' } });
    expect(destinoDe(item({ id: 'cliente:3', tipo: 'cliente' }))).toEqual({
      pathname: '/clientes',
      params: { clienteId: '3' },
    });
  });

  it('🔴 un tipo sin módulo web propio devuelve null — no se adivina una pantalla', () => {
    expect(destinoDe(item({ id: 'presupuesto:5', tipo: 'presupuesto' }))).toBeNull();
    expect(destinoDe(item({ id: 'factura:5', tipo: 'factura' }))).toBeNull();
    expect(destinoDe(item({ id: 'ingreso:5', tipo: 'ingreso' }))).toBeNull();
  });

  it('un id sin parte numérica no rutea', () => {
    expect(destinoDe(item({ id: 'gasto:abc' }))).toBeNull();
    expect(destinoDe(item({ id: '' }))).toBeNull();
  });

  describe('ticket_respuesta (S6-11)', () => {
    it('rutea al hilo del ticket, con el TICKET_ID — no el mensaje_id', () => {
      // El id trae TRES partes: "ticket_respuesta:<ticket_id>:<mensaje_id>". `numeroDelId` (corte
      // por el ÚLTIMO ':') daría el mensaje_id acá — la trampa real que este caso prueba.
      expect(destinoDe(item({ id: 'ticket_respuesta:12:987', tipo: 'ticket_respuesta' }))).toEqual({
        pathname: '/soporte-ticket',
        params: { ticketId: '12' },
      });
    });

    it('un id que no tiene exactamente 3 partes no rutea', () => {
      expect(destinoDe(item({ id: 'ticket_respuesta:12', tipo: 'ticket_respuesta' }))).toBeNull();
      expect(
        destinoDe(item({ id: 'ticket_respuesta:12:987:extra', tipo: 'ticket_respuesta' })),
      ).toBeNull();
    });

    it('la parte del medio no numérica no rutea', () => {
      expect(destinoDe(item({ id: 'ticket_respuesta:abc:987', tipo: 'ticket_respuesta' }))).toBeNull();
    });
  });
});
