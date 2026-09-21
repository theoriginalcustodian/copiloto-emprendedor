import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { pedirLinkDeVinculacion, conexionEstablecida } = vi.hoisted(() => ({
  pedirLinkDeVinculacion: vi.fn(),
  conexionEstablecida: vi.fn(),
}));

vi.mock('@copiloto/core', async (orig) => ({
  ...(await orig<typeof import('@copiloto/core')>()),
  pedirLinkDeVinculacion,
  conexionEstablecida,
}));

import type { ChatMessage } from '@copiloto/core';

import { useConexionRequerida } from './useConexionRequerida';

const CARD = {
  kind: 'requiere_conexion',
  service: 'gmail',
  label: 'Gmail',
  alcance: ['Leer mails'],
  connect_path: '/composio/connect?service=gmail',
};
const HILO: ChatMessage[] = [
  { id: 'u1', role: 'user', text: 'mandale un mail a Juan' },
  { id: 'a1', role: 'assistant', text: 'Para eso necesito que conectes Gmail primero.', card: CARD },
];

describe('useConexionRequerida (K-11 / BL-J8)', () => {
  beforeEach(() => {
    sessionStorage.clear();
    pedirLinkDeVinculacion.mockReset();
    conexionEstablecida.mockReset();
    conexionEstablecida.mockResolvedValue(false);
  });

  it('sólo hay gate con card requiere_conexion en el último mensaje', () => {
    const { result: con } = renderHook(() => useConexionRequerida(HILO, vi.fn(), vi.fn()));
    expect(con.current.pendiente?.conexion.service).toBe('gmail');

    const sinCard: ChatMessage[] = [HILO[0]!, { id: 'a1', role: 'assistant', text: 'ok' }];
    const { result: sin } = renderHook(() => useConexionRequerida(sinCard, vi.fn(), vi.fn()));
    expect(sin.current.pendiente).toBeNull();
  });

  it('«Ahora no» cierra el sheet sin navegar ni reenviar', () => {
    const irA = vi.fn();
    const send = vi.fn();
    const { result } = renderHook(() => useConexionRequerida(HILO, send, irA));

    act(() => result.current.ahoraNo());

    expect(result.current.pendiente).toBeNull();
    expect(irA).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
    expect(pedirLinkDeVinculacion).not.toHaveBeenCalled();
  });

  it('«Conectar» pide el link con el connect_path de la card y navega; guarda el pedido original', async () => {
    pedirLinkDeVinculacion.mockResolvedValue({ status: 'ok', url: 'https://accounts.google.com/x' });
    const irA = vi.fn();
    const { result } = renderHook(() => useConexionRequerida(HILO, vi.fn(), irA));

    act(() => result.current.conectar());

    await waitFor(() => expect(irA).toHaveBeenCalledWith('https://accounts.google.com/x'));
    expect(pedirLinkDeVinculacion).toHaveBeenCalledWith('/composio/connect?service=gmail');
    expect(JSON.parse(sessionStorage.getItem('copiloto.conexion.pendiente') ?? 'null')).toEqual({
      service: 'gmail',
      texto: 'mandale un mail a Juan',
    });
  });

  it('link no disponible: muestra error y NO navega', async () => {
    pedirLinkDeVinculacion.mockResolvedValue({ status: 'no_disponible' });
    const irA = vi.fn();
    const { result } = renderHook(() => useConexionRequerida(HILO, vi.fn(), irA));

    act(() => result.current.conectar());

    await waitFor(() => expect(result.current.error).toContain('Gmail'));
    expect(irA).not.toHaveBeenCalled();
  });

  it('al volver conectado reenvía el texto original UNA vez, sin acción manual', async () => {
    sessionStorage.setItem('copiloto.conexion.pendiente', JSON.stringify({ service: 'gmail', texto: 'mandale un mail a Juan' }));
    conexionEstablecida.mockResolvedValue(true);
    const send = vi.fn();
    renderHook(() => useConexionRequerida([], send, vi.fn()));

    await waitFor(() => expect(send).toHaveBeenCalledWith('mandale un mail a Juan', { mode: null }));
    // un segundo evento de foco no reenvía (se limpió antes de enviar)
    document.dispatchEvent(new Event('visibilitychange'));
    await new Promise((r) => setTimeout(r, 20));
    expect(send).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem('copiloto.conexion.pendiente')).toBeNull();
  });

  it('al volver SIN conectar (catálogo dice no) NO reenvía', async () => {
    sessionStorage.setItem('copiloto.conexion.pendiente', JSON.stringify({ service: 'gmail', texto: 'x' }));
    conexionEstablecida.mockResolvedValue(false);
    const send = vi.fn();
    renderHook(() => useConexionRequerida([], send, vi.fn()));

    await waitFor(() => expect(conexionEstablecida).toHaveBeenCalledWith('gmail'));
    expect(send).not.toHaveBeenCalled();
  });
});
