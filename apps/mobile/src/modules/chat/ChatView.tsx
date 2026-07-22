import { useCallback, useEffect, useState } from 'react';
import { Alert, Keyboard, KeyboardAvoidingView, StyleSheet, View } from 'react-native';

import { BotonVoz } from './BotonVoz';
import { Composer } from './Composer';
import { GlassGrabacionCopiloto } from './GlassGrabacionCopiloto';
import { ListaMensajes } from './ListaMensajes';
import { useChat } from './useChat';
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
 * 🔴 **Botón de voz + HUD de grabación (F6), y en qué se aparta del origen.** `BotonVoz` acá es un
 * TOQUE simple (no "mantener apretado + deslizar para anclar" como en documed): D6 fijó el alcance a
 * dictado CORTO, así que un toque alcanza para abrir el HUD (`GlassGrabacionCopiloto`) ya grabando, y
 * de ahí en más pausar/reanudar/enviar/descartar los maneja el propio HUD. Ver los docstrings de
 * `BotonVoz.tsx` y `GlassGrabacionCopiloto.tsx` para el resto de esa decisión.
 *
 * 🔴 **Permiso de micrófono denegado: aviso legible, sin romper el chat.** `useVozComando().iniciar()`
 * devuelve `false` si el usuario no concedió el permiso; acá eso dispara un `Alert` nativo en vez de
 * dejar el toque sin ningún efecto visible (que el usuario leería como "el botón no funciona").
 *
 * Toda la lógica de envío/polling/durabilidad (texto Y voz) vive en `useChat`; este componente sólo
 * arma los callbacks que conectan la vista con esa máquina.
 *
 * 🔴 **Sin fondo ni título propios.** Vive DENTRO del panel de vidrio (`PanelDeslizable`, fuera de
 * este ownership) que ya aporta el chrome — mismo criterio que `PantallaFacturacion`/`PantallaApps`
 * en `escritorio/`. Un `backgroundColor` acá taparía el vidrio detrás.
 */
export function ChatView() {
  const { estado, send, enviarAudio } = useChat();
  const voz = useVozComando();
  const tecladoVisible = useTecladoVisible();

  const manejarEnvio = useCallback((text: string) => void send(text, { kind: 'text' }), [send]);

  // El confirm/cancel del gate (`ListaMensajes`/`mapearGate`) reenvía acá como `kind:'callback'` —
  // mismo criterio que `handleChoice` en `ChatScreen.tsx` de la PWA.
  const manejarEleccion = useCallback(
    (value: string, opts?: { payload?: Record<string, unknown> | null }) =>
      void send(value, { kind: 'callback', payload: opts?.payload }),
    [send],
  );

  const alTocarVoz = useCallback(() => {
    void (async () => {
      const ok = await voz.iniciar();
      if (!ok) {
        Alert.alert(
          'Sin acceso al micrófono',
          'Activá el permiso de micrófono en Ajustes para dictarle al copiloto por voz.',
        );
      }
    })();
  }, [voz]);

  /**
   * Enviar corta (si todavía graba o está en pausa) y manda en un solo toque -- mismo criterio que
   * documed (2026-07-20): sin fase intermedia "detenida, esperando Enviar" de la que no se puede
   * volver a Pausar.
   */
  const alEnviarVoz = useCallback(async () => {
    if (voz.fase === 'grabando' || voz.fase === 'pausado') {
      await voz.detener();
    }
    const audio = voz.tomar();
    if (audio === null) return; // no llegó a grabar nada
    void enviarAudio(audio);
  }, [voz, enviarAudio]);

  return (
    /**
     * `behavior="padding"` en ambas plataformas: agrega abajo exactamente el alto del teclado para
     * que el composer suba sin que la lista se redimensione (mismo criterio verificado en device por
     * el origen DocuMed, mismo tipo de panel absoluto de pantalla completa).
     */
    <KeyboardAvoidingView testID="chat-view" behavior="padding" style={styles.contenedor}>
      <ListaMensajes messages={estado?.messages ?? []} onChoice={manejarEleccion} />

      {/* Flota sobre la lista, encima del composer -- que sigue disponible para escribir. Se oculta
          si el HUD de grabación ya está abierto (evita un segundo toque a mitad de una captura) o
          con el teclado a la vista (ver `useTecladoVisible`). */}
      <View
        testID="overlay-voz"
        style={[styles.overlayVoz, tecladoVisible && styles.oculto]}
        pointerEvents={tecladoVisible ? 'none' : 'box-none'}
      >
        <BotonVoz onPress={alTocarVoz} disabled={voz.fase !== 'inactivo'} />
      </View>

      <Composer
        motivoFallo={estado?.motivoFallo ?? null}
        sendStatus={estado?.sendStatus ?? 'idle'}
        onSend={manejarEnvio}
        disabled={estado === null}
      />

      {/* El glass de grabación: encima de todo mientras haya captura viva o un audio esperando
          decisión. Se monta acá y no como ruta propia porque el grabador vive en este componente --
          llevarlo a otra pantalla obligaría a mover el estado de una captura en curso a través del
          router, que es justo el momento en que no se puede perder. */}
      {voz.fase !== 'inactivo' && (
        <GlassGrabacionCopiloto
          fase={voz.fase}
          segundos={voz.segundos}
          niveles={voz.niveles}
          alPausar={voz.pausar}
          alReanudar={voz.reanudar}
          alEnviar={() => void alEnviarVoz()}
          alDescartar={() => void voz.descartar()}
        />
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  // SIN `backgroundColor` a propósito — ver docstring del módulo.
  contenedor: { flex: 1 },
  overlayVoz: { alignItems: 'center', paddingBottom: 8 },
  // `display:'none'` y no `opacity:0`: con opacity el botón seguiría ocupando su lugar y el composer
  // no ganaría el espacio que justamente hace falta cuando el teclado se comió media pantalla.
  oculto: { display: 'none' },
});
