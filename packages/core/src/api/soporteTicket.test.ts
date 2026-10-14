import { beforeEach, describe, expect, it } from 'vitest';

import { configurarApi } from './config';
import type { HttpPort, PeticionHttp, RespuestaHttp } from './http';
import { adjuntarFotoATicket, listarMisTickets, obtenerMiTicket } from './soporteTicket';
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
    expect(res.mensajes[1]!.autor).toBe('operador');
  });

  it('pega contra la ruta con el id, no contra un listado', async () => {
    await obtenerMiTicket(42);
    expect(peticiones[0]!.path).toBe('/soporte/tickets/42');
    expect(peticiones[0]!.metodo).toBe('GET');
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

describe('listarMisTickets', () => {
  let peticiones: PeticionHttp[];
  let responder: (p: PeticionHttp) => RespuestaHttp;

  beforeEach(() => {
    peticiones = [];
    responder = () => respuesta(200, { items: [], total: 0, respuesta_estimada: null });
    const http: HttpPort = {
      async enviar(p) {
        peticiones.push(p);
        return responder(p);
      },
    };
    configurarApi({ http, tokens: crearTokensFake() });
  });

  it('pega contra la colección con el tope y trae items + total', async () => {
    responder = () =>
      respuesta(200, {
        items: [ticketCrudo({ id: 9, codigo: 'SOP-0009' }), ticketCrudo({ id: 7 })],
        total: 3,
        respuesta_estimada: null,
      });

    const res = await listarMisTickets({ limite: 20 });

    expect(peticiones[0]!.path).toBe('/soporte/tickets?limite=20');
    expect(peticiones[0]!.metodo).toBe('GET');
    expect(res.status).toBe('ok');
    if (res.status !== 'ok') return;
    expect(res.items.map((t) => t.id)).toEqual([9, 7]);
    // `total` es el del backend (3), NO `items.length` (2): la lista está acotada por `limite`.
    expect(res.total).toBe(3);
  });

  it('`respuesta_estimada: null` → `null` (la fila «Te contestan» no se pinta); un string pasa tal cual', async () => {
    responder = () => respuesta(200, { items: [], total: 0, respuesta_estimada: null });
    const vacio = await listarMisTickets();
    expect(vacio.status === 'ok' && vacio.respuestaEstimada).toBeNull();

    responder = () => respuesta(200, { items: [], total: 0, respuesta_estimada: 'Antes de 24 h' });
    const con = await listarMisTickets();
    expect(con.status === 'ok' && con.respuestaEstimada).toBe('Antes de 24 h');

    // Vacío o en blanco NO es un plazo: no se pinta una fila con nada adentro.
    responder = () => respuesta(200, { items: [], total: 0, respuesta_estimada: '   ' });
    const blanco = await listarMisTickets();
    expect(blanco.status === 'ok' && blanco.respuestaEstimada).toBeNull();
  });

  it('una fila con estado fuera del enum o sin forma se DESCARTA (no se pinta como otro estado)', async () => {
    responder = () =>
      respuesta(200, {
        items: [ticketCrudo({ id: 1 }), ticketCrudo({ id: 2, estado: 'escalado' }), { id: 3 }, null],
        total: 4,
        respuesta_estimada: null,
      });
    const res = await listarMisTickets();
    expect(res.status).toBe('ok');
    if (res.status !== 'ok') return;
    expect(res.items.map((t) => t.id)).toEqual([1]);
    expect(res.total).toBe(4);
  });

  it('sin `total` numérico cae al largo de lo recibido', async () => {
    responder = () => respuesta(200, { items: [ticketCrudo()] });
    const res = await listarMisTickets();
    expect(res.status === 'ok' && res.total).toBe(1);
  });

  it('el catch-all del SPA (200 + HTML) y un 404/405/501 son `no_disponible`', async () => {
    responder = () => respuestaHtmlDelSpa();
    await expect(listarMisTickets()).resolves.toEqual({ status: 'no_disponible' });
    for (const s of [404, 405, 501]) {
      responder = () => respuesta(s, { detail: 'x' });
      await expect(listarMisTickets()).resolves.toEqual({ status: 'no_disponible' });
    }
    // Un JSON que no es la lista (otra forma) tampoco se interpreta.
    responder = () => respuesta(200, { ok: true });
    await expect(listarMisTickets()).resolves.toEqual({ status: 'no_disponible' });
  });

  it('un 401 real SÍ se propaga', async () => {
    responder = () => respuesta(401, { detail: 'no autorizado' });
    await expect(listarMisTickets()).rejects.toThrow();
  });
});

describe('adjuntarFotoATicket', () => {
  let peticiones: PeticionHttp[];
  let responder: (p: PeticionHttp) => RespuestaHttp;
  const ARCHIVO = { nombre: 'ticket.jpg', mime: 'image/jpeg', datos: 'file:///cache/ticket.jpg' };

  beforeEach(() => {
    peticiones = [];
    responder = () => respuesta(201, { id: 5, nombre: 'ticket.jpg', tipo: 'image/jpeg', bytes: 1234 });
    const http: HttpPort = {
      async enviar(p) {
        peticiones.push(p);
        return responder(p);
      },
    };
    configurarApi({ http, tokens: crearTokensFake() });
  });

  it('sube el archivo como multipart al ticket, con el campo `adjunto` que el backend espera', async () => {
    const res = await adjuntarFotoATicket(42, ARCHIVO);

    expect(peticiones[0]!.path).toBe('/soporte/tickets/42/adjuntos');
    expect(peticiones[0]!.metodo).toBe('POST');
    expect(peticiones[0]!.multipart?.campoArchivo).toBe('adjunto');
    expect(peticiones[0]!.multipart?.archivo).toEqual(ARCHIVO);
    expect(res).toEqual({
      status: 'ok',
      adjunto: { id: 5, nombre: 'ticket.jpg', tipo: 'image/jpeg', bytes: 1234 },
    });
  });

  it('los rechazos del backend se ramifican por STATUS: 404 / 415 / 413', async () => {
    responder = () => respuesta(404, { detail: 'ticket no encontrado' });
    await expect(adjuntarFotoATicket(1, ARCHIVO)).resolves.toEqual({ status: 'no_encontrado' });
    responder = () => respuesta(415, { detail: 'formato de adjunto no soportado (jpg/png)' });
    await expect(adjuntarFotoATicket(1, ARCHIVO)).resolves.toEqual({ status: 'formato' });
    responder = () => respuesta(413, { detail: 'adjunto demasiado grande (máx 5 MB)' });
    await expect(adjuntarFotoATicket(1, ARCHIVO)).resolves.toEqual({ status: 'rechazado' });
    // El MISMO status con la otra causa (tope por ticket) cae en la misma rama: no se lee el texto.
    responder = () => respuesta(413, { detail: 'el ticket ya tiene el máximo de adjuntos (10)' });
    await expect(adjuntarFotoATicket(1, ARCHIVO)).resolves.toEqual({ status: 'rechazado' });
  });

  it('un 200 sin forma de adjunto, o la ruta no desplegada, es `no_disponible`', async () => {
    responder = () => respuesta(200, { ok: true });
    await expect(adjuntarFotoATicket(1, ARCHIVO)).resolves.toEqual({ status: 'no_disponible' });
    responder = () => respuestaHtmlDelSpa();
    await expect(adjuntarFotoATicket(1, ARCHIVO)).resolves.toEqual({ status: 'no_disponible' });
    responder = () => respuesta(405, { detail: 'x' });
    await expect(adjuntarFotoATicket(1, ARCHIVO)).resolves.toEqual({ status: 'no_disponible' });
  });

  it('un 500 SÍ se propaga (no se confunde con un rechazo del archivo)', async () => {
    responder = () => respuesta(500, { detail: 'boom' });
    await expect(adjuntarFotoATicket(1, ARCHIVO)).rejects.toThrow();
  });
});
