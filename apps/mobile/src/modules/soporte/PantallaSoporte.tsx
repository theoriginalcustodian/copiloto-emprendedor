import { useCallback } from 'react';
import { KeyboardAvoidingView, StyleSheet } from 'react-native';

import { useSession } from '../auth/useSession';
import { Composer } from '../chat/Composer';
import { ListaMensajes } from '../chat/ListaMensajes';
import { MarcoGlass } from '../../theme/glass/MarcoGlass';
import { useChatSoporte } from './useChatSoporte';

/**
 * `PantallaSoporte` — SOP5, el chat de soporte técnico embebido en la app.
 *
 * Reusa `ListaMensajes`/`Composer` de `modules/chat/` **tal cual** — son genéricos de
 * presentación (no saben de negocio ni de soporte, sólo de `ChatMessage`/`SendStatus`), mismo
 * criterio que el propio contrato SOP5 pide para el backend del lado del cliente: no reinventar lo
 * que ya funciona. Lo que SÍ es propio: `useChatSoporte`, que apunta a `/soporte/chat` en vez de
 * `/chat` — ver su docstring.
 *
 * Deliberadamente SIN `BotonVoz`/`useVozComando`/foto — la voz está fuera de alcance de SOP5 v1
 * (contrato: "si al probarlo resulta que se necesita, es un hito aparte"). Sin gesto flotante que
 * componer con el scroll, tampoco hace falta el `scrollRef` que `ChatView` sí necesita.
 */
export function PantallaSoporte() {
  const { me } = useSession();
  const { estado, send } = useChatSoporte(me?.cliente_id ?? '');

  const manejarEnvio = useCallback((text: string) => void send(text, { kind: 'text' }), [send]);

  // El chat de soporte no tiene gates de negocio (confirm/cancel) hoy — `ListaMensajes` exige el
  // callback igual porque es genérico; si el agente alguna vez devuelve un `choice`, esto ya lo
  // enruta como un turno más en vez de perderlo en silencio.
  const manejarEleccion = useCallback(
    (value: string) => void send(value, { kind: 'callback' }),
    [send],
  );

  return (
    <MarcoGlass titulo="Soporte" icono="conversacion" testID="pantalla-soporte">
      <KeyboardAvoidingView testID="soporte-view" behavior="padding" style={styles.contenedor}>
        <ListaMensajes messages={estado?.messages ?? []} onChoice={manejarEleccion} />
        <Composer
          motivoFallo={estado?.motivoFallo ?? null}
          sendStatus={estado?.sendStatus ?? 'idle'}
          onSend={manejarEnvio}
          disabled={estado === null}
        />
      </KeyboardAvoidingView>
    </MarcoGlass>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1 },
});
