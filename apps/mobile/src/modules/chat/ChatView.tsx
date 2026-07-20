import { useCallback } from 'react';
import { KeyboardAvoidingView, StyleSheet } from 'react-native';

import { Composer } from './Composer';
import { ListaMensajes } from './ListaMensajes';
import { useChat } from './useChat';

/**
 * El copiloto: lista de mensajes + entrada de texto. Fork mobile de `ChatView.tsx` de DocuMed
 * (`_staging/documed/apps/mobile/src/modules/chat/ChatView.tsx`), reducido al alcance del sprint
 * mobile-first (cáscara glass, walking skeleton de texto):
 *
 * 🔴 **Lo que el origen tenía y ESTE módulo no porta, a propósito:**
 *  - **Botón de voz + HUD de grabación** (`BotonVoz`/`GlassGrabacionCopiloto`/`useVozComando`) — F6,
 *    todavía no le toca (necesita el grabador nativo).
 *  - **Selector de cliente activo / toggle de modo** (`usePacienteActivo`/`ModoClinicoToggle`) — no
 *    existe todavía ningún selector de cliente en NINGÚN shell del copiloto (verificado leyendo
 *    `apps/copiloto-web/src/modules/chat/useChat.ts`, la versión en producción, antes de portar: ni
 *    ella lo manda). Sin ese selector no hay `cliente_id`/`alcance`/`modo` honestos que mandar — ver
 *    el docstring de `useChat.ts`.
 *  - **Artefactos post-confirmación** (`useArtefactosClinicos`/`TarjetaArtefacto`) — específicos de
 *    DocuMed (persistencia de nota clínica + PDF), sin equivalente en este sprint.
 *
 * Lo que SÍ se preserva porque es la columna del producto, no un detalle de DocuMed: toda la lógica
 * de envío/polling/durabilidad vive en `useChat` (Temporal del lado del servidor); este componente
 * sólo arma el callback que conecta la vista con esa máquina.
 *
 * 🔴 **Sin fondo ni título propios.** Vive DENTRO del panel de vidrio (`PanelDeslizable`, fuera de
 * este ownership) que ya aporta el chrome — mismo criterio que `PantallaFacturacion`/`PantallaApps`
 * en `escritorio/`. Un `backgroundColor` acá taparía el vidrio detrás.
 */
export function ChatView() {
  const { estado, send } = useChat();

  const manejarEnvio = useCallback((text: string) => void send(text, { kind: 'text' }), [send]);

  // El confirm/cancel del gate (`ListaMensajes`/`mapearGate`) reenvía acá como `kind:'callback'` —
  // mismo criterio que `handleChoice` en `ChatScreen.tsx` de la PWA.
  const manejarEleccion = useCallback(
    (value: string, opts?: { payload?: Record<string, unknown> | null }) =>
      void send(value, { kind: 'callback', payload: opts?.payload }),
    [send],
  );

  return (
    // `behavior="padding"` en ambas plataformas: agrega abajo exactamente el alto del teclado para
    // que el composer suba sin que la lista se redimensione (mismo criterio verificado en device por
    // el origen DocuMed, mismo tipo de panel absoluto de pantalla completa).
    <KeyboardAvoidingView testID="chat-view" behavior="padding" style={styles.contenedor}>
      <ListaMensajes messages={estado?.messages ?? []} onChoice={manejarEleccion} />
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
});
