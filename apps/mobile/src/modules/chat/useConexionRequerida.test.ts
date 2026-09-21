/**
 * K-11 / BL-J8 — el flujo Conectar → volver del navegador → reenviar el pedido original.
 */
jest.mock('@copiloto/core', () => {
  const actual = jest.requireActual('@copiloto/core');
  return { ...actual, pedirLinkDeVinculacion: jest.fn(), conexionEstablecida: jest.fn() };
});

import { act, renderHook, waitFor } from '@testing-library/react-native';
import { AppState, Linking } from 'react-native';

import { conexionEstablecida, pedirLinkDeVinculacion, type ChatMessage } from '@copiloto/core';

import { useConexionRequerida } from './useConexionRequerida';

const pedirLink = pedirLinkDeVinculacion as jest.MockedFunction<typeof pedirLinkDeVinculacion>;
const establecida = conexionEstablecida as jest.MockedFunction<typeof conexionEstablecida>;

const CARD = { kind: 'requiere_conexion', service: 'gmail', label: 'Gmail', alcance: ['Leer mails'], connect_path: '/composio/connect?service=gmail' };
const HILO: ChatMessage[] = [
  { id: 'u1', role: 'user', text: 'mandale un mail a Juan' },
  { id: 'a1', role: 'assistant', text: 'Para eso necesito que conectes Gmail primero.', card: CARD },
];

let alCambiarAppState: (estado: string) => void = () => {};

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(AppState, 'addEventListener').mockImplementation(((_: string, fn: (s: string) => void) => {
    alCambiarAppState = fn;
    return { remove: jest.fn() };
  }) as never);
  jest.spyOn(Linking, 'canOpenURL').mockResolvedValue(true);
  jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
  establecida.mockResolvedValue(false);
});

describe('useConexionRequerida (mobile)', () => {
  it('sólo hay gate con card requiere_conexion en el último mensaje', async () => {
    const con = await renderHook(() => useConexionRequerida(HILO, jest.fn()));
    expect(con.result.current.pendiente?.conexion.service).toBe('gmail');
    const sin = await renderHook(() => useConexionRequerida([HILO[0]!, { id: 'a1', role: 'assistant', text: 'ok' }], jest.fn()));
    expect(sin.result.current.pendiente).toBeNull();
  });

  it('«Ahora no» cierra sin abrir el navegador ni reenviar', async () => {
    const send = jest.fn();
    const { result } = await renderHook(() => useConexionRequerida(HILO, send));
    await act(async () => result.current.ahoraNo());
    expect(result.current.pendiente).toBeNull();
    expect(pedirLink).not.toHaveBeenCalled();
    expect(Linking.openURL).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it('Conectar abre el link del connect_path; al volver conectado reenvía el pedido original UNA vez', async () => {
    pedirLink.mockResolvedValue({ status: 'ok', url: 'https://accounts.google.com/x' });
    const send = jest.fn();
    const { result } = await renderHook(() => useConexionRequerida(HILO, send));

    await act(async () => result.current.conectar());
    await waitFor(() => expect(Linking.openURL).toHaveBeenCalledWith('https://accounts.google.com/x'));
    expect(pedirLink).toHaveBeenCalledWith('/composio/connect?service=gmail');

    establecida.mockResolvedValue(true);
    await act(async () => alCambiarAppState('active'));
    await waitFor(() => expect(send).toHaveBeenCalledWith('mandale un mail a Juan'));
    await act(async () => alCambiarAppState('active'));
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('volver SIN haber conectado (catálogo dice no) NO reenvía', async () => {
    pedirLink.mockResolvedValue({ status: 'ok', url: 'https://accounts.google.com/x' });
    const send = jest.fn();
    const { result } = await renderHook(() => useConexionRequerida(HILO, send));
    await act(async () => result.current.conectar());
    await waitFor(() => expect(Linking.openURL).toHaveBeenCalled());

    await act(async () => alCambiarAppState('active'));
    await waitFor(() => expect(establecida).toHaveBeenCalledWith('gmail'));
    expect(send).not.toHaveBeenCalled();
  });

  it('link no disponible: error y no se abre nada', async () => {
    pedirLink.mockResolvedValue({ status: 'no_disponible' });
    const { result } = await renderHook(() => useConexionRequerida(HILO, jest.fn()));
    await act(async () => result.current.conectar());
    await waitFor(() => expect(result.current.error).toContain('Gmail'));
    expect(Linking.openURL).not.toHaveBeenCalled();
  });
});
