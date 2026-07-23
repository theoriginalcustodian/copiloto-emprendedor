import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Keyboard, KeyboardAvoidingView, StyleSheet, View } from 'react-native';
import type { ScrollView } from 'react-native-gesture-handler';

import { Onda } from '../captura/Onda';
import { useSession } from '../auth/useSession';
import { BotonVoz } from './BotonVoz';
import { Composer } from './Composer';
import { ControlesFlotantes } from './ControlesFlotantes';
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
 * `ListaMensajes` y su gesto (`Gesture.LongPress`+`Gesture.Pan`) necesita saber del `ScrollView` de la
 * lista (`simultaneousWithExternalGesture`) para no comerle el toque ni que el scroll se lo coma a él
 * — es la causa raíz del bug de device que este contrato vino a cerrar (§2 del contrato).
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
  // `''` sólo si `me` todavía no resolvió (no debería pasar: el guard de `_layout.tsx` exige
  // `estado === 'autenticado'` antes de montar este árbol) — `useChat` degrada ese caso a sesión
  // efímera sin persistir, nunca a una clave compartida entre tenants. Ver el hallazgo del
  // 2026-07-23 en `memoria/`.
  const { me } = useSession();
  const { estado, send, enviarAudio } = useChat(me?.cliente_id ?? '');
  const voz = useVozComando();
  const tecladoVisible = useTecladoVisible();
  const scrollRef = useRef<ScrollView>(null);
  const [fijado, setFijado] = useState(false);

  // Una vez que la captura vuelve a `inactivo` (Enviar/Eliminar ya terminaron su ciclo), la puerta de
  // `fijado` se reabre sola — sin esto, la SEGUNDA grabación de la sesión arrancaría ya "fijada" sin
  // que el usuario haya deslizado nada.
  useEffect(() => {
    if (voz.fase === 'inactivo') setFijado(false);
  }, [voz.fase]);

  const manejarEnvio = useCallback((text: string) => void send(text, { kind: 'text' }), [send]);

  // El confirm/cancel del gate (`ListaMensajes`/`mapearGate`) reenvía acá como `kind:'callback'` —
  // mismo criterio que `handleChoice` en `ChatScreen.tsx` de la PWA.
  const manejarEleccion = useCallback(
    (value: string, opts?: { payload?: Record<string, unknown> | null }) =>
      void send(value, { kind: 'callback', payload: opts?.payload }),
    [send],
  );

  const alIniciarVoz = useCallback(() => {
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
   * volver a Pausar. Es el mismo camino para "soltar sin fijar" (contrato §1, fila 2) y para el botón
   * "Enviar" de los controles flotantes (fila 3) — un solo lugar que decide qué es "mandar el audio".
   */
  const alEnviarVoz = useCallback(async () => {
    if (voz.fase === 'grabando' || voz.fase === 'pausado') {
      await voz.detener();
    }
    const audio = voz.tomar();
    if (audio === null) return; // no llegó a grabar nada
    void enviarAudio(audio);
  }, [voz, enviarAudio]);

  const ondaVisible = voz.fase === 'grabando' || voz.fase === 'pausado';

  return (
    /**
     * `behavior="padding"` en ambas plataformas: agrega abajo exactamente el alto del teclado para
     * que el composer suba sin que la lista se redimensione (mismo criterio verificado en device por
     * el origen DocuMed, mismo tipo de panel absoluto de pantalla completa).
     */
    <KeyboardAvoidingView testID="chat-view" behavior="padding" style={styles.contenedor}>
      <ListaMensajes ref={scrollRef} messages={estado?.messages ?? []} onChoice={manejarEleccion} />

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
          <BotonVoz
            onIniciar={alIniciarVoz}
            onSoltarSinFijar={() => void alEnviarVoz()}
            onFijar={() => setFijado(true)}
            disabled={voz.fase !== 'inactivo'}
            scrollRef={scrollRef}
          />
        </View>
      )}

      {/* Fijado: la onda sigue flotando arriba de los controles (contrato §1, "sin contador, la onda
          es el único feedback"), y los controles reemplazan al botón — se termina por Enviar o
          Eliminar (o Pausar/Reanudar), nunca soltando el dedo (ya no hay dedo que sostener). */}
      {fijado && (
        <View testID="overlay-voz-fijado" style={styles.overlayVoz}>
          {ondaVisible && (
            <View testID="onda-flotante" style={styles.ondaFlotante} pointerEvents="none">
              <Onda niveles={voz.niveles} />
            </View>
          )}
          <ControlesFlotantes
            fase={voz.fase}
            alPausar={voz.pausar}
            alReanudar={voz.reanudar}
            alEnviar={() => void alEnviarVoz()}
            alEliminar={() => void voz.descartar()}
          />
        </View>
      )}

      <Composer
        motivoFallo={estado?.motivoFallo ?? null}
        sendStatus={estado?.sendStatus ?? 'idle'}
        onSend={manejarEnvio}
        disabled={estado === null}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  // SIN `backgroundColor` a propósito — ver docstring del módulo.
  contenedor: { flex: 1 },
  overlayVoz: { alignItems: 'center', paddingBottom: 8, gap: 8 },
  ondaFlotante: { width: '100%', paddingHorizontal: 24 },
  // `display:'none'` y no `opacity:0`: con opacity el botón seguiría ocupando su lugar y el composer
  // no ganaría el espacio que justamente hace falta cuando el teclado se comió media pantalla.
  oculto: { display: 'none' },
});
