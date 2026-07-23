/**
 * `HudGrabacion` — la superficie de una grabación viva. **Presentación pura**, sin máquina de estados.
 *
 * Existe porque hay DOS grabaciones en la app y el operador pidió que se vean igual (2026-07-19:
 * *"el botón de micrófono debe desplegar el mismo glass… nada más que para el copiloto general… las
 * funciones de detener, pausar, enviar, eliminar son todas las mismas"*):
 *
 *  - la **clínica** (`PantallaGrabacion`), sobre el grabador que segmenta a disco y sobrevive a que
 *    el sistema mate la app — porque perder 40 minutos de consulta es perder algo irrepetible;
 *  - la del **copiloto** (`GlassGrabacionCopiloto`), sobre el grabador liviano de `expo-audio` — un
 *    comando de voz que se pierde se repite, y pagar la segmentación ahí sería sobreingeniería.
 *
 * Las dos máquinas siguen siendo distintas a propósito (ver `useVozComando`); lo que se comparte es
 * **esto**: el layout, el cronómetro, la onda y los botones. Duplicar el layout para la segunda es
 * exactamente cómo nació la divergencia entre los glass que hubo que corregir a mano en cada pantalla.
 *
 * 🔴 **Los botones viven a nivel de MÓDULO, no dentro del componente.** Mientras se graba, el HUD
 * re-renderiza ~10 veces por segundo (la onda dibuja el nivel real del micrófono). Un componente
 * declarado en el cuerpo se recrea con IDENTIDAD nueva en cada render → React desmonta el `Pressable`
 * y monta otro, y el `touch up` llega a una vista que ya no existe: "Pausar"/"Detener" dejan de
 * responder. Medido en un Samsung real. Declarados afuera, la identidad es estable.
 */
import { LinearGradient } from 'expo-linear-gradient';
import type { PropsWithChildren, ReactNode } from 'react';
import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { pressableStyle } from '../../theme/glass/presion';
import { useMovimientoReducido } from '../../theme/movimientoReducido';
import { useTema } from '../../theme/ThemeProvider';
import { Onda } from './Onda';
import { formatoMMSS } from './useCronometro';

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
  /** Se apaga mientras hay una operación en vuelo que este botón podría re-disparar (ver `cerrando`
   *  en `PantallaGrabacion`). `disabled` -- y no ocultarlo: un control que desaparece bajo el dedo
   *  hace que el siguiente toque caiga en lo que quedó abajo. */
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
  texto = 'Descartar',
}: {
  id: string;
  onPress: () => void;
  disabled?: boolean;
  /** El texto por defecto es "Descartar" (grabación clínica); el dictado del copiloto usa "Eliminar"
   *  (contrato `dictado-por-voz-sin-glass...`) — misma acción destructiva, distinto vocabulario de
   *  dominio, así que se parametriza en vez de forkear el componente. */
  texto?: string;
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
      {/* El tacho del template (path 1:1). Reemplaza al emoji 🗑, que se dibuja distinto en cada
          Android y en algunos aparece a color -- justo el elemento que NO puede parecer festivo. */}
      <IconoTacho color={tema.color.peligro} />
      <Text style={{ color: tema.color.peligro, fontFamily: tema.fuente.uiMedium, fontSize: tema.tipo.chico }}>
        {texto}
      </Text>
    </Pressable>
  );
}

/** El icono de "enviar" del template (el avioncito de papel), path 1:1 del prototipo. */
function IconoEnviar({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path d="M4 12l16-8-6 16-2.5-6L4 12z" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
    </Svg>
  );
}

/** El tacho del template (`DocuMed App.dc.html:151`), path 1:1. */
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

/** El punto que late del encabezado (`dm-blink` del template). Opacidad plena grabando, tenue si no.
 *  `Animated` del core + `useNativeDriver` (opacity): late en el hilo de UI, sin tocar el de JS. */
