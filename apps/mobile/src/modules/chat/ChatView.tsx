import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Keyboard, KeyboardAvoidingView, Pressable, StyleSheet, Text, View } from 'react-native';
import type { FlatList } from 'react-native-gesture-handler';

import { ROTULO_VOLVER_AL_TABLERO, type AvisoAlChat, type CierreAviso } from '@copiloto/core';

import { Onda } from '../captura/Onda';
import { useSession } from '../auth/useSession';
import { BotonVoz } from './BotonVoz';
import { Composer } from './Composer';
import { ControlesFlotantes } from './ControlesFlotantes';
import { BarraSostenida, PistasGestoVoz } from './PistasVoz';
import { IndicadorModoCeremonia } from './IndicadorModoCeremonia';
import { ListaMensajes } from './ListaMensajes';
import { tomarPendiente } from './mensajePendiente';
import { useCapturaFoto } from './useCapturaFoto';
import { SheetRequiereConexion } from './SheetRequiereConexion';
import { PRESS_FADE, pressableStyle } from '../../theme/glass/presion';
import { useTema } from '../../theme/ThemeProvider';
import { useChat } from './useChat';
import { useConexionRequerida } from './useConexionRequerida';
import { useVozComando } from './useVozComando';

/**
 * ¿Está el teclado a la vista? Sirve para esconder el botón de voz mientras se escribe -- mismo
 * criterio que documed (2026-07-19): con el teclado abierto el usuario ya eligió escribir, y el botón
 * flotante le comería la mitad de lo que le queda de conversación a la vista.
 *
 * Se usan los eventos `Did` y no los `Will`: en Android los `Will*` no se emiten. Y se esconde con
 * `display:'none'`, no desmontando `BotonVoz` -- desmontarlo no tiraría estado propio (no lo tiene:
 * la grabación en curso vive en `useVozComando`, acá arriba, no en el botón), pero desmontar/remontar
 * en cada aparición/desaparición del teclado reiniciaría su animación de pulso sin necesidad.
 */
function useTecladoVisible(): boolean {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const alMostrar = Keyboard.addListener('keyboardDidShow', () => setVisible(true));
    const alOcultar = Keyboard.addListener('keyboardDidHide', () => setVisible(false));
    return () => {
      alMostrar.remove();
      alOcultar.remove();
    };
  }, []);
  return visible;
}

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
}

