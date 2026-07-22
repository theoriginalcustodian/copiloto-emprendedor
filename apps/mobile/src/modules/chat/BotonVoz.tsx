import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import Svg, { Circle, Defs, G, Path, RadialGradient, Stop } from 'react-native-svg';

import { useMovimientoReducido } from '../../theme/movimientoReducido';
import { useTema } from '../../theme/ThemeProvider';

export interface BotonVozProps {
  /** Un toque arranca la grabación (delega en `useVozComando.iniciar()` -- ver `ChatView`). */
  onPress: () => void;
  /** Se apaga mientras el HUD de grabación (`GlassGrabacionCopiloto`) ya está abierto -- un segundo
   *  toque no puede reiniciar `useVozComando` a mitad de una captura. */
  disabled?: boolean;
}

/**
 * El botón de voz del copiloto: central, grande, palpita. Fork ADAPTADO de `BotonVoz.tsx` de
 * documed, con dos cambios deliberados frente al origen:
 *
 * 🔴 **1 · Un toque simple, no "mantener apretado + deslizar para fijar".** El origen implementaba el
 * gesto estilo WhatsApp porque nació para una consulta clínica de 40 minutos -- nadie sostiene el
 * dedo tanto tiempo. Acá el alcance (D6) es dictado CORTO: un toque abre el HUD de grabación
 * (`GlassGrabacionCopiloto`) ya en fase `grabando`, y de ahí en más pausar/reanudar/enviar/descartar
 * son los botones del propio HUD -- nunca el dedo sostenido. Portar el gesto de anclaje habría sido
 * traer la complejidad de un problema (sostener 40 minutos) que este producto no tiene; ver también
 * el docstring de `GlassGrabacionCopiloto.tsx`.
 *
 * 🔴 **2 · `Pressable` sale de `react-native-gesture-handler`, no del core.** Convención del repo (ver
 * `Tile.tsx`): un `Pressable` de React Native puede perder el primer toque cuando compite por el
 * mismo gesto con el responder system de un `ScrollView` ancestro (acá, la lista de mensajes que este
 * botón flota encima). El origen usaba el `Pressable` del core justamente porque necesitaba
 * `onPressMove` para medir el arrastre del anclaje -- una API que RNGH no expone igual. Al sacar el
 * arrastre (punto 1), esa necesidad desaparece y el botón puede alinearse con la convención del repo
 * sin perder nada: `onPress` es la única interacción que le queda.
 *
 * 🔴 **3 · Sin gating por cliente activo.** El origen deshabilitaba el botón sin `pacienteActivo`
 * (ADR-004 de documed: toda acción clínica exige paciente). Este producto no tiene selector de
 * cliente activo en NINGÚN shell todavía (ver el docstring de `useChat.ts`) -- inventar acá un gate
 * contra un selector que no existe sería *codificar la esperanza*. El botón queda siempre habilitado
 * salvo mientras ya hay una grabación abierta (`disabled`, arriba).
 *
 * El pulso usa `Animated` del CORE de React Native (no Reanimated) -- mismo criterio que el origen y
 * que `PuntoLatido`/`PuntoEstado` en este mismo módulo: es una animación de `opacity`/`scale` sobre
 * el driver nativo, sin necesidad de worklets.
 */
export function BotonVoz({ onPress, disabled = false }: BotonVozProps) {
  const tema = useTema();

  const pulso = useRef(new Animated.Value(1)).current;
  const movimientoReducido = useMovimientoReducido();

  useEffect(() => {
    // Late SIEMPRE que esté habilitado (el botón está "vivo" en reposo). Deshabilitado, no late: un
    // control apagado que igual palpita invita a tocarlo y después no hace nada.
    //
    // 🔴 **Y no late si el usuario pidió menos movimiento.** Es la animación más persistente de la
    // app —está en la pantalla principal, en reposo, para siempre—, así que es exactamente la que ese
    // ajuste existe para apagar. Apagarla no esconde nada: el botón sigue visible, del mismo tamaño y
    // color, y su nombre accesible no cambia. Ver `useMovimientoReducido` para la línea completa
    // (decora vs informa) y para el efecto lateral sobre el E2E.
    if (disabled || movimientoReducido) {
      pulso.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulso, { toValue: 1.08, duration: 600, useNativeDriver: true }),
        Animated.timing(pulso, { toValue: 1, duration: 600, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [disabled, movimientoReducido, pulso]);

  const etiqueta = disabled ? 'Grabando -- el HUD de voz ya está abierto' : 'Tocá para dictarle al copiloto';

  return (
    <Pressable
      testID="boton-voz"
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      accessibilityLabel={etiqueta}
      onPress={onPress}
    >
      {/* El aro exterior: hace que el botón se lea como una fuente de luz y no como un círculo pintado. */}
      <View style={styles.halo}>
        <View
          style={[
            styles.aro,
            { borderColor: tema.color.acento, borderRadius: tema.radio.completo, opacity: disabled ? 0.15 : 0.5 },
          ]}
          pointerEvents="none"
        />
        <Animated.View
          testID="boton-voz-nucleo"
          style={[
            styles.boton,
            { transform: [{ scale: pulso }], borderRadius: tema.radio.completo, borderColor: tema.glass.hi },
            !disabled && {
              shadowColor: tema.color.acento,
              shadowOpacity: 0.9,
              shadowRadius: 18,
              shadowOffset: { width: 0, height: 8 },
              elevation: 14,
            },
          ]}
        >
          {/* La esfera: degradado RADIAL `accent2 -> accent`. `expo-linear-gradient` sólo hace
              lineales, así que el radial va por SVG. */}
          <Svg width="100%" height="100%" viewBox="0 0 80 80">
            <Defs>
              <RadialGradient id="esferaVoz" cx="38%" cy="30%" r="75%">
                <Stop offset="0" stopColor={disabled ? tema.color.superficieAlta : tema.glass.accent2} />
                <Stop offset="0.7" stopColor={disabled ? tema.color.superficie : tema.color.acento} />
                <Stop offset="1" stopColor={disabled ? tema.color.superficie : tema.color.acento} />
              </RadialGradient>
            </Defs>
            <Circle cx="40" cy="40" r="40" fill="url(#esferaVoz)" />
            {/* El micrófono. */}
            <G transform="translate(16.7 16.7) scale(1.94)" opacity={disabled ? 0.45 : 1}>
              <Path d="M12 3a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3z" fill={tema.color.acentoTexto} />
              <Path
                d="M6 11a6 6 0 0 0 12 0M12 17v4M9 21h6"
                stroke={tema.color.acentoTexto}
                strokeWidth={2}
                strokeLinecap="round"
                fill="none"
              />
            </G>
          </Svg>
        </Animated.View>
      </View>
    </Pressable>
  );
}

/** Medidas del template heredadas del origen: esfera de 80 y aro a -10px alrededor. */
const DIAMETRO_BOTON = 80;
const SEPARACION_ARO = 10;

const styles = StyleSheet.create({
  halo: {
    width: DIAMETRO_BOTON + SEPARACION_ARO * 2,
    height: DIAMETRO_BOTON + SEPARACION_ARO * 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aro: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderWidth: 1.5 },
  boton: { width: DIAMETRO_BOTON, height: DIAMETRO_BOTON, borderWidth: 1, overflow: 'hidden' },
});
