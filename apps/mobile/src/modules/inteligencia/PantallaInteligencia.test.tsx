/**
 * `PantallaInteligencia` — la portada de IN.
 *
 * **[CONNECT] — el endpoint no está vivo; la pantalla habla con `leerPortada()` mockeado.** Lo que se
 * fija acá son las dos reglas que un tablero de KPIs no puede violar: (1) *«todavía no está»* ≠ *«tu
 * negocio está en cero»*, y (2) un número que no vino se muestra «—», nunca «$0».
 *
 * ⚠️ Todo `fireEvent` va con `await` — ver el docstring de `jest.config.js`.
 */
jest.mock('@copiloto/core', () => {
  const actual = jest.requireActual('@copiloto/core');
  return {
    ...actual,
    leerPortada: jest.fn(),
    leerGraficoFacturacion: jest.fn(),
    leerGraficoEntroVsSalio: jest.fn(),
    leerGraficoCategorias: jest.fn(),
    leerGraficoMargenTrabajo: jest.fn(),
  };
});

import { router } from 'expo-router';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';

import {
  leerGraficoCategorias,
  leerGraficoEntroVsSalio,
  leerGraficoFacturacion,
  leerGraficoMargenTrabajo,
  leerPortada,
} from '@copiloto/core';

import { PantallaInteligencia } from './PantallaInteligencia';
import { ThemeProvider } from '../../theme/ThemeProvider';

const leerMock = leerPortada as jest.MockedFunction<typeof leerPortada>;
const facturacionMock = leerGraficoFacturacion as jest.MockedFunction<typeof leerGraficoFacturacion>;
const entroVsSalioMock = leerGraficoEntroVsSalio as jest.MockedFunction<typeof leerGraficoEntroVsSalio>;
const categoriasMock = leerGraficoCategorias as jest.MockedFunction<typeof leerGraficoCategorias>;
const margenTrabajoMock = leerGraficoMargenTrabajo as jest.MockedFunction<typeof leerGraficoMargenTrabajo>;

const PORTADA = {
  caja: { saldo: '184000.00', moneda: 'ARS', fechaCorte: null, variacionPct: null, incompleta: false },
  mes: { ingresos: '95000.00', gastos: '31000.00', rentabilidad: '64000.00', facturado: '120000.00', cobrado: '90000.00' },
  serieMensual: [
    { mes: '2026-03', ingresos: '80000.00', gastos: '20000.00' },
    { mes: '2026-04', ingresos: '95000.00', gastos: '31000.00' },
  ],
  mejoresClientes: [{ cliente: 'Panadería Los Tilos', total: '48000.00' }],
  porCobrar: { total: '30000.00', vencido: '12000.00' },
};

async function montar() {
  return render(
    <ThemeProvider>
      <PantallaInteligencia />
    </ThemeProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  leerMock.mockResolvedValue({ status: 'ok', portada: PORTADA });
  // Los 4 gráficos no son el objeto de este archivo (tienen el propio `GraficosInteligencia.test.tsx`)
  // — `no_disponible` los deja sin pintar nada, así no interfieren con las aserciones de la portada.
  facturacionMock.mockResolvedValue({ status: 'no_disponible' });
  entroVsSalioMock.mockResolvedValue({ status: 'no_disponible' });
  categoriasMock.mockResolvedValue({ status: 'no_disponible' });
  margenTrabajoMock.mockResolvedValue({ status: 'no_disponible' });
});

describe('PantallaInteligencia — lo que muestra', () => {
  it('pinta la caja, los cinco números del mes y los mejores clientes', async () => {
    await montar();

    await waitFor(() => expect(screen.getByTestId('inteligencia-caja')).toBeTruthy());
    expect(screen.getByTestId('inteligencia-mes-rentabilidad')).toBeTruthy();
    expect(screen.getByText('Panadería Los Tilos')).toBeTruthy();
  });

  it('la serie mensual dibuja una barra por mes', async () => {
    await montar();

    await waitFor(() => expect(screen.getByTestId('inteligencia-barra-2026-03')).toBeTruthy());
    expect(screen.getByTestId('inteligencia-barra-2026-04')).toBeTruthy();
  });

  it('lo vencido se muestra aparte, porque es lo accionable', async () => {
    await montar();

    await waitFor(() => expect(screen.getByTestId('inteligencia-vencido')).toBeTruthy());
  });

  it('el título "Inteligencia de Negocio" lo aporta su MarcoGlass, una sola vez', async () => {
    await montar();
    await waitFor(() => expect(screen.getByTestId('inteligencia-caja')).toBeTruthy());
    expect(screen.getAllByText('Inteligencia de Negocio')).toHaveLength(1);
  });
});

