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
 * Port 1:1 de los tests de `Onda.tsx` en documed -- el componente no cambió nada salvo su ubicación
 * (`modules/chat/` en vez de `modules/captura/`, porque este repo no tiene panel clínico) y de dónde
 * importa la paleta (misma ruta relativa, `ondaPalette.ts` ya vive acá con el mismo shape).
 *
 * 🔴 Este archivo NO mockea la librería de animación. La onda está escrita sobre el `Animated` del
 * CORE de React Native (nada que mockear, no hace falta el plugin de Babel de Reanimated): lo que se
 * afirma acá es lo que un test PUEDE afirmar sin mentir -- las funciones puras que deciden qué se
 * dibuja, y que el componente monte la cantidad fija de barras. La animación en sí (60 fps, el driver
 * nativo) se verifica mirándola en el dispositivo, no leyendo el árbol de React.
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
 * 🔴 Ata el modelo al eje que un test en fases sueltas no puede ver: el TIEMPO LARGO. Un reloj único
 * hace que la onda se repita idéntica cada 2,5 s -- y en fases sueltas eso es indistinguible de una
 * onda que no se repite. Estos tests miran la trayectoria completa.
 */
describe('la onda NO se repite -- es lo que separa "orgánica" de "mecánica"', () => {
  const faseEn = (segundos: number, periodoMs: number) =>
    (segundos * 1000) / periodoMs - Math.floor((segundos * 1000) / periodoMs);
  // Los períodos se IMPORTAN del módulo, no se re-escriben acá -- con constantes propias esto sería
  // una fotocopia que seguiría verde aunque alguien volviera a colapsar los dos relojes en uno.
  const PERIODO_RAPIDO = PERIODO_RAPIDO_MS;
  const PERIODO_LENTO = PERIODO_LENTO_MS;
  const alturaEn = (segundos: number, barra = 5) =>
    formaBarra(barra, faseEn(segundos, PERIODO_RAPIDO), faseEn(segundos, PERIODO_LENTO));

  it('no vuelve a la misma forma al cerrar el ciclo del reloj rápido', () => {
    const periodoRapidoSeg = PERIODO_RAPIDO / 1000;
    expect(alturaEn(0)).not.toBeCloseTo(alturaEn(periodoRapidoSeg), 4);
  });

  it('tampoco a los 2,5 s -- el período del bucle que se veía mecánico', () => {
    expect(alturaEn(0)).not.toBeCloseTo(alturaEn(2.513), 4);
  });

  it('recorre formas DISTINTAS a lo largo de 10 s, no un puñado repetido', () => {
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
  // Sin muestras y con muchas: la cantidad de barras no puede cambiar. Va en dos tests y no en uno
  // con `unmount()` en el medio porque en RNTL 14 `unmount()` TAMBIÉN devuelve una promesa -- sin
  // `await`, el desmontaje queda en vuelo y le pisa el árbol al render siguiente.
  it('sin ninguna muestra, monta la cantidad fija de barras', async () => {
    await render(
      <ThemeProvider>
        <Onda niveles={[]} />
      </ThemeProvider>,
    );

    expect(screen.getAllByTestId(/^onda-barra-/)).toHaveLength(CANTIDAD_BARRAS);
  });

  it('con muchas más muestras que barras, monta exactamente la misma cantidad', async () => {
    await render(
      <ThemeProvider>
        <Onda niveles={Array(200).fill(0.5)} />
      </ThemeProvider>,
    );

    expect(screen.getAllByTestId(/^onda-barra-/)).toHaveLength(CANTIDAD_BARRAS);
  });
});

/**
 * 🔴 Ata la onda a la REFERENCIA (`osc-gbp` de `waves-gallery.js`), no a lo que el código hace hoy.
 * Sin esto, el degradé podría derivar a otro plausible y nadie lo notaría hasta poner la app al lado
 * de la galería.
 */
describe('colorDeBarra -- el degradé sale de la referencia, no del tema', () => {
  it('los extremos son EXACTAMENTE el primer y el último stop de la paleta', () => {
    expect(colorDeBarra(0, 100)).toBe(ONDA_OSC_GBP[0]);
    expect(colorDeBarra(99, 100)).toBe(ONDA_OSC_GBP[ONDA_OSC_GBP.length - 1]);
  });

  it('los 5 stops caen donde los pone el gradiente: repartidos parejo', () => {
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
    expect(colorDeBarra(7, 100)).toBe(colorDeBarra(7, 100));
  });
});

/**
 * 🔴 Las barras son `flex: 1` (ancho repartido por el contenedor), no `width` fijo -- eso vuelve al
 * padre parte del CONTRATO: si algún consumidor futuro monta `Onda` sin darle ancho propio (p.ej. un
 * `View` centrado, de ancho "auto"), `flex: 1` dentro de ese padre colapsa a 0 y la onda desaparece
 * SIN error -- 32 vistas animándose a 60 fps, invisibles. Jest no corre Yoga (ningún `onLayout` se
 * dispara, `width` nunca se resuelve a un número), así que esto no prueba que se VEA -- prueba la
 * invariante de diseño que hace el fallo imposible: que el contenedor pida su ancho al padre
 * explícitamente, y que cada barra tenga un piso propio para no poder desaparecer del todo.
 */
describe('la onda no puede volverse invisible', () => {
  const estiloDe = (elemento: { props: Record<string, unknown> }): Record<string, unknown> =>
    Object.assign({}, ...[elemento.props.style].flat(Infinity).filter(Boolean));

  it('el contenedor RECLAMA el ancho del padre en vez de esperar a que se lo den', async () => {
    await render(
      <ThemeProvider>
        <Onda niveles={[]} />
      </ThemeProvider>,
    );

    expect(estiloDe(screen.getByTestId('onda')).alignSelf).toBe('stretch');
  });

  it('cada barra tiene un piso de ancho propio: un fallo de layout se VE, no se esconde', async () => {
    await render(
      <ThemeProvider>
        <Onda niveles={[]} />
      </ThemeProvider>,
    );

    const barra = estiloDe(screen.getByTestId('onda-barra-0'));
    expect(barra.minWidth).toBeGreaterThan(0);
  });
});

describe('la silueta es FIJA, no aleatoria', () => {
  it('la misma barra en las mismas fases da siempre lo mismo, corrida tras corrida', () => {
    const primera = Array.from({ length: 10 }, (_, i) => formaBarra(i, 0.3, 0.14));
    const segunda = Array.from({ length: 10 }, (_, i) => formaBarra(i, 0.3, 0.14));
    expect(primera).toEqual(segunda);
  });

  it('bajar la cantidad de barras NO deforma la envolvente (u está normalizado)', () => {
    const centroDe100 = formaBarra(49, 0, 0, 100);
    const centroDe50 = formaBarra(24, 0, 0, 50);
    expect(Number.isFinite(centroDe100)).toBe(true);
    expect(Number.isFinite(centroDe50)).toBe(true);
    expect(centroDe100).toBeGreaterThan(0);
    expect(centroDe50).toBeGreaterThan(0);
  });
});