/**
 * El copiloto: lista de mensajes + botón de voz + entrada de texto. Fork mobile de `ChatView.tsx` de
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
 * `fijado` es el ÚNICO estado que este componente agrega sobre `voz.fase`: si se deslizó hacia arriba
 * lo suficiente (`BotonVoz.onFijar`), y por lo tanto hay que mostrar los controles flotantes en vez de
 * "soltar = enviar". Se resetea solo cuando `voz.fase` vuelve a `inactivo` (Enviar/Eliminar ya
 * terminaron su ciclo) — así una próxima grabación siempre arranca sin fijar.
 *
 * 🔴 **`scrollRef` es la costura de la composición de gestos.** `BotonVoz` flota ENCIMA de
 * `ListaMensajes` y su gesto (`Gesture.LongPress`+`Gesture.Pan`) necesita saber del `FlatList` de la
 * lista (`simultaneousWithExternalGesture`, C6: antes era un `ScrollView`) para no comerle el toque ni
 * que el scroll se lo coma a él — es la causa raíz del bug de device que este contrato vino a cerrar
 * (§2 del contrato).
 *
 * 🔴 **Permiso de micrófono denegado: aviso legible, sin romper el chat.** `useVozComando().iniciar()`
 * devuelve `false` si el usuario no concedió el permiso; acá eso dispara un `Alert` nativo en vez de
 * dejar el toque sin ningún efecto visible (que el usuario leería como "el botón no funciona").
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
export function ChatView({ avisoEntrante = null, onVolverAlTablero }: ChatViewProps = {}) {
  const tema = useTema();
  // `''` sólo si `me` todavía no resolvió (no debería pasar: el guard de `_layout.tsx` exige
  // `estado === 'autenticado'` antes de montar este árbol) — `useChat` degrada ese caso a sesión
  // efímera sin persistir, nunca a una clave compartida entre tenants. Ver el hallazgo del
  // 2026-07-23 en `memoria/`.
  const { me } = useSession();
  const { estado, send, enviarAudio, enviarFoto, descartarConexion, marcarCardResuelta } = useChat(
    me?.cliente_id ?? '',
  );
  const voz = useVozComando();
  const foto = useCapturaFoto();
  const tecladoVisible = useTecladoVisible();
  const scrollRef = useRef<FlatList>(null);
  const [fijado, setFijado] = useState(false);
  const [cancelando, setCancelando] = useState(false);
  const [cerca, setCerca] = useState(false);

  // `voz` es un objeto NUEVO en cada render (niveles cambia ~10 veces/seg mientras graba) -- un
  // `useCallback` que lo tomara como dependencia se recrearía a la misma frecuencia, y con él el
  // `useMemo` del gesto compuesto de `BotonVoz` (causa raíz real de ODOBI8-C: sin esa estabilidad,
  // el recognizer se re-ataca en pleno LongPress y pierde el estado -- ver hallazgo2 en
  // `coordinacion/`). Mismo patrón que `estadoRef` en `useChat`: un ref espejo, actualizado
  // síncronamente en cada render, para leer el valor vigente sin declarar `voz` como dependencia.
  const vozRef = useRef(voz);
  vozRef.current = voz;

  // Una vez que la captura vuelve a `inactivo` (Enviar/Eliminar ya terminaron su ciclo), la puerta de
  // `fijado` se reabre sola — sin esto, la SEGUNDA grabación de la sesión arrancaría ya "fijada" sin
  // que el usuario haya deslizado nada.
  useEffect(() => {
    if (voz.fase === 'inactivo') setFijado(false);
  }, [voz.fase]);

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
    (value: string, opts?: { payload?: Record<string, unknown> | null; displayText?: string }) =>
      void send(value, { kind: 'callback', payload: opts?.payload, displayText: opts?.displayText }),
    [send],
  );

  // BL-J7 (H-A3-7) — mismo patrón que `MicFuncion.tsx` (voz standalone): el instante del toque que
  // arranca la grabación mide la duración del dictado para el chip «Por voz · m:ss» de la burbuja. No
  // se usa `voz.segundos` (el reloj propio del grabador, que excluye pausas) para no ensanchar el
  // contrato de `useVozComando` — hook compartido con `feedback`/`soporte`, fuera del alcance de esta
  // fila.
  const inicioMsRef = useRef(0);
  const alIniciarVoz = useCallback(() => {
    inicioMsRef.current = Date.now();
    void (async () => {
      const ok = await vozRef.current.iniciar();
      if (!ok) {
        Alert.alert(
          'Sin acceso al micrófono',
          'Activá el permiso de micrófono en Ajustes para dictarle al copiloto por voz.',
        );
      }
    })();
  }, []);

  /**
   * Enviar corta (si todavía graba o está en pausa) y manda en un solo toque -- mismo criterio que
   * documed (2026-07-20): sin fase intermedia "detenida, esperando Enviar" de la que no se puede
   * volver a Pausar. Es el mismo camino para "soltar sin fijar" (contrato §1, fila 2) y para el botón
   * "Enviar" de los controles flotantes (fila 3) — un solo lugar que decide qué es "mandar el audio".
   * Lee todo vía `vozRef` (no `voz` directo) para quedar referencialmente ESTABLE -- ver el
   * comentario de `vozRef` arriba.
   */
  const alEnviarVoz = useCallback(async () => {
    const actual = vozRef.current;
    if (actual.fase === 'grabando' || actual.fase === 'pausado') {
      await actual.detener();
    }
    const audio = actual.tomar();
    if (audio === null) return; // no llegó a grabar nada
    const duracionSeg = Math.max(1, Math.round((Date.now() - inicioMsRef.current) / 1000));
    void enviarAudio(audio, duracionSeg);
  }, [enviarAudio]);

  const onSoltarSinFijarVoz = useCallback(() => void alEnviarVoz(), [alEnviarVoz]);
  const onFijarVoz = useCallback(() => setFijado(true), []);
  // BL-D2: deslizar a la izquierda / toque corto -> se descarta lo grabado sin enviarlo.
  const onCancelarVoz = useCallback(() => void vozRef.current.descartar(), []);

  // `useCapturaFoto().elegir()` ya resuelve `null` en cancelado/permiso denegado (con su propio
  // `Alert` de permiso -- ver el docstring del hook), así que acá no hay nada más que chequear.
  const alElegirFoto = useCallback(() => {
    void (async () => {
      const archivo = await foto.elegir();
      if (archivo === null) return;
      void enviarFoto(archivo);
    })();
  }, [foto, enviarFoto]);

  // La onda sólo corre mientras graba: en pausa la reemplaza el texto «En pausa» (WCAG 1.4.1 — el
  // estado no puede depender sólo de que algo deje de moverse).
  const ondaVisible = voz.fase === 'grabando';
  const pistasVisibles = voz.fase === 'grabando' || cancelando;
  // G3 (TRIAJE15): la barra del composer SE TRANSFORMA mientras hay captura — el campo de texto cede su
  // lugar a la barra de grabación (`index.html:2939-2949`), no queda debajo con algo flotando encima.
  const enCaptura = voz.fase !== 'inactivo';

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

      {/* Flota sobre la lista, encima del composer -- que sigue disponible para escribir (mientras no
          esté fijado: con controles flotantes abajo, mantener el botón visible sumaría ruido). Se
          oculta con el teclado a la vista (ver `useTecladoVisible`). */}
      {!fijado && (
        <View
          testID="overlay-voz"
          style={[styles.overlayVoz, tecladoVisible && styles.oculto]}
          pointerEvents={tecladoVisible ? 'none' : 'box-none'}
        >
          {ondaVisible && (
            <View testID="onda-flotante" style={styles.ondaFlotante} pointerEvents="none">
              <Onda niveles={voz.niveles} />
            </View>
          )}
          {pistasVisibles && <PistasGestoVoz cancelando={cancelando} cerca={cerca} />}
          <BotonVoz
            onIniciar={alIniciarVoz}
            onSoltarSinFijar={onSoltarSinFijarVoz}
            onFijar={onFijarVoz}
            onCancelar={onCancelarVoz}
            onCancelando={setCancelando}
            onCerca={setCerca}
            disabled={voz.fase !== 'inactivo'}
            scrollRef={scrollRef}
          />
        </View>
      )}

      {/* La barra de grabación ocupa el lugar del composer (G3). Mantenido: punto + reloj + «deslizá
          para cancelar». Fijado: tacho · onda · reloj · pausa/play · enviar — se termina por Enviar o
          Eliminar, nunca soltando el dedo (ya no hay dedo que sostener). */}
      {enCaptura && !fijado && <BarraSostenida segundos={voz.segundos} cancelando={cancelando} />}
      {fijado && (
        <ControlesFlotantes
          fase={voz.fase}
          segundos={voz.segundos}
          niveles={voz.niveles}
          alPausar={voz.pausar}
          alReanudar={voz.reanudar}
          alEnviar={() => void alEnviarVoz()}
          alEliminar={() => void voz.descartar()}
        />
      )}

      {/* Siempre montado: oculto (no desmontado) para no perder el borrador que alguien venía
          escribiendo cuando eligió dictar. */}
      <View testID="chat-composer-contenedor" style={enCaptura ? styles.oculto : undefined}>
        <Composer
          motivoFallo={estado?.motivoFallo ?? null}
          sendStatus={estado?.sendStatus ?? 'idle'}
          onSend={manejarEnvio}
          disabled={estado === null}
          onFoto={alElegirFoto}
          semilla={semilla}
        />
      </View>

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
  overlayVoz: { alignItems: 'center', paddingBottom: 8, gap: 8 },
  ondaFlotante: { width: '100%', paddingHorizontal: 24 },
  // `display:'none'` y no `opacity:0`: con opacity el botón seguiría ocupando su lugar y el composer
  // no ganaría el espacio que justamente hace falta cuando el teclado se comió media pantalla.
  oculto: { display: 'none' },
});
