import { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import { ONDA_OSC_GBP } from '../../theme/glass/ondaPalette';

/**
 * Cantidad de barras. La referencia usa 100 (`waves-gallery.js:18`, `opts.n`).
 *
 * ## 🔴 Lo que la medición dijo, incluida la parte que refutó lo que yo creía
 *
 * Todo medido el 2026-07-20 en el device real (Samsung A21s, gama baja), 12 s de onda grabando,
 * `dumpsys gfxinfo`. La columna que manda es **vsync perdidos por frame**: un vsync perdido es un
 * refresco que no salió a tiempo, que es lo que el ojo lee como tirón. Se normaliza por frame porque
 * las ventanas de medición no duran exactamente lo mismo y los totales crudos no son comparables.
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
 * **La fila que importa es la primera:** la app quieta va a 2,8% de jank y CERO vsync perdidos. Toda
 * la degradación la aporta la onda. No es un artefacto del dev client — el baseline se midió en el
 * mismo entorno.
 *
 * **Y las dos últimas filas refutan el modelo con el que se eligió N.** Con dos relojes, pasar de 48
 * a 32 barras no cambia NADA. Si el costo fuera «N vistas actualizando `transform`», N tendría que
 * importar. No importa ⇒ ese modelo era falso, o al menos incompleto. El GPU se mantuvo en 2-3 ms en
 * TODAS las filas: no se va en dibujar.
 *
 * Parte del costo era una carrera real (ver el efecto de la amplitud, más abajo: se reconfiguraban
 * los nodos 10 veces por segundo y Android reportaba «frame lost as result of race condition»). Se
 * arregló, los errores desaparecieron — y el jank **no se movió**. O sea que la carrera era un
 * defecto verdadero y aun así **no era la causa** de lo que el operador siente.
 *
 * ## 🧾 DEUDA ABIERTA — D-ONDA-JANK (propietario: operador, decisión MAYOR pendiente)
 *
 * Con esta técnica (N `Animated.View` con `transform` sobre el driver nativo) no se llega a fluido en
 * un teléfono de gama baja, con ningún N ni ninguna cantidad de relojes. El siguiente paso NO es
 * seguir ajustando constantes: es cambiar de técnica (una sola superficie de dibujo — Skia o un
 * `<Path>` de SVG), y eso es una dependencia nueva, o sea decisión del operador.
 *
 * Mientras tanto queda `N=32`, que es lo medido más fluido, con el hueco proporcional que impide que
 * bajar N deforme la onda (ver `marginHorizontal` en los estilos).
 *
 * Bajar `N` no deforma la onda: `u = (i+0.5)/N` está normalizado, así que la envolvente (la campana
 * y el `bell`) se mantiene idéntica — lo que se pierde es detalle fino entre barras vecinas.
 */
export const CANTIDAD_BARRAS = 32;

/** Altura de una barra en reposo. Nunca 0: una onda "apagada" no debe leerse como un hueco vacío --
 *  el médico tiene que ver que el panel sigue vivo aunque no haya sonido este instante. */
export const ALTURA_REPOSO = 3;
export const ALTURA_MAXIMA = 48;

/**
 * `bell` de la variante `osc-gbp` (`waves-gallery.js:18`). Concentra levemente la energía en el
 * centro: al 0.15 es un realce sutil, no una campana marcada.
 */
const BELL = 0.15;

/**
 * Las DOS frecuencias de la referencia, ahora literales.
 *
 * 🔴 **Acá vivía la única desviación de la galería, y el operador la sintió.** El original es
 * `dyn = 0.5 + 0.42·|sin(t·5 + i·0.55) + 0.4·sin(t·2.3 + i·0.2)|` (`waves-gallery.js:112`). Con
 * `2.3` los dos términos sólo vuelven a alinearse cada **20π ≈ 62,8 s**, y la galería nunca cierra
 * el ciclo porque anima con un reloj libre. La primera versión de este archivo cambió `2.3 → 2.5`
 * para que el bucle cerrara en 2,5 s y se pudieran precalcular los nudos de UN reloj, y documentó
 * el cambio como «imperceptible».
 *
 * **Era falso.** Con un solo reloj de 2,5 s la onda entera se REPITE IDÉNTICA cada 2,5 segundos, y
 * el ojo detecta la repetición aunque no pueda nombrarla: el operador lo describió como *«muy
 * mecánica, no se la siente fluida y natural»* (2026-07-20). El defecto no estaba en el valor de la
 * constante — estaba en haber colapsado dos frecuencias en un solo bucle.
 *
 * La solución no exige volver a un reloj libre (que costaría JS por frame): **dos relojes**, uno por
 * término, cada uno con su propio período. Cada término es periódico por separado y barato de
 * precalcular; la SUMA recién se repite cuando ambos coinciden, o sea a los **62,8 s** — el mismo
 * período que la referencia. Se recupera el `2.3` literal y la onda deja de repetirse.
 */
const OMEGA_RAPIDA = 5;
const OMEGA_LENTA = 2.3;

/** Período de cada reloj, en ms. `2π/ω`: 1257 ms el rápido, 2732 ms el lento. */
export const PERIODO_RAPIDO_MS = Math.round((2 * Math.PI * 1000) / OMEGA_RAPIDA);
export const PERIODO_LENTO_MS = Math.round((2 * Math.PI * 1000) / OMEGA_LENTA);

/** Peso del término lento dentro del valor absoluto (`waves-gallery.js:112`). */
const PESO_LENTO = 0.4;

/** Nudos precalculados por reloj y por barra. Cada reloj cubre UN ciclo de su propio seno, así que
 *  32 nudos dan ~11 grados entre muestras: el driver nativo interpola linealmente entre ellas y a
 *  esa densidad la recta y el seno son indistinguibles a simple vista. */
const NUDOS = 32;

/** Cuánto tarda la amplitud en seguir al micrófono. La referencia usa `_amp += (target-_amp)·dt·5`
 *  (`waves-gallery.js:88`), o sea una constante de tiempo de ~200 ms. */
const MS_AMPLITUD = 200;

/** Amplitud en reposo. No es 0 a propósito: es el estado `stopped` de la referencia
 *  (`waves-gallery.js:87`, `target = 0.12`). Una onda completamente inmóvil se lee como colgada. */
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
 * Peso propio de cada barra — el `seeded(N, 3)` de la referencia (`waves-gallery.js:13,95`; la
 * semilla es 3 porque `osc-gbp` no es `core` ni `noise`).
 *
 * 🔴 Determinista a propósito: **la silueta de la onda es fija, no aleatoria**. Si no se reproduce
 * el mismo generador congruencial, la onda no se ve como la referencia — se ve como *otra* onda
 * plausible, que es peor que verse mal, porque nadie nota la diferencia hasta compararlas.
 */
function ruidoDeBarra(indice: number): number {
  let s = 3 >>> 0;
  for (let i = 0; i <= indice; i++) s = (s * 1664525 + 1013904223) >>> 0;
  return s / 4294967296;
}

/**
 * La envolvente ESTÁTICA de la barra `indice`: cuánto puede llegar a medir, sin importar el tiempo.
 * Réplica de las tres primeras líneas de `_draw_bars` (`waves-gallery.js:109-111`).
 */
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
 *
 * Están separados —y exportados— porque son las dos piezas que el driver nativo interpola por
 * separado: es lo que permite que la combinación no se repita hasta los 62,8 s sin que ningún reloj
 * tenga que durar 62,8 s.
 */
export function senoRapido(indice: number, fase: number): number {
  return Math.sin(2 * Math.PI * fase + indice * 0.55);
}

export function senoLento(indice: number, fase: number): number {
  return Math.sin(2 * Math.PI * fase + indice * 0.2);
}

/**
 * La forma de la barra `indice` para un par de fases (cada una 0..1 en su propio reloj). Réplica
 * literal de `_draw_bars` (`waves-gallery.js:105-118`) — ya sin desviaciones.
 *
 * Devuelve 0..1 — es la ALTURA RELATIVA antes de aplicar la amplitud del micrófono.
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
 * Color de la barra `indice`, muestreando el degradé en su posición.
 *
 * 🔴 **Esto reemplaza al `<linearGradient>` sin dibujar ninguno, y es exacto — no una aproximación.**
 * La referencia usa un degradé horizontal `gradientUnits="userSpaceOnUse"` (`waves-gallery.js:69`):
 * el color de un píxel depende SÓLO de su `x`. Como cada barra vive en una `x` fija, muestrear el
 * degradé en el centro de la barra da el mismo color que pintaría el SVG ahí. Y como la posición no
 * cambia nunca, el color se calcula una vez al montar: **cero costo por frame**, aunque la barra
 * esté animándose a 60 fps. Es exactamente lo que la referencia declara en su encabezado — *"solo la
 * geometría se anima"*.
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
 * La onda de amplitud mientras se graba — variante **`osc-gbp` («Oscilograma espectro»)** de la
 * galería de referencia `waves-gallery.js`.
 *
 * 🔴 **Modelo TIME-DRIVEN, y ese sigue siendo el punto de este archivo.**
 *
 * Una versión anterior era *sample-driven*: cada barra saltaba al valor crudo de una muestra del
 * micrófono, y como el hilo de audio entrega ~10 muestras por segundo, se veían **10 escalones por
 * segundo**. El operador lo describió como "toscas, lentas, trabadas y robóticas" (2026-07-19), y
 * tenía razón: no era el renderer, era el modelo.
 *
 * La forma avanza con el TIEMPO, a la frecuencia de refresco de la pantalla, mientras el micrófono
 * modula **un solo escalar** (`amplitud`) suavizado. La forma nunca se entera de que las muestras
 * llegan a 10 Hz.
 *
 * **Cómo corre sin `reanimated` ni Skia.** DOS `Animated.Value` (`relojRapido`, `relojLento`)
 * recorren 0→1 en bucle sobre el driver NATIVO, cada uno en su período. Cada barra deriva su altura
 * de ambos con `interpolate` de nudos precalculados, los combina con `add`/`multiply` y saca el
 * valor absoluto con otra `interpolate`. Por frame, el hilo de JS no hace **nada**: todo es
 * interpolación nativa sobre `transform`, que es lo que el driver nativo sabe hacer barato.
 *
 * **Por qué dos relojes y no uno.** Con uno solo la onda se repetía idéntica cada 2,5 s y se leía
 * como mecánica (el operador la describió así el 2026-07-20, y tenía razón). Dos relojes de períodos
 * inconmensurables entre sí devuelven el período real de la referencia —62,8 s— sin que ninguna
 * tabla de nudos tenga que cubrir 62,8 s. Ver `OMEGA_RAPIDA`/`OMEGA_LENTA`.
 *
 * **Lo que NO se portó de la referencia, y por qué.** El SVG original apila dos capas: uno desenfocado
 * al 55% (`feGaussianBlur stdDeviation=2.6`) y otro con `drop-shadow` (`waves-gallery.js:67-75`).
 * Acá no van: una sombra sobre N vistas animadas se re-rasteriza en cada frame, y este archivo se
 * escribió durante un sprint cuyo hallazgo central fue que el tiempo se va en *issue draw commands*.
 * El degradé es lo que carga el look; el halo era el adorno más caro y el menos visible en una
 * franja de 48 dp.
 */
export function Onda({ niveles }: OndaProps) {
  // DOS relojes, uno por término del seno. Ver `OMEGA_RAPIDA`/`OMEGA_LENTA`: con uno solo la onda se
  // repetía cada 2,5 s y se veía mecánica; con dos, la combinación no se repite hasta los 62,8 s.
  const relojRapido = useRef(new Animated.Value(0)).current;
  const relojLento = useRef(new Animated.Value(0)).current;
  // Lo único que toca el audio.
  const amplitud = useRef(new Animated.Value(AMPLITUD_REPOSO)).current;

  // Los bucles: cada reloj recorre 0→1 en SU período, lineal y sin fin. `Easing.linear` importa --
  // con la curva por defecto (`inOut`) la onda frenaría y aceleraría en cada vuelta.
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

  /**
   * El micrófono sólo mueve la amplitud, con la misma constante de tiempo que la referencia.
   *
   * 🔴 **Acá vivía el defecto que hacía que la onda se sintiera trabada, y no tenía nada que ver con
   * cuántas barras había.** Este efecto dependía de `niveles` —un array NUEVO en cada muestra del
   * hilo de audio, o sea ~10 veces por segundo— y en su limpieza llamaba `anim.stop()`. El resultado
   * era un `stop()` + `start()` diez veces por segundo sobre el valor del que cuelgan las N cadenas
   * de nodos nativos. Android lo reportaba en cada vuelta, y decía exactamente lo que pasaba:
   *
   *     NativeAnimatedNodesManager: Native animation workaround, frame lost as result of race condition
   *     JSApplicationCausedNativeException: Illegal node ID set as an input for Animated.Add node
   *
   * **Un frame perdido por carrera**, en bucle. Medido: 99% de frames tarde con N=48 *y* con N=32 —
   * y esa insensibilidad a N es lo que delató que el modelo «el costo escala con la cantidad de
   * barras» era falso. El trabajo por frame nunca fue el problema; el problema era reconfigurar el
   * grafo de nodos mientras el driver lo estaba recorriendo.
   *
   * Dos cambios, los dos necesarios:
   *
   * 1. **Depender del ESCALAR, no del array.** `amplitudObjetivo` colapsa el lote de muestras a un
   *    número; mientras ese número no cambie, no hay nada que re-animar. Con `[niveles]` se
   *    re-animaba aunque el valor fuera idéntico, sólo porque el array era otro objeto.
   * 2. **No `stop()` en la limpieza de cada cambio.** Arrancar una animación nueva sobre el mismo
   *    `Animated.Value` ya cancela la anterior; el `stop()` explícito sólo agregaba una
   *    desconfiguración de nodos a mitad de frame. Se conserva sólo al desmontar, que es cuando de
   *    verdad hay que soltar el nodo.
   */
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

  // Al desmontar sí: el nodo se suelta una sola vez, fuera del camino del frame.
  useEffect(() => {
    return () => amplitud.stopAnimation();
  }, [amplitud]);

  /**
   * La altura de cada barra, ya compuesta: `reposo + (1-reposo) · forma(t) · amplitud`.
   *
   * Se calcula UNA vez (`useMemo` sin dependencias reactivas): son N interpolaciones que el driver
   * nativo evalúa solo. Recalcularlas por render tiraría los nodos nativos y la onda se cortaría en
   * cada muestra de audio — justo el defecto que este modelo viene a sacar.
   */
  const barras = useMemo(() => {
    const fases = Array.from({ length: NUDOS }, (_, k) => k / (NUDOS - 1));
    const pisoFrac = ALTURA_REPOSO / ALTURA_MAXIMA;
    // Rango de la suma `sin(a) + 0.4·sin(b)`: [-1.4, 1.4].
    const TOPE_SUMA = 1 + PESO_LENTO;
    return Array.from({ length: CANTIDAD_BARRAS }, (_, i) => {
      // Cada seno se interpola contra SU reloj. Son dos tablas de nudos por barra en vez de una,
      // pero cada tabla cubre un ciclo entero de su propio término -- que es lo que permite que la
      // combinación tenga período largo sin tablas largas.
      const rapido = relojRapido.interpolate({
        inputRange: fases,
        outputRange: fases.map((f) => senoRapido(i, f)),
      });
      const lento = relojLento.interpolate({
        inputRange: fases,
        outputRange: fases.map((f) => senoLento(i, f)),
      });

      // 🔴 El valor absoluto de la referencia, SIN JS por frame: `|x|` es lineal a trozos, así que
      // una `interpolate` de tres puntos lo calcula EXACTO (no aproximado) sobre la suma ya
      // compuesta. Es el mismo truco que el degradé: cuando la función es lineal a trozos, el
      // interpolador nativo no la aproxima, la es.
      const absSuma = Animated.add(rapido, Animated.multiply(PESO_LENTO, lento)).interpolate({
        inputRange: [-TOPE_SUMA, 0, TOPE_SUMA],
        outputRange: [TOPE_SUMA, 0, TOPE_SUMA],
      });

      // `dyn = 0.5 + 0.42·|…|`, por la envolvente estática de la barra, acotado a 0..1 porque el
      // máximo teórico (0.5 + 0.42·1.4 ≈ 1.088) puede pasarse.
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
            // Sin `translateY`: la referencia dibuja cada barra de `mid-h` a `mid+h`, o sea
            // SIMÉTRICA respecto del centro (`waves-gallery.js:114`). `scaleY` ya escala desde el
            // centro, así que el oscilograma sale solo -- lo que había que sacar era la corrección
            // que la apoyaba sobre una base, propia de una onda de barras, no de un oscilograma.
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
    // `center`, no `flex-end`: el oscilograma crece hacia los DOS lados desde el eje.
    alignItems: 'center',
    justifyContent: 'center',
    height: ALTURA_MAXIMA,
    // 🔴 `stretch` NO es cosmético: sin él la onda es INVISIBLE. Las barras son `flex: 1`, o sea que
    // su ancho lo reparte el CONTENEDOR -- y un contenedor sin ancho propio, dentro de un padre
    // centrado (ancho "auto" = el de su contenido), resuelve a 0. El resultado es el peor modo de
    // fallo posible: 100 vistas animándose a 60 fps, midiendo cero, sin un solo error en consola.
    // Pasó de verdad (2026-07-20) al portar la onda de la galería: la versión anterior tenía barras
    // de `width: 3`, así que el ancho salía del CONTENIDO y el consumidor nunca tuvo que dar ninguno.
    // Cambiar de "me dimensiono solo" a "heredo el ancho" es un cambio de CONTRATO con quien me monta.
    alignSelf: 'stretch',
  },
  barra: {
    // `flex: 1` reparte el ancho disponible entre las N barras sin que el número quede clavado a un
    // ancho de pantalla. El margen deja el hueco entre barras: la referencia usa barra y hueco de
    // igual ancho (`bw = step * 0.5`, `waves-gallery.js:96`).
    flex: 1,
    // Piso de ancho: defensa en profundidad contra el fallo de arriba. Si algún consumidor futuro
    // vuelve a montar la onda sin darle ancho, se verá APRETADA -- fea, pero visible y reportable.
    // La alternativa es que desaparezca en silencio, y un fallo mudo no se arregla porque nadie lo ve.
    minWidth: 1,
    // 🔴 El hueco es PROPORCIONAL a N, no fijo. La referencia hace `bw = step * 0.5`
    // (`waves-gallery.js:96`): la barra ocupa la MITAD de su casilla y la otra mitad es aire. Con un
    // margen fijo eso sólo se cumple para un N concreto — al bajar de 48 a 32 barras las casillas se
    // ensanchan, el margen no, y la onda pasa de espectro fino a BLOQUES. Fue exactamente lo que
    // pasó al medir N=32 y casi hace descartar el N más fluido por un defecto de proporción, no de N.
    //
    // La cuenta: si la casilla es `W/N` y la barra tiene que medir la mitad, cada margen es `W/(4N)`,
    // o sea `25/N` por ciento del ancho del contenedor. Sale del propio N, así que cambiar N nunca
    // vuelve a deformar la onda.
    marginHorizontal: `${25 / CANTIDAD_BARRAS}%`,
    height: ALTURA_MAXIMA,
    borderRadius: 1,
  },
});
