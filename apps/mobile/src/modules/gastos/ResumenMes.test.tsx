import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import type { CategoriaGasto, ResumenGastos } from '@copiloto/core';

import { ThemeProvider } from '../../theme/ThemeProvider';
import { ResumenMes } from './ResumenMes';

/**
 * El gemelo de `apps/copiloto-web/src/modules/gastos/ResumenMes.test.tsx`, y existe por lo que ese
 * archivo **no** cubre.
 *
 * `GASTOSCATEG` (SM-D8) cerró el 2026-10-14 fijando el desglose por categoría **en web**, que es lo
 * que su DoD pedía. Pero el mecanismo vive DOS veces: `apps/mobile/.../ResumenMes.tsx:62` emite el
 * mismo `gastos-resumen-barra-<cat>` con su propio cálculo de ancho, y del lado de mobile no había
 * nada que lo ejercitara. En un sprint MOBILE eso deja el render fijado sólo del lado que no es el
 * del sprint — el patrón de `memoria/dos-implementaciones-del-mismo-cliente-el-fix-llega-a-una.md`,
 * donde lo que engaña es que el defecto ya «tiene test».
 *
 * Los dos componentes NO comparten código: web usa `style.width` del DOM y mobile un `StyleSheet`
 * aplanado, así que un test no puede cubrir al otro ni por accidente. Por eso se replican los tres
 * casos del DoD en vez de refactorizar hacia un helper común: el valor está justamente en medir las
 * dos implementaciones por separado.
 *
 * ⚠️ `montar` es `async` y cada caso la `await`-ea: con RNTL 14 + React 19 `render()` devuelve
 * una PROMESA, y sin el await el fallo es «`render` function has not been called» — que no
 * nombra el await y manda a buscar al componente. Lo documenta `apps/mobile/jest.config.js:20`.
 */

const resumen = (parcial: Partial<ResumenGastos>): ResumenGastos => ({
  periodo: '2026-10',
  total: '0.00',
  porCategoria: [],
  mesAnterior: null,
  ...parcial,
});

const montar = async (r: ResumenGastos) =>
  render(
    <ThemeProvider>
      <ResumenMes resumen={r} />
    </ThemeProvider>,
  );

/** Las filas en el ORDEN en que el render las montó, no en el del payload. */
const filas = (): string[] =>
  screen
    .queryAllByTestId(/^gastos-resumen-cat-[a-z]+$/)
    .map((el) => String(el.props.testID).replace('gastos-resumen-cat-', ''));

/**
 * El ancho sale de `StyleSheet.flatten` y no de `props.style.width`: el estilo de la barra es un
 * ARRAY (`[styles.barra, { width }]`), así que leer `.width` del array da `undefined` — un vacío
 * que se parece a «no tiene ancho» y absolvería al componente sin medirlo.
 */
const anchoDe = (cat: CategoriaGasto): string =>
  String(StyleSheet.flatten(screen.getByTestId(`gastos-resumen-barra-${cat}`).props.style).width);

