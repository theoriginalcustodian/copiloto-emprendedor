/**
 * `HudGrabacion` -- la superficie de una grabación viva. **Presentación pura**, sin máquina de
 * estados. Port 1:1 de la `HudGrabacion.tsx` de documed (origen en `modules/captura/`, compartida
 * ahí entre la grabación clínica y la del copiloto): acá vive sola en `modules/chat/` porque este
 * producto no tiene panel clínico -- el único consumidor es `GlassGrabacionCopiloto`.
 *
 * 🔴 **Los botones viven a nivel de MÓDULO, no dentro del componente.** Mientras se graba, el HUD
 * re-renderiza ~10 veces por segundo (la onda dibuja el nivel real del micrófono). Un componente
 * declarado en el cuerpo se recrea con IDENTIDAD nueva en cada render -> React desmonta el
 * `Pressable` y monta otro, y el toque llega a una vista que ya no existe: "Pausar"/"Enviar" dejan de
 * responder. Medido en un Samsung real por el proyecto de origen. Declarados afuera, la identidad es
 * estable.
 *
 * `Pressable` sale de `react-native` (core), NO de `react-native-gesture-handler` -- a diferencia de
 * `Tile.tsx` (que sí necesita RNGH porque compite con el `ScrollView` del escritorio por el mismo
 * toque, ver su docstring). Estos botones viven dentro del vidrio `takeover` de `MarcoGlass`, sin
 * ningún `ScrollView` disputando el gesto -- mismo criterio que el botón "Volver" del propio
 * `MarcoGlass` y los botones de gate de `ListaMensajes`, ambos ya en este repo con `Pressable` de
 * `react-native`.
 */
import { LinearGradient } from 'expo-linear-gradient';
import type { PropsWithChildren, ReactNode } from 'react';
import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { pressableStyle } from '../../theme/glass/presion';
import { useTema } from '../../theme/ThemeProvider';
import { Onda } from './Onda';

