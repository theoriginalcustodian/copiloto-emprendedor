import { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import { ONDA_OSC_GBP } from '../../theme/glass/ondaPalette';

/**
 * Cantidad de barras. Port 1:1 de la `Onda.tsx` de documed (`_staging` no aplica acá -- el origen
 * real es `Agencia_IA_HyC/documed-front/apps/mobile/src/modules/captura/Onda.tsx`), con la medición
 * de performance intacta: es la misma técnica (N `Animated.View` con `transform` sobre el driver
 * nativo, sin Reanimated/Skia) y el mismo hallazgo de device real aplica sin cambios -- este
 * componente no toca nada específico de documed, sólo la paleta de colores (`ondaPalette.ts`), que
 * YA vive en este repo con el mismo shape.
 *
 * ## 🔴 Lo que la medición dijo, incluida la parte que refutó lo que se creía (documed, 2026-07-20)
 *
 * Medido en el device real (Samsung A21s, gama baja), 12 s de onda grabando, `dumpsys gfxinfo`. La
 * columna que manda es **vsync perdidos por frame**.
 *
 * | Config              | janky | mediana | vsync perdidos / frame |
 * |---------------------|-------|---------|------------------------|
 * | **sin onda** (base) | 2,8%  | 27 ms   | **0,000**              |
 * | 1 reloj, N=100      | 100%  | 65 ms   | 0,78                   |
 * | 1 reloj, N=48       | 89%   | 44 ms   | 0,19                   |
 * | 1 reloj, N=32       | 78%   | 42 ms   | 0,028                  |
 * | 2 relojes, N=48     | 99%   | 38 ms   | 0,30                   |
 * | 2 relojes, N=32     | 99%   | 38 ms   | 0,32                   |
 *
 * La app quieta va a 2,8% de jank y CERO vsync perdidos -- toda la degradación la aporta la onda.
 * Pasar de 48 a 32 barras (con dos relojes) no cambia nada: el costo NO escala con N, refutando el
 * modelo "más barras = más costo". El GPU se mantuvo en 2-3 ms en TODAS las filas.
 *
 * 🧾 **DEUDA HEREDADA — D-ONDA-JANK (propietario: operador, decisión MAYOR pendiente en el origen).**
 * Con esta técnica no se llega a fluido en un teléfono de gama baja. El siguiente paso no es seguir
 * ajustando constantes: es cambiar de técnica (Skia o un `<Path>` de SVG), decisión de dependencia
 * nueva que no le toca a este sprint. Mientras tanto queda `N=32`, lo medido más fluido.
 */
export const CANTIDAD_BARRAS = 32;

/** Altura de una barra en reposo. Nunca 0: una onda "apagada" no debe leerse como un hueco vacío --
 *  el usuario tiene que ver que el panel sigue vivo aunque no haya sonido este instante. */
export const ALTURA_REPOSO = 3;
export const ALTURA_MAXIMA = 48;

/**
 * `bell` de la variante `osc-gbp` (`waves-gallery.js:18` en el origen). Concentra levemente la
 * energía en el centro: al 0.15 es un realce sutil, no una campana marcada.
 */
const BELL = 0.15;

/**
 * Las DOS frecuencias de la referencia, literales -- no colapsadas a un solo reloj.
 *
 * Con un reloj único la onda entera se repite idéntica cada 2,5 s y el ojo detecta la repetición
 * aunque no pueda nombrarla (hallazgo de documed, 2026-07-20: "muy mecánica, no se la siente
 * fluida"). Dos relojes de períodos inconmensurables entre sí devuelven el período real de la
 * referencia -- 62,8 s -- sin que ninguna tabla de nudos tenga que cubrir 62,8 s.
 */
const OMEGA_RAPIDA = 5;
const OMEGA_LENTA = 2.3;

/** Período de cada reloj, en ms. `2π/ω`: 1257 ms el rápido, 2732 ms el lento. */
export const PERIODO_RAPIDO_MS = Math.round((2 * Math.PI * 1000) / OMEGA_RAPIDA);
export const PERIODO_LENTO_MS = Math.round((2 * Math.PI * 1000) / OMEGA_LENTA);

/** Peso del término lento dentro del valor absoluto. */
const PESO_LENTO = 0.4;

/** Nudos precalculados por reloj y por barra. Cada reloj cubre UN ciclo de su propio seno, así que
 *  32 nudos dan ~11 grados entre muestras: el driver nativo interpola linealmente entre ellas y a
 *  esa densidad la recta y el seno son indistinguibles a simple vista. */
const NUDOS = 32;

/** Cuánto tarda la amplitud en seguir al micrófono (constante de tiempo ~200 ms). */
const MS_AMPLITUD = 200;

/** Amplitud en reposo. No es 0 a propósito: una onda completamente inmóvil se lee como colgada. */
const AMPLITUD_REPOSO = 0.12;

export interface OndaProps {
  /** Niveles de amplitud recientes, 0..1, uno por muestra del hilo de audio (el más nuevo al final). */
  niveles: number[];
}

/**
 * Amplitud a la que tiene que tender la onda para un lote de muestras. **Es lo ÚNICO que el audio
 * aporta**: un escalar, no la forma.
 *
 * Se toma el máximo de las últimas muestras y no la última suelta: a 10 muestras por segundo, la
 * última puede caer justo en el valle entre dos sílabas y la onda se desplomaría en medio de una
 * palabra. El máximo de la ventana corta sigue la voz, no el silencio entre fonemas.
 */
export function amplitudObjetivo(niveles: number[]): number {
  if (niveles.length === 0) return AMPLITUD_REPOSO;
  const recientes = niveles.slice(-4);
  const pico = Math.max(...recientes);
  return Math.min(1, Math.max(AMPLITUD_REPOSO, pico));
}

/**
 * Peso propio de cada barra -- generador congruencial determinista (semilla 3, `osc-gbp` en el
 * origen). La silueta de la onda es FIJA, no aleatoria: si no se reproduce el mismo generador, la
 * onda se ve como *otra* onda plausible, que es peor que verse mal porque nadie nota la diferencia
 * hasta compararlas.
 */
function ruidoDeBarra(indice: number): number {
  let s = 3 >>> 0;
  for (let i = 0; i <= indice; i++) s = (s * 1664525 + 1013904223) >>> 0;
  return s / 4294967296;
}

/** La envolvente ESTÁTICA de la barra `indice`: cuánto puede llegar a medir, sin importar el tiempo. */
function envolvente(indice: number, total: number): number {
  const u = (indice + 0.5) / total;
  let env = 0.3 + 0.7 * ruidoDeBarra(indice);
  env *= 0.5 + 0.5 * Math.abs(Math.sin(u * Math.PI));
  env *= 1 - BELL + BELL * Math.exp(-Math.pow((u - 0.5) / 0.32, 2));
  return env;
}

/**
 * Los dos senos de la referencia, uno por reloj. Cada reloj recorre 0→1 en SU período, y como
 * `t·ω = fase·2π` por construcción, la fase normalizada entra directo como ángulo.
 */
export function senoRapido(indice: number, fase: number): number {
  return Math.sin(2 * Math.PI * fase + indice * 0.55);
}

export function senoLento(indice: number, fase: number): number {
  return Math.sin(2 * Math.PI * fase + indice * 0.2);
}

/**
 * La forma de la barra `indice` para un par de fases (cada una 0..1 en su propio reloj). Devuelve
 * 0..1 -- es la ALTURA RELATIVA antes de aplicar la amplitud del micrófono.
 */
export function formaBarra(
  indice: number,
  faseRapida: number,
  faseLenta: number,
  total: number = CANTIDAD_BARRAS,
): number {
  const dyn =
    0.5 +
    0.42 * Math.abs(senoRapido(indice, faseRapida) + PESO_LENTO * senoLento(indice, faseLenta));
  return Math.min(1, Math.max(0, envolvente(indice, total) * dyn));
}

/** Escala vertical de una barra para una altura relativa 0..1. En reposo NO es 0 (ver `ALTURA_REPOSO`). */
export function escalaDe(nivel: number): number {
  const acotado = Math.min(1, Math.max(0, nivel));
  return (ALTURA_REPOSO + acotado * (ALTURA_MAXIMA - ALTURA_REPOSO)) / ALTURA_MAXIMA;
}

/**
 * Color de la barra `indice`, muestreando el degradé en su posición. El color de un píxel depende
 * SÓLO de su `x` (degradé horizontal); como cada barra vive en una `x` fija, el color se calcula una
 * vez al montar -- cero costo por frame, aunque la barra esté animándose a 60 fps.
 */
export function colorDeBarra(indice: number, total: number = CANTIDAD_BARRAS): string {
  const paleta = ONDA_OSC_GBP;
  const u = total <= 1 ? 0 : indice / (total - 1);
  const tramo = u * (paleta.length - 1);
  const desde = Math.min(paleta.length - 2, Math.floor(tramo));
  return mezclarHex(paleta[desde], paleta[desde + 1], tramo - desde);
}

/** Interpolación lineal entre dos colores `#rrggbb`. Sin dependencias: son 6 dígitos y una regla de tres. */
function mezclarHex(a: string, b: string, k: number): string {
  const canal = (c: string, desde: number) => parseInt(c.slice(desde, desde + 2), 16);
  const mezcla = (i: number) => Math.round(canal(a, i) + (canal(b, i) - canal(a, i)) * k);
  const dosDigitos = (n: number) => n.toString(16).padStart(2, '0');
  return `#${dosDigitos(mezcla(1))}${dosDigitos(mezcla(3))}${dosDigitos(mezcla(5))}`;
}

/**
 * La onda de amplitud mientras se graba -- variante **`osc-gbp` («Oscilograma espectro»)**.
 *
 * Modelo TIME-DRIVEN: la forma avanza con el TIEMPO (dos `Animated.Value` recorriendo 0→1 en bucle
 * sobre el driver nativo, cada uno en su período), mientras el micrófono modula un solo escalar
 * (`amplitud`) suavizado. La forma nunca se entera de que las muestras de audio llegan a 10 Hz --
 * eso es lo que evita el efecto "escalón" de una onda sample-driven.
 *
 * Todo el trabajo por frame es interpolación NATIVA sobre `transform`; el hilo de JS no hace nada en
 * el loop. El único efecto que sí toca JS es el de `amplitud`, y depende del ESCALAR
 * (`amplitudObjetivo(niveles)`), no del array `niveles` -- depender del array reconfigura los nodos
 * nativos ~10 veces por segundo (una por muestra) y produce carreras reales, medidas en el origen
 * como "Native animation workaround, frame lost as result of race condition".
 */
export function Onda({ niveles }: OndaProps) {
  const relojRapido = useRef(new Animated.Value(0)).current;
  const relojLento = useRef(new Animated.Value(0)).current;
  const amplitud = useRef(new Animated.Value(AMPLITUD_REPOSO)).current;

  useEffect(() => {
    const bucles = [
      Animated.loop(
        Animated.timing(relojRapido, {
          toValue: 1,
          duration: PERIODO_RAPIDO_MS,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ),
      Animated.loop(
        Animated.timing(relojLento, {
          toValue: 1,
          duration: PERIODO_LENTO_MS,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ),
    ];
    bucles.forEach((b) => b.start());
    return () => bucles.forEach((b) => b.stop());
  }, [relojRapido, relojLento]);

  const objetivoAmplitud = amplitudObjetivo(niveles);
  useEffect(() => {
    const anim = Animated.timing(amplitud, {
      toValue: objetivoAmplitud,
      duration: MS_AMPLITUD,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    });
    anim.start();
  }, [objetivoAmplitud, amplitud]);

  useEffect(() => {
    return () => amplitud.stopAnimation();
  }, [amplitud]);

  const barras = useMemo(() => {
    const fases = Array.from({ length: NUDOS }, (_, k) => k / (NUDOS - 1));
    const pisoFrac = ALTURA_REPOSO / ALTURA_MAXIMA;
    const TOPE_SUMA = 1 + PESO_LENTO;
    return Array.from({ length: CANTIDAD_BARRAS }, (_, i) => {
      const rapido = relojRapido.interpolate({
        inputRange: fases,
        outputRange: fases.map((f) => senoRapido(i, f)),
      });
      const lento = relojLento.interpolate({
        inputRange: fases,
        outputRange: fases.map((f) => senoLento(i, f)),
      });

      const absSuma = Animated.add(rapido, Animated.multiply(PESO_LENTO, lento)).interpolate({
        inputRange: [-TOPE_SUMA, 0, TOPE_SUMA],
        outputRange: [TOPE_SUMA, 0, TOPE_SUMA],
      });

      const forma = Animated.multiply(
        envolvente(i, CANTIDAD_BARRAS),
        Animated.add(0.5, Animated.multiply(0.42, absSuma)),
      ).interpolate({ inputRange: [0, 1], outputRange: [0, 1], extrapolate: 'clamp' });

      return {
        escala: Animated.add(
          pisoFrac,
          Animated.multiply(1 - pisoFrac, Animated.multiply(forma, amplitud)),
        ),
        color: colorDeBarra(i),
      };
    });
  }, [relojRapido, relojLento, amplitud]);

  return (
    <View
      testID="onda"
      style={styles.contenedor}
      accessibilityRole="progressbar"
      accessibilityLabel="Nivel de audio"
    >
      {barras.map(({ escala, color }, indice) => (
        <Animated.View
          key={indice}
          testID={`onda-barra-${indice}`}
          style={[
            styles.barra,
            { backgroundColor: color },
            { transform: [{ scaleY: escala }] },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: ALTURA_MAXIMA,
    // `stretch`: sin esto la onda es INVISIBLE (barras `flex:1` dentro de un contenedor sin ancho
    // propio resuelven a 0 -- 100 vistas animándose a 60fps, midiendo cero, sin un solo error).
    alignSelf: 'stretch',
  },
  barra: {
    flex: 1,
    minWidth: 1,
    // Hueco PROPORCIONAL a N (`25/N`%), no fijo -- con margen fijo la onda se deforma en bloques al
    // cambiar N. Ver el docstring de `CANTIDAD_BARRAS`.
    marginHorizontal: `${25 / CANTIDAD_BARRAS}%`,
    height: ALTURA_MAXIMA,
    borderRadius: 1,
  },
});