function PuntoLatido({ activo, color }: { activo: boolean; color: string }) {
  const op = useRef(new Animated.Value(1)).current;
  const movimientoReducido = useMovimientoReducido();
  useEffect(() => {
    if (!activo) {
      op.setValue(0.4);
      return;
    }
    // 🔴 Con movimiento reducido queda ENCENDIDO fijo, no apagado. Este punto sí dice algo —«estoy
    // grabando»— y la diferencia es que **ese dato también está escrito al lado**, en `etiqueta`. Así
    // que se puede dejar de parpadear sin perderlo, pero **no** se puede dejar en el estado tenue: eso
    // sería mostrar «no grabando» mientras graba. La onda de al lado NO se toca: ahí el movimiento es
    // el único portador de «te estoy escuchando». Ver `useMovimientoReducido`.
    if (movimientoReducido) {
      op.setValue(1);
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
  }, [activo, movimientoReducido, op]);
  return <Animated.View style={[styles.puntoLatido, { backgroundColor: color, opacity: op }]} />;
}

export interface HudGrabacionProps extends PropsWithChildren {
  /** "Grabando…", "En pausa", "Grabación lista"… — el estado, en el encabezado. */
  etiqueta: string;
  /** ¿Está capturando ahora? Sólo controla que el punto lata y que la onda se mueva. */
  activo: boolean;
  /** Segundos transcurridos, ya calculados por quien sea dueño del cronómetro. */
  segundos: number;
  /** Subtítulo de contexto. En la clínica es `Tipo — Paciente`; el copiloto no lleva paciente. */
  contexto?: string | null;
  /** Niveles de amplitud del micrófono para la onda. Vacío = onda en reposo. */
  niveles?: number[];
  /** Avisos en vivo (se cortó, cambió de fuente…). Van sobre los controles. */
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
      {/* Encabezado: punto que late + estado + cronómetro grande + contexto. */}
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

      {/* La onda, en el centro. `Onda` dibuja el nivel REAL del micrófono (mejor que una animación
          decorativa); acá se agranda con `scale` para ocupar el HUD. En reposo queda quieta. */}
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
  // `alignSelf: 'stretch'` le da a la onda el ancho de la zona (pantalla menos el padding). Sin esto
  // el `View` toma ancho "auto" -- el de su contenido -- y como las barras de la onda son `flex: 1`,
  // el ancho del contenido depende del contenedor: la referencia circular colapsa a 0 y la onda
  // desaparece sin error (pasó el 2026-07-20).
  //
  // Ya no hay `scaleX`: existía para agrandar una onda de 24 barras que se dimensionaba SOLA
  // (120 dp de ancho intrínseco). Ahora la onda ocupa el ancho real, así que escalarla en X sólo
  // la sacaría de la pantalla. `scaleY` se queda: la altura sí es la del componente (48 dp) y el HUD
  // la quiere más alta.
  ondaEscalada: { alignSelf: 'stretch', transform: [{ scaleY: 2.6 }] },
  controles: { paddingHorizontal: 24, paddingBottom: 40, gap: 14 },
  botonBase: { flex: 1, minHeight: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  botonGhost: { borderWidth: 1 },
  // Un control apagado tiene que LEERSE apagado: si el toque deja de responder y el botón se ve
  // igual, el médico concluye que la app se colgó -- justo lo contrario de lo que el apagado informa.
  apagado: { opacity: 0.5 },
  botonFila: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  bordeSuperior: { position: 'absolute', top: 0, left: 24, right: 24, height: 1 },
  // Píldora del template: `padding:10px 18px; min-height:44px; border-radius:999px`, con el ícono
  // a la izquierda del texto. `minHeight:44` no es estético: es el mínimo táctil.
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

/** Fila de dos controles lado a lado (Pausar/Detener, Reanudar/Detener…). */
export const filaControles = { flexDirection: 'row', alignItems: 'center', gap: 12 } as const;
/** Texto de ayuda bajo los controles. */
export const textoHint = { fontSize: 13, textAlign: 'center' } as const;
