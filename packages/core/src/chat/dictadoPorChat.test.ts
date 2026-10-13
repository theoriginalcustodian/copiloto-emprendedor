import { describe, expect, it, vi } from 'vitest';

import type { ChatRequest, ChatResponse, ReplyResponse } from '../api/types';
import { dictarPorChat, kindDictado, type PuertosDictado } from './dictadoPorChat';

/** Lo que el front-door devuelve: el id EFECTIVO, namespaceado por el backend (#1050). */
const EFECTIVA = 'dictado:gasto:sesion-fresca';

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

const ACEPTADO: ChatResponse = { wf_id: 'wf-1', accepted: true, session_id: EFECTIVA };

/** Puertos con la secuencia de `leer` pre-armada. */
function puertos(lecturas: Array<ReplyResponse | Error>, envio: ChatResponse | Error = ACEPTADO) {
  const enviar = vi.fn<(req: ChatRequest) => Promise<ChatResponse>>();
  if (envio instanceof Error) enviar.mockRejectedValue(envio);
  else enviar.mockResolvedValue(envio);
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
  it('el kind lleva el destino', () => {
    expect(kindDictado('gasto')).toBe('dictado:gasto');
    expect(kindDictado('cliente')).toBe('dictado:cliente');
  });

  it('manda el texto con el kind del destino, con el id que le dieron', async () => {
    const { p, enviar } = puertos([respuesta(6, { id: 6, card: CARD_GASTO })]);
    await dictarPorChat({ destino: 'gasto', texto: 'pagué 15 mil de mercadería', sessionId: 'sesion-fresca' }, p);
    expect(enviar).toHaveBeenCalledTimes(1);
    expect(enviar).toHaveBeenCalledWith({
      session_id: 'sesion-fresca',
      text: 'pagué 15 mil de mercadería',
      kind: 'dictado:gasto',
    });
  });

  it('🔴 pollea el session_id EFECTIVO que devolvió /chat, no el que mandó', async () => {
    const { p, leer } = puertos([respuesta(6, { id: 6, card: CARD_GASTO })]);
    await dictarPorChat({ destino: 'gasto', texto: 'x', sessionId: 'sesion-fresca' }, p);
    expect(leer).toHaveBeenCalledWith(EFECTIVA, 0);
    expect(leer).not.toHaveBeenCalledWith('sesion-fresca', expect.anything());
  });

  it('devuelve la propuesta ya extraída (monto/categoría/proveedor), no la transcripción cruda', async () => {
    const { p } = puertos([respuesta(6, { id: 6, card: CARD_GASTO })]);
    const r = await dictarPorChat({ destino: 'gasto', texto: 'x', sessionId: 's' }, p);
    expect(r.status).toBe('ok');
    if (r.status !== 'ok' || r.resultado.destino !== 'gasto') throw new Error('esperaba gasto');
    expect(r.resultado.propuesta.monto).toBe('15000.00');
    expect(r.resultado.propuesta.categoria).toBe('mercaderia');
    expect(r.resultado.propuesta.proveedor).toBe('Distribuidora Sur');
  });

  it('cada destino lee SU card: una card de otro destino no vale', async () => {
    const { p } = puertos([respuesta(6, { id: 6, card: CARD_CLIENTE })]);
    const r = await dictarPorChat({ destino: 'gasto', texto: 'x', sessionId: 's' }, p);
    expect(r).toMatchObject({ status: 'sin_propuesta', motivo: 'respuesta_sin_card' });
  });

  it('cliente: devuelve los datos del cliente', async () => {
    const { p } = puertos([respuesta(6, { id: 6, card: CARD_CLIENTE })]);
    const r = await dictarPorChat({ destino: 'cliente', texto: 'x', sessionId: 's' }, p);
    expect(r.status).toBe('ok');
    if (r.status === 'ok' && r.resultado.destino === 'cliente') {
      expect(r.resultado.propuesta.nombre).toBe('Ferretería El Tornillo');
    }
  });

  it('una pregunta del backend (texto sin card) vuelve como respuesta_sin_card con su texto', async () => {
    const { p } = puertos([respuesta(6, { id: 6, text: '¿Cuánto fue?' })]);
    const r = await dictarPorChat({ destino: 'gasto', texto: 'x', sessionId: 's' }, p);
    expect(r).toMatchObject({ status: 'sin_propuesta', motivo: 'respuesta_sin_card', texto: '¿Cuánto fue?' });
  });

  it('sin respuesta dentro del plazo: timeout (y no cuelga)', async () => {
    const { p } = puertos([]);
    const r = await dictarPorChat(
      { destino: 'gasto', texto: 'x', sessionId: 's', timeoutMs: 3000, intervaloMs: 1000 },
      p,
    );
    expect(r).toMatchObject({ status: 'sin_propuesta', motivo: 'timeout' });
  });

  it('un fallo de red en un poll NO aborta: el siguiente tick reintenta', async () => {
    const { p } = puertos([new Error('red'), respuesta(6, { id: 6, card: CARD_GASTO })]);
    const r = await dictarPorChat({ destino: 'gasto', texto: 'x', sessionId: 's' }, p);
    expect(r.status).toBe('ok');
  });

  it('no puede enviar → error_envio, sin lanzar y sin pollear', async () => {
    const { p, leer } = puertos([], new Error('401'));
    const r = await dictarPorChat({ destino: 'gasto', texto: 'x', sessionId: 's' }, p);
    expect(r).toMatchObject({ status: 'sin_propuesta', motivo: 'error_envio' });
    expect(leer).not.toHaveBeenCalled();
  });

  it('accepted:false → error_envio (el workflow no arrancó: no hay hilo que leer)', async () => {
    const { p, leer } = puertos([], { wf_id: '', accepted: false, session_id: EFECTIVA });
    const r = await dictarPorChat({ destino: 'gasto', texto: 'x', sessionId: 's' }, p);
    expect(r).toMatchObject({ status: 'sin_propuesta', motivo: 'error_envio' });
    expect(leer).not.toHaveBeenCalled();
  });

  it('🔴 respuesta sin session_id (backend anterior) → error_envio, NO adivina el hilo', async () => {
    const { p, leer } = puertos([respuesta(6, { id: 6, card: CARD_GASTO })], { wf_id: 'wf-1', accepted: true });
    const r = await dictarPorChat({ destino: 'gasto', texto: 'x', sessionId: 's' }, p);
    expect(r).toMatchObject({ status: 'sin_propuesta', motivo: 'error_envio' });
    expect(leer).not.toHaveBeenCalled();
  });
});