describe('ResumenMes (mobile) — desglose por categoría', () => {
  // El caso VACÍO primero: diseñar contra el caso lleno ciega al normal, y en octubre del usuario
  // canónico este render tiene UNA sola categoría — fue lo que hizo leer «una barra» como «ninguna».
  it('con 0 gastos no rompe: cifra en cero, sin filas ni barras, sin chip de mes anterior', async () => {
    await montar(resumen({ total: '0.00', porCategoria: [] }));

    expect(screen.getByTestId('gastos-resumen-cifra')).toHaveTextContent('$0,00');
    expect(filas()).toEqual([]);
    expect(screen.queryAllByTestId(/^gastos-resumen-barra-/)).toEqual([]);
    expect(screen.queryByTestId('gastos-resumen-chip')).toBeNull();
  });

  it('una fila y una barra por categoría, en el orden que manda el resumen (mayor a menor)', async () => {
    await montar(
      resumen({
        total: '100000.00',
        porCategoria: [
          { categoria: 'mercaderia', total: '50000.00', porcentaje: 50 },
          { categoria: 'servicios', total: '30000.00', porcentaje: 30 },
          { categoria: 'transporte', total: '20000.00', porcentaje: 20 },
        ],
      }),
    );

    expect(filas()).toEqual(['mercaderia', 'servicios', 'transporte']);
    expect(anchoDe('mercaderia')).toBe('50%');
    expect(anchoDe('servicios')).toBe('30%');
    expect(anchoDe('transporte')).toBe('20%');
    // El mismo nodo lleva importe Y porcentaje (`$50.000,00 · 50%`), asi que va por regex:
    // `toHaveTextContent` con un string compara el texto COMPLETO.
    expect(screen.getByTestId('gastos-resumen-cat-mercaderia-importe')).toHaveTextContent(/50%/);
  });

  it('normaliza el ancho sobre la suma REAL de porcentajes: tres iguales dan 33,3 y no suman 100', async () => {
    // El contrato avisa que los porcentajes no cierran en 100 (`ResumenGastos` en core). Dibujar
    // contra 100 dejaría un hueco permanente que se lee como «falta un pedazo».
    await montar(
      resumen({
        total: '90000.00',
        porCategoria: [
          { categoria: 'mercaderia', total: '30000.00', porcentaje: 33.3 },
          { categoria: 'servicios', total: '30000.00', porcentaje: 33.3 },
          { categoria: 'sueldos', total: '30000.00', porcentaje: 33.3 },
        ],
      }),
    );

    // Por VALOR y no por la cadena: `(33.3/99.9)*100` y `100/3` son el mismo numero y difieren
    // en el ultimo bit (`33.33333333333333` vs `...336`). Comparar el string mediria el redondeo
    // de IEEE-754 en vez de la normalizacion, y el test se caeria sin que nada se rompa.
    const ancho = (cat: CategoriaGasto) => parseFloat(anchoDe(cat));
    expect(ancho('mercaderia')).toBeCloseTo(100 / 3, 10); // sobre la suma real (99,9), no sobre 100
    expect(ancho('sueldos')).toBeCloseTo(100 / 3, 10);
    expect(ancho('mercaderia') + ancho('servicios') + ancho('sueldos')).toBeCloseTo(100, 10);
  });

  it('con UNA sola categoría la barra ocupa el 100%: el render responde al dato, no a un ancho fijo', async () => {
    // Éste es el MUTANTE del DoD de GASTOSCATEG, escrito como caso en vez de como edición manual:
    // si el ancho no saliera del dato, una categoría al 51% pintaría 51% y este assert fallaría.
    // Es también la forma exacta en que el canónico devuelve octubre: `[{otros, 100}]`.
    await montar(
      resumen({
        total: '51234.00',
        porCategoria: [{ categoria: 'otros', total: '51234.00', porcentaje: 51 }],
      }),
    );

    expect(filas()).toEqual(['otros']);
    expect(anchoDe('otros')).toBe('100%');
  });

  it('con todos los porcentajes en cero la barra queda en 0% y no desaparece por NaN', async () => {
    // El backend ya filtra las categorías en cero, así que esto no debería llegar — pero si llega,
    // `porcentaje / 0` daría `NaN%` y la barra se iría sin avisar. El guard existe en el componente
    // (`sumaPorcentajes > 0`) y hasta acá nada lo ejercitaba: un guard sin test es indistinguible
    // de uno ausente.
    await montar(
      resumen({
        total: '0.00',
        porCategoria: [{ categoria: 'impuestos', total: '0.00', porcentaje: 0 }],
      }),
    );

    expect(anchoDe('impuestos')).toBe('0%');
  });

  it('el chip de mes anterior aparece sólo cuando el backend lo trae', async () => {
    await montar(resumen({ total: '1000.00', mesAnterior: '800.00' }));
    expect(screen.getByTestId('gastos-resumen-chip')).toHaveTextContent(/\$800,00/);
  });
});
