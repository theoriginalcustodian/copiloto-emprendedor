import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Keyboard, KeyboardAvoidingView, StyleSheet, View } from 'react-native';
import type { ScrollView } from 'react-native-gesture-handler';

import type { FuncionSoporte } from '@copiloto/core';

import { Onda } from '../captura/Onda';
import { useSession } from '../auth/useSession';
import { BotonVoz } from '../chat/BotonVoz';
import { Composer } from '../chat/Composer';
import { ControlesFlotantes } from '../chat/ControlesFlotantes';
import { ListaMensajes } from '../chat/ListaMensajes';
import { useVozComando } from '../chat/useVozComando';
import { MarcoGlass } from '../../theme/glass/MarcoGlass';
import { useChatSoporte } from './useChatSoporte';

const TITULO: Record<FuncionSoporte, string> = {
  soporte_tecnico: 'Soporte técnico',
  como_uso_la_app: 'Cómo uso la app',
};

/** Puerto literal de `useTecladoVisible` en `modules/chat/ChatView.tsx` -- mismo porqué (esconder
 *  el botón de voz mientras se escribe), ver su docstring. */
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
 * **Voz (ODOBI8 §C2)** — `BotonVoz`/`ControlesFlotantes`/`useVozComando`, MISMO patrón que
 * `modules/chat/ChatView.tsx` (hold-graba/soltar-envía/deslizar-fija, `scrollRef` compuesto contra
 * el scroll de `ListaMensajes`, `Onda` como único feedback visual mientras graba). Reusa esos
 * componentes/hooks TAL CUAL — son genéricos del gesto, no saben de negocio ni de soporte; lo único
 * propio es `useChatSoporte().enviarAudio`, que namespacea por `funcion` (ver su docstring). Sin
 * foto: nadie pidió captura de ticket en soporte.
 *
 * ⚠️ **Deuda declarada (DoD §F4, dueño frontend):** el DoD pide una ventana DISCRETA ("al estilo de
 * las apps del rubro", no una pantalla completa) — esta pantalla hoy es una ruta dedicada de
 * `expo-router`, no un widget flotante. Funciona end-to-end contra el shape real del backend; la
 * forma de presentación queda pendiente de un rediseño a sheet/modal, no de este fix.
 */
export function PantallaSoporte({ funcion }: PantallaSoporteProps) {
  const { me } = useSession();
  const { estado, send, enviarAudio } = useChatSoporte(me?.cliente_id ?? '', funcion);
  const voz = useVozComando();
  const tecladoVisible = useTecladoVisible();
  const scrollRef = useRef<ScrollView>(null);
  const [fijado, setFijado] = useState(false);

  // `voz` es un objeto NUEVO en cada render (niveles cambia ~10 veces/seg mientras graba) -- un
  // `useCallback` que lo tomara como dependencia se recrearía a la misma frecuencia, y con él el
  // `useMemo` del gesto compuesto de `BotonVoz` (causa raíz real de ODOBI8-C: sin esa estabilidad,
  // el recognizer se re-ataca en pleno LongPress y pierde el estado -- ver hallazgo2 en
  // `coordinacion/`). Mismo patrón que `estadoRef` en `useChatSoporte`: un ref espejo, actualizado
  // síncronamente en cada render, para leer el valor vigente sin declarar `voz` como dependencia.
  const vozRef = useRef(voz);
  vozRef.current = voz;

  // Misma puerta que ChatView: al volver `voz.fase` a `inactivo`, la próxima grabación arranca sin
  // fijar.
  useEffect(() => {
    if (voz.fase === 'inactivo') setFijado(false);
  }, [voz.fase]);

  const manejarEnvio = useCallback((text: string) => void send(text, { kind: 'text' }), [send]);

  // El chat de soporte no tiene gates de negocio (confirm/cancel) hoy — `ListaMensajes` exige el
  // callback igual porque es genérico; si el agente alguna vez devuelve un `choice`, esto ya lo
  // enruta como un turno más en vez de perderlo en silencio.
  const manejarEleccion = useCallback(
    (value: string) => void send(value, { kind: 'callback' }),
    [send],
  );

  const alIniciarVoz = useCallback(() => {
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

  // Mismo criterio que `alEnviarVoz` de ChatView: un solo lugar decide qué es "mandar el audio",
  // sea por soltar sin fijar o por el botón Enviar de los controles flotantes. Lee todo vía
  // `vozRef` (no `voz` directo) para que esta función quede referencialmente ESTABLE -- ver el
  // comentario de `vozRef` arriba.
  const alEnviarVoz = useCallback(async () => {
    const actual = vozRef.current;
    if (actual.fase === 'grabando' || actual.fase === 'pausado') {
      await actual.detener();
    }
    const audio = actual.tomar();
    if (audio === null) return; // no llegó a grabar nada
    void enviarAudio(audio);
  }, [enviarAudio]);

  const onSoltarSinFijarVoz = useCallback(() => void alEnviarVoz(), [alEnviarVoz]);
  const onFijarVoz = useCallback(() => setFijado(true), []);

  const ondaVisible = voz.fase === 'grabando' || voz.fase === 'pausado';

  return (
    <MarcoGlass titulo={TITULO[funcion]} icono="conversacion" testID="pantalla-soporte">
      <KeyboardAvoidingView testID="soporte-view" behavior="padding" style={styles.contenedor}>
        <ListaMensajes ref={scrollRef} messages={estado?.messages ?? []} onChoice={manejarEleccion} />

        {!fijado && (
          <View
            testID="overlay-voz-soporte"
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
              onSoltarSinFijar={onSoltarSinFijarVoz}
              onFijar={onFijarVoz}
              disabled={voz.fase !== 'inactivo'}
              scrollRef={scrollRef}
            />
          </View>
        )}

        {fijado && (
          <View testID="overlay-voz-soporte-fijado" style={styles.overlayVoz}>
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
    </MarcoGlass>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1 },
  overlayVoz: { alignItems: 'center', paddingBottom: 8, gap: 8 },
  ondaFlotante: { width: '100%', paddingHorizontal: 24 },
  oculto: { display: 'none' },
});
