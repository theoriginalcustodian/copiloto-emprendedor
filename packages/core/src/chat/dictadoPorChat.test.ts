import { describe, expect, it, vi } from 'vitest';

import type { ChatRequest, ReplyResponse } from '../api/types';
import {
  DICTADO_POR_CHAT_ACTIVO,
  dictarPorChat,
  kindDictado,
  sessionIdDictado,
  type PuertosDictado,
} from './dictadoPorChat';

const SESION = sessionIdDictado('hilo-1');

const CARD_GASTO = {
  kind: 'gasto_propuesto',
  data: {
    monto: '15000.00',
    fecha: '2026-07-21',
    categoria: 'mercaderia',
    proveedor: 'Distribuidora Sur',
    medio_pago: null,
    descripcion: 'pagué 15 mil de mercadería',
    origen: 'voz',
  },
};

const CARD_CLIENTE = {
  kind: 'cliente_propuesto',
  data: { nombre: 'Ferretería El Tornillo', doc_tipo: 80, doc_nro: '30712345678', origen: 'voz' },
};

function respuesta(next: number, ...replies: Array<{ id: number; text?: string; card?: unknown }>): ReplyResponse {
  return {
    next_id: next,
    replies: replies.map((r) => ({ id: r.id, text: r.text ?? '', card: r.card as never })),
  };
}

/** Puertos con la secuencia de `leer` pre-armada: la 1ª es la BASE, las siguientes son los polls. */
function puertos(lecturas: Array<ReplyResponse | Error>) {
  const enviar = vi.fn<(req: ChatRequest) => Promise<unknown>>().mockResolvedValue({});
  const leer = vi.fn<(s: string, a: number) => Promise<ReplyResponse>>();
  for (const l of lecturas) {
    if (l instanceof Error) leer.mockRejectedValueOnce(l);
    else leer.mockResolvedValueOnce(l);
  }
  // Después de la secuencia, nada nuevo: así «timeout» no depende de que el test cuente llamadas.
  leer.mockResolvedValue(respuesta(999));
  const p: PuertosDictado = { enviar, leer, esperar: async () => {} };
  return { p, enviar, leer };
}

