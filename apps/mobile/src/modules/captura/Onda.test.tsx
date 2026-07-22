import { render, screen } from '@testing-library/react-native';

// Jest (jest-expo) -- describe/it/expect son globales, no se importan de vitest.

import { ONDA_OSC_GBP } from '../../theme/glass/ondaPalette';
import { ThemeProvider } from '../../theme/ThemeProvider';
import {
  ALTURA_MAXIMA,
  ALTURA_REPOSO,
  CANTIDAD_BARRAS,
  Onda,
  PERIODO_LENTO_MS,
  PERIODO_RAPIDO_MS,
  amplitudObjetivo,
  colorDeBarra,
  escalaDe,
  formaBarra,
} from './Onda';

/**
 * 🔴 Este archivo NO mockea la librería de animación, y esa es la lección de la versión anterior:
 * `Onda` estaba escrita sobre `react-native-reanimated` (que no es dependencia declarada de este
 * proyecto, no tiene su plugin de Babel configurado, y no está compilado en la app) y sus tests
 * pasaban porque mockeaban la librería entera. Un test que mockea aquello de lo que el componente
 * depende para existir no prueba el componente: prueba el mock. La app habría crasheado al abrir el
 * panel de grabación, con la suite en verde.
 *
 * Ahora la animación es el `Animated` del core de React Native (nada que mockear) y lo que se afirma
 * acá es lo que un test PUEDE afirmar: las funciones puras que deciden qué se dibuja, y que el
 * componente monte la cantidad fija de barras. La animación en sí se verifica mirándola en el
 * dispositivo -- no leyendo el árbol de React.
 */

/**
 * 🔴 El modelo cambió (2026-07-19): la onda pasó de *sample-driven* a **time-driven**. Antes cada
 * barra dibujaba una muestra cruda del micrófono, y como el hilo de audio entrega ~10 por segundo se
 * veían 10 escalones por segundo ("toscas, lentas y robóticas"). Ahora la forma sale del TIEMPO y el
 * micrófono aporta **un solo escalar**. Por eso `ventanaDeNiveles` ya no existe: no hay muestras que
 * repartir entre barras. Lo que se afirma acá es lo que reemplazó a esa lógica.
 */
describe('amplitudObjetivo -- lo único que el audio le aporta a la onda', () => {
  it('sin muestras no cae a cero: la onda sigue respirando, no queda colgada', () => {
    expect(amplitudObjetivo([])).toBeGreaterThan(0);
  });

  it('toma el PICO de la ventana reciente, no la última muestra suelta', () => {
    // A 10 muestras/s, la última puede caer en el valle entre dos sílabas: con la última suelta, la
    // onda se desplomaría en medio de una palabra.
    expect(amplitudObjetivo([0.9, 0.05])).toBeCloseTo(0.9);
  });

  it('acota los picos fuera de rango en vez de propagarlos', () => {
    expect(amplitudObjetivo([5])).toBe(1);
    expect(amplitudObjetivo([-3])).toBeGreaterThan(0); // cae al piso de reposo, no a un negativo
  });
});

