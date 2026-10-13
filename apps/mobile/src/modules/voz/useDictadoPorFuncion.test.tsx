import { act, renderHook } from '@testing-library/react-native';

import type { ChatRequest, ChatResponse, PuertosDictado, ReplyResponse } from '@copiloto/core';

import { almacenClave } from '../../adapters/almacen';
import { AVISO_DICTADO, useDictadoPorFuncion } from './useDictadoPorFuncion';

const EFECTIVA = 'dictado:gasto:abc';

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

function reply(...replies: Array<{ id: number; text?: string; card?: unknown }>): ReplyResponse {
  return { next_id: replies.length === 0 ? 0 : replies[replies.length - 1].id, replies: replies.map((r) => ({ id: r.id, text: r.text ?? '', card: r.card as never })) };
}

function puertos(lectura: ReplyResponse | Error, envio: ChatResponse | Error = { wf_id: 'w', accepted: true, session_id: EFECTIVA }) {
  const enviar = jest.fn<Promise<ChatResponse>, [ChatRequest]>();
  if (envio instanceof Error) enviar.mockRejectedValue(envio);
  else enviar.mockResolvedValue(envio);
  const leer = jest.fn<Promise<ReplyResponse>, [string, number]>();
  if (lectura instanceof Error) leer.mockRejectedValue(lectura);
  else leer.mockResolvedValue(lectura);
  const p: PuertosDictado = { enviar, leer, esperar: async () => {} };
  return { p, enviar, leer };
}

describe('useDictadoPorFuncion', () => {
  it('manda kind=dictado:<destino> y devuelve la propuesta del motor', async () => {
    const { p, enviar } = puertos(reply({ id: 1, card: CARD_GASTO }));
    const { result } = await renderHook(() => useDictadoPorFuncion('gasto', { puertos: p }));
    let r: Awaited<ReturnType<typeof result.current.dictar>> = null;
    await act(async () => {
      r = await result.current.dictar('pagué 15 mil de mercadería');
    });
    expect(enviar).toHaveBeenCalledTimes(1);
    expect(enviar.mock.calls[0][0]).toMatchObject({ text: 'pagué 15 mil de mercadería', kind: 'dictado:gasto' });
    expect(r).toMatchObject({ monto: '15000.00', categoria: 'mercaderia', proveedor: 'Distribuidora Sur' });
    expect(result.current.ocupado).toBe(false);
    expect(result.current.aviso).toBeNull();
  });

  it('🔴 no toca el hilo del chat: sesión nueva por dictado y NADA en el almacén', async () => {
    const guardar = jest.spyOn(almacenClave, 'guardar');
    const { p, enviar } = puertos(reply({ id: 1, card: CARD_GASTO }));
    const { result } = await renderHook(() => useDictadoPorFuncion('gasto', { puertos: p }));
    await act(async () => {
      await result.current.dictar('uno');
    });
    await act(async () => {
      await result.current.dictar('dos');
    });
    const [a, b] = enviar.mock.calls.map((c) => c[0].session_id);
    // Un id fresco por dictado: nunca comparte log con el hilo ni con el dictado anterior.
    expect(a).not.toBe(b);
    // El hilo del chat persiste sus mensajes por el almacén; el dictado no escribe nada ahí.
    expect(guardar).not.toHaveBeenCalled();
    // Control positivo: el espía SÍ ve una escritura (si no, el `not.toHaveBeenCalled` de arriba no probaría nada).
    await almacenClave.guardar('control', 'x');
    expect(guardar).toHaveBeenCalledTimes(1);
    guardar.mockRestore();
  });

  it('falla de red: null + aviso visible (no degrada en silencio)', async () => {
    const { p } = puertos(reply(), new Error('401'));
    const { result } = await renderHook(() => useDictadoPorFuncion('gasto', { puertos: p }));
    let r: unknown = 'x';
    await act(async () => {
      r = await result.current.dictar('algo');
    });
    expect(r).toBeNull();
    expect(result.current.aviso).toBe(AVISO_DICTADO.error_envio);
  });

  it('el backend contesta sin la card (una pregunta): null + aviso distinto al de red', async () => {
    const { p } = puertos(reply({ id: 1, text: '¿Cuánto fue?' }));
    const { result } = await renderHook(() => useDictadoPorFuncion('gasto', { puertos: p }));
    await act(async () => {
      await result.current.dictar('algo');
    });
    expect(result.current.aviso).toBe(AVISO_DICTADO.respuesta_sin_card);
    expect(AVISO_DICTADO.respuesta_sin_card).not.toBe(AVISO_DICTADO.error_envio);
  });

  it('un dictado nuevo limpia el aviso del anterior', async () => {
    const { p, leer } = puertos(reply({ id: 1, text: '¿Cuánto fue?' }));
    const { result } = await renderHook(() => useDictadoPorFuncion('gasto', { puertos: p }));
    await act(async () => {
      await result.current.dictar('algo');
    });
    expect(result.current.aviso).not.toBeNull();
    leer.mockResolvedValue(reply({ id: 2, card: CARD_GASTO }));
    await act(async () => {
      await result.current.dictar('15 mil de mercadería');
    });
    expect(result.current.aviso).toBeNull();
  });

  it('un solo dictado en vuelo: el segundo devuelve null (la pantalla precarga el crudo, no lo pierde)', async () => {
    let soltar: (() => void) | undefined;
    const bloqueo = new Promise<void>((r) => {
      soltar = r;
    });
    const { p, enviar } = puertos(reply({ id: 1, card: CARD_GASTO }));
    p.esperar = () => bloqueo;
    const { result } = await renderHook(() => useDictadoPorFuncion('gasto', { puertos: p }));
    let primero: Promise<unknown> = Promise.resolve();
    let segundo: unknown = 'x';
    await act(async () => {
      primero = result.current.dictar('uno');
      segundo = await result.current.dictar('dos');
    });
    expect(segundo).toBeNull();
    expect(enviar).toHaveBeenCalledTimes(1);
    await act(async () => {
      soltar?.();
      await primero;
    });
  });
});
