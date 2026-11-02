import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { KeyboardAvoidingView, Pressable, StyleSheet, Text, View } from 'react-native';
import type { FlatList } from 'react-native-gesture-handler';

import { ROTULO_VOLVER_AL_TABLERO, type ArchivoSubida, type AvisoAlChat, type CierreAviso } from '@copiloto/core';

import { useSession } from '../auth/useSession';
import { DockEntrada } from './DockEntrada';
import { IndicadorModoCeremonia } from './IndicadorModoCeremonia';
import { ListaMensajes } from './ListaMensajes';
import { tomarPendiente } from './mensajePendiente';
import { useCapturaFoto } from './useCapturaFoto';
import { SheetRequiereConexion } from './SheetRequiereConexion';
import { PRESS_FADE, pressableStyle } from '../../theme/glass/presion';
import { useTema } from '../../theme/ThemeProvider';
import { useChat } from './useChat';
import { useConexionRequerida } from './useConexionRequerida';

export interface ChatViewProps {
  /**
   * `hitl (a)` — el aviso de una tarjeta de Mi día que el emprendedor llevó al chat. Entra **sembrado en
   * el composer** (lo manda él) y trae el chip «Desde tu aviso · …». `id` crece con cada aviso: el mismo
   * aviso dos veces vuelve a sembrar. Lo dueña quien monta el chat (`PantallaPrincipal`), porque Mi día
   * y el chat son la MISMA pantalla — no hay navegación ni buzón de módulo de por medio.
   */
  avisoEntrante?: { aviso: AvisoAlChat; id: number } | null;
  /**
   * La salida del chip: baja la conversación y devuelve al tablero. Sin ella el chip no la ofrece.
   * El chip la llama SIN argumento (salir de la charla no resuelve la tarjeta); con un `CierreAviso`
   * `hecha` el shell además cierra la tarjeta de origen (a.5 — lo invoca el recibo, a.4, de frontend1).
   */
  onVolverAlTablero?: (cierre?: CierreAviso) => void;
  /**
   * SM-I2 — lo que se grabó en el dock de Mi día, que vive en la misma pantalla: baja por props, como
   * `avisoEntrante`. `id` crece con cada audio.
   */
  audioEntrante?: { audio: ArchivoSubida; duracionSeg: number; id: number } | null;
}

