import { useCallback } from 'react';
import { KeyboardAvoidingView, StyleSheet } from 'react-native';

import type { FuncionSoporte } from '@copiloto/core';

import { useSession } from '../auth/useSession';
import { Composer } from '../chat/Composer';
import { ListaMensajes } from '../chat/ListaMensajes';
import { MarcoGlass } from '../../theme/glass/MarcoGlass';
import { useChatSoporte } from './useChatSoporte';

const TITULO: Record<FuncionSoporte, string> = {
  soporte_tecnico: 'Soporte técnico',
  como_uso_la_app: 'Cómo uso la app',
};

export interface PantallaSoporteProps {
  /** Fija para toda la vida de la pantalla — dos entradas separadas en `PantallaCuenta` la fijan de
   * antemano (ver el docstring de `useChatSoporte` sobre por qué no cambia a mitad de conversación). */
  funcion: FuncionSoporte;
}

/**
 * `PantallaSoporte` — SOP5, el chat de soporte embebido en la app.
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
 *
 * ⚠️ **Deuda declarada (DoD §F4, dueño frontend):** el DoD pide una ventana DISCRETA ("al estilo de
 * las apps del rubro", no una pantalla completa) — esta pantalla hoy es una ruta dedicada de
 * `expo-router`, no un widget flotante. Funciona end-to-end contra el shape real del backend; la
 * forma de presentación queda pendiente de un rediseño a sheet/modal, no de este fix.
 */
export function PantallaSoporte({ funcion }: PantallaSoporteProps) {
  const { me } = useSession();
  const { estado, send } = useChatSoporte(me?.cliente_id ?? '', funcion);

  const manejarEnvio = useCallback((text: string) => void send(text, { kind: 'text' }), [send]);

  // El chat de soporte no tiene gates de negocio (confirm/cancel) hoy — `ListaMensajes` exige el
  // callback igual porque es genérico; si el agente alguna vez devuelve un `choice`, esto ya lo
  // enruta como un turno más en vez de perderlo en silencio.
  const manejarEleccion = useCallback(
    (value: string) => void send(value, { kind: 'callback' }),
    [send],
  );

  return (
    <MarcoGlass titulo={TITULO[funcion]} icono="conversacion" testID="pantalla-soporte">
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