describe('PantallaInteligencia — lo que NO inventa', () => {
  it('🔴 sin endpoint desplegado lo DICE, y no muestra ningún número', async () => {
    leerMock.mockResolvedValue({ status: 'no_disponible' });

    await montar();

    await waitFor(() => expect(screen.getByTestId('inteligencia-no-disponible')).toBeTruthy());
    expect(screen.queryByTestId('inteligencia-portada')).toBeNull();
  });

  it('🔴 un KPI en `null` se muestra «—», nunca «$0»', async () => {
    // La regla que sostiene el tablero entero: «no sé cuánto facturó» y «facturó cero» son cosas
    // distintas, y un cero por default sería un KPI que miente.
    leerMock.mockResolvedValue({
      status: 'ok',
      portada: { ...PORTADA, caja: { saldo: null, moneda: 'ARS', fechaCorte: null, variacionPct: null, incompleta: false }, mes: { ...PORTADA.mes, facturado: null } },
    });

    await montar();

    await waitFor(() => expect(screen.getByTestId('inteligencia-caja')).toBeTruthy());
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
    // Y NO hay ningún «$0» inventado en pantalla.
    expect(screen.queryByText(/\$\s?0(\D|$)/)).toBeNull();
  });

  it('🔴 rentabilidad en `null` muestra la nota "no se puede calcular", nunca «$0» ni «NaN» (H-A4-3)', async () => {
    // Cuando el backend no puede calcular la rentabilidad del mes (p.ej. gastos sin asignar a
    // trabajos), viene `null` — no es que el negocio rindió cero. Mismo patrón que web
    // (InteligenciaScreen `.kpi.sindato`): "—" en el número + una nota explicando por qué.
    leerMock.mockResolvedValue({
      status: 'ok',
      portada: { ...PORTADA, mes: { ...PORTADA.mes, rentabilidad: null } },
    });

    await montar();

    await waitFor(() => expect(screen.getByTestId('inteligencia-mes-rentabilidad')).toBeTruthy());
    expect(screen.getByTestId('inteligencia-rentabilidad-nota')).toBeTruthy();
    expect(
      screen.getByText('Falta asignar gastos a trabajos. No es cero: es que todavía no se puede calcular.'),
    ).toBeTruthy();

    const celdaRentabilidad = screen.getByTestId('inteligencia-mes-rentabilidad');
    expect(within(celdaRentabilidad).getByText('—')).toBeTruthy();
    expect(within(celdaRentabilidad).queryByText(/\$\s?0(\D|$)/)).toBeNull();
    expect(within(celdaRentabilidad).queryByText(/NaN/)).toBeNull();
  });

  it('🔴 rentabilidad con dato NO muestra la nota "no se puede calcular"', async () => {
    await montar();

    await waitFor(() => expect(screen.getByTestId('inteligencia-mes-rentabilidad')).toBeTruthy());
    expect(screen.queryByTestId('inteligencia-rentabilidad-nota')).toBeNull();
  });

  it('mapeo `bi`: el saldo en caja lleva el chip «Al <fecha> · variación» y SIN dato no dibuja chip', async () => {
    leerMock.mockResolvedValue({
      status: 'ok',
      portada: { ...PORTADA, caja: { ...PORTADA.caja, fechaCorte: '2026-08-19', variacionPct: '-18.0' } },
    });
    await montar();
    await waitFor(() => expect(screen.getByTestId('inteligencia-caja-chip')).toBeTruthy());
    expect(screen.getByTestId('inteligencia-caja-chip').props.children).toBe('Al 19 de agosto · −18% vs mes anterior');
  });

  it('mapeo `bi` (control): con `fechaCorte` y `variacionPct` nulos el chip NO se dibuja', async () => {
    await montar();
    await waitFor(() => expect(screen.getByTestId('inteligencia-caja')).toBeTruthy());
    expect(screen.queryByTestId('inteligencia-caja-chip')).toBeNull();
  });

  it('🔴 mejores clientes vacío muestra el aviso, no una lista rota', async () => {
    // Degrada a [] si Clientes no está (contrato §3.1): la card muestra vacío, no rompe.
    leerMock.mockResolvedValue({ status: 'ok', portada: { ...PORTADA, mejoresClientes: [] } });

    await montar();

    await waitFor(() => expect(screen.getByTestId('inteligencia-clientes-vacio')).toBeTruthy());
    // Mapeo `bi-vacio` (index.html:1990): el vacío EXPLICA cómo se llena, no sólo dice que está vacío.
    expect(screen.getByTestId('inteligencia-clientes-vacio').props.children).toBe(
      'Todavía no registraste ventas a ningún cliente. Cuando factures o anotes un cobro con nombre, el ranking se arma solo.',
    );
  });

  it('🔴 CONTROL — el buscador encuentra un cliente presente y NO uno ausente', async () => {
    await montar();

    await waitFor(() => expect(screen.getByText('Panadería Los Tilos')).toBeTruthy());
    expect(screen.queryByText('Cliente Que No Existe')).toBeNull();
  });
});

