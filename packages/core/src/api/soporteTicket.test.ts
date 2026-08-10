import { beforeEach, describe, expect, it } from 'vitest';

import { configurarApi } from './config';
import type { HttpPort, PeticionHttp, RespuestaHttp } from './http';
import { obtenerMiTicket } from './soporteTicket';
import type { AlmacenTokens } from './tokens';

function respuesta(status: number, body: unknown): RespuestaHttp {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

/** El catch-all del SPA: `200` con HTML, y `res.json()` **explota**. Mismo caso que
 *  `actividad.test.ts` — es lo que un endpoint TODAVÍA no desplegado devuelve. */
function respuestaHtmlDelSpa(): RespuestaHttp {
  return {
    ok: true,
    status: 200,
    json: async () => {
      throw new SyntaxError('Unexpected token < in JSON at position 0');
    },
  };
}

function crearTokensFake(): AlmacenTokens {
  return {
    async leerToken() { return 'tok-123'; },
    async guardarToken() {},
    async leerRefresh() { return null; },
    async guardarRefresh() {},
    async limpiar() {},
  };
}

function ticketCrudo(over: Record<string, unknown> = {}) {
  return {
    id: 7,
    codigo: 'SOP-0007',
    canal: 'soporte_tecnico',
    estado: 'respondido',
    asunto: 'No puedo emitir una factura',
    created_at: '2026-08-07T10:00:00Z',
    updated_at: '2026-08-10T09:00:00Z',
    ...over,
  };
}

function mensajeCrudo(over: Record<string, unknown> = {}) {
  return {
    id: 1,
    autor: 'usuario',
    texto: 'No me deja emitir',
    created_at: '2026-08-07T10:00:00Z',
    ...over,
  };
}

describe('soporteTicket.ts', () => {
  let peticiones: PeticionHttp[];
  let responder: (p: PeticionHttp) => RespuestaHttp;

  beforeEach(() => {
    peticiones = [];
    responder = () => respuesta(200, { ticket: ticketCrudo(), mensajes: [] });
    const http: HttpPort = {
      async enviar(p) {
        peticiones.push(p);
        return responder(p);
      },
    };
    configurarApi({ http, tokens: crearTokensFake() });
  });

  it('trae el ticket y su hilo en orden', async () => {
    responder = () =>
      respuesta(200, {
        ticket: ticketCrudo(),
        mensajes: [mensajeCrudo({ id: 1, autor: 'usuario' }), mensajeCrudo({ id: 2, autor: 'operador' })],
      });

    const res = await obtenerMiTicket(7);

    expect(res.status).toBe('ok');
    if (res.status !== 'ok') return;
    expect(res.ticket.codigo).toBe('SOP-0007');
    expect(res.mensajes).toHaveLength(2);
    expect(res.mensajes[1].autor).toBe('operador');
  });

  it('pega contra la ruta con el id, no contra un listado', async () => {
    await obtenerMiTicket(42);
    expect(peticiones[0].path).toBe('/soporte/tickets/42');
    expect(peticiones[0].metodo).toBe('GET');
  });

  it('un 404 real (endpoint vivo, ticket ajeno o inexistente) es `no_encontrado`, no un error', async () => {
    responder = () => respuesta(404, { detail: 'ticket no encontrado' });
    await expect(obtenerMiTicket(999)).resolves.toEqual({ status: 'no_encontrado' });
  });

  it('405 (ruta sin este verbo, todavía no desplegada) es `no_disponible`', async () => {
    responder = () => respuesta(405, { detail: 'Method Not Allowed' });
    await expect(obtenerMiTicket(7)).resolves.toEqual({ status: 'no_disponible' });
  });

  it('el catch-all del SPA (200 + HTML) también es `no_disponible`, no un error de parseo', async () => {
    responder = () => respuestaHtmlDelSpa();
    await expect(obtenerMiTicket(7)).resolves.toEqual({ status: 'no_disponible' });
  });

  it('un 401 real SÍ se propaga (no lo tapa la degradación de forma)', async () => {
    responder = () => respuesta(401, { detail: 'no autorizado' });
    await expect(obtenerMiTicket(7)).rejects.toThrow();
  });
});
