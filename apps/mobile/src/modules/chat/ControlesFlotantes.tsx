import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { formatearDuracion } from '@copiloto/core';

import { Onda } from '../captura/Onda';
import { pressableStyle } from '../../theme/glass/presion';
import { useTema } from '../../theme/ThemeProvider';
import { IconoEnviarVoz, IconoPausaVoz, IconoPlayVoz, IconoTachoVoz } from './IconosVoz';
import { EstadoEnPausa } from './PistasVoz';
import type { FaseVoz } from './useVozComando';

export interface ControlesFlotantesProps {
  fase: FaseVoz;
  /** Segundos capturados (`useVozComando().segundos`: el reloj del grabador, la pausa NO cuenta). */
  segundos: number;
  /** Niveles del micrófono (`useVozComando().niveles`): alimentan la onda del centro de la barra. */
  niveles: number[];
  alPausar: () => void;
  alReanudar: () => void;
  /** Corta (si todavía graba) y envía, en un solo toque. Ver `alEnviarVoz` en `ChatView`. */
  alEnviar: () => void;
  alEliminar: () => void;
}

/** Lado de los botones secundarios (tacho, pausa) y del primario (enviar), en dp. El prototipo usa
 *  44 para `.lk-btn` (`index.html:224`) — es también el mínimo táctil — y el mic de 52 hace de «enviar». */
const LADO_SECUNDARIO = 44;
const LADO_ENVIAR = 52;

/**
 * Los controles de la grabación FIJADA, como los dibuja el prototipo ODOBI (`index.html:2943-2949`):
 * **tacho** (eliminar) · **reloj** `0:07` · **pausa/play** · **enviar** (el botón de la voz, que al fijar
 * pasa a ser «enviar»). Flotantes, sin glass.
 *
 * 🔴 **Revierte dos líneas del contrato `dictado-por-voz-sin-glass` (2026-07-23): «sin contador» y los
 * controles de TEXTO.** No es una divergencia que esta pieza decida: el operador volvió a decidir, DESPUÉS,
 * que `prototipo/index.html` «es la que contiene el modelo ui/ux que hay que implementar»
 * (`2026-10-13_contrato_planificacion-a-frontend1_el-prototipo-GANA…`). El «sin glass» y «flotantes» del
 * contrato viejo SIGUEN: el prototipo tampoco tiene glass.
 *
 * Los `testID` (`voz-pausar`/`voz-reanudar`/`voz-enviar`/`voz-eliminar`) son los de siempre: los controles
 * son los mismos tres, sólo cambia cómo se dibujan. Sin texto visible, así que cada uno lleva su
 * `accessibilityLabel` — es lo único que lo nombra.
 *
 * Se monta sólo cuando la grabación está `fijado` (deslizada hacia arriba) — `ChatView` es quien
 * decide cuándo, este componente es presentación pura sobre `fase`.
 *
 * 🔴 **Sin `Pausar` en `listo`.** Con `fase === 'listo'` el grabador ya se cortó (transitorio: sólo
 * ocurre un instante mientras `alEnviarVoz` corta y manda) — no hay nada que pausar, sólo Enviar o
 * Eliminar, igual que el HUD que reemplaza.
 */
export function ControlesFlotantes({
  fase,
  segundos,
  niveles,
  alPausar,
  alReanudar,
  alEnviar,
  alEliminar,
}: ControlesFlotantesProps) {
  const tema = useTema();
  const grabando = fase === 'grabando';
  const pausado = fase === 'pausado';

  return (
    <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(140)} style={styles.contenedor}>
      <Pressable
        testID="voz-eliminar"
        accessibilityRole="button"
        accessibilityLabel="Eliminar"
        onPress={alEliminar}
        style={pressableStyle([
          styles.circulo,
          {
            width: LADO_SECUNDARIO,
            height: LADO_SECUNDARIO,
            backgroundColor: tema.color.peligroFondo,
            borderColor: tema.color.peligroBorde,
            borderWidth: 1,
          },
        ])}
      >
        <IconoTachoVoz color={tema.color.peligro} />
      </Pressable>

      {/* El centro de la barra: la onda mientras graba, «En pausa» en TEXTO cuando no (`.lk-wave` /
          `.lk-pausa`, `index.html:2944-2946`; WCAG 1.4.1: el estado no puede depender sólo de que algo
          deje de moverse). Antes flotaban encima del composer; el prototipo las pone EN la barra. */}
      <View style={styles.centro}>
        {pausado ? (
          <EstadoEnPausa />
        ) : (
          <View testID="onda-flotante" style={styles.onda} pointerEvents="none">
            <Onda niveles={niveles} />
          </View>
        )}
      </View>

      {/* `tabular-nums`: sin esto el reloj cambia de ancho a cada segundo y lo que tiene al lado tiembla
          (`index.html:194`). En pausa baja a tenue — el reloj congelado es la otra pista de que no corre. */}
      <Text
        testID="voz-reloj"
        accessibilityRole="timer"
        style={[
          styles.reloj,
          {
            color: pausado ? tema.color.textoTenue : tema.color.texto,
            fontFamily: tema.fuente.uiMedium,
            fontSize: tema.tipo.grande,
          },
        ]}
      >
        {formatearDuracion(segundos)}
      </Text>

      {(grabando || pausado) && (
        <Pressable
          testID={pausado ? 'voz-reanudar' : 'voz-pausar'}
          accessibilityRole="button"
          accessibilityLabel={pausado ? 'Reanudar' : 'Pausar'}
          onPress={pausado ? alReanudar : alPausar}
          style={pressableStyle([
            styles.circulo,
            {
              width: LADO_SECUNDARIO,
              height: LADO_SECUNDARIO,
              backgroundColor: tema.color.superficieAlta,
              borderColor: tema.color.borde,
              borderWidth: 1,
            },
          ])}
        >
          {pausado ? <IconoPlayVoz color={tema.color.texto} /> : <IconoPausaVoz color={tema.color.texto} />}
        </Pressable>
      )}

      <Pressable
        testID="voz-enviar"
        accessibilityRole="button"
        accessibilityLabel="Enviar"
        onPress={alEnviar}
        style={pressableStyle([styles.circulo, { width: LADO_ENVIAR, height: LADO_ENVIAR }])}
      >
        <LinearGradient
          colors={[tema.glass.ub1, tema.glass.ub2]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, { borderRadius: LADO_ENVIAR / 2 }]}
        />
        <IconoEnviarVoz color={tema.color.acentoTexto} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // 🔴 `alignSelf: 'stretch'` NO es adorno: el padre (`overlayVoz` de `ChatView`) centra con
  // `alignItems: 'center'`, así que sin esto este contenedor toma el ancho de su CONTENIDO, y el `flex: 1`
  // del reloj (que reparte el espacio entre los botones) depende del ancho del contenedor: la referencia
  // circular lo colapsa y el reloj queda pegado a un borde. Es el mismo mecanismo que `ondaFlotante` ya
  // cubre con `width: '100%'` (DEVICE15 H6, medido en device: los botones de texto se partían letra a letra).
  contenedor: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  circulo: { borderRadius: 999, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  // `flex: 1` lo toma ahora el centro (onda / «En pausa»); el reloj conserva el ancho de su texto.
  reloj: { textAlign: 'center', fontVariant: ['tabular-nums'] },
  centro: { flex: 1, minWidth: 0, justifyContent: 'center' },
  onda: { alignSelf: 'stretch' },
});