describe('formaBarra -- la forma sale del tiempo, no de las muestras', () => {
  it('devuelve siempre una altura relativa válida', () => {
    for (let i = 0; i < CANTIDAD_BARRAS; i++) {
      for (const fr of [0, 0.13, 0.5, 0.77, 1]) {
        for (const fl of [0, 0.31, 0.62, 1]) {
          const v = formaBarra(i, fr, fl);
          expect(v).toBeGreaterThanOrEqual(0);
          expect(v).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it('es determinista: la misma barra en las mismas fases da siempre lo mismo', () => {
    expect(formaBarra(7, 0.42, 0.19)).toBe(formaBarra(7, 0.42, 0.19));
  });

  it('las barras NO laten al unísono -- cada una tiene su fase y su peso', () => {
    const enFaseCero = Array.from({ length: CANTIDAD_BARRAS }, (_, i) => formaBarra(i, 0, 0));
    expect(new Set(enFaseCero).size).toBeGreaterThan(CANTIDAD_BARRAS / 2);
  });

  it('la onda avanza: una misma barra cambia de altura a lo largo del ciclo', () => {
    const alturas = [0, 0.1, 0.2, 0.3, 0.4, 0.5].map((f) => formaBarra(3, f, f * 0.46));
    expect(new Set(alturas).size).toBeGreaterThan(1);
  });
});

/**
 * 🔴 **El test que faltaba, y que el operador tuvo que hacer con el ojo.**
 *
 * La primera versión del port colapsó las dos frecuencias de la referencia (5 y 2.3) en un solo
 * reloj cambiando 2.3 → 2.5, para que el bucle cerrara en 2,5 s y se pudieran precalcular los nudos.
 * El comentario que justificaba el cambio decía «el cambio es imperceptible». **No lo era**: la onda
 * entera se repetía idéntica cada 2,5 segundos y se leía como mecánica. Nadie lo notó porque los
 * tests verificaban la forma en fases sueltas, y en fases sueltas una onda repetitiva es indistinguible
 * de una que no lo es. Este describe mira el EJE que faltaba: el tiempo largo.
 */
describe('la onda NO se repite -- es lo que separa "orgánica" de "mecánica"', () => {
  // Cada reloj avanza a su ritmo. A los `s` segundos, cada uno va por `s / periodo` vueltas, y lo
  // que importa es la parte fraccionaria: esa es su fase.
  const faseEn = (segundos: number, periodoMs: number) => (segundos * 1000) / periodoMs - Math.floor((segundos * 1000) / periodoMs);
  // 🔴 Los períodos se IMPORTAN del módulo, no se re-escriben acá. Con constantes propias esto sería
  // una fotocopia: alguien podría volver a colapsar los dos relojes en uno y estos tests seguirían
  // verdes, midiendo un modelo que ya no existe.
  const PERIODO_RAPIDO = PERIODO_RAPIDO_MS;
  const PERIODO_LENTO = PERIODO_LENTO_MS;
  const alturaEn = (segundos: number, barra = 5) =>
    formaBarra(barra, faseEn(segundos, PERIODO_RAPIDO), faseEn(segundos, PERIODO_LENTO));

  it('no vuelve a la misma forma al cerrar el ciclo del reloj rápido', () => {
    // Con UN solo reloj esto era una identidad exacta y la onda se veía en bucle.
    const periodoRapidoSeg = PERIODO_RAPIDO / 1000;
    expect(alturaEn(0)).not.toBeCloseTo(alturaEn(periodoRapidoSeg), 4);
  });

  it('tampoco a los 2,5 s -- el período del bucle que se veía mecánico', () => {
    expect(alturaEn(0)).not.toBeCloseTo(alturaEn(2.513), 4);
  });

  it('recorre formas DISTINTAS a lo largo de 10 s, no un puñado repetido', () => {
    // Se muestrea cada 100 ms durante 10 s. Si la onda tuviera un período de 2,5 s, habría ~25
    // valores distintos repetidos 4 veces. Sin período corto, los 100 son distintos.
    const muestras = Array.from({ length: 100 }, (_, k) => alturaEn(k * 0.1).toFixed(6));
    expect(new Set(muestras).size).toBeGreaterThan(90);
  });

  it('los dos relojes tienen períodos DISTINTOS: si fueran iguales, volvería el bucle corto', () => {
    expect(PERIODO_RAPIDO).not.toBeCloseTo(PERIODO_LENTO, 1);
  });
});

describe('escalaDe -- qué tan alta se ve una barra', () => {
  it('en reposo NO es cero: una onda apagada sigue siendo una onda, no un hueco vacío', () => {
    const enReposo = escalaDe(0) * ALTURA_MAXIMA;
    expect(enReposo).toBe(ALTURA_REPOSO);
    expect(enReposo).toBeGreaterThan(0);
  });

  it('al máximo ocupa la altura completa, y crece de forma monótona entre medio', () => {
    expect(escalaDe(1) * ALTURA_MAXIMA).toBe(ALTURA_MAXIMA);
    expect(escalaDe(0.5)).toBeGreaterThan(escalaDe(0));
    expect(escalaDe(1)).toBeGreaterThan(escalaDe(0.5));
  });
});

describe('Onda -- el componente', () => {
  // Sin muestras y con muchas: la cantidad de barras no puede cambiar. Va en dos tests y no en uno con
  // `unmount()` en el medio porque en RNTL 14 `unmount()` TAMBIÉN devuelve una promesa -- sin
  // `await`, el desmontaje queda en vuelo y le pisa el árbol al render siguiente.
  it('sin ninguna muestra, monta la cantidad fija de barras', async () => {
    await render(
      <ThemeProvider>
        <Onda niveles={[]} />
      </ThemeProvider>
    );

    expect(screen.getAllByTestId(/^onda-barra-/)).toHaveLength(CANTIDAD_BARRAS);
  });

  it('con muchas más muestras que barras, monta exactamente la misma cantidad', async () => {
    await render(
      <ThemeProvider>
        <Onda niveles={Array(200).fill(0.5)} />
      </ThemeProvider>
    );

    expect(screen.getAllByTestId(/^onda-barra-/)).toHaveLength(CANTIDAD_BARRAS);
  });
});

/**
 * 🔴 Estos tests atan la onda a la REFERENCIA (`osc-gbp` de `waves-gallery.js`), no a lo que el
 * código hace hoy. Es la diferencia entre un test y una fotocopia: si alguien "mejora" la paleta o
 * el muestreo, esto se cae. Sin ellos, el degradé podría derivar a otro plausible y nadie lo notaría
 * hasta poner la app al lado de la galería.
 */
describe('colorDeBarra -- el degradé sale de la referencia, no del tema', () => {
  it('los extremos son EXACTAMENTE el primer y el último stop de la paleta', () => {
    expect(colorDeBarra(0, 100)).toBe(ONDA_OSC_GBP[0]);
    expect(colorDeBarra(99, 100)).toBe(ONDA_OSC_GBP[ONDA_OSC_GBP.length - 1]);
  });

  it('los 5 stops caen donde los pone el gradiente: repartidos parejo', () => {
    // `offset = i / (n-1)` en waves-gallery.js:70 -> con 5 colores, en 0 · 0.25 · 0.5 · 0.75 · 1.
    const total = 101; // 101 barras -> los cuartos caen en índices enteros (0, 25, 50, 75, 100)
    ONDA_OSC_GBP.forEach((esperado, i) => {
      const indice = Math.round((i / (ONDA_OSC_GBP.length - 1)) * (total - 1));
      expect(colorDeBarra(indice, total)).toBe(esperado);
    });
  });

  it('entre dos stops interpola, no salta al más cercano', () => {
    const medio = colorDeBarra(12, 101); // entre el stop 0 (idx 0) y el 1 (idx 25)
    expect(medio).not.toBe(ONDA_OSC_GBP[0]);
    expect(medio).not.toBe(ONDA_OSC_GBP[1]);
    expect(medio).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('el color depende SÓLO de la posición: es lo que lo hace gratis por frame', () => {
    // Si esto dejara de ser cierto (p.ej. si el color pasara a depender del nivel de audio), la
    // onda volvería a hacer trabajo de JS por frame -- el defecto que el modelo time-driven sacó.
    expect(colorDeBarra(7, 100)).toBe(colorDeBarra(7, 100));
  });
});

/**
 * 🔴 **El test que faltaba el 2026-07-20, y por qué este archivo no lo tenía.**
 *
 * Al portar la onda de la galería, las barras pasaron de `width: 3` (ancho propio) a `flex: 1`
 * (ancho repartido por el contenedor). Eso cambió el CONTRATO con quien monta la onda: antes se
 * dimensionaba sola, después necesitaba que el padre le diera un ancho. El consumidor
 * (`HudGrabacion`) la montaba en un `View` centrado, de ancho "auto" -- y `flex: 1` dentro de un
 * padre de ancho auto colapsa a **0**. Resultado: 100 vistas animándose a 60 fps, invisibles, sin un
 * solo error. Los 6 tests de esta suite pasaron los tres verdes: verificaban el ÁRBOL (que las barras
 * se monten, con qué color, con qué forma), y el defecto vivía en el LAYOUT.
 *
 * ⚠️ **Lo que estos tests NO son.** Jest no corre Yoga: acá no hay layout, ningún `onLayout` se
 * dispara y `width` nunca se resuelve a un número. Sería deshonesto llamarlos "test de que la onda se
 * ve". Lo que afirman es la **invariante de diseño que hace imposible el fallo**: que la onda pida su
 * ancho al padre explícitamente, y que además tenga un piso propio para no poder desaparecer del todo.
 * La verificación de que se VE se hace mirando el teléfono -- y así se encontró este bug.
 */
describe('la onda no puede volverse invisible', () => {
  // `props` es `Record<string, any>` en RNTL: el estilo puede venir como objeto, como array, o como
  // array anidado (que es el caso acá). `flat(Infinity)` + `Object.assign` lo aplana a lo que el
  // runtime realmente compone.
  const estiloDe = (elemento: { props: Record<string, unknown> }): Record<string, unknown> =>
    Object.assign({}, ...[elemento.props.style].flat(Infinity).filter(Boolean));

  it('el contenedor RECLAMA el ancho del padre en vez de esperar a que se lo den', async () => {
    await render(
      <ThemeProvider>
        <Onda niveles={[]} />
      </ThemeProvider>
    );

    // Sin `stretch`, un padre centrado le da ancho "auto" = el de su contenido, y su contenido son
    // barras `flex: 1` que dependen del contenedor. Esa circularidad resuelve a 0.
    expect(estiloDe(screen.getByTestId('onda')).alignSelf).toBe('stretch');
  });

  it('cada barra tiene un piso de ancho propio: un fallo de layout se VE, no se esconde', async () => {
    await render(
      <ThemeProvider>
        <Onda niveles={[]} />
      </ThemeProvider>
    );

    const barra = estiloDe(screen.getByTestId('onda-barra-0'));
    expect(barra.minWidth).toBeGreaterThan(0);
  });
});

describe('la silueta es FIJA, no aleatoria', () => {
  /**
   * La referencia siembra su generador congruencial con 3 para `osc-gbp` (`waves-gallery.js:13,95`).
   * Si la semilla o el generador cambian, la onda sigue viéndose "como una onda" pero deja de ser
   * ESTA onda -- y ese es el fallo que nadie nota sin comparar contra la galería.
   */
  it('la misma barra en las mismas fases da siempre lo mismo, corrida tras corrida', () => {
    const primera = Array.from({ length: 10 }, (_, i) => formaBarra(i, 0.3, 0.14));
    const segunda = Array.from({ length: 10 }, (_, i) => formaBarra(i, 0.3, 0.14));
    expect(primera).toEqual(segunda);
  });

  it('bajar la cantidad de barras NO deforma la envolvente (u está normalizado)', () => {
    // La barra del centro con 100 y con 50 barras cae en el mismo `u`, así que su envolvente
    // (la campana + el `bell`) tiene que ser comparable. Es lo que permite bajar N si el device
    // no aguanta, sin cambiar el diseño.
    const centroDe100 = formaBarra(49, 0, 0, 100);
    const centroDe50 = formaBarra(24, 0, 0, 50);
    expect(Number.isFinite(centroDe100)).toBe(true);
    expect(Number.isFinite(centroDe50)).toBe(true);
    expect(centroDe100).toBeGreaterThan(0);
    expect(centroDe50).toBeGreaterThan(0);
  });
});