describe('PantallaInteligencia — la solapa "Preguntar" es una SALIDA al chat (decisión táctica 2026-10-13)', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('tocar "Preguntar" vuelve al chat (router.back) y NO monta ninguna pantalla intermedia', async () => {
    const back = jest.spyOn(router, 'back').mockImplementation(() => {});
    await montar();
    await waitFor(() => expect(screen.getByTestId('inteligencia-caja')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('inteligencia-solapa-preguntar'));

    expect(back).toHaveBeenCalledTimes(1);
    // Sin composer propio: la pregunta se escribe en el chat, que ya tiene el suyo.
    expect(screen.queryByTestId('preguntar-inteligencia')).toBeNull();
    // Y la portada sigue ahí — tocarla no cambió de cuerpo.
    expect(screen.getByTestId('inteligencia-caja')).toBeTruthy();
  });

  it('🔴 CONTROL — tocar "Resumen" (la pantalla actual) NO navega: el spy distingue las dos solapas', async () => {
    const back = jest.spyOn(router, 'back').mockImplementation(() => {});
    await montar();
    await waitFor(() => expect(screen.getByTestId('inteligencia-caja')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('inteligencia-solapa-resumen'));

    expect(back).not.toHaveBeenCalled();
  });

  it('🔴 los 4 gráficos entran DEBAJO de la portada, en el mismo scroll', async () => {
    facturacionMock.mockResolvedValue({
      status: 'ok',
      modo: 'serie',
      tipo: 'barras',
      periodo: 'Julio 2026',
      serie: [{ mes: '2026-07', total: '50000.00', cantidad: 3 }],
    });

    await montar();

    await waitFor(() => expect(screen.getByTestId('inteligencia-graficos-seccion')).toBeTruthy());
    expect(screen.getByTestId('inteligencia-grafico-facturacion')).toBeTruthy();
  });
});

describe('PantallaInteligencia — estados textuales del refresco (BL-W6)', () => {
  it('reposo: sin indicador; arrastre corto: «Tirá»; pasado el umbral: «Soltá»; al soltar: «Actualizando…» y luego «Al día · recién»', async () => {
    await montar();
    await waitFor(() => expect(screen.getByTestId('inteligencia-portada')).toBeTruthy());
    const texto = () => screen.getByTestId('inteligencia-refresco-estado').props.children as string;
    // En reposo el indicador mide 0 (prototipo `index.html:3526`): no hay línea permanente.
    expect(screen.queryByTestId('inteligencia-refresco-estado')).toBeNull();

    await fireEvent.scroll(screen.getByTestId('inteligencia-portada'), {
      nativeEvent: { contentOffset: { y: -20 } },
    });
    expect(texto()).toBe('Tirá para actualizar');

    // iOS: arrastrar más allá del tope da contentOffset.y negativo.
    await fireEvent.scroll(screen.getByTestId('inteligencia-portada'), {
      nativeEvent: { contentOffset: { y: -80 } },
    });
    expect(texto()).toBe('Soltá para actualizar');

    // Soltar: el RefreshControl dispara onRefresh.
    let liberar: () => void = () => undefined;
    leerMock.mockImplementationOnce(
      () => new Promise((res) => { liberar = () => res({ status: 'ok', portada: PORTADA }); }),
    );
    await act(async () => {
      screen.getByTestId('inteligencia-portada').props.refreshControl.props.onRefresh();
    });
    expect(texto()).toBe('Actualizando…');

    await act(async () => liberar());
    await waitFor(() => expect(texto()).toBe('Al día · recién'));
  });
});

describe('PantallaInteligencia — el refresh se dispara al SOLTAR, no al apoyar el dedo (DEVICE15 H4, fila `bi-refresh`)', () => {
  // 🔴 El defecto de device: con el `RefreshControl` de `react-native`, `onRefresh` se disparaba a los 0,3 s del
  // DOWN, 6 s antes del UP. La causa es el ÁRBITRO del gesto: el `ScrollView` de RNGH hace `waitFor` sobre el
  // handler del `RefreshControl` de RNGH (le inyecta un `ref`); con el de RN ese `waitFor` apunta a nada y los dos
  // árbitros se disputan el dedo. Jest no tiene dedo ni UP, así que NO puede medir «después del UP» -- eso lo mide el
  // device. Lo que SÍ puede fijar es el mecanismo que lo causa: de QUÉ componente es el control. El test de arriba
  // llama `onRefresh()` a mano y por eso seguía verde con el control equivocado.
  it('el control de refresco es el de react-native-gesture-handler, NO el de react-native', async () => {
    await montar();
    await waitFor(() => expect(screen.getByTestId('inteligencia-portada')).toBeTruthy());

    const control = screen.getByTestId('inteligencia-portada').props.refreshControl;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const rngh = require('react-native-gesture-handler').RefreshControl;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const rn = require('react-native').RefreshControl;

    // Control positivo del instrumento: los dos son componentes DISTINTOS, si no la aserción de abajo no separa nada.
    expect(rngh).toBeDefined();
    expect(rn).toBeDefined();
    expect(rngh).not.toBe(rn);

    expect(control.type).toBe(rngh);
    expect(control.type).not.toBe(rn);
  });
});

describe('PantallaInteligencia — el indicador NATIVO del refresh no se dibuja (N2, relevamiento 2026-10-16)', () => {
  // 🔴 El defecto de device: al tirar para actualizar, el círculo con flecha de Android se dibujaba ENCIMA del saldo; el
  // prototipo sólo muestra «Actualizando…» (el texto de arriba). jsdom no dibuja el círculo, así que se fija lo que lo
  // ubica: `progressViewOffset` muy negativo (lo saca de cuadro). NO se afirma `colors: ['transparent']`: en Android el
  // alfa del color se pisa y el arco sale negro opaco (medido en device, 1er intento de este arreglo). Que en el teléfono
  // ya no se vea se prueba en device (captura en el doc del relevamiento).
  it('el círculo nativo queda FUERA de cuadro, y el gesto intacto (`onRefresh` + `refreshing` siguen ahí)', async () => {
    await montar();
    await waitFor(() => expect(screen.getByTestId('inteligencia-portada')).toBeTruthy());

    const { props } = screen.getByTestId('inteligencia-portada').props.refreshControl;

    expect(props.tintColor).toBe('transparent'); // iOS: la flecha sí respeta el alfa
    expect(props.progressViewOffset).toBeLessThanOrEqual(-500);
    expect(props.colors).toBeUndefined(); // no se confía en un color «transparente» (Android lo pinta negro)
    expect(typeof props.onRefresh).toBe('function');
    expect(props.refreshing).toBe(false);
  });
});
