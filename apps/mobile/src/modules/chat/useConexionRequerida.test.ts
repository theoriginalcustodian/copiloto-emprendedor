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
    const con = await renderHook(() => useConexionRequerida(HILO, jest.fn(), jest.fn()));
    expect(con.result.current.pendiente?.conexion.service).toBe('gmail');
    const sin = await renderHook(() =>
      useConexionRequerida([HILO[0]!, { id: 'a1', role: 'assistant', text: 'ok' }], jest.fn(), jest.fn()),
    );
    expect(sin.result.current.pendiente).toBeNull();
  });

  it('«Ahora no» cierra sin abrir el navegador ni reenviar, y delega la marca a `descartarConexion`', async () => {
    const send = jest.fn();
    const descartarConexion = jest.fn();
    const { result } = await renderHook(() => useConexionRequerida(HILO, send, descartarConexion));
    await act(async () => result.current.ahoraNo());
    // La marca ya no vive en un `useState` local -- se delega al caller (`useChat.descartarConexion`),
    // que la persiste DENTRO del mensaje (`conexionDescartada`). Este hook no decide "descartado":
    // sólo pide la transición y deriva `pendiente` de `messages` en el próximo render (ver test de
    // persistencia más abajo, con `messages` ya marcado).
    expect(descartarConexion).toHaveBeenCalledWith('a1');
    expect(pedirLink).not.toHaveBeenCalled();
    expect(Linking.openURL).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it('Conectar abre el link del connect_path; al volver conectado reenvía el pedido original UNA vez', async () => {
    pedirLink.mockResolvedValue({ status: 'ok', url: 'https://accounts.google.com/x' });
    const send = jest.fn();
    const { result } = await renderHook(() => useConexionRequerida(HILO, send, jest.fn()));

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
    const { result } = await renderHook(() => useConexionRequerida(HILO, send, jest.fn()));
    await act(async () => result.current.conectar());
    await waitFor(() => expect(Linking.openURL).toHaveBeenCalled());

    await act(async () => alCambiarAppState('active'));
    await waitFor(() => expect(establecida).toHaveBeenCalledWith('gmail'));
    expect(send).not.toHaveBeenCalled();
  });

  it('link no disponible: error y no se abre nada', async () => {
    pedirLink.mockResolvedValue({ status: 'no_disponible' });
    const { result } = await renderHook(() => useConexionRequerida(HILO, jest.fn(), jest.fn()));
    await act(async () => result.current.conectar());
    await waitFor(() => expect(result.current.error).toContain('Gmail'));
    expect(Linking.openURL).not.toHaveBeenCalled();
  });

  // K-11 / BL-J8 Parte 1 -- el bug medido en prod (BL-V29, aplicado a mobile): antes, «Ahora no»
  // vivía en un `useState<ReadonlySet<string>>` local que se perdía en cada remonte/reload, aunque
  // el historial de `messages` sí se persistía intacto -- el sheet reaparecía para una card ya
  // descartada. Ahora la marca vive DENTRO del mensaje persistido (`conexionDescartada`), así que
  // `descartados` se DERIVA de `messages`, no de un estado propio del hook.
  describe('persistencia del descarte a través de un remonte (DoD, control positivo/negativo)', () => {
    it('(a) card activa SIN descarte previo -> la hoja se muestra normalmente', async () => {
      const { result } = await renderHook(() => useConexionRequerida(HILO, jest.fn(), jest.fn()));
      expect(result.current.pendiente?.mensajeId).toBe('a1');
    });

    it('(b) card descartada -> sobrevive a un remonte (nuevo hook con los MISMOS `messages` ya marcados) -> la hoja NO se muestra', async () => {
      // Simula lo que `useChat.descartarConexion` + `persistirMensajes` deja en el mensaje tras
      // «Ahora no», y lo que `leerMensajesPersistidos` devuelve al volver a montar (mismo array, ya
      // con la marca -- no hay estado de React que sobreviva un remonte real, sólo el dato).
      const hiloTrasDescartar: ChatMessage[] = [
        HILO[0]!,
        { ...(HILO[1]! as ChatMessage), conexionDescartada: true },
      ];

      // CONTROL NEGATIVO (revierte el fix): si `descartados` todavía viniera de un `useState` local
      // en vez de derivarse de `messages`, este segundo `renderHook` -- que es un montaje NUEVO, sin
      // memoria del `ahoraNo` de una instancia anterior -- volvería a mostrar la hoja. Sólo pasa
      // porque la marca viaja en el propio `mensaje`, no en un estado efímero del hook.
      const { result } = await renderHook(() => useConexionRequerida(hiloTrasDescartar, jest.fn(), jest.fn()));
      expect(result.current.pendiente).toBeNull();
    });

    it('(c) un mensaje NUEVO del asistente tras el descarte se evalúa desde cero -- una card nueva no hereda la marca de una vieja', async () => {
      const hiloConCardNueva: ChatMessage[] = [
        HILO[0]!,
        { ...(HILO[1]! as ChatMessage), conexionDescartada: true }, // la vieja, ya descartada
        { id: 'u2', role: 'user', text: 'ahora mandale un mail a María' },
        {
          id: 'a2',
          role: 'assistant',
          text: 'Para eso necesito que conectes Gmail primero.',
          card: CARD, // card NUEVA, mismo servicio, mensaje distinto -- sin `conexionDescartada`
        },
      ];

      const { result } = await renderHook(() => useConexionRequerida(hiloConCardNueva, jest.fn(), jest.fn()));
      expect(result.current.pendiente?.mensajeId).toBe('a2');
      expect(result.current.pendiente?.textoOriginal).toBe('ahora mandale un mail a María');
    });
  });
});