/** `123` s -> `"02:03"`. Pura: es lo único de este helper que un test afirma de verdad. */
export function formatoMMSS(segundos: number): string {
  const s = Math.max(0, Math.floor(segundos));
  const mm = String(Math.floor(s / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

export function BotonPrimario({
  id,
  texto,
  onPress,
  icono,
  disabled = false,
}: {
  id: string;
  texto: string;
  onPress: () => void;
  icono?: boolean;
  /** Se apaga mientras hay una operación en vuelo que este botón podría re-disparar. `disabled` -- y
   *  no ocultarlo: un control que desaparece bajo el dedo hace que el siguiente toque caiga en lo que
   *  quedó abajo. */
  disabled?: boolean;
}) {
  const tema = useTema();
  return (
    <Pressable
      testID={id}
      onPress={onPress}
      disabled={disabled}
      style={pressableStyle([styles.botonBase, disabled && styles.apagado])}
    >
      <LinearGradient
        colors={[tema.glass.accent2, tema.color.acento]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[StyleSheet.absoluteFill, { borderRadius: 18 }]}
      />
      <View style={[styles.bordeSuperior, { backgroundColor: tema.glass.hi }]} pointerEvents="none" />
      <View style={styles.botonFila}>
        {icono === true && <IconoEnviar color={tema.color.acentoTexto} />}
        <Text style={{ color: tema.color.acentoTexto, fontFamily: tema.fuente.uiSemibold, fontSize: tema.tipo.grande }}>
          {texto}
        </Text>
      </View>
    </Pressable>
  );
}

export function BotonGhost({
  id,
  texto,
  onPress,
  disabled = false,
}: {
  id: string;
  texto: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const tema = useTema();
  return (
    <Pressable
      testID={id}
      onPress={onPress}
      disabled={disabled}
      style={pressableStyle([
        styles.botonBase,
        styles.botonGhost,
        { backgroundColor: tema.color.superficieAlta, borderColor: tema.color.borde, borderRadius: 18 },
        disabled && styles.apagado,
      ])}
    >
      <Text style={{ color: tema.color.texto, fontFamily: tema.fuente.uiSemibold, fontSize: tema.tipo.grande }}>
        {texto}
      </Text>
    </Pressable>
  );
}

/**
 * La píldora de descartar. Es la única vía legítima de PERDER audio, así que se ve distinta del resto
 * (rojo, ícono de tacho) y nunca comparte fila con un botón de acción normal.
 */
export function BotonDescartar({
  id,
  onPress,
  disabled = false,
}: {
  id: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const tema = useTema();
  return (
    <Pressable
      testID={id}
      onPress={onPress}
      disabled={disabled}
      style={pressableStyle([
        styles.descartar,
        { backgroundColor: tema.color.peligroFondo, borderColor: tema.color.peligroBorde, borderWidth: 1 },
        disabled && styles.apagado,
      ])}
    >
      <IconoTacho color={tema.color.peligro} />
      <Text style={{ color: tema.color.peligro, fontFamily: tema.fuente.uiMedium, fontSize: tema.tipo.chico }}>
        Descartar
      </Text>
    </Pressable>
  );
}

/** El icono de "enviar" -- mismo path que `IconoAvion` de `Composer.tsx` (avioncito de papel). */
function IconoEnviar({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path d="M4 12l16-8-6 16-2.5-6L4 12z" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
    </Svg>
  );
}

function IconoTacho({ color }: { color: string }) {
  return (
    <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
      <Path
        d="M5 7h14M9 7V5h6v2M6 7l1 13h10l1-13"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** El punto que late del encabezado. Opacidad plena grabando, tenue si no. `Animated` del core +
 *  `useNativeDriver` (opacity): late en el hilo de UI, sin tocar el de JS. */
function PuntoLatido({ activo, color }: { activo: boolean; color: string }) {
  const op = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!activo) {
      op.setValue(0.4);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(op, { toValue: 0.28, duration: 600, useNativeDriver: true }),
        Animated.timing(op, { toValue: 1, duration: 600, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [activo, op]);
  return <Animated.View style={[styles.puntoLatido, { backgroundColor: color, opacity: op }]} />;
}

export interface HudGrabacionProps extends PropsWithChildren {
  /** "Grabando…", "En pausa", "Grabación lista"… -- el estado, en el encabezado. */
  etiqueta: string;
  /** ¿Está capturando ahora? Sólo controla que el punto lata y que la onda se mueva. */
  activo: boolean;
  /** Segundos transcurridos, ya calculados por quien sea dueño del cronómetro. */
  segundos: number;
  /** Subtítulo de contexto. */
  contexto?: string | null;
  /** Niveles de amplitud del micrófono para la onda. Vacío = onda en reposo. */
  niveles?: number[];
  /** Avisos en vivo. Van sobre los controles. */
  avisos?: ReactNode;
  testID?: string;
}

export function HudGrabacion({
  etiqueta,
  activo,
  segundos,
  contexto,
  niveles = [],
  avisos,
  testID = 'hud-grabacion',
  children,
}: HudGrabacionProps) {
  const tema = useTema();
  return (
    <View style={styles.contenedor} testID={testID}>
      <View style={styles.encabezado}>
        <View style={styles.etiquetaFila}>
          <PuntoLatido activo={activo} color={tema.color.acento} />
          <Text style={[styles.etiquetaEstado, { color: tema.color.acento, fontFamily: tema.fuente.mono }]}>
            {etiqueta}
          </Text>
        </View>
        <Text style={[styles.cronometro, { color: tema.color.texto, fontFamily: tema.fuente.uiSemibold }]}>
          {formatoMMSS(segundos)}
        </Text>
        {contexto != null && contexto !== '' && (
          <Text style={[styles.contexto, { color: tema.color.textoTenue, fontFamily: tema.fuente.mono }]}>
            {contexto}
          </Text>
        )}
      </View>

      {/* La onda, en el centro. Dibuja el nivel REAL del micrófono; en reposo queda quieta. */}
      <View style={styles.zonaOnda}>
        <View style={styles.ondaEscalada}>
          <Onda niveles={activo ? niveles : []} />
        </View>
      </View>

      <View style={styles.controles}>
        {avisos}
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1, paddingTop: 24 },
  encabezado: { alignItems: 'center', paddingHorizontal: 24, paddingTop: 24 },
  etiquetaFila: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  puntoLatido: { width: 8, height: 8, borderRadius: 4 },
  etiquetaEstado: { fontSize: 11, letterSpacing: 1.8, textTransform: 'uppercase' },
  cronometro: { fontSize: 40, marginTop: 12, letterSpacing: 0.5, fontVariant: ['tabular-nums'] },
  contexto: { fontSize: 12, marginTop: 6, letterSpacing: 0.3 },
  zonaOnda: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 22 },
  // `alignSelf:'stretch'` le da a la onda el ancho de la zona -- ver el docstring de `Onda.tsx` sobre
  // por qué desaparece en silencio sin esto.
  ondaEscalada: { alignSelf: 'stretch', transform: [{ scaleY: 2.6 }] },
  controles: { paddingHorizontal: 24, paddingBottom: 40, gap: 14 },
  botonBase: { flex: 1, minHeight: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  botonGhost: { borderWidth: 1 },
  // Un control apagado tiene que LEERSE apagado: si el toque deja de responder y el botón se ve igual,
  // el usuario concluye que la app se colgó -- justo lo contrario de lo que el apagado informa.
  apagado: { opacity: 0.5 },
  botonFila: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  bordeSuperior: { position: 'absolute', top: 0, left: 24, right: 24, height: 1 },
  descartar: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 18,
    minHeight: 44,
    borderRadius: 999,
    justifyContent: 'center',
  },
});

/** Fila de dos controles lado a lado (Pausar/Enviar, Reanudar/Enviar…). */
export const filaControles = { flexDirection: 'row', alignItems: 'center', gap: 12 } as const;
/** Texto de ayuda bajo los controles. */
export const textoHint = { fontSize: 13, textAlign: 'center' } as const;