/**
 * El copiloto: lista de mensajes + dock de entrada (`DockEntrada`: campo + mic chico). Fork mobile de `ChatView.tsx` de
 * DocuMed (`_staging/documed/apps/mobile/src/modules/chat/ChatView.tsx`), ahora con voz-comando (F6)
 * cableada:
 *
 * 🔴 **Lo que el origen tenía y este módulo SIGUE sin portar, a propósito:**
 *  - **Selector de cliente activo / toggle de modo** (`usePacienteActivo`/`ModoClinicoToggle`) — no
 *    existe todavía ningún selector de cliente en NINGÚN shell del copiloto (verificado leyendo
 *    `apps/copiloto-web/src/modules/chat/useChat.ts`, la versión en producción, antes de portar: ni
 *    ella lo manda). Sin ese selector no hay `cliente_id`/`alcance`/`modo` honestos que mandar — ver
 *    el docstring de `useChat.ts`.
 *  - **Artefactos post-confirmación** (`useArtefactosClinicos`/`TarjetaArtefacto`) — específicos de
 *    DocuMed (persistencia de nota clínica + PDF), sin equivalente en este sprint.
 *
 * 🔴 **Dictado por voz (F6) — hold-graba / soltar-envía / deslizar-fija, SIN glass.** Reescrito contra
 * `contrato_planificacion-a-frontend_dictado-por-voz-sin-glass-hold-graba-soltar-envia-deslizar-fija`:
 * la versión anterior (toque simple → HUD glass) mis-citó una decisión de RETENCIÓN de audio (D6) como
 * si fuera autoridad de una decisión de UX nunca tomada. Ver el docstring de `useVozComando.ts` y
 * `BotonVoz.tsx` para el resto. El único feedback visual es la onda flotante (`Onda`) + los controles
 * flotantes (`ControlesFlotantes`) una vez que el usuario desliza para fijar — nunca un glass.
 *
 * 🔴 **`scrollRef` es la costura de la composición de gestos.** `BotonVoz` queda sobre
 * `ListaMensajes` y su gesto necesita saber del `FlatList` de la lista (`simultaneousWithExternalGesture`, C6: antes era un `ScrollView`) para no comerle el toque ni
 * que el scroll se lo coma a él — es la causa raíz del bug de device que este contrato vino a cerrar
 * (§2 del contrato).
 *
 * 🔴 **Foto de ticket (Gastos Fase 2) — botón dentro del `Composer`, no overlay.** A diferencia de
 * la voz, elegir una foto (`useCapturaFoto`) es una sola llamada async sin fases que animar -- ver
 * el docstring de `Composer.onFoto` para el porqué de la excepción a "sin botones de acción propios".
 *
 * Toda la lógica de envío/polling/durabilidad (texto, voz Y foto) vive en `useChat`; este componente
 * sólo arma los callbacks que conectan la vista con esa máquina.
 *
 * 🔴 **Sin fondo ni título propios.** Vive DENTRO del panel de vidrio (`PanelDeslizable`, fuera de
 * este ownership) que ya aporta el chrome — mismo criterio que `PantallaFacturacion`/`PantallaApps`
 * en `escritorio/`. Un `backgroundColor` acá taparía el vidrio detrás.
 */
