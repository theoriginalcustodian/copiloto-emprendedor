import { act, renderHook } from '@testing-library/react-native';

import type { ChatRequest, ChatResponse, ReplyResponse } from '@copiloto/core';

import { AVISO_DICTADO_FACTURA, AVISO_DICTADO_NO_ENTENDIDO, useDictadoFactura } from './useDictadoFactura';

const ACEPTADO = (sid: string): ChatResponse => ({ wf_id: 'wf', accepted: true, session_id: sid });
const PREGUNTA: ReplyResponse = { next_id: 7, replies: [{ id: 7, text: '¿A quién le facturo?', card: undefined as never }] };
const CARD: ReplyResponse = {
  next_id: 9,
  replies: [{ id: 9, text: '', card: { kind: 'factura_propuesta', data: { factura_id: 'fac-9', faltantes: [], items: [], total: '1500.00' } } as never }],
};

function puertos(lecturas: ReplyResponse[]) {
  const enviadas: ChatRequest[] = [];
  const leidas: Array<[string, number]> = [];
  const cola = [...lecturas];
  return {
    enviadas,
    leidas,
    p: {
      enviar: async (req: ChatRequest) => {
        enviadas.push(req);
        return ACEPTADO(req.session_id);
      },
      leer: async (sid: string, desde: number) => {
        leidas.push([sid, desde]);
        return cola.shift() ?? { next_id: 999, replies: [] };
      },
      esperar: async () => {},
    },
  };
}

describe('useDictadoFactura (mobile) — hilo abierto en el dictado incompleto', () => {
  it('1er turno sin card deja la PREGUNTA; el 2º turno va por la MISMA sesión desde el cursor y devuelve la card', async () => {
    const { p, enviadas, leidas } = puertos([PREGUNTA, CARD]);
    const { result } = await renderHook(() => useDictadoFactura(p));

    let r1: unknown;
    await act(async () => {
      r1 = await result.current.dictar('una factura');
    });
    expect(r1).toBeNull();
    expect(result.current.pregunta).toBe('¿A quién le facturo?');

    let r2: { facturaId: string } | null = null;
    await act(async () => {
      r2 = await result.current.dictar('a Pérez por 1500');
    });

    expect(enviadas).toHaveLength(2);
    expect(enviadas[1]!.session_id).toBe(enviadas[0]!.session_id); // mismo hilo
    expect(enviadas[1]!.kind).toBe('dictado:factura');
    expect(leidas[1]).toEqual([enviadas[0]!.session_id, 7]); // desde el cursor, no desde 0
    expect(r2).toMatchObject({ facturaId: 'fac-9' });
    expect(result.current.pregunta).toBeNull();
  });

  it('tras una card el hilo se cierra: el dictado siguiente arranca sesión nueva', async () => {
    const { p, enviadas } = puertos([CARD, CARD]);
    const { result } = await renderHook(() => useDictadoFactura(p));
    await act(async () => {
      await result.current.dictar('factura completa');
    });
    await act(async () => {
      await result.current.dictar('otra factura completa');
    });
    expect(enviadas[1]!.session_id).not.toBe(enviadas[0]!.session_id);
  });

  it('un fallo de envío deja el aviso del degradado y cierra el hilo (el timeout lo cubre core)', async () => {
    const p = {
      enviar: async () => {
        throw new Error('red');
      },
      leer: async () => ({ next_id: 0, replies: [] }),
      esperar: async () => {},
    };
    const { result } = await renderHook(() => useDictadoFactura(p));
    let r: unknown = 'pendiente';
    await act(async () => {
      r = await result.current.dictar('una factura');
    });
    expect(r).toBeNull();
    expect(result.current.aviso).toBe(AVISO_DICTADO_FACTURA.error_envio);
    expect(result.current.pregunta).toBeNull();
  });
});

describe('useDictadoFactura (mobile) — SM-P14 plausibilidad del 1er turno', () => {
  it.each(['El', '  ', '', 'Gracias.'])('un 1er turno de una palabra o vacío («%s») NO llega al backend: avisa «no te escuché»', async (texto) => {
    const { p, enviadas } = puertos([CARD]);
    const { result } = await renderHook(() => useDictadoFactura(p));
    let r: unknown = 'sin-llamar';
    await act(async () => {
      r = await result.current.dictar(texto);
    });
    expect(r).toBeNull();
    expect(enviadas).toHaveLength(0);
    expect(result.current.aviso).toBe(AVISO_DICTADO_NO_ENTENDIDO);
    expect(result.current.pregunta).toBeNull();
  });

  it('control positivo: dos palabras («una factura») SÍ viajan', async () => {
    const { p, enviadas } = puertos([PREGUNTA]);
    const { result } = await renderHook(() => useDictadoFactura(p));
    await act(async () => {
      await result.current.dictar('una factura');
    });
    expect(enviadas).toHaveLength(1);
    expect(result.current.aviso).toBeNull();
  });

  it('con el hilo abierto, la respuesta de UNA palabra («5000») es legítima y viaja por el mismo hilo', async () => {
    const { p, enviadas } = puertos([PREGUNTA, CARD]);
    const { result } = await renderHook(() => useDictadoFactura(p));
    await act(async () => {
      await result.current.dictar('una factura');
    });
    await act(async () => {
      await result.current.dictar('5000');
    });
    expect(enviadas).toHaveLength(2);
    expect(enviadas[1]!.session_id).toBe(enviadas[0]!.session_id);
  });
});