describe('dictarPorChat', () => {
  it('el flag nace APAGADO: mergear el cliente no cambia lo que ve el usuario', () => {
    expect(DICTADO_POR_CHAT_ACTIVO).toBe(false);
  });

  it('kind y sesión: una sola derivación, aparte de la del hilo', () => {
    expect(kindDictado('gasto')).toBe('dictado:gasto');
    expect(kindDictado('cliente')).toBe('dictado:cliente');
    expect(sessionIdDictado('hilo-1')).toBe('hilo-1:dictado');
    expect(sessionIdDictado('hilo-1')).not.toBe('hilo-1');
  });

  it('manda el texto con el kind del destino, en la sesión del dictado', async () => {
    const { p, enviar } = puertos([respuesta(5), respuesta(6, { id: 6, card: CARD_GASTO })]);
    await dictarPorChat({ destino: 'gasto', texto: 'pagué 15 mil de mercadería', sessionId: SESION, desde: 0 }, p);
    expect(enviar).toHaveBeenCalledTimes(1);
    expect(enviar).toHaveBeenCalledWith({
      session_id: 'hilo-1:dictado',
      text: 'pagué 15 mil de mercadería',
      kind: 'dictado:gasto',
    });
  });

  it('devuelve la propuesta ya extraída (monto/categoría/proveedor), no la transcripción cruda', async () => {
    const { p } = puertos([respuesta(5), respuesta(6, { id: 6, card: CARD_GASTO })]);
    const r = await dictarPorChat({ destino: 'gasto', texto: 'x', sessionId: SESION, desde: 0 }, p);
    expect(r.status).toBe('ok');
    if (r.status !== 'ok' || r.resultado.destino !== 'gasto') throw new Error('esperaba gasto');
    expect(r.resultado.propuesta.monto).toBe('15000.00');
    expect(r.resultado.propuesta.categoria).toBe('mercaderia');
    expect(r.resultado.propuesta.proveedor).toBe('Distribuidora Sur');
    expect(r.siguienteId).toBe(6);
  });

  it('🔴 la BASE se lee ANTES de enviar y los polls piden después de ella (una card vieja no cuenta)', async () => {
    const orden: string[] = [];
    const lecturas = [respuesta(40, { id: 40, card: CARD_GASTO }), respuesta(41, { id: 41, card: CARD_GASTO })];
    const leer = vi.fn(async (_s: string, _a: number) => {
      orden.push('leer');
      return lecturas.shift() ?? respuesta(999);
    });
    const enviar = vi.fn(async (_req: ChatRequest) => {
      orden.push('enviar');
      return {};
    });
    const p: PuertosDictado = { enviar, leer, esperar: async () => {} };
    const r = await dictarPorChat({ destino: 'gasto', texto: 'x', sessionId: SESION, desde: 7 }, p);
    // La card vieja (id 40) estaba en la BASE: no cuenta. La que vale es la 41, posterior al envío.
    expect(orden).toEqual(['leer', 'enviar', 'leer']);
    // La base se pidió desde el cursor persistido; el poll, desde la base (40), no desde 7.
    expect(leer.mock.calls[0]).toEqual([SESION, 7]);
    expect(leer.mock.calls[1]).toEqual([SESION, 40]);
    expect(r.status).toBe('ok');
  });

  it('cada destino lee SU card: una card de otro destino no vale', async () => {
    const { p } = puertos([respuesta(5), respuesta(6, { id: 6, card: CARD_CLIENTE })]);
    const r = await dictarPorChat({ destino: 'gasto', texto: 'x', sessionId: SESION, desde: 0 }, p);
    expect(r.status).toBe('sin_propuesta');
    if (r.status === 'sin_propuesta') expect(r.motivo).toBe('respuesta_sin_card');
  });

  it('cliente: devuelve los datos del cliente', async () => {
    const { p } = puertos([respuesta(5), respuesta(6, { id: 6, card: CARD_CLIENTE })]);
    const r = await dictarPorChat({ destino: 'cliente', texto: 'x', sessionId: SESION, desde: 0 }, p);
    expect(r.status).toBe('ok');
    if (r.status === 'ok' && r.resultado.destino === 'cliente') {
      expect(r.resultado.propuesta.nombre).toBe('Ferretería El Tornillo');
    }
  });

  it('una pregunta del backend (texto sin card) vuelve como respuesta_sin_card con su texto', async () => {
    const { p } = puertos([respuesta(5), respuesta(6, { id: 6, text: '¿Cuánto fue?' })]);
    const r = await dictarPorChat({ destino: 'gasto', texto: 'x', sessionId: SESION, desde: 0 }, p);
    expect(r).toMatchObject({ status: 'sin_propuesta', motivo: 'respuesta_sin_card', texto: '¿Cuánto fue?' });
  });

  it('sin respuesta dentro del plazo: timeout (y no cuelga)', async () => {
    const { p } = puertos([respuesta(5)]);
    const r = await dictarPorChat(
      { destino: 'gasto', texto: 'x', sessionId: SESION, desde: 0, timeoutMs: 3000, intervaloMs: 1000 },
      p,
    );
    expect(r).toMatchObject({ status: 'sin_propuesta', motivo: 'timeout' });
  });

  it('un fallo de red en un poll NO aborta: el siguiente tick reintenta', async () => {
    const { p } = puertos([respuesta(5), new Error('red'), respuesta(6, { id: 6, card: CARD_GASTO })]);
    const r = await dictarPorChat({ destino: 'gasto', texto: 'x', sessionId: SESION, desde: 0 }, p);
    expect(r.status).toBe('ok');
  });

  it('no puede enviar → error_envio, sin lanzar', async () => {
    const { p, enviar } = puertos([respuesta(5)]);
    enviar.mockRejectedValueOnce(new Error('401'));
    const r = await dictarPorChat({ destino: 'gasto', texto: 'x', sessionId: SESION, desde: 0 }, p);
    expect(r).toMatchObject({ status: 'sin_propuesta', motivo: 'error_envio' });
  });

  it('no puede leer la BASE → error_envio y NO envía (sin base no se distingue lo nuevo)', async () => {
    const { p, enviar } = puertos([new Error('red')]);
    const r = await dictarPorChat({ destino: 'gasto', texto: 'x', sessionId: SESION, desde: 3 }, p);
    expect(r).toMatchObject({ status: 'sin_propuesta', motivo: 'error_envio', siguienteId: 3 });
    expect(enviar).not.toHaveBeenCalled();
  });
});