export function ChatView({ avisoEntrante = null, onVolverAlTablero, audioEntrante = null }: ChatViewProps = {}) {
  const tema = useTema();
  // `''` sólo si `me` todavía no resolvió (no debería pasar: el guard de `_layout.tsx` exige
  // `estado === 'autenticado'` antes de montar este árbol) — `useChat` degrada ese caso a sesión
  // efímera sin persistir, nunca a una clave compartida entre tenants. Ver el hallazgo del
  // 2026-07-23 en `memoria/`.
  const { me } = useSession();
  const { estado, send, enviarAudio, enviarFoto, descartarConexion, marcarCardResuelta } = useChat(
    me?.cliente_id ?? '',
  );
  const foto = useCapturaFoto();
  const scrollRef = useRef<FlatList>(null);

  const manejarEnvio = useCallback((text: string) => void send(text, { kind: 'text' }), [send]);
  const semilla = useMemo(
    () => (avisoEntrante != null ? { texto: avisoEntrante.aviso.texto, id: avisoEntrante.id } : null),
    [avisoEntrante],
  );

  // K-11 / BL-J8: gate `requiere_conexion` → sheet en contexto; al volver de conectar se reenvía el pedido.
  const conexion = useConexionRequerida(estado?.messages ?? [], manejarEnvio, descartarConexion);

  // hitl (a.4) — «Volver al tablero →» dentro del recibo. Sólo hay salida si esta conversación nació de un
  // aviso Y el shell dejó volver. Cuenta desde cuántos mensajes había cuando ESE aviso entró (por `id`, no
  // por objeto): el recibo de una tarea vieja del historial no es el resultado de este aviso. El ref se
  // fija una vez por aviso durante el render (idempotente: re-renderizar no lo mueve).
  // 🔴 Sólo con `estado` hidratado: antes de eso `messages` es `[]` y fijar la base en 0 volvería «posteriores»
  // a TODOS los recibos del historial cuando éste termine de cargar.
  const mensajesAlEntrarElAviso = useRef<{ id: number; n: number } | null>(null);
  if (avisoEntrante == null) mensajesAlEntrarElAviso.current = null;
  else if (estado != null && mensajesAlEntrarElAviso.current?.id !== avisoEntrante.id) {
    mensajesAlEntrarElAviso.current = { id: avisoEntrante.id, n: estado.messages.length };
  }
  const tarjetaDelAviso = avisoEntrante?.aviso.tarjetaId ?? null;
  const alVolverDelRecibo = useCallback(() => {
    if (tarjetaDelAviso != null) onVolverAlTablero?.({ tarjetaId: tarjetaDelAviso, resultado: 'hecha' });
  }, [onVolverAlTablero, tarjetaDelAviso]);

  /**
   * 🔴 **El puente de la Decisión C**: lo que otra pantalla dejó pendiente entra ACÁ, en el chat
   * principal, no en una conversación aparte. Hoy lo usa «Cómo usar la app»: tocás un tema, se cierra
   * el glass y la pregunta aparece dicha en el hilo, con tus propios datos a mano.
   *
   * Va en `useFocusEffect` y no en un `useEffect` de montaje: este componente **no se desmonta**
   * cuando se abre un glass encima (los glass son `transparentModal`), así que un efecto de montaje
   * no volvería a correr nunca. El foco, en cambio, vuelve exactamente cuando el glass se cerró.
   *
   * `tomarPendiente` vacía el buzón al leerlo — sin eso, cada cierre de cualquier glass reenviaría el
   * mismo mensaje.
   *
   * 🔴 **Sólo con el estado hidratado.** `useChat` arranca con `estado === null` (la hidratación lee
   * AsyncStorage) y `send` DESCARTA en silencio mientras sea `null`. Con el chat ya montado debajo de
   * un glass eso no importa; pero el onboarding se renderiza EN LUGAR del chat, y al cerrarse éste se
   * monta de cero: tomar el buzón en ese primer foco lo vaciaba y el pedido se perdía sin rastro.
   * `hidratado` está en las deps, así que el efecto corre de nuevo cuando el estado llega.
   */
  const hidratado = estado !== null;

  // SM-I2: lo grabado en el dock de Mi día se manda acá, con la conversación que sube. Por `id`, una vez por
  // audio, y recién con el estado hidratado: `enviarAudio` descarta en silencio mientras sea `null`.
  const ultimoAudio = useRef<number | null>(null);
  useEffect(() => {
    if (audioEntrante == null || !hidratado || audioEntrante.id === ultimoAudio.current) return;
    ultimoAudio.current = audioEntrante.id;
    void enviarAudio(audioEntrante.audio, audioEntrante.duracionSeg);
  }, [audioEntrante, hidratado, enviarAudio]);

  useFocusEffect(
    useCallback(() => {
      if (!hidratado) return;
      const texto = tomarPendiente();
      if (texto != null) void send(texto, { kind: 'text' });
    }, [send, hidratado]),
  );

  // El confirm/cancel del gate (`ListaMensajes`/`mapearGate`) reenvía acá como `kind:'callback'` —
  // mismo criterio que `handleChoice` en `ChatScreen.tsx` de la PWA.
  const manejarEleccion = useCallback(
    (
      value: string,
      opts?: { payload?: Record<string, unknown> | null; displayText?: string; hitlMessageId?: string },
    ) =>
      // SM-H7 — `hitlMessageId` es lo que marca la card como respondida y activa la guarda de doble toque.
      void send(value, {
        kind: 'callback',
        payload: opts?.payload,
        displayText: opts?.displayText,
        hitlMessageId: opts?.hitlMessageId,
      }),
    [send],
  );

  const alAudio = useCallback(
    (audio: ArchivoSubida, duracionSeg: number) => void enviarAudio(audio, duracionSeg),
    [enviarAudio],
  );

  // `useCapturaFoto().elegir()` ya resuelve `null` en cancelado/permiso denegado (con su propio
  // `Alert` de permiso -- ver el docstring del hook), así que acá no hay nada más que chequear.
  const alElegirFoto = useCallback(() => {
    void (async () => {
      const archivo = await foto.elegir();
      if (archivo === null) return;
      void enviarFoto(archivo);
    })();
  }, [foto, enviarFoto]);

  return (
    /**
     * `behavior="padding"` en ambas plataformas: agrega abajo exactamente el alto del teclado para
     * que el composer suba sin que la lista se redimensione (mismo criterio verificado en device por
     * el origen DocuMed, mismo tipo de panel absoluto de pantalla completa).
     */
    <KeyboardAvoidingView testID="chat-view" behavior="padding" style={styles.contenedor}>
      {/* Contrato de modos §4 ("estado siempre visible sin abrir nada"). Primer hijo, FUERA de
          `PanelDeslizable` — mismo placement que `ModoClinicoToggle` en documed, ver su docstring. */}
      <View style={styles.indicadorModo}>
        <IndicadorModoCeremonia />
      </View>

      {/* `.ctx-chip` del prototipo (`index.html:2750`): de dónde viene lo que está por decirse. SÓLO UI —
          el texto que viaja es el del composer. La salida es la del recibo del prototipo (`:2774`). */}
      {avisoEntrante != null && (
        <View
          testID="chat-contexto-aviso"
          style={[styles.contextoAviso, { borderColor: tema.color.borde, backgroundColor: tema.glass.chip }]}
        >
          <Text
            testID="chat-contexto-aviso-texto"
            numberOfLines={1}
            style={{ flexShrink: 1, color: tema.color.textoTenue, fontSize: tema.tipo.chico, fontFamily: tema.fuente.uiMedium }}
          >
            {avisoEntrante.aviso.contexto}
          </Text>
          {onVolverAlTablero != null && (
            <Pressable
              testID="chat-contexto-aviso-volver"
              accessibilityRole="button"
              accessibilityLabel={ROTULO_VOLVER_AL_TABLERO}
              onPress={() => onVolverAlTablero?.()}
              hitSlop={10}
              style={pressableStyle(undefined, PRESS_FADE)}
            >
              <Text style={{ color: tema.color.acentoTinta, fontSize: tema.tipo.chico, fontFamily: tema.fuente.uiSemibold }}>
                {ROTULO_VOLVER_AL_TABLERO}
              </Text>
            </Pressable>
          )}
        </View>
      )}

      <ListaMensajes
        ref={scrollRef}
        messages={estado?.messages ?? []}
        sendStatus={estado?.sendStatus}
        onChoice={manejarEleccion}
        onResolverTarjeta={marcarCardResuelta}
        onVolverDelRecibo={tarjetaDelAviso != null && onVolverAlTablero != null ? alVolverDelRecibo : undefined}
        volverDesdeIndice={mensajesAlEntrarElAviso.current?.n}
      />

      <DockEntrada
        motivoFallo={estado?.motivoFallo ?? null}
        sendStatus={estado?.sendStatus ?? 'idle'}
        onEnviarTexto={manejarEnvio}
        onAudio={alAudio}
        disabled={estado === null}
        onFoto={alElegirFoto}
        semilla={semilla}
        scrollRef={scrollRef}
      />

      {/* ÚLTIMO hijo a propósito: el sheet es `position:absolute` y el composer + el botón de voz son hermanos
          en flujo — pintan DESPUÉS de lo que va antes y lo tapaban (medido en device 2026-10-15: «Conectar» /
          «Ahora no» quedaban bajo el composer y el toque lo agarraba el campo de texto). */}
      <SheetRequiereConexion
        conexion={conexion.pendiente?.conexion ?? null}
        onConectar={conexion.conectar}
        onAhoraNo={conexion.ahoraNo}
        ocupado={conexion.ocupado}
        error={conexion.error}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  // SIN `backgroundColor` a propósito — ver docstring del módulo.
  contenedor: { flex: 1 },
  indicadorModo: { paddingHorizontal: 16, paddingTop: 8 },
  contextoAviso: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginHorizontal: 16,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderRadius: 999,
  },
});
