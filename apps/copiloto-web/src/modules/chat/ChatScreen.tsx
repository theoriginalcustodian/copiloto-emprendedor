import { useCallback, useEffect, useRef } from 'react';

import { tomarPendiente } from '@copiloto/core';

import { Composer } from './Composer';
import { MessageList } from './MessageList';
import { SheetRequiereConexion } from './SheetRequiereConexion';
import { useChat } from './useChat';
import { useConexionRequerida } from './useConexionRequerida';
import './chat.css';

const WELCOME_TEXT =
  'Contame qué necesitás y lo hago. Antes de tocar nada —cobrar, agendar, mandar un mail— siempre te pido que confirmes.';

/**
 * Pantalla de Chat completa. Toda la lógica de envío/polling/durabilidad vive en `useChat`; acá
 * SOLO presentación, reusándolo tal cual.
 *
 * Chrome del MÓVIL (pedido del operador 2026-07-04): el móvil NO lleva header — ni el `StatusBar`
 * mock (hora/batería; ya la pinta el OS) ni el header de marca `ChatHeader` ("Copiloto" · ES-AR ·
 * "en línea · durable" · avatar/contador). La interfaz arranca lo más limpia posible: directo con
 * los mensajes + el composer. El logout vive en Cuenta (AccountScreen). El ESCRITORIO también
 * arranca sin header (pedido operador 2026-07-04): solo el chat, sin la barra de sesión ni el botón
 * "Nueva conversación".
 *
 * `handleSend` reenvía la `key` del modo activo (leída por `Composer` desde `useMode()`) a
 * `useChat().send(text, { mode })`. `handleSendAudio` reenvía el blob grabado por `Composer`/
 * `MicButton` a `useChat().sendAudio(blob)` — es la única instancia de `useChat()` (el estado
 * de mensajes/polling vive acá).
 */
export interface ChatScreenProps {
  /** Hide-on-scroll (EXTRACT §2.3): el shell lo usa para ocultar la tab-bar al scrollear el chat.
   * Opcional — el ChatScreen corre standalone (sin shell) sin él. */
  onHideChange?: (hidden: boolean) => void;
  /** Tap en el área de mensajes que NO cae sobre un control: el shell lo usa para togglear el chrome
   * (tab-bar + composer). Sólo el shell mobile lo pasa. */
  onSurfaceTap?: () => void;
  /**
   * `'desktop'` aplica ajustes de escritorio (sin `onSurfaceTap` ni marker de sesión); NINGÚN
   * variant monta header ni hint del composer (pedido operador 2026-07-04: solo el chat). Lo setea
   * `DesktopShell`.
   */
  variant?: 'mobile' | 'desktop';
  /** D14 — id de cliente a abrir en el tab Clientes (botón "Ver cliente" de
   * `TarjetaClientePropuesto` en `ya_existe`). Lo pasan ambos shells (`abrirCliente`). */
  onAbrirCliente?: (id: number) => void;
  /** D12 — navega a `PantallaFacturacion` sobre el `facturaId` de una `factura_propuesta`
   * incompleta (botón "Completar a mano" de `TarjetaFacturaPropuesta`). Ambos shells pasan el mismo
   * `irAFacturar` que ya usa `PresupuestosScreen` — mismo handoff, sin estado nuevo. */
  onFacturar?: (facturaId: string) => void;
}

export function ChatScreen({
  onHideChange,
  onSurfaceTap,
  variant = 'mobile',
  onAbrirCliente,
  onFacturar,
}: ChatScreenProps = {}) {
  const { messages, sendStatus, send, sendAudio } = useChat();
  const isDesktop = variant === 'desktop';
  // K-11 / BL-J8: gate `requiere_conexion` → sheet en contexto; al volver de conectar se reenvía el pedido.
  const conexion = useConexionRequerida(messages, send);

  // BL-W9: una pantalla de ayuda dejó una pregunta en el buzón — se manda al montar el chat, UNA vez
  // (`tomarPendiente` vacía el buzón, así que no se reenvía sola al volver a esta pantalla).
  useEffect(() => {
    const pendiente = tomarPendiente();
    if (pendiente != null) void send(pendiente, { mode: null });
  }, [send]);

  const handleSend = useCallback(
    (text: string, mode: string | null) => void send(text, { mode }),
    [send],
  );
  // BL-D4: `label` es lo que el usuario vio y "eligió" (p. ej. "Cancelar") — se pinta en su burbuja
  // optimista. `value` es el token técnico que espera el backend (`cancel:<turn>:<step>`) y sigue
  // siendo lo que se manda en el POST; nunca se muestra.
  const handleChoice = useCallback(
    (value: string, label: string) => void send(value, { kind: 'callback', displayText: label }),
    [send],
  );
  // BL-J7 (H-A3-7) — mismo patrón que `MicFuncion.tsx`: el instante del `pointerdown` (vía
  // `onRecordingStart`, ya expuesto por `MicButton`) mide la duración del dictado para el chip
  // «Por voz · Ns» de la burbuja, sin duplicar el cronómetro interno de `MicButton`.
  const inicioMsRef = useRef(0);
  const handleRecordingStart = useCallback(() => {
    inicioMsRef.current = Date.now();
  }, []);
  const handleSendAudio = useCallback(
    (blob: Blob) => {
      const duracionSeg = Math.max(1, Math.round((Date.now() - inicioMsRef.current) / 1000));
      void sendAudio(blob, duracionSeg);
    },
    [sendAudio],
  );

  return (
    <div className="app-frame chat-screen" data-testid="chat-screen">
      <MessageList
        messages={messages}
        onChoice={handleChoice}
        emptyHint={WELCOME_TEXT}
        onHideChange={onHideChange}
        onSurfaceTap={isDesktop ? undefined : onSurfaceTap}
        sessionMarker={isDesktop ? undefined : 'SESIÓN ACTIVA · HOY'}
        onAbrirCliente={onAbrirCliente}
        onFacturar={onFacturar}
      />
      <Composer
        sendStatus={sendStatus}
        onSend={handleSend}
        onSendAudio={handleSendAudio}
        onRecordingStart={handleRecordingStart}
      />
      <SheetRequiereConexion
        conexion={conexion.pendiente?.conexion ?? null}
        onConectar={conexion.conectar}
        onAhoraNo={conexion.ahoraNo}
        ocupado={conexion.ocupado}
        error={conexion.error}
      />
    </div>
  );
}
