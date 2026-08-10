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
  it('rutea cada tipo a su función', () => {
    expect(destinoDe(item())).toEqual({ pathname: '/gastos', params: { gastoId: '21' } });
    expect(destinoDe(item({ id: 'presupuesto:13', tipo: 'presupuesto' }))).toEqual({
      pathname: '/presupuestos',
      params: { presupuestoId: '13' },
    });
    expect(destinoDe(item({ id: 'cliente:3', tipo: 'cliente' }))).toEqual({
      pathname: '/clientes',
      params: { clienteId: '3' },
    });
  });

  it('factura y nota de crédito abren la MISMA pantalla', () => {
    // Una nota de crédito ES un comprobante y su detalle es el mismo. Que el contrato los liste como
    // tipos distintos sirve para el color (`signo`), no para el destino.
    expect(destinoDe(item({ id: 'factura:42', tipo: 'factura' }))).toEqual({
      pathname: '/facturacion',
      params: { comprobanteId: '42' },
    });
    expect(destinoDe(item({ id: 'nota_credito:43', tipo: 'nota_credito' }))).toEqual({
      pathname: '/facturacion',
      params: { comprobanteId: '43' },
    });
  });

  it('🔴 un tipo SIN destino devuelve null — no se adivina una pantalla', () => {
    // `ingreso` llega con Contabilidad. Lo que no tiene dónde aterrizar no se pinta tappable: un
    // ítem que se toca y no hace nada se lee como "la app está rota", no como "falta esa función".
    expect(destinoDe(item({ id: 'ingreso:5', tipo: 'ingreso' }))).toBeNull();
    expect(destinoDe(item({ id: 'reintegro:5', tipo: 'reintegro' }))).toBeNull();
  });

  it('un id sin parte numérica no rutea', () => {
    // Mejor no navegar que mandar a una pantalla que va a responder 422 sobre un id inválido.
    expect(destinoDe(item({ id: 'gasto:abc' }))).toBeNull();
    expect(destinoDe(item({ id: 'gasto' }))).toBeNull();
    expect(destinoDe(item({ id: '' }))).toBeNull();
  });

  it('decide por el `tipo`, no por el prefijo del id', () => {
    // Hoy coinciden y no tienen por qué seguir haciéndolo. Si divergen, manda el campo declarado.
    expect(destinoDe(item({ id: 'loquesea:7', tipo: 'gasto' }))).toEqual({
      pathname: '/gastos',
      params: { gastoId: '7' },
    });
  });

  describe('ticket_respuesta (S6-11)', () => {
    it('rutea al hilo del ticket, con el TICKET_ID — no el mensaje_id', () => {
      // El id trae TRES partes: "ticket_respuesta:<ticket_id>:<mensaje_id>". `numeroDelId`
      // (corte por el ÚLTIMO ':') daría el mensaje_id acá — la trampa real que este caso prueba.
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
